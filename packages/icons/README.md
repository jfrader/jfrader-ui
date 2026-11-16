# Icons

`@jfrader/icons` is the icon set and the component every icon is drawn with. It sits below the
components package: `@jfrader/tokens` → `@jfrader/styling` → `@jfrader/icons` → `@jfrader/ui`.

```tsx
import { Check, Inbox, Search } from '@jfrader/icons';
import { Check as CheckFromItsOwnFile } from '@jfrader/icons/check';

<Check size={16} decorative />
```

Every icon accepts `SvgIcon`'s props: `size` (`'sm' | 'md' | 'lg' | 'inherit'` or pixels), `tone`,
`variant`, `label` or `decorative`, `sx`, and a replaceable root. `SvgIcon` and `createSvgIcon` are
exported from here, and also from `@jfrader/ui` and `@jfrader/ui/svg-icon` for existing consumers.

Your own drawing uses the same component, so it takes the same props:

```tsx
import { createSvgIcon } from '@jfrader/icons';

export const BrandMark = createSvgIcon(<path d="M4 12C4 6 12 4 12 12C12 20 20 18 20 12" />, 'BrandMark');
```

## Use without React

React components are the default. For plain HTML, Vue, webviews, or PDF pipelines, use
`@jfrader/icons/sprite.svg` or `@jfrader/icons/paths.json`. Copy the sprite to your public assets:

```html
<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
  <use href="/sprite.svg#search"></use>
</svg>
```

Line symbol IDs are the icon name; solid twins append `-solid`, such as `heart-solid`.
Symbols inherit `currentColor`. You can also inline the sprite once, hide its root SVG,
and reference `#search` in the same document.

The JSON catalogue has this shape (abbreviated):

```json
{
  "$comment": "Generated from src/icons and src/metadata. Do not edit. Run pnpm generate.",
  "viewBox": "0 0 24 24",
  "icons": [{
    "name": "search",
    "category": "action",
    "tags": ["find", "magnify"],
    "aliases": ["magnifying-glass"],
    "variants": ["line"],
    "geometry": {
      "line": {
        "attrs": { "fill": "none", "stroke": "currentColor", "stroke-width": "1.5", "stroke-linecap": "round", "stroke-linejoin": "round" },
        "elements": [
          { "tag": "circle", "attrs": { "cx": "10.5", "cy": "10.5", "r": "6.5" } },
          { "tag": "path", "attrs": { "d": "M15.1 15.1 20 20" } }
        ]
      }
    }
  }]
}
```

Apply the variant's `attrs` to your SVG and render each element with its own `attrs`.
Geometry preserves `path`, `circle`, and `rect` elements, including paint overrides and fill rules.
Each entry also includes `expressive` and `since` metadata.

## Adding an icon

1. Drop the line drawing in `src/icons/<name>.svg` and, if the icon can be selected or active, a
   separate solid drawing in `src/icons/solid/<name>.svg`. Never derive one by filling the other.
2. Add an entry to `src/metadata/<batch>.json` — one file per batch, and a name may appear in only
   one of them. Shape: `{ name, category, tags, aliases, expressive, since }`.
3. `pnpm generate` writes `src/generated/*.tsx`, `icons.json`, `sprite.svg`, and `paths.json`.
4. `pnpm verify:icons` fails on anything off-spec, stale, orphaned or duplicated.
5. Look at it in the gallery story at 16px before calling it done. A glyph that only reads at 32 is
   wrong.

The drawing rules — grid, stroke, radii, optical corrections, the solid companion, the twist slot —
are in [`docs/icon-style.md`](../../docs/icon-style.md). The lint enforces them; the document explains
them.

## What is generated

`src/icons/**/*.svg` is the only hand-edited artwork. `src/generated/`, `icons.json`, `sprite.svg`, and `paths.json` are build
output and are never edited by hand.

- `pnpm generate` — regenerate components, metadata, the sprite, and the catalogue.
- `pnpm verify:icons` — sources, geometry, metadata, generated output, exports, and the verifier's own
  failing fixtures.
