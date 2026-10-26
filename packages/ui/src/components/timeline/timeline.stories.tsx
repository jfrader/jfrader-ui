import { useState, type ComponentPropsWithRef } from 'react';
import { renderToString } from 'react-dom/server';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fireEvent, fn, spyOn, waitFor, within, type Mock } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { withLightTheme } from '../../testing/story-decorators';
import { expectAligned, expectInside, expectNoOverlap } from '../../testing/geometry-assertions';
import { settleMotion } from '../../testing/motion-assertions';
import { dateTimeFormatter, numberFormatter, relativeTime, relativeTimeFormatter, resolveTimeOptions, toEpoch, validEpoch } from '../../utils/intl';
import { Timeline, type TimelineEvent, type TimelineProps } from './index';
// `styled` is the app-facing styling API; consumers import it from `@jfrader/ui`.
import { Button, styled, TextField } from '../../index';

const MINUTE = 60_000;
function ReplacementRoot(props: ComponentPropsWithRef<'div'>) {
  return <div {...props} data-testid="replacement-root" />;
}

function SugarRoot(props: ComponentPropsWithRef<'div'>) {
  return <div {...props} data-testid="sugar-root" />;
}

/** Replace the outer container while retaining the event disclosures. */
export const RootReplacement: Story = {
  tags: ['!autodocs'],
  args: {
    component: SugarRoot,
    slots: { root: ReplacementRoot },
    ref: fn(),
    className: 'consumer-root',
    title: 'consumer title',
    slotProps: { root: { ref: fn(), className: 'slot-root', title: 'slot title', 'data-ui': 'custom consumer' } },
  },
  render: (args) => <Timeline {...args} data-ui="consumer" />,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const root = canvas.getByTestId('replacement-root');
    await expect(canvas.queryByTestId('sugar-root')).toBeNull();
    await expect(root.tagName).toBe('DIV');
    await expect(root).toHaveClass('consumer-root', 'slot-root');
    await expect(root).toHaveAttribute('title', 'slot title');
    await expect(root).toHaveAttribute('data-ui', 'timeline consumer custom');
    await expect(args.ref).toHaveBeenCalledWith(root);
    await expect(args.slotProps?.root?.ref).toHaveBeenCalledWith(root);
    await expect(root).toHaveAttribute('role', 'region');
    const triggers = canvas.getAllByRole('button', { expanded: false });
    triggers[0]!.focus();
    await fireEvent.keyDown(triggers[0]!, { key: 'ArrowDown' });
    await expect(triggers[1]).toHaveFocus();
    await fireEvent.click(triggers[0]!);
    await expect(triggers[0]).toHaveAttribute('aria-expanded', 'true');
  },
};

/** Use component as shorthand for the root slot. */
export const RootComponent: Story = {
  tags: ['!autodocs'],
  args: { component: SugarRoot },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByTestId('sugar-root')).toHaveAttribute('data-ui', 'timeline');
  },
};
const HOUR = 60 * MINUTE;
const NOW = Date.parse('2026-10-11T12:00:00Z');
const LOCALE = 'en-US';
/** Outline is authored as 2px; fractional device pixel ratios compute it slightly thinner. */
const RING_TOLERANCE = 1.1;
const GEOMETRY_TOLERANCE = 1.5;
const MIN_TRIGGER = 44;
const relative = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' });
const fullDay = (at: number | string, timeZone = 'UTC', locale = LOCALE) =>
  new Intl.DateTimeFormat(locale, { timeZone, dateStyle: 'full' }).format(new Date(at));
/** A day heading starts with a capital in the formatting locale. */
const headingCase = (day: string, locale = LOCALE) => day.charAt(0).toLocaleUpperCase(locale) + day.slice(1);

const Frame = styled.div({ inlineSize: '34rem', maxInlineSize: '100%', marginInline: 'auto' });
const Narrow = styled.div({ inlineSize: '16rem', maxInlineSize: '100%' });
// One bounded track: an `auto` track would grow to a child's intrinsic width and overflow the page.
const StackFrame = styled.div({ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: vars.space[6] });
const Toolbar = styled.div({ display: 'flex', flexWrap: 'wrap', gap: vars.space[2], marginBlockEnd: vars.space[4] });

const checkIcon = (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M3 8.5l3 3 7-7" />
  </svg>
);
const crossIcon = (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M4 4l8 8M12 4l-8 8" />
  </svg>
);
// Procedural portrait: the image draws its own pixels, so the fixture needs no color literals.
const PORTRAIT_SRC = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><filter id="n"><feTurbulence baseFrequency="0.08" seed="7"/></filter><rect width="48" height="48" filter="url(#n)"/></svg>',
)}`;

const reasonField = <TextField label="Rotation reason" defaultValue="Quarterly" size="sm" />;

/** Deliberately unsorted; `keys` and `review` share an instant to pin tie order. */
const EVENTS: readonly TimelineEvent[] = Object.freeze([
  {
    id: 'keys',
    at: '2026-10-10T08:00:00Z',
    actor: 'Grace Hopper',
    title: 'Rotated API keys',
    meta: '2 keys revoked',
    detail: reasonField,
  },
  {
    id: 'deploy',
    at: NOW - 5 * MINUTE,
    actor: 'Ada Lovelace',
    title: 'Deployed web 4.2 to production',
    meta: 'main · 9f2c1ab',
    tone: 'success',
    icon: checkIcon,
    detail: <p>Three services updated with no errors.</p>,
  },
  { id: 'project', at: new Date('2026-10-08T09:00:00Z'), actor: 'Ada Lovelace', title: 'Created project' },
  {
    id: 'build',
    at: '2026-10-11T10:00:00Z',
    title: 'Build failed on staging',
    tone: 'danger',
    icon: crossIcon,
    detail: <p>The test step exited with code 1.</p>,
  },
  { id: 'review', at: '2026-10-10T10:00:00+02:00', actor: 'Grace Hopper', title: 'Opened pull request 118' },
] satisfies TimelineEvent[]);
const SORTED_IDS = ['deploy', 'build', 'keys', 'review', 'project'];

const usage = (props = '') => `import { TextField, Timeline, type TimelineEvent } from '@jfrader/ui';

const now = Date.parse('2026-10-11T12:00:00Z');
const events: TimelineEvent[] = [
  { id: 'keys', at: '2026-10-10T08:00:00Z', actor: 'Grace Hopper',
    title: 'Rotated API keys', meta: '2 keys revoked',
    detail: <TextField label="Rotation reason" defaultValue="Quarterly" size="sm" /> },
  { id: 'deploy', at: '2026-10-11T11:55:00Z', actor: 'Ada Lovelace',
    title: 'Deployed web 4.2 to production', meta: 'main · 9f2c1ab', tone: 'success',
    icon: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M3 8.5l3 3 7-7" /></svg>,
    detail: <p>Three services updated with no errors.</p> },
  { id: 'project', at: '2026-10-08T09:00:00Z', actor: 'Ada Lovelace', title: 'Created project' },
  { id: 'build', at: '2026-10-11T10:00:00Z', title: 'Build failed on staging', tone: 'danger',
    icon: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" /></svg>,
    detail: <p>The test step exited with code 1.</p> },
  { id: 'review', at: '2026-10-10T10:00:00+02:00', actor: 'Grace Hopper', title: 'Opened pull request 118' },
];

<Timeline ${props}events={events} now={now} locale="en-US" timeZone="UTC" aria-label="Deploy history" />`;

const part = (root: Element, name: string) => root.querySelector<HTMLElement>(`[data-ui="timeline-${name}"]`)!;
const parts = (root: Element, name: string) =>
  Array.from(root.querySelectorAll<HTMLElement>(`[data-ui="timeline-${name}"]`));
const item = (root: Element, id: string) => root.querySelector<HTMLElement>(`[data-event-id="${id}"]`)!;
const itemIds = (root: Element) => parts(root, 'item').map((li) => li.dataset.eventId);
const triggerOf = (root: Element, id: string) => part(item(root, id), 'trigger');
const dayLabels = (root: Element) => parts(root, 'heading').map((heading) => heading.firstElementChild!.textContent);
const controlled = (trigger: HTMLElement) =>
  trigger.ownerDocument.getElementById(trigger.getAttribute('aria-controls')!)!;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function expectFocusRing(element: HTMLElement) {
  await expect(element.ownerDocument.activeElement).toBe(element);
  const style = getComputedStyle(element);
  await expect(style.outlineStyle).not.toBe('none');
  await expect(Math.abs(Number.parseFloat(style.outlineWidth) - 2)).toBeLessThan(RING_TOLERANCE);
}

/** Declarations authored for `element` inside `@media` rules whose condition includes `feature`. */
function mediaDeclarations(element: Element, feature: string, pseudo = '') {
  return Array.from(element.ownerDocument.styleSheets)
    .flatMap((sheet) => {
      try {
        return Array.from(sheet.cssRules);
      } catch {
        return [];
      }
    })
    .filter((rule): rule is CSSMediaRule => rule instanceof CSSMediaRule && rule.conditionText.includes(feature))
    .flatMap((rule) => Array.from(rule.cssRules))
    .filter(
      (rule): rule is CSSStyleRule =>
        rule instanceof CSSStyleRule &&
        rule.selectorText.endsWith(pseudo) &&
        element.matches(pseudo ? rule.selectorText.slice(0, -pseudo.length) : rule.selectorText),
    )
    .map((rule) => rule.style);
}

let liveCounter = 0;

/** Story-only feed: adds newer events, ticks the clock and removes the build event. */
function LiveFeed(args: TimelineProps) {
  const [events, setEvents] = useState(args.events);
  const [now, setNow] = useState(args.now);
  const add = () => {
    liveCounter += 1;
    const at = now + MINUTE;
    setNow(at);
    setEvents((current) => [{ id: `live-${liveCounter}`, at, title: `Preview ${liveCounter} deployed` }, ...current]);
  };
  return (
    <>
      <Toolbar>
        <Button type="button" onClick={add}>
          Add event
        </Button>
        <Button type="button" onClick={() => setNow((current) => current + MINUTE)}>
          Tick clock
        </Button>
        <Button
          type="button"

          onClick={() => setEvents((current) => current.filter((event) => event.id !== 'build'))}
        >
          Remove build
        </Button>
        <Button
          type="button"

          onClick={() => setEvents((current) => current.filter((event) => event.id !== 'deploy'))}
        >
          Remove deploy
        </Button>
      </Toolbar>
      <Timeline {...args} events={events} now={now} />
    </>
  );
}

const meta = {
  argTypes: { events: { control: false } },
  title: 'Data display/Timeline',
  component: Timeline,
  tags: ['autodocs'],
  args: {
    events: EVENTS,
    now: NOW,
    locale: LOCALE,
    timeZone: 'UTC',
    'aria-label': 'Deploy history',
    onValueChange: fn(),
  },
  decorators: [
    (Story) => (
      <Frame>
        <Story />
      </Frame>
    ),
  ],
  parameters: {
    layout: 'padded',
    docs: {
      sections: [
        { title: 'Activity and details', stories: ['ActivityFeed', 'ExpandedDetails'] },
        { title: 'Long histories', stories: ['Scrolling'] },
        { title: 'Localization', stories: ['Localized'] },
      ],
      source: { language: 'tsx', code: usage() },
      description: {
        component: 'Read activity by day, newest first, and expand events to see details.',
      },
      usage: `### Reading activity
