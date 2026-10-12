# Consuming jfrader-ui

Add `@jfrader/ui` and `@jfrader/tokens` to your React app. The published packages include compiled ES modules and TypeScript declarations; your app does not compile the library's TSX or need Emotion's `jsxImportSource` for its internals.

## Dependencies

```sh
pnpm add @jfrader/ui @jfrader/tokens @emotion/react react react-dom
```

`@jfrader/ui` requires React 19 (`react` and `react-dom` `^19.0.0`): components take `ref` as a regular prop.

### Registry choice

npmjs is the default and needs no configuration. GitHub Packages hosts the same
verified tarball and requires authentication even for public npm packages:

```ini
@jfrader:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

The registry setting applies to the whole `@jfrader` scope. npm does not fall
back from GitHub Packages to npmjs. If your project uses GitHub for that scope,
authenticate there. For a package not mirrored there, use an explicit npmjs
tarball URL.

## Published packages

Use your app's normal React JSX configuration. Configure Emotion's `jsxImportSource` only if the app itself uses Emotion's `css` prop.

<a id="in-repo-workspace-development"></a>

## Workspace apps

Inside this repo, packages export TypeScript and TSX from `src/`. Your app must compile that source with Emotion's JSX runtime. Run `pnpm generate` before starting the app.

Use these Vite and TypeScript settings for workspace apps or apps that use Emotion's `css` prop.

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

This repo also sets `strict` and `noUncheckedIndexedAccess`. Your app does not need those settings.

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

### Custom palettes

Use `createTheme` to derive accent colors from one hex color. Pass the result to `ThemeRoot tokens` to override the palette for that subtree.

```tsx
import { createTheme, ThemeRoot } from '@jfrader/ui';

const brand = createTheme({ base: 'dark', accent: '#7c3aed' });

<ThemeRoot theme="dark" tokens={brand}>{/* brand accent in here */}</ThemeRoot>;
```

- `base` chooses the dark or light derivation. Match it to the root's `theme`.
- `accent` sets `accentHover`, `accentText`, `accentSoft`, `accentSoftHover`, `accentBorder`, `accentContrast`, and `focusRing`. The focus ring uses the accent color.
- `tokens` merges your overrides over the derived values. Your value wins for each token path.
- On light, `accentText` limits lightness for AA contrast on white. On dark, it uses the accent unchanged; a dark accent may be unreadable as text.
- `accentContrast` picks near-black or white, whichever has higher contrast against the accent. Accents with relative luminance around 0.17–0.22 fall below 4.5:1 against both. Pick a darker or lighter accent, or set `accentContrast` yourself.
- `accent` accepts `#rgb` or `#rrggbb`. Other formats throw.
- Overrides are inline custom properties on the scope root. Changing the named palette needs no re-render; portaled overlays carry the scope's tokens.
- For document-level themes on `<html>`, call `themeTokenStyle(createTheme({ base, accent }))`. Serialize its custom-property map into one CSS block per base under your `data-theme` selectors.

### Contrast surfaces

A contrast surface uses the dark palette with a charcoal background on either page theme. `Drawer.Panel` uses it by default. Set `appearance="contrast"` on `Card` to use it there.

```tsx
<Card appearance="contrast">{/* dark palette, charcoal background */}</Card>
<Card>{/* enclosing palette */}</Card>
```

- The palette sets text, borders, control boundaries, wells and native `color-scheme` inside the surface.
- A Select, Menu or Popover opened inside a contrast surface keeps its palette through portals.
- Omit `appearance` on a nested Card to inherit the enclosing palette. `appearance="default"` keeps the enclosing theme; it does not restore the outer page theme.
- To switch a section inside a contrast surface to light, wrap it in `ThemeRoot theme="light"`.
- For an overlay host, give `ThemeRoot` the enclosing theme and set `portalContainer`. Keeping the same theme preserves the appearance for its overlays.

<a id="scoped-theming-and-overlays"></a>

### Themes in overlays

Select, Combobox, Menu, Popover, Tooltip, DatePicker and Toast portal their content to `body`. They keep the nearest scope's theme and appearance, including changes made while open. Dialog renders in place and inherits them directly.

The named theme, appearance, and `ThemeRoot tokens` carry over. Other ancestor CSS, such as a `--ui-*` variable set on a wrapper, does not reach portaled content.

Set `portalContainer` on `ThemeRoot` to keep overlays inside a modal `<dialog>`'s top layer or an embedded widget's element:

```tsx
const [overlayHost, setOverlayHost] = useState<HTMLElement | null>(null);

<ThemeRoot theme="light" portalContainer={overlayHost}>
  <Select>{/* … */}</Select>
  <div ref={setOverlayHost} />
</ThemeRoot>;
```

