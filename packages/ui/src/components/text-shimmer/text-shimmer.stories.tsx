import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, waitFor } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { styled } from '../../styling/styled';
import { withLightTheme } from '../../testing/story-decorators';
import { Button } from '../button';
import { TextShimmer } from './index';

const meta = {
  title: 'Feedback/TextShimmer',
  component: TextShimmer,
  tags: ['autodocs'],
  args: { children: 'Generating summary' },
  parameters: {
    docs: {
      description: {
        component: 'Sweep a highlight over a short label while work is in progress.',
      },
      usage: `### Activity
Pass active=false on completion. Activity, pause and text are caller-owned; labels update immediately without width or text transitions. Active text defaults aria-busy to true; an explicit aria-busy (including false) on the root or slotProps.root takes precedence. TextShimmer does not create a live region or announce progress. Put task announcements in a separate live region outside the busy subtree. Use Progress for measurable work.
### Motion
The default animation stops after 4000ms of running time, leaving solid text without marking the task complete. Positive maxDurationMs values are capped at 5000ms. A budget shorter than durationMs ends mid-sweep and settles to solid text; no full sweep is guaranteed. Pausing, leaving the viewport, or hiding the page preserves the remaining budget. Text changes do not restart it; a new inactive-to-active period does.
Nonpositive maxDurationMs values disable the time budget. Use them only alongside a named pause/stop control to meet WCAG 2.2.2. Reduced motion and forced colors show solid text immediately. Without background-clip support the label stays solid.
### Keyboard
Text has no widget role or keyboard handlers. Tab skips the label and reaches surrounding native controls.`,
      source: {
        code: '<TextShimmer active={busy}>{busy ? "Generating summary" : "Summary ready"}</TextShimmer>',
        language: 'tsx',
      },
    },
  },
} satisfies Meta<typeof TextShimmer>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('[data-ui="text-shimmer"]')!;
    await expect(root).toHaveAttribute('aria-busy', 'true');
    await expect(root.textContent).toBe('Generating summary');
    await expect(root.querySelectorAll('[aria-hidden]')).toHaveLength(0);
  },
};
export const Idle: Story = {
  args: { active: false, children: 'Summary ready' },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[data-ui="text-shimmer"]')).not.toHaveAttribute(
      'aria-busy',
    );
    await expect(
      getComputedStyle(canvasElement.querySelector('[data-ui="text-shimmer-text"]')!)
        .backgroundImage,
    ).toBe('none');
  },
};
export const Accent: Story = { args: { tone: 'accent' } };
export const LightTheme: Story = {
  decorators: [withLightTheme],
  globals: { theme: 'light' },
};
export const Paused: Story = {
  args: { paused: true },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[data-ui="text-shimmer-text"]')).toHaveAttribute(
      'data-paused',
      'true',
    );
  },
};
export const FiniteBudget: Story = {
  args: { durationMs: 600, maxDurationMs: 700 },
  play: async ({ canvasElement }) => {
    const text = canvasElement.querySelector<HTMLElement>('[data-ui="text-shimmer-text"]')!;
    await waitFor(() => expect(getComputedStyle(text).backgroundImage).toBe('none'), {
      timeout: 2500,
    });
    await expect(getComputedStyle(text).webkitTextFillColor).not.toBe('rgba(0, 0, 0, 0)');
    await expect(text.parentElement).toHaveAttribute('aria-busy', 'true');
  },
};
export const InvalidTiming: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import { TextShimmer } from '@jfrader/ui';

<TextShimmer durationMs={Number.NaN} maxDurationMs={Infinity}>
  Generating summary
