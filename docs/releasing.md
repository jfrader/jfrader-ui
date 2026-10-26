# Releasing

`@jfrader/tokens`, `@jfrader/styling`, `@jfrader/icons`, and `@jfrader/ui` release together from
`.github/workflows/publish.yml`, in dependency order: tokens → styling → icons → ui.

## Versioning

All four packages carry the same version. While the major is `0`, a breaking change ships in a minor
release and is marked "Breaking pre-1.0" in the changelog. Fixes are patches.

## Publish a release

1. Set the same `version` in the manifests under `packages/tokens`, `packages/styling`,
   `packages/icons`, and `packages/ui`, and merge the change to `master`.
2. Tag that commit:

   ```sh
   git tag -a vX.Y.Z -m vX.Y.Z && git push origin vX.Y.Z
   ```

The workflow refuses the release unless the tag matches all four manifest versions, all package names
are correct, and the commit is on `master`. It then runs typecheck, tests, `verify:exports`, and
`verify:icons`, checks generated tokens and icons, builds all four packages in dependency order, and
packs each one once with `pnpm pack`, so `workspace:*` becomes the released version. It verifies or
publishes those exact four tarballs to npmjs, then to GitHub Packages, in the same dependency order.
Workspace dependencies remain separate packages, not bundled copies inside UI or icons.

A matching artifact that already exists at that version is accepted. A different artifact at the same
version fails the release.

To re-run a release without re-tagging:

```sh
gh workflow run publish.yml --repo jfrader/jfrader-ui --ref v0.18.0
```

## Authentication

npmjs authenticates through each package's trusted publisher for `jfrader/jfrader-ui` →
`.github/workflows/publish.yml`. Publish the first version of each package by hand, then add its
trusted publisher in the npmjs settings; npmjs requires the package to exist first. GitHub Packages
uses the workflow's scoped `GITHUB_TOKEN`.

GitHub creates a personal package as private on its first publication. After the first successful
run, make each package public once from **Package settings → Danger Zone → Change visibility**. Later
versions keep that setting.

## Pack a package locally

Build the packages first; root `pnpm build` builds Storybook, not the publishable artifacts.

```sh
pnpm --filter @jfrader/tokens build
pnpm --filter @jfrader/styling build
pnpm --filter @jfrader/icons build
pnpm --filter @jfrader/ui build
pnpm --filter @jfrader/ui exec npm pack --dry-run --json
```

Write a tarball somewhere disposable, then inspect it:

```sh
pnpm --filter @jfrader/tokens pack --pack-destination /tmp/opencode/jfrader-ui-release
```

Build in dependency order before packing. Each package's `prepack` builds and validates only its own
exports, and its `postpack` restores only its own source exports.

Each tarball includes its manifest and `dist/**`, plus npm's automatically included README and license
files when present. Tokens also ships `base.css` and generated `dist/tokens.css`. Styling ships its
six JavaScript entry points and declarations. Icons ships its root and `svg-icon` entry points,
generated icon modules and declarations, and `dist/icons.json` metadata. UI ships its component
entry points and declarations.

## Export switching

`exports` point at `src/` in the repo, so workspace apps compile source.

```sh
node scripts/flip-exports.mjs dist   # validate and switch all four packages to the publish layout
node scripts/flip-exports.mjs src    # switch all four back
```

The `dist` switch needs all four builds. A `prepack` hook switches only its own package with
`--package tokens`, `--package styling`, `--package icons`, or `--package ui`, and validates only that
package's export targets. The icons `./*` pattern stays a pattern, mapping to `dist/generated/*.js`
and `dist/types/generated/*.d.ts`; validation checks every generated source icon's built targets.
Its `./metadata` export switches from `icons.json` to `dist/icons.json`. If packing fails after
`prepack`, run `node scripts/flip-exports.mjs src`.
