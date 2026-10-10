# @jfrader/ui

React components styled with Emotion and themed through the CSS custom properties from `@jfrader/tokens`.

## Components

| Subpath | Exports |
| --- | --- |
| `@jfrader/ui/accordion` | `Accordion` |
| `@jfrader/ui/alert` | `Alert` |
| `@jfrader/ui/avatar` | `Avatar` |
| `@jfrader/ui/badge` | `Badge` |
| `@jfrader/ui/breadcrumbs` | `Breadcrumbs` |
| `@jfrader/ui/button` | `Button` |
| `@jfrader/ui/calendar` | `Calendar` |
| `@jfrader/ui/card` | `Card` |
| `@jfrader/ui/checkbox` | `Checkbox` |
| `@jfrader/ui/combobox` | `Combobox` |
| `@jfrader/ui/command-palette` | `CommandPalette` |
| `@jfrader/ui/container` | `Container` |
| `@jfrader/ui/date-picker` | `DatePicker` |
| `@jfrader/ui/dialog` | `Dialog` |
| `@jfrader/ui/divider` | `Divider` |
| `@jfrader/ui/flex` | `Flex` |
| `@jfrader/ui/kbd` | `Kbd` |
| `@jfrader/ui/menu` | `Menu` |
| `@jfrader/ui/pagination` | `Pagination` |
| `@jfrader/ui/pill` | `Pill` |
| `@jfrader/ui/popover` | `Popover` |
| `@jfrader/ui/progress` | `Progress` |
| `@jfrader/ui/radio-group` | `RadioGroup` |
| `@jfrader/ui/select` | `Select` |
| `@jfrader/ui/skeleton` | `Skeleton` |
| `@jfrader/ui/spinner` | `Spinner` |
| `@jfrader/ui/stack` | `Stack` |
| `@jfrader/ui/switch` | `Switch` |
| `@jfrader/ui/tabs` | `Tabs` |
| `@jfrader/ui/text-field` | `TextField` |
| `@jfrader/ui/textarea` | `Textarea` |
| `@jfrader/ui/theme-root` | `ThemeRoot` |
| `@jfrader/ui/toast` | `Toast`, `useToast` |
| `@jfrader/ui/toggle-group` | `ToggleGroup` |
| `@jfrader/ui/tooltip` | `Tooltip` |

Each subpath also exports its prop types. The package root re-exports everything.

## Usage

```tsx
import { Button, Dialog, ThemeRoot } from '@jfrader/ui';
```

Or import per path:

```tsx
import { Button } from '@jfrader/ui/button';
import { Dialog } from '@jfrader/ui/dialog';
import { ThemeRoot } from '@jfrader/ui/theme-root';
```

`react` and `react-dom` (`>=18.2`) are peer dependencies.

## Theming

Components read CSS custom properties defined by `@jfrader/tokens`. Load the stylesheet once and wrap the app in `ThemeRoot`:

```tsx
import '@jfrader/tokens/tokens.css';
import { ThemeRoot } from '@jfrader/ui/theme-root';

<ThemeRoot theme="light">{app}</ThemeRoot>;
```

Token names and values live in `packages/tokens/src/tokens.ts`.

## Build

```sh
pnpm --filter @jfrader/tokens build && pnpm --filter @jfrader/ui build
```

Writes ES modules to `dist/` (`dist/index.js` plus one `dist/<name>.js` per component) and declarations to `dist/types/`. `react`, `react-dom` and every package in `dependencies` stay external.

## Publishing

`@jfrader/ui` and `@jfrader/tokens` publish together from `.github/workflows/publish.yml`.

1. Set the same `version` in `packages/ui/package.json` and `packages/tokens/package.json` and merge to `master`.
2. Tag the merge commit and push the tag: `git tag vX.Y.Z && git push origin vX.Y.Z`.
3. CI runs typecheck and tests, builds both packages, switches `exports` to `dist/` and runs `pnpm -r publish`. `workspace:*` becomes the published version.

In the repo, `exports` point at `src/` so the workspace consumes source. `node scripts/flip-exports.mjs dist` validates and switches both packages to the publish layout; `node scripts/flip-exports.mjs src` switches both back. The UI `prepack` builds UI and flips only its manifest with `--package ui`; `postpack` restores only UI. Each flip validates only the selected package's export targets.

Build tokens before packing UI: the published UI package depends on `@jfrader/tokens`, which stays external rather than being bundled. The UI hook does not build or validate tokens; prepare its published artifacts separately. Run from the repo root:

```sh
pnpm --filter @jfrader/tokens build && pnpm --filter @jfrader/ui build
pnpm --filter @jfrader/ui exec npm pack --dry-run --json
pnpm --filter @jfrader/ui pack --pack-destination /tmp/opencode
```

Root `pnpm build` builds Storybook, not the published packages. If packing fails after `prepack`, run `node scripts/flip-exports.mjs src` from the repo root to restore workspace exports.

It must contain only `dist/**`, `package.json`, `README.md` and `LICENSE`.
