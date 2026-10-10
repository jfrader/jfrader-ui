# Consuming jfrader-ui

Published `@jfrader/ui` and `@jfrader/tokens` packages ship compiled ES modules and TypeScript declarations. The app does not compile the library's TSX or need Emotion's `jsxImportSource` for library internals.

## Dependencies

```sh
pnpm add @jfrader/ui @jfrader/tokens @emotion/react react react-dom
```

## Published packages

Use your app's normal React JSX configuration. Configure Emotion's `jsxImportSource` only if the app itself uses Emotion's `css` prop.

## In-repo workspace development

Workspace exports point at TypeScript and TSX under `src/`. The app must compile that source with Emotion's JSX runtime. Generate the tokens with `pnpm generate` before starting the app.

The following Vite and TypeScript settings apply to workspace source consumption, or to an app that uses Emotion's `css` prop itself.

### Vite

```ts
// vite.config.ts
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react({ jsxImportSource: '@emotion/react' })],
});
```

### tsconfig

For the Vite setup above, use:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@emotion/react",
    "module": "ESNext",
    "moduleResolution": "bundler"
  }
}
```

This repo also sets `strict` and `noUncheckedIndexedAccess`. Those are repo preferences; consumers do not need them.

## Styles

Import the tokens once in the app entry, then the optional base styles:

```ts
import '@jfrader/tokens/tokens.css';
import '@jfrader/tokens/base.css';
```

`base.css` sets `box-sizing: border-box` and the `body` margin, background, text color and font. Override any of it in your own CSS imported after it.

Use tokens in app CSS as `var(--ui-*)`:

```css
.page {
  gap: var(--ui-space-6);
  color: var(--ui-color-text-muted);
}
```

In TypeScript, import typed references from `@jfrader/tokens/vars`.

## Theming

Set the app theme with `data-theme="dark"` or `data-theme="light"` on `<html>`.

Wrap a subtree in `ThemeRoot theme="light"` (or `"dark"`) to theme only that subtree, such as an embedded widget.

Tooltip, Popover, Menu and Select overlays portaled to `body` keep the page theme, so scoped theming applies to inline content; to theme a subtree including overlays, set `data-theme` on `<html>`.

Set the attribute before first paint:

```html
<script>
  document.documentElement.dataset.theme =
    localStorage.getItem('theme') ??
    (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
</script>
```

Match native controls and scrollbars to the theme:

```css
html {
  color-scheme: dark;
}

html[data-theme='light'] {
  color-scheme: light;
}
```

To switch at runtime, set `document.documentElement.dataset.theme` and store the value under the same `localStorage` key.

## Icons

Use [Lucide](https://lucide.dev) for shared control glyphs, with named imports:

```sh
pnpm add lucide-react
```

```tsx
import { Inbox } from 'lucide-react';

<Button startIcon={<Inbox />}>Inbox</Button>;
```

Replace any glyph with your own SVG where needed. Brand artwork stays app-owned.

## Badge counts

A `Badge` count is not part of the wrapped control's accessible name. If the control has an `aria-label`, include the count in it: `aria-label="Inbox, 3 unread"`. If the control is named by its visible text, the count is read after it.

## Fonts

Load fonts in the app. The token font stack starts with `Inter`.

Vite, with [Fontsource](https://fontsource.org):

```sh
pnpm add @fontsource/inter
```

```ts
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
```

Next.js, with [`next/font`](https://nextjs.org/docs/app/getting-started/fonts):

```tsx
// app/layout.tsx
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" className={inter.variable} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
```

```css
html[data-theme] {
  --ui-font-sans: var(--font-inter), ui-sans-serif, system-ui, sans-serif;
}
```

## SSR

Render `data-theme` on `<html>`, the pre-paint script and the font CSS in the initial HTML. If the pre-paint script can change the server-rendered `data-theme`, add `suppressHydrationWarning` to `<html>`.
