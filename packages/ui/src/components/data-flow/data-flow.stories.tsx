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

const defaultSummarySource = `const summary: readonly DataFlowSummaryStep[] = [
  { id: 'step-ingest', content: 'Client events supplies telemetry and clicks over HTTPS /v1/events. Database CDC supplies a Postgres change stream through WAL logical replication. Partner webhooks supplies HMAC-signed JSON. Hollow circles represent incoming records.' },
  { id: 'step-transform', content: 'The Transformation engine validates, normalizes schemas and enriches records. Solid squares represent processed records.' },
  { id: 'step-route', content: 'The Data warehouse analytics cluster receives every record. The Elasticsearch Search index receives 50%. The S3 Glacier Cold archive receives a 25% compliance sample. These shares and the record count are illustrative.' },
];`;

const nodeSummarySource = `const percent = new Intl.NumberFormat('en-US', { style: 'percent' });
const summary: DataFlowSummaryStep[] = [
  { id: 'sources', content: sources.map(node => [node.label, node.meta, node.detail].filter(Boolean).join(': ')).join('. ') || 'No sources configured.' },
  { id: 'core', content: [core.label, core.detail].filter(Boolean).join(': ') },
  { id: 'destinations', content: destinations.map(node => \`\${[node.label, node.meta, node.detail].filter(Boolean).join(': ')}; illustrative share \${percent.format(node.share ?? 1)}\`).join('. ') || 'No destinations configured.' },
];`;

