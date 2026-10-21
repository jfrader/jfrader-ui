# @jfrader/tokens

Shared design values for `@jfrader/ui`: colors, spacing, fonts, and the rest. The package ships CSS
custom properties and typed `var()` references, and works in any app that wants the values without the
components.

## Usage

Load the stylesheet once, then the optional base styles:

```ts
import '@jfrader/tokens/tokens.css';
import '@jfrader/tokens/base.css';
```

`tokens.css` defines the dark theme on `:root` and `[data-theme='dark']`, and the light theme on
`[data-theme='light']`. `base.css` adds box sizing and the body's margin, background, text color, and
font.

Typed references for TypeScript:

```ts
import { vars } from '@jfrader/tokens/vars';

const gap = vars.space[4]; // 'var(--ui-space-4)'
```

These are references, not resolved values: changing `data-theme` changes what the browser reads. The
raw token values are exported as `base` (dark) and `light` from `@jfrader/tokens`.

For app-wide or scoped overrides, see
[Theming](https://github.com/jfrader/jfrader-ui/blob/master/docs/theming.md). For tokens with `sx`,
`styled`, or plain CSS, see
[Styling](https://github.com/jfrader/jfrader-ui/blob/master/docs/styling.md).

## Build and release

```sh
pnpm --filter @jfrader/tokens build
```

The build generates `dist/tokens.css` and `src/generated/vars.ts` from `src/tokens.ts`. It bundles the
runtime entries as `dist/index.js` and `dist/generated/vars.js`, then writes declarations to
`dist/types/`. Vite keeps the generated CSS in `dist/`.

`@jfrader/tokens` and `@jfrader/ui` release together. See
[Releasing](https://github.com/jfrader/jfrader-ui/blob/master/docs/releasing.md) for the version
policy, packing, the publish workflow, and registry authentication.
