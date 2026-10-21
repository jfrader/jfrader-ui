# @jfrader/ui

React components styled with Emotion and themed through the CSS custom properties from
`@jfrader/tokens`.

- [Getting started](https://github.com/jfrader/jfrader-ui/blob/master/docs/getting-started.md):
  installation and complete React / Vite and Next.js examples.
- [Theming](https://github.com/jfrader/jfrader-ui/blob/master/docs/theming.md): light and dark
  palettes, brand accents, token overrides.
- [Styling](https://github.com/jfrader/jfrader-ui/blob/master/docs/styling.md): instances, parts, and
  reusable wrappers.
- [Live documentation](https://ui.jfrader.com) and the
  [Storybook](https://ui.jfrader.com/storybook/).

Requires React 19 and the `@jfrader/tokens/tokens.css` stylesheet. The library is pre-1.0: the public
API can change between minor versions, and the
[changelog](https://github.com/jfrader/jfrader-ui/blob/master/CHANGELOG.md) marks every breaking
change.

## Install

```sh
pnpm add @jfrader/ui @jfrader/tokens
```

```tsx
import { Button, Dialog, ThemeRoot } from '@jfrader/ui';
```

`react` and `react-dom` (`^19.0.0`) are peer dependencies.

## Common subpaths

Every component also exports from its own subpath, with its prop types. This is the common set; the
complete inventory is
[`packages/ui/src/index.ts`](https://github.com/jfrader/jfrader-ui/blob/master/packages/ui/src/index.ts).

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
| `@jfrader/ui/copy-button` | `CopyButton` |
| `@jfrader/ui/date-picker` | `DatePicker` |
| `@jfrader/ui/dialog` | `Dialog` |
| `@jfrader/ui/divider` | `Divider` |
| `@jfrader/ui/editable-details` | `EditableDetails` |
| `@jfrader/ui/emblem` | `Emblem` |
| `@jfrader/ui/flex` | `Flex` |
| `@jfrader/ui/kbd` | `Kbd` |
| `@jfrader/ui/menu` | `Menu` |
| `@jfrader/ui/pagination` | `Pagination` |
| `@jfrader/ui/person-avatar` | `PersonAvatar` |
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
| `@jfrader/ui/time-picker` | `TimePicker` |
| `@jfrader/ui/toast` | `Toast`, `useToast` |
| `@jfrader/ui/toggle-group` | `ToggleGroup` |
| `@jfrader/ui/tooltip` | `Tooltip` |

Game components (`GameTable`, `GameCard`, `FlipGameCard`, and the rest of the `@jfrader/ui/game-*`
subpaths), the procedural scene (`@jfrader/ui/scene`), and optional integrations such as `@jfrader/ui/next` and
`@jfrader/ui/code-block/shiki` are subpath-only imports.

## Next.js App Router

Use the `EmotionRegistry` adapter from `@jfrader/ui/next`. The
[App Router layout](https://github.com/jfrader/jfrader-ui/blob/master/docs/getting-started.md#nextjs-app-router)
covers dependencies and the Server Component boundary.

## Theming

Set `data-theme` on `<html>` for the page, or use `ThemeRoot` for a subtree. `ThemeProvider` supplies
styling callbacks with token references; it does not choose light or dark.

## Person appearance data

```ts
import { resolveAppearanceId, resolvePersonAppearance } from '@jfrader/ui/person-avatar/appearance';

const appearance = resolvePersonAppearance(resolveAppearanceId('person-42', 'durable-visual-seed'));
```

The pure entry imports no React, Emotion, or DOM code. Version 3 preserves the original recipe and
palette ordering. A blank override falls back to the untrimmed seed. Signatures are not unique IDs.

## Build and release

```sh
pnpm --filter @jfrader/tokens build && pnpm --filter @jfrader/ui build
```

The build writes ES modules to `dist/` (`dist/index.js` plus one `dist/<name>.js` per component) and
declarations to `dist/types/`. It bundles neither React nor anything in `dependencies`.

Both published packages release together. See
[Releasing](https://github.com/jfrader/jfrader-ui/blob/master/docs/releasing.md) for the version
policy, packing, the publish workflow, and registry authentication.
