import type { SandboxedPlugin, PluginContext } from "emdash/plugin";
import type { BlockInteraction, BlockResponse } from "@emdash-cms/blocks";

async function loadSettings(ctx: PluginContext) {
  const [api_key, api_url, enabled] = await Promise.all([
    ctx.kv.get<string>("settings:apiKey"),
    ctx.kv.get<string>("settings:apiUrl"),
    ctx.kv.get<string>("settings:enabled"),
  ]);
  return { api_key, api_url, enabled };
}

async function renderSettings(ctx: PluginContext): Promise<BlockResponse> {
  const { api_key, api_url, enabled } = await loadSettings(ctx);

  return {
    blocks: [
      { type: "header", text: "Save Log settings" },
      {
        type: "form",
        block_id: "settings",
        fields: [
          {
            type: "text_input",
            action_id: "api_key",
            label: "API Key",
            initial_value: api_key ?? "",
          },
          {
            type: "text_input",
            action_id: "api_url",
            label: "API URL",
            initial_value: api_url ?? "",
          },
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
          return renderSettings(ctx);
        }

        if (
          interaction.type === "form_submit" &&
          interaction.action_id === "save"
        ) {
          await saveSettings(ctx, interaction.values ?? {});
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
  values: { api_key?: string; api_url?: string; enabled: boolean },
) {
  if (values.api_key) await ctx.kv.set("settings:apiKey", values.api_key);
  if (values.api_url) await ctx.kv.set("settings:apiUrl", values.api_url);
  await ctx.kv.set("settings:enabled", values.enabled);
}

export default plugin;
