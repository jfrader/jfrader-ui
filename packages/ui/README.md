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
pnpm generate
pnpm --filter @jfrader/ui build
```

Writes ES modules to `dist/` (`dist/index.js` plus one `dist/<name>.js` per component) and declarations to `dist/types/`. `react`, `react-dom` and every package in `dependencies` stay external.

## Publishing (not yet enabled)

The package is `private: true` and its `exports` point at `src/` so the workspace consumes source directly. To publish:

1. Remove `"private": true`.
2. Add `"files": ["dist"]`.
3. Point each `exports` entry at `dist`:

   ```json
   ".": { "types": "./dist/types/index.d.ts", "import": "./dist/index.js" },
   "./button": { "types": "./dist/types/components/button/index.d.ts", "import": "./dist/button.js" }
   ```

   Repeat for every component subpath, or move these into `publishConfig.exports` to keep source conditions in the workspace.
4. Publish `@jfrader/tokens` first; `pnpm publish` rewrites `workspace:*` to its version.
5. Run `pnpm generate`, `pnpm --filter @jfrader/ui build` and `pnpm verify:exports` before publishing.
