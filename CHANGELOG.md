# Changelog

## Unreleased

### Added

- `CodeBlock`'s optional Shiki adapter highlights JSX and TSX with their own grammars.
- `Surface`: panel material with flat, raised and floating shadows, inherited or contrast appearance, and div-root replacement through `component` or `slots.root`. Card supports the same root replacement and native root `slotProps`.
- Drawer.Panel, BottomSheet.Panel and DialogStack.Content support div-root material replacement. Dialog.Panel adds the same customization while plain Dialog.Content children keep their default panel.
- `Pattern`: decorative SVG tiles (`stripes`, `diagonal`, `checks`, `dots`, `waves`, `chevron`) with continuous tile edges, token inks, tile sizes and scaling, including custom flipped-card artwork. Forced colors hides the pattern and preserves the enclosing surface and border.
- `GameHand`: card fans with keyboard selection and an explicit play action, plus count-only hidden opponent hands.
- `CardFlightsProvider` deals and plays cards between measured board slots, with themed overlays, interruptible flights and immediate reduced-motion landing.
- `TrickStacks`: keep up to three played cards per player at the table center, inspect stacks with the keyboard, and spread revealed hands. Preserves the original card geometry around anchors derived from the circular GameTable, deliberately replacing the original seat presets; measured grid fitting is an explicit option. Includes RTL and reduced motion.
- `EditableDetails`: nested labelled details with independent app-owned editors, controlled disclosure, draft preservation on collapse, and keyboard focus recovery. Includes native form, React Action, React Hook Form, and overlay examples.

### Improved

- ActivityRings removes endpoint dots and the separate goal line. Surplus follows the tick band's inner edge with a round-capped arc, and the legend states the amount over goal with localizable wording.
- ActivityRings uses neutral tick rings, a central completion figure, flat legend rows and daily previews. Interactive legends preview metrics on hover or focus; amounts, percentages and inner surplus arcs animate together.
- Foundation guides use highlighted, copyable code examples and terminal commands with optional replay.
- `ToastStack` keeps a `contained` stack inside its host when consumer styles add padding to it.
- `ToastStack` casts a single shadow for a collapsed pile, so the cards behind it stay white instead of turning grey on light surfaces.
- `EditableDetails` uses aligned headings, quieter labels and separators only between rows. Nested sections no longer stack empty divider lines.
- Storybook groups `EditableDetails` form and picker examples under one Showcase entry.
- `PhotoGrid` opens photos in a full-screen viewer with icon controls, tooltips and a thumbnail strip. The header shows the photo count and current density, with one pressed toggle per density step. Ctrl+scroll and pinch resize thumbnails around the photo under the pointer. Upward drags no longer move the photo, and the chrome becomes opaque when reduced transparency is on.

### Changed

- GameCard no longer exports the internal rendering maps `RANK_MARKS`, `SUIT_GLYPHS` and `SUIT_INK`; card data types and `CARD_BACK_PATTERNS` remain public.
- GameTable intentionally replaces the reference's per-profile seat presets with a measured, centered curve: circular in near-square space and capped at a 1.5 axis ratio otherwise. Seats face the center; intrinsic seat/center content scales to fit without covering community cards. Rival GameCard backs now emit the player/index markers consumed by card flights. Component props and the surface measurement target are unchanged; exported seat configuration now describes derived radii, scale and gap instead of positional corrections.
- GameTable intentionally replaces the reference's per-profile seat presets with a measured, centered curve: circular in near-square space and capped at a 1.5 axis ratio otherwise. Seats face the center. Separate seat/center scales preserve a 32px GameCard width floor; requested clearance yields to zero before that floor can be crossed. `data-clearance` reports the concession and `data-layout-fit="insufficient-space"` declares compositions that still cannot fit without collisions or clipping. Rival GameCard backs now emit the player/index markers consumed by card flights. Component props and the surface measurement target are unchanged; exported seat configuration now describes derived radii, scales and gap instead of positional corrections.
- `PhotoGrid` `slotProps.filmstrip` now targets the viewer's thumbnail strip (a `div`) instead of a range input. `labels.larger` and `labels.smaller` are deprecated and no longer rendered; `labels.columns` names each density toggle, and the new `labels.photoCount` formats the album size.
- GameCard backs use red-and-paper `Pattern` tiles: poker checks by default, or Spanish diagonals via `backPattern={CARD_BACK_PATTERNS.spanish}`. Custom artwork replaces either face.

### Fixed

- GameCard's French and Spanish deck galleries wrap into multiple columns instead of a 32px strip. FlipGameCard faces inherit the frame width, keeping corner radii consistent across sizes.
- Card flights wait for their animations before revealing landed cards, hide staggered cards until departure, and cancel replaced flights without a residual frame. GameHand supplies flight markers for visible cards and hidden hands with a player key.
- ActivityRings no longer reports a goal crossing when a completed goal is restored after being unavailable.
- Dialogs with short content keep a 320px minimum width, reduced to fit narrow viewports with 16px side gutters. Set size limits on Dialog.Content; set `minInlineSize: 0` to opt out of the default minimum.
- Card with `appearance="default"` inside a contrast parent keeps that appearance in descendant portals.
- BottomSheet and Dialog panels can publish contrast appearance to descendant portals. DialogStack panels retain declaration-site themes and scoped tokens through the stage portal.
- Drawer panels keep square attached corners on replacement material; BottomSheet panels keep square lower corners.
- Face-down GameCards no longer show a pale strip or pale corners through their ink border.
