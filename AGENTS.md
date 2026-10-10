# AGENTS.md

Conventions for agents working in this repo. **For the full component authoring and maintenance
guide (accessibility, performance, state ownership, review checklist), read `SKILL.md`.**

## Purpose & layout

- Purpose: from-scratch React component system; Emotion for styling, CSS custom properties for theming.
- `packages/tokens`: typed token source (`src/tokens.ts`) and the generator that emits CSS vars and typed `var()` references.
- `packages/ui`: components, one folder per component under `src/components/`.
- `apps/storybook`: Storybook workbench, docs and browser tests.

## Commands

| Command | What it does |
| --- | --- |
| `pnpm generate` | Generate `packages/tokens/dist/tokens.css` and `packages/tokens/src/generated/vars.ts` |
| `pnpm dev` | Generate tokens and start Storybook on port 6006 |
| `pnpm build` | Generate tokens and build static Storybook |
| `pnpm og:image` | Regenerate the Open Graph share card (`apps/storybook/public/og-image.png`) |
| `pnpm test` | Generate tokens and run Storybook Vitest browser tests |
| `pnpm typecheck` | Typecheck every package |

## Styling rules

- Import `css` and `keyframes` only from `packages/ui/src/styling/css.ts`. Never import them from `@emotion/react` directly. Never use `styled()` inside the library.
- Compose styles with arrays (`[base, sizeStyles[size]]`). Public part roots pass them to `WithSx` (`styles`) with the part's `className` and `sx`, and render the `className` it returns; internal elements use the `css` prop.
- Every public visual part root accepts `sx` (`SxProps`), an alias of `css` that applies after it: own styles → `slotProps` → consumer `css` → consumer `sx`. Context/provider components render no DOM and take no `sx`. Parts reachable only through `slotProps` do not get `sx`.
- App-facing styling API: `styled`, `ThemeProvider`, `useTheme`, `theme` (the token object; `ThemeRoot` mounts the provider).
- Define styles as module-level `css()` constants. Never build style objects per render.
- Express state through attributes and pseudo-classes: `:hover`, `[aria-disabled="true"]`, `[data-state]`, `:focus-visible`.
- Use logical properties (`marginInline`, `paddingBlock`, `insetInlineStart`, …) so layouts work in RTL.
- Tokens only: import typed references from `@jfrader/tokens/vars`. Raw hex/rgba values are forbidden outside `packages/tokens`.

## API conventions

- Visual props are `variant`, `tone` and `size`.
- Controlled state uses `value` / `defaultValue` / `onValueChange` and `open` / `defaultOpen` / `onOpenChange`. Support controlled and uncontrolled use.
- Composite widgets are compound components whose roots are callable (`Dialog`, `Tabs`, `Select`, …) with the same part names (`Dialog.Trigger`, `Dialog.Content`, …).
- Single widgets with internal parts expose `slotProps`.
- Polymorphism comes later through a `render` prop. No `asChild`.
- React 19 ref-as-prop: components are plain functions that read `ref` from props typed with `ComponentPropsWithRef<'el'>`; never `forwardRef`. Set a dotted `displayName` on every public component and part (`Card.Header.displayName === 'Card.Header'`). React peer range is `^19.0.0`.
- Put `data-ui="<name>"` on every component root.
- Callbacks receive values for state changes (`onValueChange`, `onCheckedChange`); native event
  callbacks (`onChange`, `onClick`, `onCancel`) keep their native event signature.

## Dependency allowlist

- `@emotion/react`, `@emotion/styled` (re-exported as the app-facing `styled`; components never use it) and `@floating-ui/react` (Popover, Tooltip, Menu) are installed now.
- `motion` is approved but only installed when a component actually needs it.
- `lucide-react` is approved for consumer apps and examples (e.g. `apps/pilot`); `@jfrader/ui` itself must not depend on it.
- Any other dependency requires updating this file first.

## Generated files

- Never edit `packages/tokens/src/generated/vars.ts` or `packages/tokens/dist/*`.
- Run `pnpm generate` after editing `packages/tokens/src/tokens.ts`.

## Component definition of done

- [ ] WAI-ARIA APG pattern and keyboard map documented.
- [ ] Works controlled and uncontrolled.
- [ ] Focus behavior verified by a keyboard play test.
- [ ] Reduced motion respected.
- [ ] Dark and light stories.
- [ ] axe clean (a11y test gate is `error`).
- [ ] Exported from the package index.
- [ ] Docs via autodocs.

## Accessibility

- WCAG AA contrast for text and interactive states.
- Visible focus ring using `--ui-color-focus-ring`.
- Never signal state with color alone.

## Linear workflow

Work in this repo is tracked in Linear: project **`jfrader-ui`** in the `Gurisitosgames` workspace (team `GURI`, key `GURI`). Follow the shared `linear-workflow` skill (one project per repo; states Backlog → Todo → In Progress → Done).

- Epic: **GURI-1961 — Ship jfrader-ui v1: hardening refactors + remaining components**; children carry the migrated plan/backlog. `PLAN.md` is a pointer; do not grow it back into a plan document.
- New work → a Backlog issue in this project first, then an issue worktree at `~/Workspace/Worktrees/jfrader-ui-GURI-N` on branch `jfrader/guri-N-…` from `origin/master` (base remote is now the private GitHub repo).
- `gitBranchName` comes from the Linear issue. Commits/PRs reference the id (`Refs GURI-N`, `Fixes GURI-N`); after merge, reconcile the issue (closing comment, attachments to the issue, state `Done`).
- Repo files stay the source of truth for code and conventions; Linear carries intent and progress.
