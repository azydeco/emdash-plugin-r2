import type { BlockInteraction, BlockResponse } from "@emdash-cms/blocks";
import type { SandboxedPlugin, PluginContext } from "emdash/plugin";

const supportedFileTypes = [
	"avif",
	"AVIF",
	"apng",
	"APNG",
	"png",
	"PNG",
	"jpg",
	"JPG",
	"jpeg",
	"JPEG",
	"webp",
	"WEBP",
	"pdf",
	"PDF",
	"gif",
	"GIF",
];

interface S3Credentials {
	accessKeyId: string;
	secretAccessKey: string;
	region: string; // e.g. 'us-east-1', or 'auto' for Cloudflare R2
	bucket: string;
	endpointHost: string; // e.g. S3 hostname or Cloudflare R2 hostname
}

// Utility: Compute SHA-256 hash in hexadecimal format
async function sha256Hex(data: string): Promise<string> {
	const hash = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(data),
	);
	return Array.from(new Uint8Array(hash))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

// Utility: Compute HMAC-SHA256
async function hmacSha256(
	key: ArrayBuffer | Uint8Array,
	data: string,
): Promise<ArrayBuffer> {
	const cryptoKey = await crypto.subtle.importKey(
		"raw",
		key,
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	return crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(data));
}

export async function listBucketObjectsDirect(
	ctx: PluginContext,
	credentials: S3Credentials,
	prefix = "",
): Promise<string> {
	if (!ctx.http) return "HTTP client not available";
	const now = new Date();
	const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, ""); // YYYYMMDDTHHMMSSZ
	const dateStamp = amzDate.slice(0, 8); // YYYYMMDD

	try {
		// 1. Build and sort query parameters
		const queryParams = new URLSearchParams({
			"list-type": "2",
		});
		if (prefix) queryParams.set("prefix", prefix);
		queryParams.sort();

		const canonicalQuery = queryParams.toString();
		const isR2Path = credentials.endpointHost.includes("cloudflare");
		const canonicalUri = isR2Path ? "/" + credentials.bucket : "/";

		// 2. Canonical Headers (sorted, lowercase)
		const emptyPayloadHash =
			"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
		const canonicalHeaders =
			"host:" +
			credentials.endpointHost +
			"\n" +
			"x-amz-content-sha256:" +
			emptyPayloadHash +
			"\n" +
			"x-amz-date:" +
			amzDate +
			"\n";
		const signedHeaders = "host;x-amz-content-sha256;x-amz-date";

		// 3. Build Canonical Request
		const canonicalRequest = [
			"GET",
			canonicalUri,
			canonicalQuery,
			canonicalHeaders,
			signedHeaders,
			emptyPayloadHash,
		].join("\n");

		// 4. Build String to Sign
		const credentialScope =
			dateStamp + "/" + credentials.region + "/s3/aws4_request";
		const stringToSign = [
			"AWS4-HMAC-SHA256",
			amzDate,
			credentialScope,
			await sha256Hex(canonicalRequest),
		].join("\n");

		// 5. Derive Signing Key
		const kDate = await hmacSha256(
			new TextEncoder().encode("AWS4" + credentials.secretAccessKey),
			dateStamp,
		);
		const kRegion = await hmacSha256(kDate, credentials.region);
		const kService = await hmacSha256(kRegion, "s3");
		const kSigning = await hmacSha256(kService, "aws4_request");

		// 6. Calculate Signature
		const signatureBytes = new Uint8Array(
			await hmacSha256(kSigning, stringToSign),
		);
		const signatureHex = Array.from(signatureBytes)
			.map((b) => b.toString(16).padStart(2, "0"))
			.join("");

		const authorizationHeader =
			"AWS4-HMAC-SHA256 Credential=" +
			credentials.accessKeyId +
			"/" +
			credentialScope +
			", " +
			"SignedHeaders=" +
			signedHeaders +
			", Signature=" +
			signatureHex;

		// 7. Dispatch HTTP Fetch
		const targetUrl =
			"https://" +
			credentials.endpointHost +
			canonicalUri +
			"?" +
			canonicalQuery;
		const response = await ctx.http.fetch(targetUrl, {
			method: "GET",
			headers: {
				Host: credentials.endpointHost,
				"x-amz-date": amzDate,
				"x-amz-content-sha256": emptyPayloadHash,
				Authorization: authorizationHeader,
			},
		});

		if (!response.ok) {
			const errorText = await response.text();
			return errorText;
			// throw new Error("S3 Error (" + response.status + "): " + errorText);
		}

		return await response.text();
	} catch (e) {
		return `S3 Error:` + e;
	}
}

