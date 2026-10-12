# Getting started

Add a component to a React app, then choose its theme and customize its styles.

## Install

In an existing **React 19** app, install the components and their stylesheet:

```sh
pnpm add @jfrader/ui @jfrader/tokens
```

`react` and `react-dom` must both satisfy `^19.0.0`. The published packages include compiled JavaScript and TypeScript declarations. Keep your app's normal React JSX configuration; you do not need Emotion's JSX runtime just to render the components or use `sx`.

Choose the setup for your app:

- [React / Vite](#react--vite): add styles and render your first component.
- [Next.js App Router](#nextjs-app-router): add the server-rendering registry.
- [Inside this monorepo](#workspace-apps): compile workspace source with Emotion's JSX runtime.

## React / Vite

Import the styles once in your entry file. `tokens.css` supplies the colors, spacing and other values used by every component. The optional `base.css` sets box sizing and the body's margin, background, text color and font.

This is a complete `src/main.tsx` for a Vite app whose `index.html` contains `<div id="root"></div>`:

```tsx
import { createRoot } from 'react-dom/client';
import { Button, Card, ThemeProvider } from '@jfrader/ui';
import '@jfrader/tokens/tokens.css';
import '@jfrader/tokens/base.css';

function App() {
  return (
    <Card>
      <Card.Header>
        <Card.Title>Your first project</Card.Title>
        <Card.Description>Keep your team's work in one place.</Card.Description>
      </Card.Header>
      <Card.Footer>
        <Button tone="accent">Create project</Button>
      </Card.Footer>
    </Card>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

createRoot(root).render(
  <ThemeProvider>
    <App />
  </ThemeProvider>,
);
```

You should see a card and an accent-colored button. The button has no action yet; add `onClick` when you connect it to your app.

`ThemeProvider` supplies token references to styling callbacks. The components above work without it, but keeping it at the app root lets you use `sx={(theme) => …}`, `styled` and `useTheme` later. It does **not** choose light or dark.

Set the initial palette on the existing `<html>` in `index.html`:

```html
<html lang="en" data-theme="light">
```

Use `dark` for the dark palette. Without an attribute, the token stylesheet defaults to dark. [Theming](./theming.md) explains switching at runtime, saved preferences and custom colors.

## Using components

Start with the component's props before adding custom styles. For example, `Button` has `variant`, `tone` and `size`:

```tsx
import { Button } from '@jfrader/ui';

export function Actions() {
  return (
    <>
      <Button tone="accent" size="lg">Save changes</Button>
      <Button variant="outline">Cancel</Button>
      <Button disabled>Unavailable</Button>
    </>
  );
}
```

The available values vary by component; check its prop table. Names such as `Card.Header` and `Card.Title` are public parts you compose inside the parent. Put content in the part that describes its job.

You can import from the package root or a component subpath, such as `import { Button } from '@jfrader/ui/button'`. Both export the component's prop types. `ThemeProvider`, `styled` and the other shared styling APIs come from the package root. `EmotionRegistry` comes from `@jfrader/ui/next` only.

### Let a component manage its value, or manage it yourself

Use `defaultValue` for an initial value the component can change. Use `value` and `onValueChange` together when the app owns it. For checked/open state, components use `checked` / `defaultChecked` / `onCheckedChange` and `open` / `defaultOpen` / `onOpenChange`.

```tsx
import { useState } from 'react';
import { Switch } from '@jfrader/ui';

export function NotificationSettings() {
  const [enabled, setEnabled] = useState(false);
  return (
    <Switch
      label="Email notifications"
      checked={enabled}
      onCheckedChange={setEnabled}
    />
  );
}
```

State callbacks receive the next value. Native handlers such as `onChange` still receive a React event. Do not switch a mounted instance between controlled and uncontrolled use.

## Next.js App Router

Install the packages above and `@emotion/cache` in your Next.js app. The adapter supports Next.js 15 and 16.

```sh
pnpm add @jfrader/ui @jfrader/tokens @emotion/cache
```

Put this in `app/layout.tsx`. `EmotionRegistry` collects styles during server rendering and already includes `ThemeProvider`:

```tsx
import type { ReactNode } from 'react';
import { EmotionRegistry } from '@jfrader/ui/next';
import '@jfrader/tokens/tokens.css';
import '@jfrader/tokens/base.css';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="light">
      <body>
        <EmotionRegistry>{children}</EmotionRegistry>
      </body>
    </html>
  );
}
```

Then a Server Component, such as `app/page.tsx`, can render a top-level component with serializable props:

```tsx
import { Button } from '@jfrader/ui';

export default function Page() {
  return <Button tone="accent" sx={{ inlineSize: '100%' }}>Continue</Button>;
}
```

Use a Client Component for event handlers, hooks, theme callbacks, `styled`, or compound parts such as `Dialog.Trigger`. The published modules have a `'use client'` boundary; accessing a part on that client reference from a Server Component is not supported.

For example, put this in `app/settings-button.tsx` and render `<SettingsButton />` from your page:

```tsx
'use client';

import { Dialog } from '@jfrader/ui';

export function SettingsButton() {
  return (
    <Dialog>
      <Dialog.Trigger>Settings</Dialog.Trigger>
      <Dialog.Content>
        <Dialog.Title>Settings</Dialog.Title>
        <Dialog.Description>Manage your account preferences.</Dialog.Description>
        <Dialog.Close>Close</Dialog.Close>
      </Dialog.Content>
    </Dialog>
  );
}
```

Plain-object `sx` props can cross the server boundary. Function-valued `sx` props cannot. Vite apps do not need `EmotionRegistry` or Next.js.

## Fonts and icons

The default font stack starts with Inter, but the library does not download it. Load your chosen font in the app. For Vite, you can install `@fontsource/inter` and import its `400.css`, `500.css` and `600.css` files in `src/main.tsx`.

For Next.js, add `Inter` from `next/font/google` to the layout above, using `variable: '--font-inter'`. Put its `variable` class on `<html>` and set `--ui-font-sans: var(--font-inter), ui-sans-serif, system-ui, sans-serif` in app CSS. [Theming](./theming.md) explains where CSS token overrides apply.

For icons, install `lucide-react` in your app or pass your own SVG. For example:

```tsx
import { Button } from '@jfrader/ui';
import { Inbox } from 'lucide-react';

export function InboxButton() {
  return <Button startIcon={<Inbox />}>Inbox</Button>;
}
```

A `Badge` count is not part of the wrapped control's accessible name. If the control has an `aria-label`, include the count, such as `aria-label="Inbox, 3 unread"`. With a visible text label, the count is read after that text.

## Workspace apps

This section is only for apps inside the jfrader-ui monorepo. Workspace exports point at `src/`, so these apps compile the library's TSX. Run `pnpm generate`, then configure Emotion's JSX runtime in both Vite and TypeScript, as shown in [Styling](./styling.md).

Published-package consumers do not need that configuration unless they use the `css` prop themselves. TypeScript's `strict` and `noUncheckedIndexedAccess` are repo conventions, not requirements for consumers.

## Registry choice

npmjs is the default and needs no configuration. GitHub Packages hosts the same verified tarball and requires authentication even for public packages. If you use it, put this in your app's `.npmrc`:

```ini
@jfrader:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

The setting applies to the entire `@jfrader` scope. npm does not fall back from GitHub Packages to npmjs. Authenticate there, or use an explicit npmjs tarball URL for a package that is not mirrored there.

## If the first component looks wrong

| Symptom | Check |
| --- | --- |
| Missing colors, spacing or borders | Import `@jfrader/tokens/tokens.css` once. |
| The page background does not match the components | Import the optional `base.css`, or set your app's body styles using the tokens. |
| `sx` works but `css` does not | Configure Emotion's JSX runtime in your app's compiler and TypeScript. See [Styling](./styling.md). |
| A theme callback has no token values | Add `ThemeProvider`, or use a `ThemeRoot` that includes it. |
| Next.js reports a hydration mismatch around style tags | Wrap the layout in `EmotionRegistry`. |

Next: [Theming](./theming.md) for light/dark and brand colors, or [Styling](./styling.md) for component overrides.
