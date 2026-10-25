# Icon style

The one visual language for every icon the design system draws. Decided on 2026-10-25 from five
rendered candidates (GURI-3254, epic GURI-3253); the solid companion is part of the same decision.

Sources live as hand-written SVG under `packages/icons/src/icons/`. Every other artefact — React
components, metadata, the gallery — is generated from them and never edited by hand.

## The numbers

| Property | Value |
| --- | --- |
| Canvas | `viewBox="0 0 24 24"` |
| Geometry bounds | inside 2..22; target 3..21 for curved shapes |
| Stroke | `1.5`, `currentColor`, `fill="none"` |
| Caps and joins | `stroke-linecap="round"`, `stroke-linejoin="round"` |
| Corner radii | `2` small parts, `4` large bodies |
| Circle radii | from `{1.25, 2, 3, 4, 5.5, 6.5, 8.5}` |
| Angles | 0, 45, 90 plus smooth curves. No 30 or 60 degree runs |
| Coordinate precision | at most 2 decimals |
| Minimum feature | 1.5 units |
| Minimum gap | 2 units |
| Dots and solid marks | `r="1.25"`, `fill="currentColor"`, `stroke="none"` |

The stroke never changes per size. One glyph, one weight, at 16 through 32px. If a glyph only reads
at 32, the glyph is wrong, not the stroke.

## Allowed elements

`path`, `circle`, `rect`. Nothing else.

Forbidden: `<g>`, `transform`, `style`, `class`, `id`, `<title>`, `<defs>`, painted fills on outline
glyphs, hex or rgba colours, and any attribute that is not `d`, `cx`, `cy`, `r`, `x`, `y`, `width`,
`height`, `rx`, `fill`, `stroke`, `stroke-width`, `stroke-linecap`, `stroke-linejoin`, `fill-rule`.

## Optical rules

Geometry is centred by optical mass, not by bounding box.

- Symmetric glyphs are exactly symmetric about `x="12"`.
- A circle of diameter `d` looks larger than a square of side `d`: draw the circle at `d - 1`, or pull
  a filled disc in by 0.5 relative to its line twin.
- A triangle is optically centred about 1 unit right of its geometric centre when it points right.
- Keep 2 units of air between any element and the optical box edge.
- Judge weight against the whole set, not against the glyph alone: a dense glyph (gear, chart) must
  not look heavier than a sparse one (play, arrow).

## The solid companion

Every icon that can be selected or active carries a solid twin. Same canvas, same silhouette
footprint, so line and solid versions align at 1:1 and can swap in place.

- `fill="currentColor"`, `stroke="none"`, no stroke attributes at all on the root.
- Corner radius `2` on most bodies; keep counter-forms (a gear's hub, a lock's keyhole) transparent
  with `fill-rule="evenodd"` on a single path where possible.
- At least 2 units of negative space between two detached filled parts, or 16px turns them into a
  smear.
- Dense filled shapes pull in 0.5 units relative to their line twin.
- Never add a second colour, gradient, or shadow. "Solid" is mass, not decoration.

Whether a given icon has a twin is recorded in metadata (`variants`), not in the file name.

## Signature twists

Reserved for Fran's ideas, and deliberately constrained so the set stays usable in dense UI.

- At most one signature element per icon: no more than 3 path commands, drawn with the base stroke.
- Allowed only on icons marked `expressive: true` in metadata: gaming, money, empty states, and
  feature artwork.
- Never on form controls, toolbars, tables, menus, tabs, or status icons.
- The glyph must read identically with the signature removed. The twist is a flourish on top of a
  complete glyph, never the thing that tells you what the icon is.

## Naming

- `kebab-case`, one concept per file: `arrow-right`, `wallet`, `chart-bar`.
- Nothing about the UI: `trash`, not `delete-button`.
- No variant suffixes in file names. Variants live in metadata.
- No platform or third-party names. `bitcoin` and `satoshi` are ours to draw, not to copy.
- Aliases (`send-money` → `send`) live in metadata only.

## Metadata

`packages/icons/icons.json` is generated from the sources and carries, per icon:

| Field | Meaning |
| --- | --- |
| `name` | file name without extension |
| `category` | one of the categories below |
| `tags` | search terms, including synonyms a consumer would type |
| `aliases` | alternative names kept for compatibility |
| `variants` | subset of `line`, `solid` |
| `expressive` | whether a signature twist is allowed |
| `since` | package version the icon first shipped in |

Categories: `navigation`, `action`, `editing`, `media`, `file`, `communication`, `money`, `status`,
`device`, `weather`, `gaming`, `people`, `security`, `development`, `arrow`.

## Sizes

The component takes `size` (number, default `24`) and renders `width`/`height`; the viewBox does the
scaling. Sizes in use are 16, 20, 24, 32. Nothing in the glyph changes between them.

## Accessibility and API

- `aria-hidden="true"` by default: an icon is decoration unless it is the only content of a control.
- `title` renders `<title>` and switches to `role="img"` with an accessible name.
- Colour inherits through `currentColor`. There is no `color` prop.
- `ref` forwards to the `<svg>`.
- Zero runtime dependencies. No `@jfrader/ui` import, no Lucide.

