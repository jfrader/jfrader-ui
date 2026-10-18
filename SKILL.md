# SKILL.md — Creating and maintaining components in jfrader-ui

Operational guide for anyone (human or agent) creating, changing, or reviewing a component in this
library. Read `AGENTS.md` first for commands and the short conventions; this file is the deep guide.
Every rule here exists because something went wrong without it.

## 0. When this skill applies

- Creating a new component or a new part of a compound component.
- Changing a component's API, behavior, styles, or accessibility wiring.
- Writing component descriptions, story explanations, prop documentation, or consumer guides.
- Reviewing a component batch before commit.
- Fixing an accessibility, performance, or state defect in a component.

Not for: application composition (consumers), token-only work, repo tooling. Those belong to
`AGENTS.md` / `PLAN.md`.

## 1. Read before writing

1. `AGENTS.md` — commands, repo conventions, dependency allowlist.
2. `PLAN.md` — pointer to Linear planning and headline decisions; detailed history is in git. Keep it a pointer; record progress in Linear.
3. The nearest sibling component — `button/`, `text-field/`, `checkbox/`, `switch/` are the reference
   implementations for patterns in this file.
4. `packages/tokens/src/tokens.ts` — the token source. If a needed color/size role is missing, add a
   token (base + light) and regenerate; never inline a raw value.
5. Verify with the repo commands: `pnpm generate`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
   Never claim a check you did not run.

## 2. Non-negotiables

These are the rules that repeatedly caught real defects in this repo's review cycles.

### Semantics and accessibility

- **Native semantics first.** Use the native element (`button`, `input`, `dialog`) or implement the
  complete WAI-ARIA APG pattern. A `role` is a behavioral promise, not a shortcut.
- **Names are required.** Every control has an accessible name from visible text, `label htmlFor`,
  `aria-labelledby`, or `aria-label`. `required` state, invalid state and descriptions are exposed
  (`required`, `aria-invalid`, `aria-describedby`).
- **ARIA attributes merge, never overwrite.** External `aria-describedby` / `aria-labelledby` from
  props are combined with internal ids (space-joined; internal ids are instance-unique so dedupe is
  not needed). An explicit `aria-invalid` is preserved unless the component itself forces invalid.
  Where structure matters (dialog descriptions), provide an explicit opt-out instead of silently
  dropping the relationship.
- **One state authority per axis.** Controlled prop wins; `defaultValue`/`defaultOpen` only seed
  internal state; callbacks fire from interactions, never from render or observing effects; a
  controlled request does not visually commit until the parent updates the prop. Use the shared
  `src/utils/use-controlled-state.ts` hook (Tabs, Dialog); do not hand-roll another copy.
- **Presence checks are not truthiness.** `false`, `0` and `''` are legitimate values. For ReactNode
  content use `isRenderable()` from `src/utils/renderable.ts`; for controlled props compare
  `!== undefined` (or `!== null` for explicit opt-outs).
- **Focus is always visible and tested.** Keyboard focus draws the 2px `--ui-color-focus-ring`
  outline; tests assert `ownerDocument.activeElement` (never the Storybook manager document) and a
  non-`none` computed outline.
- **Overlays return focus deliberately.** A *modal* dialog moves focus inside on open and returns it
  to the invoker when it closes. Overlays dismissed by focus leaving (hover cards, non-modal
  popovers) must NOT steal focus back; a menu closed with Escape returns focus to its trigger.
- **Hidden native inputs stay operable.** Visually hide with `position:absolute; opacity:0` — never
  `display:none`, `visibility:hidden`, `hidden`, or `aria-hidden`. The visible control shows the focus
  ring when the hidden input is focused.
- **Non-text contrast ≥ 3:1** for required cues (WCAG 1.4.11) — and, as stricter library policy, for
  every control boundary. Use `--ui-color-borderControl` for control boundaries; verify new pairs with
  the contrast script pattern (oklch→sRGB math), never by eye. Text contrast ≥ 4.5:1 for normal text in
  **both** themes.
- **Targets ≥ 24×24 px** (WCAG 2.5.8 AA, with exceptions); library policy: our interactive controls
  stay at 32px+ on the main axis, icon-only controls never below 24px.
- **Reduced motion is honored**: transitions/animation get a `prefers-reduced-motion: reduce`
  override; lifecycle behavior (open/close/focus) must still complete.
- **RTL**: logical properties everywhere (`paddingInline`, `insetInlineStart`, `marginBlockEnd`);
  directional rendering keys off the root's effective direction via `:dir(rtl)`; route a `dir` prop to
  the visual root.
- **State is never conveyed by color alone** (thumb position, glyphs, text changes accompany color).
- **Forced colors**: focus and states use real outlines/borders, never shadow-only cues.
- **Ref callbacks preserve cleanup.** A ref-composition helper must pass through the cleanup function a
  function ref returns; never return the assignment expression implicitly. StrictMode attach/cleanup
  cycles are part of the contract (test them).
- **Accessibility relationships use `useId()`** — never list keys or hand-rolled counters. Instance ids
  stay unique across multiple React roots via distinct `identifierPrefix`; SSR and hydration must produce
  matching ids.
- **`useEffectEvent` is effect-local.** Stable since React 19.2; it reads the latest committed values for
  one effect. It is not a general stable-callback escape hatch, and it cannot be used unconditionally
  while the package peer floor is `^19.0.0` — guard it if used.
- **Accordion-like disclosures:** heading level should follow page hierarchy (make it configurable when
  building disclosure patterns); region semantics on panels are optional — avoid landmark proliferation
  with many expanded panels at once.

### Styling and code

- **Tokens only.** Import typed references from `@jfrader/tokens/vars`. No raw colors, no magic pixel
  values where a token exists.
- **Module-level `css()` constants.** Never build style objects per render. Compose a public part's
  root through `WithSx` (`src/styling/sx.tsx`):
  `<WithSx className={className} styles={[base, variants[variant], slotProps?.x?.css]} sx={sx}>` and
  put the `className` it hands back on the element. Order: own styles → `slotProps` css → consumer
  `sx`. Internal elements keep a plain `css={...}`.
