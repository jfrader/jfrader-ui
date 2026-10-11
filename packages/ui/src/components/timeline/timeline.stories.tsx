import { useState } from 'react';
import { renderToString } from 'react-dom/server';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fireEvent, fn, spyOn, waitFor, within, type Mock } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { withLightTheme } from '../../testing/story-decorators';
import { Timeline, type TimelineEvent, type TimelineProps } from './index';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const NOW = Date.parse('2026-10-11T12:00:00Z');
const LOCALE = 'en-US';
/** Outline is authored as 2px; fractional device pixel ratios compute it slightly thinner. */
const RING_TOLERANCE = 1.1;
const GEOMETRY_TOLERANCE = 1.5;
const MIN_TRIGGER = 32;
const relative = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' });
const fullDay = (at: number | string, timeZone = 'UTC', locale = LOCALE) =>
  new Intl.DateTimeFormat(locale, { timeZone, dateStyle: 'full' }).format(new Date(at));

const frameStyle = css({ inlineSize: '34rem', maxInlineSize: '100%' });
const narrowStyle = css({ inlineSize: '16rem' });
const stackStyle = css({ display: 'grid', gap: vars.space[6] });
const toolbarStyle = css({ display: 'flex', flexWrap: 'wrap', gap: vars.space[2], marginBlockEnd: vars.space[4] });
const fixtureStyle = css({
  boxSizing: 'border-box',
  minBlockSize: vars.space[8],
  minInlineSize: vars.space[8],
  paddingInline: vars.space[3],
  color: vars.color.text,
  backgroundColor: vars.color.surface,
  border: `1px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.sm,
  font: 'inherit',
});
const fieldStyle = css({ display: 'grid', gap: vars.space[1] });

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

const reasonField = (
  <label css={fieldStyle}>
    Rotation reason
    <input css={fixtureStyle} defaultValue="Quarterly" />
  </label>
);

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

const usage = `<Timeline events={events} now={now} timeZone="Europe/Madrid" aria-label="Deploy history" />`;

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
      <div css={toolbarStyle}>
        <button type="button" css={fixtureStyle} onClick={add}>
          Add event
        </button>
        <button type="button" css={fixtureStyle} onClick={() => setNow((current) => current + MINUTE)}>
          Tick clock
        </button>
        <button
          type="button"
          css={fixtureStyle}
          onClick={() => setEvents((current) => current.filter((event) => event.id !== 'build'))}
        >
          Remove build
        </button>
        <button
          type="button"
          css={fixtureStyle}
          onClick={() => setEvents((current) => current.filter((event) => event.id !== 'deploy'))}
        >
          Remove deploy
        </button>
      </div>
      <Timeline {...args} events={events} now={now} />
    </>
  );
}

const meta = {
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
      <div css={frameStyle}>
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      source: { code: usage },
      description: {
        component: [
          'Newest-first activity grouped by calendar day in `timeZone`. Each day is a heading plus an ordered list; events with `detail` get a native disclosure button whose panel stays mounted. Not a feed or accordion widget.',
          'Keyboard: Tab and Shift+Tab follow DOM order through disclosures and open details. Enter or Space toggles. ArrowDown/ArrowUp move between disclosures across days and stop at the ends; Home/End jump to the first/last. Keys inside detail content are left alone.',
          'Clock: pass `now` (epoch ms) and update it about once a minute; the component runs no timer. Pass the same `now`, `locale` and `timeZone` on the server and the client so hydration text matches.',
          'Dates: headings use `Intl.RelativeTimeFormat` for today/yesterday/tomorrow and `Intl.DateTimeFormat` otherwise; rows show signed relative times with the full date as hidden text. Events with unreadable dates stay, in a trailing group. Counts and the region name come from `labels`.',
          'Updates: new rows never take focus. In a bounded timeline (`maxHeight`) the row being read keeps its position when newer events arrive; `scrollToNew` opts into scrolling to them. New ids are announced in a status region.',
          'Details: `value`/`defaultValue`/`onValueChange` hold the open ids. Every event is rendered; there is no virtualization or pagination.',
        ].join('\n\n'),
      },
    },
  },
} satisfies Meta<typeof Timeline>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas, canvasElement }) => {
    const region = canvas.getByRole('region', { name: 'Deploy history' });
    await expect(Timeline.displayName).toBe('Timeline');
    await expect(itemIds(canvasElement)).toEqual(SORTED_IDS);
    await expect(EVENTS.map((event) => event.id)).toEqual(['keys', 'deploy', 'project', 'build', 'review']);
    await expect(canvas.getAllByRole('heading', { level: 3 })).toHaveLength(3);
    await expect(dayLabels(canvasElement)).toEqual([
      relative.format(0, 'day'),
      relative.format(-1, 'day'),
      fullDay('2026-10-08T09:00:00Z'),
    ]);
    const lists = canvas.getAllByRole('list');
    await expect(lists.map((list) => within(list).getAllByRole('listitem').length)).toEqual([2, 2, 1]);
    await expect(lists[0]!.tagName).toBe('OL');
    await expect(lists[1]).toHaveAccessibleName(`${relative.format(-1, 'day')} 2 events`);
    const time = part(item(canvasElement, 'deploy'), 'time');
    await expect(time).toHaveAttribute('datetime', '2026-10-11T11:55:00.000Z');
    await expect(time.firstChild!.textContent).toBe(relative.format(-5, 'minute'));
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
    <div css={stackStyle}>
      <Timeline {...args} size="sm" aria-label="Compact history" headingLevel={4} />
      <Timeline {...args} size="md" aria-label="Regular history" headingLevel={4} />
    </div>
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
  args: { defaultValue: ['deploy', 'build', 'keys'] },
  play: async ({ canvasElement, args }) => {
    for (const id of ['deploy', 'build', 'keys']) {
      const trigger = triggerOf(canvasElement, id);
      await expect(trigger).toHaveAttribute('aria-expanded', 'true');
      await expect(controlled(trigger)).toBeVisible();
      await expect(item(canvasElement, id)).toHaveAttribute('data-state', 'open');
    }
    await expect(args.onValueChange).not.toHaveBeenCalled();
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
      <div css={toolbarStyle}>
        <button type="button" css={fixtureStyle} onClick={() => setOpen([])}>
          Collapse all
        </button>
      </div>
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
  args: { value: [] },
  play: async ({ canvasElement, userEvent, args }) => {
    const deploy = triggerOf(canvasElement, 'deploy');
    await userEvent.click(deploy);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith(['deploy']);
    await expect(deploy).toHaveAttribute('aria-expanded', 'false');
    await expect(controlled(deploy)).not.toBeVisible();
    await expect(deploy.ownerDocument.activeElement).toBe(deploy);
    await userEvent.keyboard('{Enter}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
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
    <div css={stackStyle}>
      <h2 id="history-heading">Recent changes</h2>
      <p id="history-hint">Times are UTC</p>
      <Timeline {...args} />
      <Timeline {...args} aria-label="Fallback history" aria-labelledby="missing-reference" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const [labelled, fallback] = Array.from(canvasElement.querySelectorAll<HTMLElement>('[data-ui="timeline"]'));
    await expect(labelled).toHaveAttribute('aria-labelledby', 'history-heading');
    await expect(labelled).not.toHaveAttribute('aria-label');
    await expect(labelled).toHaveAccessibleName('Recent changes');
    await expect(labelled).toHaveAttribute('aria-describedby', 'history-hint');
    await expect(fallback).toHaveAttribute('aria-labelledby', 'missing-reference');
    await expect(fallback).toHaveAttribute('aria-label', 'Fallback history');
    await expect(fallback).toHaveAccessibleName('Fallback history');
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

export const InvalidDates: Story = {
  args: { events: INVALID_EVENTS },
  beforeEach: () => {
    const toISOString = spyOn(Date.prototype, 'toISOString');
    return () => toISOString.mockRestore();
  },
  play: async ({ canvasElement }) => {
    await expect(itemIds(canvasElement)).toEqual(['valid', 'nan', 'text', 'overflow', 'zoneless', 'date', 'infinite']);
    await expect(dayLabels(canvasElement)).toEqual([relative.format(0, 'day'), 'Unknown time']);
    const invalidGroup = parts(canvasElement, 'group')[1]!;
    await expect(invalidGroup.querySelector('time')).toBeNull();
    // toISOString only ever runs on valid instants, so no call threw.
    const { results } = (Date.prototype.toISOString as unknown as Mock).mock;
    await expect(results.length).toBeGreaterThan(0);
    for (const result of results) await expect(result.type).toBe('return');
  },
};

export const InvalidInputs: Story = {
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
      relative.format(1, 'day'),
      relative.format(0, 'day'),
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
    <div css={stackStyle}>
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
    </div>
  ),
  play: async ({ canvas }) => {
    const root = (name: string) => canvas.getByRole('region', { name });
    const time = (name: string) => part(root(name), 'time').firstChild!.textContent;
    await expect(dayLabels(root('Autumn change'))).toEqual([relative.format(-1, 'day')]);
    await expect(time('Autumn change')).toBe(relative.format(-1, 'day'));
    await expect(dayLabels(root('Spring change'))).toEqual([fullDay('2026-03-28T23:50:00+01:00', 'Europe/Madrid')]);
    await expect(time('Spring change')).toBe(relative.format(-23, 'hour'));
    // 23:30 UTC is already the next day in Madrid.
    await expect(dayLabels(root('Madrid midnight'))).toEqual([relative.format(1, 'day')]);
    await expect(dayLabels(root('UTC midnight'))).toEqual([relative.format(0, 'day')]);
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
  args: { events: LONG_EVENTS, locale: 'de-DE' },
  decorators: [
    (Story) => (
      <div css={narrowStyle}>
        <Story />
      </div>
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
  args: { maxHeight: '14rem' },
  play: async ({ canvasElement, userEvent }) => {
    const scroller = part(canvasElement, 'scroller');
    await expect(scroller.scrollHeight).toBeGreaterThan(scroller.clientHeight);
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
    await expect(dayLabels(canvasElement).slice(0, 2)).toEqual([spanish.format(0, 'day'), spanish.format(-1, 'day')]);
    await expect(part(item(canvasElement, 'deploy'), 'time').firstChild!.textContent).toBe(
      spanish.format(-5, 'minute'),
    );
    await expect(parts(canvasElement, 'heading')[2]).toHaveTextContent('1 evento');
  },
};

export const SlotStyling: Story = {
  args: {
    sx: { paddingInline: vars.space[5] },
    slotProps: {
      heading: { className: 'custom-heading', css: { paddingInlineStart: vars.space[3] } },
      trigger: { css: { paddingInline: vars.space[6] } },
      time: { css: { fontWeight: vars.fontWeight.semibold } },
      item: { css: { paddingBlockEnd: vars.space[10] } },
    },
  },
  // Consumer css applies before sx, so sx wins the padding.
  render: (args) => <Timeline {...args} css={{ paddingInline: vars.space[2] }} />,
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector<HTMLElement>('[data-ui="timeline"]')!;
    await expect(getComputedStyle(root).paddingInlineStart).toBe('20px');
    const heading = part(root, 'heading');
    await expect(heading).toHaveClass('custom-heading');
    await expect(getComputedStyle(heading).paddingInlineStart).toBe('12px');
    await expect(getComputedStyle(part(root, 'trigger')).paddingInlineStart).toBe('24px');
    await expect(getComputedStyle(part(root, 'time')).fontWeight).toBe('600');
    await expect(getComputedStyle(part(root, 'item')).paddingBlockEnd).toBe('40px');
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
  args: { defaultValue: ['deploy', 'keys'] },
  decorators: [withLightTheme],
};

export const RTL: Story = {
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
      description: {
        story:
          'Structural check of the authored reduced-motion rules; it does not emulate the preference. Browser QA verifies the rendered result.',
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
    await expect(mediaDeclarations(row, 'prefers-reduced-motion')).toContainEqual(
      expect.objectContaining({ animationName: 'none' }),
    );
    row.removeAttribute('data-new');
  },
};

export const ForcedColors: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Structural check of the authored forced-colors rules; it does not emulate forced colors. Browser QA verifies the rendered result.',
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
  },
};
