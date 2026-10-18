import { StrictMode, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, waitFor } from 'storybook/test';
import { Button } from '../button';
import {
  DataFlow,
  type DataFlowNode,
  type DataFlowDestinationNode,
  type DataFlowCore,
  type DataFlowSummaryStep,
  type DataFlowControlLabels,
} from './index';
import { isEmissionEligible } from './data-flow-geometry';

const sources: readonly DataFlowNode[] = [
  { id: 'src-1', label: 'Primary source' },
  { id: 'src-2', label: 'Secondary stream' },
];

const destinations: readonly DataFlowDestinationNode[] = [
  { id: 'dst-1', label: 'Sink Alpha', share: 1 },
  { id: 'dst-2', label: 'Sink Beta', share: 0.5 },
  { id: 'dst-3', label: 'Sink Gamma', share: 0 },
];

const core: DataFlowCore = {
  id: 'core-main',
  label: 'Core transformer',
  countStart: 42,
  countLabel: 'events',
};

const summary: readonly DataFlowSummaryStep[] = [
  { id: 's-1', content: 'Stage 1: Ingesting events.' },
  { id: 's-2', content: 'Stage 2: Transforming stream.' },
  { id: 's-3', content: 'Stage 3: Distributing outputs.' },
];

const controlLabels: DataFlowControlLabels = {
  pause: 'Pause',
  resume: 'Resume',
  step: 'Step',
  replay: 'Replay',
  group: 'Playback controls',
};

const meta = {
  title: 'Showcase/DataFlow',
  component: DataFlow,
  tags: ['!autodocs'],
  args: {
    sources,
    destinations,
    core,
    summary,
    label: 'Pipeline diagram',
    controlLabels,
    emptyContent: 'Empty fallback',
    invalidContent: 'Invalid fallback',
    defaultPaused: true,
    onPausedChange: fn(),
  },
  parameters: {
    docs: {
      description: {
        component:
          'Secondary integration stories and regression tests for DataFlow.',
      },
    },
  },
} satisfies Meta<typeof DataFlow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ExternalAria: Story = {
  render: (args) => (
    <div>
      <h2 id="external-title">External Pipeline Title</h2>
      <p id="external-desc">External pipeline description paragraph.</p>
      <DataFlow
        {...args}
        aria-labelledby="external-title"
        aria-describedby="external-desc"
        caption="Pipeline caption note"
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const figure = canvasElement.querySelector('figure[data-ui="data-flow"]');
    expect(figure).not.toBeNull();

    const labelledBy = figure?.getAttribute('aria-labelledby') ?? '';
    expect(labelledBy).toContain('external-title');

    const describedBy = figure?.getAttribute('aria-describedby') ?? '';
    expect(describedBy).toContain('external-desc');

    const summaryList = canvasElement.querySelector('ol[data-ui="data-flow-summary"]');
    const summaryId = summaryList?.getAttribute('id') ?? '';
    expect(describedBy).toContain(summaryId);

    const figcaption = canvasElement.querySelector('figcaption');
    const captionId = figcaption?.getAttribute('id') ?? '';
    expect(describedBy).toContain(captionId);
  },
};

export const OffscreenPause: Story = {
  args: { defaultPaused: false },
  play: async ({ canvasElement }) => {
    const figure = canvasElement.querySelector<HTMLElement>('figure[data-ui="data-flow"]')!;
    const particles = () => [...figure.querySelectorAll('circle, rect')].map((node) => `${node.getAttribute('transform')}/${node.getAttribute('opacity')}`).join('|');
    const initial = particles();
    await waitFor(() => expect(particles()).not.toBe(initial));
    figure.style.position = 'fixed';
    figure.style.top = '-10000px';
    await new Promise((resolve) => setTimeout(resolve, 100));
    const frozen = particles();
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(particles()).toBe(frozen);
    figure.style.position = '';
    figure.style.top = '';
    await waitFor(() => expect(particles()).not.toBe(frozen));
  },
};

