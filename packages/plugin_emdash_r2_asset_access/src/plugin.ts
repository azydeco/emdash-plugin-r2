import type { SandboxedPlugin, PluginContext } from "emdash/plugin";
import type { BlockInteraction, BlockResponse } from "@emdash-cms/blocks";

async function loadSettings(ctx: PluginContext) {
  const [bucket_name, api_key, secret_access_key, api_url, enabled] =
    await Promise.all([
      ctx.kv.get<string>("settings:bucketName"),
      ctx.kv.get<string>("settings:apiKey"),
      ctx.kv.get<string>("settings:secretAccessKey"),
      ctx.kv.get<string>("settings:apiUrl"),
      ctx.kv.get<string>("settings:enabled"),
    ]);
  return { bucket_name, api_key, secret_access_key, api_url, enabled };
}

async function fetchR2(ctx: PluginContext) {
  if (!ctx.http) return;

  const { bucket_name, api_key, secret_access_key, api_url, enabled } =
    await loadSettings(ctx);

  if (!api_url) return;

  const response = await ctx.http.fetch(api_url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });
}

async function renderSettings(ctx: PluginContext): Promise<BlockResponse> {
  const { bucket_name, api_key, secret_access_key, api_url, enabled } =
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
            type: "toggle",
            action_id: "enabled",
            label: "Enabled",
            initial_value: true,
          },
        ],
        submit: { label: "Save", action_id: "save" },
      },
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

        if (
          interaction.type === "form_submit" &&
          interaction.action_id === "fetch_r2"
        ) {
          await fetchR2(ctx);
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
    enabled: boolean;
  },
) {
  if (values.bucket_name)
    await ctx.kv.set("settings:bucketName", values.bucket_name);
  if (values.api_key) await ctx.kv.set("settings:apiKey", values.api_key);
  if (values.secret_access_key)
    await ctx.kv.set("settings:secretAccessKey", values.secret_access_key);
  if (values.api_url) await ctx.kv.set("settings:apiUrl", values.api_url);
  await ctx.kv.set("settings:enabled", values.enabled);
}

export default plugin;
