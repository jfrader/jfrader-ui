# Changelog

## Unreleased

### Added

- `ChatMessage`: show a single message with author, avatar, body, timestamp, delivery status, attachments and reactions without adopting a conversation layout. `ChatThread` keeps its existing API.
- `CodeBlock`'s optional Shiki adapter highlights JSX and TSX with their own grammars.
- `Surface`: panel material with flat, raised and floating shadows, inherited or contrast appearance, and div-root replacement through `component` or `slots.root`. Card supports the same root replacement and native root `slotProps`.
- Drawer.Panel, BottomSheet.Panel and DialogStack.Content support div-root material replacement. Dialog.Panel adds the same customization while plain Dialog.Content children keep their default panel.
- `Deck`, `defineDeck` and `DeckProvider`: declare a card set — suits, ranks, per-card face art and a back — and register it by id. The built-in Spanish and French decks are two instances of the same API (`spanishDeck`, `frenchDeck`), and a partial set degrades to the printed face instead of an empty card.
- `Pattern`: decorative SVG tiles (`stripes`, `diagonal`, `checks`, `dots`, `waves`, `chevron`) with continuous tile edges, token inks, tile sizes and scaling, including custom flipped-card artwork. Forced colors hides the pattern and preserves the enclosing surface and border.
- `GameHand`: card fans with keyboard selection and an explicit play action, plus count-only hidden opponent hands.
- `CardFlightsProvider` deals and plays cards between measured board slots, with themed overlays, interruptible flights and immediate reduced-motion landing.
- `GameCardStack`: keep played cards grouped per player, inspect a pile with the keyboard and spread revealed hands. `GameCardStack.Pile` renders one player's pile where you place it — including inside a GameTable play region — while the root keeps a measured grid for standalone use. Supports any card limit, RTL and reduced motion. Replaces `TrickStacks`, which is gone.
- `GameTable` renders one measured play region per place through `renderPlay(slot, index, geometry)`: the inward ring where a player's played cards belong, sharing the seat's direction and never overlapping seats, neighbours or the centre.
- `GameTable` takes any seat count from 2 up and a `teamCount` for round-robin teams (default 2, `1` for free-for-all), with per-team capacity validation and seat teams named in the error. `GameTable`'s `center` is the measured community region — Hold'em board, pot or deck — and the poker example composes six seats, a five-card board and a dealt board through the existing flight API.
- `FlipGameCard` renders both faces itself from a card and a deck: pass `value`, `label` and `backLabel` instead of building two `GameCard`s, and it resolves one deck and one size for front and back (`front` / `back` stay as the arbitrary-content escape hatch). A card that is face down is named by `backLabel`, never by the front's label.
- `DeckProvider` takes `backLabel`, so a hidden card's name is declared once, in the consumer's language, instead of repeated per card.
- `GameCard` and `FlipGameCard` accept `component`, `slots.root` and `slotProps.root` for root replacement, and preserve their `data-ui` identity tokens when composed.
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
- `PhotoGrid` `slotProps.filmstrip` now targets the viewer's thumbnail strip (a `div`) instead of a range input. `labels.larger` and `labels.smaller` are deprecated and no longer rendered; `labels.columns` names each density toggle, and the new `labels.photoCount` formats the album size.
- `GameTable` places seat content on the felt boundary by default: `seatPlacement` chooses `inside` (contained, the previous behaviour), `edge` (content centred on the boundary) or `outside` (all of it beyond the boundary). The shell reserves the outboard footprint, so the felt yields space instead of clipping the content, and the ring follows the surface's own ellipse. This deliberately replaces the containment-only default; the deviation from the reference is documented in the component.
- **Breaking for `@jfrader/ui@0.8.x`:** a played card is one labeled record — `{ id, label, value?, order? }` — instead of a card key plus `roundIdx`, and a pile carries its own `label` and `revealed`. The parallel `labels.piles` / `labels.cards` maps, `revealedKeys` and `playOrder` props are gone, and the flight destination is that explicit play id instead of a generated key (ids with hyphens can no longer collide). Card flights share the same records, so a composition declares each card once.
- `TrickStacks` became `GameCardStack`, and the played-card vocabulary replaces the truco one throughout: the `piles` prop, `PlayedCard`, `getPlayedCardKey`, `PLAYED_PILE`, `PileLayout` and the `playedPile` / `easePlayedPile*` motion tokens (same values). **Breaking for `@jfrader/ui@0.8.x`:** the `./trick-stacks` subpath is gone (import `@jfrader/ui/game-card-stack`), a card's destination is `data-played-key` instead of `data-trick-key`, and the reference's per-profile pile presets and their parity fixtures are gone: `GameTable` owns placement, the pile keeps only the card mathematics (closed offsets, open spread, inspection scale, deterministic jitter and rotation, play-order layering).
- `GameCard` resolves its face and back from the card's deck: per-card art, then the deck's glyphs and marks, then the raw rank and suit. `face` takes `print` or `back` (`emoji` is a deprecated alias), the deck supplies the back unless `backPattern` overrides it, and an unknown deck id throws instead of rendering a blank card.
- `GameTable` reports `insufficient-space` only when it really does not fit: the fit compared radial projections of each box, which failed on diagonal angles. It now uses the exact box separation, so compositions like truco on `phoneTall` with six seats fit instead of declaring a false concession.
- **Breaking for `@jfrader/ui@0.8.x`:** `GameHand` selects by card identity — `value` / `defaultValue` / `onValueChange` take a card id and replace `selectedIndex` / `defaultSelectedIndex` / `onSelect`, and `onPlayIntent` receives the card instead of its index. Controlled selection no longer jumps to another card when the card array is reordered. `GameCardStack` and `GameCardStack.Pile` rename `onInspect` to `onValueChange`.
- GameCard backs use red-and-paper `Pattern` tiles: poker checks by default, or Spanish diagonals via `backPattern={CARD_BACK_PATTERNS.spanish}`. Custom artwork replaces either face.
- GameTable places seats on a measured bounded curve (circular in near-square space and bounded ellipse with axis ratio up to 1.5) when `seatPlacement="inside"`. All seat content remains upright for the spectator without rotation. `GameTable.SeatChrome` places names and avatars out of flow, without affecting card positions or scales; side chrome moves above/below cards when horizontal room runs out. Separate seat/center scales preserve a 32px GameCard width floor; requested clearance yields to zero before that floor can be crossed. `data-clearance` reports the concession and `data-layout-fit="insufficient-space"` declares card compositions that still cannot fit without collisions or clipping. Rival GameCard backs emit the player/index markers consumed by card flights. Component props and the surface measurement target are unchanged; exported seat configuration describes derived radii, scales and gap.

