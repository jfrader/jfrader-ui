# Changelog

## Unreleased

### Added

- `CodeBlock`'s optional Shiki adapter highlights JSX and TSX with their own grammars.
- `Surface`: panel material with flat, raised and floating shadows, inherited or contrast appearance, and div-root replacement through `component` or `slots.root`. Card supports the same root replacement and native root `slotProps`.
- Drawer.Panel, BottomSheet.Panel and DialogStack.Content support div-root material replacement. Dialog.Panel adds the same customization while plain Dialog.Content children keep their default panel.
- `Deck`, `defineDeck` and `DeckProvider`: declare a card set — suits, ranks, per-card face art and a back — and register it by id. The built-in Spanish and French decks are two instances of the same API (`spanishDeck`, `frenchDeck`), and a partial set degrades to the printed face instead of an empty card.
- `Pattern`: decorative SVG tiles (`stripes`, `diagonal`, `checks`, `dots`, `waves`, `chevron`) with continuous tile edges, token inks, tile sizes and scaling, including custom flipped-card artwork. Forced colors hides the pattern and preserves the enclosing surface and border.
- `GameHand`: card fans with keyboard selection and an explicit play action, plus count-only hidden opponent hands.
- `CardFlightsProvider` deals and plays cards between measured board slots, with themed overlays, interruptible flights and immediate reduced-motion landing.
- `TrickStacks`: keep up to three played cards per player at the table center, inspect stacks with the keyboard, and spread revealed hands. Preserves the original card geometry around anchors derived from the circular GameTable, deliberately replacing the original seat presets; measured grid fitting is an explicit option. Includes RTL and reduced motion.
- `EditableDetails`: nested labelled details with independent app-owned editors, controlled disclosure, draft preservation on collapse, and keyboard focus recovery. Includes native form, React Action, React Hook Form, and overlay examples.
- `Scene` and `sceneSource` take `grade: 'warm'` for a warmer final grade of the same scene. Geometry is unchanged, and the default `raw` grade renders the same markup as before. ImageCompare examples now compare one scene in raw and warm grades.
- `GameTable.SeatChrome`: opt-in seat chrome subpart (`data-ui="game-table-seat-chrome"`) that positions names, avatars and badges out of flow above the seat cards, ensuring card block placement and curve geometry are measured independent of chrome.

### Improved

- ActivityRings uses neutral tick rings, a central completion figure, flat legend rows and daily previews. Interactive legends preview metrics on hover or focus; counts animate with the tick fill. The dial stops at 100% with no extra marks or arcs; the legend states the uncapped amount, percentage and surplus with localizable wording.
- Foundation guides use highlighted, copyable code examples and terminal commands with optional replay.
- `ToastStack` keeps a `contained` stack inside its host when consumer styles add padding to it.
- `ToastStack` casts a single shadow for a collapsed pile, so the cards behind it stay white instead of turning grey on light surfaces.
- `EditableDetails` uses aligned headings, quieter labels and separators only between rows. Nested sections no longer stack empty divider lines.
- Storybook groups `EditableDetails` form and picker examples under one Showcase entry.
- `PhotoGrid` opens photos in a full-screen viewer with icon controls, tooltips and a thumbnail strip. The header shows the photo count and current density, with one pressed toggle per density step. Ctrl+scroll and pinch resize thumbnails around the photo under the pointer. Upward drags no longer move the photo, and the chrome becomes opaque when reduced transparency is on.

### Changed

- ActivityRings aligns the goal summary with the legend's shared row inset, including narrow and RTL layouts.

- ActivityRings examples use accent, success and info tones, with a Neutral example alongside them. Completed goals retain their metric colour; unknown and unavailable values use neutral swatches. The neutral palette's third tone now meets 3:1 contrast against the tick track in both themes.