const pipelineLabelsSource = `  label="Data processing pipeline illustration"
  controlLabels={{ pause: 'Pause animation', resume: 'Resume animation', step: 'Step forward', replay: 'Replay animation', group: 'Playback transport controls' }}
  emptyContent="No sources or destinations configured for this pipeline."
  invalidContent="Cannot render pipeline: invalid configuration provided."
  locale="en-US"`;

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
    layout: 'padded',
    docs: {
      sections: [
        { title: 'Basic', stories: ['Default'] },
        { title: 'Nodes and edges', stories: ['CustomNodes', 'PartialShare', 'NoIcons'] },
        { title: 'States', stories: ['Paused', 'Empty'] },
        { title: 'Layout', stories: ['Horizontal', 'Vertical', 'NarrowContainer'] },
        { title: 'Long content', stories: ['LongLabels'] },
        { title: 'Composition', stories: ['AcceptedPause'] },
      ],
      description: {
        component: 'Illustrate data moving from sources through core transformation to destinations.',
      },
      usage: `### When to use
Use DataFlow to illustrate data pipelines, ingest topologies, and transform flows with synthetic particles and a semantic summary. It is an illustration for documentation and overviews, not a real-time monitoring dashboard or live pipeline controller.

### Constraints
- Destination routing shares range from 0 (receives no emitted records) to 1 (receives every emitted record). Fractional shares accumulate across cycles.
- Playback supports controlled and uncontrolled pause states. Pausing freezes the animation immediately.
- When paused, at speed 0, or under reduced motion, the Step control advances through ingest, transform, and route snapshots. Replay resets the cycle and counter to countStart.
- Every pipeline requires an ordered summary describing sources, core transformation, and destination shares.

### Keyboard and accessibility
Native transport controls (Pause/Resume, Step, Replay) sit in standard tab order and activate with Enter or Space. The Step control is disabled during active playback. The animated canvas is hidden from assistive technology; screen readers navigate the structured summary list.`,
      source: {
        language: 'tsx',
        code: `import { DataFlow, type DataFlowCore, type DataFlowDestinationNode, type DataFlowNode, type DataFlowSummaryStep } from '@jfrader/ui';

const sources: readonly DataFlowNode[] = [
  { id: 'src-events', label: 'Client events', meta: 'Telemetry and clicks', detail: 'HTTPS /v1/events' },
  { id: 'src-cdc', label: 'Database CDC', meta: 'Postgres change stream', detail: 'WAL logical replication' },
  { id: 'src-webhooks', label: 'Partner webhooks', meta: 'Inbound integration', detail: 'HMAC-signed JSON' },
];

const destinations: readonly DataFlowDestinationNode[] = [
  { id: 'dst-warehouse', label: 'Data warehouse', meta: 'Analytics cluster', detail: '100% full dataset', share: 1 },
  { id: 'dst-search', label: 'Search index', meta: 'Elasticsearch', detail: '50% sampled query stream', share: 0.5 },
  { id: 'dst-cold', label: 'Cold archive', meta: 'S3 glacier storage', detail: '25% compliance sample', share: 0.25 },
];

const core: DataFlowCore = {
  id: 'core-transform',
  label: 'Transformation engine',
  detail: 'Validation, schema normalization and enrichment',
  countStart: 0,
  countLabel: 'records',
};

const summary: readonly DataFlowSummaryStep[] = [
  { id: 'step-ingest', content: 'Client events supplies telemetry and clicks over HTTPS /v1/events. Database CDC supplies a Postgres change stream through WAL logical replication. Partner webhooks supplies HMAC-signed JSON. Hollow circles represent incoming records.' },
  { id: 'step-transform', content: 'The Transformation engine validates, normalizes schemas and enriches records. Solid squares represent processed records.' },
  { id: 'step-route', content: 'The Data warehouse analytics cluster receives every record. The Elasticsearch Search index receives 50%. The S3 Glacier Cold archive receives a 25% compliance sample. These shares and the record count are illustrative.' },
];

<DataFlow
  sources={sources}
  core={core}
  destinations={destinations}
  summary={summary}
  label="Data processing pipeline illustration"
  controlLabels={{
    pause: 'Pause animation',
    resume: 'Resume animation',
    step: 'Step forward',
    replay: 'Replay animation',
    group: 'Playback transport controls',
  }}
  emptyContent="No sources or destinations configured for this pipeline."
  invalidContent="Cannot render pipeline: invalid configuration provided."
  defaultPaused
/>`,
      },
    },
  },
} satisfies Meta<typeof DataFlow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Pipeline overview',
  parameters: {
    docs: {
      description: {
        story: 'Illustrate data moving from sources through a central transform to weighted destinations.',
      },
      source: {
        language: 'tsx',
        code: `import { DataFlow, type DataFlowCore, type DataFlowDestinationNode, type DataFlowNode, type DataFlowSummaryStep } from '@jfrader/ui';

const sources: readonly DataFlowNode[] = [
  { id: 'src-events', label: 'Client events', meta: 'Telemetry and clicks', detail: 'HTTPS /v1/events' },
  { id: 'src-cdc', label: 'Database CDC', meta: 'Postgres change stream', detail: 'WAL logical replication' },
  { id: 'src-webhooks', label: 'Partner webhooks', meta: 'Inbound integration', detail: 'HMAC-signed JSON' },
];

const destinations: readonly DataFlowDestinationNode[] = [
  { id: 'dst-warehouse', label: 'Data warehouse', meta: 'Analytics cluster', detail: '100% full dataset', share: 1 },
  { id: 'dst-search', label: 'Search index', meta: 'Elasticsearch', detail: '50% sampled query stream', share: 0.5 },
  { id: 'dst-cold', label: 'Cold archive', meta: 'S3 glacier storage', detail: '25% compliance sample', share: 0.25 },
];

const core: DataFlowCore = {
  id: 'core-transform',
  label: 'Transformation engine',
  detail: 'Validation, schema normalization and enrichment',
  countStart: 0,
  countLabel: 'records',
};

const summary: readonly DataFlowSummaryStep[] = [
  { id: 'step-ingest', content: 'Client events supplies telemetry and clicks over HTTPS /v1/events. Database CDC supplies a Postgres change stream through WAL logical replication. Partner webhooks supplies HMAC-signed JSON. Hollow circles represent incoming records.' },
  { id: 'step-transform', content: 'The Transformation engine validates, normalizes schemas and enriches records. Solid squares represent processed records.' },
  { id: 'step-route', content: 'The Data warehouse analytics cluster receives every record. The Elasticsearch Search index receives 50%. The S3 Glacier Cold archive receives a 25% compliance sample. These shares and the record count are illustrative.' },
];

<DataFlow
  sources={sources}
  core={core}
  destinations={destinations}
  summary={summary}
  label="Data processing pipeline illustration"
  controlLabels={{
    pause: 'Pause animation',
    resume: 'Resume animation',
    step: 'Step forward',
    replay: 'Replay animation',
    group: 'Playback transport controls',
  }}
  emptyContent="No sources or destinations configured for this pipeline."
  invalidContent="Cannot render pipeline: invalid configuration provided."
  locale="en-US"
  defaultPaused
/>`,
      },
    },
  },
};

