# @jfrader/tokens

Design tokens for `@jfrader/ui`: CSS custom properties and typed `var()` references.

## Usage

Load the stylesheet once, then the optional base styles:

```ts
import '@jfrader/tokens/tokens.css';
import '@jfrader/tokens/base.css';
```

`tokens.css` defines the dark theme on `:root` and `[data-theme='dark']`, and the light theme on `[data-theme='light']`.

Typed references for TypeScript:

```ts
import { vars } from '@jfrader/tokens/vars';

const gap = vars.space[4]; // 'var(--ui-space-4)'
```

The raw token values are exported as `base` (dark) and `light` from `@jfrader/tokens`.

## Build

```sh
pnpm --filter @jfrader/tokens build
```

The build generates `dist/tokens.css` and `src/generated/vars.ts` from `src/tokens.ts`. It bundles the runtime entries as `dist/index.js` and `dist/generated/vars.js`, then writes declarations to `dist/types/`. Vite keeps the generated CSS in `dist/`.

## Publishing

`@jfrader/tokens` and `@jfrader/ui` publish together from `.github/workflows/publish.yml` to npmjs and GitHub Packages.

1. Set the same `version` in `packages/tokens/package.json` and `packages/ui/package.json` and merge to `master`.
2. Push an annotated tag on that commit: `git tag -a vX.Y.Z -m vX.Y.Z && git push origin vX.Y.Z`.
3. CI checks the tag against both manifests, runs typecheck, tests and `verify:exports`, builds both packages, switches `exports` to `dist/` and packs each package once with `pnpm pack`.
4. CI verifies or publishes the same tarballs to npmjs, then to GitHub Packages, tokens before UI. A matching artifact already at that version is accepted; a different one fails the release.

To re-run a release without re-tagging:

```sh
gh workflow run publish.yml --repo jfrader/jfrader-ui --ref v0.1.1
```

npmjs authenticates through the package's trusted publisher for `jfrader/jfrader-ui` → `.github/workflows/publish.yml`, configured on npmjs after the first version is published by hand. GitHub Packages uses the workflow's `GITHUB_TOKEN`. See the [root README](https://github.com/jfrader/jfrader-ui#publishing) for the full release setup.

In the repo, `exports` point at `src/` so workspace apps use the source. `node scripts/flip-exports.mjs dist` validates and switches both packages to the publish layout. `node scripts/flip-exports.mjs src` switches both back. The tokens `prepack` builds tokens and switches only its manifest with `--package tokens`; `postpack` restores only tokens. Each switch validates only the selected package's export targets.

Tokens can be packed alone without UI's `dist/`. The hook builds every target required by tokens' exports. Run from the repo root:

```sh
pnpm --filter @jfrader/tokens build
pnpm --filter @jfrader/tokens exec npm pack --dry-run --json
pnpm --filter @jfrader/tokens pack --pack-destination /tmp/opencode
```

For both published packages, build with `pnpm --filter @jfrader/tokens build && pnpm --filter @jfrader/ui build`. Root `pnpm build` builds Storybook, not the published packages. If packing fails after `prepack`, run `node scripts/flip-exports.mjs src` from the repo root to restore workspace exports.

The tarball must contain only `dist/**`, `base.css`, `package.json`, `README.md` and `LICENSE`.

<a id="registry-choice--installing"></a>

### Registry choice

npmjs needs no authentication; GitHub Packages requires authentication even for public packages. To install from GitHub Packages, add this to `.npmrc`:

```ini
@jfrader:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

See the [root README's registry section](https://github.com/jfrader/jfrader-ui#registry-choice) for details.