### Fixed

- `LightboxGallery` and `LinkUnfurl` images show without JavaScript and when they finish loading before hydration. They are hidden only while the client knows they are loading, marked `data-image-state="loading"`. `LinkUnfurl` images now carry `data-image-state` instead of `data-loaded`.
- The docs front no longer shows a fabricated "Usage" snippet for entries whose subject is not a component with that page's name: `Games/Deck` used to read `import { Deck } from '@jfrader/ui'; <Deck>{null}</Deck>`. Deck, CardFlights, Theme, Custom accent, DialogStack and Next author their real examples instead, with their own imports.
- Card-flight destinations are explicit ids: a play whose id no longer matched a rendered pile used to skip its flight in silence, and two plays could collide when their player or card keys contained hyphens. The regression story fails when the destination link is broken or the old concatenation is restored.
- The Spanish `FlipGameCard` example keeps a Spanish back: the inherited back used to come from the default deck while the front was Spanish. Missing back names now raise `MissingBackLabelError` instead of silently leaving the card unnamed.
- The deck and pattern examples no longer claim that custom artwork needs a `value`, and the deck example includes the required `label`.
- GameCard's French and Spanish deck galleries wrap into multiple columns instead of a 32px strip. FlipGameCard faces inherit the frame width, keeping corner radii consistent across sizes.
- Card flights wait for their animations before revealing landed cards, hide staggered cards until departure, and cancel replaced flights without a residual frame. GameHand supplies flight markers for visible cards and hidden hands with a player key.
- ActivityRings no longer reports a goal crossing when a completed goal is restored after being unavailable.
- Dialogs with short content keep a 320px minimum width, reduced to fit narrow viewports with 16px side gutters. Set size limits on Dialog.Content; set `minInlineSize: 0` to opt out of the default minimum.
- Card with `appearance="default"` inside a contrast parent keeps that appearance in descendant portals.
- BottomSheet and Dialog panels can publish contrast appearance to descendant portals. DialogStack panels retain declaration-site themes and scoped tokens through the stage portal.
- Drawer panels keep square attached corners on replacement material; BottomSheet panels keep square lower corners.
- Face-down GameCards no longer show a pale strip or pale corners through their ink border.
