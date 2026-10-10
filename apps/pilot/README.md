# @jfrader/pilot

A settings page built only from the `@jfrader/ui` root import (Button, TextField, Switch, Pill, Badge, Card, Dialog). It shows how an app inside the workspace consumes the library.

## Run

From the repo root, after `pnpm install`:

```sh
pnpm --filter @jfrader/pilot dev     # Vite dev server
pnpm --filter @jfrader/pilot build   # production build into apps/pilot/dist
pnpm --filter @jfrader/pilot typecheck
```

Each pilot command generates tokens first through its lifecycle script, including the gitignored `packages/tokens/dist/tokens.css`.

## Friction log

- **The library ships TSX source, not built JS.** `@jfrader/ui` exports point at `src/*.ts(x)`, and the components use Emotion's `css` prop. The consumer has to compile them itself: set `jsxImportSource: '@emotion/react'` in both `@vitejs/plugin-react` and `tsconfig.json`, and add `@emotion/react` as a direct dependency. Otherwise its own JSX can't resolve `@emotion/react/jsx-runtime`. This applies to the whole app, so the app's own JSX goes through Emotion as well. None of this is documented for consumers.
- **`tsc` typechecks the library with the app's compiler options.** Since the types also point at source, consumers need `moduleResolution: 'bundler'`, `jsx: 'react-jsx'` and `jsxImportSource: '@emotion/react'` in `tsconfig.json`, plus Emotion's `jsxImportSource` in the Vite React plugin. The repo also enables `strict` and `noUncheckedIndexedAccess`; these are stricter repo preferences, not universal consumer requirements. Extending `tsconfig.base.json` supplies these settings inside the repo.
- **`tokens.css` needs a generate step first.** `@jfrader/tokens/tokens.css` resolves to `dist/tokens.css`, which is gitignored and doesn't exist until tokens are generated, while `@jfrader/tokens/vars` (committed) resolves fine. The pilot's `predev`, `prebuild` and `pretypecheck` scripts run `pnpm --filter @jfrader/tokens generate` so its commands work from a fresh checkout after installation.
- **Two ways to set the theme, and the docs pick neither.** Storybook puts `data-theme` on `<html>`; its companion `preview.css` styles `body`, including the background. `ThemeRoot` sets `data-theme` on a `div` and handles `color-scheme`. The design system itself ships no page styles. The pilot copies Storybook's theme/body rules: `data-theme` on `<html>`, plus `color-scheme`, background, text and font rules on `html` and `body` in `app.css`. A consumer has to read `.storybook/` to find this out.
- **The design system ships no page-level base styles.** It does not style page headings (outside `Card`/`Dialog` titles), `body` or the page font stack. This pilot copied the Storybook preview's theme/body rules into its own `app.css`.
- **Overlay triggers can't be a `Button`.** `Dialog.Trigger` and `Dialog.Close` render their own button with a fixed `triggerStyle`. There is no `render` prop yet and no `asChild`, so a danger-toned "Delete account" trigger can't use `Button`. The pilot works around it with a controlled `Dialog` (`open` and `onOpenChange`) opened from a plain `Button`. The dialog's Cancel (`Dialog.Close`) also looks different from the `Button` next to it.
- **`Badge` doesn't feed into the control's accessible name.** The count sits outside the wrapped `Button`, so the button's name is just "Inbox". The pilot sets `aria-label="Inbox, 3 unread"` by hand.
- **There's no layout primitive.** There's no Stack, Flex or page container. Every gap and row in the pilot is hand-written CSS using `--ui-*` variables, and the variable names had to be worked out from `tokens.ts` plus the kebab-case rule in the generator (`vars.textSize['2xl']` becomes `--ui-text-size-2xl`).
- **`Card.Footer` pushes content to the end.** It sets `justify-content: flex-end`, so a status `Pill` placed before the Save button ends up packed against it on the right. Getting it on the start edge would mean overriding the footer's styles.
- **Unverified: Emotion's dev JSX runtime under plain Vite.** Storybook aliases `@emotion/react/jsx-dev-runtime` to a shim because the dep optimizer breaks its CJS interop in that pipeline. The pilot leaves out the shim. Whether `vite dev` needs it here hasn't been run yet. A blank page with `jsxDEV is not a function` means it does.