export const Horizontal: Story = {
  name: 'Horizontal layout',
  parameters: {
    docs: {
      description: {
        story: 'Align pipeline stages horizontally from sources on the inline start to destinations on the inline end.',
      },
      source: {
        language: 'tsx',
        code: `import { DataFlow, type DataFlowCore, type DataFlowDestinationNode, type DataFlowNode, type DataFlowSummaryStep } from '@jfrader/ui';

const sources: readonly DataFlowNode[] = [
  { id: 'src-events', label: 'Client events', meta: 'Telemetry and clicks', detail: 'HTTPS /v1/events' },
  { id: 'src-cdc', label: 'Database CDC', meta: 'Postgres change stream', detail: 'WAL logical replication' },
  { id: 'src-webhooks', label: 'Partner webhooks', meta: 'Inbound integration', detail: 'HMAC-signed JSON' },
];

const destinations: readonly DataFlowDestinationNode[] = [
  { id: 'dst-warehouse', label: 'Data warehouse', meta: 'Analytics cluster', detail: '100% full dataset', share: 1 },
  { id: 'dst-search', label: 'Search index', meta: 'Elasticsearch', detail: '50% sampled query stream', share: 0.5 },
  { id: 'dst-cold', label: 'Cold archive', meta: 'S3 glacier storage', detail: '25% compliance sample', share: 0.25 },
];

const core: DataFlowCore = {
  id: 'core-transform',
  label: 'Transformation engine',
  detail: 'Validation, schema normalization and enrichment',
  countStart: 0,
  countLabel: 'records',
};

${defaultSummarySource}

<DataFlow
  orientation="horizontal"
  sources={sources}
  core={core}
  destinations={destinations}
  summary={summary}
${pipelineLabelsSource}
  defaultPaused
/>`,
      },
    },
  },
  args: { orientation: 'horizontal' },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const figure = canvasElement.querySelector<HTMLElement>('[data-ui="data-flow"]')!;
    const scene = figure.querySelector<HTMLElement>('[data-ui="data-flow-scene"]')!;
    const previousSize = figure.style.inlineSize;
    figure.style.inlineSize = '360px';
    try {
      await waitFor(() => {
        expect(scene.scrollWidth).toBeGreaterThan(scene.clientWidth);
        for (const node of scene.querySelectorAll('[data-ui="data-flow-node"]')) {
          expect(node.getBoundingClientRect().width).toBeGreaterThan(100);
        }
      });
      scene.scrollLeft = getComputedStyle(scene).direction === 'rtl' ? -scene.scrollWidth : scene.scrollWidth;
      const destination = scene.querySelector('[data-ui="data-flow-destinations"]')!;
      await expect(destination.getBoundingClientRect().left).toBeGreaterThanOrEqual(scene.getBoundingClientRect().left - 1);
      await expect(destination.getBoundingClientRect().right).toBeLessThanOrEqual(scene.getBoundingClientRect().right + 1);
      await userEvent.tab();
      await expect(figure.ownerDocument.activeElement).toBe(canvas.getByRole('button', { name: 'Resume animation' }));
    } finally {
      scene.scrollLeft = 0;
      figure.style.inlineSize = previousSize;
    }
  },
};

export const Vertical: Story = {
  name: 'Vertical layout',
  parameters: {
    docs: {
      description: {
        story: 'Stack pipeline stages vertically from sources at the top to destinations at the bottom.',
      },
      source: {
        language: 'tsx',
        code: `import { DataFlow, type DataFlowCore, type DataFlowDestinationNode, type DataFlowNode, type DataFlowSummaryStep } from '@jfrader/ui';

const sources: readonly DataFlowNode[] = [
  { id: 'src-events', label: 'Client events', meta: 'Telemetry and clicks', detail: 'HTTPS /v1/events' },
  { id: 'src-cdc', label: 'Database CDC', meta: 'Postgres change stream', detail: 'WAL logical replication' },
  { id: 'src-webhooks', label: 'Partner webhooks', meta: 'Inbound integration', detail: 'HMAC-signed JSON' },
];

const destinations: readonly DataFlowDestinationNode[] = [
  { id: 'dst-warehouse', label: 'Data warehouse', meta: 'Analytics cluster', detail: '100% full dataset', share: 1 },
  { id: 'dst-search', label: 'Search index', meta: 'Elasticsearch', detail: '50% sampled query stream', share: 0.5 },
  { id: 'dst-cold', label: 'Cold archive', meta: 'S3 glacier storage', detail: '25% compliance sample', share: 0.25 },
];

const core: DataFlowCore = {
  id: 'core-transform',
  label: 'Transformation engine',
  detail: 'Validation, schema normalization and enrichment',
  countStart: 0,
  countLabel: 'records',
};

${defaultSummarySource}

<DataFlow
  orientation="vertical"
  sources={sources}
  core={core}
  destinations={destinations}
  summary={summary}
${pipelineLabelsSource}
  defaultPaused
/>`,
      },
    },
  },
  args: { orientation: 'vertical' },
};

