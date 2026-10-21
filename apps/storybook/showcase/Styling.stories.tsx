import type { CSSProperties } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { css } from '@emotion/react';
import { expect, fn, userEvent, within } from 'storybook/test';
import { Button, Card, Dialog, ThemeProvider, styled, theme } from '@jfrader/ui';
import { WithSx } from '../../../packages/ui/src/styling/sx';

const COLUMN_INLINE_SIZE = '320px';

const columnStyle = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: theme.space[3],
  inlineSize: COLUMN_INLINE_SIZE,
} satisfies CSSProperties;

const FeaturedCard = styled(Card)(({ theme }) => ({
  borderColor: theme.color.accentBorder,
  boxShadow: theme.shadow.overlay,
}));
FeaturedCard.displayName = 'FeaturedCard';

const SmallCornersButton = styled(Button)({ borderRadius: theme.radius.sm });
SmallCornersButton.displayName = 'SmallCornersButton';
const highlightStyle = css({ borderColor: theme.color.accentBorder });
const roomyStyle = css({ paddingBlock: theme.space[6] });
const RoomierCard = styled(Card)([highlightStyle, roomyStyle]);
RoomierCard.displayName = 'RoomierCard';

/** The computed form of a token reference for `property`, read from a throwaway probe element. */
function resolveToken(container: HTMLElement, property: string, value: string) {
  const probe = container.ownerDocument.createElement('span');
  probe.style.setProperty(property, value);
  container.append(probe);
  const resolved = getComputedStyle(probe).getPropertyValue(property);
  probe.remove();
  return resolved;
}

