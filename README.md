# jfrader-ui

A from-scratch React component system styled with Emotion and themed through CSS custom properties, with Storybook 10 as the workbench.

Status: 30 components — reviewed, tested (265 browser tests + axe gate) and story-documented. M1 + M2 complete; see PLAN.md for the inventory.

## Packages

| Path | Package | Contents |
| --- | --- | --- |
| `packages/tokens` | `@jfrader/tokens` | Typed token source, generated `tokens.css` and typed `var()` references |
| `packages/ui` | `@jfrader/ui` | React components |
| `apps/storybook` | `@jfrader/storybook` | Storybook workbench and docs |

## Install

```sh
npm i @jfrader/ui @jfrader/tokens
```

### Registry choice

npmjs is the zero-configuration default. GitHub Packages carries the same
verified tarball, but GitHub requires authentication even for public npm
packages:

```ini
@jfrader:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

Registry selection applies to the whole `@jfrader` scope; npm does not fall
back from GitHub Packages to npmjs. Projects that map that scope to GitHub must
authenticate there or use an explicit npmjs tarball URL for a package that is
not mirrored.

To use the library in an app, see [docs/consuming-jfrader-ui.md](docs/consuming-jfrader-ui.md).

## Commands

<!-- packages/ui/LICENSE and packages/tokens/LICENSE mirror the root LICENSE: npm only packs a package-local LICENSE. -->

Run from the repo root.

| Command | What it does |
| --- | --- |
| `pnpm generate` | Generate `tokens.css` and `vars.ts` from the token source |
| `pnpm dev` | Generate tokens and start Storybook on port 6006 |
| `pnpm build` | Generate tokens and build static Storybook |
| `pnpm test` | Generate tokens and run Storybook tests in the browser |
| `pnpm typecheck` | Typecheck every package |

## Packing packages

Root `pnpm build` builds Storybook. Build the published packages separately:

```sh
pnpm --filter @jfrader/tokens build && pnpm --filter @jfrader/ui build
pnpm --filter @jfrader/tokens exec npm pack --dry-run --json
pnpm --filter @jfrader/ui exec npm pack --dry-run --json
```

Each package's `prepack` builds and validates only its own exports, and its `postpack` restores only its own source exports. Tokens can be packed without UI's `dist/`:

```sh
pnpm --filter @jfrader/tokens pack --pack-destination /tmp/opencode
```

UI keeps tokens as a published dependency, not bundled code. Build tokens before packing UI to prepare that dependency's artifacts; UI's hook does not build or validate tokens:

```sh
pnpm --filter @jfrader/tokens build
pnpm --filter @jfrader/ui pack --pack-destination /tmp/opencode
```

The default `node scripts/flip-exports.mjs dist` validates both packages and requires both builds. If packing fails after `prepack`, restore workspace exports with `node scripts/flip-exports.mjs src`.

## Publishing

`@jfrader/tokens` and `@jfrader/ui` release together from `.github/workflows/publish.yml`.

1. Set the same `version` in `packages/tokens/package.json` and `packages/ui/package.json` and merge to `master`.
2. Push an annotated tag on that commit: `git tag -a vX.Y.Z -m vX.Y.Z && git push origin vX.Y.Z`.
3. The workflow checks that both names and versions match the tag and that the commit is on `master`, runs typecheck, tests and `verify:exports`, builds both packages, and packs each one once with `pnpm pack` (`workspace:*` becomes the released version). It then verifies or publishes those exact tarballs to npmjs and GitHub Packages, tokens before UI.

Retries are safe: an existing matching artifact is accepted, while a different artifact at the same version fails the release. To re-run a release without re-tagging:

```sh
gh workflow run publish.yml --repo jfrader/jfrader-ui --ref v0.1.1
```

Each npmjs package uses a trusted publisher for `jfrader/jfrader-ui` → `.github/workflows/publish.yml`; no npm token is stored. A trusted publisher can only be added to a package that exists, so the first version of each package is published by hand, then the trusted publisher is configured in the package's npmjs settings. GitHub Packages uses the workflow's scoped `GITHUB_TOKEN`.

GitHub creates a personal package as private on its first publication. After the first workflow succeeds, make each package public once from its **Package settings → Danger Zone → Change visibility**. Later versions keep that setting.

## Browser support

Components rely on `:has()`, `:dir()`, `inert` and modal `<dialog>`, and Vite 8 builds to its `baseline-widely-available` target (Chrome 111, Firefox 114, Safari 16.4). Storybook 10 sets a higher floor for the workbench only.

- Components (`@jfrader/ui`): Chrome and Edge 120+, Firefox 121+, Safari 16.4+, iOS Safari 16.4+, Chrome for Android 120+.
- Storybook workbench: Chrome 131+, Edge 134+, Firefox 136+, Safari 18.3+. Mobile browsers: not verified.
- `Textarea` `autoResize` needs `field-sizing: content`; without it the field keeps its `rows` height. Dialog close requests fall back to a state close where `dialog.requestClose()` is missing.
- Automated: `pnpm typecheck` and `pnpm test` (story play tests and the axe gate, headless Chromium only). CI runs them on pushes to `master` and on pull requests; the publish workflow runs them again on `v*` tags.
- Manual: keyboard, screen reader, forced colors, reduced motion and RTL in [docs/qa-gates.md](docs/qa-gates.md).
