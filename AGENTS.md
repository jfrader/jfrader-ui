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
| `pnpm test` | Generate tokens and run Storybook Vitest browser tests |
| `pnpm typecheck` | Typecheck every package |

## Styling rules

- Import `css` and `keyframes` only from `packages/ui/src/styling/css.ts`. Never import them from `@emotion/react` directly. Never use `styled()`.
- Compose styles with arrays in the `css` prop (`css={[base, sizeStyles[size]]}`). A consumer's `className`/`css` merges last automatically.
- Define styles as module-level `css()` constants. Never build style objects per render.
- Express state through attributes and pseudo-classes: `:hover`, `[aria-disabled="true"]`, `[data-state]`, `:focus-visible`.
- Use logical properties (`marginInline`, `paddingBlock`, `insetInlineStart`, …) so layouts work in RTL.
- Tokens only: import typed references from `@jfrader/tokens/vars`. Raw hex/rgba values are forbidden outside `packages/tokens`.

## API conventions

- Visual props are `variant`, `tone` and `size`.
- Controlled state uses `value` / `defaultValue` / `onValueChange` and `open` / `defaultOpen` / `onOpenChange`. Support controlled and uncontrolled use.
- Composite widgets are compound components (`Dialog.Root`, `Dialog.Trigger`, …).
- Single widgets with internal parts expose `slotProps`.
- Polymorphism comes later through a `render` prop. No `asChild`.
- Use `forwardRef` everywhere (React peer range is `>=18.2`).
- Put `data-ui="<name>"` on every component root.
- Callbacks receive values for state changes (`onValueChange`, `onCheckedChange`); native event
  callbacks (`onChange`, `onClick`, `onCancel`) keep their native event signature.

## Dependency allowlist

- `@emotion/react` is installed now.
- `@floating-ui/react` and `motion` are approved but only installed when a component actually needs them.
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
