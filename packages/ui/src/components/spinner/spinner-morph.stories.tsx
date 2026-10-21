import { useState, type ComponentPropsWithRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, waitFor } from 'storybook/test';
import { Spinner, type SpinnerValue } from './index';
import { Button } from '../button';

const meta = {
  title: 'Feedback/Spinner',
  component: Spinner,
  // The docs engine keys pages by file; a second autodocs file would publish a second page.
  tags: ['!autodocs'],
  args: {
    value: 'loading',
    variant: 'dots',
    label: 'Saving',
    successLabel: 'Saved',
    errorLabel: 'Save failed',
  },
  parameters: {
    docs: {
      description: {
        component: 'Show loading feedback, then a check or cross when work finishes.',
      },
      usage: `### Morphing results
Set \`value\` to loading, success or error; omitted \`value\` uses the static \`defaultValue\` seed. The indicator never completes work or resets itself. \`variant\` selects dots, bars, ring or square; result drawings use the same footprint. The existing Spinner ring remains the default when no state or new variant is supplied. MorphLoader is a Spinner presentation, not another export.

### Accessibility and keyboard

The indicator has no tab stop or keyboard behavior. A persistent polite, atomic status announces text changes; mounting it alone does not guarantee an announcement. Keep status outside the region marked \`aria-busy\`. Inside a named button use \`decorative\` to suppress duplicate status semantics and text. Set \`aria-busy\` on the actual control or region yourself.

### Appearance

The default tone inherits currentColor. \`tone="status"\` adds success/error colors; glyphs and labels still identify results. Existing sizes stay 16/20/24px; xl adds 48px. A finite positive \`dimension\` overrides the preset. \`strokeWidth\` uses the 24-unit drawing grid and defaults to 2; invalid values fall back. Reduced motion renders morph presentations as static shapes and swaps results immediately. Offscreen or hidden-page morph loops pause. The legacy stateless ring retains its reduced-motion pulse.

### Customization

\`component\` is sugar for \`slots.root\`. Root, indicator and status replacements forward span props, ref and className. Each has matching \`slotProps\`; root native conflicts use slot values and root \`sx\` applies last.`,
      source: {
        code: `<Spinner value={state} variant="ring" label="Saving" successLabel="Saved" errorLabel="Save failed" />`,
        language: 'tsx',
      },
    },
  },
} satisfies Meta<typeof Spinner>;
export default meta;
type Story = StoryObj<typeof meta>;
export const MorphDots: Story = {};
export const MorphBars: Story = { args: { variant: 'bars' } };
export const MorphRing: Story = { args: { variant: 'ring' } };
export const MorphSquare: Story = { args: { variant: 'square' } };
export const MorphSuccess: Story = {
  args: { value: 'success', tone: 'status' },
};
export const MorphError: Story = { args: { value: 'error', tone: 'status' } };
export const MorphLight: Story = { globals: { theme: 'light' } };
export const DimensionOverride: Story = {
  args: { dimension: 64, strokeWidth: 3 },
};
export const MorphReducedMotion: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Enable reduced motion in your system preferences to keep the loading shape still.',
      },
    },
  },
};
export const ReuseSequence: Story = {
  render: function Sequence(args) {
    const [value, setValue] = useState<SpinnerValue>('loading');
    return (
      <>
        <Button
          onClick={() =>
            setValue(value === 'loading' ? 'success' : value === 'success' ? 'error' : 'loading')
          }
        >
          Next status
        </Button>
        <Spinner {...args} value={value} />
      </>
    );
  },
  play: async ({ canvas, userEvent }) => {
    const status = canvas.getByRole('status');
    const indicator = status.querySelector<HTMLElement>('[data-ui="spinner-indicator"]')!;
    const width = indicator.offsetWidth;
    const height = indicator.offsetHeight;
    await expect(status).toHaveAttribute('aria-live', 'polite');
    await expect(status).toHaveAttribute('aria-atomic', 'true');
    await expect(status).not.toHaveAttribute('aria-busy');
    await expect(status.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    await expect(status.querySelector('svg')).toHaveAttribute('focusable', 'false');
    await userEvent.tab();
    const button = canvas.getByRole('button', { name: 'Next status' });
    await expect(button.ownerDocument.activeElement).toBe(button);
    await expect(getComputedStyle(button).outlineStyle).not.toBe('none');
    await userEvent.keyboard('{Enter}');
    await expect(status).toHaveTextContent('Saved');
    await expect(canvas.getByRole('status')).toBe(status);
    await expect(indicator.offsetWidth).toBe(width);
    await expect(indicator.offsetHeight).toBe(height);
    await userEvent.keyboard(' ');
    await expect(status).toHaveTextContent('Save failed');
    await userEvent.keyboard('{Enter}');
    await expect(status).toHaveTextContent('Saving');
    await expect(button.ownerDocument.activeElement).toBe(button);
  },
};
export const DecorativeInButton: Story = {
  render: (args) => (
    <Button aria-busy="true" aria-label="Saving">
      <Spinner {...args} decorative />
      Saving
    </Button>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole('status')).toBeNull();
    await expect(canvas.getByRole('button', { name: 'Saving' })).toHaveAttribute('aria-busy', 'true');
  },
};
function Part(props: ComponentPropsWithRef<'span'>) {
  return <span {...props} data-custom-part />;
}
export const MorphCustomization: Story = {
  args: {
    component: Part,
    slots: { indicator: Part, status: Part },
    slotProps: {
      root: { title: 'Root' },
      indicator: { title: 'Indicator' },
      status: { title: 'Status' },
    },
  },
  play: async ({ canvas }) => {
    for (const title of ['Root', 'Indicator', 'Status'])
      await expect(canvas.getByTitle(title)).toHaveAttribute('data-custom-part');
  },
};
export const InvalidDimensions: Story = {
  args: { dimension: Number.NaN, strokeWidth: -1 },
  play: async ({ canvas }) => {
    const indicator = canvas.getByRole('status').querySelector<HTMLElement>('[data-ui="spinner-indicator"]')!;
    await expect(indicator.offsetWidth).toBe(20);
    await expect(indicator.querySelector('path')).toHaveAttribute('stroke-width', '2');
  },
};
export const InterruptedCompletion: Story = {
  render: function Interrupted(args) {
    const [value, setValue] = useState<SpinnerValue>('loading');
    return (
      <>
        <Button
          onClick={() => {
            setValue('success');
            queueMicrotask(() => setValue('error'));
          }}
        >
          Interrupt
        </Button>
        <Spinner {...args} value={value} />
      </>
    );
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button'));
    await waitFor(() => expect(canvas.getByRole('status')).toHaveTextContent('Save failed'));
  },
};