- **`sx` is the only public styling prop** (`SxProps`), on every public visual part root, threaded
  through `WithSx`. The Emotion `css` prop is internal-only: part props types never declare it and
  components never destructure it; a stray consumer `css` folds into `className` and still loses to
  `sx`. Context/provider components render no DOM and take no `sx`. Parts styled only through
  `slotProps` do not get `sx`.
- **The styling seam**: import `css`/`keyframes`/types only from `src/styling/css.ts`. Never from
  `@emotion/react` directly, never `styled()` inside the library. `styled`, `ThemeProvider`,
  `useTheme`, `theme` and `createTheme` are the app-facing styling API; library internals stay on `css()` constants.
- **Examples, guides and app chrome use `styled`**, built at module scope from library components
  (`styled(Surface)({ … })`) or plain tags, with token values for every colour, space, radius and
  font. Never a `css` prop, an inline `style` object, a Tailwind-style class or a literal value in
  example or app code: a reader copies what we show, so the sample has to be the pattern we want
  them to keep.
- **State through attributes**: `:hover`, `[aria-disabled="true"]`, `[aria-invalid="true"]`,
  `[data-state]`, `:checked`, `:focus-visible` — not class soup.
- **Transitions list properties explicitly** (`background-color, border-color`), never `transition: all`.
  Declare `keyframes` at module scope.
- **Dynamic values** (progress, coordinates) go through inline CSS custom properties or `style`
  attributes, never through generated per-value classes.
- **Theming has three paths.** Apps set `data-theme` on `<html>`; `ThemeRoot` themes a scoped subtree
  (embedded widgets); `ThemeRoot tokens` (`createTheme`) recolors the accent family of one scope. A
  surface may also wear `appearance="contrast"`: the dark theme with the eight
  charcoal overrides, on any page (Drawer.Panel by default). Components read tokens only and never pick a theme themselves. The Emotion
  theme (`theme`, mounted by `ThemeProvider` and by `ThemeRoot`) is the token object itself, so it
  never changes between dark and light. Consumer setup lives in `docs/consuming-jfrader-ui.md`.
- **Portaled content goes through the theme scope.** Floating overlays portal with `OverlayPortal`
  (`src/overlay/overlay-portal.tsx`), never a bare `FloatingPortal`; a custom `createPortal` wraps
  its content in `ThemeBoundary` and honors `useThemeScope()?.portalContainer` (see Toast). This
  re-applies the nearest scope's theme and appearance inside the portal and routes it to the root's
  `portalContainer`. Native `<dialog>` is not portaled and needs neither.
- **No deep descendant-chain styling.** Direct relations from the component's own DOM are fine
  (`input:checked + span`, `&[data-indeterminate] input + span svg`); avoid unrelated descendant
  selectors and tag-only chains beyond one level.
- **Emotion JSX runtime.** Automatic JSX with `jsxImportSource: '@emotion/react'` is required (Babel
  plugin not used); `css()` returns serialized styles, not a class-name string.
- **Emotion labels.** `label: 'component-name'` on `css()` aids class names in dev — never `:label`.

### Motion (the `motion` library, only when a component needs it)

- Import from `motion/react` (never `framer-motion`). Current major is 14.x; React ≥18.2 required, we are
  on 19.3.
- Reduced motion: mount `<MotionConfig reducedMotion="user">` where motion runs and read
  `useReducedMotion()` when behavior must change. The default policy is `"never"`. Automatic reduction
  disables transform/layout animations but not every opacity/color animation — keep explicit
  reduced-motion branches where the lifecycle must still complete.
- Prefer `layout` for measured layout animation and `layoutId` for shared elements; springs via
  `transition={{ type: 'spring', … }}` or `useSpring()`. Change layout through styles/classes; never let
  CSS transitions and motion own the same property.
- **Timings come from `src/styling/motion-timings.ts`** (`motionDurationMs`), which reads the token
  object: Motion wants a number, the stylesheet wants `vars.motion.duration.*`, and both must move
  together. Never write a duration literal next to a token.
- **Long moves between regions use the imperative track.** When a thing travels from one measured box
  to another (a card dealt to a hand, a tile landing in a slot), drive it with `animate()` from
  `motion/mini` rather than a CSS transition: the geometry is only known at launch, the flight must be
  interruptible, and the destination stays hidden until it lands. Keep CSS transitions for state
  changes that live in one place.
- **A reduced-motion branch completes the state.** Skipping the move is not enough: the consumer's
  bookkeeping (landing, focus, "this card is now in the hand") has to finish anyway, and nothing in the
  component's contract may wait for `transitionend`, `animationend` or a finished Motion promise.

### Performance (author-level)

- Static styles serialized once at module scope; finite variant maps precomputed (`Record<Size, SerializedStyles>`).
- Context-heavy compound components: keep provider values stable (memoize the context object);
  split frequently-changing state from stable actions only when profiling shows fan-out.
- Do not add `memo`/`useCallback` ceremony by default — the repo does not assume React Compiler;
  optimize measured boundaries, not guessed ones.
- `will-change` only for a demonstrated rendering problem, removed afterwards.

### Easy mode

