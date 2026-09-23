import type { SandboxedPlugin, PluginContext } from "emdash/plugin";
import type { BlockInteraction, BlockResponse } from "@emdash-cms/blocks";

function renderSettings(): BlockResponse {
  return {
    blocks: [
      { type: "header", text: "Save Log settings" },
      {
        type: "form",
        block_id: "settings",
        fields: [
          { type: "text_input", action_id: "api_key", label: "API Key" },
          { type: "text_input", action_id: "api_url", label: "API URL" },
          {
            type: "toggle",
            action_id: "enabled",
            label: "Enabled",
            initial_value: true,
          },
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
    admin: {
      handler: async (_routeCtx, ctx) => {
        const interaction = _routeCtx.input as BlockInteraction;

        if (interaction.type === "page_load") {
          return renderSettings();
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
  values: { apiKey?: string; enabled: boolean; maxItems: number },
) {
  if (values.apiKey) await ctx.kv.set("settings:apiKey", values.apiKey);
  await ctx.kv.set("settings:enabled", values.enabled);
  await ctx.kv.set("settings:maxItems", values.maxItems);
}

export default plugin;
