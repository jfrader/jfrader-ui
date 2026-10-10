# Design System — Plan v1 (2026-10-09)

Working repo name: TBD (`gurisitos-ui` / `jfrader-ui`). Status: research complete; architecture pending Fran's confirmation of distribution, dependencies, and name.

## 1. Goal

A from-scratch React component system for Fran's web projects.

- **Hard constraint (Fran, verbatim)**: "write all from scratch, except emotion and maybe something else, but don't use another system as base". No MUI / Radix Primitives / Base UI / Mantine / shadcn / Arc source as base or wrapper. Emotion is the allowed styling base; small non-system utility libs negotiable.
- **Aesthetic direction**: Arc (uiarc.dev) polish and motion, Linear's restraint, MUI's theming/API discipline.
- **Workbench**: Storybook 10 (stable 10.6.1), docs-as-product including light/dark toolbar.
- **Consumers**: ~10 repos — mostly Vite 7/8 + TanStack Start, React 19.2/19.3 (one React 18.2), two Next 16. Tokens must also serve Tailwind and plain-CSS apps (mifulbo precedent: 483-line semantic CSS-var file, dark-first).

## 2. Decisions locked

| Area | Choice | Source |
| --- | --- | --- |
| Styling base | Emotion (`@emotion/react`, `@emotion/styled`, `css` prop via jsxImportSource) | Fran directive |
| Components | 100% original; behaviors per WAI-ARIA APG | Fran directive |
| Theming contract | semantic CSS custom properties + `data-theme` attribute; tokens also typed in TS | survey: Arc/Linear/MUI convergence; mifulbo precedent |
| Tokens pipeline | single typed TS source → generated CSS vars + typed references; no DTCG tooling yet | survey |
| Storybook | 10.6.1, `@storybook/react-vite`, Vitest browser addon, a11y addon, themes addon | survey |
| Tests | Vitest + Storybook Vitest addon (Playwright Chromium), axe in CI-error mode, keyboard play functions | survey |
| Distribution | **recommended D1**: versioned npm monorepo (pending Fran) | Jev: fit/stack/risk; codex + gemini concur |
| Aux deps | **recommended**: Emotion + `@floating-ui/react` + `motion` (pending Fran) | Jev 0.87 reliable |

## 3. Research digest

- **styled-components is out**: maintenance mode since Mar 2025; Linear migrated off it to StyleX (Aug 2026) citing runtime cost. Do not start new work on it.
- **Emotion is viable but slow upstream**: Next App Router needs a per-render cache + `useServerInsertedHTML` and has no native RSC support (Next docs still say "working on"); MUI v9.5 and Chakra ship on Emotion in production; React 19 client works. Most of the fleet is Vite-only, so runtime cost is acceptable. Tokens-as-CSS-vars keep the engine swappable if Emotion dies.
- **Arc itself is CSS Modules + semantic CSS vars** — its polish comes from token discipline, motion, and docs, not the engine. Copy structure and behavior ideas, never code (Arc Pro license forbids redistribution as a design system; free parts MIT; repo is 2 weeks old).
- **MUI v9 patterns to emulate (not import)**: semantic palette families, typography variant ≠ semantic tag, slots + slotProps, constrained styling escape hatch, CSS theme variables + scheme selectors, `styleOverrides`-like theming, focus-visible defaults that survive forced-colors, motion tokens with reduced-motion default, state classes + documented matrices.
- **Linear patterns**: generated color roles (base + accent + contrast → role variables), nested theme scopes for elevated surfaces, fewer/softer separators, ~150ms feedback fades, keyboard-first (Cmd+K, prefix commands).
- **Primitives are not allowed as a base** → we implement focus trap/restore, portals, overlay stacking, scroll lock, roving tabindex, typeahead, dismissal, ARIA. Positioning stays with floating-ui (industry-standard utility, not a component system).
- **Storybook 10.6.1** is ESM-only (Node ≥20.19/22.12); react-vite is the right framework for a framework-neutral library; Vitest addon supersedes test-runner; portable stories via `composeStories`.

## 4. Architecture

### Repo layout (pnpm monorepo)

```
<repo>/
  packages/tokens/     # typed token source, generation script, dist CSS + types
  packages/ui/         # Emotion components, from scratch
  apps/storybook/      # workbench + docs site (static build)
  AGENTS.md            # repo conventions for agents (component DoD checklist, template)
  llms.txt             # agent index: package map, token names, doc links
```

### Token contract

