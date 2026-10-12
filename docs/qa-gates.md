# Manual QA gates

Run before marking a component 1.0. Start Storybook with `pnpm dev` and open each story at `http://localhost:6006`.

## Automated gates

| Command | Gate |
| --- | --- |
| `pnpm typecheck` | Generate tokens and typecheck every workspace package, including `apps/pilot`. |
| `pnpm test` | Generate tokens and run Storybook play tests in headless Chromium; axe fails on WCAG 2.0–2.2 A/AA + best-practice violations (`a11y.test: 'error'`). |
| `pnpm --filter @jfrader/storybook exec vitest run --project=storybook --maxWorkers=2 <story-file>` | Scoped story run with the same axe gate. |
| `pnpm verify:exports` | Check every public UI component folder has a subpath export and every source export target exists; this does not validate built artifacts or root-index coverage. |

The source export check is `scripts/verify-exports.mjs`, not a Storybook test. Built export targets are validated by `scripts/flip-exports.mjs dist` after building the packages (see [packing packages](../README.md#packing-packages)). A passing axe gate does not replace the manual checks below.

## Gates

- **Keyboard**: Use only the keyboard. Tab through the story in Firefox and Safari, press every key in the keyboard map documented in the component's stories, check order, single activation and a visible focus ring.
- **Screen reader (SR)**: NVDA + Firefox (Windows) or VoiceOver + Safari (macOS); check name, role, state, description, error, and for modals the title and focus containment.
- **Forced colors**: Windows Settings → Accessibility → Contrast themes → any theme, open the story in Edge; or Chrome DevTools → Rendering → Emulate CSS media feature `forced-colors: active`. Check focus ring, boundaries, selected/checked state and separators stay visible.
- **Reduced motion**: Chrome DevTools → Rendering → `prefers-reduced-motion: reduce`; open, close and toggle the component, check transitions stop and open/close/focus still complete.
- **RTL**: wrap the story in `<div dir="rtl">` (or set `dir="rtl"` on `<html>` in DevTools); check mirrored layout, arrow-key direction and directional glyphs.

## Recording

Replace `pending` with `pass YYYY-MM-DD <browser/AT>` or `fail: GURI-N (<issue title>)`. `auto:` lists what the test suite covers in headless Chromium, not a recorded test result. Manual checks remain pending, including the keyboard gate in Firefox and Safari.

## Results

| component | keyboard | SR | forced-colors | RTL | notes |
| --- | --- | --- | --- | --- | --- |
| accordion | pending; auto: Tab, ArrowUp/Down, Home/End, Enter, disabled skipped | pending | pending | pending | chevron uses `:dir(rtl)`; reduced motion pending |
| alert | pending; auto: Tab to dismiss, Enter, Space, focus ring | pending | pending | pending | reduced motion pending |
| avatar | n/a (non-interactive) | pending | pending | pending | |
| badge | n/a (non-interactive) | pending | pending | pending; auto: `RTL` story asserts marker on inline-end corner | |
| breadcrumbs | pending; auto: Tab order | pending | pending | pending | reduced motion pending |
| button | pending; auto: Tab, Enter, Space, focus ring | pending | pending | pending | loading state; reduced motion pending |
| calendar | pending; auto: arrows, Home/End, PageUp/PageDown, Shift+PageUp/PageDown, Enter | pending | pending | pending | forced-colors CSS present; arrows and nav glyphs under RTL untested; reduced motion pending |
| card | n/a (non-interactive) | pending | pending | pending | |
| checkbox | pending; auto: Tab, Space, focus ring | pending | pending | pending | mixed state; reduced motion pending |
| combobox | pending; auto: Tab, ArrowUp/Down, Home/End, Enter, Escape, Backspace | pending | pending | pending | virtual focus announcements; reduced motion pending |
| command-palette | pending; auto: ArrowUp/Down, Home/End, Enter, Escape, Backspace | pending | pending | pending | modal title and containment; reduced motion pending |
| date-picker | pending; auto: Tab/Shift+Tab, arrows, PageDown, Shift+PageDown, Enter, Space, Escape | pending | pending | pending | |
| dialog | pending; auto: focus moves in on open, returns to trigger (Escape simulated via `cancel` event) | pending | pending | pending | real Escape key; modal title and containment; reduced motion pending |
| divider | pending; auto: not in Tab order | pending | pending | pending | forced-colors CSS present |
| editable-details | pass 2026-10-12 Chromium, native Tab/Shift+Tab, disclosure, editor/overlay focus, real modal Escape; Firefox/Safari pending | pending | pass 2026-10-12 Chromium emulation | pass 2026-10-12 Chromium, mobile | reduced-motion emulation passed; 390px/1280px, light/dark; focused overlay recipe checks, not a complete visual/AT audit |
| field | pending | pending | pending | pending | internal anatomy; exercised through TextField/Textarea |
| kbd | pending; auto: not in Tab order | pending | pending | pending | |
| menu | pending; auto: Tab, Shift+Tab, Enter, Space, ArrowUp/Down, Escape, focus return | pending | pending | pending | reduced motion pending |
| navigation | pending; auto: Tab order, Enter | pending | pending | pending | forced-colors CSS present; disclosure glyph uses `:dir(rtl)`; reduced motion pending |
| pagination | pending; auto: Tab, Shift+Tab, Enter, Space | pending | pending | pending | prev/next glyphs use `:dir(rtl)`; reduced motion pending |
| pill | n/a (non-interactive) | pending | pending | pending | |
| popover | pending; auto: Tab, Enter, Escape, focus return | pending | pending | pending | |
| progress | n/a (non-interactive) | pending | pending | pending | forced-colors CSS present; indeterminate slide uses `:dir(rtl)`; reduced motion pending |
| radio-group | pending; auto: Tab, Shift+Tab, arrows | pending | pending | pending | forced-colors CSS present; arrows under RTL untested; reduced motion pending |
| search-field | pending; auto: Tab, typing, Escape clears nonempty, Enter submits form | pending | pending | pending | reduced motion pending |
| select | pending; auto: Tab, ArrowUp/Down, Home/End, Enter, Space, Escape | pending | pending | pending | virtual focus announcements; reduced motion pending |
| skeleton | n/a (non-interactive) | pending | pending | pending | shimmer reverses via `:dir(rtl)`; reduced motion pending |
| spinner | n/a (non-interactive) | pending | pending | pending | live region announcement; reduced motion pending |
| switch | pending; auto: Tab, Space, focus ring | pending | pending | pending | thumb uses `:dir(rtl)`; reduced motion pending |
| tabs | pending; auto: Tab, Shift+Tab, arrows, Home/End, Enter | pending | pending | pending | arrows under RTL untested; reduced motion pending |
| text-field | pending; auto: Tab, typing | pending | pending | pending | error alert announcement; reduced motion pending |
| textarea | pending; auto: Tab, Enter | pending | pending | pending | `autoResize` in Firefox and Safari; reduced motion pending |
| theme-root | n/a (non-interactive) | pending | pending | pending | |
| time-picker | pending; auto: Tab, Enter/Space/ArrowDown open, arrows, Home/End, typeahead, Enter, Escape, Tab closes | pending | pending | pending | virtual focus; reduced motion pending |
| toast | pending; auto: Tab, Shift+Tab, focus continues to next dismiss on removal | pending | pending | pending | live region announcement; reduced motion pending |
| toggle-group | pending; auto: Tab, Shift+Tab, arrows, Home/End, Enter, Space | pending | pending | pending; auto: `KeyboardRtl` story asserts ArrowLeft/ArrowRight swap | forced-colors CSS present; reduced motion pending |
| tooltip | pending; auto: Tab focus opens, Escape closes | pending | pending | pending | |

### Additional story-documented surfaces

These surfaces also have colocated stories included in `pnpm test`. No manual results or per-key coverage are recorded here yet; `pending` is not a failing automated result.

| component | keyboard | SR | forced-colors | RTL | notes |
| --- | --- | --- | --- | --- | --- |
| activity-rings | pending | pending | pending | pending | reduced motion pending |
| announcement-bar | pending | pending | pending | pending | reduced motion pending |
| avatar-group | pending | pending | pending | pending | reduced motion pending |
| billing-toggle | pending | pending | pending | pending | reduced motion pending |
| bottom-sheet | pending | pending | pending | pending | reduced motion pending |
| button-group | pending | pending | pending | pending | reduced motion pending |
| carousel | pending | pending | pending | pending | reduced motion pending |
| chat-thread | pending | pending | pending | pending | reduced motion pending |
| chip-group | pending | pending | pending | pending | reduced motion pending |
| code-block | pending | pending | pending | pending | reduced motion pending |
| comment-thread | pending | pending | pending | pending | reduced motion pending |
| container | pending | pending | pending | pending | reduced motion pending |
| context-menu | pending | pending | pending | pending | reduced motion pending |
| copy-button | pending | pending | pending | pending | reduced motion pending |
| countdown | pending | pending | pending | pending | reduced motion pending |
| date-range-picker | pending | pending | pending | pending | reduced motion pending |
| drawer | pending | pending | pending | pending | reduced motion pending |
| elastic-slider | pending | pending | pending | pending | reduced motion pending |
| empty-state | pending | pending | pending | pending | reduced motion pending |
| expandable-card | pending | pending | pending | pending | reduced motion pending |
| expanding-search | pending | pending | pending | pending | reduced motion pending |
| file-dropzone | pending | pending | pending | pending | reduced motion pending |
| filter-toolbar | pending | pending | pending | pending | reduced motion pending |
| flex | pending | pending | pending | pending | reduced motion pending |
| hold-to-confirm | pending | pending | pending | pending | reduced motion pending |
| hover-card | pending | pending | pending | pending | reduced motion pending |
| image-compare | pending | pending | pending | pending | reduced motion pending |
| inline-edit | pending | pending | pending | pending | reduced motion pending |
| json-viewer | pending | pending | pending | pending | reduced motion pending |
| keycap-keyboard | pending | pending | pending | pending | reduced motion pending |
| lightbox-gallery | pending | pending | pending | pending | reduced motion pending |
| mention-input | pending | pending | pending | pending | reduced motion pending |
| metric-card | pending | pending | pending | pending | reduced motion pending |
| multi-select | pending | pending | pending | pending | reduced motion pending |
| now-playing | pending | pending | pending | pending | reduced motion pending |
| password-field | pending | pending | pending | pending | reduced motion pending |
| photo-grid | pending | pending | pending | pending | reduced motion pending |
| radio-cards | pending | pending | pending | pending | reduced motion pending |
| resizable-panels | pending | pending | pending | pending | reduced motion pending |
| scroll-area | pending | pending | pending | pending | reduced motion pending |
| segmented-control | pending | pending | pending | pending | reduced motion pending |
| shortcut-recorder | pending | pending | pending | pending | reduced motion pending |
| signature-pad | pending | pending | pending | pending | reduced motion pending |
| slider | pending | pending | pending | pending | reduced motion pending |
| sortable-data-table | pending | pending | pending | pending | reduced motion pending |
| split-button | pending | pending | pending | pending | reduced motion pending |
| stack | pending | pending | pending | pending | reduced motion pending |
| stepper | pending | pending | pending | pending | reduced motion pending |
| stretch-refresh | pending | pending | pending | pending | reduced motion pending |
| swipe-actions | pending | pending | pending | pending | reduced motion pending |
| tag-input | pending | pending | pending | pending | reduced motion pending |
| theme-switch | pending | pending | pending | pending | reduced motion pending |
| timeline | pending | pending | pending | pending | reduced motion pending |
| toast-stack | pending | pending | pending | pending | reduced motion pending |
| tree-view | pending | pending | pending | pending | reduced motion pending |
| usage-meter | pending | pending | pending | pending | reduced motion pending |
| user-menu | pending | pending | pending | pending | reduced motion pending |