- Dual-mode components (MultiSelect, Select, Combobox) support both compound anatomy and a single-element easy mode via a mutually exclusive `options` XOR `children` type union.
- `options` is a readonly array of `{ value, label, disabled?, textValue?, id? }`.
- Presentation props (`label`, `description`, `error`, `placeholder`, `size`, plus `clearable` on MultiSelect only) configure the generated field anatomy.
- Easy mode composes the existing compound parts internally (no parallel implementations) and preserves existing state, controlled/uncontrolled axes, and native form reset semantics.
- Generated parts expose typed `slotProps` with singular, lower-camel-case anatomy keys: `root`, `label`, `description`, `error`, `trigger`, `value`, `content`, `item`, `empty`, and family parts such as `clear`, `input`, `list`, `tab`, `panel`, `separator`, `header`, `title`, `close`. Expose only parts the family generates; provider-only roots need no DOM slot. Repeated parts share one props object; record values, ids and disabled state remain authoritative. Part props accept `className` and `css` plus the existing part API; unknown keys are rejected.
- `slots` replaces generated compound parts with adapters that forward props/ref to the original part; `component` is sugar for `slots.root`, and `slots.root` wins. Preserve existing leaf `render` APIs. Dialog adopts only its Panel div for `slots.root` / `slotProps.root`; `slotProps.content` targets the native shell. Combobox's direct field `label` / `description` / `error` props win over the same nested `slotProps.input.slotProps` keys. Provider families may add an optional easy-mode wrapper only when a root override is supplied.
- Overlay generated-part adapters forward props/ref to the original compound part to retain focus, scrolling, gestures and ARIA registration. Dialog, Drawer and BottomSheet keep the native Content shell; their easy `root` slot targets Panel. DialogStack's easy `root` targets each Content. Native `header`/`body` wrappers (Dialog header, DialogStack header/body) forward to one div. Menu, ContextMenu, Popover and UserMenu add a wrapper only when root customization is supplied; native root props merge into `slotProps.root`. UserMenu.Content's `menu`, `handle` and `close` slots replace native elements and forward all supplied props/ref. Declare replacement types outside render. A part that takes props is also replaceable: every `slotProps` key has the same key in `slots`, and one key is one element, so a part that renders twice gets two keys. See [the generated API inventory](docs/customization-inventory.md) for supported keys.
- Form-field native attributes and top-level refs keep their existing control targets; wrapper refs use `slotProps.root.ref`. Native generated-part replacements forward props/ref to the same element kind. InlineEdit's `control` adapter handles both input and textarea props. FileDropzone's `action` and `progress` adapters forward to Button and Progress. ExpandingSearch uses `container` for its animated shell, `field` for SearchField, and `fieldRoot` for that field's wrapper; its existing SearchField keys remain available. Legacy `slotProps.root` className/css still style the inner field as well as the outer wrapper; use `slotProps.field.slotProps.root` to target only the inner field.
- Component documentation and the primary story snippet show the easy path first as the default usage, followed by compound examples for custom anatomy.
- Incompatible modes (passing both `options` and `children`) are rejected at compile time with TypeScript type errors.

## 3. Component contract worksheet

Fill this in the spec/PR before coding (it prevents 80% of review findings):

1. **Anatomy** — parts and their roles (root, label, control, description…), compound only when
   structure is meaningful.
2. **Semantics** — APG pattern used; role/state/property map; keyboard map.
3. **State axes** — controlled/uncontrolled prop pairs (`value/defaultValue/onValueChange`,
   `open/defaultOpen/onOpenChange`, `checked/defaultChecked/onCheckedChange`).
4. **Events** — state callbacks receive values (`onValueChange`, `onCheckedChange`, `onOpenChange`);
   native event callbacks (`onChange`, `onClick`, `onCancel`) keep their native event signature.
5. **Ref target** — which DOM element the `ref` prop reaches.
6. **Customization surface** — `className`, `css` and `sx` on every public visual part root,
   `component` (exactly sugar for `slots.root`) and `slots` for adopted part replacement,
   `slotProps` for part props. Root extra props merge as `slotProps.root`: slot conflicts win,
   except combined className and shallow-merged style. Existing leaf-control `render` APIs stay;
   no new panel render APIs, `asChild`, or element-valued replacements.
7. **Environments** — RTL, reduced motion, forced colors, SSR/hydration notes.
8. **Lifecycle status** — new / stable / deprecated (with replacement).

## 4. File and naming conventions

**Naming**

- Use Function+Shape in 1–2 words: `SearchField`, `TimePicker`, `SplitButton`.
- Materials and styles (`glass`, `holo`) are props or variants, never component names.
- Flavor names must state a clear function.
- Consolidate hold, stack and thread variants when their relevant spec ships.

```
src/components/<kebab-case>/
  <kebab-case>.tsx          # implementation, module-level styles
  <kebab-case>.stories.tsx  # CSF3 + play tests
  index.ts                  # re-exports component + types
src/utils/                  # shared helpers: renderable, use-controlled-state, use-latest-callback, collection-registry, part-id, roving-focus
src/overlay/                # internal: overlay-portal, overlay-layer, use-scroll-lock, use-native-dialog, use-overlay-floating — not exported
src/styling/                # styling modules (see list below); public API: styled, theme, JfraderTheme, SxProps; ThemeProvider/useTheme via theme-provider/
src/testing/                # story-only assertions (see list below)
```

Shared styling modules in `src/styling/` (reuse before writing a local copy):

