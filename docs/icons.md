# Icons

Install `@jfrader/icons` next to `@jfrader/ui`:

```sh
pnpm add @jfrader/ui @jfrader/icons
```

Follow [Getting started](https://github.com/jfrader/jfrader-ui/blob/master/docs/getting-started.md)
to load the token stylesheet and set up your app.

## Import an icon

Import by name from the package root:

```tsx
import { Search } from '@jfrader/icons';

export function SearchStatus() {
  return <Search size="sm" tone="muted" label="Search" />;
}
```

Or import from the per-icon subpath:

```tsx
import { Search } from '@jfrader/icons/search';
```

Browse every icon in [All icons](https://ui.jfrader.com/storybook/?path=/docs/icons-all-icons--docs).
Filled twins use the `Solid` suffix and share the base icon's subpath, such as `HeartSolid`
from `@jfrader/icons/heart`.

## Set size, color, and paint

Generated icons accept `SvgIcon` props. You can also import `SvgIcon` from `@jfrader/ui`
or `@jfrader/icons/svg-icon` to render your own SVG children.

| Prop | Use |
| --- | --- |
| `size` | Set `'sm'` (16px), `'md'` (24px, default), `'lg'` (32px), `'inherit'` (1em), or a positive, finite pixel number. |
| `tone` | Set `'inherit'` (default), `'accent'`, `'danger'`, `'warning'`, `'success'`, `'info'`, or `'muted'`. |
| `variant` | Use `'line'` (default) for rounded strokes or `'solid'` for a filled silhouette. Choose a generated `Solid` twin when you need its filled drawing. |
| `label` | Give a standalone image an accessible name. It sets `aria-label` and an SVG title. |
| `decorative` | Hide the icon from assistive technology, even if it has a `label`. An icon without a label is also hidden. |
| `sx` | Apply styles through the shared styling API. |

```tsx
import { Search } from '@jfrader/icons';
import { vars } from '@jfrader/tokens/vars';

export function SearchHint() {
  return <Search size={20} tone="accent" decorative sx={{ marginInlineEnd: vars.space[2] }} />;
}
```

Keep an icon decorative when adjacent text names the action. Give an icon-only button an
accessible name on the button, not on its decorative icon.

## Create your own icon

Call `createSvgIcon` at module scope with SVG children and a display name:

```tsx
import { createSvgIcon } from '@jfrader/icons';

export const Trail = createSvgIcon(
  <path d="m4 18 6-12 4 8 6-4" />,
  'Icons.Trail',
);
```

Pass a third argument to bake in `SvgIcon` props. Props passed when rendering override these defaults:

```tsx
import { createSvgIcon } from '@jfrader/icons';

export const Diamond = createSvgIcon(
  <path d="m12 3 9 9-9 9-9-9Z" />,
  'Icons.Diamond',
  { variant: 'solid', size: 'sm' },
);

export function SavedMarker() {
  return <Diamond size="lg" tone="success" label="Saved" />;
}
```

## Use another icon set

`@jfrader/icons` is the default set, not a requirement. Any icon component works in the same
slots. Pass it where you would pass one of these icons, and follow that component's sizing
and accessibility API.

For drawing grids, strokes, and new glyphs, see the
[icon style guide](https://github.com/jfrader/jfrader-ui/blob/master/docs/icon-style.md).
