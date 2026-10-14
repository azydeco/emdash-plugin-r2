# Contributing

The pnpm workspace looks in `hosts/*` and `packages/*` for the local Emdash site and the R2 Asset Access plugin.

## Requirements

- Vscode
- pnpm

## Running locally

```sh
pnpm i
pnpm build
```

Before running any of the scripts in a terminal do `pnpm i` to install all of the dependencies in the workspace. With the dependencies installed run `pnpm build` to build each package.

```sh
pnpm dev
```

Running `pnpm dev` from the root runs the dev script in each package, building the Emdash plugin starting the local site, which can be accessed in a browser on <http://localhost:4321/>.

```sh
cd packages/plugin_emdash_r2_asset_access/
pnpm build
```

The plugin can be built without starting the local development server by changing directory in a terminal with `cd packages/plugin_emdash_r2_asset_access/` and running `pnpm build` from there, where it will be output to the packages/plugin_emdash_r2_asset_access/dist folder that is created.

## Formatting

The root of the workspace includes .prettierrc, and prettier-plugin-astro is included in the devDependencies.