- Namespace `--ui-*` (proposal; avoids collisions with app tokens like mifulbo's `--color-*`) — final naming in M0.
- Layers: primitives (neutrals 0–12, accent + status scales, OKLCH) → semantic (`bg`, `surface`, `surface-raised`, `text`, `text-muted`, `border`, `border-subtle`, `accent`, `danger`, `warning`, `success`, `focus-ring`) → component tokens only where a real override exists.
- Scales: 4px-grid spacing; text 12/14/16/18/22/28/36/52 (+72 display); radii control/panel/surface (generous rounding is part of the language); motion durations 80/120/160/240/320ms + springs (`smooth`, `snappy`, `morph`); elevation: 3 semantic levels (raised/overlay/floating) with border recipes.
- Theming: `:root` + `[data-theme="dark"]` tuned per-theme values (not inverted); set `color-scheme`; documented pre-paint script; density as a separate future axis.

### Emotion conventions (enforced by docs/lint)

- `styled()` for component styling with variants; `css` prop for local composition; tokens only — no raw colors.
- Theme object mirrors semantic tokens (`theme.color.text`, `theme.space[3]`) and reads CSS vars so runtime overrides apply.
- Per-component `styleOverrides`-style theming slots for consumer customization (lightweight MUI-inspired).
- Slots + `slotProps` for single components; compound components (`Dialog.Root/Trigger/Content/Close`) where structure matters; no `asChild`; narrow typed `as` only where semantics remain valid (per gemini review).

### Behavior layer (from scratch)

- Shared overlay foundation first: portal, stacking, scroll lock, inert background, focus trap/restore, escape/outside-click policy — one internal module reused by Dialog/Popover/Menu/Tooltip/Select.
- Positioning: `@floating-ui/react`.
- Animation: `motion` (`motion/react`) for springs/layout/AnimatePresence; CSS transitions where sufficient; reduced-motion honored everywhere.
- ARIA: implement WAI-ARIA APG patterns; each component doc states pattern + keyboard map.

### SSR + consumption

- TanStack Start (SSR): Emotion cache per render — document `@emotion/server` integration.
- Client-only Vite apps: nothing extra.
- Next 16 App Router: `useServerInsertedHTML` registry + client boundaries; tokens as static CSS.
- Non-React consumers (Tailwind/plain CSS): import the tokens CSS package only.

### Quality gates (per component DoD, in AGENTS.md)

- typecheck + lint; unit tests; Storybook Vitest browser tests (play) + axe (CI error); keyboard-interaction test mandatory for interactive components; dark + light stories; reduced-motion story; forced-colors spot check; docs page (autodocs + MDX where useful); export + README entry.
- Visual review in Storybook is part of "done".

### Agent-DX

- Component folder = implementation + types + stories + tests + docs together.
- `AGENTS.md` carries the template + checklist; `llms.txt` is the canonical index (package map, token names, conventions) — not a second source of truth.

## 5. Distribution

**Recommended D1** — versioned packages from the monorepo (changesets for releases), tokens package independent of React/Emotion so Tailwind and plain-CSS apps consume CSS vars directly.

Jev matrix: fit → D1 (0.76, reliable after sharpening) · stack → D1 (0.98) · risk → D1 (0.70) · effort → D2 (0.77). Codex and Gemini both recommended D1; Grok preferred D3 (hybrid) and warns D1 fails if redesigns cascade across 10 repos — mitigation: changesets + agent-automated bump PRs across repos; fall back to D3 if release ceremony hurts during M1.

## 6. Milestones

- **M0 — scaffold**: repo + pnpm workspace; tokens v0 (primitives → semantic vars); Emotion theme; Storybook running (light/dark toolbar); Button end-to-end (stories, tests, a11y) to validate the full pipeline.
- **M1 — foundations + 8 primitives** (build order): Button (M0), TextField/Input, Overlay foundation, Dialog, Popover/Menu, Tooltip, Tabs, Toast, Select. Docs + tests per DoD; pilot use in one app.
- **M2 — composites**: Command palette, Combobox/Autocomplete, DatePicker, DataTable (when needed), navigation/sidebar patterns, empty/loading/skeleton states.
- **M3 — cascade**: adopt in flagship apps; retire app-local UI code the system covers.

## 7. Risks & mitigations

| Risk | Mitigation |
| --- | --- |
| Emotion upstream dies / RSC regressions | Token+CSS-var contract keeps the engine swappable; static-CSS fallback path preserved; no styling engine code leaked into component APIs beyond conventions |
| From-scratch a11y bugs (focus traps, ARIA) | APG-based implementations, keyboard tests mandatory, axe in CI, manual screen-reader audit per interactive component before 1.0 |
| Agent drift (raw colors, ad-hoc variants) | Token-only lint, component checklist, small public variant surface, snapshot/visual checks |
| Release ceremony (D1) | Changesets, agent-automated fleet bumps, 0.x until stable, tokens versioned separately |
| Next 16 RSC friction (2 apps) | Registry + client boundaries documented; tokens static CSS; per-app integration doc |
| Scope explosion | 8 components per milestone, DoD gates, no component without docs+tests |

## 8. Open decisions (Fran)

1. Distribution: D1 (recommended) / D3 hybrid / D2 registry.
2. Aux deps: Emotion + floating-ui + motion (recommended) / +floating-ui only / Emotion only.
3. Repo name + npm scope: `gurisitos-ui` (@gurisitos/ui) / `jfrader-ui` (@jfrader/ui) / other.
4. Milestone scope + pilot app.

## Sources (key)

- Arc: uiarc.dev/docs/*, uiarc.dev/license, github.com/kuratlielia/arc-library
- Linear: linear.app/now/styling-linear-for-the-future-stylex, linear.app/now/behind-the-latest-design-refresh, linear.app/now/how-we-redesigned-the-linear-ui
- Emotion: emotion.sh/docs/{ssr,typescript,performance}; nextjs.org/docs/app/guides/css-in-js
- MUI: mui.com/material-ui/customization/* (theming, css-theme-variables, transitions, focus-visible)
- Storybook: storybook.js.org/docs (react-vite, vitest addon, accessibility, themes)
- Tokens: designtokens.org (2025.10 spec), stylexjs.com, vanilla-extract.style, panda-css.com
- Full reports: /tmp/opencode/design-system/ (brief.md, claude-review.md, agent reports in session transcript)

---

## Appendix — Review reconciliations (2026-10-09, post research)

Confirmed by Fran: distribution D1 (versioned npm monorepo) · deps allowlist Emotion + @floating-ui/react + motion · repo `jfrader-ui` (@jfrader/ui) · first milestone M0 only (stop for review before the 8 primitives).

Adopted from the four independent reviews:
- Emotion authoring: module-level `css()` constants + `css` prop; no `styled()` in the library; one seam at `packages/ui/src/styling/css.ts` (Claude Code).
- Tokens-first theming: components import typed `var()` references (`@jfrader/tokens/vars`); no Emotion `ThemeProvider` needed; theme switch = `data-theme` attribute, no re-render.
- No MUI-style `styleOverrides`/`defaultProps` registry; per-app tweaks go through wrapper components.
- Polymorphism via `render` prop (M1+), not `asChild`.
- Overlays platform-first (`<dialog>`, popover API, top layer, `inert`); hand-written scroll lock + focus return. floating-ui + motion stay approved, installed when Dialog/Menu/Tooltip land.
- React peer `>=18.2` (huertoku) → keep `forwardRef` until 18.2 is dropped.
- M1 build order (Claude Code's): ThemeRoot+Tokens, Button, TextField, Checkbox/Switch, Tabs, Dialog, Popover/Tooltip, Menu; Select 9th.
- Open items for M1 planning: Tailwind repos consume tokens-only or full React? · trucoshi MUI 6 migration approach · icons · font loading · browser support floor · future of `@superguri/ui`.
- Palette (2026-10-09, Fran's pick): Arc-style pastel violet (`#a78bff` fill with dark text, hover `#c7b7ff`) on Linear's near-black surface stack (`#08090a` → `#141516`, hairline borders, minimal shadows); light theme = Arc-style white/gray structure with the violet family. `accentText`/`dangerText` roles separate "accent as fill" from "accent as text" — AA-verified. An accent axis (swap violet per app/product) is the natural follow-up, not built yet.
- M1 progress (2026-10-10): ThemeRoot, Button, TextField, Checkbox, Switch, Tabs, Dialog shipped; `SKILL.md` is the component authoring/maintenance guide (accessibility, performance, state ownership, review checklist). Next: Popover/Tooltip/Menu (first `@floating-ui/react` consumers).
- M1 progress (2026-10-10, batch C): Popover (non-modal dialog), Tooltip (APG tooltip) and Menu (APG menu button) on `@floating-ui/react`; shared `useOverlayFloating` positioning, `triggerStyle` (Dialog/Popover/Menu triggers) and entry-only `overlayEnterStyle`. Next: Toast, Select.
