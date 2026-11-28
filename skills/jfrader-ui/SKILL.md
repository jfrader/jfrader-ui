---
name: jfrader-ui
description: Consuming @jfrader/ui in an app — component and token choices, overlay layers, and what to do when a library surface is covered or behaves badly. Use when building or reviewing UI that imports @jfrader/ui, or right after bumping the package.
---

# Using @jfrader/ui

The library owns behaviour, tokens and layers. The app owns layout, data and its own chrome.

## Layers and stacking

- Never add `z-index`, sticky offsets or new stacking contexts to fix an overlay that renders underneath app content. Select menus, popovers, menus, tooltips, dialogs, drawers, bottom sheets and toasts take their layer from the design system.
- A covered panel is a library bug, not an app style. Reproduce it minimally (open the surface, hit-test an option's centre with `elementFromPoint`), then file it in the library's issue tracker with that evidence, the surface and the app's layered neighbour.
- If the app cannot wait for the release, a stopgap is allowed only as: one named layer constant, applied at the few call sites, linked to the issue, plus a removal task. Never scatter `slotProps`/`sx` z-index per component, and never leave a stopgap unlinked.
- App chrome that must float (status strip, table header, tab bar, skip link) gets its own small, documented layer scale in the app and stays below the library's popover layer.

## Components and tokens

- Reach for the library component before writing one, and extend a family (`Popover`, `Menu`, `Select`, …) rather than forking it.
- Colors, spacing, radii, shadows, type and motion come from tokens or the theme; no literals in app CSS.
- Control heights come from the library's size scale (`sm`/`md`/`lg`). Never set `blockSize` or `minBlockSize` on a control, and never wrap one, to make a row line up: a control that disagrees is a library bug. Report it with the measured heights per control.
- `sx` is the public styling prop, including inside `slotProps`; internal `css` is not public API, so reach for `sx` first.
- `sx` is for layout and one-off spacing, not for restyling a component's internals.

## State

- Whether a dialog, drawer or bottom sheet is open is addressable state, so it lives in the URL — `url-state`. A `Select`, menu or tooltip opening is interaction, and stays local.

## Working with the library

- The library repo's `SKILL.md`, `AGENTS.md` and `llms.txt` are for library authors. Consumer usage lives at `ui.jfrader.com` and in the installed types.
- A missing capability is a library issue with a proposed API, not a workaround copied into three apps.
- After any version bump, run the `visual-qa` protocol for the surfaces the release touched.
