# Theming

Choose a light or dark palette, then change the colors, spacing or typography your app needs. Start with the stylesheet setup in [Getting started](./consuming-jfrader-ui.md).

## What each API changes

A **token** is a named design value, such as a text color or a spacing step. Components read CSS custom properties such as `var(--ui-color-accent)` instead of fixed values.

| API | Use it for |
| --- | --- |
| `data-theme` on `<html>` | The whole document's light or dark palette. |
| `ThemeRoot` | A palette for a React subtree and the overlays opened inside it. |
| `createTheme` | Deriving accent colors and collecting your token overrides. |
| `ThemeProvider` | Giving Emotion callbacks access to token references. It does not select a palette. |
| `theme` / `vars` | Typed `var(--ui-*)` references for your styles. They are the same object. |

Changing `data-theme` changes the CSS values. The `theme` object keeps the same references in both modes; it is not a light/dark state store. Keep the selected mode in your app's state if you need it in JavaScript.

## Set the document palette

Put `data-theme="light"` or `data-theme="dark"` on `<html>` in the initial HTML. The token stylesheet uses dark on `:root` when no theme is specified.

In app CSS, match native form controls and scrollbars to that palette:

```css
html {
  color-scheme: dark;
}

html[data-theme='light'] {
  color-scheme: light;
}
```

### Remember a user's choice

For a client-rendered app, put this script in `index.html` before your app starts. It accepts only the two supported values and falls back to the system preference if storage is unavailable:

```html
<script>
  let mode = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  try {
    const saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') mode = saved;
  } catch {}
  document.documentElement.dataset.theme = mode;
</script>
```

Use the same storage key when the user switches modes. This component is for a **client-rendered app**; the pre-paint script above must run first:

```tsx
import { useState } from 'react';
import { ThemeSwitch, type ThemeName } from '@jfrader/ui';

const THEME_STORAGE_KEY = 'theme';

export function AppThemeSwitch() {
  const [mode, setMode] = useState<ThemeName>(() =>
    document.documentElement.dataset.theme === 'light' ? 'light' : 'dark',
  );

  function changeTheme(next: ThemeName) {
    document.documentElement.dataset.theme = next;
    setMode(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {}
  }

  return <ThemeSwitch label="Dark mode" value={mode} onValueChange={changeTheme} />;
}
```

`ThemeSwitch` requests a value change. Your handler applies it; the control does not update `<html>`, save preferences or animate the page itself. This recipe reads the system preference at startup; it does not subscribe to later system changes.

For SSR, render the initial `data-theme` on `<html>` and keep the server and first client render consistent. Do not read `document` during server rendering, including in a Client Component's render. If a pre-paint script changes the server's attribute, add `suppressHydrationWarning` to `<html>` and synchronize any mode-dependent controls after hydration. If your Content Security Policy blocks inline scripts, supply your app's nonce or use an allowed external pre-paint script.

## Theme part of a page

`ThemeRoot` renders a `div` and applies a palette to its descendants. It also includes `ThemeProvider` and carries its theme through the library's portals. Use it for a widget or a section that differs from the page:

```tsx
import { Button, Card, ThemeRoot } from '@jfrader/ui';

export function LightWidget() {
  return (
    <ThemeRoot theme="light">
      <Card>
        <Card.Header><Card.Title>Invite your team</Card.Title></Card.Header>
        <Card.Footer><Button tone="accent">Invite</Button></Card.Footer>
      </Card>
    </ThemeRoot>
  );
}
```

The Card paints its own surface. `ThemeRoot` sets text color and native `color-scheme`, but does not paint a background or add padding. Omitting its `theme` selects **dark**, even on a light page. Pass the mode explicitly when nesting roots.

## Custom palettes

Call `createTheme` outside render, then pass its result to `ThemeRoot tokens`. Define a palette for each mode you offer:

```tsx
import { useState } from 'react';
import { Button, Card, createTheme, ThemeRoot, ThemeSwitch, type ThemeName } from '@jfrader/ui';

const brandThemes = {
  dark: createTheme({ base: 'dark', accent: '#c4b5fd' }),
  light: createTheme({ base: 'light', accent: '#6d28d9' }),
};

export function BrandedWidget() {
  const [mode, setMode] = useState<ThemeName>('light');
  return (
    <ThemeRoot theme={mode} tokens={brandThemes[mode]}>
      <Card>
        <Card.Header><Card.Title>Project settings</Card.Title></Card.Header>
        <Card.Content>
          <ThemeSwitch label="Dark mode" value={mode} onValueChange={setMode} />
        </Card.Content>
        <Card.Footer><Button tone="accent">Save settings</Button></Card.Footer>
      </Card>
    </ThemeRoot>
  );
}
```

Match `createTheme`'s `base` to the root's `theme`. Changing the root's mode does not recalculate the overrides. `createTheme` returns only the derived values and your overrides; the stylesheet supplies the rest of the named palette.

`accent` accepts `#rgb` or `#rrggbb`; other formats throw. It derives `accentHover`, `accentText`, `accentSoft`, `accentSoftHover`, `accentBorder`, `accentContrast` and `focusRing`. Raw brand values belong in your theme configuration; use token references in component styles.

