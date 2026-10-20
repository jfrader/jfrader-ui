# Styling

Use a component's props for built-in variants. Use tokens for changes shared across your app, and `sx` or `styled` for a particular component. Complete the stylesheet setup in [Getting started](./consuming-jfrader-ui.md) first.

## Choose where to make the change

| You want to… | Use |
| --- | --- |
| Change a Button's supported size, tone or variant | Its `size`, `tone` or `variant` prop. |
| Change colors, spacing or fonts across a section or app | [Theme tokens](./theming.md). |
| Change one component instance or public part | [`sx`](#change-one-instance-with-sx). No special JSX setup. |
| Reuse a styled component throughout your app | [`styled`](#reuse-styles-with-styled). No special JSX setup. |
| Compose Emotion styles for `styled` | The [`css()`](#compose-styles-with-css) function. |
| Use an existing stylesheet | `className`, with normal CSS cascade rules. |

## Token references

`theme` from `@jfrader/ui` and `vars` from `@jfrader/tokens/vars` are the same object. Its values are references, such as `theme.space[4]` → `var(--ui-space-4)`. They resolve to the active CSS palette wherever the element renders.

Use semantic color roles: `text` for body text, `textMuted` for secondary text, `accentText` for accent-colored text, `accent` for accent fills, and `accentContrast` for text on those fills. A fill color is not necessarily readable as text. Put raw brand colors in your [theme configuration](./theming.md).

In regular CSS, use the same properties directly:

```css
.project-list {
  display: grid;
  gap: var(--ui-space-4);
  color: var(--ui-color-text);
}
```

Use logical properties such as `paddingInline` and `marginBlockEnd` so layouts also work right-to-left.

## Change one instance with sx

Every public visual component part accepts `sx`. It supports Emotion style objects, arrays, serialized styles and theme callbacks. A provider or context-only root that renders no element has nothing to style.

```tsx
import { Button, theme } from '@jfrader/ui';

const fullWidth = { inlineSize: '100%' };
const rounded = { borderRadius: theme.radius.full };

export function CreateProjectButton() {
  return <Button tone="accent" sx={[fullWidth, rounded]}>Create project</Button>;
}
```

`sx` works with ordinary React JSX. You can use token references imported from `theme` without a provider. For callbacks that receive `theme`, mount `ThemeProvider` above them. `ThemeRoot` and the Next.js `EmotionRegistry` already include one:

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

`sx` callbacks receive the theme directly: `(theme) => styles`. A `styled` callback receives props: `({ theme }) => styles`.

## Reuse styles with styled

Create reusable styled components at module scope. Wrap a library component or a native element:

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

`styled(Card)` styles the Card root. Style `Card.Title` separately if you want to change the title. Keep using `Card.Header`, `Card.Content` and the other original parts inside your wrapper.

`ThemeProvider` renders no DOM. Its optional `theme` prop replaces the callback values; it does not override the library's CSS variables. Use `ThemeRoot tokens` to customize those. If you need a custom Emotion provider alongside `ThemeRoot`, place it **inside** the root, since the root mounts the default provider.

`useTheme()` reads the same callback object. It needs a provider and returns CSS references, not resolved hex values or the active mode. For canvas drawing or another API that needs resolved colors, read computed styles from the themed element.

## Style a part

Compound components expose parts you render yourself. Apply `sx` to that part:

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

Single widgets often render their label, input or icons internally. Use their documented `slotProps` to reach those elements, rather than selectors that depend on internal markup:

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

Slot names vary by component. Every slot takes `sx`, with the same values as the public component root. Styles apply in order: own styles, slot `sx`, then consumer `sx`. For TextField, the top-level `sx` styles the input wrapper, not the label or input itself.

## Compose styles with `css()`

`css()` builds serialized Emotion styles — the same values `sx` accepts — for reuse with `styled`:

```tsx
import { css } from '@emotion/react';
import { styled, Card, theme } from '@jfrader/ui';

const highlighted = css({ borderColor: theme.color.accentBorder });
const roomy = css({ paddingBlock: theme.space[6] });

const RoomierCard = styled(Card)([highlighted, roomy]);
```

`css()` returns serialized styles, not a class-name string. The Emotion `css` prop is internal to the library: style component instances with `sx` instead, which needs no JSX configuration in your app.

## Which style wins?

For the same part, the library composes styles in this order:

1. Component defaults and visual props.
2. That part's `slotProps` styles, when available.
3. Consumer `sx`.

Later values win when CSS specificity and importance are equal. A rule on the root does not override a different property on a child. Normal CSS rules still apply to external stylesheets, `!important`, inline `style` and more-specific selectors.

For example, with the JSX configuration above:

```tsx
import { Button, theme } from '@jfrader/ui';

export function RoundedButton() {
  return (
    <Button sx={{ borderRadius: theme.radius.full }}>
      Invite
    </Button>
  );
}
```

The button uses the full radius from `sx`.

## Next.js boundaries

Use `styled`, `useTheme`, `css()` and theme callbacks in Client Components under `EmotionRegistry`. A Server Component can pass a serializable plain-object `sx`. See the complete layout in [Getting started](./consuming-jfrader-ui.md).

## Troubleshooting

| Symptom | Check |
| --- | --- |
| A style changes the wrapper but not its input | Use the documented control slot (`slotProps.control` on TextField), or its public input part. |
| A style loses to another override | Check which element owns the property, then composition order and CSS specificity. |
| `styled` has undefined theme values | Mount `ThemeProvider`, `ThemeRoot` or `EmotionRegistry` above it. |
| A CSS variable resolves differently in a popup | Check the nearest `ThemeRoot` and its `tokens`; ancestor-only CSS does not cross portals. See [Theming](./theming.md). |
