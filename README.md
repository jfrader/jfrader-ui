# jfrader-ui

A from-scratch React component system styled with Emotion and themed through CSS custom properties, with Storybook 10 as the workbench.

Status: 30 components — reviewed, tested (265 browser tests + axe gate) and story-documented. M1 + M2 complete; see PLAN.md for the inventory.

## Packages

| Path | Package | Contents |
| --- | --- | --- |
| `packages/tokens` | `@jfrader/tokens` | Typed token source, generated `tokens.css` and typed `var()` references |
| `packages/ui` | `@jfrader/ui` | React components |
| `apps/storybook` | `@jfrader/storybook` | Storybook workbench and docs |

## Commands

Run from the repo root.

| Command | What it does |
| --- | --- |
| `pnpm generate` | Generate `tokens.css` and `vars.ts` from the token source |
| `pnpm dev` | Generate tokens and start Storybook on port 6006 |
| `pnpm build` | Generate tokens and build static Storybook |
| `pnpm test` | Generate tokens and run Storybook tests in the browser |
| `pnpm typecheck` | Typecheck every package |

## Browser support

Components rely on `:has()`, `:dir()`, `inert` and modal `<dialog>`, and Vite 8 builds to its `baseline-widely-available` target (Chrome 111, Firefox 114, Safari 16.4). Storybook 10 sets a higher floor for the workbench only.

- Components (`@jfrader/ui`): Chrome and Edge 120+, Firefox 121+, Safari 16.4+, iOS Safari 16.4+, Chrome for Android 120+.
- Storybook workbench: Chrome 131+, Edge 134+, Firefox 136+, Safari 18.3+. Mobile browsers: not verified.
- `Textarea` `autoResize` needs `field-sizing: content`; without it the field keeps its `rows` height. Dialog close requests fall back to a state close where `dialog.requestClose()` is missing.
- Automated: `pnpm typecheck` and `pnpm test` (story play tests and the axe gate, headless Chromium only). No CI workflow runs them; run them locally.
- Manual: keyboard, screen reader, forced colors, reduced motion and RTL in [docs/qa-gates.md](docs/qa-gates.md).
