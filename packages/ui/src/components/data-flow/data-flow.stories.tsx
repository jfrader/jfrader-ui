import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, waitFor } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { styled } from '../../styling/styled';
import { Button } from '../button';
import {
  DataFlow,
  type DataFlowNode,
  type DataFlowDestinationNode,
  type DataFlowCore,
  type DataFlowSummaryStep,
  type DataFlowControlLabels,
  type DataFlowProps,
} from './index';

const sources: readonly DataFlowNode[] = [
  {
    id: 'src-events',
    label: 'Client events',
    meta: 'Telemetry and clicks',
    detail: 'HTTPS /v1/events',
  },
  {
    id: 'src-cdc',
    label: 'Database CDC',
    meta: 'Postgres change stream',
    detail: 'WAL logical replication',
  },
  {
    id: 'src-webhooks',
    label: 'Partner webhooks',
    meta: 'Inbound integration',
    detail: 'HMAC-signed JSON',
  },
];

const destinations: readonly DataFlowDestinationNode[] = [
  {
    id: 'dst-warehouse',
    label: 'Data warehouse',
    meta: 'Analytics cluster',
    detail: '100% full dataset',
    share: 1,
  },
  {
    id: 'dst-search',
    label: 'Search index',
    meta: 'Elasticsearch',
    detail: '50% sampled query stream',
    share: 0.5,
  },
  {
    id: 'dst-cold',
    label: 'Cold archive',
    meta: 'S3 glacier storage',
    detail: '25% compliance sample',
    share: 0.25,
  },
];

const core: DataFlowCore = {
  id: 'core-transform',
  label: 'Transformation engine',
  detail: 'Validation, schema normalization and enrichment',
  countStart: 0,
  countLabel: 'records',
};

const summary: readonly DataFlowSummaryStep[] = [
  {
    id: 'step-ingest',
    content:
      'Client events supplies telemetry and clicks over HTTPS /v1/events. Database CDC supplies a Postgres change stream through WAL logical replication. Partner webhooks supplies HMAC-signed JSON. Hollow circles represent incoming records.',
  },
  {
    id: 'step-transform',
    content:
      'The Transformation engine validates, normalizes schemas and enriches records. Solid squares represent processed records.',
  },
  {
    id: 'step-route',
    content:
      'The Data warehouse analytics cluster receives every record. The Elasticsearch Search index receives 50%. The S3 Glacier Cold archive receives a 25% compliance sample. These shares and the record count are illustrative.',
  },
];

const controlLabels: DataFlowControlLabels = {
  pause: 'Pause animation',
  resume: 'Resume animation',
  step: 'Step forward',
  replay: 'Replay animation',
  group: 'Playback transport controls',
};

const Frame = styled.div({
  display: 'grid',
  gap: vars.space[4],
  inlineSize: '100%',
  maxInlineSize: '800px',
});

const NarrowFrame = styled.div({
  inlineSize: '360px',
  maxInlineSize: '100%',
});

function RenderFixture(args: DataFlowProps) {
  const percent = new Intl.NumberFormat('en-US', { style: 'percent' });
  const summary: DataFlowSummaryStep[] = [
    { id: 'sources', content: args.sources.map((node) => [node.label, node.meta, node.detail].filter(Boolean).join(': ')).join('. ') || 'No sources configured.' },
    { id: 'core', content: [args.core.label, args.core.detail].filter(Boolean).join(': ') },
    { id: 'destinations', content: args.destinations.map((node) => `${[node.label, node.meta, node.detail].filter(Boolean).join(': ')}; illustrative share ${percent.format(node.share ?? 1)}`).join('. ') || 'No destinations configured.' },
  ];
  return <DataFlow {...args} summary={summary} />;
}

