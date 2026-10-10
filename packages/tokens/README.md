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

Generates `dist/tokens.css` and `src/generated/vars.ts` from `src/tokens.ts`, bundles the runtime entries as `dist/index.js` and `dist/generated/vars.js`, then emits declarations to `dist/types/`. The Vite build preserves the generated CSS in `dist/`.

## Publishing

`@jfrader/tokens` and `@jfrader/ui` publish together from `.github/workflows/publish.yml`.

1. Set the same `version` in `packages/tokens/package.json` and `packages/ui/package.json` and merge to `master`.
2. Tag the merge commit and push the tag: `git tag vX.Y.Z && git push origin vX.Y.Z`.
3. CI runs typecheck and tests, builds both packages, switches `exports` to `dist/` and runs `pnpm -r publish`.

In the repo, `exports` point at `src/` so the workspace consumes source. `node scripts/flip-exports.mjs dist` validates and switches both packages to the publish layout; `node scripts/flip-exports.mjs src` switches both back. The tokens `prepack` builds tokens and flips only its manifest with `--package tokens`; `postpack` restores only tokens. Each flip validates only the selected package's export targets.

Tokens can be packed alone without UI's `dist/`. The hook builds every target required by tokens' exports. Run from the repo root:

```sh
pnpm --filter @jfrader/tokens build
pnpm --filter @jfrader/tokens exec npm pack --dry-run --json
pnpm --filter @jfrader/tokens pack --pack-destination /tmp/opencode
```

For both published packages, build with `pnpm --filter @jfrader/tokens build && pnpm --filter @jfrader/ui build`. Root `pnpm build` builds Storybook, not the published packages. If packing fails after `prepack`, run `node scripts/flip-exports.mjs src` from the repo root to restore workspace exports.

It must contain only `dist/**`, `base.css`, `package.json`, `README.md` and `LICENSE`.