const meta = {
  title: 'Foundations/Styling',
  tags: ['!autodocs'],
  decorators: [
    (Story) => (
      <ThemeProvider>
        <Story />
      </ThemeProvider>
    ),
  ],
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const StyledWithTheme: Story = {
  parameters: {
    docs: {
      source: {
        code: `const FeaturedCard = styled(Card)(({ theme }) => ({
  borderColor: theme.color.accentBorder,
  boxShadow: theme.shadow.overlay,
}));

<FeaturedCard>
  <Card.Header>
    <Card.Title>Team plan</Card.Title>
    <Card.Description>Shared projects for up to 20 members.</Card.Description>
  </Card.Header>
  <Card.Footer><Button tone="accent">Upgrade</Button></Card.Footer>
</FeaturedCard>`,
      },
    },
  },
  render: () => (
    <FeaturedCard>
      <Card.Header>
        <Card.Title>Team plan</Card.Title>
        <Card.Description>Shared projects for up to 20 members.</Card.Description>
      </Card.Header>
      <Card.Footer>
        <Button tone="accent">Upgrade</Button>
      </Card.Footer>
    </FeaturedCard>
  ),
  play: async ({ canvasElement }) => {
    const card = canvasElement.querySelector<HTMLElement>('[data-ui="card"]')!;
    const borderColor = getComputedStyle(card).borderTopColor;
    await expect(borderColor).toBe(resolveToken(canvasElement, 'border-top-color', theme.color.accentBorder));
    await expect(borderColor).not.toBe(resolveToken(canvasElement, 'border-top-color', theme.color.border));
  },
};

export const SxOneOffs: Story = {
  parameters: {
    docs: {
      source: {
        code: `<div style={{ display: 'flex', flexDirection: 'column', gap: theme.space[3], inlineSize: '320px' }}>
  <Button tone="accent" sx={{ inlineSize: '100%' }}>Create project</Button>
  <Button sx={{ borderRadius: theme.radius.full }}>Invite</Button>
</div>`,
      },
    },
  },
  render: () => (
    <div style={columnStyle}>
      <Button tone="accent" sx={{ inlineSize: '100%' }}>
        Create project
      </Button>
      <Button sx={{ borderRadius: theme.radius.full }}>Invite</Button>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const fullWidth = canvas.getByRole('button', { name: 'Create project' });
    const rounded = canvas.getByRole('button', { name: 'Invite' });
    await expect(fullWidth.getBoundingClientRect().width).toBe(fullWidth.parentElement!.getBoundingClientRect().width);
    await expect(getComputedStyle(rounded).borderTopLeftRadius).toBe(
      resolveToken(canvasElement, 'border-top-left-radius', theme.radius.full),
    );
  },
};

export const SxOverStyled: Story = {
  parameters: {
    docs: {
      source: {
        code: `const SmallCornersButton = styled(Button)({ borderRadius: theme.radius.sm });

<>
  <SmallCornersButton sx={{ borderRadius: theme.radius.full }}>Rounded</SmallCornersButton>
  <SmallCornersButton>Small corners</SmallCornersButton>
  <Button>Default corners</Button>
</>`,
      },
    },
  },
  render: () => (
    <div style={columnStyle}>
      <SmallCornersButton sx={{ borderRadius: theme.radius.full }}>Rounded</SmallCornersButton>
      <SmallCornersButton>Small corners</SmallCornersButton>
      <Button>Default corners</Button>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(getComputedStyle(canvas.getByRole('button', { name: 'Rounded' })).borderTopLeftRadius).toBe(
      resolveToken(canvasElement, 'border-top-left-radius', theme.radius.full),
    );
    await expect(getComputedStyle(canvas.getByRole('button', { name: 'Small corners' })).borderTopLeftRadius).toBe(
      resolveToken(canvasElement, 'border-top-left-radius', theme.radius.sm),
    );
    const defaultRadius = getComputedStyle(canvas.getByRole('button', { name: 'Default corners' })).borderTopLeftRadius;
    await expect(defaultRadius).toBe(resolveToken(canvasElement, 'border-top-left-radius', theme.radius.md));
    await expect(defaultRadius).not.toBe(resolveToken(canvasElement, 'border-top-left-radius', theme.radius.sm));
    await expect(defaultRadius).not.toBe(resolveToken(canvasElement, 'border-top-left-radius', theme.radius.full));
    await expect(resolveToken(canvasElement, 'border-top-left-radius', theme.radius.sm)).not.toBe(
      resolveToken(canvasElement, 'border-top-left-radius', theme.radius.full),
    );
  },
};

const preservedInputRef = fn<(element: HTMLInputElement | null) => void>();

function SxToggleProbe() {
  const [styled, setStyled] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setStyled((value) => !value)}>
        Toggle sx
      </button>
      <WithSx sx={styled ? highlightStyle : undefined}>
        {(className) => <input ref={preservedInputRef} aria-label="Preserved input" className={className} defaultValue="Preserved" />}
      </WithSx>
    </div>
  );
}
SxToggleProbe.displayName = 'SxToggleProbe';

