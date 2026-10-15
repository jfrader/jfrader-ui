import type { ComponentPropsWithRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
// `styled` is the app-facing styling API; consumers import it from `@jfrader/ui`.
import { styled } from '../../index';
import { withLightTheme } from '../../testing/story-decorators';
import { Progress } from './index';

const Frame = styled.div({
  display: 'grid',
  gap: vars.space[4],
  inlineSize: `min(20rem, calc(100vw - ${vars.space[8]}))`,
});

function ReplacementIndicator(props: ComponentPropsWithRef<'div'>) {
  return <div {...props} data-testid="replacement-indicator" />;
}

export const ReplaceIndicator: Story = {
  args: { value: 40, label: 'Uploading', slots: { indicator: ReplacementIndicator }, slotProps: { indicator: { title: 'Upload progress' } } },
  play: async ({ canvasElement }) => {
    const indicator = within(canvasElement).getByTestId('replacement-indicator');
    await expect(indicator).toHaveAttribute('data-ui', 'progress-indicator');
    await expect(indicator).toHaveAttribute('title', 'Upload progress');
    await expect(indicator.style.width).toBe('40%');
    await expect(indicator.className).not.toBe('');
  },
};

const Field = styled.div({
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
  title: 'Feedback/Progress',
  component: Progress,
  parameters: {
    docs: {
      description: { component: 'Show how much of a task is complete, or show that work is in progress.' },
      usage: `- \`value\` is in 0..max. Leave it undefined when completion is unknown.
- \`label\` provides a visually hidden name. \`getValueLabel\` supplies \`aria-valuetext\`.`,
    },
  },
  tags: ['autodocs'],
  argTypes: {
    value: { control: { type: 'range', min: 0, max: 100 } },
  },
  decorators: [
    (Story) => (
      <Frame>
        <Story />
      </Frame>
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

export const RTL: Story = {
  render: (args) => (
    <>
      <Progress {...args} dir="rtl" label="Empty" value={0} />
      <Progress {...args} dir="rtl" aria-label="Half complete" value={50} />
      <Progress {...args} dir="rtl" label="Complete" value={100} sx={{ blockSize: vars.space[2] }} />
      <Progress {...args} dir="rtl" label="Preparing" sx={{ blockSize: vars.space[2] }} />
    </>
  ),
  play: async ({ canvasElement }) => {
    for (const progressbar of within(canvasElement).getAllByRole('progressbar')) {
      await expect(progressbar).toHaveAttribute('dir', 'rtl');
      await expect(getComputedStyle(progressbar).direction).toBe('rtl');
    }
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
    <Field>
      <span id="storage-label">Storage used</span>
      <Progress {...args} aria-labelledby="storage-label" />
    </Field>
  ),
  play: async ({ canvasElement }) => {
    const progressbar = within(canvasElement).getByRole('progressbar', { name: 'Storage used' });
    await expect(progressbar).toHaveAttribute('aria-labelledby', 'storage-label');
  },
};

export const AccessibleValueText: Story = {
  render: (args) => (
    <>
      <Progress {...args} aria-label="Download" value={40} aria-valuetext="40 megabytes downloaded" />
      <Progress {...args} aria-label="Preparing download" aria-valuetext="Connecting" />
      <Progress
        {...args}
        aria-label="Formatted download"
        value={40}
        aria-valuetext="Consumer value"
        getValueLabel={() => 'Generated value'}
      />
    </>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('progressbar', { name: 'Download' })).toHaveAttribute(
      'aria-valuetext',
      '40 megabytes downloaded',
    );
    const preparing = canvas.getByRole('progressbar', { name: 'Preparing download' });
    await expect(preparing).not.toHaveAttribute('aria-valuenow');
    await expect(preparing).toHaveAttribute('aria-valuetext', 'Connecting');
    await expect(canvas.getByRole('progressbar', { name: 'Formatted download' })).toHaveAttribute(
      'aria-valuetext',
      'Consumer value',
    );
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
  decorators: [withLightTheme],
  render: (args) => (
    <>
      <Progress {...args} label="Uploading file" value={60} />
      <Progress {...args} label="Preparing" />
    </>
  ),
};
