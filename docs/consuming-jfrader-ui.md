# Consuming jfrader-ui

Published `@jfrader/ui` and `@jfrader/tokens` packages ship compiled ES modules and TypeScript declarations. The app does not compile the library's TSX or need Emotion's `jsxImportSource` for library internals.

## Dependencies

```sh
pnpm add @jfrader/ui @jfrader/tokens @emotion/react react react-dom
```

### Registry choice

npmjs is the zero-configuration default. GitHub Packages carries the same
verified tarball, but GitHub requires authentication even for public npm
packages:

```ini
@jfrader:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

Registry selection applies to the whole `@jfrader` scope; npm does not fall
back from GitHub Packages to npmjs. Projects that map that scope to GitHub must
authenticate there or use an explicit npmjs tarball URL for a package that is
not mirrored.

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

## Next.js App Router

Starting with the next release (0.1.2 planned; unreleased), every published `@jfrader/ui` module starts with `'use client'`. This makes top-level component exports renderable from Server Components with serializable props. Compose compound parts (e.g. `Dialog.Trigger`), render-prop callbacks and event handlers inside a Client Component; React's client-reference proxy rejects property access from Server Components.

### Emotion registry

Required. Without it the server renders inline `<style data-emotion>` tags next to components and hydration mismatches.

```sh
pnpm add @emotion/cache
```

```tsx
// app/emotion-registry.tsx
'use client';

import createCache from '@emotion/cache';
import { CacheProvider } from '@emotion/react';
import { useServerInsertedHTML } from 'next/navigation';
import { useState, type ReactNode } from 'react';

export function EmotionRegistry({ children }: { children: ReactNode }) {
  const [{ cache, flush }] = useState(() => {
    const cache = createCache({ key: 'css' });
    cache.compat = true;
    const insert = cache.insert;
    let pending: { name: string; isGlobal: boolean }[] = [];
    cache.insert = (...args) => {
      const [selector, serialized] = args;
      if (cache.inserted[serialized.name] === undefined) {
        pending.push({ name: serialized.name, isGlobal: !selector });
      }
      return insert(...args);
    };
    const flush = () => {
      const names = pending;
      pending = [];
      return names;
    };
    return { cache, flush };
  });

  useServerInsertedHTML(() => {
    const inserted = flush();
    if (inserted.length === 0) return null;
    const globals: { name: string; styles: string }[] = [];
    const names: string[] = [];
    let styles = '';
    for (const { name, isGlobal } of inserted) {
      const style = cache.inserted[name];
      if (typeof style !== 'string') continue;
      if (isGlobal) {
        globals.push({ name, styles: style });
      } else {
        names.push(name);
        styles += style;
      }
    }
    return (
      <>
        {globals.map(({ name, styles }) => (
          <style
            key={name}
            data-emotion={`${cache.key}-global ${name}`}
            dangerouslySetInnerHTML={{ __html: styles }}
          />
        ))}
        {names.length > 0 && (
          <style
            key={cache.key}
            data-emotion={`${cache.key} ${names.join(' ')}`}
            dangerouslySetInnerHTML={{ __html: styles }}
          />
        )}
      </>
    );
  });

  return <CacheProvider value={cache}>{children}</CacheProvider>;
}
```

Wrap the body in the root layout:

```tsx
// app/layout.tsx
import { EmotionRegistry } from './emotion-registry';

<body>
  <EmotionRegistry>{children}</EmotionRegistry>
</body>
```

Reference implementation: [saticket `apps/web/app/emotion-registry.tsx`](https://github.com/jfrader/saticket/blob/master/apps/web/app/emotion-registry.tsx) (available when PR #9 merges).