- Days are headings with ordered lists, grouped in the chosen time zone. This is not an ARIA feed or accordion.
- Expand an event to read its details. Collapsed panels stay mounted.
- All events render; there is no virtualization or pagination.

### Dates and updates

- Pass \`now\` in epoch milliseconds and update it about once a minute. Timeline runs no timer.
- Use the same \`now\`, \`locale\` and \`timeZone\` on server and client so hydration text matches.
- Rows show signed relative times and include the full date as hidden text. Events with unreadable dates stay in a trailing group.
- New rows do not take focus. With \`maxHeight\`, the row being read keeps its position as newer events arrive. Use \`scrollToNew\` to scroll to them instead.
- A status region announces new ids.

### Keyboard and accessibility

- Tab and Shift+Tab follow DOM order through disclosures and open details. Enter or Space toggles a disclosure.
- Up and Down move between disclosures across days and stop at the ends. Home and End jump to the first and last.
- Keys inside detail content keep their behavior.`,
    },
  },
} satisfies Meta<typeof Timeline>;
export default meta;
type Story = StoryObj<typeof meta>;

export const ActivityFeed: Story = {
  name: 'Activity feed',
  args: { defaultValue: ['deploy'] },
  parameters: {
    docs: {
      description: { story: 'Read deployment activity, inspect the open deployment, or expand another event.' },
      source: { language: 'tsx', code: usage('defaultValue={["deploy"]} ') },
    },
  },
};

export const Default: Story = {
  name: 'Deploy history',
  parameters: { docs: { description: { story: 'Read activity grouped by day and expand a deployment for more detail.' } } },
  play: async ({ canvas, canvasElement }) => {
    const region = canvas.getByRole('region', { name: 'Deploy history' });
    await expect(Timeline.displayName).toBe('Timeline');
    await expect(itemIds(canvasElement)).toEqual(SORTED_IDS);
    await expect(EVENTS.map((event) => event.id)).toEqual(['keys', 'deploy', 'project', 'build', 'review']);
    await expect(canvas.getAllByRole('heading', { level: 3 })).toHaveLength(3);
    await expect(dayLabels(canvasElement)).toEqual([
      headingCase(relative.format(0, 'day')),
      headingCase(relative.format(-1, 'day')),
      fullDay('2026-10-08T09:00:00Z'),
    ]);
    const lists = canvas.getAllByRole('list');
    await expect(lists.map((list) => within(list).getAllByRole('listitem').length)).toEqual([2, 2, 1]);
    await expect(lists[0]!.tagName).toBe('OL');
    // Each day group is named by its heading; days are groups, not extra landmarks.
    const days = canvas.getAllByRole('group');
    await expect(days).toEqual(parts(canvasElement, 'group'));
    await expect(days[1]).toHaveAccessibleName(`${headingCase(relative.format(-1, 'day'))} 2 events`);
    await expect(days[1]!.getAttribute('aria-labelledby')).toBe(parts(canvasElement, 'heading')[1]!.id);
    await expect(canvas.getAllByRole('region')).toEqual([region]);
    const time = part(item(canvasElement, 'deploy'), 'time');
    await expect(time).toHaveAttribute('datetime', '2026-10-11T11:55:00.000Z');
    await expect(time.firstChild!.textContent).toBe(relative.format(-5, 'minute'));
    await expect(time.firstChild!.textContent).toBe('5 minutes ago');
    await expect(dayLabels(canvasElement)).toEqual(['Today', 'Yesterday', 'Thursday, October 8, 2026']);
    const deploy = triggerOf(canvasElement, 'deploy');
    await expect(deploy).toHaveAccessibleName('Deployed web 4.2 to production');
    await expect(deploy).toHaveAttribute('aria-expanded', 'false');
    await expect(controlled(deploy)).not.toBeVisible();
    await expect(part(item(canvasElement, 'project'), 'trigger')).toBeNull();
    await expect(part(region, 'status')).toHaveTextContent('');
  },
};

export const Sizes: Story = {
  render: (args) => (
    <StackFrame>
      <Timeline {...args} size="sm" aria-label="Compact history" headingLevel={4} />
      <Timeline {...args} size="md" aria-label="Regular history" headingLevel={4} />
    </StackFrame>
  ),
  play: async ({ canvas }) => {
    const [compact, regular] = [
      canvas.getByRole('region', { name: 'Compact history' }),
      canvas.getByRole('region', { name: 'Regular history' }),
    ] as const;
    await expect(within(compact).getAllByRole('heading', { level: 4 })).toHaveLength(3);
    for (const root of [compact, regular]) {
      for (const trigger of parts(root, 'trigger'))
        await expect(trigger.getBoundingClientRect().height).toBeGreaterThanOrEqual(MIN_TRIGGER - 0.5);
    }
    const gap = (root: HTMLElement) => Number.parseFloat(getComputedStyle(part(root, 'item')).paddingBlockEnd);
    await expect(gap(compact)).toBeLessThan(gap(regular));
  },
};

export const ActorAvatars: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { Timeline, type TimelineEvent } from '@jfrader/ui';

const MINUTE = 60_000;
const NOW = Date.parse('2026-10-11T12:00:00Z');

const PORTRAIT_SRC = \`data:image/svg+xml,\${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><filter id="n"><feTurbulence baseFrequency="0.08" seed="7"/></filter><rect width="48" height="48" filter="url(#n)"/></svg>',
)}\`;

const checkIcon = (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M3 8.5l3 3 7-7" />
  </svg>
);

const events: TimelineEvent[] = [
  {
    id: 'photo',
    at: NOW - 3 * MINUTE,
    actor: 'Ada Lovelace',
    avatar: PORTRAIT_SRC,
    icon: checkIcon,
    title: 'Approved release',
  },
  {
    id: 'initials',
    at: NOW - 9 * MINUTE,
    actor: 'Grace Hopper',
    title: 'Requested changes',
  },
  {
    id: 'system',
    at: NOW - 20 * MINUTE,
    title: 'Nightly backup finished',
  },
];

<Timeline
  events={events}
  now={NOW}
  timeZone="UTC"
  locale="en-US"
  aria-label="Deploy history"
/>`,
      },
    },
  },
  args: {
    events: [
      { id: 'photo', at: NOW - 3 * MINUTE, actor: 'Ada Lovelace', avatar: PORTRAIT_SRC, icon: checkIcon, title: 'Approved release' },
      { id: 'initials', at: NOW - 9 * MINUTE, actor: 'Grace Hopper', title: 'Requested changes' },
      { id: 'system', at: NOW - 20 * MINUTE, title: 'Nightly backup finished' },
    ],
  },
  play: async ({ canvasElement }) => {
    const markers = parts(canvasElement, 'marker');
    await expect(markers.map((marker) => marker.dataset.kind)).toEqual(['avatar', 'avatar', 'dot']);
    for (const marker of markers) await expect(marker).toHaveAttribute('aria-hidden', 'true');
    await expect(markers[0]!.querySelector('img')).toHaveAttribute('src', PORTRAIT_SRC);
    await expect(markers[1]).toHaveTextContent('GH');
    await expect(part(item(canvasElement, 'photo'), 'actor')).toHaveTextContent('Ada Lovelace');
    await expect(part(item(canvasElement, 'system'), 'actor')).toBeNull();
  },
};

export const SystemTones: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { Timeline, type TimelineEvent } from '@jfrader/ui';

const MINUTE = 60_000;
const NOW = Date.parse('2026-10-11T12:00:00Z');

const checkIcon = (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M3 8.5l3 3 7-7" />
  </svg>
);

const crossIcon = (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M4 4l8 8M12 4l-8 8" />
  </svg>
);

const events: TimelineEvent[] = [
  {
    id: 'ok',
    at: NOW - MINUTE,
    title: 'Health check passed',
    tone: 'success',
    icon: checkIcon,
  },
  {
    id: 'fail',
    at: NOW - 2 * MINUTE,
    title: 'Health check failed',
    tone: 'danger',
    icon: crossIcon,
  },
  {
    id: 'info',
    at: NOW - 3 * MINUTE,
    title: 'Health check scheduled',
  },
];

<Timeline
  events={events}
  now={NOW}
  timeZone="UTC"
  locale="en-US"
  aria-label="Deploy history"
