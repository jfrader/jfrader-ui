# Manual QA gates

Run before marking a component 1.0. Start Storybook with `pnpm dev` and open each story at `http://localhost:6006`.

`pnpm test` runs story play tests and the axe gate in headless Chromium only.

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
| toast | pending; auto: Tab, Shift+Tab, focus continues to next dismiss on removal | pending | pending | pending | live region announcement; reduced motion pending |
| toggle-group | pending; auto: Tab, Shift+Tab, arrows, Home/End, Enter, Space | pending | pending | pending; auto: `KeyboardRtl` story asserts ArrowLeft/ArrowRight swap | forced-colors CSS present; reduced motion pending |
| tooltip | pending; auto: Tab focus opens, Escape closes | pending | pending | pending | |