- Omitted: overlays use the enclosing `ThemeRoot`'s container, or `body`.
- `null`: overlays render once the element is set.
- An element: overlays render into it. Set it once; switching to a different element later is not supported.

## Styling your app

Style app code with `styled`, `sx` and the `css` prop. Their values come from the token `theme`, so they follow `data-theme` and `ThemeRoot` without re-rendering.

### `styled` and the theme

```tsx
import { Card, styled } from '@jfrader/ui';

const FeaturedCard = styled(Card)(({ theme }) => ({
  borderColor: theme.color.accentBorder,
  boxShadow: theme.shadow.overlay,
}));

const Toolbar = styled.div(({ theme }) => ({
  display: 'flex',
  gap: theme.space[2],
}));
```

`({ theme })` needs a `ThemeProvider` above the component. `ThemeRoot` mounts one. Without `ThemeRoot`, wrap the app:

```tsx
import { ThemeProvider } from '@jfrader/ui';

<ThemeProvider>{children}</ThemeProvider>;
```

A custom `ThemeProvider` must go inside `ThemeRoot` (or replace it): `ThemeRoot` mounts the default provider, overriding an outer custom one.

`useTheme()` returns the same object inside components:

```tsx
import { useTheme } from '@jfrader/ui';

function Sparkline({ points }: { points: string }) {
  const theme = useTheme();
  return (
    <svg viewBox="0 0 100 20" aria-hidden="true">
      <polyline points={points} fill="none" style={{ stroke: theme.color.accent }} />
    </svg>
  );
}
```

### `sx`

Use `sx` to override styles on any public component or part that renders an element. Context/provider components render no DOM and take no `sx`. `sx` accepts the same values as `css`, including theme callbacks, and needs no JSX configuration:

```tsx
<Button sx={{ inlineSize: '100%' }}>Create project</Button>
<Card.Title sx={(theme) => ({ color: theme.color.accentText })}>Team plan</Card.Title>
```

Styles apply in this order, with later styles winning: component styles → `slotProps` → `css` → `sx`.

### `css` prop

The `css` prop needs Emotion's `jsxImportSource` (see [Vite](#vite) and [tsconfig](#tsconfig)). Compose module-level styles in arrays:

```tsx
import { css } from '@emotion/react';
import { Card, theme } from '@jfrader/ui';

const highlight = css({ borderColor: theme.color.accentBorder });
const roomy = css({ paddingBlock: theme.space[6] });

<Card css={[highlight, roomy]} />;
```

### Tokens

Use values from `theme` (the same object as `vars` from `@jfrader/tokens/vars`). Each value is a `var(--ui-*)` reference. Do not write raw hex or rgb values.

### Next.js