## Verification

`pnpm verify:icons` fails the build when any of these is false:

- root element is `<svg>` with exactly `xmlns`, `viewBox="0 0 24 24"`, and the style attributes;
- no forbidden element, attribute, or colour;
- every coordinate has at most 2 decimals;
- computed geometry stays inside 2..22;
- solid files carry no stroke attributes and outline files carry the full stroke set;
- file name is kebab-case and equals the metadata `name`;
- every source has a metadata entry and a generated component, and no entry is orphaned;
- no two files share identical path data;
- every generated component is present in the package index and its subpath export resolves.

## Drawing a new icon

1. Pick the concept and write the name in the category's terms.
2. Sketch on the 24 grid with the numbers above; place geometry on integers or halves first.
3. Draw the outline twin. Check it at 16px before anything else.
4. If the icon can be selected, draw the solid twin on the same silhouette.
5. Pass the geometry lint, then look at it in a row with its neighbours and fix the weight mismatch.
6. Add metadata (category, tags, variants, expressive) and regenerate.

## Worked examples

The eight glyphs that settled the language. They are the reference for weight, radii, and detail
budget; copy their structure, never their path data into an unrelated icon.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.1 15.1 20 20"/>
</svg>
```

`search` — ring at `r 6.5`, handle at exactly 45 degrees, meeting the ring at its rounded edge.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <path d="M8.5 4.5 18.5 12 8.5 19.5Z"/>
</svg>
```

`play` — the triangle is wider than tall because a narrow one reads as a caret at 16px.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <path d="M8 10V7A4 4 0 0 1 16 7V10"/><rect x="4" y="10" width="16" height="11" rx="4"/>
  <circle cx="12" cy="15.5" r="1.25" fill="currentColor" stroke="none"/>
</svg>
```

`lock` — shackle `r 4` meeting a body of `rx 4`; the keyhole is the only filled mark.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <path d="M21 8A4 4 0 0 0 17 4H7A4 4 0 0 0 3 8V16A4 4 0 0 0 7 20H17A4 4 0 0 0 21 16M21 8H15A2 2 0 0 0 13 10V14A2 2 0 0 0 15 16H21Z"/>
  <circle cx="17" cy="12" r="1.25" fill="currentColor" stroke="none"/>
</svg>
```

`wallet` — body `rx 4`, clasp `rx 2`, clasp dot on the seam. The clasp closes the body outline
instead of doubling a stroke over it.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <path d="M20.5 3.5 15 20.5 11 13 3.5 9Z M11 13 20.5 3.5"/>
</svg>
```

`send` — one closed silhouette plus the fold. The outer runs bend off the 45 degree rule on purpose;
preserving the plane's read beats preserving the angle grid.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <path d="M3 12 12 3 21 12M5 10V20H10V14H14V20H19V10"/>
</svg>
```

`home` — roof and doorway in one continuous path; the rounded join supplies the corner radius so the
doorway can stay open.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <path d="M6 20V4M12 20V10M18 20V14"/>
</svg>
```

`chart` — bars are single round-capped strokes, not outlined rectangles; an outlined bar closes into
a line at 16px.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <path d="M9.61 5.42C10.04 4.85 9.42 3.57 10.13 3.2C10.84 2.83 13.16 2.83 13.87 3.2C14.58 3.57 13.96 4.85 14.39 5.42C14.83 6 15.78 6.55 16.5 6.64C17.22 6.73 18.01 5.55 18.69 5.98C19.36 6.41 20.53 8.42 20.56 9.22C20.59 10.02 19.17 10.12 18.89 10.78C18.62 11.45 18.62 12.55 18.89 13.22C19.17 13.88 20.59 13.98 20.56 14.78C20.53 15.58 19.36 17.59 18.69 18.02C18.01 18.45 17.22 17.27 16.5 17.36C15.78 17.45 14.83 18 14.39 18.58C13.96 19.15 14.58 20.43 13.87 20.8C13.16 21.17 10.84 21.17 10.13 20.8C9.42 20.43 10.04 19.15 9.61 18.58C9.17 18 8.22 17.45 7.5 17.36C6.78 17.27 5.99 18.45 5.31 18.02C4.64 17.59 3.47 15.58 3.44 14.78C3.41 13.98 4.83 13.88 5.11 13.22C5.38 12.55 5.38 11.45 5.11 10.78C4.83 10.12 3.41 10.02 3.44 9.22C3.47 8.42 4.64 6.41 5.31 5.98C5.99 5.55 6.78 6.73 7.5 6.64C8.22 6.55 9.17 6 9.61 5.42Z"/>
  <circle cx="12" cy="12" r="3"/>
</svg>
```

`settings` — six curved teeth on a hub of `r 3`. The teeth are cubic shoulders rather than straight
runs: straight teeth read as a flower or a cross at 16px.

## Bitcoin and Satoshi

Drawn under the same grid and stroke (GURI-3256). The Bitcoin mark is our own geometry of a universal
concept, never copied path data. The Satoshi mark is designed, not referenced: it must read as a
subunit of Bitcoin and never as a second B, and both must stay distinguishable from each other at
16px. Their rationale lands in this file when they are drawn.