export const PartialShare: Story = {
  name: 'Weighted routing shares',
  parameters: {
    docs: {
      description: {
        story: 'Route records proportionally across destinations with fractional share ratios.',
      },
      source: {
        language: 'tsx',
        code: `import { DataFlow, type DataFlowCore, type DataFlowDestinationNode, type DataFlowNode, type DataFlowSummaryStep } from '@jfrader/ui';

const sources: readonly DataFlowNode[] = [
  { id: 'src-events', label: 'Client events', meta: 'Telemetry and clicks', detail: 'HTTPS /v1/events' },
  { id: 'src-cdc', label: 'Database CDC', meta: 'Postgres change stream', detail: 'WAL logical replication' },
  { id: 'src-webhooks', label: 'Partner webhooks', meta: 'Inbound integration', detail: 'HMAC-signed JSON' },
];

const destinations: readonly DataFlowDestinationNode[] = [
  { id: 'd-full', label: 'Primary store', share: 1 },
  { id: 'd-half', label: 'Secondary replica', share: 0.5 },
  { id: 'd-quarter', label: 'Audit trail', share: 0.25 },
];

const core: DataFlowCore = {
  id: 'core-transform',
  label: 'Transformation engine',
  detail: 'Validation, schema normalization and enrichment',
  countStart: 0,
  countLabel: 'records',
};

${nodeSummarySource}

<DataFlow
  sources={sources}
  core={core}
  destinations={destinations}
  summary={summary}
${pipelineLabelsSource}
  defaultPaused
/>`,
      },
    },
  },
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
  name: 'Unrouted destination',
  parameters: {
    docs: {
      description: {
        story: 'Set a destination share to zero to represent an inactive or standby endpoint.',
      },
      source: {
        language: 'tsx',
        code: `import { DataFlow, type DataFlowCore, type DataFlowDestinationNode, type DataFlowNode, type DataFlowSummaryStep } from '@jfrader/ui';

const sources: readonly DataFlowNode[] = [
  { id: 'src-events', label: 'Client events', meta: 'Telemetry and clicks', detail: 'HTTPS /v1/events' },
  { id: 'src-cdc', label: 'Database CDC', meta: 'Postgres change stream', detail: 'WAL logical replication' },
  { id: 'src-webhooks', label: 'Partner webhooks', meta: 'Inbound integration', detail: 'HMAC-signed JSON' },
];

const destinations: readonly DataFlowDestinationNode[] = [
  { id: 'd-active', label: 'Active cluster', share: 1 },
  { id: 'd-disabled', label: 'Maintenance standby', share: 0 },
];

const core: DataFlowCore = {
  id: 'core-transform',
  label: 'Transformation engine',
  detail: 'Validation, schema normalization and enrichment',
  countStart: 0,
  countLabel: 'records',
};

const summary: readonly DataFlowSummaryStep[] = [
  { id: 'sources', content: 'Sources stream incoming records.' },
  { id: 'core', content: 'Transformation engine normalizes records.' },
  { id: 'destinations', content: 'Active cluster receives all records; Maintenance standby is inactive at zero share.' },
];

<DataFlow
  sources={sources}
  core={core}
  destinations={destinations}
  summary={summary}
${pipelineLabelsSource}
  defaultPaused
/>`,
      },
    },
  },
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
  name: 'Text-only nodes',
  parameters: {
    docs: {
      description: {
        story: 'Display pipeline nodes without icon adornments.',
      },
      source: {
        language: 'tsx',
        code: `import { DataFlow, type DataFlowNode, type DataFlowDestinationNode } from '@jfrader/ui';

const sources: readonly DataFlowNode[] = [
  { id: 'src-events', label: 'Client events', meta: 'Telemetry and clicks', detail: 'HTTPS /v1/events' },
  { id: 'src-cdc', label: 'Database CDC', meta: 'Postgres change stream', detail: 'WAL logical replication' },
  { id: 'src-webhooks', label: 'Partner webhooks', meta: 'Inbound integration', detail: 'HMAC-signed JSON' },
];
const destinations: readonly DataFlowDestinationNode[] = [
  { id: 'dst-warehouse', label: 'Data warehouse', meta: 'Analytics cluster', detail: '100% full dataset', share: 1 },
  { id: 'dst-search', label: 'Search index', meta: 'Elasticsearch', detail: '50% sampled query stream', share: 0.5 },
  { id: 'dst-cold', label: 'Cold archive', meta: 'S3 glacier storage', detail: '25% compliance sample', share: 0.25 },
];

<DataFlow
  sources={sources}
  destinations={destinations}
  core={{ id: 'core-transform', label: 'Transformation engine', detail: 'Validation, schema normalization and enrichment', countStart: 0, countLabel: 'records' }}
  summary={[
    { id: 'step-ingest', content: 'Client events supplies telemetry and clicks over HTTPS /v1/events. Database CDC supplies a Postgres change stream through WAL logical replication. Partner webhooks supplies HMAC-signed JSON. Hollow circles represent incoming records.' },
    { id: 'step-transform', content: 'The Transformation engine validates, normalizes schemas and enriches records. Solid squares represent processed records.' },
    { id: 'step-route', content: 'The Data warehouse analytics cluster receives every record. The Elasticsearch Search index receives 50%. The S3 Glacier Cold archive receives a 25% compliance sample. These shares and the record count are illustrative.' },
  ]}
  label="Data processing pipeline illustration"
  controlLabels={{ pause: 'Pause animation', resume: 'Resume animation', step: 'Step forward', replay: 'Replay animation', group: 'Playback transport controls' }}
  emptyContent="No sources or destinations configured for this pipeline."
  invalidContent="Cannot render pipeline: invalid configuration provided."
  locale="en-US"
  defaultPaused
/>`,
      },
    },
  },
  args: {
    sources: sources.map(({ icon: _, ...rest }) => rest),
    destinations: destinations.map(({ icon: _, ...rest }) => rest),
    core: { ...core, icon: undefined },
  },
};