const meta = {
  title: 'Showcase/DataFlow',
  component: DataFlow,
  tags: ['autodocs'],
  args: {
    sources,
    destinations,
    core,
    summary,
    label: 'Data processing pipeline illustration',
    controlLabels,
    emptyContent: 'No sources or destinations configured for this pipeline.',
    invalidContent: 'Cannot render pipeline: invalid configuration provided.',
    locale: 'en-US',
    defaultPaused: true,
    onPausedChange: fn(),
  },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { DataFlow } from '@jfrader/ui/data-flow';

<DataFlow
  sources={[{ id: 'source', label: 'Events' }]}
  core={{ id: 'core', label: 'Validate', countLabel: 'illustrative records' }}
  destinations={[{ id: 'store', label: 'Archive', share: 1 }]}
  summary={[
    { id: 'input', content: 'Events supplies incoming records.' },
    { id: 'process', content: 'Validate checks every record.' },
    { id: 'output', content: 'Archive receives every illustrative record.' },
  ]}
  label="Data processing pipeline illustration"
  controlLabels={{ pause: 'Pause', resume: 'Resume', step: 'Step', replay: 'Replay', group: 'Playback' }}
  emptyContent="No sources or destinations configured for this pipeline."
  invalidContent="Cannot render pipeline: invalid configuration provided."
  defaultPaused
/>`,
      },
      description: {
        component:
          'Illustrate data ingestion from sources through core transformation to destinations with animated particles and a semantic summary. This is an illustration, not a real-time monitoring dashboard or live pipeline controller.',
      },
      usage: `### Routing and shares
Destinations receive records based on their illustrative share from 0 to 1. A share of 1 receives every emitted record, while a share of 0 receives none. Fractional shares accumulate across cycles.

### Snapshots and playback
Playback supports controlled and uncontrolled pause states. Pausing freezes the frame immediately. When paused, at speed 0, or under reduced motion, the Step control is enabled to advance through ingest, transform, and route snapshots. Replay resets the local illustrative cycle and counter to countStart.

### Keyboard
Native transport buttons follow standard tab order (pause, step, replay) and activate once on Enter or Space. The step button is disabled during active playback.

### Summary and accessibility
Write the required ordered summary to identify every source, transformation, destination, routing share and node detail. The animated scene is hidden from assistive technology. Counts and particles are synthetic, not measured telemetry.`,
    },
  },
} satisfies Meta<typeof DataFlow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Horizontal: Story = {
  args: { orientation: 'horizontal' },
};

export const Vertical: Story = {
  args: { orientation: 'vertical' },
};

export const PartialShare: Story = {
  render: RenderFixture,
  args: {
    destinations: [
      { id: 'd-full', label: 'Primary store', share: 1 },
      { id: 'd-half', label: 'Secondary replica', share: 0.5 },
      { id: 'd-quarter', label: 'Audit trail', share: 0.25 },
    ],
  },
};

export const ZeroShare: Story = {
  render: RenderFixture,
  args: {
    destinations: [
      { id: 'd-active', label: 'Active cluster', share: 1 },
      { id: 'd-disabled', label: 'Maintenance standby', share: 0 },
    ],
  },
};

export const AllShare: Story = {
  render: RenderFixture,
  args: {
    destinations: [
      { id: 'd-1', label: 'Target Alpha', share: 1 },
      { id: 'd-2', label: 'Target Beta', share: 1 },
      { id: 'd-3', label: 'Target Gamma', share: 1 },
    ],
  },
};

export const NoIcons: Story = {
  args: {
    sources: sources.map(({ icon: _, ...rest }) => rest),
    destinations: destinations.map(({ icon: _, ...rest }) => rest),
    core: { ...core, icon: undefined },
  },
};

export const CustomNodes: Story = {
  render: RenderFixture,
  args: {
    sources: [
      {
        id: 's-api',
        label: 'Public Gateway',
        meta: '20,000 req/sec',
        detail: 'Rate-limited edge reverse proxy',
        icon: <span>🌐</span>,
      },
      {
        id: 's-iot',
        label: 'Sensor Mesh',
        meta: 'MQTT broker',
        detail: 'Binary sensor telemetry packets',
        icon: <span>📡</span>,
      },
    ],
    core: {
      ...core,
      label: 'Stream Processor',
      detail: 'Apache Flink windowed aggregation',
      icon: <span>⚙️</span>,
      countStart: 1000,
    },
    destinations: [
      {
        id: 'd-db',
        label: 'Timescale DB',
        meta: 'Continuous aggregates',
        detail: 'Partitioned hypertable',
        share: 1,
        icon: <span>💾</span>,
      },
    ],
  },
};

export const CaptionZero: Story = {
  args: {
    caption: 0,
  },
};

export const Empty: Story = {
  render: RenderFixture,
  args: {
    sources: [],
    destinations: [],
  },
};

export const InvalidShare: Story = {
  args: {
    destinations: [
      { id: 'd-invalid', label: 'Bad Share', share: 1.5 },
    ],
  },
};

export const DuplicateIds: Story = {
  args: {
    sources: [
      { id: 'dup-id', label: 'Source A' },
      { id: 'dup-id', label: 'Source B' },
    ],
  },
};

export const LongLabels: Story = {
  render: RenderFixture,
  args: {
    sources: [
      {
        id: 's-long',
        label: 'Extremely long data ingestion source service endpoint with verbose naming conventions',
        meta: 'Very long metadata description that wraps gracefully without breaking layout bounds',
        detail: 'Detailed long URL string https://api.subdomain.internal.company.production.service.com/v1/long-endpoint-path',
      },
    ],
    destinations: [
      {
        id: 'd-long',
        label: 'Enterprise long-term archival data warehouse retention policy sink',
        meta: 'Compliance partition replicated across multiple geographical availability zones',
        detail: 'Encrypted at rest with dedicated customer-managed encryption keys',
      },
    ],
  },
};

export const EightByEightBudget: Story = {
  render: RenderFixture,
  args: {
    sources: Array.from({ length: 8 }, (_, i) => ({
      id: `src-${i + 1}`,
      label: `Ingest ${i + 1}`,
      meta: `Source #${i + 1}`,
    })),
    destinations: Array.from({ length: 8 }, (_, i) => ({
      id: `dst-${i + 1}`,
      label: `Egress ${i + 1}`,
      share: (i + 1) / 8,
    })),
  },
};

