import type { CSSProperties } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { withLightTheme } from '../../testing/story-decorators';
import { Button } from '../button';
import { TextField } from '../text-field';
import { ThemeRoot, type ThemeName } from './index';

const THEMES = ['dark', 'light'] as const satisfies readonly ThemeName[];

const surfaceStyle = {
  display: 'grid',
  gap: vars.space[4],
  padding: vars.space[6],
  borderRadius: vars.radius.lg,
  backgroundColor: vars.color.surface,
} satisfies CSSProperties;

const rowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: vars.space[3],
} satisfies CSSProperties;

const meta = {
  title: 'Foundations/Theme',
  component: ThemeRoot,
  args: { onClick: fn() },
  argTypes: {
    theme: { control: 'radio', options: THEMES },
  },
  render: (args) => (
    <ThemeRoot {...args} style={surfaceStyle}>
      <div style={rowStyle}>
        <Button tone="accent">Save</Button>
        <Button variant="outline">Cancel</Button>
      </div>
      <TextField label="Project name" placeholder="Untitled" />
    </ThemeRoot>
  ),
} satisfies Meta<typeof ThemeRoot>;

export default meta;

type Story = StoryObj<typeof meta>;

function getRoot(canvasElement: HTMLElement) {
  return canvasElement.querySelector<HTMLElement>('[data-ui="theme-root"]:not([data-story-theme-scope])');
}

export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    await expect(getRoot(canvasElement)).toHaveAttribute('data-theme', 'dark');
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Save' }));
    await expect(args.onClick).toHaveBeenCalledTimes(1);
  },
};

export const Light: Story = {
  args: { theme: 'light' },
  play: async ({ canvasElement }) => {
    await expect(getRoot(canvasElement)).toHaveAttribute('data-theme', 'light');
  },
};

export const LightTheme: Story = {
  decorators: [withLightTheme],
  args: { theme: 'light' },
  play: async ({ canvasElement }) => {
    await expect(getRoot(canvasElement)).toHaveAttribute('data-theme', 'light');
  },
};
