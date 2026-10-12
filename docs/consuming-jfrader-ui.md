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

```tsx filename="src/main.tsx"
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

```html filename="index.html"
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

```tsx filename="app/layout.tsx"
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

```tsx filename="app/page.tsx"
import { Button } from '@jfrader/ui';

export default function Page() {
  return <Button tone="accent" sx={{ inlineSize: '100%' }}>Continue</Button>;
}
```

Use a Client Component for event handlers, hooks, theme callbacks, `styled`, or compound parts such as `Dialog.Trigger`. The published modules have a `'use client'` boundary; accessing a part on that client reference from a Server Component is not supported.

For example, put this in `app/settings-button.tsx` and render `<SettingsButton />` from your page:

```tsx filename="app/settings-button.tsx"
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

```ini filename=".npmrc"
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

## Editable details

`EditableDetails` presents labelled values in description lists, optionally grouped in nested
disclosures. It does not own values, validation, forms or persistence. Use `InlineEdit` for a single
string with its built-in save lifecycle; use `TreeView` for hierarchical navigation.

Put this in `ProjectDetails.tsx`. Pass the project's initial name, member count and an async
`persistName` function from your app. That function must reject when saving fails. The example
updates the displayed name only after saving succeeds. In Next.js, add `'use client'` at the top.

```tsx filename="ProjectDetails.tsx"
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
      <Button type="submit" loading={pending}>Save</Button>
      <Button type="button" onClick={cancel} disabled={pending}>Cancel</Button>
    </form>
  );
}

export function ProjectDetails({ initialName, memberCount, persistName }: {
  initialName: string;
  memberCount: number;
  persistName: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState(initialName);

  async function saveName(nextName: string) {
    await persistName(nextName);
    setName(nextName);
  }

  return (
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
    </EditableDetails>
  );
}
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

Next: [Theming](./theming.md) for light/dark and brand colors, or [Styling](./styling.md) for component overrides.