export const SpeedZero: Story = {
  args: {
    speed: 0,
  },
};

export const Paused: Story = {
  args: {
    paused: true,
  },
};

export const LightTheme: Story = {
  globals: { theme: 'light' },
};

export const RTL: Story = {
  render: (args) => (
    <div dir="rtl">
      <DataFlow {...args} />
    </div>
  ),
};

export const ReducedMotion: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Enable reduced motion in your browser to inspect the static route snapshot.',
      },
    },
  },
};

export const ForcedColors: Story = {};

export const NarrowContainer: Story = {
  render: (args) => (
    <NarrowFrame>
      <DataFlow {...args} />
    </NarrowFrame>
  ),
};

export const Keyboard: Story = {
  args: {
    defaultPaused: false,
  },
  play: async ({ canvas, userEvent, args }) => {
    const pause = canvas.getByRole('button', { name: 'Pause animation' });
    await userEvent.tab();
    await expect(pause.ownerDocument.activeElement).toBe(pause);
    await expect(getComputedStyle(pause).outlineStyle).not.toBe('none');

    // While running, step button is disabled
    const step = canvas.getByRole('button', { name: 'Step forward' });
    await expect(step).toBeDisabled();

    // Pause playback via Space
    await userEvent.keyboard(' ');
    await expect(args.onPausedChange).toHaveBeenCalledWith(true);
    await waitFor(() => {
      expect(canvas.getByRole('button', { name: 'Resume animation' })).toBeVisible();
    });
    await expect(step).toBeEnabled();

    // Tab to step button
    await userEvent.tab();
    await expect(pause.ownerDocument.activeElement).toBe(step);

    // Tab to replay button
    await userEvent.tab();
    const replay = canvas.getByRole('button', { name: 'Replay animation' });
    await expect(pause.ownerDocument.activeElement).toBe(replay);

    // Replay activation via Enter
    await userEvent.keyboard('{Enter}');
    await expect(replay.ownerDocument.activeElement).toBe(replay);

    // Shift-Tab back to step button
    await userEvent.tab({ shift: true });
    await expect(pause.ownerDocument.activeElement).toBe(step);
  },
};

