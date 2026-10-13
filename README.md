# emdash-plugin-r2

A pnpm workspace containing two packages:

- `hosts/web-cloudflare`
- `packages/plugin_emdash_r2_asset_access`

## Requirements

- pnpm
- Cloudflare R2 bucket
- API Key
- Secret Access Key
- API URL
- Public Endpoint

## Testing locally

After cloning the repository run `pnpm i` to install all of the dependencies required by the packages.

From the project root run `pnpm build`. This builds both the plugin and the site so that no errors occur when you start them.

Run `pnpm dev` to start the website locally for testing (web-cloudflare) and the plugin (plugin_emdash_r2_asset_access).

Once they have started in a browser go to <http://127.0.0.1:4321/_emdash/api/setup/dev-bypass?redirect=/_emdash/admin> to open the Emdash admin UI. On the admin sidebar find R2 Asset Access Settings and open it. Enter your keys and urls from Cloudflare then click on save. There will be a confirmation pop up.

Navigate to the R2 Asset Listing tab and the image contents of your Cloudflare R2 bucket will be listed. You can search again by inputting an optional prefix and then clicking on Search by prefix. This will make another fetch to the bucket. Each image is accompanied by its public URL and a Save to media library button. You can copy and paste the url into a page, or you can click on the Save button and the images will be added to your Emdash media library.

## Licence

Azydeco chooses the MIT license for this project to ensure that developers can feel they have access to the source code within their native Emdash deploys without a concern that they are expected to deliver access to the origins of this source within their own deploys. The freedoms of the MIT license both commercially and in terms of Source access are considered to be the best option for this project.