export const CustomNodes: Story = {
  name: 'Custom node icons',
  parameters: {
    docs: {
      description: {
        story: 'Configure custom icons, labels, and initial record counters for pipeline nodes.',
      },
      source: {
        language: 'tsx',
        code: `import { DataFlow, type DataFlowCore, type DataFlowDestinationNode, type DataFlowNode, type DataFlowSummaryStep } from '@jfrader/ui';

const sources: readonly DataFlowNode[] = [
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
];

const destinations: readonly DataFlowDestinationNode[] = [
  {
    id: 'd-db',
    label: 'Timescale DB',
    meta: 'Continuous aggregates',
    detail: 'Partitioned hypertable',
    share: 1,
    icon: <span>💾</span>,
  },
];

const core: DataFlowCore = {
  id: 'core-transform',
  label: 'Stream Processor',
  detail: 'Apache Flink windowed aggregation',
  icon: <span>⚙️</span>,
  countStart: 1000,
  countLabel: 'records',
};

${nodeSummarySource}

<DataFlow
  sources={sources}
  core={core}
  destinations={destinations}
  summary={summary}
${pipelineLabelsSource}
  defaultPaused
/>`,
      },
    },
  },
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
  name: 'Empty pipeline',
  parameters: {
    docs: {
      description: {
        story: 'Render a fallback message when no sources or destinations are configured.',
      },
      source: {
        language: 'tsx',
        code: `import { DataFlow } from '@jfrader/ui';

<DataFlow
  sources={[]}
  destinations={[]}
  core={{ id: 'core-transform', label: 'Transformation engine', detail: 'Validation, schema normalization and enrichment', countStart: 0, countLabel: 'records' }}
  summary={[
    { id: 'sources', content: 'No sources configured.' },
    { id: 'core', content: 'Transformation engine: Validation, schema normalization and enrichment' },
    { id: 'destinations', content: 'No destinations configured.' },
  ]}
${pipelineLabelsSource}
  defaultPaused
/>`,
      },
    },
  },
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
  name: 'Long text wrapping',
  parameters: {
    docs: {
      description: {
        story: 'Wrap verbose node labels, metadata, and detailed URLs without overflowing container bounds.',
      },
      source: {
        language: 'tsx',
        code: `import { DataFlow, type DataFlowCore, type DataFlowDestinationNode, type DataFlowNode, type DataFlowSummaryStep } from '@jfrader/ui';

const sources: readonly DataFlowNode[] = [
  {
    id: 's-long',
    label: 'Extremely long data ingestion source service endpoint with verbose naming conventions',
    meta: 'Very long metadata description that wraps gracefully without breaking layout bounds',
    detail: 'Detailed long URL string https://api.subdomain.internal.company.production.service.com/v1/long-endpoint-path',
  },
];

const destinations: readonly DataFlowDestinationNode[] = [
  {
    id: 'd-long',
    label: 'Enterprise long-term archival data warehouse retention policy sink',
    meta: 'Compliance partition replicated across multiple geographical availability zones',
    detail: 'Encrypted at rest with dedicated customer-managed encryption keys',
    share: 1,
  },
];

const core: DataFlowCore = {
  id: 'core-transform',
  label: 'Transformation engine',
  detail: 'Validation, schema normalization and enrichment',
  countStart: 0,
  countLabel: 'records',
};

${nodeSummarySource}

<DataFlow
  sources={sources}
  core={core}
  destinations={destinations}
  summary={summary}
${pipelineLabelsSource}
  defaultPaused
/>`,
      },
    },
  },
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
  play: async ({ canvasElement }) => {
    const figure = canvasElement.querySelector<HTMLElement>('[data-ui="data-flow"]')!;
    const previousSize = figure.style.inlineSize;
    figure.style.inlineSize = '360px';
    try {
      await waitFor(() => {
        expect(figure.getBoundingClientRect().width).toBeLessThanOrEqual(360);
        expect(figure.scrollWidth).toBeLessThanOrEqual(figure.clientWidth + 1);
        const summary = figure.querySelector('[data-ui="data-flow-summary"]')!;
        expect(summary.scrollWidth).toBeLessThanOrEqual(summary.clientWidth + 1);
      });
    } finally {
      figure.style.inlineSize = previousSize;
    }
  },
};

