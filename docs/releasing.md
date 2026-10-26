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
publishes those exact four tarballs to two registries: npmjs, then GitHub Packages, in the same
dependency order. The registries are attempted independently within the same job: an npmjs failure
still fails the release, but does not skip GitHub Packages. A failed package stops later packages
within that registry.
Workspace dependencies remain separate packages, not bundled copies inside UI or icons.

Open the workflow run's final **Report release visibility at both registries** step to see which
package versions are visible at each registry, which registry was skipped, or which visibility checks
could not be completed. This report runs even after a failure.

A matching artifact that already exists at that version is accepted. A different artifact at the same
version fails the release.

To re-run a release without re-tagging:

```sh
gh workflow run publish.yml --repo jfrader/jfrader-ui --ref v0.18.0
```

## Authentication

npmjs authenticates through each package's trusted publisher for `jfrader/jfrader-ui` →
`.github/workflows/publish.yml`. `@jfrader/tokens` and `@jfrader/ui` are already configured.

`@jfrader/styling` and `@jfrader/icons` are newer than that setup, so their **first** version has to
be published by hand: npmjs only lets you attach a trusted publisher to a package that already exists.
Until that is done, the workflow's publish step fails for those two names, and because `@jfrader/ui`
depends on both, a release cannot complete without them.

Bootstrap, once per new package, from a clean `master` at the release commit:

```sh
pnpm install && pnpm generate
pnpm --filter @jfrader/styling build && pnpm --filter @jfrader/icons build

cd packages/styling && npm publish --access=public --ignore-scripts
cd ../icons     && npm publish --access=public --ignore-scripts
```

Then, on npmjs, add the trusted publisher to both packages (repository `jfrader/jfrader-ui`, workflow
`publish.yml`). From that point the workflow owns them: re-running the release accepts an artifact that
already exists at the same version, so the hand-published tarballs and the workflow's tarballs are the
same release as long as the commit and the build are the same.

GitHub Packages needs no bootstrap; it uses the workflow's scoped `GITHUB_TOKEN`, and the first
publication of each package is private until it is switched to public in the package settings.

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
```

Write a tarball somewhere disposable, then inspect it:

```sh
pack_dir="$(mktemp -d /tmp/opencode/jfrader-ui-release.XXXXXX)"
pnpm --filter @jfrader/ui pack --pack-destination "$pack_dir"
tar -tzf "$pack_dir"/*.tgz
tar -xOzf "$pack_dir"/*.tgz package/package.json
rm -r "$pack_dir"
```

Build in dependency order before packing. Each package's `prepack` builds and validates only its own
exports, and its `postpack` restores only its own source exports.

Do not use `npm pack --dry-run`: it runs `prepack`, which flips the manifest exports to `dist`, but
does not run `postpack`, leaving a dirty tree. A real `pnpm pack` runs both hooks. If packing fails
after the flip, restore source exports with `node scripts/flip-exports.mjs src`.

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
