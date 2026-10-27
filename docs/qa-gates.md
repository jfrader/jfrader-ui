# Manual QA gates

Automation proves behavior, not that a component works with a keyboard, a screen reader, or a phone
width. Run these gates before calling a component 1.0, and record what you ran.

Start Storybook with `pnpm dev` and open each story at `http://localhost:6006`.

## Automated gates

| Command | Gate |
| --- | --- |
| `pnpm typecheck` | Generate tokens and typecheck every workspace package, including `apps/pilot`. |
| `pnpm test` | Generate tokens and run Storybook play tests in headless Chromium. The axe gate fails the run on violations in the `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22a`, `wcag22aa`, and `best-practice` rules (`a11y.test: 'error'`). |
| `pnpm --filter @jfrader/storybook exec vitest run --project=storybook --project=storybook-touch --maxWorkers=2 <story-file>` | One story file against the same axe gate. |
| `pnpm verify:exports` | Every public component folder has a subpath export, and every source export target exists. It does not validate built artifacts or root-index coverage. |

`scripts/verify-exports.mjs` is the source check; it is not a Storybook test. `scripts/flip-exports.mjs
dist` validates built export targets after a package build, as [Releasing](./releasing.md) describes. A
passing axe gate does not replace anything below.

## Manual gates

- **Keyboard.** Use only the keyboard. Tab through the story in Firefox and Safari, press every key
  in the component's documented keyboard map, and check order, single activation, and a visible focus
  ring.
- **Screen reader.** NVDA with Firefox on Windows, or VoiceOver with Safari on macOS. Check name,
  role, state, description, and error, plus the title and focus containment of a modal.
- **Forced colors.** Windows Settings → Accessibility → Contrast themes → any theme, opened in Edge;
  or Chrome DevTools → Rendering → Emulate CSS media feature `forced-colors: active`. Check that the
  focus ring, boundaries, selected and checked states, and separators stay visible.
- **Reduced motion.** Chrome DevTools → Rendering → `prefers-reduced-motion: reduce`. Open, close, and
  toggle the component; transitions must stop, and open, close, and focus must still complete.
- **RTL.** Wrap the story in `<div dir="rtl">`, or set `dir="rtl"` on `<html>` in DevTools. Check the
  mirrored layout, arrow-key direction, and directional glyphs.

## Recording a result

Replace `pending` in the table below with `pass YYYY-MM-DD <browser/AT>` or `fail: <issue> (<title>)`.
An `auto:` note lists what the test suite covers in headless Chromium; it is not a recorded manual
result.

## Results

| Component | Keyboard | Screen reader | Forced colors | RTL | Notes |
| --- | --- | --- | --- | --- | --- |
| editable-details | pass 2026-10-16 Chromium and Firefox: Tab/Shift+Tab order, Enter/Space disclosure, Edit activation, editor focus, real modal Escape; Safari pending | pending; auto: 2026-10-16 accessibility tree in Chromium and Firefox (names, `term`/`definition`, expanded state, `aria-labelledby` name on Edit, labeled editor group, `aria-invalid` + `aria-describedby`, error `alert`) | pass 2026-10-16 Chromium emulation (guide rail and caret survive) | pass 2026-10-16 Chromium, mobile | Reduced-motion emulation passed. The nesting redesign was re-checked at 390px and 1440px, light and dark, forced colors, and RTL; four-level geometry (18px per level, panel padding equal to the title inset, 1px rails) was measured in production after deploy. No real screen reader was driven: NVDA and VoiceOver remain manual. |

Every other surface is still `pending` for all four manual gates. Work through them in this order,
adding a row when a run is recorded:

accordion, activity-rings, alert, announcement-bar, avatar, avatar-group, badge, billing-toggle,
bottom-sheet, breadcrumbs, button, button-group, calendar, card, carousel, chat-thread, checkbox,
chip-group, code-block, combobox, command-palette, comment-thread, container, context-menu,
copy-button, countdown, data-table, date-picker, date-range-picker, dialog, divider, dock, drawer,
elastic-slider, empty-state, expandable-card, expanding-search, field, file-dropzone, filter-toolbar,
flex, hold-to-confirm, hover-card, image-compare, inline-edit, json-viewer, kbd, keycap-keyboard,
lightbox-gallery, mention-input, menu, metric-card, multi-select, navigation, now-playing, pagination,
password-field, photo-grid, pill, popover, progress, radio-cards, radio-group, resizable-panels,
scroll-area, search-field, segmented-control, select, shortcut-recorder, signature-pad, skeleton,
slider, spinner, split-button, stack, stepper, stretch-refresh, swipe-actions,
switch, tabs, tag-input, text-field, textarea, theme-root, theme-switch, time-picker, timeline, toast,
toast-stack, toggle-group, tooltip, tree-view, usage-meter, user-menu

`field` is internal anatomy, exercised through TextField and Textarea. Non-interactive surfaces are
still checked for forced colors and RTL when their paint or direction changes.