/>`,
      },
    },
  },
  args: {
    events: [
      { id: 'ok', at: NOW - MINUTE, title: 'Health check passed', tone: 'success', icon: checkIcon },
      { id: 'fail', at: NOW - 2 * MINUTE, title: 'Health check failed', tone: 'danger', icon: crossIcon },
      { id: 'info', at: NOW - 3 * MINUTE, title: 'Health check scheduled' },
    ],
  },
  play: async ({ canvasElement }) => {
    const color = (id: string) => getComputedStyle(part(item(canvasElement, id), 'marker')).borderTopColor;
    await expect(new Set([color('ok'), color('fail'), color('info')]).size).toBe(3);
    // The outcome is in the text, not only in the marker color.
    await expect(item(canvasElement, 'fail')).toHaveTextContent('Health check failed');
    await expect(part(item(canvasElement, 'ok'), 'marker').dataset.kind).toBe('icon');
  },
};

export const MixedDetails: Story = {
  args: {
    events: [
      { id: 'zero', at: NOW - 1 * MINUTE, title: 0, meta: 0, detail: 0 },
      { id: 'false', at: NOW - 2 * MINUTE, title: 'False content', meta: false, detail: false, icon: false },
      { id: 'null', at: NOW - 3 * MINUTE, title: 'Null content', meta: null, detail: null, icon: null },
      { id: 'empty', at: NOW - 4 * MINUTE, title: 'Empty content', meta: '', detail: '', icon: '' },
      { id: 'absent', at: NOW - 5 * MINUTE, title: 'Absent content' },
    ],
  },
  play: async ({ canvasElement, userEvent }) => {
    const zero = item(canvasElement, 'zero');
    await expect(triggerOf(canvasElement, 'zero')).toHaveTextContent('0');
    await expect(part(zero, 'meta')).toHaveTextContent('0');
    await userEvent.click(triggerOf(canvasElement, 'zero'));
    await expect(part(zero, 'detail')).toBeVisible();
    await expect(part(zero, 'detail')).toHaveTextContent('0');
    for (const id of ['false', 'null', 'empty', 'absent']) {
      const row = item(canvasElement, id);
      await expect(part(row, 'trigger')).toBeNull();
      await expect(part(row, 'detail')).toBeNull();
      await expect(part(row, 'meta')).toBeNull();
      await expect(part(row, 'marker').dataset.kind).toBe('dot');
      await expect(row.querySelector('[aria-controls]')).toBeNull();
    }
  },
};

export const ExpandedDetails: Story = {
  name: 'Expanded event details',
  parameters: {
    docs: {
      description: { story: 'Read several open details and edit the rotation reason without closing them.' },
      source: {
        language: 'tsx',
        code: `import { TextField, Timeline, type TimelineEvent } from '@jfrader/ui';

const MINUTE = 60_000;
const NOW = Date.parse('2026-10-11T12:00:00Z');

const checkIcon = (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M3 8.5l3 3 7-7" />
  </svg>
);

const crossIcon = (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M4 4l8 8M12 4l-8 8" />
  </svg>
);

const events: TimelineEvent[] = [
  {
    id: 'keys',
    at: '2026-10-10T08:00:00Z',
    actor: 'Grace Hopper',
    title: 'Rotated API keys',
    meta: '2 keys revoked',
    detail: <TextField label="Rotation reason" defaultValue="Quarterly" size="sm" />,
  },
  {
    id: 'deploy',
    at: NOW - 5 * MINUTE,
    actor: 'Ada Lovelace',
    title: 'Deployed web 4.2 to production',
    meta: 'main · 9f2c1ab',
    tone: 'success',
    icon: checkIcon,
    detail: <p>Three services updated with no errors.</p>,
  },
  {
    id: 'project',
    at: new Date('2026-10-08T09:00:00Z'),
    actor: 'Ada Lovelace',
    title: 'Created project',
  },
  {
    id: 'build',
    at: '2026-10-11T10:00:00Z',
    title: 'Build failed on staging',
    tone: 'danger',
    icon: crossIcon,
    detail: <p>The test step exited with code 1.</p>,
  },
  {
    id: 'review',
    at: '2026-10-10T10:00:00+02:00',
    actor: 'Grace Hopper',
    title: 'Opened pull request 118',
  },
];

<Timeline
  events={events}
  defaultValue={['deploy', 'build', 'keys']}
  now={NOW}
  timeZone="UTC"
  locale="en-US"
  aria-label="Deploy history"
/>`,
      },
    },
  },
  args: { defaultValue: ['deploy', 'build', 'keys'] },
  play: async ({ canvasElement, args }) => {
    for (const id of ['deploy', 'build', 'keys']) {
      const trigger = triggerOf(canvasElement, id);
      await expect(trigger).toHaveAttribute('aria-expanded', 'true');
      await expect(controlled(trigger)).toBeVisible();
      await expect(item(canvasElement, id)).toHaveAttribute('data-state', 'open');
      // Initially open details are already there; only a reader's toggle unfolds.
      await expect(controlled(trigger)).not.toHaveAttribute('data-enter');
    }
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};

export const DetailUnfold: Story = {
  tags: ['!autodocs'],
  args: { defaultValue: ['deploy'] },
  play: async ({ canvasElement, userEvent }) => {
    const deployDetail = controlled(triggerOf(canvasElement, 'deploy'));
    const build = triggerOf(canvasElement, 'build');
    const detail = controlled(build);
    await userEvent.click(build);
    await expect(detail).toBeVisible();
    await expect(detail).toHaveAttribute('data-enter');
    await expect(deployDetail).not.toHaveAttribute('data-enter');
    await expect(getComputedStyle(detail).animationName).not.toBe('none');
    // The unfold clips paint only: the panel's box is final from the first frame and nothing stays clipped.
    const opened = detail.getBoundingClientRect();
    await settleMotion(detail);
    await expectNear(detail.getBoundingClientRect().top, opened.top, 'unfold keeps the detail box');
    await expectNear(detail.getBoundingClientRect().height, opened.height, 'unfold keeps the detail height');
    await expect(getComputedStyle(detail).clipPath).toBe('none');
    // Closing is immediate, and reopening unfolds again.
    await userEvent.click(build);
    await expect(detail).not.toBeVisible();
    await expect(detail).not.toHaveAttribute('data-enter');
    await userEvent.click(build);
    await expect(detail).toHaveAttribute('data-enter');
  },
};

export const KeyboardNavigation: Story = {
  play: async ({ canvasElement, userEvent, args }) => {
    const [deploy, build, keys] = ['deploy', 'build', 'keys'].map((id) => triggerOf(canvasElement, id)) as [
      HTMLElement,
      HTMLElement,
      HTMLElement,
    ];
    await userEvent.tab();
    await expectFocusRing(deploy);
    // Collapsed detail content is hidden, so Tab goes straight to the next disclosure.
    await userEvent.tab();
    await expect(deploy.ownerDocument.activeElement).toBe(build);
    await userEvent.keyboard('{ArrowDown}');
    await expectFocusRing(keys);
    await userEvent.keyboard('{ArrowDown}');
    await expect(keys.ownerDocument.activeElement).toBe(keys);
    await userEvent.keyboard('{ArrowUp}');
    await expect(keys.ownerDocument.activeElement).toBe(build);
    await userEvent.keyboard('{Home}');
    await expect(keys.ownerDocument.activeElement).toBe(deploy);
    await userEvent.keyboard('{ArrowUp}');
    await expect(keys.ownerDocument.activeElement).toBe(deploy);
    await userEvent.keyboard('{End}');
    await expect(keys.ownerDocument.activeElement).toBe(keys);

    await userEvent.keyboard('{Enter}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith(['keys']);
    await expect(keys).toHaveAttribute('aria-expanded', 'true');
    await userEvent.tab();
    const input = within(controlled(keys)).getByRole('textbox');
    await expect(keys.ownerDocument.activeElement).toBe(input);
    await userEvent.keyboard('{End}{ArrowUp}{ArrowDown}{Home}!');
    await expect(keys.ownerDocument.activeElement).toBe(input);
    await expect(input).toHaveValue('!Quarterly');
    await userEvent.tab({ shift: true });
    await expect(keys.ownerDocument.activeElement).toBe(keys);
    await userEvent.keyboard(' ');
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await expect(args.onValueChange).toHaveBeenLastCalledWith([]);
    await expect(controlled(keys)).not.toBeVisible();
  },
};

function ControlledExample(args: TimelineProps) {
  const [open, setOpen] = useState<readonly string[]>(['deploy']);
  return (
    <>
      <Toolbar>
        <Button type="button" onClick={() => setOpen([])}>
          Collapse all
        </Button>
      </Toolbar>
      <Timeline
        {...args}
        value={open}
        onValueChange={(ids) => {
          args.onValueChange?.(ids);
          setOpen(ids);
        }}
      />
    </>
  );
}

export const Controlled: Story = {
  args: { headingLevel: 2 },
  render: (args) => <ControlledExample {...args} />,
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    await expect(canvas.getAllByRole('heading', { level: 2 })).toHaveLength(3);
    const deploy = triggerOf(canvasElement, 'deploy');
    await expect(deploy).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(canvas.getByRole('button', { name: 'Collapse all' }));
    await expect(deploy).toHaveAttribute('aria-expanded', 'false');
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await userEvent.click(triggerOf(canvasElement, 'build'));
    await userEvent.click(deploy);
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await expect(args.onValueChange).toHaveBeenNthCalledWith(1, ['build']);
    await expect(args.onValueChange).toHaveBeenNthCalledWith(2, ['build', 'deploy']);
    await expect(deploy).toHaveAttribute('aria-expanded', 'true');
  },
};

export const RejectedControlled: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { TextField, Timeline, type TimelineEvent } from '@jfrader/ui';

const MINUTE = 60_000;
const NOW = Date.parse('2026-10-11T12:00:00Z');

const checkIcon = (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M3 8.5l3 3 7-7" />
  </svg>
);

const crossIcon = (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M4 4l8 8M12 4l-8 8" />
  </svg>
);

const events: TimelineEvent[] = [
  {
    id: 'keys',
    at: '2026-10-10T08:00:00Z',
    actor: 'Grace Hopper',
    title: 'Rotated API keys',
    meta: '2 keys revoked',
    detail: <TextField label="Rotation reason" defaultValue="Quarterly" size="sm" />,
  },
  {
    id: 'deploy',
    at: NOW - 5 * MINUTE,
    actor: 'Ada Lovelace',
    title: 'Deployed web 4.2 to production',
    meta: 'main · 9f2c1ab',
    tone: 'success',
    icon: checkIcon,
    detail: <p>Three services updated with no errors.</p>,
  },
  {
    id: 'project',
    at: new Date('2026-10-08T09:00:00Z'),
    actor: 'Ada Lovelace',
    title: 'Created project',
  },
  {
    id: 'build',
    at: '2026-10-11T10:00:00Z',
    title: 'Build failed on staging',
    tone: 'danger',
    icon: crossIcon,
    detail: <p>The test step exited with code 1.</p>,
  },
  {
    id: 'review',
    at: '2026-10-10T10:00:00+02:00',
    actor: 'Grace Hopper',
    title: 'Opened pull request 118',
  },
];

<Timeline
  events={events}
  value={[]}
  onValueChange={() => {}}
  now={NOW}
  timeZone="UTC"
  locale="en-US"
  aria-label="Deploy history"
/>`,
      },
    },
  },
  args: { value: [] },
  play: async ({ canvasElement, userEvent, args }) => {
    const deploy = triggerOf(canvasElement, 'deploy');
    await userEvent.click(deploy);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith(['deploy']);
    await expect(deploy).toHaveAttribute('aria-expanded', 'false');
    await expect(controlled(deploy)).not.toBeVisible();
    await expect(controlled(deploy)).not.toHaveAttribute('data-enter');
    await expect(deploy.ownerDocument.activeElement).toBe(deploy);
    // The same id set again is not a new request.
    await userEvent.keyboard('{Enter}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(deploy).toHaveAttribute('aria-expanded', 'false');
    await expect(deploy.ownerDocument.activeElement).toBe(deploy);
    const build = triggerOf(canvasElement, 'build');
    await userEvent.click(build);
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await expect(args.onValueChange).toHaveBeenLastCalledWith(['build']);
    await expect(build).toHaveAttribute('aria-expanded', 'false');
    await expect(controlled(build)).not.toBeVisible();
  },
};

