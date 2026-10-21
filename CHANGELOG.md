# Changelog

## Unreleased

### Changed

- `ApiTable` resolves catalog references to docs links, searches nested member/signature fields, and expands local array record contracts (`ThreadComment[]`, `FilterToolbarDefinition[]`, `DialogStackPageRecord[]`).
- `ApiTable` hides inherited HTML/React props (`className`/`sx` stay), renders complex types in a dedicated panel, and shows signature parameter fields inline.
- `ApiTable` expands fields for slot props and callback parameter types (`ThreadPartProps`, `MoneyInputDetails`), so named contracts are inspectable in the Slots panel and Signature details.
- `MoneyInput<C>` infers its currency union from `currencies` for `currency`, `onCurrencyChange` and `details.currency`.
- `PhotoGrid<P>` keeps custom photo fields through `photos`, color collections and `renderCaption`.
- `SortableDataTable<T, Id, Key>` types sort column ids and selected row keys, with string defaults for existing callers.
- `Combobox` and `DatePicker` compose native input props and refs without component-boundary assertions.
- A shared civil-date validation core now backs Calendar and DatePicker; public date inputs and callbacks remain strings.

### Fixed

- `GameCard` fits unknown suit names and long rank labels within its printed face. `GameSeat` truncates long hand-count labels within its plaque. Card and hand examples wrap on narrow screens and keep focus rings visible. Fixed-size table examples scroll within their documentation previews.
- `GameRounds` contains long result labels and keeps its ribbon markers aligned. `GameScore` wraps long player names and stages. `GravityWell` scrolls fixed columns within narrow panels, keeps keyboard locations visible, and uses system colors in forced colors. GravityWell and Deck examples fit narrow documentation previews.
- `GameActions` wraps long action labels, `GameResult` contains long result text and actions, and overlapping `GameMarks` stay within their track. Played-pile examples fit narrow screens and use the shared player seats.
- `ThemeSwitch` gives its clickable appearance icon a 32px target. `ToggleSubscription` wraps long billing labels and badges within each option. `TypewriterTerminal` reveals its transcript when a link receives keyboard focus and wraps long transcript text within the terminal.
- `BookingPill` keeps its calendar and long venue details within narrow panels. `CardFlights` keeps card corners scaled to the flight frame. `BookingPill` and `ControlCenter` previews fit phone screens, and `CardFlights` previews keep tables, long hands, and measured flight probes within the available width.
- `SwipeActions` keeps revealed actions aligned when writing direction changes, and its examples fit narrow screens. `TextReveal` wraps long words within narrow headings and applies visual-slot styles. `TextShimmer` wraps unbroken activity labels within their container.
- `RadialMenu` contains long fallback lists in a scrollable menu and wraps long action labels. `SignaturePad` focuses the canvas after drawing so keyboard shortcuts work immediately. `StreamingCaret` stays visible in forced colors.
- `LocaleSwitcher` wraps long language labels within narrow layouts. `PageCurl` contains long navigation labels, status text, and hints, keeps its turning flap behind navigation controls, and renders documentation page content without a circular-data error. `Pill` grows with enlarged text. `Prose` keeps images, video, and SVG artwork within its reading column.

## 0.10.0 — 2026-10-21

### Added

- `GameSeat` now leads with an opaque 48px medallion, a three-card shoulder fan, a hugging plaque and a card-face score coin; `GamePanel` adds the neutral raised surface, `GameScore.Table` the scorekeeper ledger, `GameRounds` a round ribbon and `GameMarks` card-ratio trick pips. `GameTable` composes the real `GameSeat` in its docs.
- Games state axes have one owner: `GameHand` selects while `GameHand.Confirm` plays, a card carries its disabled reason, `GameCardStack.Pile` opens as a controlled disclosure, `GameSeat` takes `remainingMs`/`durationMs` and `GameActions` requires a label.
- `GameTable` sizes from its container: cards scale below `sm`, only real controls keep the 24/32px floor, and `places` replaces `players` (deprecated alias for one release).

