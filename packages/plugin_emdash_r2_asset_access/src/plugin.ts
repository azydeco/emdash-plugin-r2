import type { SandboxedPlugin } from "emdash/plugin";
import type { BlockResponse } from "@emdash-cms/blocks";

function renderSettings(): BlockResponse {
  return {
    blocks: [
      { type: "header", text: "Save Log settings" },
      {
        type: "form",
        block_id: "settings",
        fields: [
          { type: "text_input", action_id: "api_url", label: "API URL" },
          { type: "toggle", action_id: "enabled", label: "Enabled", initial_value: true },
        ],
        submit: { label: "Save", action_id: "save" },
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
		hello: {
			handler: async (_routeCtx, ctx) => {
				ctx.log.info("hello route called", { pluginId: ctx.plugin.id });
				return { greeting: "hello", pluginId: ctx.plugin.id };
			},
		},
	},
};

export default plugin;