async function loadSettings(ctx: PluginContext) {
	const [
		bucket_name,
		api_key,
		secret_access_key,
		api_url,
		public_endpoint,
		prefix,
	] = await Promise.all([
		ctx.kv.get<string>("settings:bucketName"),
		ctx.kv.get<string>("settings:apiKey"),
		ctx.kv.get<string>("settings:secretAccessKey"),
		ctx.kv.get<string>("settings:apiUrl"),
		ctx.kv.get<string>("settings:publicEndpoint"),
		ctx.kv.get<string>("settings:prefix"),
	]);
	return {
		bucket_name,
		api_key,
		secret_access_key,
		api_url,
		public_endpoint,
		prefix,
	};
}

async function renderPlugin(ctx: PluginContext) {
	if (!ctx.http) return { blocks: [] };

	const sections = [];

	const {
		bucket_name,
		api_key,
		secret_access_key,
		api_url,
		public_endpoint,
		prefix,
	} = await loadSettings(ctx);

	if (!api_url || !api_key || !secret_access_key || !bucket_name) {
		sections.push({
			type: "header",
			text: "Missing settings",
		});
	} else {
		const config: S3Credentials = {
			accessKeyId: api_key,
			secretAccessKey: secret_access_key,
			region: "auto",
			bucket: bucket_name,
			endpointHost: new URL(api_url).host,
		};

		const xml = await listBucketObjectsDirect(ctx, config, prefix ?? "");
		if (xml.includes("<Error>")) {
			// Show the code and message in sections
			const errorCodeMatch = xml.match(/<Code>(.*?)<\/Code>/);
			const errorCode = errorCodeMatch
				? errorCodeMatch[1]
				: "Unknown error code";
			sections.push({
				type: "header",
				text: `Error: ${errorCode}`,
			});

			const errorMessageMatch = xml.match(/<Message>(.*?)<\/Message>/);
			const errorMessage = errorMessageMatch
				? errorMessageMatch[1]
				: "Unknown error";
			sections.push({
				type: "section",
				text: errorMessage,
			});
		} else if (!xml.includes("<Key>")) {
			// If the fetch fails or there are no keys
			sections.push({
				type: "section",
				text: xml,
			});
		}

		let allKeys = [...xml.matchAll(/<Key>(.*?)<\/Key>/g)].map(
			(match) => match[1],
		);
		let keys = allKeys.filter((i) => {
			const name = i.toLowerCase();
			return supportedFileTypes.some((supported) =>
				name.endsWith(`.${supported}`),
			);
		});

		// Prevents error Block response exceeds maximum node count 2000
		keys = keys.slice(0, 75);

		if (public_endpoint) {
			for (const i of keys) {
				// Some of our keys include spaces
				const encodedKey = encodeURIComponent(i);

				//  In case the public endpoint does not end with a slash
				const url = public_endpoint.endsWith("/")
					? public_endpoint + encodedKey
					: public_endpoint + "/" + encodedKey;

				sections.push({
					type: "columns",
					columns: [
						[
							{
								type: "image",
								block_id: `image_${i}`,
								url: url,
								alt: i,
							},
						],
						[
							{
								type: "actions",
								elements: [
									{
										type: "button",
										label: "Save to media library",
										action_id: `copy_${url}`,
										style: "primary",
									},
								],
							},
						],
					],
				});
				sections.push({
					type: "section",
					text: url,
				});
				sections.push({ type: "divider" });
			}
		} else {
			for (const i of keys) {
				sections.push({
					type: "section",
					text: i,
				});
			}
		}
	}
	return {
		blocks: [
			{
				type: "tab",
				panels: [
					{
						label: "Settings",
						blocks: [
							{ type: "header", text: "R2 Asset Access Settings" },
							{
								type: "form",
								block_id: "settings",
								fields: [
									{
										type: "text_input",
										action_id: "bucket_name",
										label: "Bucket Name",
										initial_value: bucket_name ?? "",
									},
									{
										type: "secret_input",
										action_id: "api_key",
										label: "API Key",
									},
									{
										type: "secret_input",
										action_id: "secret_access_key",
										label: "Secret Access Key",
									},
									{
										type: "text_input",
										action_id: "api_url",
										label: "API URL",
										initial_value: api_url ?? "",
									},
									{
										type: "text_input",
										action_id: "public_endpoint",
										label: "Public Endpoint",
										initial_value: public_endpoint ?? "",
									},
									{
										type: "text_input",
										action_id: "prefix",
										label: "Prefix (optional)",
										initial_value: prefix ?? "",
									},
								],
								submit: { label: "Save", action_id: "save" },
							},
							{
								type: "section",
								text: "Supported file extensions are avif, apng, png, jpg, jpeg, webp, pdf and gif.",
							},
						],
					},
					{
						label: "Images",
						blocks: [
							{ type: "header", text: "R2 Bucket Images" },
							{
								type: "section",
								text: "Example text",
							},
							{
								type: "form",
								block_id: "cloudflare",
								fields: [
									{
										type: "text_input",
										action_id: "prefix",
										label: "Prefix (optional)",
										initial_value: prefix ?? "",
									},
								],
								submit: {
									label: "Search by prefix",
									action_id: "fetch_r2",
								},
							},
							...sections,
						],
					},
				],
			},
		],
	};
}