- Component documentation ends with one API section (root and parts, native element, slots and dependencies) generated from the component sources; curated examples carry authored code. `packages/ui/src/components/dialog` is the reference page.
- `LinkUnfurl`, `ChatMessage`, `HoldToConfirm` and `AttachmentList` accept `slots.root`, `slotProps.root` and `component` to replace their native root while retaining generated content, props, refs and styling.
- `CodeBlock`, `TypewriterTerminal` and `JsonViewer` share Surface panel material and support inherited or contrast appearance. Root replacements own their panel material.
- `CommentThread`, `TypewriterTerminal`, `CodeBlock` and `JsonViewer` accept `slots.root`, `slotProps.root` and `component` to replace their outer element while retaining generated content and existing panel styling.
- `Timeline`, `MetricCard`, `EmptyState` and `ChatThread` accept `slots.root`, `slotProps.root` and `component` to replace their outer element while retaining generated content, props, refs and styling.
- `Avatar` accepts fallback children, including `PersonAvatar size="full"`; `AvatarGroup` forwards shared and per-member artwork and customization.
- `ArticleBody`, `ArticleSources` and `SectionHeading` add article text, fact boxes, quotations, two-cell comparisons, source lists and section titles.
- `ColorPicker` opens a modal dialog that fits the viewport instead of an anchored popover: focus moves inside, Escape and backdrop cancel, and the swatch checker matches its box.
- `MoneyInput` accepts non-ISO assets with `decimals` (0–18) and a display `symbol`, storing integer base units such as bitcoin satoshis.
- `PersonAvatar` draws seeded pixel-art portraits, full kits and staff attire, with a pure v3 appearance entry for shared identity data.
- `ArticleCard`, `ArticleList`, `ArticleKicker` and `ArticleMeta` compose newspaper-style cards, headline rows, kickers and metadata with editorial typography tokens and no media requirement.
- `NumberField` adds locale-aware quantity entry, exact decimal steps, keyboard and pointer controls, draft validation, and canonical form values.
- `MoneyInput` enters integer minor-unit amounts with locale-aware currency formatting, a currency picker, quick-add buttons and native form reset. Changing currency preserves the stored integer without conversion.
- `PhoneInput` collects international telephone numbers with a searchable country picker, national formatting, incomplete storage candidates, metadata validation and independent controlled number, country and picker state.
- `ColorPicker` edits HEX, RGB, HSL and OKLCH colors, saves swatches and reports text contrast against an opaque background.
- `labelPlacement="hidden"` keeps a field's label as the control's accessible name without taking layout space. Available on TextField, Textarea, PasswordField, SearchField, TagInput, MentionInput, TimePicker, Combobox, Select and MultiSelect.
- `ApiTable` documents props and types from the docs build's `ComponentPropsDoc`: literal unions as chips, expanded members and signatures, real defaults, array item fields, mode badges, and a Slots panel.

### Changed

- The docs site runs on `@jfrader/react-storydocs` 0.16 and renders every API section with the library's own `ApiTable`; the old `@jfrader/storybook-docs` dependency is gone.
- Dual-mode prop types rename `*EasyProps` to `*ShorthandProps` and `*CompoundProps` to `*ComposedProps`; docs and stories say "shorthand" and "composed". The component APIs are unchanged.
- `TreeView<T>` keeps the caller's node fields through `children`, `loadChildren` and `onLoadError`.
- `MoneyInput` and `PhoneInput` `slotProps` accept native element props, refs and events per part (`input`, `button`, `div`, `span`).
- `Combobox`, `MultiSelect`, `Tabs`, `RadioGroup`, `SegmentedControl` and `RadioCards` infer their option or item value union in shorthand mode; composed mode stays string-based.
- `Select` shorthand mode infers its option value union (`<Select<Status> options={...} />`) for `value`, `defaultValue` and `onValueChange`; composed mode stays string-based. `GravityWell` keeps custom item fields through `renderItem` (`GravityWell<T>`).
- Breaking pre-1.0 article API cleanup: use `Article` with `Article.Body`, `Article.Kicker`, `Article.Meta` and `Article.Sources` instead of the separate article components. `ArticleList` stays standalone. `ArticleSection` composes ordered articles into mixed editorial layouts, and `SectionHeading` moves to `ArticleSection.Heading`.
- `CardFlights` now animates the rendered board tree, with `Deck`, custom `Target` destinations, `deal`/`revision`, automatic hand locking and `onBusyChange`. The provider, explicit deal/play hooks, measurement helpers and flight-spec exports are deprecated until the next major release; replace them with `CardFlights` and `useCardFlightStatus`. Piles now retain the newest `maxCards` cards.
- Breaking pre-1.0 API cleanup: every `slotProps` part accepts `sx` instead of `css`, preserving own styles → slot `sx` → consumer `sx` precedence. Emotion's `css` remains internal.
- Component documentation groups usage notes under four headings: "Keyboard and accessibility", "Values and constraints", "Forms", and "Customization". Distinct topics keep their own section.
- The styling showcase demonstrates `styled` with `sx` precedence instead of the internal `css` prop.
- `docs/getting-started.md` replaces `docs/consuming-jfrader-ui.md`, and `docs/releasing.md` becomes the single home for packing and publishing. The README, `AGENTS.md`, and both package READMEs were rebuilt around one description: "React component library based on Emotion and CSS custom properties."

### Fixed

