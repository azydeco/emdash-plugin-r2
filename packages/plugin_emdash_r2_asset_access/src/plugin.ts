import type { SandboxedPlugin, PluginContext } from "emdash/plugin";
import type { BlockInteraction, BlockResponse } from "@emdash-cms/blocks";

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
  "zip",
  "ZIP",
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
  creds: S3Credentials,
  prefix = "",
): Promise<string> {
  if (!ctx.http) return "HTTP client not available";
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, ""); // YYYYMMDDTHHMMSSZ
  const dateStamp = amzDate.slice(0, 8); // YYYYMMDD

  // 1. Build and sort query parameters
  const queryParams = new URLSearchParams({
    "list-type": "2",
  });
  if (prefix) queryParams.set("prefix", prefix);
  queryParams.sort();

  const canonicalQuery = queryParams.toString();
  const isR2Path = creds.endpointHost.includes("cloudflare");
  const canonicalUri = isR2Path ? "/" + creds.bucket : "/";

  // 2. Canonical Headers (sorted, lowercase)
  const emptyPayloadHash =
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
  const canonicalHeaders =
    "host:" +
    creds.endpointHost +
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
  const credentialScope = dateStamp + "/" + creds.region + "/s3/aws4_request";
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join("\n");

  // 5. Derive Signing Key
  const kDate = await hmacSha256(
    new TextEncoder().encode("AWS4" + creds.secretAccessKey),
    dateStamp,
  );
  const kRegion = await hmacSha256(kDate, creds.region);
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
    creds.accessKeyId +
    "/" +
    credentialScope +
    ", " +
    "SignedHeaders=" +
    signedHeaders +
    ", Signature=" +
    signatureHex;

  // 7. Dispatch HTTP Fetch
  const targetUrl =
    "https://" + creds.endpointHost + canonicalUri + "?" + canonicalQuery;
  const response = await ctx.http.fetch(targetUrl, {
    method: "GET",
    headers: {
      Host: creds.endpointHost,
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
}

async function loadSettings(ctx: PluginContext) {
  const [bucket_name, api_key, secret_access_key, api_url, public_endpoint] =
    await Promise.all([
      ctx.kv.get<string>("settings:bucketName"),
      ctx.kv.get<string>("settings:apiKey"),
      ctx.kv.get<string>("settings:secretAccessKey"),
      ctx.kv.get<string>("settings:apiUrl"),
      ctx.kv.get<string>("settings:publicEndpoint"),
    ]);
  return { bucket_name, api_key, secret_access_key, api_url, public_endpoint };
}

async function fetchR2(ctx: PluginContext) {
  if (!ctx.http) return { blocks: [] };

  const { bucket_name, api_key, secret_access_key, api_url, public_endpoint } =
    await loadSettings(ctx);

  if (!api_url || !api_key || !secret_access_key || !bucket_name)
    return { blocks: [{ type: "header", text: "Missing settings" }] };

  const config: S3Credentials = {
    accessKeyId: api_key,
    secretAccessKey: secret_access_key,
    region: "auto",
    bucket: bucket_name,
    endpointHost: new URL(api_url).host,
  };

  const xml = await listBucketObjectsDirect(ctx, config);
  let allKeys = [...xml.matchAll(/<Key>(.*?)<\/Key>/g)].map(
    (match) => match[1],
  );
  let keys = allKeys.filter((i) => {
    const name = i.toLowerCase();
    return supportedFileTypes.some((supported) =>
      name.endsWith(`.${supported}`),
    );
  });

  keys = keys.slice(0, 50);

  const sections = [];

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
              url: `${url}`,
              alt: i.toString(),
            },
            {
              type: "section",
              text: `${url.toString()}`,
            },
          ],
          [
            {
              type: "section",
              text: `${i.toString()}`,
            },
            {
              type: "form",
              fields: [],
              submit: { label: "Copy", action_id: `copy_${i.toString()}` },
            },
          ],
        ],
      });
    }
  } else {
    for (const i of keys) {
      sections.push({
        type: "section",
        text: i.toString(),
      });
    }
  }
  return {
    blocks: [{ type: "header", text: "R2 Bucket Images" }, ...sections],
  };
}

async function renderSettings(ctx: PluginContext): Promise<BlockResponse> {
  const { bucket_name, api_key, secret_access_key, api_url, public_endpoint } =
    await loadSettings(ctx);

  return {
    blocks: [
      { type: "header", text: "Save Log settings" },
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
            label: "Public Endpoint (optional)",
            initial_value: public_endpoint ?? "",
          },
        ],
        submit: { label: "Save", action_id: "save" },
      },
    ],
  };
}

async function renderAssets(ctx: PluginContext): Promise<BlockResponse> {
  return {
    blocks: [
      { type: "header", text: "R2 Bucket Images" },
      {
        type: "form",
        block_id: "cloudflare",
        fields: [],
        submit: {
          label: "Fetch",
          action_id: "fetch_r2",
        },
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
      handler: async (_routeCtx, ctx) => {
        if (_routeCtx.input.page === "/settings") {
          const interaction = _routeCtx.input as BlockInteraction;

          if (interaction.type === "page_load") {
            return renderSettings(ctx);
          }

          if (
            interaction.type === "form_submit" &&
            interaction.action_id === "save"
          ) {
            await saveSettings(ctx, interaction.values ?? {});
            return renderSettings(ctx);
          }
        } else if (_routeCtx.input.page === "/asset-listing") {
          const result = await fetchR2(ctx);
          return result;
        }
        return { blocks: [] };
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
}

export default plugin;
