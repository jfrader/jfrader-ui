# Releasing

`@jfrader/tokens` and `@jfrader/ui` release together, from `.github/workflows/publish.yml`.

## Versioning

Both packages carry the same version. While the major is `0`, a breaking change ships in a minor
release and is marked "Breaking pre-1.0" in the changelog. Fixes are patches.

## Publish a release

1. Set the same `version` in `packages/tokens/package.json` and `packages/ui/package.json`, and merge
   the change to `master`.
2. Tag that commit:

   ```sh
   git tag -a vX.Y.Z -m vX.Y.Z && git push origin vX.Y.Z
   ```

The workflow refuses the release unless the tag matches both manifests, both package names, and a
commit on `master`. It then runs typecheck, tests, and `verify:exports`, builds both packages, and
packs each one once with `pnpm pack`, so `workspace:*` becomes the released version. It verifies or
publishes those exact tarballs to npmjs, then to GitHub Packages, tokens before UI.

A matching artifact that already exists at that version is accepted. A different artifact at the same
version fails the release.

To re-run a release without re-tagging:

```sh
gh workflow run publish.yml --repo jfrader/jfrader-ui --ref v0.1.1
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
pnpm --filter @jfrader/tokens build && pnpm --filter @jfrader/ui build
pnpm --filter @jfrader/ui exec npm pack --dry-run --json
```

Write a tarball somewhere disposable, then inspect it:

```sh
pnpm --filter @jfrader/tokens pack --pack-destination /tmp/jfrader-ui-release
```

`@jfrader/ui` depends on the published `@jfrader/tokens` package and does not bundle it, so build
tokens before packing UI. Each package's `prepack` builds and validates only its own exports, and its
`postpack` restores only its own source exports.

The UI tarball contains `dist/**`, `package.json`, `README.md`, and `LICENSE`. The tokens tarball
contains those plus `base.css`.

## Export switching

`exports` point at `src/` in the repo, so workspace apps compile source.

```sh
node scripts/flip-exports.mjs dist   # validate and switch both packages to the publish layout
node scripts/flip-exports.mjs src    # switch both back
```

The `dist` switch needs both builds. A `prepack` hook switches only its own package with
`--package ui` or `--package tokens`, and validates only that package's export targets. If packing
fails after `prepack`, run `node scripts/flip-exports.mjs src`.