/**
 * Sandboxed plugin entry. The default export is a bare object; the
 * `satisfies SandboxedPlugin` annotation gives TypeScript per-hook /
 * per-route inference (`ctx` is `PluginContext` automatically; hook
 * `event` parameters are typed by hook name).
 */
const plugin: SandboxedPlugin = {
	routes: {
		admin: {
			handler: async (routeCtx, ctx) => {
				const actionId =
					typeof routeCtx.input === "object" &&
					routeCtx.input !== null &&
					"action_id" in routeCtx.input &&
					typeof routeCtx.input.action_id === "string"
						? routeCtx.input.action_id
						: undefined;

				const page =
					typeof routeCtx.input === "object" &&
					routeCtx.input !== null &&
					"page" in routeCtx.input &&
					typeof routeCtx.input.page === "string"
						? routeCtx.input.page
						: "";

				const interaction = routeCtx.input as BlockInteraction;

				if (interaction.type === "form_submit" && actionId === "save") {
					await saveSettings(ctx, interaction.values ?? {});
					return {
						...(await renderPlugin(ctx)),
						toast: { type: "success", message: "Saved settings" },
					};
				} else if (actionId && actionId?.startsWith("copy_") && ctx.http) {
					const url = actionId.replace("copy_", "");
					const image = await ctx.http.fetch(url, {
						method: "GET",
					});
					if (ctx.media && ctx.media.upload && image.ok) {
						const existing = await ctx.media.list();
						const filename = url.split("/").pop() || "example.png";
						const filenameExists = existing.items.find(
							(item) => item.filename === filename,
						);

						// Prevent existing files from being uploaded
						if (!filenameExists) {
							console.log("uploading new media");
							await ctx.media.upload(
								filename,
								image.headers.get("content-type") ?? "application/octet-stream",
								await image.arrayBuffer(),
							);
						}

						const result = {
							...(await renderPlugin(ctx)),
							toast: { type: "success", message: "Saved to media library" },
						};
						return result;
					}
				} else if (
					interaction.type === "form_submit" &&
					actionId === "fetch_r2"
				) {
					await saveSettings(ctx, interaction.values ?? {});

					const result = {
						...(await renderPlugin(ctx)),
						toast: { type: "success", message: "Refreshed images" },
					};
					return result;
				}
				const result = await renderPlugin(ctx);
				return result;
			},
		},
		hello: {
			handler: async (_routeCtx, ctx) => {
				ctx.log.info("hello route called", { pluginId: ctx.plugin.id });
				return { greeting: "hello", pluginId: ctx.plugin.id };
			},
		},
	},
};

async function saveSettings(
	ctx: PluginContext,
	values: {
		bucket_name?: string;
		api_key?: string;
		secret_access_key?: string;
		api_url?: string;
		public_endpoint?: string;
		prefix?: string;
	},
) {
	if (values.bucket_name)
		await ctx.kv.set("settings:bucketName", values.bucket_name);
	if (values.api_key) await ctx.kv.set("settings:apiKey", values.api_key);
	if (values.secret_access_key)
		await ctx.kv.set("settings:secretAccessKey", values.secret_access_key);
	if (values.api_url) await ctx.kv.set("settings:apiUrl", values.api_url);
	if (values.public_endpoint)
		await ctx.kv.set("settings:publicEndpoint", values.public_endpoint);
	await ctx.kv.set("settings:prefix", values.prefix);
}

export default plugin;