- `ButtonGroup` keeps focused expanding actions in view as their labels resize, including in RTL. `ChipGroup` wraps long chip and overflow-toggle labels within the available width.
- `Kbd` wraps long key names and shortcut combinations within narrow containers. `KeycapKeyboard` aligns equal-unit rows, keeps single-unit keys the same width across rows, and fits legends in compact previews. ImageCompare documentation examples fit narrow preview lanes.
- The axe gate also runs the WCAG 2.2 A rules; `README.md`, `docs/qa-gates.md`, and `SKILL.md` list the exact rule set.
- `InputGroup` wraps long addons without collapsing the editable control. `RadioCards` wraps long validation messages within narrow groups.
- `LogoOrbit` centers its rings and mark in RTL, wraps long integration labels and details, and preserves selection in forced colors. `Emblem` fits longer monograms, keeps its size beside long text and preserves its silhouette in forced colors. `Stepper` gives narrow horizontal labels and errors room to wrap; Stepper and LogoOrbit examples fit phone screens.
- `Dialog`, `Drawer`, `BottomSheet` and `DialogStack` wrap unbroken titles and content inside narrow panels without covering close controls. Custom Dialog panels stay within their shell, and padded Drawer shells fit the viewport.
- `Slider` centers marks on its track in RTL. `SegmentedControl` and `ToggleGroup` keep compact choices at least 32px wide, and `ToggleGroup` contains long options in a scrollable group.
- `Article` keeps responsive picture images inside their media figure in narrow layouts.
- `SearchField`, `PasswordField` and `NumberField` give small inline actions a 32px-wide target. `NumberField` wraps long messages without overflowing narrow fields.
- `PhoneInput` fits narrow fields, keeps calling codes left-to-right, and contains scrolling inside its country list. `MoneyInput` gives prominent amounts a taller control and keeps long asset codes, limits, and quick-add labels inside narrow fields.
- `Checkbox` and `Switch` keep a 32px minimum click-target height, including without visible labels. All three choice controls wrap unbroken labels and descriptions within narrow layouts.
- `MentionInput` contains scrolling inside suggestions and dims disabled text and tokens together with its boundary. `TagInput` keeps its draft inside very narrow fields and includes root padding in its field width.
- `DatePicker` preserves locally scoped right-to-left direction in its calendar popup. `ColorPicker` keeps its format menu inside the dialog, wraps long control labels, and preserves color samples and gradients in forced colors.
- `Tabs` contains overflowing line tabs in a scrollable list, aligns icons with labels, keeps keyboard-focused tabs visible, and permits native touch scrolling when indicator dragging is off. `Tabs` panels and `Accordion` headers and panels wrap unbroken text within narrow containers.
- `TimePicker` shows one disclosure arrow and wraps long field labels within narrow layouts; `DateRangePicker` keeps scrolling inside its popup when reaching the end of a long calendar panel.
- `Toast` keeps long queues inside a scrollable viewport and aligns loading indicators with their messages. `ToastStack` wraps long toggle labels, preserves their focus rings and keeps taller collapsed cards below its toggle; both contain scrolling within notifications.
- `FileDropzone` keeps inside file lists within the drop surface. `CodeBlock` preserves the copy button's target size beside long filenames and language labels, and its examples fit phone screens.
- `CommandPalette` fits phone screens without clipping and keeps its search field visible while results scroll in short viewports. `Popover` wraps long links inside its panel; both contain scrolling within their content.
- `Dialog`, `Drawer`, `BottomSheet` and `DialogStack` wrap unbroken titles and content inside narrow panels without covering close controls. Custom Dialog panels stay within their shell, and padded Drawer shells fit the viewport.
- `Menu` wraps unbroken action labels inside its popup and keeps separators visible in scrolling lists.
- `TreeView` keeps deeply nested labels readable and keyboard targets usable in horizontally scrolling trees, and keeps selection visible in forced colors. `FilterToolbar` shows the configured empty message for each generated filter, and its narrow examples fit phone-width documentation previews.
- `Carousel` keeps its viewport and indicators within narrow containers, wraps unbroken slide text, and fits its examples on phone screens.
- `CardStack` keeps horizontal touch decisions active when a swipe begins inside scrollable card content, while preserving vertical scrolling.
- `VoiceOrb` keeps a violet shell with subtle cyan Listening, indigo Thinking and rose Speaking clouds. State changes crossfade and gather or release the cloud; Speaking reshapes the volume while Idle stays calm. Motion remains continuous and honors live reduced-motion changes.
- `ImageCompare` keeps touch dragging active when pointer capture moves from the handle to the frame. Reveal, divider and handle animate together between values, follow dragging directly, and honor live reduced-motion changes. Resizable examples fit phone screens.
- `ChatThread` wraps long typing names within narrow conversations, keeps keyboard attachment focus on the visible picker button, and fits its documentation examples inside phone-width previews.
- `DataFlow` wraps long playback labels inside narrow panels and keeps connections attached when individual nodes resize.
- `Calendar` keeps localized weekday headers and dates centered in equal columns, fits narrow containers, preserves navigation targets beside wrapping month labels, and shows the full selected range in forced colors.
- Documentation section links no longer pull you back after manual scrolling. The left menu keeps its scroll position and expanded groups between pages.
- `StretchRefresh` wraps long pull instructions and empty-state text inside narrow feeds; its examples fit phone screens.
- `SortableDataTable` keeps keyboard-focused row controls below sticky headings when scrolling backward through tall tables.
- `JsonViewer` wraps long keys and values within tree rows, keeps focused labels and disclosure arrows visible in deeply indented data, and hides inactive selection bars in forced colors.
- `MultiSelect` keeps selection counts readable in narrow fields and long option lists compact, scrollable and beside their trigger.
- `Combobox` wraps long option names and scrolls its list within the available space without covering the input in short viewports.
- `Select` wraps long option names inside its listbox and keeps space between the selected value and disclosure arrow.
- `MentionInput` keeps suggestions beside the field when scrolling moves the caret out of view.
- `TagInput` gives tag removal buttons a wider click target while retaining compact field heights.
- `ContextMenu` keeps separators visible when long menus scroll.
- `CardStack` wraps long empty-state labels inside narrow panels, and its documentation examples fit phone screens.
- `ActivityRings` keeps focused amounts and labels inside the ring tracks at every size, and its documentation examples fit narrow previews. Long content truncates in the dial and remains available in the legend.
- `JsonViewer` keeps selected counts and muted values readable on contrast panels, and wraps toolbar actions inside narrow containers.
- `SignaturePad` keeps signer text at the end of its baseline after drawing and clearing, and wraps long guide text inside narrow pads.
- `LightboxGallery` keeps long captions and viewer controls inside the dialog, reveals the selected thumbnail in LTR and RTL, and fits its documentation examples on narrow screens.
- `VoiceRecorder` wraps long action labels and message metadata on narrow screens, and aligns waveform progress with right-to-left seeking while keeping timers in playback order.
- `ShareSheet` inline layouts retain their content width, the access picker stays on the copy row at phone widths, and confirmation faces appear without fading when reduced motion is enabled.
- `CommentThread` wraps long timestamps inside narrow threads instead of overflowing the card.
- `DateRangePicker` stays anchored while scrolling tall panels, keeps presets compact, wraps long labels, aligns localized calendar columns, and preserves date order in RTL layouts.
- `BottomSheet` restores pointer activation on its drag handle, wraps long headings beside Close, aligns Close when the handle is omitted, and keeps bordered replacement panels inside the viewport.
- Vertical floating `ButtonGroup` trays no longer clip the first and last buttons' rounded corners.
- `DataFlow` wraps long summaries on narrow screens, keeps horizontal diagrams readable in a scrolling scene, and routes vertical connections outside the nodes. Connections stay attached when the inherited text direction changes.
- `PhotoGrid` keeps the current viewer thumbnail visible when opening or navigating a scrolling filmstrip, including RTL layouts.
- `PhotoGrid` fits unzoomed viewer images inside the stage instead of clipping images taller than the viewport.
- The new inputs match the field skin: `ColorPicker`'s trigger is no longer a native grey button (surface, border, radius, padding, one focus ring) and its hex reads LTR; `NumberField` keeps one focus ring on the shell and its range text isolates direction in RTL; `PhoneInput` isolates `+44` in RTL and shows a disclosure caret.
- `PhoneInput` keeps its country panel anchored to the field: the panel is capped at 20rem with the list scrolling inside, instead of being clamped to the viewport edge when neither side fits.
- `Avatar` keeps its online pulse ring centered on the presence badge at every size. `AvatarGroup` keeps overflow-count prefixes before their digits in RTL layouts.