</TextShimmer>` } } },
  args: { durationMs: NaN, maxDurationMs: Infinity },
  play: async ({ canvasElement }) => {
    const text = canvasElement.querySelector<HTMLElement>('[data-ui="text-shimmer-text"]')!;
    await expect(text.style.getPropertyValue('--text-shimmer-duration')).toBe('1800ms');
    await expect(text.style.getPropertyValue('--text-shimmer-budget')).toBe('4000ms');
  },
};
export const PartialSweep: Story = {
  args: { durationMs: 10000, maxDurationMs: 100 },
  play: async ({ canvasElement }) => {
    const text = canvasElement.querySelector<HTMLElement>('[data-ui="text-shimmer-text"]')!;
    await expect(text.style.getPropertyValue('--text-shimmer-iterations')).toBe('0.01');
    await waitFor(() => expect(getComputedStyle(text).backgroundImage).toBe('none'));
    await expect(text.parentElement).toHaveAttribute('aria-busy', 'true');
  },
};
export const NegativeBudget: Story = {
  render: () => <ContinuousDemo maxDurationMs={-1} />,
  parameters: {
    docs: {
      source: {
        code: '<TextShimmer maxDurationMs={-1} paused={paused}>Generating summary</TextShimmer>',
        language: 'tsx',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const text = canvasElement.querySelector<HTMLElement>('[data-ui="text-shimmer-text"]')!;
    await expect(text.style.getPropertyValue('--text-shimmer-budget')).toBe('0ms');
    await expect(text.style.getPropertyValue('--text-shimmer-iterations')).toBe('infinite');
    await expect(text).toHaveAttribute('data-continuous', 'true');
  },
};
export const CustomSlots: Story = {
  args: {
    slotProps: {
      text: { 'data-ui': 'custom-text text-shimmer-text custom-text' },
    },
  },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[data-ui~="text-shimmer-text"]')).toHaveAttribute(
      'data-ui',
      'text-shimmer-text custom-text',
    );
  },
};
export const RTL: Story = {
  args: { dir: 'rtl', children: 'جارٍ إنشاء الملخص' },
};
export const Empty: Story = { args: { children: '' } };
export const ZeroString: Story = { args: { children: '0' } };
export const ExternalAria: Story = {
  args: { active: false, 'aria-busy': true, 'aria-label': 'Summary ready' },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[data-ui="text-shimmer"]')).toHaveAttribute(
      'aria-busy',
      'true',
    );
  },
};
export const ExplicitNotBusy: Story = {
  args: { 'aria-busy': false },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[data-ui="text-shimmer"]')).toHaveAttribute(
      'aria-busy',
      'false',
    );
  },
};
export const SlotAriaWins: Story = {
  args: { 'aria-busy': true, slotProps: { root: { 'aria-busy': false } } },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[data-ui="text-shimmer"]')).toHaveAttribute(
      'aria-busy',
      'false',
    );
  },
};
function ChangingLabel() {
  const [label, setLabel] = useState('Generating summary');
  return (
    <>
      <TextShimmer>{label}</TextShimmer>
      <Button onClick={() => setLabel('Saving summary')}>Update label</Button>
    </>
  );
}
export const LabelChanges: Story = {
  render: () => <ChangingLabel />,
  parameters: {
    docs: {
      source: { code: '<TextShimmer>{label}</TextShimmer>', language: 'tsx' },
    },
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const text = canvasElement.querySelector('[data-ui="text-shimmer-text"]')!;
    const animations = text.getAnimations();
    await userEvent.click(canvas.getByRole('button', { name: 'Update label' }));
    await expect(text).toHaveTextContent('Saving summary');
    await expect(canvasElement.querySelector('[data-ui="text-shimmer-text"]')).toBe(text);
    await expect(text.getAnimations()).toEqual(animations);
    await expect(canvasElement).not.toHaveTextContent('Generating summary');
  },
};
const ScrollArea = styled.div({ blockSize: vars.space[10], overflow: 'auto' });
const Spacer = styled.div({ blockSize: '100vh' });
export const OffscreenPause: Story = {
  render: (args) => (
    <ScrollArea data-testid="scroll-area">
      <Spacer />
      <TextShimmer {...args} />
    </ScrollArea>
  ),
  parameters: {
    docs: {
      source: {
        code: '<TextShimmer>Generating summary</TextShimmer>',
        language: 'tsx',
      },
    },
  },
  play: async ({ canvas, canvasElement }) => {
    const text = canvasElement.querySelector('[data-ui="text-shimmer-text"]')!;
    await waitFor(() => expect(text).toHaveAttribute('data-paused', 'true'));
    const area = canvas.getByTestId('scroll-area');
    area.scrollTop = area.scrollHeight;
    await waitFor(() => expect(text).toHaveAttribute('data-paused', 'false'));
  },
};
function ContinuousDemo({ maxDurationMs = 0 }: { maxDurationMs?: number }) {
  const [paused, setPaused] = useState(false);
  return (
    <>
      <TextShimmer maxDurationMs={maxDurationMs} paused={paused}>
        Generating summary
      </TextShimmer>
      <Button onClick={() => setPaused(!paused)}>
        {paused ? 'Resume animation' : 'Pause animation'}
      </Button>
    </>
  );
}
export const ContinuousWithPauseButton: Story = {
  render: () => <ContinuousDemo />,
  parameters: {
    docs: {
      source: {
        code: '<>\n  <TextShimmer maxDurationMs={0} paused={paused}>Generating summary</TextShimmer>\n  <Button onClick={() => setPaused(!paused)}>{paused ? "Resume animation" : "Pause animation"}</Button>\n</>',
        language: 'tsx',
      },
    },
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const button = canvas.getByRole('button', { name: 'Pause animation' });
    await userEvent.tab();
    await expect(button.ownerDocument.activeElement).toBe(button);
    await expect(getComputedStyle(button).outlineStyle).not.toBe('none');
    await userEvent.keyboard('{Enter}');
    await expect(button).toHaveAccessibleName('Resume animation');
    await expect(canvasElement.querySelector('[data-ui="text-shimmer-text"]')).toHaveAttribute(
      'data-paused',
      'true',
    );
    await userEvent.keyboard(' ');
    await expect(button).toHaveAccessibleName('Pause animation');
  },
};
export const ReducedMotion: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Enable reduced motion in your browser to show a solid label.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const text = canvasElement.querySelector<HTMLElement>('[data-ui="text-shimmer-text"]')!;
    if (text.ownerDocument.defaultView!.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      await expect(getComputedStyle(text).animationName).toBe('none');
      await expect(getComputedStyle(text).backgroundImage).toBe('none');
      await expect(getComputedStyle(text).webkitTextFillColor).not.toBe('rgba(0, 0, 0, 0)');
    }
  },
};
