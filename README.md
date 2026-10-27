# jfrader-ui

React component library based on Emotion and CSS custom properties. Every component's documentation,
examples, and browser tests live beside its source.

**Status: pre-1.0.** The public API can still change between minor versions. Every breaking change is
listed in the [changelog](CHANGELOG.md).

- Documentation: [ui.jfrader.com](https://ui.jfrader.com)
- Storybook: [ui.jfrader.com/storybook/](https://ui.jfrader.com/storybook/)
- Changelog: [CHANGELOG.md](CHANGELOG.md)

## Install

```sh
pnpm add @jfrader/ui @jfrader/tokens @jfrader/icons
```

Requires React 19. Import the token stylesheet once, in your app entry:

```ts
import '@jfrader/tokens/tokens.css';
```

Installing the package does not load its tokens, and nothing renders correctly without them.
[Getting started](docs/getting-started.md) has a complete Vite file, the Next.js App Router layout,
and the first component to render.

```tsx
import { Button, Card, ThemeProvider } from '@jfrader/ui';

export function Project() {
  return (
    <ThemeProvider>
      <Card>
        <Card.Header>
          <Card.Title>Your first project</Card.Title>
          <Card.Description>Keep your team's work in one place.</Card.Description>
        </Card.Header>
        <Card.Footer>
          <Button tone="accent">Create project</Button>
        </Card.Footer>
      </Card>
    </ThemeProvider>
  );
}
```

## Guides

| Guide | Covers |
| --- | --- |
| [Getting started](docs/getting-started.md) | Install, first component, Vite and Next.js setup, fonts, icons |
| [Theming](docs/theming.md) | Light and dark, saved preference, brand accents, scoped themes, overlays |
| [Styling](docs/styling.md) | Props, `sx`, `styled`, parts, and slots |
| [Icons](docs/icons.md) | Install, import, size, label, and create icons |
| [QA gates](docs/qa-gates.md) | Keyboard, screen reader, forced colors, reduced motion, RTL |

Storybook renders the setup, theming, styling, and QA guides under **Foundations**, straight from these files.

Find the icon guide and searchable browser under [Icons / All icons](https://ui.jfrader.com/#/components/gallery).

## Packages

| Path | Package | Contents |
| --- | --- | --- |
| `packages/tokens` | `@jfrader/tokens` | Token source, generated `tokens.css`, typed `var()` references |
| `packages/styling` | `@jfrader/styling` | Shared Emotion seam, `sx`, theme typing, and media queries |
| `packages/icons` | `@jfrader/icons` | `SvgIcon`, `createSvgIcon`, generated icons, and metadata |
| `packages/ui` | `@jfrader/ui` | Components |
| `apps/storybook` | `@jfrader/storybook` | Workbench, component docs, browser tests |
| `apps/docs` | `@jfrader/docs` | Documentation site published at `ui.jfrader.com` |
| `apps/pilot` | `@jfrader/pilot` | Reference Vite consumer app |

Every component is exported from the package root and from its own subpath, such as
`@jfrader/ui/button`. Game and scene components stay on subpaths only. The full inventory is
[`packages/ui/src/index.ts`](packages/ui/src/index.ts).

## Registry

npmjs is the default and needs no configuration. GitHub Packages hosts the same verified tarball and
requires authentication even for a public package:

```ini
@jfrader:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

That setting covers the whole `@jfrader` scope, and npm does not fall back from GitHub Packages to
npmjs. For a package that is not mirrored there, install it from an explicit npmjs tarball URL.

## Commands

Run from the repo root. Node 22.12 or later.

| Command | What it does |
| --- | --- |
| `pnpm dev` | Generate tokens and start Storybook on port 6006 |
| `pnpm test` | Generate tokens and run the browser tests |
| `pnpm typecheck` | Generate tokens and typecheck every package |
| `pnpm build` | Generate tokens and build static Storybook |
| `pnpm --filter @jfrader/docs dev` | Start the docs site on port 5173 |

`AGENTS.md` lists the verification commands, and [Releasing](docs/releasing.md) covers packing and
publishing.

## Browser support

Components rely on `:has()`, `:dir()`, `inert`, and modal `<dialog>`.

| Target | Versions |
| --- | --- |
| `@jfrader/ui` | Chrome and Edge 120+, Firefox 121+, Safari 16.4+, iOS Safari 16.4+, Chrome for Android 120+ |
| Workbench | Storybook 10's own floor, higher than the components'; mobile browsers are not verified |

- `Textarea` `autoResize` needs `field-sizing: content`. Without it the field keeps its `rows` height.
- Dialog close requests fall back to a state close where `dialog.requestClose()` is missing.
- Automated: `pnpm typecheck` and `pnpm test`, including the axe gate, in headless Chromium. CI runs
  them on `master` and on pull requests; the release workflow runs them again on `v*` tags.
- Manual: keyboard, screen reader, forced colors, reduced motion, and RTL, per [QA gates](docs/qa-gates.md).

## Accessibility

Text and interactive states meet WCAG AA contrast in both themes, focus is always visible, and no
state relies on color alone. The axe gate runs the WCAG 2.0, 2.1, and 2.2 A and AA rules, plus best
practice. [QA gates](docs/qa-gates.md) covers what automation cannot check.

## Examples

- [Starter template](https://github.com/jfrader/jfrader-ui-boilerplate): minimal Vite app with a
  topbar, main content, and footer.
- [Fivefold](https://github.com/jfrader/jfrader-ui-card-game-example): four-seat trick-taking card
  game; table, hand, dialogs, scoreboard, and a phone board. [Play the live demo](https://fivefold.jfrader.com).

## Contributing

Read [AGENTS.md](AGENTS.md) for commands and conventions, then [SKILL.md](SKILL.md) for the component
authoring and review guide. Component documentation is generated by `@jfrader/react-storydocs` from each component's CSF3
`*.stories.tsx` file, so prose, examples, and tests live together. Licensed under MIT.