/** Story-only control that activates one disclosure twice before React re-renders. */
function DoubleActivation(args: TimelineProps) {
  return (
    <>
      <Toolbar>
        <Button
          type="button"

          onClick={(event) => {
            const timeline = event.currentTarget.parentElement!.nextElementSibling!;
            const deploy = triggerOf(timeline, 'deploy');
            deploy.click();
            deploy.click();
          }}
        >
          Open deploy twice
        </Button>
      </Toolbar>
      <Timeline {...args} />
    </>
  );
}

export const RepeatedRequest: Story = {
  render: (args) => <DoubleActivation {...args} />,
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    // Both activations request the same id set from the same open state: one notification, one commit.
    await userEvent.click(canvas.getByRole('button', { name: 'Open deploy twice' }));
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith(['deploy']);
    const deploy = triggerOf(canvasElement, 'deploy');
    await expect(deploy).toHaveAttribute('aria-expanded', 'true');
    // Once committed, the opposite request is new again.
    await userEvent.click(deploy);
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await expect(args.onValueChange).toHaveBeenLastCalledWith([]);
    await expect(deploy).toHaveAttribute('aria-expanded', 'false');
  },
};

export const Empty: Story = {
  args: { events: [], 'aria-describedby': 'history-hint' },
  render: (args) => (
    <>
      <p id="history-hint">Deploys from the last 30 days</p>
      <Timeline {...args} />
    </>
  ),
  play: async ({ canvas, canvasElement }) => {
    const region = canvas.getByRole('region', { name: 'Deploy history' });
    await expect(region).toHaveAccessibleDescription('Deploys from the last 30 days No activity yet');
    await expect(region.getAttribute('aria-describedby')!.split(' ')[0]).toBe('history-hint');
    await expect(canvas.queryAllByRole('list')).toHaveLength(0);
    await expect(parts(canvasElement, 'trigger')).toHaveLength(0);
  },
};

export const AriaMerge: Story = {
  args: { 'aria-label': undefined, 'aria-labelledby': 'history-heading', 'aria-describedby': 'history-hint' },
  render: (args) => (
    <StackFrame>
      <h2 id="history-heading">Recent changes</h2>
      <p id="history-hint">Times are UTC</p>
      <Timeline {...args} maxHeight="10rem" />
      <Timeline {...args} maxHeight="10rem" aria-label="Fallback history" aria-labelledby="missing-reference" />
    </StackFrame>
  ),
  play: async ({ canvasElement, userEvent }) => {
    const [labelled, fallback] = Array.from(canvasElement.querySelectorAll<HTMLElement>('[data-ui="timeline"]')) as [
      HTMLElement,
      HTMLElement,
    ];
    await expect(labelled).toHaveAttribute('aria-labelledby', 'history-heading');
    await expect(labelled).not.toHaveAttribute('aria-label');
    await expect(labelled).toHaveAccessibleName('Recent changes');
    await expect(labelled).toHaveAttribute('aria-describedby', 'history-hint');
    await expect(fallback).toHaveAttribute('aria-labelledby', 'missing-reference');
    await expect(fallback).toHaveAttribute('aria-label', 'Fallback history');
    await expect(fallback).toHaveAccessibleName('Fallback history');
    // The focusable scroller carries the same external name relationships.
    await expect(part(labelled, 'scroller')).toHaveAttribute('aria-labelledby', 'history-heading');
    await expect(part(labelled, 'scroller')).not.toHaveAttribute('aria-label');
    await expect(part(labelled, 'scroller')).toHaveAccessibleName('Recent changes');
    await expect(part(fallback, 'scroller')).toHaveAttribute('aria-labelledby', 'missing-reference');
    await expect(part(fallback, 'scroller')).toHaveAccessibleName('Fallback history');

    // Keyboard focus in a short bounded history lands wholly inside it and clear of the sticky heading.
    const scroller = part(labelled, 'scroller');
    await userEvent.tab();
    await expect(scroller.ownerDocument.activeElement).toBe(scroller);
    const expectReadable = async (id: string) => {
      const trigger = triggerOf(labelled, id);
      await expectFocusRing(trigger);
      await waitFor(() => expectInside(trigger, scroller, { tolerancePx: GEOMETRY_TOLERANCE }));
      for (const heading of parts(labelled, 'heading')) await expectNoOverlap(heading, trigger, { tolerancePx: GEOMETRY_TOLERANCE });
    };
    await userEvent.tab();
    await expectReadable('deploy');
    await userEvent.tab();
    await expectReadable('build');
    await expect(scroller.scrollTop).toBeGreaterThan(0);
    await userEvent.tab({ shift: true });
    await expectReadable('deploy');
  },
};

const INVALID_EVENTS: TimelineEvent[] = [
  { id: 'nan', at: Number.NaN, title: 'Imported NaN' },
  { id: 'valid', at: NOW - HOUR, title: 'Valid event' },
  { id: 'text', at: 'last tuesday', title: 'Imported text' },
  { id: 'overflow', at: '2026-02-30T10:00:00Z', title: 'Imported February 30' },
  { id: 'zoneless', at: '2026-10-11T10:00:00', title: 'Imported without zone' },
  { id: 'date', at: new Date(Number.NaN), title: 'Imported invalid Date' },
  { id: 'infinite', at: Number.POSITIVE_INFINITY, title: 'Imported infinity' },
];

export const TriggerAriaMerge: Story = {
  tags: ['!autodocs'],
  args: {
    events: [
      { id: 'dated', at: NOW, title: 'Deployment completed', detail: 'Three services updated.' },
      { id: 'undated', at: 'unreadable', title: 'Imported activity', detail: 'Imported from the previous project.' },
    ],
    slotProps: { trigger: { 'aria-describedby': 'timeline-event-hint' } },
  },
  render: (args) => (
    <>
      <p id="timeline-event-hint">Expand for event details.</p>
      <Timeline {...args} />
    </>
  ),
  play: async ({ canvasElement }) => {
    const dated = triggerOf(canvasElement, 'dated');
    const time = part(item(canvasElement, 'dated'), 'time');
    const dateIds = dated.getAttribute('aria-describedby')!.split(/\s+/);
    await expect(dateIds).toContain('timeline-event-hint');
    await expect(dateIds).toHaveLength(2);
    const fullDateId = dateIds.find((id) => id !== 'timeline-event-hint')!;
    const fullDate = dated.ownerDocument.getElementById(fullDateId)!;
    await expect(time).toContainElement(fullDate);
    const formattedDate = new Intl.DateTimeFormat(LOCALE, { timeZone: 'UTC', dateStyle: 'full', timeStyle: 'long' }).format(NOW);
    await expect(fullDate).toHaveTextContent(formattedDate);
    await expect(dated).toHaveAccessibleDescription(`Expand for event details. ${formattedDate}`);
    const undated = triggerOf(canvasElement, 'undated');
    await expect(undated).toHaveAttribute('aria-describedby', 'timeline-event-hint');
    await expect(undated).toHaveAccessibleDescription('Expand for event details.');
    await expect(part(item(canvasElement, 'undated'), 'time')).toBeNull();
  },
};

export const InvalidDates: Story = {
  tags: ['!autodocs'],
  args: { events: INVALID_EVENTS },
  beforeEach: () => {
    const toISOString = spyOn(Date.prototype, 'toISOString');
    return () => toISOString.mockRestore();
  },
  play: async ({ canvasElement }) => {
    await expect(itemIds(canvasElement)).toEqual(['valid', 'nan', 'text', 'overflow', 'zoneless', 'date', 'infinite']);
    await expect(dayLabels(canvasElement)).toEqual([headingCase(relative.format(0, 'day')), 'Unknown time']);
    const invalidGroup = parts(canvasElement, 'group')[1]!;
    await expect(invalidGroup.querySelector('time')).toBeNull();
    // toISOString only ever runs on valid instants, so no call threw.
    const { results } = (Date.prototype.toISOString as unknown as Mock).mock;
    await expect(results.length).toBeGreaterThan(0);
    for (const result of results) await expect(result.type).toBe('return');
  },
};

export const InvalidInputs: Story = {
  tags: ['!autodocs'],
  args: {
    now: Number.NaN,
    timeZone: 'Mars/Olympus_Mons',
    events: [...EVENTS, { id: 'deploy', at: NOW, title: 'Duplicate deploy id' }],
  },
  beforeEach: () => {
    const error = spyOn(console, 'error').mockImplementation(() => {});
    return () => error.mockRestore();
  },
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(console.error).toHaveBeenCalled());
    const message = (console.error as unknown as Mock).mock.calls.flat().join('\n');
    await expect(message).toContain('timeZone "Mars/Olympus_Mons"');
    await expect(message).toContain('now NaN');
    await expect(message).toContain('duplicate event ids ["deploy"]');
    await expect(message).not.toContain('Encountered two children with the same key');
    // Without a usable clock every heading and row is absolute.
    await expect(dayLabels(canvasElement)[0]).toBe(fullDay(NOW));
    const time = part(item(canvasElement, 'build'), 'time');
    await expect(time.firstChild!.textContent).toBe(
      new Intl.DateTimeFormat(LOCALE, { timeZone: 'UTC', timeStyle: 'short' }).format(Date.parse('2026-10-11T10:00:00Z')),
    );
  },
};

export const FutureEvents: Story = {
  args: {
    events: [
      { id: 'soon', at: NOW + 30 * MINUTE, title: 'Maintenance window opens' },
      { id: 'tomorrow', at: '2026-10-12T09:00:00Z', title: 'Certificate renewal' },
      { id: 'later', at: '2026-10-20T09:00:00Z', title: 'Quarterly review' },
      { id: 'past', at: NOW - 30 * MINUTE, title: 'Backup finished' },
    ],
  },
  play: async ({ canvasElement }) => {
    await expect(itemIds(canvasElement)).toEqual(['later', 'tomorrow', 'soon', 'past']);
    await expect(dayLabels(canvasElement)).toEqual([
      fullDay('2026-10-20T09:00:00Z'),
      headingCase(relative.format(1, 'day')),
      headingCase(relative.format(0, 'day')),
    ]);
    const text = (id: string) => part(item(canvasElement, id), 'time').firstChild!.textContent;
    await expect(text('soon')).toBe(relative.format(30, 'minute'));
    await expect(text('later')).toBe(relative.format(9, 'day'));
    await expect(text('past')).toBe(relative.format(-30, 'minute'));
    await expect(text('soon')).not.toBe(relative.format(-30, 'minute'));
  },
};

