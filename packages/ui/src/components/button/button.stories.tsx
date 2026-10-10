import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { Button, type ButtonSize, type ButtonTone, type ButtonVariant } from './index';

const VARIANTS = ['solid', 'soft', 'outline', 'ghost'] as const satisfies readonly ButtonVariant[];
const TONES = ['neutral', 'accent', 'danger'] as const satisfies readonly ButtonTone[];
const SIZES = ['sm', 'md', 'lg'] as const satisfies readonly ButtonSize[];
const GRID_VARIANTS = ['solid', 'soft', 'outline'] as const satisfies readonly ButtonVariant[];

const gridStyle = css({
  display: 'grid',
  gridTemplateColumns: `repeat(${GRID_VARIANTS.length}, auto)`,
  gap: vars.space[3],
});

const rowStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: vars.space[3],
});

function PlusIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M8 3v10M3 8h10" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8h10M9 4l4 4-4 4" />
    </svg>
  );
}

const meta = {
  title: 'Components/Button',
  component: Button,
  tags: ['autodocs'],
  args: { children: 'Button', variant: 'solid', tone: 'neutral', size: 'md' },
  argTypes: {
    variant: { control: 'select', options: VARIANTS },
    tone: { control: 'radio', options: TONES },
    size: { control: 'radio', options: SIZES },
    loading: { control: 'boolean' },
    disabled: { control: 'boolean' },
  },
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Variants: Story = {
  render: (args) => (
    <div css={gridStyle}>
      {TONES.map((tone) =>
        GRID_VARIANTS.map((variant) => (
          <Button {...args} key={`${tone}-${variant}`} tone={tone} variant={variant}>
            {`${variant} ${tone}`}
          </Button>
        )),
      )}
    </div>
  ),
};

export const Sizes: Story = {
  render: (args) => (
    <div css={rowStyle}>
      {SIZES.map((size) => (
        <Button {...args} key={size} size={size}>
          {size}
        </Button>
      ))}
    </div>
  ),
};

export const WithIcons: Story = {
  args: { startIcon: <PlusIcon />, endIcon: <ArrowIcon /> },
};

export const LightTheme: Story = {
  globals: { theme: 'light' },
  args: { tone: 'accent', variant: 'soft', children: 'Soft accent' },
};

export const Loading: Story = {
  args: { loading: true, tone: 'accent', children: 'Saving…', onClick: fn() },
  play: async ({ args, canvasElement }) => {
    const button = within(canvasElement).getByRole('button');
    await expect(button).toHaveAttribute('aria-busy', 'true');
    await expect(button).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(button);
    await expect(args.onClick).not.toHaveBeenCalled();
  },
};

export const Disabled: Story = {
  args: { disabled: true, onClick: fn() },
  play: async ({ args, canvasElement }) => {
    const button = within(canvasElement).getByRole('button');
    await userEvent.click(button);
    await expect(args.onClick).not.toHaveBeenCalled();
  },
};

export const KeyboardActivation: Story = {
  args: { onClick: fn() },
  play: async ({ args, canvasElement }) => {
    const button = within(canvasElement).getByRole('button');
    await userEvent.tab();
    await expect(button).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await expect(args.onClick).toHaveBeenCalledTimes(1);
    await userEvent.keyboard('[Space]');
    await expect(args.onClick).toHaveBeenCalledTimes(2);
    await expect(getComputedStyle(button).outlineWidth).not.toBe('0px');
  },
};