export const ControlledPauseRejects: Story = {
  args: {
    paused: false,
  },
  play: async ({ canvas, userEvent, args }) => {
    const pause = canvas.getByRole('button', { name: 'Pause animation' });
    await userEvent.click(pause);
    await expect(args.onPausedChange).toHaveBeenCalledWith(true);
    await expect(args.onPausedChange).toHaveBeenCalledTimes(1);
    // Button name remains 'Pause animation' because parent rejected the state update
    await expect(canvas.getByRole('button', { name: 'Pause animation' })).toBeVisible();
  },
};

export const AcceptedPause: Story = {
  render: (args) => {
    const [isPaused, setIsPaused] = useState(false);
    return (
      <Frame>
        <DataFlow {...args} paused={isPaused} onPausedChange={setIsPaused} />
      </Frame>
    );
  },
  play: async ({ canvas, userEvent }) => {
    const pauseBtn = canvas.getByRole('button', { name: 'Pause animation' });
    const stepBtn = canvas.getByRole('button', { name: 'Step forward' });

    await expect(stepBtn).toBeDisabled();
    await userEvent.click(pauseBtn);

    // Once accepted, button toggles to resume and step button is enabled
    await waitFor(() => {
      expect(canvas.getByRole('button', { name: 'Resume animation' })).toBeVisible();
    });
    await expect(canvas.getByRole('button', { name: 'Step forward' })).toBeEnabled();
  },
};

export const StepCycle: Story = {
  args: {
    defaultPaused: true,
  },
  play: async ({ canvas, userEvent }) => {
    const stepBtn = canvas.getByRole('button', { name: 'Step forward' });
    await expect(stepBtn).toBeEnabled();

    // Step through ingest -> transform -> route -> ingest
    await userEvent.click(stepBtn);
    await userEvent.click(stepBtn);
    await userEvent.click(stepBtn);

    await expect(stepBtn.ownerDocument.activeElement).toBe(stepBtn);
  },
};

export const SameSnapshotReplay: Story = {
  args: {
    defaultPaused: true,
  },
  play: async ({ canvas, userEvent, args }) => {
    const replayBtn = canvas.getByRole('button', { name: 'Replay animation' });
    await userEvent.click(replayBtn);
    await expect(args.onPausedChange).not.toHaveBeenCalled();
    await expect(replayBtn.ownerDocument.activeElement).toBe(replayBtn);
  },
};

export const SummaryOutsideScene: Story = {
  play: async ({ canvas, canvasElement }) => {
    const summaryList = canvasElement.querySelector('ol[data-ui="data-flow-summary"]');
    const scene = canvasElement.querySelector('div[data-ui="data-flow-scene"]');

    expect(summaryList).not.toBeNull();
    expect(scene).not.toBeNull();
    expect(scene?.contains(summaryList)).toBe(false);

    const steps = canvas.getAllByRole('listitem');
    expect(steps.length).toBeGreaterThanOrEqual(3);
    for (const step of steps) {
      expect(step).toBeVisible();
    }
  },
};

export const CaptionZeroRenders: Story = {
  args: {
    caption: 0,
  },
  play: async ({ canvasElement }) => {
    const figcaption = canvasElement.querySelector('figcaption');
    expect(figcaption).not.toBeNull();
    expect(figcaption?.textContent).toBe('0');

    const figure = canvasElement.querySelector('figure[data-ui="data-flow"]');
    const describedBy = figure?.getAttribute('aria-describedby') ?? '';
    const captionId = figcaption?.getAttribute('id') ?? '';
    expect(describedBy).toContain(captionId);
  },
};