// Europe/Madrid: 25 October 2026 lasts 25 hours, 29 March 2026 lasts 23 hours.
const AUTUMN_NOW = Date.parse('2026-10-25T23:30:00Z'); // 26 Oct 00:30 local
const SPRING_NOW = Date.parse('2026-03-29T22:30:00Z'); // 30 Mar 00:30 local
const MIDNIGHT_EVENT: TimelineEvent = { id: 'late', at: '2026-10-11T23:30:00Z', title: 'Late deploy' };

export const DSTBoundary: Story = {
  args: { timeZone: 'Europe/Madrid' },
  render: (args) => (
    <StackFrame>
      <Timeline
        {...args}
        aria-label="Autumn change"
        now={AUTUMN_NOW}
        // 25 hours 20 minutes earlier, but on the previous calendar day.
        events={[{ id: 'autumn', at: '2026-10-25T00:10:00+02:00', title: 'Autumn deploy' }]}
      />
      <Timeline
        {...args}
        aria-label="Spring change"
        now={SPRING_NOW}
        // 23 hours 40 minutes earlier, but two calendar days back.
        events={[{ id: 'spring', at: '2026-03-28T23:50:00+01:00', title: 'Spring deploy' }]}
      />
      <Timeline {...args} aria-label="Madrid midnight" now={NOW} events={[MIDNIGHT_EVENT]} />
      <Timeline {...args} aria-label="UTC midnight" timeZone="UTC" now={NOW} events={[MIDNIGHT_EVENT]} />
    </StackFrame>
  ),
  play: async ({ canvas }) => {
    const root = (name: string) => canvas.getByRole('region', { name });
    const time = (name: string) => part(root(name), 'time').firstChild!.textContent;
    await expect(dayLabels(root('Autumn change'))).toEqual([headingCase(relative.format(-1, 'day'))]);
    await expect(time('Autumn change')).toBe(relative.format(-1, 'day'));
    await expect(dayLabels(root('Spring change'))).toEqual([fullDay('2026-03-28T23:50:00+01:00', 'Europe/Madrid')]);
    await expect(time('Spring change')).toBe(relative.format(-23, 'hour'));
    // 23:30 UTC is already the next day in Madrid.
    await expect(dayLabels(root('Madrid midnight'))).toEqual([headingCase(relative.format(1, 'day'))]);
    await expect(dayLabels(root('UTC midnight'))).toEqual([headingCase(relative.format(0, 'day'))]);
    await expect(part(root('Madrid midnight'), 'group')).toHaveAttribute('data-day', '2026-10-12');
  },
};

const LONG_EVENTS: TimelineEvent[] = [
  {
    id: 'long',
    at: NOW - 3 * HOUR,
    actor: 'Maximiliane Theodora von Hohenzollern-Sigmaringen',
    title: 'Bereitstellungsüberwachungskonfigurationsänderungsprotokoll wurde aktualisiert und veröffentlicht',
    meta: 'feature/infrastruktur-netzwerkrichtlinien-überarbeitung-und-dokumentation',
    detail: <p>Siehe Änderungsprotokoll.</p>,
  },
  { id: 'short', at: NOW - 4 * HOUR, title: 'Kurz' },
];

export const LongContent: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { styled, Timeline, type TimelineEvent } from '@jfrader/ui';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const NOW = Date.parse('2026-10-11T12:00:00Z');

const Narrow = styled.div({ inlineSize: '16rem', maxInlineSize: '100%' });

const events: TimelineEvent[] = [
  {
    id: 'long',
    at: NOW - 3 * HOUR,
    actor: 'Maximiliane Theodora von Hohenzollern-Sigmaringen',
    title: 'Bereitstellungsüberwachungskonfigurationsänderungsprotokoll wurde aktualisiert und veröffentlicht',
    meta: 'feature/infrastruktur-netzwerkrichtlinien-überarbeitung-und-dokumentation',
    detail: <p>Siehe Änderungsprotokoll.</p>,
  },
  {
    id: 'short',
    at: NOW - 4 * HOUR,
    title: 'Kurz',
  },
];

<Narrow>
  <Timeline
    events={events}
    locale="de-DE"
    now={NOW}
    timeZone="UTC"
    aria-label="Deploy history"
  />
</Narrow>`,
      },
    },
  },
  args: { events: LONG_EVENTS, locale: 'de-DE' },
  decorators: [
    (Story) => (
      <Narrow>
        <Story />
      </Narrow>
    ),
  ],
  play: async ({ canvasElement }) => {
    const timeline = canvasElement.querySelector<HTMLElement>('[data-ui="timeline"]')!;
    await expect(timeline.scrollWidth).toBeLessThanOrEqual(timeline.clientWidth + 1);
    const row = item(canvasElement, 'long');
    const trigger = part(row, 'trigger');
    const time = part(row, 'time');
    await expect(trigger.getBoundingClientRect().height).toBeGreaterThanOrEqual(MIN_TRIGGER - 0.5);
    // Narrow rows move the time below the title instead of squeezing the button.
    await expect(time.getBoundingClientRect().top).toBeGreaterThanOrEqual(
      trigger.getBoundingClientRect().bottom - GEOMETRY_TOLERANCE,
    );
    await expect(time.scrollWidth).toBeLessThanOrEqual(time.getBoundingClientRect().width + 1);
    await expect(time.firstChild!.textContent).toBe(
      new Intl.RelativeTimeFormat('de-DE', { numeric: 'auto' }).format(-3, 'hour'),
    );
    for (const element of [trigger, part(row, 'meta'), part(row, 'actor')])
      await expect(element.getBoundingClientRect().right).toBeLessThanOrEqual(
        timeline.getBoundingClientRect().right + GEOMETRY_TOLERANCE,
      );
  },
};

export const Scrolling: Story = {
  name: 'Scrollable history',
  parameters: {
    docs: {
      description: { story: 'Scroll through a bounded history while day headings stay visible.' },
      source: {
        language: 'tsx',
        code: `import { TextField, Timeline, type TimelineEvent } from '@jfrader/ui';

const MINUTE = 60_000;
const NOW = Date.parse('2026-10-11T12:00:00Z');

const checkIcon = (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M3 8.5l3 3 7-7" />
  </svg>
);

const crossIcon = (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M4 4l8 8M12 4l-8 8" />
  </svg>
);

const events: TimelineEvent[] = [
  {
    id: 'keys',
    at: '2026-10-10T08:00:00Z',
    actor: 'Grace Hopper',
    title: 'Rotated API keys',
    meta: '2 keys revoked',
    detail: <TextField label="Rotation reason" defaultValue="Quarterly" size="sm" />,
  },
  {
    id: 'deploy',
    at: NOW - 5 * MINUTE,
    actor: 'Ada Lovelace',
    title: 'Deployed web 4.2 to production',
    meta: 'main · 9f2c1ab',
    tone: 'success',
    icon: checkIcon,
    detail: <p>Three services updated with no errors.</p>,
  },
  {
    id: 'project',
    at: new Date('2026-10-08T09:00:00Z'),
    actor: 'Ada Lovelace',
    title: 'Created project',
  },
  {
    id: 'build',
    at: '2026-10-11T10:00:00Z',
    title: 'Build failed on staging',
    tone: 'danger',
    icon: crossIcon,
    detail: <p>The test step exited with code 1.</p>,
  },
  {
    id: 'review',
    at: '2026-10-10T10:00:00+02:00',
    actor: 'Grace Hopper',
    title: 'Opened pull request 118',
  },
];

<Timeline
  events={events}
  maxHeight="14rem"
  now={NOW}
  timeZone="UTC"
  locale="en-US"