- `css` — the styling seam (`css`, `keyframes`, types, Emotion's theme provider/hook).
- `sx` — `SxProps` and `WithSx`, which merges own styles, consumer `css` and `sx` for a part root.
- `theme` — the token `theme` and the Emotion `Theme` augmentation (public).
- `create-theme` — `createTheme`, `ThemeTokens` and `themeTokenStyle`; the custom-palette API (public).
- `theme-scope` — ThemeRoot's scope context (`useThemeScope`), the `appearance` axis
  (`AppearanceScope`), `themeScopeStyle` and `ThemeBoundary` for portaled content.
- `styled` — re-export of `@emotion/styled` for apps (public; never used by components).
- `media` — `REDUCED_MOTION`, `FORCED_COLORS` and `REDUCED_TRANSPARENCY` query keys; payloads stay
  component-local.
- `focus-ring` — `focusRingOutset` / `focusRingInset` declarations; the selector stays local.
- `visually-hidden` — screen-reader-only text.
- `disclosure-caret` — `disclosureCaret` (the triangle: border-drawn, currentColor, with its forced-colors override) and `disclosureCaretInlineSize` (the glyph's inline size). A component owns the pseudo-element it draws on, the rotation and the reduced-motion override.
- `icon-wrapper` — sizes a decorative icon to the surrounding font size.
- `loading-ring` — spinning ring and its reduced-motion pulse (Button, Spinner).
- `surface` — `raisedSurface` panel, the surface appearance helpers and `modalShellReset` for native
  `<dialog>` shells.
- `components/surface/surface-root` — private root seam shared by Surface, Card, Drawer.Panel,
  BottomSheet.Panel, Dialog.Panel and DialogStack.Content: separates
  default material from retained host structure, resolves inherited appearance once, carries
  same-theme tokens, merges root props and style lanes, composes refs with cleanup, and diagnoses
  missing/non-div refs, roots outside their owning shell/stage and changed replacement identity.
  Each adopts `slots.root`; Card also exposes
  header/title/description/content/footer replacement slots alongside its anatomy `slotProps`.
  Card interior replacements forward all received props/ref and retain the supplied className.
  Root replacements own
  material, forward all received props to one div, and apply their styles before the supplied
  className. Declare component types outside render; first-render inline functions cannot be
  reliably diagnosed. Scope/style updates must preserve the root and descendant identity.
  Native Content refs/styles/events remain on the dialog shell. Plain Dialog.Content children
  get one default Dialog.Panel; explicit composition accepts one direct Panel through fragments,
  without substantive siblings. DialogStack keeps its stage-directed portal inside a declaration-site
  ThemeBoundary. Host motion/measurement inline styles are reserved from ordinary root props.
- `components/viewer-chrome/viewer-chrome` — private media-viewer chrome shared by LightboxGallery and
  PhotoGrid: `ChromeAction` (ghost icon Button with a `focusVisibleOnly` tooltip, optional
  `aria-pressed`; unportaled inside a modal dialog, `portaled` elsewhere), the stroke glyphs and the
  thumbnail-strip styles.
- `trigger-style` — overlay trigger button (Dialog, Popover, Menu).
- `listbox-style` — popup surface, item and option fragments (Menu, Select, Combobox, CommandPalette).
- `input-control` — text-input control skin (TextField, Textarea).
- `choice-control` — root, row and hidden-input fragments (Checkbox, Switch, RadioGroup.Radio).
- `layout-style` — `flexLayoutStyles` (Flex, Stack) and the layout space scale (Container).
- `motion-timings` — `motionDurationMs`, the numeric side of the duration tokens for Motion and timers.

Shared story assertions in `src/testing/` (reuse before writing a local copy):

- `design-assertions.ts`: `auditDesign` checks native-control typography, painted text/background/border
  colors against the scoped token palette (including token-only `color-mix` derivations), and corner
  radii against the token scale. Zero and circular `50%` radii are valid. The Storybook Vitest setup
  runs it after every story in the new component families, including portaled family parts. Hidden
  elements have typography checked but no paint checks; SVG artwork and shadows are outside this guard.
  `pnpm test` includes the guard and its deliberately invalid browser fixtures. Run
  `pnpm --filter @jfrader/storybook verify:design` for the scoped family suite; no dev server is needed.

- [motion-assertions.ts](packages/ui/src/testing/motion-assertions.ts):
  `settleMotion`, `expectEntranceMotion`, `expectRetainedExit`.
  `settleMotion` excludes infinite animations.
- [theme-assertions.ts](packages/ui/src/testing/theme-assertions.ts):
  `expectThemedSurface`, `expectContrastSurface`.
- [geometry-assertions.ts](packages/ui/src/testing/geometry-assertions.ts):
  `expectInside`, `expectAligned`, `expectMirrored`, `expectNoOverlap`, `expectMirroredDirection`.
  Measures transformed viewport rectangular boxes, not curved silhouettes; failures include measures.

- PascalCase components, `<Name>Props` types, explicit public exports; helpers stay private.
- Storybook groups components by the `storySort` order in `apps/storybook/.storybook/preview.tsx` (`Home`,
  `Foundations`, `Inputs`, `Pickers`, `Data display`, `Data`, `Media`, `Feedback`, `Navigation`,
  `Surfaces`, `Layout`, `Actions`, `Games`, `Showcase`). A new section is added there
  and to this list in the same change.
- Story files for the same component within a section share one `title`, even when integration
  fixtures live in separate files. Keep their export names unique and their existing docs/sidebar tags.
- React 19 ref-as-prop: components are plain functions reading `ref` from props typed with
  `ComponentPropsWithRef<'el'>`; never `forwardRef`. Every public component and compound part sets a
  dotted `displayName` (`Dialog.Trigger`) so DevTools and Storybook code panels show the public name.
- `data-ui="<name>"` on every component root (and `data-ui="<name>-<part>"` on compound parts).
  Composed roots retain deduplicated identity tokens; use `[data-ui~="<name>"]` selectors.
  Surface uses `data-surface-variant`, leaving host `data-variant` untouched.
- One folder per component; `field/` and `thread/` hold shared internal anatomy rather than public components. A shared hook only when a second consumer exists.
- The package index re-exports components + types with `export *`, plus the styling API (`styled`,
  `theme`, `ThemeProvider`, `useTheme`, `createTheme`, `themeTokenStyle`, `SxProps`). `theme-provider/` has no `index.ts`, so it gets
  no subpath export.

## 5. State ownership recipe

Lives at `src/utils/use-controlled-state.ts`. Tabs and Dialog use it; do not hand-roll a third copy.

```ts
// value === undefined means uncontrolled; internal state seeds from defaultValue.
const [current, requestChange] = useControlledState<T>(valueProp, defaultValue, onChange);
// requestChange: dedupes against the current value, commits internally only when uncontrolled,
// and always notifies through onChange when the value actually changes.
```

Pitfalls this pattern exists to avoid:

- Do not notify when the value did not change (controlled stories assert exact call counts).
- Do not commit controlled state visually before the parent updates the prop.
- Do not derive state in effects; handle it in the initiating interaction.
- Do not switch modes during an instance's lifetime — mode is detected per render but switching is
  unsupported and untested (consumer constraint).
- Native checkboxes have a second state axis (`indeterminate` DOM property): sync it in an effect and
  restore it on activation while the controlled prop remains set.

## 6. Accessibility quick reference (the patterns we ship)

| Component | Role/semantics | Keyboard | Focus |
| --- | --- | --- | --- |
| Button | native `button`, `aria-busy` while loading (`aria-disabled`, stays focusable) | Enter, Space activate once; `disabled` blocks | focus-visible ring; loading keeps focus |
| TextField | native `input`; label `htmlFor`, `aria-describedby` = description + error, `aria-invalid`; error `role="alert"` | native editing, Tab in/out | ring on the input (border + outline) |
| Checkbox | native `input[type=checkbox]`; `aria-checked="mixed"` while indeterminate | Space toggles once; label click toggles | ring on the visual box via `input:focus-visible + span` |
| Switch | native checkbox `role="switch"`; binary only, never mixed; accessible label must not change with its state | Space toggles once | ring on the track |
| Tabs | `tablist`/`tab`/`tabpanel` with `aria-controls`/`aria-labelledby`/`aria-selected`; roving tabindex on the **focused** tab (falls back to selected, then first enabled) | horizontal/vertical arrows (RTL-aware), Home/End; `auto` activation selects on focus, `manual` needs Enter/Space; Tab exits into the active panel | the focused tab carries the ring (it may be unselected in manual mode); panels keep state while hidden. Caveats: auto activation requires negligible panel latency; keeping focus on an unselected tab in manual mode is an intentional variation from the APG default; non-focusable panels belong to the tab sequence |
| Dialog | native `<dialog>.showModal()` + `aria-modal`; `aria-labelledby`/`describedby` merged from Title/Description when present (`withDescription={false}` opts out) | Escape closes via one Root-owned path; backdrop click only when it targets the dialog element | focus moves inside on open, returns to the invoker on close or unmount; background inert via top layer |
| Popover | `role="dialog"` (non-modal) via `useRole`; trigger `aria-haspopup="dialog"`/`aria-expanded`/`aria-controls`; name via `aria-labelledby` (preferred) or `aria-label` | Enter/Space toggle; Escape closes; outside press closes | non-modal focus management preserves page tab order (`modal={false}`, no initial focus, `returnFocus={false}`, no trap); Escape returns focus to the trigger only after an accepted close; outside press never moves focus |
| Tooltip | `role="tooltip"`; trigger `aria-describedby` (merged with consumer ids) while open | hover (open/close delays), focus-visible opens; Escape closes | never focusable or interactive; hoverable per WCAG 1.4.13 (the content keeps it open); focus stays on the trigger. (APG Tooltip remains a work-in-progress pattern without task-force consensus.) |
| Menu | `menu`/`menuitem` (`aria-disabled` for disabled), menu labelled by the trigger; trigger `aria-haspopup="menu"`/`aria-expanded`/`aria-controls` | Enter/Space/ArrowDown open on first enabled item, ArrowUp on last; arrows wrap and skip disabled (**intentional APG deviation**: APG keeps disabled items focusable but non-activatable; ours are skipped and stay in the list so pointer users still see them); Home/End; typeahead (`resetMs: 500` is our configured value; upstream default is 750ms); Escape closes; Tab out of the content closes (**intentional APG deviation**: APG closes on Shift+Tab too; Shift+Tab from the first item returns to the trigger, where the menu stays open and Tab re-enters — revisit on screen-reader feedback) | `FloatingFocusManager modal={false}` (`returnFocus` off); pointer open also focuses the first item; an accepted Escape/selection restores focus to the trigger explicitly — outside press and Tab-out never move focus |
| Toast | text-only `status`/`alert` live region with explicit `aria-atomic`; interactive controls sit outside it; imperative queue via `useToast()` | Tab between controls; Enter/Space activate | appearing never moves focus; hover/focus pauses auto-dismiss; removing a focused toast continues focus to the next toast's dismiss button; closing toasts are inert |
| Accordion | `h3` heading wrapping a native button (`aria-expanded`/`aria-controls`); panel is `role="region"` + `aria-labelledby`, kept mounted, `hidden` when closed | Enter/Space toggle; ArrowUp/Down wrap between enabled headers; Home/End | focus ring on the trigger; disabled triggers (Item or Trigger) are skipped and non-activatable |
| Select | select-only combobox: `role="combobox"` trigger + portaled `listbox` with **virtual focus** (`aria-activedescendant`; DOM focus never leaves the trigger) | Enter/Space/ArrowDown open on the selected/first enabled option; arrows + Home/End move the highlight; typeahead (500ms buffer, continues across opening); Enter/Space select; Escape closes without selecting; Tab closes | never moves DOM focus; `value` and `open` are independent controlled axes; hidden input carries the form value |

Overlay family contracts (Popover/Tooltip/Menu follow these):

- **Modal dialog:** top layer or equivalent inert background; focus contained; Escape closes; focus
  returns on close. Native `<dialog>` lifecycle: every native close (`<form method="dialog">`,
  `.close()` through the `ref`) is reconciled into `onOpenChange`; only lock scroll after `showModal()`
  succeeds.
- **Native dialog motion:** a full-viewport shell that slides a child panel uses `overflow: clip`,
  never `hidden` — a hidden-overflow dialog is still a scroll container, so focus landing on the
  offscreen panel scrolls the shell and cancels the travel on screen. Enter/exit go through
  `useNativeDialog`'s transition: a logical close keeps the dialog open (modal, scroll-locked)
  until the exit settles; reduced motion returns no exit and closes at once.
- **Dialog cancel semantics:** `onCancel` is the *close request* (cancelable) and `onClose` the
  *completed closure*. React bubbles both, unlike native DOM — nested handlers must check the
  originating dialog (`event.target === dialogElement`). A consumer `preventDefault()` on `cancel`
  vetoes closure only when the event is cancelable; platform close requests can be noncancelable
  (CloseWatcher safeguards), so never promise a veto for every path and always reconcile `close`.
  `requestClose()` must be feature-detected; a plain `.close()` fallback does **not** dispatch a
  native `cancel`, so provide equivalent veto semantics or document the difference.
- **Non-modal popover:** preserve the page tab order across the portal with non-modal focus
  management (`FloatingFocusManager modal={false} initialFocus={-1} returnFocus={false}`), but no
  trap and no initial focus; Escape returns focus to the trigger only after an accepted close; a
  focus-out dismissal must **not** restore focus.
- **Tooltip:** never focusable, no interactive content, activated by hover **and** keyboard focus,
  dismissed by Escape, wired with `aria-describedby`; hoverable per WCAG 1.4.13 — the content stays
  open while the pointer rests on it (never `pointer-events: none`), with generous timing.
- **Menu:** opening moves focus to the first item (or the typeahead match); arrows move, typeahead
  jumps, Home/End optional; Escape closes and returns focus to the trigger; Tab out of the content
  closes and lets focus move on. Two **intentional APG deviations** (keep the behavior; revisit on
  screen-reader feedback): (1) APG closes the menu on both `Tab` and `Shift+Tab`; we keep it open
  when Shift+Tab leaves from the first item, so focus lands on the trigger and Tab re-enters;
  (2) APG keeps disabled items focusable but non-activatable; ours are skipped by arrows and stay in
  the list, so pointer users still see them.
- **Overlay motion (house pattern):** every native dialog animates through `useNativeDialog`'s
  `NativeDialogTransition` (above); there is no second exit mechanism. Spring-driven surfaces
  (Drawer, BottomSheet) pass their own enter/exit. Styled surfaces (Dialog, CommandPalette,
  LightboxGallery) pass `styledDialogTransition` (`overlay/exit-motion.ts`): entrances are CSS
  transitions from `@starting-style`, exits return to the same values under the hook's
  `data-state="closing"`, and the native close waits for them (`exitMotionFinished`), so focus
  returns then. A floating surface that unmounts (`useExitPresence`: DateRangePicker) waits the same
  way while mounted, `inert` and `aria-hidden`. Fragments live in `styling/overlay-motion.ts` and
  move only `opacity`/`scale`/`translate`. A closing layer is no longer open, so topmost-layer
  dismissal already skips it; close requests during a dialog's exit are absorbed. Native closure
  (`<form method="dialog">`, ref `.close()`) stays immediate. Reduced motion zeroes the
  transitions, so both directions are instant.
- **Nesting:** only the topmost layer handles Escape/outside-dismiss; opening a child layer keeps the
  parent intact.
- **Nested overlays and the top layer:** a body portal does not enter the native top layer; render
  child overlays inside the active modal's DOM/top-layer subtree so they are neither inert nor
  obscured.
- **With `@floating-ui/react`:** use its interaction prop getters and `useRole`/`FloatingFocusManager`
  deliberately (`modal={false}` for tooltips/popovers, deliberate initial focus for menus); scope
  focus reads and scroll locks to the floating element's `ownerDocument`; disable positioning
  middleware when the surface is closed. Native `menu`/`listbox` roles need explicit item roles
  through the getters. Keep `FloatingPortal` (via `OverlayPortal`) with its default
  `preserveTabOrder` — the focus manager depends on it; a bare custom portal is not a substitute.
- **Initial focus:** the JSX spelling is `autoFocus` on the intended descendant; the browser's dialog
  focus algorithm honors the attribute (there is no universal "first input" guarantee). React calls
  `focus()` on mount instead of rendering the attribute, so inside a native `<dialog>` that mounts
  closed, set the `autofocus` attribute through a ref (see CommandPalette).
- **Platform adoption notes (docs verified 2026-10-11):** use `dialog.requestClose()` for close
  affordances so they share cancel semantics (Baseline since May 2025; fall back to a state close
  on older Safari — see the cancel-semantics bullet). `closedby` is *not* Baseline (Safari preview) —
  keep manual backdrop handling. `@starting-style` entry transitions and `transition-behavior`
  (`allow-discrete`, Baseline since August 2024) are available; the limited-availability part of
  top-layer **exit** animation is the `overlay` property — ship exit transitions only with
  per-browser testing. `:user-invalid` is Widely Available for post-interaction native validation.
  `field-sizing: content` (Baseline June 2026) is the right tool if a future Textarea autosizes.
  CSS anchor positioning reaches Baseline per property (`anchor-name` / `position-area` /
  `position-try` January 2026; `position-anchor` September 2026); `@floating-ui/react` remains the
  choice for behavior and support. `color-mix()` (since May 2023) and `light-dark()` (since May 2024)
  are available for token derivation, but `light-dark()` follows `color-scheme`, not `data-theme` —
  tokens stay the theming contract.

## 7. Testing requirements (definition of done, expanded)

Stories are CSF3 (`satisfies Meta` / `StoryObj`). Storybook's CSF Next factory API
(`definePreview` → `meta.story`) exists in preview; this repo stays on CSF3 unless a migration is
explicitly approved.

Use the shared assertions listed in [section 4](#4-file-and-naming-conventions) for motion,
theme and geometry play tests. For browser measurements, use
[measure-geometry.mjs](apps/storybook/scripts/measure-geometry.mjs) with Storybook running.
It is a check: contract violations or measurement errors return a nonzero exit code.
Example from the GameTable alignment measurements, run from `apps/storybook`:

```sh
node scripts/measure-geometry.mjs games-gametable--wide-large-dark \
  --surface '[data-ui="theme-root"]:nth-child(2) [data-game-surface]' \
  --items '[data-ui="theme-root"]:nth-child(2) [data-ui="game-table-seat"]' \
  --viewport 1440x900 --base-url http://localhost:6019
```

When porting geometry, keep fixtures with source paths and commit provenance, independent of the port.
Compare against them; see [GameTable fixtures](packages/ui/src/components/game-table/reference-fixtures.ts).

Per component (all in the colocated stories file):

1. **States**: default, sizes/variants, disabled, error/invalid, checked/mixed, light theme
   (`globals: { theme: 'light' }`), plus the component's edge states. If a state is only visible while
   open (dialogs, overlays), give it a persistent-open story so the axe gate sees it.
2. **Keyboard play test**: `userEvent.tab()`/`keyboard()` for every prescribed key; assert
   `ownerDocument.activeElement`, non-`none` focus outline, callback order/counts, and exactly-once
   activation. Include the backward/rejected cases, not only the happy path.
3. **ARIA wiring**: role/name queries; id relationships (`aria-describedby` contains internal +
   external ids); `aria-invalid`/`required`; mixed state (DOM property **and** `aria-checked`).
4. **Regression stories for defects**: boolean/zero ReactNode content, external ARIA composition,
   post-activation state consistency, rejected controlled requests, native lifecycle paths
   (form-closed dialogs), dimension assertions (`getBoundingClientRect`) where size is contract.
5. **Timing**: before reading computed styles, wait for the component's transition duration (current
   tokens: 120/160/240ms) or disable motion in the test; never assert a mid-transition value.
6. **Axe**: the global gate must pass for every story. It is `test: 'error'` with the WCAG 2.0–2.2 AA
   + best-practice ruleset (`apps/storybook/.storybook/preview.tsx`). It runs after play completes,
   on the state present at the end — that is why persistent-open/state stories exist; open, error,
   selected or other states closed or replaced before play ends need their own story. axe-core
   detects ~57% of WCAG issues on average; a green gate is not accessibility verification.
7. **Play mechanics**: use `canvas` and the play-context `userEvent`; import `expect`, `fn` and
   helpers from `storybook/test`; await every `userEvent` call and instrumented assertion; spies
   belong in args via `fn()`.
8. **Focus assertions are regression assertions**: a non-`none` computed outline does not prove
   visible focus; Focus Appearance (2.4.13) is AAA and has no axe rule. Manual checks also cover
   Focus Not Obscured (sticky/overlay content must not wholly hide the focused control).
9. **Target size**: axe `target-size` checks unobscured size **and** spacing (WCAG 2.5.8, 24×24 CSS
   px); our 32px+ main-axis policy is stricter library policy, not the normative requirement.
10. **Retries stay 0**: keep Vitest's default whole-test retries at zero for regression gates;
    `findBy*` retries are query-level retries and do not prove a failure was fixed.
11. **Scoped runs** from the repo root (tokens already generated): `pnpm --filter @jfrader/storybook exec vitest run --project=storybook --maxWorkers=2 packages/ui/src/components/<name>/<name>.stories.tsx`
    (append `-t '<regex>'` to narrow). Full `pnpm test` before finishing.
12. **Snippets**: default `source.type: 'auto'` produces dynamic snippets when the story renders with
    args; prefer args-based render functions, and use story-level `parameters.docs.source.code` for
    complex examples (GURI-2129 pattern: usage snippet, never the play block).
13. **Standalone Testing Library** (only for future non-Storybook tests): RTL 16.3.3 supports React
    19 and needs `@testing-library/dom` as peer; use `act` from `react` for manual update flows;
    never suppress act warnings.
14. **Build**: `pnpm typecheck`, `pnpm test`, `pnpm build` green.

Manual gates before calling a component 1.0 (record what was and wasn't tested):

- Keyboard-only pass in a real browser (order, every key, no duplicate activation, visible focus).
- Screen-reader smoke test (NVDA+Firefox or VoiceOver+Safari): name, state, description, error,
  modal title and containment.
- Forced-colors, reduced-motion and RTL spot checks.
- axe finds ~57% of WCAG issues on average; never present a passing axe run as accessibility
  verification.

## 8. Review checklist (use for every batch)

### Documentation writing spec

Write for someone choosing and using a component. Say what it does and what to do next.
This applies to Storybook, public JSDoc, examples, READMEs, and consumer guides.

**Component introduction**

- Explain enough for the reader to choose and use the component. Keep the purpose easy to find.
- Start with the action or result: “Choose a date”, “Show progress toward a goal”.
- Use everyday words. Leave props, DOM roles, state ownership, and implementation details for
  usage notes or the prop table.
- Use nouns and verbs instead of adjectives. Omit praise such as “powerful”, “flexible”,
  “seamless”, “intuitive”, and “beautiful”. Keep words required to name an API state or type,
  such as `disabled` or “plain text”.
- Use paragraphs, headings, or lists when they make the explanation easier to follow.

MentionInput's introduction: “Write a message and mention people with @ or channels with #.”

**Details and examples**

- Put the introduction in `parameters.docs.description.component` as a string or template literal.
  Put any usage notes in `parameters.docs.usage` as Markdown. The shared docs page shows
  those notes in a “Usage notes” disclosure after the first example.
- Group notes by the question they answer: Keyboard, Values, Forms, or Limits. Include only
  sections the component needs. Use short bullets or paragraphs, one point at a time.
- Preserve requirements, defaults, units, callback order, keyboard behavior, and limits.
  Shortening prose must not remove a condition or turn an untested behavior into a guarantee.
  Put a warning that changes how someone uses an example beside that example or prop too.
- Describe each story's difference or the action to try. Skip “This story demonstrates” and
  test-result narration. Story JSDoc appears in the docs; keep test rationale in code comments.
- Docs pages render every story of a component at once. Keep an overlay whose initial state covers
  the page out of that page: render it inside its own demo surface (`contained` with a positioned
  host), or exclude the story with `tags: ['!autodocs']` when the overlay has no contained mode.
  `pnpm --filter @jfrader/storybook verify:docs:layout` checks the rendered pages.
- A docs page renders every non-!autodocs story, so NO story may mount with an open overlay: every open-on-mount story (`defaultOpen`/`open: true`, or hardcoded in render) carries `tags: ['!autodocs']`. Readers open the frames' triggers themselves; overlays must never appear by themselves.
- Prop JSDoc starts with what the prop changes. Add a default, unit, or exception when needed.
  Keep API names exact and use backticks around them.
- Prefer “Press Escape to close” to “Escape dismissal is supported”. Address the reader as
  “you” when needed. Avoid semicolon chains, sales copy, reassurance, and design justification.
- Keep each fact in one home. Link to setup or QA instructions instead of copying them into
  every description. Code examples should show usage, not test fixtures.
- Style example and guide code with `styled` components over tokens, not with `css` props or inline
  style objects. A snippet is a pattern a reader copies.
- Keep foundation-guide content in Markdown and render it through `apps/storybook/home/Guide.tsx`.
  Use the library's `CodeBlock` with syntax highlighting for source examples and
  `TypewriterTerminal` for shell commands. Commands start fully visible; playback is opt-in.
  Isolate these components from Storybook's prose styles with `Unstyled`. Add other components
  only when they help a reader use the API, and keep example text in the Markdown source.
  For a named file, add `filename="path/to/file.tsx"` after the fence language.

**Documentation review**

Read every changed introduction, usage note, story description, and public JSDoc comment.
Remove repetition, adjectives, and filler. Check the rewrite against the previous contracts.
Run `pnpm verify:docs` to check that component stories declare nonempty documentation.
Length, sentence count, and prose formatting are editorial choices, not build gates.
Review clarity and completeness in context. Open the rendered docs, try the usage
disclosure with the keyboard, and check the first example and prop table still appear.

**What consumers of these stories assume**

- **A story that measures its own width will not get a shrink-wrapped canvas.** The default example surface is a block lane; only `layout: 'centered'` shrinks to fit. A component that measures a probe or a lane to compute its expanded size (as ExpandingSearch does) must not depend on being shrink-wrapped, or it will compute its collapsed size and never grow.
- **Do not hide the only rendered state behind `play`, `beforeEach`, `loaders` or `viewport`.** Consumers that render stories as documentation do not execute them or emulate the viewport, so a state that exists only after an interaction shows as an empty or bare example. Render the state directly (an `open`/`defaultOpen` variant), or exclude the story with `tags: ['!autodocs']`.
- **Keep self-contained visual examples published.** If setup only makes `play` assertions deterministic, keep the setup-free render in docs and move the setup-dependent assertions to an `!autodocs` companion. Exclude a visual example only when its render itself requires that setup; verify restored frames in the built docs and preserve their assertions.
- **Author `parameters.docs.source.code` when the anatomy matters.** Consumers can derive a snippet from a story's `args`, and some read the story's own JSX, but neither can describe a compound: an args-derived snippet cannot invent `Dialog` + `Dialog.Content` + `Dialog.Footer`, and an extractor stops at conditional or multiple returns and at maps over data it does not define. A single literal JSX return per story, or an authored `source.code` (with `source.language`), is what makes a usable code example.
- **Examples are style-isolated from the page around them.** A story that renders bare `<a>`, `<code>`, `<table>`, `<h3>` or `<li>` elements gets the browser's defaults, not the host's typography — a raw link inside an example renders in the user agent's blue. Use the library's own components inside examples, and style anything you render raw.
- **A story's `name:` is what readers see in navigation and in the page's table of contents.** Keep display names unique per component; when two stories share one, consumers have to disambiguate them. A component that renders its own `h3` headings will also have those headings confused with the page's sections unless the consumer filters them out.
- **A component's page opens with one story chosen for it, and a state or environment story is not it.** Consumers pick a primary or rich composition and skip `Loading`, `Disabled`, `Error`, `RTL`, `ForcedColors`, `Keyboard…`-style states. Keep one obvious primary story per component so that choice is deliberate rather than accidental.

**Maintenance prose**

- A story description describes the state a reader sees, never the test that guards it. Frame-counting rules, assertion narration and pixel checks belong in comments beside the assertions.
- Never compare against an unnamed "old reference", and never justify a removal ("deliberately removed"). State the current contract.

### Component review

- [ ] Need + API approved; no duplicate component; contract worksheet filled.
- [ ] Controlled/uncontrolled matrix incl. falsy values, rejected controlled requests, callback
      count/order, external prop updates, reset behavior.
- [ ] ARIA merge behavior; name/description/error wiring; id validity (values embedded in ids are
      encoded/sanitized).
- [ ] Focus: keyboard reachability, ring visibility, trap/return, hidden-input pattern.
- [ ] Contrast math for any new color pair (text ≥4.5, non-text ≥3) in both themes.
- [ ] Tokens only; no generated files edited; `pnpm generate` run after token changes.
- [ ] Stories + play tests per section 7; dimensions/regressions covered.
- [ ] Performance: module-level styles, stable context values, explicit transition properties.
- [ ] Docs surfaces updated and reviewed against the writing spec above; `pnpm verify:docs` passes.
- [ ] Every claimed check actually run; unverified items listed honestly.

## 9. Maintenance

- **Fixes**: reproduce with a failing story/play test first, then fix, then keep the test.
- **Token changes**: edit `packages/tokens/src/tokens.ts` (base + light), `pnpm generate`, rerun
  typecheck/test/build; never edit generated `vars.ts`/`tokens.css`.
- **API changes**: additive = minor, fix = patch, breaking = deprecate first (`@deprecated` JSDoc with
  the replacement, example, and removal plan). Consumers wrap components to customize; we do not add
  style-override registries.
- **Dependencies**: `AGENTS.md` owns the allowlist, including runtime, optional-peer and
  development-only import boundaries. Update it before adding any other dependency.
- **Compound part naming stays consistent** across components: callable roots (`Tabs`, `Dialog`) with
  the same part names — `Trigger`, `Content`, `Title`, `Description`, `Close`, `List`, `Tab`, `Panel`.
- Keep `SKILL.md`, `AGENTS.md`, `PLAN.md` and `README.md` status in sync in the same change that
  invalidates them.

## 10. References

- APG patterns: [Button](https://www.w3.org/WAI/ARIA/apg/patterns/button/), [Checkbox](https://www.w3.org/WAI/ARIA/apg/patterns/checkbox/), [Switch](https://www.w3.org/WAI/ARIA/apg/patterns/switch/), [Tabs](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/), [Dialog](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/), [Tooltip](https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/), [Read me first](https://www.w3.org/WAI/ARIA/apg/practices/read-me-first/)
- WCAG 2.2 Understanding: [Non-text contrast 1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html), [Content on hover 1.4.13](https://www.w3.org/WAI/WCAG22/Understanding/content-on-hover-or-focus.html), [Focus not obscured 2.4.11](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html), [Target size 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
- Axe coverage: [axe-core](https://github.com/dequelabs/axe-core) · Emotion: [performance](https://emotion.sh/docs/performance), [best practices](https://emotion.sh/docs/best-practices) · React: [useContext](https://react.dev/reference/react/useContext), [you might not need an effect](https://react.dev/learn/you-might-not-need-an-effect), [preserving and resetting state](https://react.dev/learn/preserving-and-resetting-state)
- Base UI: [composition/render](https://base-ui.com/react/handbook/composition), [mergeProps](https://base-ui.com/react/utils/merge-props) · Floating UI: [FloatingFocusManager](https://floating-ui.com/docs/floatingfocusmanager) · GOV.UK: [text input](https://design-system.service.gov.uk/components/text-input/) · Carbon: [component checklist](https://carbondesignsystem.com/getting-started/contributing/component-checklist/) · Storybook: [interaction testing](https://storybook.js.org/docs/writing-tests/interaction-testing), [accessibility testing](https://storybook.js.org/docs/writing-tests/accessibility-testing)
