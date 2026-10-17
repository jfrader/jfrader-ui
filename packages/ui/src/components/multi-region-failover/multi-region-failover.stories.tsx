import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, waitFor } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { styled } from '../../styling/styled';
import { Button } from '../button';
import { Surface } from '../surface';
import {
  MultiRegionFailover,
  type FailoverStage,
  type RegionSnapshot,
} from './index';

const actors = {
  users: { label: 'Clients', meta: 'Global requests', detail: 'Web and mobile · 24,000 requests/sec' },
  balancer: { label: 'Load balancer', meta: 'Health-based routing', detail: 'HTTPS ingress · checks every 10 seconds' },
  primary: { label: 'Primary', detail: 'Region A' },
  secondary: { label: 'Secondary', detail: 'Region B' },
};
const healthy: RegionSnapshot = {
  weight: 0.5,
  requestsPerSecond: 12000,
  latencyMs: 25,
  errorRate: 0,
  healthyInstances: 6,
  passedChecks: 3,
  failedChecks: 0,
  statusLabel: 'Healthy',
};
const stages: readonly FailoverStage[] = [
  {
    id: 'balanced',
    title: 'Balanced',
    description: 'Both regions serve half of the requests.',
    durationMs: 3000,
    primary: healthy,
    secondary: healthy,
  },
  {
    id: 'degraded',
    title: 'Degraded',
    description: 'Primary health checks start failing.',
    durationMs: 3000,
    primary: {
      ...healthy,
      latencyMs: 190,
      healthyInstances: 3,
      errorRate: 0.09,
      passedChecks: 1,
      failedChecks: 2,
      statusLabel: 'Degraded',
    },
    secondary: healthy,
  },
  {
    id: 'failover',
    title: 'Failover',
    description: 'Traffic shifts to the secondary region.',
    durationMs: 3000,
    primary: {
      ...healthy,
      weight: 0.15,
      requestsPerSecond: 3600,
      healthyInstances: 1,
      passedChecks: 0,
      failedChecks: 3,
      statusLabel: 'Unhealthy',
    },
    secondary: { ...healthy, weight: 0.85, requestsPerSecond: 20400 },
  },
  {
    id: 'rerouted',
    title: 'Evacuated',
    description: 'Secondary handles all traffic while primary is isolated.',
    durationMs: 3000,
    primary: {
      ...healthy,
      weight: 0,
      requestsPerSecond: 0,
      latencyMs: 0,
      healthyInstances: 0,
      passedChecks: 0,
      failedChecks: 3,
      statusLabel: 'Isolated',
    },
    secondary: { ...healthy, weight: 1, requestsPerSecond: 24000 },
  },
  {
    id: 'recovery',
    title: 'Recovery',
    description: 'Primary has recovered and serves canary traffic.',
    durationMs: 3000,
    primary: {
      ...healthy,
      weight: 0.1,
      requestsPerSecond: 2400,
      statusLabel: 'Canary',
    },
    secondary: { ...healthy, weight: 0.9, requestsPerSecond: 21600 },
  },
  {
    id: 'rebalanced',
    title: 'Rebalanced',
    description: 'Both regions return to equal traffic share.',
    durationMs: 3000,
    primary: healthy,
    secondary: healthy,
  },
];
const controlLabels = {
  group: 'Playback and stage navigation',
  pause: 'Pause',
  resume: 'Resume',
  previous: 'Previous stage',
  next: 'Next stage',
  replay: 'Replay story',
};
const metricLabels = {
  requestsPerSecond: 'Requests/sec',
  latency: 'Latency',
  errorRate: 'Error rate',
  weight: 'Traffic share',
  passedChecks: 'Passed checks',
  failedChecks: 'Failed checks',
};
const Frame = styled.div({ display: 'grid', gap: vars.space[4] });
const IncidentPanel = styled(Surface)({
  boxSizing: 'border-box',
  inlineSize: `calc(${vars.space[8]} * 35)`,
  maxInlineSize: '100%',
  padding: vars.space[4],
});
const SceneNode = styled.div({ alignSelf: 'start' });
const Narrow = styled.div({ inlineSize: '320px', maxInlineSize: '100%' });
const meta = {
  title: 'Showcase/MultiRegionFailover',
  component: MultiRegionFailover,
  tags: ['autodocs'],
  render: (args) => (
    <IncidentPanel>
      <MultiRegionFailover {...args} slots={{ node: SceneNode, ...args.slots }} />
    </IncidentPanel>
  ),
  args: {
    nodes: actors,
    stages,
    hostname: 'api.example.test',
    label: 'Two-region failover walkthrough',
    controlLabels,
    metricLabels,
    invalidContent: 'Cannot display these stage snapshots.',
    locale: 'en-GB',
    defaultPaused: true,
    onValueChange: fn(),
    onPausedChange: fn(),
  },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `<MultiRegionFailover hostname="api.example.test" nodes={actors} stages={incidentStages}
  label="Two-region failover walkthrough" controlLabels={controlLabels} metricLabels={metricLabels}
  invalidContent="Cannot display these stage snapshots." locale="en-GB" defaultValue="failover" defaultPaused />`,
      },
      description: {
        component:
          'Explain a two-region incident through six readable stage snapshots. This is an illustration, not live monitoring or a traffic controller.',
      },
      usage: `### Snapshots\nSupply six ordered IDs: balanced, degraded, failover, rerouted, recovery, rebalanced. Every stage supplies a title, description, positive durationMs and primary/secondary metrics. Weights must sum to one, instance counts are integers from zero to six, and checks are explicit nonnegative integers. Invalid data renders invalidContent without playback. All six narratives and their region status/metrics remain visible outside the decorative scene.\n\n### Playback\nvalue/defaultValue and paused/defaultPaused are independent controlled/uncontrolled axes. Defaults seed once. Seeking requests pause before a stage; a rejected controlled pause blocks the seek (activate again after accepting pause). A rejected autonomous boundary holds without repeating callbacks. Replay preserves pause. Non-loop playback holds the final frame. Hidden/offscreen pages suspend local time; resume never catches up. Reduced motion disables travel and automatic progression, but manual stage navigation still works. Metrics change at stage boundaries, not as live telemetry.\n\n### Keyboard\nTab and Shift+Tab reach ordinary buttons. Enter/Space activate once. Stage Left/Right (RTL-aware), Home/End move focus without selecting; selection uses aria-current=step, not tabs. Transport controls never move focus on autoplay.\n\n### Copy\nSupply names, statuses, captions and metric/control labels in your language. Intl formats numbers, percentages and latency units. The scene is hidden from assistive technology; the ordered narrative is the accessible equivalent.`,
    },
  },
} satisfies Meta<typeof MultiRegionFailover>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Landscape: Story = { args: { orientation: 'landscape' } };
export const Portrait: Story = {
  args: { orientation: 'portrait' },
  decorators: [
    (Story) => (
      <Narrow>
        <Story />
      </Narrow>
    ),
  ],
};
export const Balanced: Story = { args: { defaultValue: 'balanced' } };
export const Degraded: Story = { args: { defaultValue: 'degraded' } };
export const Failover: Story = { args: { defaultValue: 'failover' } };
export const Evacuated: Story = { args: { defaultValue: 'rerouted' } };
export const Recovery: Story = { args: { defaultValue: 'recovery' } };
export const Rebalanced: Story = { args: { defaultValue: 'rebalanced' } };
export const Loop: Story = { args: { loop: true, defaultPaused: false } };
export const ZeroTraffic: Story = {
  args: {
    stages: stages.map((stage) => ({
      ...stage,
      primary: { ...stage.primary, requestsPerSecond: 0 },
      secondary: { ...stage.secondary, requestsPerSecond: 0 },
    })),
  },
};
export const ExplicitChecks: Story = {
  args: {
    defaultValue: 'degraded',
    stages: stages.map((stage) => ({
      ...stage,
      primary: { ...stage.primary, passedChecks: 12, failedChecks: 2 },
    })),
  },
};
export const LongHostname: Story = {
  args: {
    hostname:
      'very-long-application-hostname.in-a-regional-service.internal.example.test',
  },
};
export const InvalidWeights: Story = {
  args: {
    stages: stages.map((stage) => ({
      ...stage,
      primary: { ...stage.primary, weight: Number.NaN },
    })),
  },
  play: async ({ canvas }) => {
    await expect(
      canvas.getByText('Cannot display these stage snapshots.'),
    ).toBeVisible();
    await expect(canvas.queryByRole('button')).not.toBeInTheDocument();
  },
};
export const MissingStage: Story = { args: { stages: stages.slice(0, 5) } };
export const FractionalInstances: Story = {
  args: {
    stages: stages.map((stage) => ({
      ...stage,
      primary: { ...stage.primary, healthyInstances: 2.5 },
    })),
  },
};
export const CaptionZero: Story = {
  args: { caption: 0, showStageCaption: false },
  play: async ({ canvasElement }) => {
    const caption = canvasElement.querySelector('figcaption')!;
    await expect(caption).toHaveTextContent('0');
    await expect(canvasElement.querySelector('figure')).toHaveAttribute(
      'aria-describedby',
      expect.stringContaining(caption.id),
    );
  },
};
export const ExternalAria: Story = {
  render: (args) => (
    <Frame>
      <span id="incident-note">Illustrative snapshots, not live metrics.</span>
      <MultiRegionFailover
        {...args}
        aria-describedby="incident-note"
        caption={0}
      />
    </Frame>
  ),
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('figure')!;
    const ids = root.getAttribute('aria-describedby')!.split(' ');
    await expect(ids).toContain('incident-note');
    await expect(ids).toHaveLength(3);
    for (const id of ids)
      await expect(root.ownerDocument.getElementById(id)).not.toBeNull();
    await expect(root.querySelectorAll('ol > li')).toHaveLength(6);
    await expect(root.querySelectorAll('[aria-current="step"]')).toHaveLength(
      1,
    );
    await expect(root.querySelector('ol')).toHaveTextContent(
      'Primary: Healthy',
    );
  },
};
export const LightTheme: Story = {
  args: Failover.args,
  globals: { theme: 'light' },
};
export const RTL: Story = {
  args: { dir: 'rtl' },
  play: async ({ canvas, userEvent }) => {
    const balanced = canvas.getByRole('button', { name: 'Balanced' });
    await userEvent.click(balanced);
    await userEvent.keyboard('{ArrowLeft}');
    await expect(balanced.ownerDocument.activeElement).toBe(
      canvas.getByRole('button', { name: 'Degraded' }),
    );
    await expect(balanced).toHaveAttribute('aria-current', 'step');
  },
};
export const ReducedMotion: Story = {
  args: { defaultValue: 'failover' },
  parameters: {
    docs: {
      description: {
        story:
          'Enable reduced motion in your browser to inspect a static failover snapshot.',
      },
    },
  },
};
export const ControlledStageRejects: Story = {
  args: { value: 'balanced' },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Degraded' }));
    await expect(args.onValueChange).toHaveBeenCalledWith('degraded');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(
      canvas.getByRole('button', { name: 'Balanced' }),
    ).toHaveAttribute('aria-current', 'step');
  },
};
export const ControlledPauseRejects: Story = {
  args: { paused: false },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Degraded' }));
    await expect(args.onPausedChange).toHaveBeenCalledWith(true);
    await expect(args.onPausedChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};
export const AcceptedSeek: Story = {
  args: { defaultPaused: false },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Degraded' }));
    await expect(args.onPausedChange).toHaveBeenCalledWith(true);
    await expect(args.onPausedChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith('degraded');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(canvas.getByRole('button', { name: 'Resume' })).toBeVisible();
  },
};
export const SameStageReplay: Story = {
  play: async ({ canvas, userEvent, args }) => {
    const replay = canvas.getByRole('button', { name: 'Replay story' });
    await userEvent.click(replay);
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(replay.ownerDocument.activeElement).toBe(replay);
  },
};
export const ControlledBoundaryRejects: Story = {
  tags: ['!autodocs'],
  args: {
    value: 'balanced',
    defaultPaused: false,
    stages: stages.map((stage) => ({ ...stage, durationMs: 80 })),
  },
  play: async ({ canvasElement, args }) => {
    if (
      canvasElement.ownerDocument.defaultView!.matchMedia(
        '(prefers-reduced-motion: reduce)',
      ).matches
    )
      return;
    await waitFor(() =>
      expect(args.onValueChange).toHaveBeenCalledWith('degraded'),
    );
    await new Promise((resolve) => setTimeout(resolve, 200));
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
  },
};
export const ExternalUpdate: Story = {
  render: (args) => {
    const [selected, setSelected] = useState<'balanced' | 'failover'>(
      'balanced',
    );
    return (
      <Frame>
        <MultiRegionFailover {...args} value={selected} />
        <Button onClick={() => setSelected('failover')}>Show failover</Button>
      </Frame>
    );
  },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(
      canvas.getByRole('button', { name: 'Show failover' }),
    );
    await expect(
      canvas.getByRole('button', { name: 'Failover' }),
    ).toHaveAttribute('aria-current', 'step');
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};
export const Keyboard: Story = {
  play: async ({ canvas, userEvent, args }) => {
    const resume = canvas.getByRole('button', { name: 'Resume' });
    await userEvent.tab();
    await expect(resume.ownerDocument.activeElement).toBe(resume);
    await expect(getComputedStyle(resume).outlineStyle).not.toBe('none');
    await userEvent.tab();
    await expect(resume.ownerDocument.activeElement).toBe(
      canvas.getByRole('button', { name: 'Next stage' }),
    );
    await userEvent.tab();
    await userEvent.tab();
    const balanced = canvas.getByRole('button', { name: 'Balanced' });
    await expect(resume.ownerDocument.activeElement).toBe(balanced);
    await userEvent.keyboard('{ArrowRight}{End}');
    const final = canvas.getByRole('button', { name: 'Rebalanced' });
    await expect(final.ownerDocument.activeElement).toBe(final);
    await expect(balanced).toHaveAttribute('aria-current', 'step');
    await userEvent.keyboard('{Enter}');
    await expect(args.onValueChange).toHaveBeenCalledWith('rebalanced');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(final).toHaveAttribute('aria-current', 'step');
    await expect(
      canvas.getByRole('button', { name: 'Next stage' }),
    ).toBeDisabled();
    await userEvent.keyboard('{Home}');
    await expect(final.ownerDocument.activeElement).toBe(balanced);
    await userEvent.tab({ shift: true });
    await expect(final.ownerDocument.activeElement).toBe(
      canvas.getByRole('button', { name: 'Replay story' }),
    );
  },
};