/>`,
      },
    },
  },
  args: { maxHeight: '14rem', 'aria-label': undefined },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const scroller = part(canvasElement, 'scroller');
    await expect(scroller.scrollHeight).toBeGreaterThan(scroller.clientHeight);
    // Without an external name, the region and its focusable scroller share the labels.region fallback.
    await expect(canvas.getByRole('region')).toHaveAccessibleName('Activity');
    await expect(canvas.getByRole('group', { name: 'Activity' })).toBe(scroller);
    await userEvent.tab();
    await expectFocusRing(scroller);
    scroller.scrollTop = scroller.scrollHeight;
    await waitFor(() => expect(scroller.scrollTop).toBeGreaterThan(0));
    const top = scroller.getBoundingClientRect().top;
    const stuck = parts(canvasElement, 'heading').filter(
      (heading) => Math.abs(heading.getBoundingClientRect().top - top) < GEOMETRY_TOLERANCE,
    );
    await expect(stuck.length).toBeGreaterThan(0);
  },
};

export const LiveUpdates: Story = {
  args: { maxHeight: '16rem', defaultValue: ['keys'] },
  render: (args) => <LiveFeed {...args} />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    const scroller = part(canvasElement, 'scroller');
    const status = part(canvasElement, 'status');
    const input = within(item(canvasElement, 'keys')).getByRole('textbox');
    await userEvent.click(input);
    const before = input.getBoundingClientRect().top;
    // fireEvent keeps focus in the detail input, like an update arriving from the network.
    fireEvent.click(canvas.getByRole('button', { name: 'Add event' }));
    await waitFor(() => expect(status).toHaveTextContent('1 new event'));
    await expect(input.ownerDocument.activeElement).toBe(input);
    await expect(Math.abs(input.getBoundingClientRect().top - before)).toBeLessThan(GEOMETRY_TOLERANCE);
    await expect(parts(canvasElement, 'item')[0]).toHaveAttribute('data-new');
    await expect(parts(canvasElement, 'item')[1]).not.toHaveAttribute('data-new');
    // Only the new row's marker rings, once.
    const [freshMarker, olderMarker] = parts(canvasElement, 'marker').map((marker) => getComputedStyle(marker));
    await expect(freshMarker!.animationName).not.toBe('none');
    await expect(freshMarker!.animationIterationCount).toBe('1');
    await expect(olderMarker!.animationName).toBe('none');

    // A clock tick relabels times without a new announcement.
    const announced = status.firstElementChild;
    const deployTime = part(item(canvasElement, 'deploy'), 'time').firstChild!.textContent;
    fireEvent.click(canvas.getByRole('button', { name: 'Tick clock' }));
    await waitFor(() =>
      expect(part(item(canvasElement, 'deploy'), 'time').firstChild!.textContent).not.toBe(deployTime),
    );
    await expect(status.firstElementChild).toBe(announced);

    // Scrolled into history with focus elsewhere: the first visible row stays put.
    input.blur();
    scroller.scrollTop = 120;
    await waitFor(() => expect(scroller.scrollTop).toBeGreaterThan(100));
    await sleep(50);
    const scrollerTop = scroller.getBoundingClientRect().top;
    const visible = parts(canvasElement, 'item').find((li) => li.getBoundingClientRect().bottom > scrollerTop)!;
    const visibleTop = visible.getBoundingClientRect().top;
    fireEvent.click(canvas.getByRole('button', { name: 'Add event' }));
    await waitFor(() => expect(status).toHaveTextContent('1 new event'));
    await waitFor(() => expect(parts(canvasElement, 'item')).toHaveLength(7));
    await expect(Math.abs(visible.getBoundingClientRect().top - visibleTop)).toBeLessThan(GEOMETRY_TOLERANCE);
    await expect(status.firstElementChild).not.toBe(announced);
  },
};

export const ScrollToNew: Story = {
  args: { maxHeight: '16rem', scrollToNew: true, defaultValue: ['keys'] },
  render: (args) => <LiveFeed {...args} />,
  play: async ({ canvas, canvasElement }) => {
    const scroller = part(canvasElement, 'scroller');
    scroller.scrollTop = scroller.scrollHeight;
    await waitFor(() => expect(scroller.scrollTop).toBeGreaterThan(0));
    const active = scroller.ownerDocument.activeElement;
    fireEvent.click(canvas.getByRole('button', { name: 'Add event' }));
    await waitFor(() => expect(scroller.scrollTop).toBeLessThan(1), { timeout: 3000 });
    await expect(scroller.ownerDocument.activeElement).toBe(active);

    // Focus inside a historical detail keeps its viewport even with scrollToNew.
    const input = within(item(canvasElement, 'keys')).getByRole('textbox');
    input.focus();
    await waitFor(() => expect(scroller.scrollTop).toBeGreaterThan(0));
    const before = input.getBoundingClientRect().top;
    fireEvent.click(canvas.getByRole('button', { name: 'Add event' }));
    await waitFor(() => expect(parts(canvasElement, 'item')).toHaveLength(7));
    await sleep(300);
    await expect(input.ownerDocument.activeElement).toBe(input);
    await expect(Math.abs(input.getBoundingClientRect().top - before)).toBeLessThan(GEOMETRY_TOLERANCE);
  },
};

export const FocusRepair: Story = {
  render: (args) => <LiveFeed {...args} />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    const build = triggerOf(canvasElement, 'build');
    build.focus();
    fireEvent.click(canvas.getByRole('button', { name: 'Remove build' }));
    await waitFor(() => expect(item(canvasElement, 'build')).toBeNull());
    await expect(build.ownerDocument.activeElement).toBe(triggerOf(canvasElement, 'keys'));

    // Focus outside the removed event is left alone.
    const remove = canvas.getByRole('button', { name: 'Remove deploy' });
    await userEvent.click(remove);
    await waitFor(() => expect(item(canvasElement, 'deploy')).toBeNull());
    await expect(remove.ownerDocument.activeElement).toBe(remove);
  },
};

export const SSRConsistency: Story = {
  play: async ({ canvasElement, args }) => {
    for (const value of [NOW, new Date(NOW), '2026-10-11T12:00:00Z', '2026-10-11T14:00:00+02:00']) {
      await expect(toEpoch(value)).toBe(NOW);
    }
    for (const value of [NaN, Infinity, 8.64e15 + 1, new Date(NaN), '2026-02-30T12:00:00Z', '2026-10-11', '2026-10-11T12:00:00']) {
      await expect(toEpoch(value)).toBeNull();
    }
    await expect(validEpoch(8.64e15)).toBe(true);
    await expect(validEpoch(-8.64e15)).toBe(true);
    await expect(toEpoch('2026-10-11T24:00:00Z')).toBe(Date.parse('2026-10-12T00:00:00Z'));
    await expect(toEpoch('0099-01-01T00:00:00Z')).toBe(Date.parse('0099-01-01T00:00:00Z'));
    const resolved = resolveTimeOptions('Timeline', 'not_a_locale', 'not/a-zone');
    await expect(resolved).toEqual({
      locale: undefined,
      timeZone: 'UTC',
      problems: [
        'Timeline: locale "not_a_locale" is not a valid language tag; using the default locale.',
        'Timeline: timeZone "not/a-zone" is not a valid IANA time zone; using UTC.',
      ],
    });
    for (const locale of ['en-US', 'en-GB', 'es-ES', 'ar-EG', 'ja-JP', undefined]) {
      for (const options of [undefined, { style: 'percent', maximumFractionDigits: 0 }, { style: 'unit', unit: 'megabyte', maximumFractionDigits: 1 }, { style: 'currency', currency: 'EUR' }] satisfies (Intl.NumberFormatOptions | undefined)[]) {
        const native = new Intl.NumberFormat(locale, options);
        const shared = numberFormatter(locale, options);
        for (const value of [-0, -1.25, 0, 12345.67, NaN, Infinity]) {
          await expect(shared.format(value)).toBe(native.format(value));
          await expect(shared.formatToParts(value)).toEqual(native.formatToParts(value));
        }
        await expect(shared.resolvedOptions()).toEqual(native.resolvedOptions());
      }
      for (const timeZone of ['UTC', 'America/New_York', 'Asia/Tokyo']) {
        for (const timeStyle of ['short', 'long'] as const) {
          const options = { timeZone, dateStyle: 'full', timeStyle } as const;
          await expect(dateTimeFormatter(locale, options).format(NOW)).toBe(new Intl.DateTimeFormat(locale, options).format(NOW));
        }
      }
      const shared = relativeTimeFormatter(locale);
      const native = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
      for (const value of [-2, -1, 0, 1, 2]) await expect(shared.format(value, 'day')).toBe(native.format(value, 'day'));
    }
    await expect(() => numberFormatter('not_a_locale')).toThrow(RangeError);
    await expect(() => dateTimeFormatter('en-US', { timeZone: 'not/a-zone' })).toThrow(RangeError);
    const relativeFormat = relativeTimeFormatter('en-US');
    await expect(relativeTime(NOW - 5 * MINUTE, NOW, relativeFormat)).toBe('5 minutes ago');
    await expect(relativeTime(NOW + 7 * 24 * HOUR, NOW, relativeFormat)).toBe('next week');
    await expect(relativeTime(NOW, NOW, relativeFormat)).toBe('now');
    const html = renderToString(<Timeline {...args} />);
    const template = canvasElement.ownerDocument.createElement('template');
    template.innerHTML = html;
    const server = template.content.querySelector('[data-ui="timeline"]')!;
    const client = canvasElement.querySelector('[data-ui="timeline"]')!;
    await expect(server.textContent).toBe(client.textContent);
    await expect(Array.from(server.querySelectorAll('time'), (time) => time.getAttribute('datetime'))).toEqual(
      Array.from(client.querySelectorAll('time'), (time) => time.getAttribute('datetime')),
    );
  },
};

export const Localized: Story = {
  name: 'Spanish activity labels',
  parameters: {
    docs: {
      description: { story: 'Read relative times, day headings, and event counts in Spanish.' },
      source: {
        language: 'tsx',
        code: `import { TextField, Timeline, type TimelineEvent } from '@jfrader/ui';

const MINUTE = 60_000;
const NOW = Date.parse('2026-10-11T12:00:00Z');

const checkIcon = (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M3 8.5l3 3 7-7" />
  </svg>
);

const crossIcon = (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M4 4l8 8M12 4l-8 8" />
  </svg>
);

const events: TimelineEvent[] = [
  {
    id: 'keys',
    at: '2026-10-10T08:00:00Z',
    actor: 'Grace Hopper',
    title: 'Rotated API keys',
    meta: '2 keys revoked',
    detail: <TextField label="Rotation reason" defaultValue="Quarterly" size="sm" />,
  },
  {
    id: 'deploy',
    at: NOW - 5 * MINUTE,
    actor: 'Ada Lovelace',
    title: 'Deployed web 4.2 to production',
    meta: 'main · 9f2c1ab',
    tone: 'success',
    icon: checkIcon,
    detail: <p>Three services updated with no errors.</p>,
  },
  {
    id: 'project',
    at: new Date('2026-10-08T09:00:00Z'),
    actor: 'Ada Lovelace',
    title: 'Created project',
  },
  {
    id: 'build',
    at: '2026-10-11T10:00:00Z',
    title: 'Build failed on staging',
    tone: 'danger',
    icon: crossIcon,
    detail: <p>The test step exited with code 1.</p>,
  },
  {
    id: 'review',
    at: '2026-10-10T10:00:00+02:00',
    actor: 'Grace Hopper',
    title: 'Opened pull request 118',
  },
];

<Timeline
  events={events}
  locale="es-ES"
  now={NOW}
  timeZone="UTC"
  aria-label="Historial"
  labels={{
    region: 'Historial',
    empty: 'Sin actividad',
    invalidTime: 'Hora desconocida',
    newEvents: (count) => \`\${new Intl.NumberFormat('es-ES').format(count)} nuevos\`,
    dayCount: (count) =>
      new Intl.PluralRules('es-ES').select(count) === 'one' ? '1 evento' : \`\${count} eventos\`,
  }}
/>`,
      },
    },
  },
  args: {
    locale: 'es-ES',
    'aria-label': 'Historial',
    labels: {
      region: 'Historial',
      empty: 'Sin actividad',
      invalidTime: 'Hora desconocida',
      newEvents: (count) => `${new Intl.NumberFormat('es-ES').format(count)} nuevos`,
      dayCount: (count) =>
        new Intl.PluralRules('es-ES').select(count) === 'one' ? '1 evento' : `${count} eventos`,
    },
  },
  play: async ({ canvasElement }) => {
    const spanish = new Intl.RelativeTimeFormat('es-ES', { numeric: 'auto' });
    await expect(dayLabels(canvasElement)).toEqual([
      headingCase(spanish.format(0, 'day'), 'es-ES'),
      headingCase(spanish.format(-1, 'day'), 'es-ES'),
      headingCase(fullDay('2026-10-08T09:00:00Z', 'UTC', 'es-ES'), 'es-ES'),
    ]);
    await expect(dayLabels(canvasElement)[0]).toBe('Hoy');
    await expect(part(item(canvasElement, 'deploy'), 'time').firstChild!.textContent).toBe(
      spanish.format(-5, 'minute'),
    );
    await expect(parts(canvasElement, 'heading')[2]).toHaveTextContent('1 evento');
  },
};

