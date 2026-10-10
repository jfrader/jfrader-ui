# jfrader-ui

A from-scratch React component system styled with Emotion and themed through CSS custom properties, with Storybook 10 as the workbench.

Status: M1 complete — reviewed and tested: ThemeRoot, Button, TextField, Textarea, Checkbox, Switch, RadioGroup, Select, Tabs, Accordion, Dialog, Popover, Tooltip, Menu, Toast, Alert, Avatar, Badge, Spinner, Progress, Skeleton

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
