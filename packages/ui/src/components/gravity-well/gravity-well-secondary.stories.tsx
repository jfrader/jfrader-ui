import { StrictMode, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, waitFor } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { styled } from '../../styling/styled';
import { GravityWell, type GravityWellItem } from './index';
import { Button } from '../button';

const Frame = styled.div({
  display: 'grid',
  gap: vars.space[4],
  inlineSize: '100%',
  maxInlineSize: '640px',
});

const defaultItems: readonly GravityWellItem[] = [
  { id: 'item-1', content: 'Alpha' },
  { id: 'item-2', content: 'Beta' },
  { id: 'item-3', content: 'Gamma' },
  { id: 'item-4', content: 'Delta' },
  { id: 'item-5', content: 'Epsilon' },
  { id: 'item-6', content: 'Zeta' },
  { id: 'item-7', content: 'Eta' },
  { id: 'item-8', content: 'Theta' },
  { id: 'item-9', content: 'Iota' },
];

const raggedItems: readonly GravityWellItem[] = [
  { id: 'r-1', content: 'R1' },
  { id: 'r-2', content: 'R2' },
  { id: 'r-3', content: 'R3' },
  { id: 'r-4', content: 'R4' },
  { id: 'r-5', content: 'R5' },
  { id: 'r-6', content: 'R6' },
];

const controlLabels = {
  pause: 'Pause motion',
  resume: 'Resume motion',
};

const meta = {
  title: 'Showcase/GravityWell',
  component: GravityWell,
  tags: ['!autodocs'],
  args: {
    items: defaultItems,
    columns: 3,
    label: 'Keyboard and state test well',
    controlLabels,
    onPulse: fn(),
    onValueChange: fn(),
    onPausedChange: fn(),
  },
  parameters: {
    docs: {
      description: {
        component:
          'Secondary integration stories and regression tests for GravityWell.',
      },
    },
  },
  render: (args) => (
    <Frame>
      <GravityWell {...args} />
    </Frame>
  ),
} satisfies Meta<typeof GravityWell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Keyboard: Story = {
  play: async ({ canvas, userEvent, canvasElement, args }) => {
    const field = canvasElement.querySelector(
      '[data-ui="gravity-well-field"]',
    ) as HTMLElement;
    expect(field).toBeInTheDocument();

    // Forward Tab enters field
    await userEvent.tab();
    expect(field.ownerDocument.activeElement).toBe(field);
    expect(window.getComputedStyle(field).outlineStyle).not.toBe('none');
    await expect(canvas.getByRole('listitem', { current: true })).toHaveTextContent('Alpha');

    // Arrow navigation
    await userEvent.keyboard('{ArrowRight}');
    expect(args.onValueChange).toHaveBeenCalledWith('item-2');
    await expect(canvas.getByRole('listitem', { current: true })).toHaveTextContent('Beta');
    await expect(canvas.getByText('Alpha').closest('li')).not.toHaveAttribute('aria-current');

    await userEvent.keyboard('{ArrowDown}');
    expect(args.onValueChange).toHaveBeenCalledWith('item-5');

    await userEvent.keyboard('{ArrowLeft}');
    expect(args.onValueChange).toHaveBeenCalledWith('item-4');

    await userEvent.keyboard('{ArrowUp}');
    expect(args.onValueChange).toHaveBeenCalledWith('item-1');

    // Boundary move no-op: ArrowUp at top row doesn't call onValueChange
    await userEvent.keyboard('{ArrowUp}');
    expect(args.onValueChange).toHaveBeenCalledTimes(4);

    // End and Home navigation
    await userEvent.keyboard('{End}');
    expect(args.onValueChange).toHaveBeenCalledWith('item-9');

    // Boundary move no-op at End
    await userEvent.keyboard('{End}');
    expect(args.onValueChange).toHaveBeenCalledTimes(5);

    await userEvent.keyboard('{Home}');
    expect(args.onValueChange).toHaveBeenCalledWith('item-1');

    // Boundary move no-op at Home
    await userEvent.keyboard('{Home}');
    expect(args.onValueChange).toHaveBeenCalledTimes(6);

    // Enter pulse
    await userEvent.keyboard('{Enter}');
    expect(args.onPulse).toHaveBeenCalledTimes(1);
    expect(args.onPulse).toHaveBeenCalledWith(
      expect.objectContaining({ itemId: 'item-1' }),
    );

    // Space pulse
    await userEvent.keyboard(' ');
    expect(args.onPulse).toHaveBeenCalledTimes(2);
    const repeat = new KeyboardEvent('keydown', { key: ' ', repeat: true, bubbles: true, cancelable: true });
    field.dispatchEvent(repeat);
    expect(repeat.defaultPrevented).toBe(true);
    expect(args.onPulse).toHaveBeenCalledTimes(2);

    // Forward Tab lands on pause button
    const pauseBtn = canvas.getByRole('button', { name: 'Pause motion' });
    await userEvent.tab();
    expect(pauseBtn.ownerDocument.activeElement).toBe(pauseBtn);
    expect(window.getComputedStyle(pauseBtn).outlineStyle).not.toBe('none');

    // Backward Shift+Tab returns to field
    await userEvent.tab({ shift: true });
    expect(field.ownerDocument.activeElement).toBe(field);
  },
};