export const UndefinedSxParity: Story = {
  parameters: {
    docs: {
      source: {
        code: `<WithSx sx={undefined}>
  {(className) => <input className={className} aria-label="Preserved input" defaultValue="Preserved" />}
</WithSx>`,
      },
    },
  },
  render: () => (
    <div>
      <WithSx styles={highlightStyle}>
        {(className) => <span data-testid="omitted-sx" className={className} />}
      </WithSx>
      <WithSx className={undefined} styles={highlightStyle} sx={undefined}>
        {(className) => <span data-testid="undefined-sx" className={className} />}
      </WithSx>
      <WithSx className="consumer">
        {(className) => <span data-testid="consumer-class" className={className} />}
      </WithSx>
      <SxToggleProbe />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const omitted = canvas.getByTestId('omitted-sx');
    const explicitUndefined = canvas.getByTestId('undefined-sx');
    await expect(explicitUndefined.tagName).toBe(omitted.tagName);
    await expect(explicitUndefined.className).toBe(omitted.className);
    await expect(getComputedStyle(explicitUndefined).borderTopColor).toBe(getComputedStyle(omitted).borderTopColor);
    await expect(getComputedStyle(explicitUndefined).borderTopColor).toBe(
      resolveToken(canvasElement, 'border-top-color', theme.color.accentBorder),
    );
    await expect(explicitUndefined).not.toHaveAttribute('sx');
    await expect(canvas.getByTestId('consumer-class')).toHaveClass('consumer');
    const input = canvas.getByRole('textbox', { name: 'Preserved input' });
    const toggle = canvas.getByRole('button', { name: 'Toggle sx' });
    await expect(preservedInputRef).toHaveBeenLastCalledWith(input);
    const refCalls = preservedInputRef.mock.calls.length;
    const initialBorderColor = getComputedStyle(input).borderTopColor;
    await userEvent.clear(input);
    await userEvent.type(input, 'Edited value');
    await userEvent.click(toggle);
    await expect(canvas.getByRole('textbox', { name: 'Preserved input' })).toBe(input);
    await expect(input).toHaveValue('Edited value');
    await expect(getComputedStyle(input).borderTopColor).toBe(
      resolveToken(canvasElement, 'border-top-color', theme.color.accentBorder),
    );
    await userEvent.click(toggle);
    await expect(canvas.getByRole('textbox', { name: 'Preserved input' })).toBe(input);
    await expect(input).toHaveValue('Edited value');
    await expect(getComputedStyle(input).borderTopColor).toBe(initialBorderColor);
    await expect(preservedInputRef).toHaveBeenCalledTimes(refCalls);
  },
};

export const RenderPathParity: Story = {
  parameters: {
    docs: {
      source: {
        code: `<>
  <Button render={(props) => <a {...props} href="#button-render" />}>Rendered link</Button>
  <Dialog>
    <Dialog.Trigger render={(props) => <Button {...props} />}>Rendered trigger</Dialog.Trigger>
  </Dialog>
</>`,
      },
    },
  },
  render: () => (
    <div style={columnStyle}>
      <Button render={(props) => <a {...props} href="#button-render" />}>
        Rendered link
      </Button>
      <Dialog>
        <Dialog.Trigger render={(props) => <Button {...props} />}>
          Rendered trigger
        </Dialog.Trigger>
      </Dialog>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const link = canvas.getByRole('link', { name: 'Rendered link' });
    const trigger = canvas.getByRole('button', { name: 'Rendered trigger' });
    await expect(link.className.split(/\s+/)).not.toContain('css-0');
    await expect(getComputedStyle(link).borderTopLeftRadius).toBe(
      resolveToken(canvasElement, 'border-top-left-radius', theme.radius.md),
    );
    await expect(trigger.className.split(/\s+/)).not.toContain('css-0');
    await expect(getComputedStyle(trigger).borderTopLeftRadius).toBe(
      resolveToken(canvasElement, 'border-top-left-radius', theme.radius.md),
    );
  },
};

export const CssFunctionWithStyled: Story = {
  parameters: {
    docs: {
      source: {
        code: `const highlightStyle = css({ borderColor: theme.color.accentBorder });
const roomyStyle = css({ paddingBlock: theme.space[6] });
const RoomierCard = styled(Card)([highlightStyle, roomyStyle]);

<RoomierCard>
  <Card.Header>
    <Card.Title>Usage</Card.Title>
    <Card.Description>12 of 20 seats in use.</Card.Description>
  </Card.Header>
</RoomierCard>`,
      },
    },
  },
  render: () => (
    <RoomierCard>
      <Card.Header>
        <Card.Title>Usage</Card.Title>
        <Card.Description>12 of 20 seats in use.</Card.Description>
      </Card.Header>
    </RoomierCard>
  ),
  play: async ({ canvasElement }) => {
    const card = canvasElement.querySelector<HTMLElement>('[data-ui="card"]')!;
    const computed = getComputedStyle(card);
    await expect(computed.borderTopColor).toBe(
      resolveToken(canvasElement, 'border-top-color', theme.color.accentBorder),
    );
    await expect(computed.paddingTop).toBe(resolveToken(canvasElement, 'padding-top', theme.space[6]));
  },
};
