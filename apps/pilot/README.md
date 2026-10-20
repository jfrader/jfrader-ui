# @jfrader/pilot

A settings page built only from the `@jfrader/ui` root import: `Button`, `TextField`, `Switch`, `Pill`,
`Badge`, `Card`, and `Dialog`. It is the reference for how an app inside the workspace consumes the
library.

## Run

From the repo root, after `pnpm install`:

```sh
pnpm --filter @jfrader/pilot dev     # Vite dev server
pnpm --filter @jfrader/pilot build   # production build into apps/pilot/dist
pnpm --filter @jfrader/pilot typecheck
```

`pnpm install` generates the git-ignored `packages/tokens/dist/tokens.css` through the root
`postinstall`, and each pilot command regenerates tokens first through its lifecycle script.

The pilot sets `data-theme="dark"` in `index.html` and switches the attribute without persisting it. It
imports both token stylesheets in `src/main.tsx` and needs no `ThemeProvider`, because it styles with
app CSS rather than theme callbacks.

Consumer setup, including dependencies, Vite, tsconfig, styles, theming, icons, and fonts, is in
[docs/getting-started.md](../../docs/getting-started.md).

## Known gap

`Badge` does not contribute to the wrapped control's accessible name. The count renders outside the
`Button`, so the pilot sets `aria-label="Inbox, 3 unread"` by hand.