export const EightByEightBudget: Story = {
  name: 'High-density pipeline',
  parameters: {
    docs: {
      description: {
        story: 'Render an eight-source, eight-destination topology at maximum node budget.',
      },
      source: {
        language: 'tsx',
        code: `import { DataFlow, type DataFlowCore, type DataFlowDestinationNode, type DataFlowNode, type DataFlowSummaryStep } from '@jfrader/ui';

const sources: readonly DataFlowNode[] = Array.from({ length: 8 }, (_, i) => ({
  id: \`src-\${i + 1}\`,
  label: \`Ingest \${i + 1}\`,
  meta: \`Source #\${i + 1}\`,
}));

const destinations: readonly DataFlowDestinationNode[] = Array.from({ length: 8 }, (_, i) => ({
  id: \`dst-\${i + 1}\`,
  label: \`Egress \${i + 1}\`,
  share: (i + 1) / 8,
}));

const core: DataFlowCore = {
  id: 'core-transform',
  label: 'Transformation engine',
  detail: 'Validation, schema normalization and enrichment',
  countStart: 0,
  countLabel: 'records',
};

const summary: readonly DataFlowSummaryStep[] = [
  { id: 'step-ingest', content: 'Eight sources feed incoming records.' },
  { id: 'step-transform', content: 'Transformation engine enriches records.' },
  { id: 'step-route', content: 'Eight destinations receive apportioned egress shares.' },
];

<DataFlow
  sources={sources}
  core={core}
  destinations={destinations}
  summary={summary}
${pipelineLabelsSource}
  defaultPaused
/>`,
      },
    },
  },
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
  name: 'Zero speed',
  parameters: {
    docs: {
      description: {
        story: 'Hold playback at zero speed to inspect topology while enabling step controls.',
      },
      source: {
        language: 'tsx',
        code: `import { DataFlow, type DataFlowCore, type DataFlowDestinationNode, type DataFlowNode, type DataFlowSummaryStep } from '@jfrader/ui';

const sources: readonly DataFlowNode[] = [
  { id: 'src-events', label: 'Client events', meta: 'Telemetry and clicks', detail: 'HTTPS /v1/events' },
  { id: 'src-cdc', label: 'Database CDC', meta: 'Postgres change stream', detail: 'WAL logical replication' },
  { id: 'src-webhooks', label: 'Partner webhooks', meta: 'Inbound integration', detail: 'HMAC-signed JSON' },
];

const destinations: readonly DataFlowDestinationNode[] = [
  { id: 'dst-warehouse', label: 'Data warehouse', meta: 'Analytics cluster', detail: '100% full dataset', share: 1 },
  { id: 'dst-search', label: 'Search index', meta: 'Elasticsearch', detail: '50% sampled query stream', share: 0.5 },
  { id: 'dst-cold', label: 'Cold archive', meta: 'S3 glacier storage', detail: '25% compliance sample', share: 0.25 },
];

const core: DataFlowCore = {
  id: 'core-transform',
  label: 'Transformation engine',
  detail: 'Validation, schema normalization and enrichment',
  countStart: 0,
  countLabel: 'records',
};

const summary: readonly DataFlowSummaryStep[] = [
  { id: 'step-ingest', content: 'Sources supply initial records.' },
  { id: 'step-transform', content: 'Core transformation processes records.' },
  { id: 'step-route', content: 'Destinations receive routed records.' },
];

<DataFlow
  sources={sources}
  core={core}
  destinations={destinations}
  summary={summary}
${pipelineLabelsSource}
  speed={0}
/>`,
      },
    },
  },
  args: {
    speed: 0,
  },
};

