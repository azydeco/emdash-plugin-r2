import { definePlugin } from "emdash";
import type { PluginDescriptor } from "emdash";

export interface EmdashPluginR2Options {
	enabled?: boolean;
}

export function emdashPluginR2Plugin(options: EmdashPluginR2Options = {}): PluginDescriptor<EmdashPluginR2Options> {
	return {
		id: "emdash-plugin-r2",
		version: "0.1.0",
		format: "native",
		entrypoint: "emdash-plugin-r2",
		options,
	};
}

export function createPlugin(options: EmdashPluginR2Options = {}) {
	return definePlugin({
		id: "emdash-plugin-r2",
		version: "0.1.0",

		capabilities: ["content:read"],
		storage: {
			events: { indexes: ["createdAt"] },
		},

		hooks: {
			"content:afterSave": async (event, ctx) => {
				if (options.enabled === false) return;
				await ctx.storage.events.put(`evt_${Date.now()}`, {
					collection: event.collection,
					contentId: event.content.id,
					createdAt: new Date().toISOString(),
				});
			},
		},

		routes: {
			recent: {
				handler: async (ctx) => {
					const result = await ctx.storage.events.query({
						orderBy: { createdAt: "desc" },
						limit: 10,
					});
					return { events: result.items };
				},
			},
		},
	});
}

export default createPlugin;
