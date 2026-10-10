import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { Progress } from './index';

const frameStyle = css({
  display: 'grid',
  gap: vars.space[4],
  inlineSize: '20rem',
});

const fieldStyle = css({
  display: 'grid',
  gap: vars.space[2],
  fontFamily: vars.font.sans,
  fontSize: vars.textSize.sm,
  color: vars.color.text,
});

function indicatorOf(progressbar: HTMLElement) {
  return progressbar.querySelector<HTMLElement>('[data-ui="progress-indicator"]');
}

const meta = {
  title: 'Components/Progress',
  component: Progress,
  tags: ['autodocs'],
  argTypes: {
    value: { control: { type: 'range', min: 0, max: 100 } },
  },
  decorators: [
    (Story) => (
      <div css={frameStyle}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Progress>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Determinate: Story = {
  args: { label: 'Uploading file', value: 40 },
  play: async ({ canvasElement }) => {
    const progressbar = within(canvasElement).getByRole('progressbar', { name: 'Uploading file' });
    await expect(progressbar).toHaveAttribute('aria-valuemin', '0');
    await expect(progressbar).toHaveAttribute('aria-valuemax', '100');
    await expect(progressbar).toHaveAttribute('aria-valuenow', '40');
    await expect(indicatorOf(progressbar)?.style.width).toBe('40%');
    await expect(Math.round(progressbar.getBoundingClientRect().height)).toBe(4);
  },
};

export const Indeterminate: Story = {
  args: { label: 'Uploading file' },
  play: async ({ canvasElement }) => {
    const progressbar = within(canvasElement).getByRole('progressbar', { name: 'Uploading file' });
    await expect(progressbar).not.toHaveAttribute('aria-valuenow');
    await expect(progressbar).not.toHaveAttribute('aria-valuetext');
    await expect(progressbar).toHaveAttribute('data-state', 'indeterminate');
  },
};

export const ValueText: Story = {
  args: {
    label: 'Importing files',
    value: 3,
    max: 8,
    getValueLabel: (value, max) => `${value} of ${max} files`,
  },
  play: async ({ canvasElement }) => {
    const progressbar = within(canvasElement).getByRole('progressbar', { name: 'Importing files' });
    await expect(progressbar).toHaveAttribute('aria-valuemax', '8');
    await expect(progressbar).toHaveAttribute('aria-valuenow', '3');
    await expect(progressbar).toHaveAttribute('aria-valuetext', '3 of 8 files');
    await expect(indicatorOf(progressbar)?.style.width).toBe('37.5%');
  },
};

export const VisibleLabel: Story = {
  args: { value: 70 },
  render: (args) => (
    <div css={fieldStyle}>
      <span id="storage-label">Storage used</span>
      <Progress {...args} aria-labelledby="storage-label" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const progressbar = within(canvasElement).getByRole('progressbar', { name: 'Storage used' });
    await expect(progressbar).toHaveAttribute('aria-labelledby', 'storage-label');
  },
};

export const Bounds: Story = {
  render: (args) => (
    <>
      <Progress {...args} label="Empty" value={0} />
      <Progress {...args} label="Overflow" value={150} />
      <Progress {...args} label="Underflow" value={-20} />
    </>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const empty = canvas.getByRole('progressbar', { name: 'Empty' });
    await expect(empty).toHaveAttribute('aria-valuenow', '0');
    await expect(empty).toHaveAttribute('data-state', 'determinate');
    await expect(indicatorOf(empty)?.style.width).toBe('0%');
    const overflow = canvas.getByRole('progressbar', { name: 'Overflow' });
    await expect(overflow).toHaveAttribute('aria-valuenow', '100');
    await expect(indicatorOf(overflow)?.style.width).toBe('100%');
    const underflow = canvas.getByRole('progressbar', { name: 'Underflow' });
    await expect(underflow).toHaveAttribute('aria-valuenow', '0');
  },
};

const normalizationCases = [
  { label: 'Clamped overflow', value: 150, max: 100, expectedValue: 100 },
  { label: 'Negative maximum', value: 40, max: -5, expectedValue: 40 },
  { label: 'Zero maximum', value: 40, max: 0, expectedValue: 40 },
  { label: 'NaN value', value: NaN, max: 100, expectedValue: 0 },
  { label: 'Infinite value', value: Infinity, max: 100, expectedValue: 0 },
  { label: 'Negative infinite value', value: -Infinity, max: 100, expectedValue: 0 },
  { label: 'NaN maximum', value: 40, max: NaN, expectedValue: 40 },
  { label: 'Infinite maximum', value: 40, max: Infinity, expectedValue: 40 },
];

export const NormalizedNumbers: Story = {
  render: (args) => (
    <>
      {normalizationCases.map(({ label, value, max }) => (
        <Progress
          {...args}
          key={label}
          label={label}
          value={value}
          max={max}
          getValueLabel={(current, total) => `${current} of ${total}`}
        />
      ))}
    </>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const { label, expectedValue } of normalizationCases) {
      const progressbar = canvas.getByRole('progressbar', { name: label });
      await expect(progressbar).toHaveAttribute('data-state', 'determinate');
      await expect(progressbar).toHaveAttribute('aria-valuemin', '0');
      await expect(progressbar).toHaveAttribute('aria-valuemax', '100');
      await expect(progressbar).toHaveAttribute('aria-valuenow', String(expectedValue));
      await expect(progressbar).toHaveAttribute('aria-valuetext', `${expectedValue} of 100`);
      await expect(indicatorOf(progressbar)?.style.width).toBe(`${expectedValue}%`);
    }
  },
};

export const LightTheme: Story = {
  globals: { theme: 'light' },
  render: (args) => (
    <>
      <Progress {...args} label="Uploading file" value={60} />
      <Progress {...args} label="Preparing" />
    </>
  ),
};