export const RaggedRowKeyboard: Story = {
  args: {
    columns: 4,
    items: raggedItems,
    defaultValue: 'r-4',
  },
  play: async ({ userEvent, canvasElement, args }) => {
    const field = canvasElement.querySelector(
      '[data-ui="gravity-well-field"]',
    ) as HTMLElement;
    field.focus();

    // From r-4 (row 0, col 3), ArrowDown clamps to r-6 (row 1, col 1, last item of ragged row)
    await userEvent.keyboard('{ArrowDown}');
    expect(args.onValueChange).toHaveBeenCalledWith('r-6');
  },
};

export const ControlledRejects: Story = {
  args: {
    value: 'item-1',
    paused: false,
  },
  play: async ({ canvas, userEvent, canvasElement, args }) => {
    const field = canvasElement.querySelector(
      '[data-ui="gravity-well-field"]',
    ) as HTMLElement;
    field.focus();

    // ArrowRight request
    await userEvent.keyboard('{ArrowRight}');
    expect(args.onValueChange).toHaveBeenCalledWith('item-2');

    // Since value is controlled and parent didn't update it, active marker remains on item-1
    const item1 = canvasElement.querySelector(
      '[data-ui="gravity-well-tile"][data-item-id="item-1"]',
    );
    const item2 = canvasElement.querySelector(
      '[data-ui="gravity-well-tile"][data-item-id="item-2"]',
    );
    expect(item1).toHaveAttribute('data-active', 'true');
    expect(item2).not.toHaveAttribute('data-active', 'true');
    await expect(canvas.getByRole('listitem', { current: true })).toHaveTextContent('Alpha');

    // Enter pulse emits for item-1
    await userEvent.keyboard('{Enter}');
    expect(args.onPulse).toHaveBeenCalledWith(
      expect.objectContaining({ itemId: 'item-1' }),
    );

    // Pause button click request
    const pauseBtn = canvas.getByRole('button', { name: 'Pause motion' });
    await userEvent.click(pauseBtn);
    expect(args.onPausedChange).toHaveBeenCalledWith(true);

    // Paused state remains uncommitted (button still says Pause motion)
    expect(pauseBtn).toHaveTextContent('Pause motion');
  },
};

export const ExternalAria: Story = {
  render: (args) => (
    <div>
      <h2 id="external-heading">External Team Heading</h2>
      <p id="external-desc">External directory description paragraph.</p>
      <GravityWell
        {...args}
        aria-labelledby="external-heading"
        aria-describedby="external-desc"
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('[data-ui="gravity-well"]')!;
    expect(root).toBeInTheDocument();
    expect(root).toHaveAttribute('role', 'group');
    expect(root.getAttribute('aria-labelledby')).toContain('external-heading');
    expect(root.getAttribute('aria-describedby')).toContain('external-desc');
    await expect(root).not.toHaveAttribute('aria-label');
    await expect(root).toHaveAccessibleName('External Team Heading Keyboard and state test well');

    const list = canvasElement.querySelector('ul[role="list"]');
    expect(list).toBeInTheDocument();

    const items = canvasElement.querySelectorAll('li[role="listitem"]');
    expect(items.length).toBe(9);
  },
};

export const Resizing: Story = {
  args: {
    items: defaultItems,
    columns: undefined,
  },
};

export const StrictModeCleanup: Story = {
  render: (args) => {
    const [mounted, setMounted] = useState(true);
    return (
      <StrictMode>
        {mounted && <GravityWell {...args} />}
        <Button type="button" onClick={() => setMounted(false)}>
          Unmount Well
        </Button>
      </StrictMode>
    );
  },
  play: async ({ canvas, userEvent, canvasElement }) => {
    const unmountBtn = canvas.getByRole('button', { name: 'Unmount Well' });
    await userEvent.click(unmountBtn);
    expect(
      canvasElement.querySelector('[data-ui="gravity-well"]'),
    ).not.toBeInTheDocument();
  },
};

export const PauseResumeMotion: Story = {
  play: async ({ canvas, canvasElement, userEvent }) => {
    const field = canvasElement.querySelector<HTMLElement>('[data-ui="gravity-well-field"]')!;
    const tile = canvasElement.querySelector<HTMLElement>('[data-ui="gravity-well-tile"]')!;
    field.focus();
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(tile.style.transform).not.toBe(''));
    await userEvent.click(canvas.getByRole('button', { name: 'Pause motion' }));
    const frozen = tile.style.transform;
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(tile.style.transform).toBe(frozen);
    await userEvent.click(canvas.getByRole('button', { name: 'Resume motion' }));
    await waitFor(() => expect(tile.style.transform).not.toBe(frozen));
  },
};

export const AcceptedValueUpdatesField: Story = {
  play: async ({ canvasElement, userEvent }) => {
    const field = canvasElement.querySelector<HTMLElement>('[data-ui="gravity-well-field"]')!;
    const tiles = canvasElement.querySelectorAll<HTMLElement>('[data-ui="gravity-well-tile"]');
    field.focus();
    await waitFor(() => expect(tiles[0]!.style.transform).not.toBe(''));
    await userEvent.keyboard('{ArrowRight}');
    await waitFor(() => expect(tiles[1]!.style.transform).not.toBe(''));
    expect(tiles[1]).toHaveAttribute('data-active', 'true');
  },
};

export const RTLKeyboard: Story = {
  args: { dir: 'rtl' },
  play: async ({ canvasElement, userEvent, args }) => {
    canvasElement.querySelector<HTMLElement>('[data-ui="gravity-well-field"]')!.focus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(args.onValueChange).toHaveBeenLastCalledWith('item-2');
    await userEvent.keyboard('{ArrowRight}');
    expect(args.onValueChange).toHaveBeenLastCalledWith('item-1');
    expect(args.onValueChange).toHaveBeenCalledTimes(2);
  },
};
