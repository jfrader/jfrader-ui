# Theming

Choose a light or dark palette, then change the colors, spacing, and typography your app needs. Start
with the stylesheet setup in [Getting started](./getting-started.md).

- [How the theme works](#how-the-theme-works)
- [Set the document palette](#set-the-document-palette)
- [Theme part of a page](#theme-part-of-a-page)
- [Palettes](#palettes) and [other token groups](#typography-spacing-and-shape-elevation-and-motion)
- [Override tokens](#override-tokens)
- [Contrast surfaces](#contrast-surfaces) and [overlays](#overlays-and-portal-containers)
- [Recipes](#recipes)

## How the theme works

A **token** is a named design value, such as a text color or a spacing step. Tokens are CSS custom
properties. Components read references such as `var(--ui-color-accent)` instead of fixed values.
The theme has four layers:

| Layer | API | What it changes |
| --- | --- | --- |
| Document palette | `data-theme` on `<html>` | The document's light or dark palette. |
| Theme scope | `ThemeRoot` | A palette for a React subtree and the overlays opened inside it. |
| [Token overrides](https://ui.jfrader.com/#/components/overrides) | `createTheme` / `tokens` | Derived accent colors and overrides for individual token values. |
| Typed references | `theme` / `vars` | Typed `var(--ui-*)` references for your styles. They are the same object. |

`ThemeProvider` gives Emotion callbacks access to token references. It does not select a palette.

Changing `data-theme` changes the CSS values. The `theme` object holds the same references in both
modes; it is not a light/dark store. Keep the selected mode in your app's state if JavaScript needs it.

## Set the document palette

Put `data-theme="light"` or `data-theme="dark"` on `<html>` in the initial HTML. Without a theme, the
token stylesheet applies dark on `:root`.

Match native form controls and scrollbars to the palette in app CSS:

```css
html {
  color-scheme: dark;
}

html[data-theme='light'] {
  color-scheme: light;
}
```

### Remember a user's choice

In a client-rendered app, put this script in `index.html` before your app starts. It accepts only the
two supported values, and falls back to the system preference when storage is unavailable:

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

Use the same storage key in the switch. This component is for a **client-rendered app**, and the
pre-paint script must run first:

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

`ThemeSwitch` only requests the change. Your handler applies it; the control does not update `<html>`,
save preferences, or animate the page. This recipe reads the system preference at startup and does not
subscribe to later changes.

For SSR, render the initial `data-theme` on `<html>` and keep the server and first client render
consistent. Do not read `document` during server rendering, including in a Client Component's render.
If a pre-paint script changes the server's attribute, add `suppressHydrationWarning` to `<html>` and
synchronize mode-dependent controls after hydration. If your Content Security Policy blocks inline
scripts, supply your app's nonce or an allowed external pre-paint script.

## Theme part of a page

`ThemeRoot` renders a `div` and applies a palette to its descendants. It includes `ThemeProvider` and
carries its theme through the library's portals. Use it for a widget or a section that differs from the
page:

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

The Card paints its own surface. `ThemeRoot` sets text color and native `color-scheme`, but paints no
background and adds no padding. Omitting its `theme` selects **dark**, even on a light page, so pass
the mode explicitly when nesting roots.

## Palettes

Call `createTheme` outside render and pass the result to `ThemeRoot tokens`. Define one palette per
mode you offer, using `createTheme({ base, accent })`. See the
[per-mode branded wrapper](#per-mode-branded-wrapper) recipe for a complete example.

Match `createTheme`'s `base` to the root's `theme`. Changing the root's mode does not recalculate the
overrides. `createTheme` returns the derived values and your overrides; the stylesheet supplies the
rest of the palette.

`accent` accepts `#rgb` or `#rrggbb`. Other formats throw. It derives `accentHover`, `accentText`,
`accentSoft`, `accentSoftHover`, `accentBorder`, `accentContrast`, and `focusRing`. Keep raw brand
values in your theme configuration and token references in component styles.

Check the combinations you derive:

- On light, the derived `accentText` caps lightness for contrast on white.
- On dark, `accentText` uses your accent unchanged, so a dark accent can be unreadable.
- `accentContrast` picks near-black or white for text on the accent fill. Accents with relative
  luminance around 0.17 to 0.22 can fall below 4.5:1 against both.
- The focus ring uses your accent too, and needs contrast against its surroundings.

Choose a lighter or darker accent, or override the affected token. Derivation does not verify every
combination for you.

See [Palette](https://ui.jfrader.com/#/components/palette) for every color token's role and values.

## Typography, spacing and shape, elevation and motion

- [Typography](https://ui.jfrader.com/#/components/typography): font families, text sizes, weights, line heights,
  and editorial type tokens.
- [Spacing & shape](https://ui.jfrader.com/#/components/spacing): spacing steps and corner radii.
- [Elevation & motion](https://ui.jfrader.com/#/components/motion): shadows, stacking, durations,
  and easing curves.

## Override tokens

An override replaces one token value inside a scope. [Token overrides](https://ui.jfrader.com/#/components/overrides)
lists every path a map may set, the custom property it writes, and its default on each palette.

The `createTheme` `tokens` option takes any of those paths. Explicit values win over the derived accent
family. See the [compact theme](#compact-theme) recipe.

Pass a sparse object to `ThemeRoot tokens` directly when you need no accent derivation. A nested root
with the same theme and no `tokens` inherits the enclosing overrides; a different theme drops them. A
nested root with its own `tokens` uses that map instead of merging, so include every override it needs.

### App-wide tokens

Wrap the app in a branded `ThemeRoot` to give its components and portals the same overrides. The
wrapper does not theme the `body` outside it, so set the document palette separately when the page
background needs it.

Apps that keep all token values in CSS put the overrides after `tokens.css` and target both the
document and same-mode scopes:

```css
:root,
[data-theme='dark'],
[data-theme='light'] {
  --ui-font-sans: system-ui, sans-serif;
  --ui-radius-md: 0.25rem;
}
```

A variable set only on `html` or a wrapper does not override a nested `[data-theme]` element that
declares it, and a raw wrapper override does not follow a portal to `body`. Prefer `ThemeRoot tokens`
for scoped customization: it carries the map through portals.

`themeTokenStyle(overrides)` turns a token map into custom-property declarations, for apps that
generate that CSS. It returns a style object, not a stylesheet, and sets no mode or styles. Write the
declarations per base under matching `:root` / `[data-theme='dark']` and `[data-theme='light']`
selectors:

```tsx
import type { ReactNode } from 'react';
import { createTheme, themeTokenStyle, ThemeProvider } from '@jfrader/ui';

const palettes = [
  { selector: ":root, [data-theme='dark']", tokens: createTheme({ base: 'dark', accent: '#c4b5fd' }) },
  { selector: "[data-theme='light']", tokens: createTheme({ base: 'light', accent: '#6d28d9' }) },
];

const brandCss = palettes
  .map(({ selector, tokens }) => {
    const declarations = Object.entries(themeTokenStyle(tokens))
      .map(([name, value]) => `${name}: ${value};`)
      .join('\n');
    return `${selector} {\n${declarations}\n}`;
  })
  .join('\n');

export function BrandedApp({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <style>{brandCss}</style>
      {children}
    </ThemeProvider>
  );
}
```

Place these rules after `tokens.css`. Inline `ThemeRoot tokens` still win over them. Generate CSS only
from trusted app configuration, and use your app's stylesheet or nonce when a Content Security Policy
blocks inline styles.

## Contrast surfaces

`<Card appearance="contrast">` uses the dark palette with charcoal surface overrides, on either page
theme. `Drawer.Panel` uses this appearance by default. Descendant text, borders, control boundaries,
and wells follow it, as do the Select, Menu, and Popover overlays opened inside it.

Omit `appearance` on a nested Card to inherit. `appearance="default"` keeps the enclosing theme; it
does not restore the page's theme. To place a light section inside a contrast surface, wrap it in
`ThemeRoot theme="light"`.

## Overlays and portal containers

A portal renders an overlay elsewhere in the DOM, usually under `body`, so it can escape a parent's
clipping. Overlays built on `OverlayPortal`, including Select, Combobox, Menu, Popover, Tooltip,
DatePicker, and Toast, carry their nearest theme, appearance, and `ThemeRoot tokens` with them,
including updates while open. Other ancestor CSS does not cross that boundary. Native Dialog renders
in place and inherits directly.

Use `portalContainer` when an overlay must stay inside an embedded widget or a modal's top-layer
subtree:

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
- An element: render there. Set it once; switching hosts later is unsupported.

Inside a native modal, place the host **inside the open dialog's DOM**. A portal under `body` sits
outside its top layer and can be inert or hidden. For a host inside a contrast panel, give its
`ThemeRoot` the panel's enclosing theme so the appearance carries through.

## Recipes

### Per-mode branded wrapper

Keep a token map for each mode and select it with the same state as `ThemeRoot theme`:

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

### Compact theme

Set the radius and font alongside the accent in one token map:

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

### Check a custom accent

Check `accentText` against the surfaces where you use it in each mode, `accentContrast` against the
accent fill, and the focus ring against its surroundings. Use the [contrast caveats](#palettes) to
identify combinations that need a lighter or darker accent or an explicit token override.

Next: [Styling](./styling.md) for individual components, parts, and reusable styles.