export const Paused: Story = {
  name: 'Paused playback',
  parameters: {
    docs: {
      description: {
        story: 'Freeze particle animation to display a static snapshot of pipeline traffic.',
      },
      source: {
        language: 'tsx',
        code: `import { DataFlow, type DataFlowCore, type DataFlowDestinationNode, type DataFlowNode, type DataFlowSummaryStep } from '@jfrader/ui';

const sources: readonly DataFlowNode[] = [
  { id: 'src-events', label: 'Client events', meta: 'Telemetry and clicks', detail: 'HTTPS /v1/events' },
  { id: 'src-cdc', label: 'Database CDC', meta: 'Postgres change stream', detail: 'WAL logical replication' },
  { id: 'src-webhooks', label: 'Partner webhooks', meta: 'Inbound integration', detail: 'HMAC-signed JSON' },
];

const destinations: readonly DataFlowDestinationNode[] = [
  { id: 'dst-warehouse', label: 'Data warehouse', meta: 'Analytics cluster', detail: '100% full dataset', share: 1 },
  { id: 'dst-search', label: 'Search index', meta: 'Elasticsearch', detail: '50% sampled query stream', share: 0.5 },
  { id: 'dst-cold', label: 'Cold archive', meta: 'S3 glacier storage', detail: '25% compliance sample', share: 0.25 },
];

const core: DataFlowCore = {
  id: 'core-transform',
  label: 'Transformation engine',
  detail: 'Validation, schema normalization and enrichment',
  countStart: 0,
  countLabel: 'records',
};

${defaultSummarySource}

<DataFlow
  sources={sources}
  core={core}
  destinations={destinations}
  summary={summary}
${pipelineLabelsSource}
  paused
/>`,
      },
    },
  },
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
  play: async ({ canvasElement }) => {
    const scene = canvasElement.querySelector<HTMLElement>('[data-ui="data-flow-scene"]')!;
    const container = scene.closest('[dir]')!;
    try {
      for (const direction of ['ltr', 'rtl']) {
        container.setAttribute('dir', direction);
        await waitFor(() => {
          const node = scene.querySelector('[data-ui="data-flow-sources"] [data-ui="data-flow-node"]')!;
          const path = scene.querySelector('path')!;
          const rect = node.getBoundingClientRect();
          const point = path.getPointAtLength(0).matrixTransform(path.getScreenCTM()!);
          const horizontal = scene.querySelector('[data-orientation]')?.getAttribute('data-orientation') === 'horizontal';
          const usesRightEdge = horizontal ? direction === 'ltr' : direction === 'rtl';
          expect(Math.abs(point.x - (usesRightEdge ? rect.right : rect.left))).toBeLessThan(1);
          expect(Math.abs(point.y - (rect.top + rect.height / 2))).toBeLessThan(1);
        });
      }
    } finally {
      container.setAttribute('dir', 'rtl');
    }
  },
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
  name: 'Narrow container',
  parameters: {
    docs: {
      description: {
        story: 'Adapt pipeline nodes and connectors gracefully within a constrained layout width.',
      },
      source: {
        language: 'tsx',
        code: `import { DataFlow, type DataFlowCore, type DataFlowDestinationNode, type DataFlowNode, type DataFlowSummaryStep } from '@jfrader/ui';

const sources: readonly DataFlowNode[] = [
  { id: 'src-events', label: 'Client events', meta: 'Telemetry and clicks', detail: 'HTTPS /v1/events' },
  { id: 'src-cdc', label: 'Database CDC', meta: 'Postgres change stream', detail: 'WAL logical replication' },
  { id: 'src-webhooks', label: 'Partner webhooks', meta: 'Inbound integration', detail: 'HMAC-signed JSON' },
];

const destinations: readonly DataFlowDestinationNode[] = [
  { id: 'dst-warehouse', label: 'Data warehouse', meta: 'Analytics cluster', detail: '100% full dataset', share: 1 },
  { id: 'dst-search', label: 'Search index', meta: 'Elasticsearch', detail: '50% sampled query stream', share: 0.5 },
  { id: 'dst-cold', label: 'Cold archive', meta: 'S3 glacier storage', detail: '25% compliance sample', share: 0.25 },
];

const core: DataFlowCore = {
  id: 'core-transform',
  label: 'Transformation engine',
  detail: 'Validation, schema normalization and enrichment',
  countStart: 0,
  countLabel: 'records',
};

${defaultSummarySource}

<DataFlow
  sources={sources}
  core={core}
  destinations={destinations}
  summary={summary}
${pipelineLabelsSource}
  defaultPaused
  sx={{ inlineSize: 360, maxInlineSize: '100%' }}
/>`,
      },
    },
  },
  render: (args) => (
    <NarrowFrame>
      <DataFlow {...args} />
    </NarrowFrame>
  ),
  play: async ({ canvasElement }) => {
    const scene = canvasElement.querySelector<HTMLElement>('[data-ui="data-flow-scene"]')!;
    await waitFor(() => {
      const nodes = [...scene.querySelectorAll('[data-ui="data-flow-node"]')].map(node => node.getBoundingClientRect());
      const paths = scene.querySelectorAll('path');
      expect(paths.length).toBe(sources.length + destinations.length);
      for (const path of paths) {
        const matrix = path.getScreenCTM()!;
        const length = path.getTotalLength();
        const points = Array.from({ length: 99 }, (_, index) => path.getPointAtLength(length * (index + 1) / 100).matrixTransform(matrix));
        const collisions = points.filter(point => nodes.some(node => point.x > node.left + 1 && point.x < node.right - 1 && point.y > node.top + 1 && point.y < node.bottom - 1));
        expect(collisions).toEqual([]);
      }
    });
  },
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

    const step = canvas.getByRole('button', { name: 'Step forward' });
    await expect(step).toHaveProperty('disabled', !matchMedia('(prefers-reduced-motion: reduce)').matches);

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
  name: 'Controlled playback',
  parameters: {
    docs: {
      description: {
        story: 'Bind playback pause state to external application state and transport handlers.',
      },
      source: {
        language: 'tsx',
        code: `import { useState } from 'react';
import { DataFlow, type DataFlowCore, type DataFlowDestinationNode, type DataFlowNode, type DataFlowSummaryStep } from '@jfrader/ui';

const sources: readonly DataFlowNode[] = [
  { id: 'src-events', label: 'Client events', meta: 'Telemetry and clicks', detail: 'HTTPS /v1/events' },
  { id: 'src-cdc', label: 'Database CDC', meta: 'Postgres change stream', detail: 'WAL logical replication' },
  { id: 'src-webhooks', label: 'Partner webhooks', meta: 'Inbound integration', detail: 'HMAC-signed JSON' },
];

const destinations: readonly DataFlowDestinationNode[] = [
  { id: 'dst-warehouse', label: 'Data warehouse', meta: 'Analytics cluster', detail: '100% full dataset', share: 1 },
  { id: 'dst-search', label: 'Search index', meta: 'Elasticsearch', detail: '50% sampled query stream', share: 0.5 },
  { id: 'dst-cold', label: 'Cold archive', meta: 'S3 glacier storage', detail: '25% compliance sample', share: 0.25 },
];

const core: DataFlowCore = {
  id: 'core-transform',
  label: 'Transformation engine',
  detail: 'Validation, schema normalization and enrichment',
  countStart: 0,
  countLabel: 'records',
};

${defaultSummarySource}

function ControlledPipeline() {
  const [paused, setPaused] = useState(false);

  return (
    <DataFlow
      sources={sources}
      core={core}
      destinations={destinations}
      summary={summary}
${pipelineLabelsSource}
      paused={paused}
      onPausedChange={setPaused}
    />
  );
}`,
      },
    },
  },
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

    await expect(stepBtn).toHaveProperty('disabled', !matchMedia('(prefers-reduced-motion: reduce)').matches);
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