`styled`, the `css` prop, `useTheme` and `ThemeProvider` run Emotion where they are used, so use them in Client Components (`'use client'`) under the [Emotion registry](#emotion-registry). Server Components can pass a plain-object `sx`; theme callbacks are functions and only work from Client Components.

## Icons

Use named imports from [Lucide](https://lucide.dev) for control icons:

```sh
pnpm add lucide-react
```

```tsx
import { Inbox } from 'lucide-react';

<Button startIcon={<Inbox />}>Inbox</Button>;
```

You can use your own SVG instead. Keep brand artwork in your app.

## Editable details

`EditableDetails` presents labelled values in description lists, optionally grouped in nested
disclosures. It does not own values, validation, forms or persistence. Use `InlineEdit` for a single
string with its built-in save lifecycle; use `TreeView` for hierarchical navigation.

```tsx
import { useState } from 'react';
import { Button, EditableDetails, TextField, type EditableDetailsEditorProps } from '@jfrader/ui';

function NameEditor({
  initialFocusRef, complete, cancel, name, onSave,
}: EditableDetailsEditorProps & { name: string; onSave: (name: string) => Promise<void> }) {
  const [draft, setDraft] = useState(name);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  return (
    <form onSubmit={async (event) => {
      event.preventDefault();
      if (pending) return;
      setPending(true);
      setError('');
      try {
        await onSave(draft);
        complete();
      } catch {
        setError('Could not save. Try again.');
      } finally {
        setPending(false);
      }
    }}>
      <TextField ref={initialFocusRef} label="Name" value={draft}
        onValueChange={setDraft} required readOnly={pending} error={error} />
      <Button type="submit" disabled={pending}>Save</Button>
      <Button type="button" onClick={cancel} disabled={pending}>Cancel</Button>
    </form>
  );
}

<EditableDetails messages={{ edit: 'Edit' }}>
  <EditableDetails.Section title="Project" headingLevel={2} defaultOpen>
    <EditableDetails.List>
      <EditableDetails.Item label="Name" renderEditor={(editor) => (
        <NameEditor {...editor} name={name} onSave={saveName} />
      )}>
        {name}
      </EditableDetails.Item>
      <EditableDetails.Item label="Members">{memberCount}</EditableDetails.Item>
    </EditableDetails.List>
  </EditableDetails.Section>
</EditableDetails>;
```

Update the app's saved value inside `saveName`; `complete()` only requests closure. Hooks belong in
the returned editor component, not in `renderEditor`. Editors can use unrelated scalar or object
types; the module never parses the summary. Return normal React content for zero, false and empty
values. Supply readable boolean labels and missing-value placeholders in the application.

- `Section` and `Item` each support `open`, `defaultOpen` (default `false`) and `onOpenChange`.
  Controlled requests do not commit until their prop changes. Multiple editors may remain open.
- A closed Section hides its mounted panel. Drafts, nested disclosure state and pending work remain;
  unopened editors are not mounted. Reopening the Section does not move focus into the editor.
- `complete` and `cancel` request close, without validation, submission or resetting fields. A
  rejected controlled close retains the same session. Do not clear drafts on a close request.
- Accepted close unmounts the editor. Removed capabilities and changed keys end that lifetime;
  old callbacks cannot close a later editor. Capability removal also clears pending Edit focus
  intent, even if the open request was not accepted. Apps still own cancellation of network requests.
- Stable React keys, not labels or list indexes, preserve row identity across reorder/translation.
  Keep Sections beside Lists; a List contains Items, whose native terms/descriptions name the rows.
- Section headings use the caller's `headingLevel`. Panels are not region landmarks by default.
  Refs target the root `div`, Section `section`, List `dl`, and Item row `div` respectively.

### Forms and Actions

The module creates no form. Do not put a supplied native form inside another form. Inside an existing
form, render a non-form editor or form-associated controls targeting a separate form. Disclosure and
Edit actions are `type="button"` and do not submit that surrounding form.

React function-valued Actions reset uncontrolled fields after successful resolution, including a
returned validation-error result or a save whose close request the parent rejects. Use controlled
fields (or explicitly restore them) in Action editors. Preserving a mounted editor is not an
independent backup of its values. The `Showcase/EditableDetails` stories exercise native forms,
grouped values, RHF submission/errors/focus, and controlled Action drafts. RHF is only a workbench
development dependency, not a library runtime or peer requirement.

### Keyboard and focus

Tab and Shift+Tab follow native order. Enter/Space activate disclosure and Edit buttons. Editors own
Enter, Escape, arrows and IME behavior; the module does not intercept those keys or save on blur.

An accepted Edit interaction focuses `initialFocusRef`, or the row's named editor group if that
target cannot take focus. The group has a visible outline and `tabIndex={-1}`, not a normal Tab stop.
Initial `defaultOpen` and unrelated external opens do not steal focus. Accepted completion/cancellation
returns focus only while it still belongs to the editor. Collapsing a focused panel or removing a
focused row falls back to a surviving visible ancestor disclosure; unrelated focus stays untouched.

### Portaled and top-layer editors

`visible` reflects accepted visibility through every enclosing Section. Use it to gate picker or
dialog visibility without resetting the draft: `<Popover open={visible && pickerOpen}>`.
DOM hiding does not hide portals or the native top layer.

Control the Section's `open` state and expose its `triggerRef` when coordinating overlays:

1. At the actual collapse, check whether your overlay contains its document's active element.
2. Dismiss it and suppress restoration to a hidden invoker. For native dialogs, call `close()` before
   hiding the invoker, releasing the top layer and its inert background first.
3. Move focus to the nearest still-visible Section trigger only if that overlay owned focus.
4. Accept the Section close and gate the overlay with `visible` as a final safeguard.

The library handles DOM-descendant focus, not arbitrary external portal ownership. The runnable
`Showcase/EditableDetails overlays` recipes cover a portaled Popover picker, native modal dialog,
retained drafts and focus that has already moved elsewhere.

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

The package build marks every `@jfrader/ui` module with `'use client'`. Server Components can render top-level component exports with serializable props.

Use compound parts (e.g. `Dialog.Trigger`), render-prop callbacks and event handlers inside a Client Component. React rejects property access on client references from Server Components.

### Emotion registry

Wrap the App Router layout in `EmotionRegistry` to collect Emotion styles during server rendering and avoid hydration mismatches. Install `@emotion/cache` alongside Next.js:

```sh
pnpm add @emotion/cache
```

```tsx
// app/layout.tsx
import { EmotionRegistry } from '@jfrader/ui/next';

<body>
  <EmotionRegistry>{children}</EmotionRegistry>
</body>
```

The adapter manages the Emotion cache, flushes styles through `useServerInsertedHTML`, and mounts `ThemeProvider`. The optional `next` peer is used only by this subpath. Source: `packages/ui/src/components/next/emotion-registry.tsx`.
