# emdash-plugin-r2

A pnpm workspace containing two packages:

- **[`hosts/web-cloudflare`](hosts/web-cloudflare/README.md)** — The test site that is run locally for testing the emdash plugin.
- **[`packages/plugin_emdash_r2_asset_access`](packages/plugin_emdash_r2_asset_access/README.md)** — @azydeco/emdash_plugin_r2_asset_access, the sandboxed emdash plugin.

## Requirements

- **pnpm** - <https://pnpm.io/installation>

## Setup

```sh
pnpm i
pnpm build
```

After cloning the repository first install all of the dependencies required by the packages then build the plugin and the test site.

## Testing locally

From the project root run the build script. This builds both the plugin and the site so that no errors occur when you start the dev server.

```sh
pnpm build
```

Run dev to start the website locally for testing (web-cloudflare) and the plugin (plugin_emdash_r2_asset_access).

```sh
pnpm dev
```

Once they have started in a browser go to <http://127.0.0.1:4321/_emdash/api/setup/dev-bypass?redirect=/_emdash/admin> to open the Emdash admin UI. On the admin sidebar find R2 Asset Access Settings and open it. Enter your keys and urls from Cloudflare then click on save. There will be a confirmation pop up.

Navigate to the R2 Asset Listing tab and the image contents of your Cloudflare R2 bucket will be listed. You can search again by inputting an optional prefix and then clicking on Search by prefix. This will make another fetch to the bucket. Each image is accompanied by its public URL and a Save to media library button. You can copy and paste the url into a page, or you can click on the Save button and the images will be added to your Emdash media library.

## Commands

| Command       | Does                                                                          |
| ------------- | ----------------------------------------------------------------------------- |
| `pnpm dev`    | Starts each workspace package's dev server.                                   |
| `pnpm build`  | Builds each workspace package that has a `build` script in it's package.json. |
| `pnpm test`   | Runs test scripts in each workspace package that has them.                    |
| `pnpm format` | Formats the workspace with oxfmt and prettier.                                |

## Licence

Azydeco chooses the MIT license for this project to ensure that developers can feel they have access to the source code within their native Emdash deploys without a concern that they are expected to deliver access to the origins of this source within their own deploys. The freedoms of the MIT license both commercially and in terms of Source access are considered to be the best option for this project.