- GameCard no longer exports the internal rendering maps `RANK_MARKS`, `SUIT_GLYPHS` and `SUIT_INK`; card data types and `CARD_BACK_PATTERNS` remain public.
<<<<<<< HEAD
- GameTable intentionally replaces the reference's per-profile seat presets with a measured, centered curve: circular in near-square space and capped at a 1.5 axis ratio otherwise. Seats face the center; intrinsic seat/center content scales to fit without covering community cards. Rival GameCard backs now emit the player/index markers consumed by card flights. Component props and the surface measurement target are unchanged; exported seat configuration now describes derived radii, scale and gap instead of positional corrections.
- GameTable intentionally replaces the reference's per-profile seat presets with a measured, centered curve: circular in near-square space and capped at a 1.5 axis ratio otherwise. Seats face the center. Separate seat/center scales preserve a 32px GameCard width floor; requested clearance yields to zero before that floor can be crossed. `data-clearance` reports the concession and `data-layout-fit="insufficient-space"` declares compositions that still cannot fit without collisions or clipping. Rival GameCard backs now emit the player/index markers consumed by card flights. Component props and the surface measurement target are unchanged; exported seat configuration now describes derived radii, scales and gap instead of positional corrections.
- `PhotoGrid` `slotProps.filmstrip` now targets the viewer's thumbnail strip (a `div`) instead of a range input. `labels.larger` and `labels.smaller` are deprecated and no longer rendered; `labels.columns` names each density toggle, and the new `labels.photoCount` formats the album size.
=======
>>>>>>> d28b632 (fix(game-table): keep floating chrome readable within narrow roots)
- `GameCard` resolves its face and back from the card's deck: per-card art, then the deck's glyphs and marks, then the raw rank and suit. `face` takes `print` or `back` (`emoji` is a deprecated alias), the deck supplies the back unless `backPattern` overrides it, and an unknown deck id throws instead of rendering a blank card.
- GameCard backs use red-and-paper `Pattern` tiles: poker checks by default, or Spanish diagonals via `backPattern={CARD_BACK_PATTERNS.spanish}`. Custom artwork replaces either face.
- GameTable places seats on a measured bounded curve (circular in near-square space and bounded ellipse with axis ratio up to 1.5). All seat content remains upright for the spectator without rotation. `GameTable.SeatChrome` places names and avatars out of flow, without affecting card positions or scales; side chrome moves above/below cards when horizontal room runs out. Separate seat/center scales preserve a 32px GameCard width floor; requested clearance yields to zero before that floor can be crossed. `data-clearance` reports the concession and `data-layout-fit="insufficient-space"` declares card compositions that still cannot fit without collisions or clipping. Rival GameCard backs emit the player/index markers consumed by card flights. Component props and the surface measurement target are unchanged; exported seat configuration describes derived radii, scales and gap.

### Fixed

- `LightboxGallery` and `LinkUnfurl` images show without JavaScript and when they finish loading before hydration. They are hidden only while the client knows they are loading, marked `data-image-state="loading"`. `LinkUnfurl` images now carry `data-image-state` instead of `data-loaded`.
- GameCard's French and Spanish deck galleries wrap into multiple columns instead of a 32px strip. FlipGameCard faces inherit the frame width, keeping corner radii consistent across sizes.
- Card flights wait for their animations before revealing landed cards, hide staggered cards until departure, and cancel replaced flights without a residual frame. GameHand supplies flight markers for visible cards and hidden hands with a player key.
- ActivityRings no longer reports a goal crossing when a completed goal is restored after being unavailable.
- Dialogs with short content keep a 320px minimum width, reduced to fit narrow viewports with 16px side gutters. Set size limits on Dialog.Content; set `minInlineSize: 0` to opt out of the default minimum.
- Card with `appearance="default"` inside a contrast parent keeps that appearance in descendant portals.
- BottomSheet and Dialog panels can publish contrast appearance to descendant portals. DialogStack panels retain declaration-site themes and scoped tokens through the stage portal.
- Drawer panels keep square attached corners on replacement material; BottomSheet panels keep square lower corners.
- Face-down GameCards no longer show a pale strip or pale corners through their ink border.
