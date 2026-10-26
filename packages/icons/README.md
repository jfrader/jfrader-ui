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

## Adding an icon

1. Drop the line drawing in `src/icons/<name>.svg` and, if the icon can be selected or active, a
   separate solid drawing in `src/icons/solid/<name>.svg`. Never derive one by filling the other.
2. Add an entry to `src/metadata/<batch>.json` — one file per batch, and a name may appear in only
   one of them. Shape: `{ name, category, tags, aliases, expressive, since }`.
3. `pnpm generate` writes `src/generated/*.tsx` and `icons.json`.
4. `pnpm verify:icons` fails on anything off-spec, stale, orphaned or duplicated.
5. Look at it in the gallery story at 16px before calling it done. A glyph that only reads at 32 is
   wrong.

The drawing rules — grid, stroke, radii, optical corrections, the solid companion, the twist slot —
are in [`docs/icon-style.md`](../../docs/icon-style.md). The lint enforces them; the document explains
them.

## What is generated

`src/icons/**/*.svg` is the only hand-edited artwork. `src/generated/` and `icons.json` are build
output and are never edited by hand.

- `pnpm generate` — regenerate components and metadata.
- `pnpm verify:icons` — sources, geometry, metadata, generated output, exports, and the verifier's own
  failing fixtures.