### Added

- Component documentation ends with one API section (root and parts, native element, slots and dependencies) generated from the component sources; curated examples carry authored code. `packages/ui/src/components/dialog` is the reference page.
- `LinkUnfurl`, `ChatMessage`, `HoldToConfirm` and `AttachmentList` accept `slots.root`, `slotProps.root` and `component` to replace their native root while retaining generated content, props, refs and styling.
- `CodeBlock`, `TypewriterTerminal` and `JsonViewer` share Surface panel material and support inherited or contrast appearance. Root replacements own their panel material.
- `CommentThread`, `TypewriterTerminal`, `CodeBlock` and `JsonViewer` accept `slots.root`, `slotProps.root` and `component` to replace their outer element while retaining generated content and existing panel styling.
- `Timeline`, `MetricCard`, `EmptyState` and `ChatThread` accept `slots.root`, `slotProps.root` and `component` to replace their outer element while retaining generated content, props, refs and styling.
- `Avatar` accepts fallback children, including `PersonAvatar size="full"`; `AvatarGroup` forwards shared and per-member artwork and customization.
- `ArticleBody`, `ArticleSources` and `SectionHeading` add article text, fact boxes, quotations, two-cell comparisons, source lists and section titles.
- `ColorPicker` opens a modal dialog that fits the viewport instead of an anchored popover: focus moves inside, Escape and backdrop cancel, and the swatch checker matches its box.
- `MoneyInput` accepts non-ISO assets with `decimals` (0–18) and a display `symbol`, storing integer base units such as bitcoin satoshis.
- `PersonAvatar` draws seeded pixel-art portraits, full kits and staff attire, with a pure v3 appearance entry for shared identity data.
- `ArticleCard`, `ArticleList`, `ArticleKicker` and `ArticleMeta` compose newspaper-style cards, headline rows, kickers and metadata with editorial typography tokens and no media requirement.
- `NumberField` adds locale-aware quantity entry, exact decimal steps, keyboard and pointer controls, draft validation, and canonical form values.
- `MoneyInput` enters integer minor-unit amounts with locale-aware currency formatting, a currency picker, quick-add buttons and native form reset. Changing currency preserves the stored integer without conversion.
- `PhoneInput` collects international telephone numbers with a searchable country picker, national formatting, incomplete storage candidates, metadata validation and independent controlled number, country and picker state.
- `ColorPicker` edits HEX, RGB, HSL and OKLCH colors, saves swatches and reports text contrast against an opaque background.
- `labelPlacement="hidden"` keeps a field's label as the control's accessible name without taking layout space. Available on TextField, Textarea, PasswordField, SearchField, TagInput, MentionInput, TimePicker, Combobox, Select and MultiSelect.

### Fixed

- NowPlaying returns to the mini height when it collapses instead of keeping a stale face height: the measured target comes from the visible panel, so the wrapped Next/Expand row can no longer be clipped by the card face.
- NowPlaying expands and collapses by revealing its content as the card grows, instead of scaling the text and controls with the card. A rejected sheet drag on UserMenu springs back, and Carousel clears a pointer released outside before the drag threshold.
- Dialogs close even when a child animation is paused or long-running: exits wait only for the surface's running exit effects, with a bounded fallback. PhotoGrid retains its viewer through the closing transition instead of cutting to the grid immediately.
- Nested Select, Combobox, DatePicker and Tooltip overlays close only the topmost layer on Escape or an outside press, leaving their parent open and preserving focus.
- Select and MultiSelect share one labeled-field layout, and Select triggers show a disclosure caret.
- ShareAccess member rows share a uniform height, role pickers align on the control line, role labels stay available to assistive technology, and the surface fills its host. ShareSheet keeps the access picker at the end of the copy row while the "Copied" confirmation appears.

