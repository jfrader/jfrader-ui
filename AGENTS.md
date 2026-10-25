# AGENTS.md

Conventions for agents working in this repo. Commands and boundaries live here; the rules for writing
a component live in `SKILL.md`, which is the deep guide (accessibility, performance, state ownership,
documentation spec, review checklist).

## Purpose and layout

- Purpose: a from-scratch React component system, styled with Emotion and themed with CSS custom
  properties.
- `packages/tokens`: typed token source (`src/tokens.ts`) and the generator that emits CSS variables
  and typed `var()` references.
- `packages/ui`: components, one folder per component under `src/components/`.
- `packages/icons`: hand-written SVG sources and metadata; generated React icons and `icons.json`.
- `apps/storybook`: workbench, component docs, and browser tests.
- `apps/docs`: documentation site published at `ui.jfrader.com`, built from the same Markdown files
  the workbench renders. Its overview page is synced from `README.md` by
  `apps/docs/scripts/sync-readme.mjs`, so `README.md` stays the single source for that page, and
  `apps/docs/guidance/` is generated and ignored.

## Commands

| Command | What it does |
| --- | --- |
| `pnpm generate` | Generate `packages/tokens/dist/tokens.css` and `packages/tokens/src/generated/vars.ts` |
| `pnpm dev` | Generate tokens and start Storybook on port 6006 |
| `pnpm build` | Generate tokens and build static Storybook; with `DOCS_BUILD=1` it also builds the docs site into the same publish directory |
| `pnpm og:image` | Generate tokens and regenerate the Open Graph share card (`apps/storybook/public/og-image.png`) |
| `pnpm test` | Generate tokens and run Storybook Vitest browser tests |
| `pnpm typecheck` | Generate tokens and typecheck every package |
| `pnpm verify:docs` | Check component documentation coverage; also runs before the Storybook build |
| `pnpm verify:api` | Check sx-only public styling types, slot props, and authored examples |
| `pnpm verify:slots` | Check that every replacement key a family declares is rendered |
| `pnpm verify:exports` | Check that every component's subpath export resolves and matches the index |
| `pnpm --filter @jfrader/storybook audit:docs` | Crawl the docs site and report examples without code and API coverage (`DOCS_URL`, `--only`, `--check`) |
| `pnpm --filter @jfrader/storybook exec vitest run --project=storybook --maxWorkers=2 packages/ui/src/components/<name>/<name>.stories.tsx` | Run one story file from the repo root (fast loop; tokens must already be generated) |

Packing and publishing are in `docs/releasing.md`.

## Where each rule lives

- `SKILL.md`: component rules, accessibility contracts, styling, API conventions, performance, motion,
  testing, and the documentation writing spec.
- Everything Markdown in this repo, whether a guide, a README, or an agent file, follows the voice and
  mechanics in the `SKILL.md` documentation spec: US English, Oxford comma, no em dashes, sentence
  case headings, one home per fact.
- Before choosing a structure, read the component folder, its siblings, and the family owners in
  `SKILL.md` §4.

## Dependencies

- `@emotion/react`, `@emotion/styled` (re-exported as the app-facing `styled`; components never use
  it), and `@floating-ui/react` (Popover, Tooltip, Menu).
- `motion` (v14.x, imported as `motion/react`).
- `lucide-react` is approved for consumer apps and examples (for example `apps/pilot`); `@jfrader/ui`
  must not depend on it.
- `shiki` is an optional peer and a devDependency for stories. Only
  `packages/ui/src/components/code-block/shiki.ts`, published as the `./code-block/shiki` subpath, may
  import it.
- `react-hook-form` is approved only as an `apps/storybook` devDependency for app-owned editor
  fixtures. No runtime dependency, peer dependency, import, or declaration in `@jfrader/ui` may
  depend on it.
- `@internationalized/number` and `decimal.js` for locale-aware parsing and formatting, and for exact
  minor-unit arithmetic (NumberField, MoneyInput).
- `libphonenumber-js` (the `/max` build) for PhoneInput country metadata, AsYouType formatting, and
  E.164 validation.
- `culori` for ColorPicker color-space conversion and contrast math.
- `next` and `@emotion/cache` are optional peers and devDependencies. Runtime imports stay in
  `packages/ui/src/components/next/`, published as the `./next` subpath. Iframe stories may use
  `@emotion/cache` with the frame's head as the container, plus the generated token and base styles in
  that document.
- `typescript-compiler` (an alias of TypeScript 5.9) is development-only, for the customization
  inventory. TypeScript 7 remains the typecheck command.
- Any other dependency requires updating this file first.

## Generated files

- Never edit `packages/tokens/src/generated/vars.ts`, `packages/tokens/dist/*`, or
  `docs/customization-inventory.md`.
- Run `pnpm generate` after editing `packages/tokens/src/tokens.ts`.
- Regenerate the inventory with `node scripts/customization-inventory.mjs` after an API or slot
  change.

## Definition of done

`SKILL.md` owns the component contract, the test requirements, the visual pass, and the review
checklist. A green test run is not completion; the checklist in `SKILL.md` §7 and §8 is.

