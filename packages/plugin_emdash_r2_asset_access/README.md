# @azydeco/emdash_plugin_r2_asset_access

A sandboxed plugin for [EmDash](https://emdashcms.com) that allows images to be saved into the media library from an R2 bucket. Keys can optionally be searched by prefix.

## Requirements

- **R2 bucket**
- **Access Key**
- **Secret Access Key**
- **API URL**
- **Public Endpoint**
- **Prefix (optional)**

## Listing assets

On the admin sidebar find the R2 Asset Listing tab and open it. From there click on Settings, enter your keys and urls from Cloudflare then click on save. There will be a confirmation pop up when your settings are saved.

Navigate to the Images tab and the image assets of your Cloudflare R2 bucket will be listed. You can search again by inputting an optional prefix and then clicking on Search by prefix. This will make another fetch to the bucket. Each image is accompanied by its public URL and a Save to media library button. You can copy and paste the url into a page, or you can click on the Save button and the images will be added to your Emdash media library.

## Licence

Azydeco chooses the MIT license for this project to ensure that developers can feel they have access to the source code within their native Emdash deploys without a concern that they are expected to deliver access to the origins of this source within their own deploys. The freedoms of the MIT license both commercially and in terms of Source access are considered to be the best option for this project.
