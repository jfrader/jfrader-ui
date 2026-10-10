# @jfrader/pilot

A settings page built only from the `@jfrader/ui` root import (Button, TextField, Switch, Pill, Badge, Card, Dialog). It shows how an app inside the workspace consumes the library.

## Run

From the repo root, after `pnpm install`:

```sh
pnpm --filter @jfrader/pilot dev     # Vite dev server
pnpm --filter @jfrader/pilot build   # production build into apps/pilot/dist
pnpm --filter @jfrader/pilot typecheck
```

`pnpm install` generates the gitignored `packages/tokens/dist/tokens.css` through the root `postinstall`. Each pilot command also regenerates tokens first through its lifecycle script.

Consumer setup (dependencies, Vite, tsconfig, styles, theming, icons, fonts) is in [docs/consuming-jfrader-ui.md](../../docs/consuming-jfrader-ui.md).

## Friction log

### Fixed

- **Emotion wiring documented.** The library ships TSX source that uses Emotion's `css` prop, so consumers compile it with `jsxImportSource: '@emotion/react'` in `@vitejs/plugin-react` and `tsconfig.json`, and add `@emotion/react` as a direct dependency. The consumer guide lists the required tsconfig flags (`jsx`, `jsxImportSource`, `moduleResolution: 'bundler'`) apart from the repo's stricter `strict` and `noUncheckedIndexedAccess`.
- **Token generation automated.** The root `postinstall` runs `pnpm generate`, so `@jfrader/tokens/tokens.css` exists after every fresh `pnpm install`.
- **Theming canonical.** Apps set `data-theme` on `<html>`; `ThemeRoot` themes a scoped subtree. The pilot keeps its `color-scheme` rules on `html` in `app.css`, as the guide shows.
- **Base styles ship.** `@jfrader/tokens/base.css` sets `box-sizing` and the `body` margin, background, text color and font. The pilot imports it and keeps only `line-height` on `body`. Page headings (outside `Card`/`Dialog` titles) are still app-owned.
- **Overlay triggers compose with `Button`.** `Dialog.Trigger` and `Dialog.Close` accept the `render` prop (GURI-1989), so the pilot composes the danger Delete-account trigger and the outline Cancel button from `Button` — no controlled workaround, no styling mismatch.
- **Plain Vite runs the Emotion dev JSX runtime without a shim.** Verified in the browser: `pnpm --filter @jfrader/pilot dev` renders the app (heading present, both Lucide icons, zero page errors). Storybook's `jsx-dev-runtime` alias is not needed here.

### Open

- **`Badge` doesn't feed into the control's accessible name.** The count sits outside the wrapped `Button`, so the button's name is just "Inbox". The pilot sets `aria-label="Inbox, 3 unread"` by hand.
- **There's no layout primitive.** There's no Stack, Flex or page container. Every gap and row in the pilot is hand-written CSS using `--ui-*` variables, and the variable names had to be worked out from `tokens.ts` plus the kebab-case rule in the generator (`vars.textSize['2xl']` becomes `--ui-text-size-2xl`).
- **`Card.Footer` pushes content to the end.** It sets `justify-content: flex-end`, so a status `Pill` placed before the Save button ends up packed against it on the right. Getting it on the start edge would mean overriding the footer's styles.