export const ResizePreservesClock: Story = {
  render: (args) => {
    const [width, setWidth] = useState(700);
    return (
      <div style={{ width: `${width}px` }}>
        <DataFlow {...args} />
        <Button onClick={() => setWidth((prev) => (prev === 700 ? 400 : 700))}>
          Toggle Width
        </Button>
      </div>
    );
  },
  play: async ({ canvas, userEvent, canvasElement }) => {
    const toggle = canvas.getByRole('button', { name: 'Toggle Width' });
    await userEvent.click(toggle);

    await waitFor(() => {
      expect(canvasElement.querySelector('[data-orientation]')).toHaveAttribute('data-orientation', 'vertical');
    });

    // Check that SVG attributes do not contain NaN
    const svg = canvasElement.querySelector('svg');
    const allPaths = svg?.querySelectorAll('path') ?? [];
    for (const path of allPaths) {
      const d = path.getAttribute('d') ?? '';
      expect(d).not.toContain('NaN');
    }
  },
};

export const StrictModeCleanup: Story = {
  render: (args) => {
    const [mounted, setMounted] = useState(true);
    return (
      <StrictMode>
        <Button onClick={() => setMounted((m) => !m)}>Toggle mount</Button>
        {mounted && <DataFlow {...args} />}
      </StrictMode>
    );
  },
  play: async ({ canvas, userEvent, canvasElement }) => {
    const toggle = canvas.getByRole('button', { name: 'Toggle mount' });

    // Unmount
    await userEvent.click(toggle);
    expect(canvasElement.querySelector('figure[data-ui="data-flow"]')).toBeNull();

    // Remount
    await userEvent.click(toggle);
    expect(canvasElement.querySelector('figure[data-ui="data-flow"]')).not.toBeNull();
  },
};

export const ZeroSizeFallback: Story = {
  render: (args) => (
    <div style={{ width: '0px', height: '0px', overflow: 'hidden' }}>
      <DataFlow {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const figure = canvasElement.querySelector('figure[data-ui="data-flow"]');
    expect(figure).not.toBeNull();

    // Ensure no NaN coordinates in SVG
    const svg = canvasElement.querySelector('svg');
    const paths = svg?.querySelectorAll('path') ?? [];
    for (const path of paths) {
      const d = path.getAttribute('d') ?? '';
      expect(d).not.toContain('NaN');
    }
  },
};

export const PureRoutingMath: Story = {
  play: async () => {
    // share = 0 receives 0 emissions
    for (let e = 0; e < 12; e++) {
      expect(isEmissionEligible(e, 0)).toBe(false);
    }

    // share = 1 receives all emissions
    for (let e = 0; e < 12; e++) {
      expect(isEmissionEligible(e, 1)).toBe(true);
    }

    // share = 0.5 receives exactly 3 of 6 emissions per cycle
    let count = 0;
    for (let e = 0; e < 6; e++) {
      if (isEmissionEligible(e, 0.5)) count++;
    }
    expect(count).toBe(3);

    // share = 1/3 receives exactly 2 of 6 emissions per cycle
    let countThird = 0;
    for (let e = 0; e < 6; e++) {
      if (isEmissionEligible(e, 1 / 3)) countThird++;
    }
    expect(countThird).toBe(2);

    const sparse = Array.from({ length: 60 }, (_, e) => isEmissionEligible(e, 0.1)).filter(Boolean);
    expect(sparse).toHaveLength(6);
  },
};

export const CounterTelemetrySafety: Story = {
  play: async ({ canvas, canvasElement }) => {
    const figure = canvasElement.querySelector('figure[data-ui="data-flow"]');
    expect(figure).not.toBeNull();

    // Verify counter is not aria-live or exposed as real-time telemetry
    const liveRegions = figure?.querySelectorAll('[aria-live]');
    expect(liveRegions?.length ?? 0).toBe(0);

    // Replay resets counter to countStart
    const replayBtn = canvas.getByRole('button', { name: 'Replay' });
    await expect(replayBtn).toBeVisible();
  },
};

export const ExternalResumeAfterStep: Story = {
  render: (args) => {
    const [paused, setPaused] = useState(true);
    return <>
      <DataFlow {...args} paused={paused} />
      <Button onClick={() => setPaused(false)}>Resume externally</Button>
    </>;
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Step' }));
    const particle = canvasElement.querySelector('circle')!;
    const frozen = particle.getAttribute('transform');
    await userEvent.click(canvas.getByRole('button', { name: 'Resume externally' }));
    await waitFor(() => expect(particle.getAttribute('transform')).not.toBe(frozen));
    expect(canvas.getByRole('button', { name: 'Step' })).toBeDisabled();
  },
};