function ReplacementTimelineMarker(props: import('react').ComponentPropsWithRef<'span'>) {
  return <span {...props} data-replacement="marker" />;
}
function ReplacementTimelineTime(props: import('react').ComponentPropsWithRef<'time'>) {
  return <time {...props} data-replacement="time" />;
}
function ReplacementTimelineDetail(props: import('react').ComponentPropsWithRef<'div'>) {
  return <div {...props} data-replacement="detail" />;
}
// Registered classes land before consumer sx; slot css still reaches interior parts.
const StyledTimeline = styled(Timeline)({ paddingInline: vars.space[2] });
export const SlotStyling: Story = {
  args: {
    slots: { marker: ReplacementTimelineMarker, time: ReplacementTimelineTime, detail: ReplacementTimelineDetail },
    sx: { paddingInline: vars.space[5] },
    slotProps: {
      heading: { className: 'custom-heading', sx: { paddingInlineStart: vars.space[3] } },
      trigger: { sx: { paddingInline: vars.space[6] } },
      time: { sx: { fontWeight: vars.fontWeight.semibold } },
      item: { sx: { paddingBlockEnd: vars.space[10] } },
    },
  },
  render: (args) => <StyledTimeline {...args} />,
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector<HTMLElement>('[data-ui="timeline"]')!;
    await expect(part(root, 'marker')).toHaveAttribute('data-replacement', 'marker');
    await expect(part(root, 'time')).toHaveAttribute('data-replacement', 'time');
    await expect(part(root, 'detail')).toHaveAttribute('data-replacement', 'detail');
    const expectPx = (value: string, px: number) =>
      expect(Math.abs(Number.parseFloat(value) - px)).toBeLessThan(GEOMETRY_TOLERANCE);
    await expectPx(getComputedStyle(root).paddingInlineStart, 20);
    const heading = part(root, 'heading');
    await expect(heading).toHaveClass('custom-heading');
    await expectPx(getComputedStyle(heading).paddingInlineStart, 12);
    await expectPx(getComputedStyle(part(root, 'trigger')).paddingInlineStart, 24);
    await expect(Number(getComputedStyle(part(root, 'time')).fontWeight)).toBe(600);
    await expectPx(getComputedStyle(part(root, 'item')).paddingBlockEnd, 40);
  },
};

const refSpy = fn();
export const RefForwarding: Story = {
  render: (args) => <Timeline {...args} ref={refSpy} />,
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('[data-ui="timeline"]');
    await expect(root).toBeInstanceOf(HTMLDivElement);
    await expect(refSpy.mock.calls.map(([element]) => element)).toContain(root);
  },
};

export const LightTheme: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { TextField, ThemeRoot, Timeline, type TimelineEvent } from '@jfrader/ui';

const MINUTE = 60_000;
const NOW = Date.parse('2026-10-11T12:00:00Z');

const checkIcon = (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M3 8.5l3 3 7-7" />
  </svg>
);

const crossIcon = (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M4 4l8 8M12 4l-8 8" />
  </svg>
);

const events: TimelineEvent[] = [
  {
    id: 'keys',
    at: '2026-10-10T08:00:00Z',
    actor: 'Grace Hopper',
    title: 'Rotated API keys',
    meta: '2 keys revoked',
    detail: <TextField label="Rotation reason" defaultValue="Quarterly" size="sm" />,
  },
  {
    id: 'deploy',
    at: NOW - 5 * MINUTE,
    actor: 'Ada Lovelace',
    title: 'Deployed web 4.2 to production',
    meta: 'main · 9f2c1ab',
    tone: 'success',
    icon: checkIcon,
    detail: <p>Three services updated with no errors.</p>,
  },
  {
    id: 'project',
    at: new Date('2026-10-08T09:00:00Z'),
    actor: 'Ada Lovelace',
    title: 'Created project',
  },
  {
    id: 'build',
    at: '2026-10-11T10:00:00Z',
    title: 'Build failed on staging',
    tone: 'danger',
    icon: crossIcon,
    detail: <p>The test step exited with code 1.</p>,
  },
  {
    id: 'review',
    at: '2026-10-10T10:00:00+02:00',
    actor: 'Grace Hopper',
    title: 'Opened pull request 118',
  },
];

<ThemeRoot theme="light">
  <Timeline
    events={events}
    defaultValue={['deploy', 'keys']}
    now={NOW}
    timeZone="UTC"
    locale="en-US"
    aria-label="Deploy history"
  />
</ThemeRoot>`,
      },
    },
  },
  args: { defaultValue: ['deploy', 'keys'] },
  decorators: [withLightTheme],
};

export const RTL: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { TextField, Timeline, type TimelineEvent } from '@jfrader/ui';

const MINUTE = 60_000;
const NOW = Date.parse('2026-10-11T12:00:00Z');

const checkIcon = (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M3 8.5l3 3 7-7" />
  </svg>
);

const crossIcon = (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M4 4l8 8M12 4l-8 8" />
  </svg>
);

const events: TimelineEvent[] = [
  {
    id: 'keys',
    at: '2026-10-10T08:00:00Z',
    actor: 'Grace Hopper',
    title: 'Rotated API keys',
    meta: '2 keys revoked',
    detail: <TextField label="Rotation reason" defaultValue="Quarterly" size="sm" />,
  },
  {
    id: 'deploy',
    at: NOW - 5 * MINUTE,
    actor: 'Ada Lovelace',
    title: 'Deployed web 4.2 to production',
    meta: 'main · 9f2c1ab',
    tone: 'success',
    icon: checkIcon,
    detail: <p>Three services updated with no errors.</p>,
  },
  {
    id: 'project',
    at: new Date('2026-10-08T09:00:00Z'),
    actor: 'Ada Lovelace',
    title: 'Created project',
  },
  {
    id: 'build',
    at: '2026-10-11T10:00:00Z',
    title: 'Build failed on staging',
    tone: 'danger',
    icon: crossIcon,
    detail: <p>The test step exited with code 1.</p>,
  },
  {
    id: 'review',
    at: '2026-10-10T10:00:00+02:00',
    actor: 'Grace Hopper',
    title: 'Opened pull request 118',
  },
];

<Timeline
  events={events}
  dir="rtl"
  defaultValue={['deploy']}
  now={NOW}
  timeZone="UTC"
  locale="en-US"
  aria-label="Deploy history"
/>`,
      },
    },
  },
  args: { dir: 'rtl', defaultValue: ['deploy'] },
  play: async ({ canvasElement, userEvent }) => {
    await expect(itemIds(canvasElement)).toEqual(SORTED_IDS);
    const row = item(canvasElement, 'deploy');
    const marker = part(row, 'marker');
    // The marker column sits at inline-start, which is the right edge in RTL.
    await expect(Math.abs(marker.getBoundingClientRect().right - row.getBoundingClientRect().right)).toBeLessThan(
      GEOMETRY_TOLERANCE,
    );
    const trigger = part(row, 'trigger');
    const caret = new DOMMatrix(getComputedStyle(trigger, '::after').transform);
    // rotate(-90deg): the caret turns from pointing left to pointing down.
    await expect(Math.abs(caret.b + 1)).toBeLessThan(0.01);
    await userEvent.tab();
    await userEvent.keyboard('{ArrowDown}');
    await expect(trigger.ownerDocument.activeElement).toBe(triggerOf(canvasElement, 'build'));
  },
};