## 0.9.1

### Fixed

- `Prose` no longer emits the Emotion SSR warning for `:first-child`/`:last-child`. Table cells keep normal word wrapping.
- `StreamingCaret` uses a valid token-derived blink duration.
- The `Prose` story moves to the existing `Data display` section. `InputGroup`, `StreamingCaret` and `Prose` now document their props, usage and source examples against the repo's documentation spec.

## 0.9.0

### Changed

- PhotoGrid favorites, cover-flow controls and product choices use library typography and themed control colors. LogoOrbit groups its filter chips separately from standard-radius actions, and CardStack headings use the library type scale.
- Menu accepts `appearance="glass"` for a translucent popup with an opaque reduced-transparency fallback.

### Added

- `InputGroup` frames inputs and textareas with leading or trailing addons. `StreamingCaret` adds a decorative reduced-motion-aware caret, and `Prose` styles semantic longform HTML without choosing a parser.
- `PageCurl` presents cover/facing/back-cover spreads with native navigation, RTL keyboard turns, controlled selection and a bounded next-button paper preview. Physical SVG crease geometry, corner handles, backward dragging and teaser choreography are not included.
- `DateReel` selects Gregorian civil dates/times with localized spinbutton reels, atomic month-end clamping, bounds, presets and asynchronous confirmation. Zoned scheduling, offscreen observation, recycled-window/inertia fidelity and manual screen-reader/touch validation are not included.
- `GravityWell` arranges noninteractive tiles in a bounded pointer field with keyboard exploration and pause controls. `DataFlow` illustrates source-to-destination routing with a readable summary and pause, step and replay controls. Counts and particles are illustrative, not live telemetry.
- `ControlCenter` composes quick-setting toggles, sliders, radio modes and modal focus/channel details with draft application and controlled settings. `PaymentFlow` composes an illustrative five-phase payment journey with safe Intl currency formatting, an ordered narrative and pause/step/replay controls. Custom circular dial gestures, tile morphs, moving payment chips, SVG rails, continuous balance count-up and hover effects are excluded.
- `ShareAccess` composes ShareSheet's inline presentation with email invitations, member roles, persistent removal undo and link permissions. `VoiceRecorder` composes VoiceOrb with application-owned recording, review, seeking and sending; neither component performs permission or media capture work.
- `RadialMenu` shows object actions around a trigger with keyboard navigation, hold-drag targeting and a linear fallback. `LogoOrbit` arranges supplied marks in a pausable integration catalog with filters, details and consumer-owned connection actions. Both support reduced motion and replaceable parts.
  Scope excludes lens/pill/swirl/magnet choreography, tilted-ring parking, connector/detail spring, exhaustive announcements, focus-removal repair and the edge-case catalogue.
- Tabs accepts `variant="glass"` and `variant="liquid"`, line/pill/lens indicators, icon labels, localized badges, compact bars and optional release-only drag selection. Existing tab and panel semantics remain unchanged.
- Navigation accepts `variant="morph"` for a floating disclosure bar with rich link descriptions, compact spacing, keyboard section navigation and one/two-column panels. Destinations remain native links.
- Tabs and Navigation provide partial reference parity: momentum/refraction, exact reference geometry, integrated search, controlled panel axes, hover intent and hamburger collapse are excluded.
- Skeleton adds `Skeleton.Morph` and `Skeleton.Block` for loading-to-content layouts, completion announcements and focus parking on reload. HoldToConfirm adds `variant="morph"` without a second confirmation primitive. Combobox includes a ranked semantic-search composition with source/score labels over its existing listbox.
- Combobox's empty message is exposed as a disabled option so an open empty listbox retains its required option semantics.
- `PasswordStrength` composes PasswordField with application-owned policy rules, a labelled meter and readable requirement states. Scores describe policy compliance, not password security.
- `BookingPill` composes Calendar and TimePicker into a party/date/time/review journey with application-owned availability and asynchronous confirmation.
- `MultiRegionFailover` presents six supplied incident snapshots with readable regional status, metrics, pause/seek/replay controls and reduced-motion playback protection. It is an illustration, not live monitoring.
- `ActionButton` runs app-owned actions with pending, success and retry feedback, controlled state and replaceable parts. `ActionMorph` combines an action menu with short inline drafts and async submission. Both support reduced motion and preserve keyboard focus.
- Spinner adds dots, bars, square and stateful ring presentations that morph to success/error marks, plus decorative mode, dimension overrides, an xl size and replacement slots. MorphLoader is consolidated into Spinner rather than a separate export.
- PhotoGrid adds `variant="product"` for product images, color/size choices and modal inspection, and `variant="cover-flow"` for a focused depth or flat rail with optional reflections. Both retain photo-ID selection, localized labels and bounded RTL keyboard navigation.
- ButtonGroup accepts `presentation="floating"` for a pill tray and `presentation="expanding"` for icon actions with a revealed label. Both keep native group and button semantics; expanded labels support controlled state and reduced motion.
- `TextMorph` animates short labels with matched glyphs, whole-label fades, rolling slots, or bounded sand particles. All variants preserve the current readable text and support reduced motion, typed replacement slots and opt-in announcements.
- CardStack accepts `variant="wallet"` for compact translucent cards with stitched edges and decision stamps; review, undo and reset behavior is unchanged.
- `TextReveal` reveals short text with a finite word entrance, preserved whitespace and immediate reduced-motion rendering.
- `TextShimmer` highlights active work labels with a finite animation budget, explicit pause control and offscreen/page-hidden pausing.
- TimePicker accepts `presentation="dial"` for a draggable, step-snapped 24-hour face alongside its keyboard-operated time list. Values, bounds and form submission keep the existing HH:mm contract.
- Select accepts `variant="morph"` for a pill trigger that expands into its floating option panel, with reduced-motion support and the existing selection and keyboard behavior.
- Card supports `appearance="glass"` and `appearance="holo"` materials. Opt-in `holoTilt` follows mouse and pen movement, with no tilt under reduced motion.

