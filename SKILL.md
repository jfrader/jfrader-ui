# SKILL.md — Creating and maintaining components in jfrader-ui

Operational guide for anyone (human or agent) creating, changing, or reviewing a component in this
library. Read `AGENTS.md` first for commands and the short conventions; this file is the deep guide.
Every rule here exists because something went wrong without it.

## 0. When this skill applies

- Creating a new component or a new part of a compound component.
- Changing a component's API, behavior, styles, or accessibility wiring.
- Reviewing a component batch before commit.
- Fixing an accessibility, performance, or state defect in a component.

Not for: application composition (consumers), token-only work, repo tooling. Those belong to
`AGENTS.md` / `PLAN.md`.

## 1. Read before writing

1. `AGENTS.md` — commands, repo conventions, dependency allowlist.
2. `PLAN.md` — architecture decisions and their reasons (append reconciliations, don't rewrite history).
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

### Styling and code

- **Tokens only.** Import typed references from `@jfrader/tokens/vars`. No raw colors, no magic pixel
  values where a token exists.
- **Module-level `css()` constants.** Never build style objects per render. Compose as
  `css={[base, variants[variant], slotProps?.x?.css, consumerCss]}` — consumer styles last.
- **The styling seam**: import `css`/`keyframes`/types only from `src/styling/css.ts`. Never from
  `@emotion/react` directly, never `styled()`.
- **State through attributes**: `:hover`, `[aria-disabled="true"]`, `[aria-invalid="true"]`,
  `[data-state]`, `:checked`, `:focus-visible` — not class soup.
- **Transitions list properties explicitly** (`background-color, border-color`), never `transition: all`.
  Declare `keyframes` at module scope.
- **Dynamic values** (progress, coordinates) go through inline CSS custom properties or `style`
  attributes, never through generated per-value classes.
- **Theming has two paths.** Apps set `data-theme` on `<html>`; `ThemeRoot` themes a scoped subtree
  (embedded widgets). Components read tokens only and never pick a theme themselves. Consumer setup
  lives in `docs/consuming-jfrader-ui.md`.
- **No deep descendant-chain styling.** Direct relations from the component's own DOM are fine
  (`input:checked + span`, `&[data-indeterminate] input + span svg`); avoid unrelated descendant
  selectors and tag-only chains beyond one level.

### Performance (author-level)

- Static styles serialized once at module scope; finite variant maps precomputed (`Record<Size, SerializedStyles>`).
- Context-heavy compound components: keep provider values stable (memoize the context object);
  split frequently-changing state from stable actions only when profiling shows fan-out.
- Do not add `memo`/`useCallback` ceremony by default — the repo does not assume React Compiler;
  optimize measured boundaries, not guessed ones.
- `will-change` only for a demonstrated rendering problem, removed afterwards.

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
6. **Customization surface** — `className` (root), `slotProps` for single widgets with internal
   parts, `render` for polymorphism (planned; do not add `asChild`).
7. **Environments** — RTL, reduced motion, forced colors, SSR/hydration notes.
8. **Lifecycle status** — new / stable / deprecated (with replacement).

## 4. File and naming conventions

```
src/components/<kebab-case>/
  <kebab-case>.tsx          # implementation, module-level styles
  <kebab-case>.stories.tsx  # CSF3 + play tests
  index.ts                  # re-exports component + types
src/utils/                  # shared non-styling helpers (renderable, use-controlled-state)
src/overlay/                # internal modules (scroll lock, future focus/top-layer helpers) — not exported
src/styling/                # internal styling modules — not exported (see list below)
```

Shared styling modules in `src/styling/` (reuse before writing a local copy):

- `css` — the styling seam (`css`, `keyframes`, types).
- `media` — `REDUCED_MOTION` and `FORCED_COLORS` query keys; payloads stay component-local.
- `focus-ring` — `focusRingOutset` / `focusRingInset` declarations; the selector stays local.
- `visually-hidden` — screen-reader-only text.
- `disclosure-caret` — inline-end caret for an `&::after`; rotation and reduced motion stay local.
- `icon-wrapper` — sizes a decorative icon to the surrounding font size.
- `loading-ring` — spinning ring and its reduced-motion pulse (Button, Spinner).
- `surface` — `raisedSurface` panel and `modalShellReset` for native `<dialog>` shells.
- `trigger-style` — overlay trigger button (Dialog, Popover, Menu).
- `listbox-style` — popup surface, item and option fragments (Menu, Select, Combobox, CommandPalette).
- `input-control` — text-input control skin (TextField, Textarea).
- `choice-control` — root, row and hidden-input fragments (Checkbox, Switch, RadioGroup.Radio).
- `layout-style` — `flexLayoutStyles` (Flex, Stack) and the layout space scale (Container).

- PascalCase components, `<Name>Props` types, explicit public exports; helpers stay private.
- React 19 ref-as-prop: components are plain functions reading `ref` from props typed with
  `ComponentPropsWithRef<'el'>`; never `forwardRef`. Every public component and compound part sets a
  dotted `displayName` (`Dialog.Trigger`) so DevTools and Storybook code panels show the public name.
- `data-ui="<name>"` on every component root (and `data-ui="<name>-<part>"` on compound parts).
- One folder per component; a shared hook only when a second consumer exists.
- The package index re-exports components + types with `export *`.

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
| Switch | native checkbox `role="switch"`; binary only, never mixed | Space toggles once | ring on the track |
| Tabs | `tablist`/`tab`/`tabpanel` with `aria-controls`/`aria-labelledby`/`aria-selected`; roving tabindex on the **focused** tab (falls back to selected, then first enabled) | horizontal/vertical arrows (RTL-aware), Home/End; `auto` activation selects on focus, `manual` needs Enter/Space; Tab exits into the active panel | the focused tab carries the ring (it may be unselected in manual mode); panels keep state while hidden |
| Dialog | native `<dialog>.showModal()` + `aria-modal`; `aria-labelledby`/`describedby` merged from Title/Description when present (`withDescription={false}` opts out) | Escape closes via one Root-owned path; backdrop click only when it targets the dialog element | focus moves inside on open, returns to the invoker on close or unmount; background inert via top layer |
| Popover | `role="dialog"` (non-modal) via `useRole`; trigger `aria-haspopup="dialog"`/`aria-expanded`/`aria-controls`; name via `aria-labelledby` (preferred) or `aria-label` | Enter/Space toggle; Escape closes; outside press closes | non-modal focus management preserves page tab order (`modal={false}`, no initial focus, `returnFocus={false}`, no trap); Escape returns focus to the trigger only after an accepted close; outside press never moves focus |
| Tooltip | `role="tooltip"`; trigger `aria-describedby` (merged with consumer ids) while open | hover (open/close delays), focus-visible opens; Escape closes | never focusable or interactive; hoverable per WCAG 1.4.13 (the content keeps it open); focus stays on the trigger |
| Menu | `menu`/`menuitem` (`aria-disabled` for disabled), menu labelled by the trigger; trigger `aria-haspopup="menu"`/`aria-expanded`/`aria-controls` | Enter/Space/ArrowDown open on first enabled item, ArrowUp on last; arrows wrap and skip disabled; Home/End; typeahead (500ms reset); Escape closes; Tab out of the content closes (Shift+Tab from the first item returns to the trigger, where the menu stays open and Tab re-enters) | `FloatingFocusManager modal={false}` (`returnFocus` off); pointer open also focuses the first item; an accepted Escape/selection restores focus to the trigger explicitly — outside press and Tab-out never move focus |
| Toast | text-only `status`/`alert` live region with explicit `aria-atomic`; interactive controls sit outside it; imperative queue via `useToast()` | Tab between controls; Enter/Space activate | appearing never moves focus; hover/focus pauses auto-dismiss; removing a focused toast continues focus to the next toast's dismiss button; closing toasts are inert |
| Accordion | `h3` heading wrapping a native button (`aria-expanded`/`aria-controls`); panel is `role="region"` + `aria-labelledby`, kept mounted, `hidden` when closed | Enter/Space toggle; ArrowUp/Down wrap between enabled headers; Home/End | focus ring on the trigger; disabled triggers (Item or Trigger) are skipped and non-activatable |
| Select | select-only combobox: `role="combobox"` trigger + portaled `listbox` with **virtual focus** (`aria-activedescendant`; DOM focus never leaves the trigger) | Enter/Space/ArrowDown open on the selected/first enabled option; arrows + Home/End move the highlight; typeahead (500ms buffer, continues across opening); Enter/Space select; Escape closes without selecting; Tab closes | never moves DOM focus; `value` and `open` are independent controlled axes; hidden input carries the form value |

Overlay family contracts (Popover/Tooltip/Menu follow these):

- **Modal dialog:** top layer or equivalent inert background; focus contained; Escape closes; focus
  returns on close. Native `<dialog>` lifecycle: every native close (`<form method="dialog">`,
  `.close()` through the `ref`) is reconciled into `onOpenChange`; only lock scroll after `showModal()`
  succeeds; a consumer `preventDefault()` on `cancel` vetoes closure.
- **Non-modal popover:** preserve the page tab order across the portal with non-modal focus
  management (`FloatingFocusManager modal={false} initialFocus={-1} returnFocus={false}`), but no
  trap and no initial focus; Escape returns focus to the trigger only after an accepted close; a
  focus-out dismissal must **not** restore focus.
- **Tooltip:** never focusable, no interactive content, activated by hover **and** keyboard focus,
  dismissed by Escape, wired with `aria-describedby`; hoverable per WCAG 1.4.13 — the content stays
  open while the pointer rests on it (never `pointer-events: none`), with generous timing.
- **Menu:** opening moves focus to the first item (or the typeahead match); arrows move, typeahead
  jumps, Home/End optional; Escape closes and returns focus to the trigger; Tab out of the content
  closes and lets focus move on (Shift+Tab from the first item returns to the trigger with the menu
  still open); disabled items are skipped by arrows but remain in the list.
- **Nesting:** only the topmost layer handles Escape/outside-dismiss; opening a child layer keeps the
  parent intact.
- **With `@floating-ui/react`:** use its interaction prop getters and `useRole`/`FloatingFocusManager`
  deliberately (`modal={false}` for tooltips/popovers, deliberate initial focus for menus); scope
  focus reads and scroll locks to the floating element's `ownerDocument`; disable positioning
  middleware when the surface is closed.
- **Initial focus:** put native `autofocus` on the intended descendant; the browser's dialog
  focus algorithm honors it (there is no universal "first input" guarantee).
- **Platform adoption notes (docs verified 2026-10-10):** use `dialog.requestClose()` for close
  affordances so they share cancel semantics (Baseline since May 2025; fall back to a state close
  on older Safari). `closedby` is *not* Baseline (Safari preview) — keep manual backdrop handling.
  `@starting-style` entry transitions are Baseline, but top-layer **exit** animation (transitioning
  `display`/`overlay`) is not — ship exit transitions only with per-browser testing. `:user-invalid`
  is Widely Available for post-interaction native validation. `field-sizing: content` (Baseline
  June 2026) is the right tool if a future Textarea autosizes. CSS anchor positioning's core is
  interoperable but the feature group is not Baseline — `@floating-ui/react` remains the choice.
  `color-mix()` / relative colors / `light-dark()` are available for token derivation, but
  `data-theme` + tokens stays the theming contract. Platform close requests can be noncancelable
  (CloseWatcher safeguards): never promise a veto for every path; always reconcile `close`.

## 7. Testing requirements (definition of done, expanded)

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
6. **Axe**: the global `a11y: { test: 'error' }` gate must pass for every story; open/error/selected
   states need their own stories or the gate never sees them.
7. **Build**: `pnpm typecheck`, `pnpm test`, `pnpm build` green.

Manual gates before calling a component 1.0 (record what was and wasn't tested):

- Keyboard-only pass in a real browser (order, every key, no duplicate activation, visible focus).
- Screen-reader smoke test (NVDA+Firefox or VoiceOver+Safari): name, state, description, error,
  modal title and containment.
- Forced-colors, reduced-motion and RTL spot checks.
- axe finds roughly half of real issues; never present a passing axe run as accessibility verification.

## 8. Review checklist (use for every batch)

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
- [ ] Docs surfaces updated (props/type exports, `llms.txt`/README status when relevant).
- [ ] Every claimed check actually run; unverified items listed honestly.

## 9. Maintenance

- **Fixes**: reproduce with a failing story/play test first, then fix, then keep the test.
- **Token changes**: edit `packages/tokens/src/tokens.ts` (base + light), `pnpm generate`, rerun
  typecheck/test/build; never edit generated `vars.ts`/`tokens.css`.
- **API changes**: additive = minor, fix = patch, breaking = deprecate first (`@deprecated` JSDoc with
  the replacement, example, and removal plan). Consumers wrap components to customize; we do not add
  style-override registries.
- **Dependencies**: the allowlist is `@emotion/react`, `@floating-ui/react`, `motion` (only when a
  component needs them). Update `AGENTS.md` before adding anything else.
- **Compound part naming stays consistent** across components: callable roots (`Tabs`, `Dialog`) with
  the same part names — `Trigger`, `Content`, `Title`, `Description`, `Close`, `List`, `Tab`, `Panel`.
- Keep `SKILL.md`, `AGENTS.md`, `PLAN.md` and `README.md` status in sync in the same change that
  invalidates them.

## 10. References

- APG patterns: [Button](https://www.w3.org/WAI/ARIA/apg/patterns/button/), [Checkbox](https://www.w3.org/WAI/ARIA/apg/patterns/checkbox/), [Switch](https://www.w3.org/WAI/ARIA/apg/patterns/switch/), [Tabs](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/), [Dialog](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/), [Tooltip](https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/), [Read me first](https://www.w3.org/WAI/ARIA/apg/practices/read-me-first/)
- WCAG 2.2 Understanding: [Non-text contrast 1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html), [Content on hover 1.4.13](https://www.w3.org/WAI/WCAG22/Understanding/content-on-hover-or-focus.html), [Focus not obscured 2.4.11](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html), [Target size 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
- Axe coverage: [axe-core](https://github.com/dequelabs/axe-core) · Emotion: [performance](https://emotion.sh/docs/performance), [best practices](https://emotion.sh/docs/best-practices) · React: [useContext](https://react.dev/reference/react/useContext), [you might not need an effect](https://react.dev/learn/you-might-not-need-an-effect), [preserving and resetting state](https://react.dev/learn/preserving-and-resetting-state)
- Base UI: [composition/render](https://base-ui.com/react/handbook/composition), [mergeProps](https://base-ui.com/react/utils/merge-props) · Floating UI: [FloatingFocusManager](https://floating-ui.com/docs/floatingfocusmanager) · GOV.UK: [text input](https://design-system.service.gov.uk/components/text-input/) · Carbon: [component checklist](https://carbondesignsystem.com/getting-started/contributing/component-checklist/) · Storybook: [interaction testing](https://storybook.js.org/docs/writing-tests/interaction-testing), [accessibility testing](https://storybook.js.org/docs/writing-tests/accessibility-testing)