export const ReducedMotion: Story = {
  args: { defaultValue: ['deploy'] },
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { TextField, Timeline, type TimelineEvent } from '@jfrader/ui';

const MINUTE = 60_000;
const NOW = Date.parse('2026-10-11T12:00:00Z');

const checkIcon = (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M3 8.5l3 3 7-7" />
  </svg>
);

const crossIcon = (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M4 4l8 8M12 4l-8 8" />
  </svg>
);

const events: TimelineEvent[] = [
  {
    id: 'keys',
    at: '2026-10-10T08:00:00Z',
    actor: 'Grace Hopper',
    title: 'Rotated API keys',
    meta: '2 keys revoked',
    detail: <TextField label="Rotation reason" defaultValue="Quarterly" size="sm" />,
  },
  {
    id: 'deploy',
    at: NOW - 5 * MINUTE,
    actor: 'Ada Lovelace',
    title: 'Deployed web 4.2 to production',
    meta: 'main · 9f2c1ab',
    tone: 'success',
    icon: checkIcon,
    detail: <p>Three services updated with no errors.</p>,
  },
  { id: 'project', at: new Date('2026-10-08T09:00:00Z'), actor: 'Ada Lovelace', title: 'Created project' },
  {
    id: 'build',
    at: '2026-10-11T10:00:00Z',
    title: 'Build failed on staging',
    tone: 'danger',
    icon: crossIcon,
    detail: <p>The test step exited with code 1.</p>,
  },
  { id: 'review', at: '2026-10-10T10:00:00+02:00', actor: 'Grace Hopper', title: 'Opened pull request 118' },
];

<Timeline
  events={events}
  defaultValue={['deploy']}
  now={NOW}
  timeZone="UTC"
  locale="en-US"
  aria-label="Deploy history"
/>`,
      },
      description: {
        story:
          'Enable reduced motion to check rendering in the browser. This story checks CSS rules only.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const trigger = triggerOf(canvasElement, 'deploy');
    await expect(mediaDeclarations(trigger, 'prefers-reduced-motion')).toContainEqual(
      expect.objectContaining({ transitionDuration: '0s' }),
    );
    const row = item(canvasElement, 'deploy');
    row.setAttribute('data-new', '');
    for (const element of [row, part(row, 'marker')]) {
      await expect(mediaDeclarations(element, 'prefers-reduced-motion')).toContainEqual(
        expect.objectContaining({ animationName: 'none' }),
      );
    }
    row.removeAttribute('data-new');
    const detail = part(row, 'detail');
    detail.setAttribute('data-enter', '');
    await expect(mediaDeclarations(detail, 'prefers-reduced-motion')).toContainEqual(
      expect.objectContaining({ animationName: 'none' }),
    );
    detail.removeAttribute('data-enter');
  },
};

export const ForcedColors: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Enable forced colors to check rendering in the browser. This story checks CSS rules only.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const row = item(canvasElement, 'deploy');
    await expect(mediaDeclarations(part(row, 'marker'), 'forced-colors')).toContainEqual(
      expect.objectContaining({ borderColor: 'canvastext' }),
    );
    await expect(mediaDeclarations(row, 'forced-colors', '::before')).toContainEqual(
      expect.objectContaining({ borderInlineStartColor: 'graytext' }),
    );
    // The disclosure keeps a real border that forced colors paints as the button boundary.
    await expect(getComputedStyle(part(row, 'trigger')).borderTopStyle).toBe('solid');
    await expect(mediaDeclarations(part(row, 'trigger'), 'forced-colors', '::after')).toContainEqual(
      expect.objectContaining({ forcedColorAdjust: 'none', color: 'buttontext' }),
    );
  },
};

export const MobileLayout: Story = {
  tags: ['!autodocs'],
  args: { defaultValue: ['deploy', 'build', 'keys'] },
  parameters: {
    viewport: {
      options: {
        mobile: { name: 'Mobile', styles: { width: '390px', height: '844px' }, type: 'mobile' },
      },
    },
  },
  globals: { viewport: { value: 'mobile', isRotated: false } },
  play: async ({ canvasElement, userEvent }) => {
    const document = canvasElement.ownerDocument;
    const root = canvasElement.querySelector<HTMLElement>('[data-ui="timeline"]')!;
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(document.documentElement.clientWidth + 1);
    const bounds = root.getBoundingClientRect();
    await expect(bounds.left).toBeGreaterThanOrEqual(0);
    await expect(bounds.right).toBeLessThanOrEqual(document.documentElement.clientWidth + 1);
    for (const element of [...parts(root, 'trigger'), ...parts(root, 'detail'), ...parts(root, 'time')]) {
      await expect(element.scrollWidth).toBeLessThanOrEqual(element.clientWidth + 1);
      await expect(element.getBoundingClientRect().right).toBeLessThanOrEqual(bounds.right + GEOMETRY_TOLERANCE);
    }
    const deploy = triggerOf(root, 'deploy');
    deploy.focus();
    await userEvent.keyboard('{Enter}');
    await expect(deploy).toHaveAttribute('aria-expanded', 'false');
    await userEvent.keyboard(' ');
    await expect(deploy).toHaveAttribute('aria-expanded', 'true');
    await expect(controlled(deploy)).toBeVisible();
    await expectFocusRing(deploy);
    for (const trigger of parts(root, 'trigger'))
      await expect(trigger.getBoundingClientRect().height).toBeGreaterThanOrEqual(MIN_TRIGGER - 0.5);
  },
};

const centreX = (rect: DOMRect) => (rect.left + rect.right) / 2;
const expectNear = (actual: number, expected: number, label: string) =>
  expect(Math.abs(actual - expected), `${label}: ${actual} vs ${expected}`).toBeLessThan(GEOMETRY_TOLERANCE);
/** Rail box of an item, read from its positioned `::before`. */
function railRect(row: HTMLElement) {
  const style = getComputedStyle(row, '::before');
  const box = row.getBoundingClientRect();
  const left = box.left + Number.parseFloat(style.left);
  const width = Number.parseFloat(style.borderInlineStartWidth);
  return new DOMRect(left, box.top + Number.parseFloat(style.top), width, box.height - Number.parseFloat(style.top) - Number.parseFloat(style.bottom));
}
/** Inline-start edge of a box, for either direction. */
const inlineStart = (rect: DOMRect, rtl: boolean) => (rtl ? rect.right : rect.left);
const rhythmCases = [
  { name: 'Regular history', size: 'md', dir: 'ltr', narrow: false },
  { name: 'Compact history', size: 'sm', dir: 'ltr', narrow: false },
  { name: 'RTL history', size: 'md', dir: 'rtl', narrow: false },
  { name: 'Compact RTL history', size: 'sm', dir: 'rtl', narrow: false },
  { name: 'Narrow regular history', size: 'md', dir: 'ltr', narrow: true },
  { name: 'Narrow compact history', size: 'sm', dir: 'ltr', narrow: true },
  { name: 'Narrow RTL history', size: 'md', dir: 'rtl', narrow: true },
  { name: 'Narrow compact RTL history', size: 'sm', dir: 'rtl', narrow: true },
] as const;

export const DayRhythm: Story = {
  tags: ['!autodocs'],
  render: (args) => (
    <StackFrame data-testid="rhythm-stack">
      {rhythmCases.map(({ name, size, dir, narrow }) => {
        const history = <Timeline {...args} size={size} dir={dir} aria-label={name} defaultValue={['deploy', 'keys']} />;
        return narrow ? <Narrow key={name}>{history}</Narrow> : <div key={name}>{history}</div>;
      })}
    </StackFrame>
  ),
  play: async ({ canvas }) => {
    for (const { name, dir, narrow } of rhythmCases) {
      const root = canvas.getByRole('region', { name });
      const rtl = dir === 'rtl';
      const groups = parts(root, 'group');
      const rows = parts(root, 'item');
      const options = { tolerancePx: GEOMETRY_TOLERANCE };
      await expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth + 1);
      await expectAligned(parts(root, 'marker'), 'center-x', options);
      if (!narrow) await expectAligned(parts(root, 'time'), rtl ? 'left' : 'right', options);
      for (const [groupIndex, group] of groups.entries()) {
        const heading = part(group, 'heading');
        const groupRows = parts(group, 'item');
        await expectAligned([root, heading], 'left', options);
        await expectAligned([root, heading], 'right', options);
        await expectInside(heading.firstElementChild!, heading, options);
        await expectNoOverlap(heading, part(group, 'list'), options);
        for (const [index, row] of groupRows.entries()) {
          const markerElement = part(row, 'marker');
          const marker = markerElement.getBoundingClientRect();
          const summary = part(row, 'summary');
          const title = part(row, 'trigger') ?? part(row, 'title');
          const time = part(row, 'time');
          await expectInside(markerElement, row, options);
          await expectNoOverlap(markerElement, title, options);
          await expectNoOverlap(title, time, options);
          await expectNear(marker.top - row.getBoundingClientRect().top,
            part(rows[0]!, 'marker').getBoundingClientRect().top - rows[0]!.getBoundingClientRect().top,
            `${name} markers align with the first summary line`);
          for (const element of [summary, title, time, part(row, 'context')].filter(Boolean)) {
            await expectInside(element, root, options);
            await expect(element.scrollWidth).toBeLessThanOrEqual(element.clientWidth + 1);
          }
          const context = part(row, 'context');
          if (context) {
            await expect(context.getBoundingClientRect().top).toBeGreaterThanOrEqual(title.getBoundingClientRect().bottom - GEOMETRY_TOLERANCE);
            await expectNoOverlap(context, time, options);
          }
          if (narrow) {
            const lastLine = context ?? title;
            await expect(time.getBoundingClientRect().top).toBeGreaterThanOrEqual(lastLine.getBoundingClientRect().bottom - GEOMETRY_TOLERANCE);
            await expectNear(inlineStart(time.getBoundingClientRect(), rtl), inlineStart(summary.getBoundingClientRect(), rtl), `${name} time below summary`);
          } else {
            await expect(time.getBoundingClientRect().top).toBeLessThan(title.getBoundingClientRect().bottom);
          }
          const detail = part(row, 'detail');
          if (detail && !detail.hidden) {
            await expectInside(detail, row, options);
            await expectNoOverlap(detail, summary, options);
            await expectAligned([detail, summary], rtl ? 'right' : 'left', options);
          }
          const next = groupRows[index + 1];
          if (!next) {
            await expect(getComputedStyle(row, '::before').content).toBe('none');
            continue;
          }
          const rail = railRect(row);
          const nextMarker = part(next, 'marker').getBoundingClientRect();
          await expectNear(centreX(rail), centreX(marker), `${name} ${row.dataset.eventId} rail x`);
          await expect(rail.height).toBeGreaterThan(0);
          await expect(rail.top).toBeGreaterThan(marker.bottom);
          await expect(rail.bottom).toBeLessThan(nextMarker.top);
          await expect(rail.top - marker.bottom).toBeLessThan(marker.height / 2);
          await expect(nextMarker.top - rail.bottom).toBeLessThan(nextMarker.height / 2);
          if (detail && !detail.hidden) await expect(rail.bottom).toBeGreaterThan(detail.getBoundingClientRect().bottom);
          await expectNoOverlap(row, next, options);
        }
        const nextGroup = groups[groupIndex + 1];
        if (nextGroup) {
          await expect(part(nextGroup, 'heading').getBoundingClientRect().top).toBeGreaterThan(groupRows.at(-1)!.getBoundingClientRect().bottom);
          await expectNoOverlap(group, nextGroup, options);
        }
      }
      await expect(groups.map((group) => parts(group, 'item').length)).toEqual([2, 2, 1]);
    }
  },
};

export const DayRhythmLargeText: Story = {
  ...DayRhythm,
  name: 'Day rhythm at 200% text size',
  parameters: {
    viewport: {
      options: { tiny: { name: 'Tiny', styles: { width: '320px', height: '844px' }, type: 'mobile' } },
    },
  },
  globals: { viewport: { value: 'tiny', isRotated: false } },
  beforeEach: ({ canvasElement }) => {
    const root = canvasElement.ownerDocument.documentElement;
    const previous = root.style.fontSize;
    root.style.fontSize = '200%';
    return () => {
      root.style.fontSize = previous;
    };
  },
  play: async ({ canvas, canvasElement }) => {
    const document = canvasElement.ownerDocument.documentElement;
    await expect(document.scrollWidth).toBeLessThanOrEqual(document.clientWidth + 1);
    const frame = canvas.getByTestId('rhythm-stack');
    for (const { name } of rhythmCases) {
      const root = canvas.getByRole('region', { name });
      await expectInside(root, frame, { tolerancePx: GEOMETRY_TOLERANCE });
      await expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth + 1);
      for (const trigger of parts(root, 'trigger')) {
        await expectInside(trigger, root, { tolerancePx: GEOMETRY_TOLERANCE });
        await expect(trigger.getBoundingClientRect().height).toBeGreaterThanOrEqual(MIN_TRIGGER - 0.5);
      }
    }
  },
};