## 0.8.1

### Changed

- `SortableDataTable` sort headers drop the pill-style chip chrome: borderless, text-forward labels with paired chevrons (shape and accent color mark the active direction), quiet surface hover, and the existing focus ring. API and behavior unchanged; 32px targets, forced-colors and reduced-motion preserved.


### Added

- `GameActions`: command toolbars with roving keyboard focus, disabled and pending actions, and replaceable roots and buttons. `CallOverlay` announces game events with reduced-motion support, standalone or inside `GameTable.Floating`. Both are opt-in package subpaths; shortcut bindings stay in consumer code.
- `ShareSheet`: share links, choose people and access, and send through app-owned callbacks in a desktop popover or phone sheet. Typed `slots` and `slotProps` customize each part; `dialog` targets the native phone shell and `content` the inner panel.
- AnnouncementBar, ChatThread, Checkbox, CodeBlock, CommentThread, CopyButton, HoldToConfirm, HoverCard, KeycapKeyboard and LightboxGallery accept typed interior `slots` alongside `slotProps` for their text, controls, lists and panels. Layout-only `AnnouncementBar.content`, `ChatThread.viewport`, `CodeBlock.sourceFrame`, `HoldToConfirm.face`/`fill`, `HoverCard.Profile.avatar`/`identity` and `KeycapKeyboard.row` remain styling-only; existing root APIs are unchanged. Shared-helper targets `ChatThread.attachments`, composer `textarea`/`sendButton`, and `CommentThread.composer`/`textarea`/`send` retain their existing props API.
- Alert, Avatar, AvatarGroup, Badge, AttachmentList and Carousel accept a replacement slot for every part they already styled through `slotProps`, so a consumer can pass props or swap the element.
- Card accepts `slots.header`, `slots.title`, `slots.description`, `slots.content` and `slots.footer` replacements while preserving each part's styles.
- Component docs list each slot and link it when the slot type is another public component. Components that render another public component link to it.
- Dialog, Drawer, BottomSheet, ContextMenu and UserMenu easy compositions accept interior replacement slots. Drawer and BottomSheet add footer content; DialogStack adds header/body slots. Overlay easy roots accept `component` as `slots.root` sugar, and UserMenu.Content adds replacements for its list, handle and close button.
- TextField, Textarea, PasswordField, SearchField, MentionInput, TagInput, InlineEdit, FileDropzone and ExpandingSearch accept typed `component`, `slots` and native `slotProps` for wrapper and generated-part customization. Existing control refs and leaf renderers remain available.
- Shorthand-mode part props accept `css` overrides across MultiSelect, Select, Combobox, Menu, Tabs and Dialog, with `component` as `slots.root` sugar. Combobox adds direct label, description and error slots; Menu and Tabs add generated-part replacement and root props; Dialog adds panel/header props and its existing panel-root replacement seam. Each component has a slot-props example.
- `CommandPalette`, `ResizablePanels`, `EditableDetails`, `DialogStack` and `FilterToolbar` accept data-driven easy compositions with typed generated-part `slots`/`slotProps`. Existing composed anatomy stays available.
- `Toast` and `Toast.Provider` can mount the default viewport or `ToastStack` with `viewport`, renderer props and typed customization. Automatic rendering keeps one renderer per provider; `useToast` remains the event API.
- `MultiSelect`, `Select` and `Combobox` accept `options` and field presentation props for a single-element field, with typed `slots`/`slotProps` customization. Composed children and dotted parts remain available; types reject mixing modes. `MultiSelect` also supports `clearable`.
- `Menu`, `Tabs` and `Dialog` accept one-element compositions through action/section collections or named dialog content props. Their composed parts remain available; incompatible children and shorthand-mode props are rejected by TypeScript.
- `LinkPreview`: show supplied link metadata without a composer, with loading, unavailable and error states, image fallback, and truncated titles and descriptions. `LinkUnfurl` keeps its existing API and behavior.
- `ReactionGroup`: standalone reaction pills with counts, current-user highlights, disabled and read-only states, and an optional keyboard-accessible emoji picker. Existing thread APIs remain unchanged.
- `AttachmentList`: standalone file lists with localized sizes, type icons, image previews, safe download or navigation links, and expandable overflow. Message attachments and composer files share private file helpers.
- `ChatMessage`: show a single message with author, avatar, body, timestamp, delivery status, attachments and reactions without adopting a conversation layout. `ChatThread` keeps its existing API.
- `CodeBlock`'s optional Shiki adapter highlights JSX and TSX with their own grammars.
- `Surface`: panel material with flat, raised and floating shadows, inherited or contrast appearance, and div-root replacement through `component` or `slots.root`. Card supports the same root replacement and native root `slotProps`.
- Drawer.Panel, BottomSheet.Panel and DialogStack.Content support div-root material replacement. Dialog.Panel adds the same customization while plain Dialog.Content children keep their default panel.
- The documentation front's overview page is the repository README: a build step in `apps/docs` syncs `README.md` into the docs guidance, so the introduction, install notes and package table live in one file. The README now leads with the hosted docs (**ui.jfrader.com**, workbench at `/storybook/`) and says what generates the site — `@jfrader/storybook-docs` reading the library's own story files — instead of pointing at a local Storybook.
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
- `EditableDetails`: a nested section indents its content by its title inset and draws a 1px guide rail, the disclosure caret renders at the row's start, and a section's rows line up under its own title. Panel padding is the trigger's inline-start padding plus the caret glyph plus the gap; section rows are 40px at the top level and 32px nested; a value renders at medium weight against a regular, muted label; the Edit control has no border or background until hover or focus; an open editor renders on the inset surface with a border and radius.
- Storybook groups `EditableDetails` form and picker examples under one Showcase entry.
- `PhotoGrid` opens photos in a full-screen viewer with icon controls, tooltips and a thumbnail strip. The header shows the photo count and current density, with one pressed toggle per density step. Ctrl+scroll and pinch resize thumbnails around the photo under the pointer. Upward drags no longer move the photo, and the chrome becomes opaque when reduced transparency is on.

