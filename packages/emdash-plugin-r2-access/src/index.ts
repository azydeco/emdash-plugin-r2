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
		entrypoint: "@azydeco/emdash-plugin-r2-access",
		options,
	};
}

export function createPlugin(options: EmdashPluginR2Options = {}) {
	return definePlugin({
		id: "emdash-plugin-r2",
		version: "0.1.0",
		admin: {
 			settingsSchema: {
 			    projectName: {
      		        type: "string",
      		        label: "Project name",
      		        description: "Name shown in activity exports",
 			    },
 			    notes: {
 			        type: "string",
 			        label: "Internal notes",
 			        multiline: true,
 			    },
 			    mode: {
 			        type: "select",
 			        label: "Recording mode",
 			        options: [
 			            { value: "creates", label: "New entries only" },
 			            { value: "all", label: "New and updated entries" },
 			        ],
 			        default: "all",
 			    },
 			    retentionDays: {
 			        type: "number",
 			        label: "Retention in days",
 			        min: 1,
 			        max: 365,
 			        default: 30,
 			    },
 			    enabled: {
 			        type: "boolean",
 			        label: "Record activity",
 			        default: true,
 			    },
 			    exportToken: {
 			        type: "secret",
 			        label: "Export token",
 		 	    },
 		 	},
  		},

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