**Check your color combinations.** On light, the derived `accentText` limits lightness for contrast on white. On dark, it uses your accent unchanged, so a dark accent can be unreadable. `accentContrast` chooses near-black or white for text on the accent fill; accents with relative luminance around 0.17–0.22 can fall below 4.5:1 against both. Choose a darker or lighter accent, or override the text color. The focus ring also uses your accent and needs contrast against its surroundings. Derivation does not verify every custom combination.

### Override other tokens

The `tokens` option accepts any token path, including spacing, radii and fonts. Explicit values win over the derived accent family:

```tsx
import { Card, createTheme, ThemeRoot } from '@jfrader/ui';

const compactTheme = createTheme({
  base: 'light',
  accent: '#6d28d9',
  tokens: {
    radius: { md: '0.25rem' },
    font: { sans: 'system-ui, sans-serif' },
  },
});

export function CompactWidget() {
  return (
    <ThemeRoot theme="light" tokens={compactTheme}>
      <Card><Card.Content>Workspace settings</Card.Content></Card>
    </ThemeRoot>
  );
}
```

You can also pass a sparse object directly to `ThemeRoot tokens`, without `createTheme`, when no accent derivation is needed. A nested root with the same theme and no `tokens` inherits the enclosing overrides. A different theme drops them. A nested root with its own `tokens` uses that map instead of merging the enclosing map; include every override it needs.

### App-wide tokens

Wrap your whole React app in a branded `ThemeRoot` to give its components and portals the same overrides. The wrapper does not theme the `body` outside it; set the document palette separately if the page background needs it.

For apps that keep all token values in CSS, put overrides after `tokens.css` in `src/app.css`. Target both the document and same-mode scopes:

```css
:root,
[data-theme='dark'],
[data-theme='light'] {
  --ui-font-sans: system-ui, sans-serif;
  --ui-radius-md: 0.25rem;
}
```

Setting a variable only on `html` or a wrapper does not override a nested `[data-theme]` element that declares that variable itself. A raw wrapper override also does not follow a portal to `body`. Prefer `ThemeRoot tokens` for scoped customization; it carries the map through portals.

`themeTokenStyle(overrides)` converts a token map into custom-property declarations. If you generate app-wide CSS, use it once per base and write those declarations under the matching `:root` / `[data-theme='dark']` and `[data-theme='light']` selectors. It returns a style object, not a CSS stylesheet, and does not set a mode or install styles.

For example, use this wrapper around your app instead of a branded `ThemeRoot`. Keep the document mode switch from above; the selectors pick its palette:

```tsx
import type { ReactNode } from 'react';
import { createTheme, themeTokenStyle, ThemeProvider } from '@jfrader/ui';

const palettes = [
  { selector: ":root, [data-theme='dark']", tokens: createTheme({ base: 'dark', accent: '#c4b5fd' }) },
  { selector: "[data-theme='light']", tokens: createTheme({ base: 'light', accent: '#6d28d9' }) },
];
const brandCss = palettes.map(({ selector, tokens }) => {
  const declarations = Object.entries(themeTokenStyle(tokens))
    .map(([name, value]) => `${name}: ${value};`).join('\n');
  return `${selector} {\n${declarations}\n}`;
}).join('\n');

export function BrandedApp({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <style>{brandCss}</style>
      {children}
    </ThemeProvider>
  );
}
```

Place these rules after `tokens.css`. Inline `ThemeRoot tokens` still win over them. Generate CSS only from trusted app configuration, and use your app's stylesheet or nonce if its Content Security Policy blocks inline styles.

## Contrast surfaces

`<Card appearance="contrast">` uses the dark palette with charcoal surface overrides, on either page theme. `Drawer.Panel` uses this appearance by default. Descendant text, borders, control boundaries and wells follow it, as do Select, Menu and Popover overlays opened inside it.

Omit `appearance` on a nested Card to inherit. `appearance="default"` keeps the enclosing theme; it does not restore the outer page's theme. To put a light section inside a contrast surface, wrap it in `ThemeRoot theme="light"`.

## Overlays and portal containers

A portal renders an overlay elsewhere in the DOM, usually under `body`, so it can escape a parent's clipping. Library overlays such as Select, Combobox, Menu, Popover, Tooltip, DatePicker and Toast carry their nearest theme, appearance and `ThemeRoot tokens` with them, including updates while open. Other ancestor CSS does not cross that boundary. Native Dialog renders in place and inherits directly.

Use `portalContainer` when an overlay must stay inside an embedded widget or a modal's top-layer subtree. Here is a complete widget-owned host:

```tsx
import { useState } from 'react';
import { Button, Popover, ThemeRoot } from '@jfrader/ui';

export function ShareWidget() {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  return (
    <ThemeRoot theme="light" portalContainer={host}>
      <Popover>
        <Popover.Trigger>Share</Popover.Trigger>
        <Popover.Content aria-label="Share project">
          <Button>Copy link</Button>
        </Popover.Content>
      </Popover>
      <div ref={setHost} />
    </ThemeRoot>
  );
}
```

- Omitted: inherit the enclosing root's host, or use `body`.
- `null`: wait for the host before rendering overlays.
- An element: render there. Set it once; switching to another element later is unsupported.

Inside a native modal, place the host **inside the open dialog's DOM**. A portal under `body` is outside its top layer and can be inert or hidden. For a host inside a contrast panel, give its `ThemeRoot` the panel's enclosing theme so the appearance carries through.

Next: [Styling](./styling.md) for individual components, parts and reusable styles.