### Changed

- `GameTable` seats may omit `teamIdx`, which defaults to `index % teamCount` without changing explicit teams. `GameResult`, `GameMarks`, `GameRounds` and `GameScore` expose replacement slots for every styled part; `GameResult`, `GameCardStack` and `GameHand` also accept root replacement through `component` or `slots.root`. `GameResult` now merges consumer `data-ui` tokens on its root instead of forcing `game-result`, matching `GameMarks`, `GameRounds` and `GameScore`. Newly slotted parts add `data-ui` identity tokens to previously unmarked elements, which may change snapshots. **Breaking for `@jfrader/ui@0.8.x`:** `BoardPlayerCount` is removed; use `number`. The public `buildOpponentHiddenHandLayout` helper renames `profileRules` to `rules`.
- **Breaking for `@jfrader/ui@0.8.x`:** `GameTable` no longer takes a `viewport` prop. The surface frame now comes from the table's own container: a `container-type: size` wrapper drives `@container` rules with continuous `clamp()`/`cqi`/`cqb` formulas, and the surface is a responsive circle (`border-radius: 50%`) that follows the container fluidly with no threshold jumps. `resolveBoardViewportProfile`, the `BoardViewport`/`BoardViewportProfile`/`BoardSurfaceFrameConfig` types, `FRAMES`, the `data-profile` attribute and the `BREAKPOINT_CASES` fixtures are gone; the story matrix sweeps aspect ratios 0.45–2.4 instead of six named profiles. Short-wide containers (840×360) now honestly fit the standard composition at card floors instead of declaring `insufficient-space`; that state remains for genuinely tight containers.
- `Deck` addresses card art by id, with named art sets, per-card set overrides and set-specific backs. Missing art falls back to the printed face; `cardId` supports custom card keys.
- Button's first example says Save changes, and its code matches that button. Card's slot example shows `slotProps`.
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
- **Breaking for `@jfrader/ui@0.8.x`:** `GameTable`'s regions are composed parts — `GameTable.Seat`, `.Play`, `.Center`, `.Header`, `.Dock`, `.Footer` and `.Floating` take native props, `ref` and `sx` — and the `renderSeat` / `renderPlay` callbacks and the region node props are gone. `GameTable.Seat` publishes its player and geometry through `useGameTableSeat()`, so a pile or a hand reads them instead of receiving them as arguments. The prebuilt-order prop is now `seatSlots`, leaving `slots.root` for root replacement.
- GameCard backs use red-and-paper `Pattern` tiles: poker checks by default, or Spanish diagonals via `backPattern={CARD_BACK_PATTERNS.spanish}`. Custom artwork replaces either face.
- GameTable places seats on a measured bounded curve (circular in near-square space and bounded ellipse with axis ratio up to 1.5) when `seatPlacement="inside"`. All seat content remains upright for the spectator without rotation. `GameTable.SeatChrome` places names and avatars out of flow, without affecting card positions or scales; side chrome moves above/below cards when horizontal room runs out. Separate seat/center scales preserve a 32px GameCard width floor; requested clearance yields to zero before that floor can be crossed. `data-clearance` reports the concession and `data-layout-fit="insufficient-space"` declares card compositions that still cannot fit without collisions or clipping. Rival GameCard backs emit the player/index markers consumed by card flights. Component props and the surface measurement target are unchanged; exported seat configuration describes derived radii, scales and gap.

### Fixed

