# Styling

Use a component's props for built-in variants. Use tokens for changes shared across your app, and
`sx` or `styled` for one component. Complete the stylesheet setup in
[Getting started](./getting-started.md) first.

## Choose where to make the change

| You want to change… | Use |
| --- | --- |
| A Button's supported size, tone, or variant | Its `size`, `tone`, or `variant` prop. |
| Colors, spacing, or fonts across a section or app | [Theme tokens](./theming.md). |
| One component instance or public part | [`sx`](#change-one-instance-with-sx). No JSX configuration. |
| A styled component reused across the app | [`styled`](#reuse-styles-with-styled). No JSX configuration. |
| Several Emotion styles composed for `styled` | The [`css()`](#compose-styles-with-css) function. |
| An existing stylesheet | `className`, with normal CSS cascade rules. |

## Token references

`theme` from `@jfrader/ui` and `vars` from `@jfrader/tokens/vars` are the same object. Its values are
references, such as `theme.space[4]` → `var(--ui-space-4)`, and they resolve to the active palette
wherever the element renders.

Use semantic color roles: `text` for body text, `textMuted` for secondary text, `accentText` for
accent-colored text, `accent` for accent fills, and `accentContrast` for text on those fills. A fill
color is not necessarily readable as text. Put raw brand colors in your
[theme configuration](./theming.md).

The same properties work in plain CSS:

```css
.project-list {
  display: grid;
  gap: var(--ui-space-4);
  color: var(--ui-color-text);
}
```

Use logical properties such as `paddingInline` and `marginBlockEnd` so layouts also work
right-to-left.

## Change one instance with `sx`

Every public visual part accepts `sx`. It takes Emotion style objects, arrays, serialized styles, and
theme callbacks. A provider or context-only root renders no element, so it has nothing to style.

```tsx
import { Button, theme } from '@jfrader/ui';

const fullWidth = { inlineSize: '100%' };
const rounded = { borderRadius: theme.radius.full };

export function CreateProjectButton() {
  return <Button tone="accent" sx={[fullWidth, rounded]}>Create project</Button>;
}
```

`sx` works with ordinary React JSX. Token references imported from `theme` need no provider. Theme
callbacks do: mount `ThemeProvider` above them. `ThemeRoot` and the Next.js `EmotionRegistry` already
include one.

```tsx
import { Card, ThemeProvider } from '@jfrader/ui';

export function Plan() {
  return (
    <ThemeProvider>
      <Card>
        <Card.Header>
          <Card.Title sx={(theme) => ({ color: theme.color.accentText })}>
            Team plan
          </Card.Title>
        </Card.Header>
      </Card>
    </ThemeProvider>
  );
}
```

An `sx` callback receives the theme directly: `(theme) => styles`. A `styled` callback receives props:
`({ theme }) => styles`.

## Reuse styles with `styled`

Create reusable styled components at module scope, wrapping a library component or a native element:

```tsx
import { Button, Card, styled, ThemeProvider } from '@jfrader/ui';

const FeaturedCard = styled(Card)(({ theme }) => ({
  borderColor: theme.color.accentBorder,
  boxShadow: theme.shadow.overlay,
}));

const Actions = styled.div(({ theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.space[2],
}));

export function Plan() {
  return (
    <ThemeProvider>
      <FeaturedCard>
        <Card.Header><Card.Title>Team plan</Card.Title></Card.Header>
        <Card.Footer>
          <Actions>
            <Button tone="accent">Upgrade</Button>
            <Button variant="outline">Compare plans</Button>
          </Actions>
        </Card.Footer>
      </FeaturedCard>
    </ThemeProvider>
  );
}
```

`styled(Card)` styles the Card root. To change the title, style `Card.Title` separately, and keep
using `Card.Header`, `Card.Content`, and the other original parts inside your wrapper.

`ThemeProvider` renders no DOM. Its optional `theme` prop replaces the callback values; it does not
override the library's CSS variables. Use `ThemeRoot tokens` for those. A custom Emotion provider
belongs **inside** `ThemeRoot`, which mounts the default one.

`useTheme()` reads the same callback object. It needs a provider and returns CSS references, not
resolved colors or the active mode. For canvas drawing or another API that needs resolved colors, read
computed styles from the themed element.

## Style a part

Compound components expose the parts you render yourself. Apply `sx` to the part:

```tsx
import { Card, theme } from '@jfrader/ui';

const titleStyle = { color: theme.color.accentText };

export function ProjectCard() {
  return (
    <Card>
      <Card.Header>
        <Card.Title sx={titleStyle}>Research</Card.Title>
        <Card.Description>Notes and references</Card.Description>
      </Card.Header>
    </Card>
  );
}
```

Single widgets render their label, control, and icons internally. Reach those elements through the
documented `slotProps` instead of selectors that depend on internal markup:

```tsx
import { TextField, theme } from '@jfrader/ui';

const labelStyle = { color: theme.color.accentText };
const inputStyle = { borderRadius: theme.radius.full };

export function ProjectName() {
  return (
    <TextField
      label="Project name"
      placeholder="Untitled"
      slotProps={{ label: { sx: labelStyle }, control: { sx: inputStyle } }}
    />
  );
}
```

Slot names vary by component, and every slot takes `sx` with the same values as the component root.
On TextField, the top-level `sx` styles the field wrapper, not the label or the input.

## Compose styles with `css()`

`css()` builds serialized Emotion styles, the same values `sx` accepts, for reuse with `styled`:

```tsx
import { css } from '@emotion/react';
import { styled, Card, theme } from '@jfrader/ui';

const highlighted = css({ borderColor: theme.color.accentBorder });
const roomy = css({ paddingBlock: theme.space[6] });

const RoomierCard = styled(Card)([highlighted, roomy]);
```

`css()` returns serialized styles, not a class-name string. Inside the library the `css` prop is
internal: style component instances with `sx`, which needs no JSX configuration in your app.

## Style precedence

For one part, styles apply in this order:

1. Component defaults and visual props.
2. That part's `slotProps` styles.
3. Consumer `sx`.

Later values win when specificity and importance are equal. A rule on the root does not override a
different property on a child. External stylesheets, `!important`, inline `style`, and more specific
selectors keep their normal CSS behavior.

```tsx
import { Button, theme } from '@jfrader/ui';

export function RoundedButton() {
  return <Button sx={{ borderRadius: theme.radius.full }}>Invite</Button>;
}
```

The button takes the full radius from `sx`.

## Next.js boundaries

Use `styled`, `useTheme`, `css()`, and theme callbacks in Client Components under `EmotionRegistry`. A
Server Component can pass a serializable plain-object `sx`. See the complete layout in
[Getting started](./getting-started.md).

## Troubleshooting

| Symptom | Check |
| --- | --- |
| A style changes the wrapper but not its input | Use the documented control slot (`slotProps.control` on TextField), or the public input part. |
| A style loses to another override | Check which element owns the property, then precedence and CSS specificity. |
| `styled` reads undefined theme values | Mount `ThemeProvider`, `ThemeRoot`, or `EmotionRegistry` above it. |
| A CSS variable resolves differently in a popup | Check the nearest `ThemeRoot` and its `tokens`; ancestor CSS does not cross portals. See [Theming](./theming.md). |