- Dialog, CommandPalette, Drawer and BottomSheet lock the page before the opening frame and reserve the scrollbar width, so opening an overlay no longer flashes the scrollbar or shifts the layout.
- `LightboxGallery` and `LinkUnfurl` images show without JavaScript and when they finish loading before hydration. They are hidden only while the client knows they are loading, marked `data-image-state="loading"`. `LinkUnfurl` images now carry `data-image-state` instead of `data-loaded`.
- The published package no longer carries type declarations for story-only helpers: the build excludes `*fixture.tsx` and `*fixtures.ts`, so the card-flight fixtures, the game-hand parity fixtures and the game-table reference fixtures stop shipping. JavaScript output is unchanged.
- The docs front consumes `@jfrader/storybook-docs@0.9.1`, which stops the engine from inventing a page-name import for authored snippets and from rendering `children: null` as `{null}`. The docs front no longer shows a fabricated "Usage" snippet for entries whose subject is not a component with that page's name: `Games/Deck` used to read `import { Deck } from '@jfrader/ui'; <Deck>{null}</Deck>`. Deck, CardFlights, Theme, Custom accent, DialogStack and Next author their real examples instead, with their own imports.
- The docs front consumes `@jfrader/storybook-docs@0.9.2`: the sidebar paints its whole column instead of stopping where the sticky list ends, so a long page no longer shows the page background under the menu.
- The Games pages document the component, not its history: migration notes and test narration are gone, technical stories are named for the state they show (or keep out of the docs), each page opens with a full composition and the short usage comes first. Stories and assertions are unchanged.
- Card-flight fixes from the independent review: changing `resyncKey` now cancels the flights in progress and restores their destinations before the new baseline, `GameSeat`'s `handCount` shorthand registers with its seat so a composed rival hand receives deal flights and play origins, a flight's back resolves against the same deck as its front, and `GameHand`, `GameCardStack` and the flight frame combine `data-ui` identity tokens instead of overwriting them.
- `CardFlights` composes a board with one hook: `useBoardFlights({ hand, handKey, plays, foregroundIdx, seats })` deals a new hand and flies accepted plays, and returns `{ landing, reset }`. `GameHand`, `GameHand.Hidden`, `GameCardStack.Pile` and `GameTable` register their nodes inside the provider, so a composition never looks up the DOM and never builds a separate player list; each play is identified by the id your app gives it. The deal/play hooks and the marker attributes stay as the low-level escape hatch.
- The `GameSeat` turn ring re-samples the clock when its duration changes and schedules its milestones from the current time, so a callback added late cannot fire `ending` past a deadline that already passed. Deck registration and lookup use a `Map`, so `constructor`, `toString` and `__proto__` raise `UnknownDeckError` like any unknown id instead of reaching through the prototype.
- `ButtonGroup`, `RadioCards` and `ScrollArea` document why their highlight, ring and thumb anchors stay physical (`left`/`top`): they follow measured `DOMRect` and `scrollLeft` offsets, which are physical in RTL too. No visual change.
- `GameResult` closes a match without shipping the celebration: an outcome as data (`won | lost | draw`) with consumer copy in its slots, slots for eyebrow, title, summary, reward, actions and the consumer's own effect, and the recipe for a deterministic celebration with a reduced-motion branch documented instead of baked in.
- `GameScore`, `GameMarks` and `GameRounds` join the games subpaths: rows of consumer labels and numbers formatted with `Intl` and an explicit locale, a pile of consumer artwork marks, and a round history that shows text alongside the tone. No scoring rules, assets or animation ship with them.
- Games examples say what they are: every published story in `game-card`, `flip-game-card`, `game-hand`, `game-card-stack`, `deck`, `pattern` and `card-flights` authors its code, so the snippet shows the art, the composition and the slots the story renders — imported from the component's own subpath, never the barrel. A guard fails the build when a published story authors nothing, imports a game symbol from the package root, or declares setup the docs front cannot run (`beforeEach`, `loaders`, `viewport`), and a second one compiles every authored snippet.
- `Deck.faces` nests the artwork map by suit and rank (`{ oros: { 1: <AsDeOros /> } }`) instead of the concatenated `'oros-1'` key, so ids containing the separator can no longer collide. A partial map keeps degrading per card: artwork, then the printed mark and glyph, then raw text.
- `GameHand` no longer throws focus away when it becomes unavailable: the cards and the confirmation carry `aria-disabled` and keep their place in the tab order, with activation blocked in the handler. This also drops the native `disabled` attribute that sent focus to `body` while a card was in flight.
- `GameSeat`: one player's place at a table — avatar, name, badges, points, hidden hand and chat as slots, with `component` / `slots.root` / `slotProps` for the parts. `turn={{ deadline, durationMs, now }}` draws a CSS-animated turn ring in a single write per turn (no interval, no per-tick render) and reports `half`, `quarter`, `extended` and `ending` milestones for consumer cues. Import it from `@jfrader/ui/game-seat`.
- `CardFlightsProvider` owns its board scope: it renders the wrapper itself (with `component`, `slots.root`, `slotProps.root`, `className`, `sx` and `ref`) instead of asking the consumer for a `div` and a `scopeRef`. Passing `scopeRef` still points the scope at a consumer-owned element and skips the wrapper. The CardFlights documentation lists one entry again: the flight regression stories live with the component, marked out of the docs.
- **Breaking for `@jfrader/ui@0.8.x`:** game components and `Scene` are opt-in subpaths now — the package root no longer re-exports `game-table`, `game-card-stack`, `game-card`, `game-hand`, `flip-game-card`, `card-flights` or `scene`. Import them as `@jfrader/ui/game-table` and friends; the subpath exports themselves are unchanged.
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
