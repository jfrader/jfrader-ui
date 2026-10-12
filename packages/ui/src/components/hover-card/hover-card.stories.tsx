import { useState, type CSSProperties, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fireEvent, fn, waitFor, within, type Mock } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { withLightTheme } from '../../testing/story-decorators';
import { expectThemedSurface } from '../../testing/theme-assertions';
import { Button } from '../button';
import { Dialog } from '../dialog';
import { Popover } from '../popover';
import { ThemeRoot } from '../theme-root';
import {
  HoverCard,
  type HoverCardGroupProps,
  type HoverCardProfileProps,
  type HoverCardProps,
  type HoverCardStat,
} from './index';

// The documented defaults, in ms: hover open/close, group warm period and warm intent.
const OPEN_DELAY = 500;
const CLOSE_DELAY = 140;
const SKIP_DELAY = 300;
const INTENT_DELAY = 80;
// Margin over a timer before asserting its effect, and the window for "immediate" opens.
const TIMER_MARGIN = 120;
const IMMEDIATE = 100;

// Raw fixture buttons must pass the global target-size (WCAG 2.5.8) axe gate in every environment.
const FIXTURE_BUTTON = { minHeight: '24px', minWidth: '24px', padding: '4px 10px', boxSizing: 'border-box' } as const;
// WCAG 2.5.8 minimum target size, in CSS px.
const TARGET_MIN = 24;
// Layout boxes land on fractional pixels (zoom, fractional devicePixelRatio, font metrics);
// geometry comparisons allow this much sub-pixel drift instead of exact float equality.
const SUBPIXEL = 0.5;

const TRIGGER = '@maya';
const JOINED = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(new Date(2024, 2, 1));

const STATS: HoverCardStat[] = [
  { id: 'projects', label: 'Projects', value: 12 },
  { id: 'reviews', label: 'Reviews', value: 1280 },
];

const PROFILE = {
  name: 'Maya Chen',
  subtitle: 'Product designer · Platform',
  bio: 'Designs the review and release flows.',
  stats: STATS,
  meta: `Joined ${JOINED}`,
} satisfies HoverCardProfileProps;

const rowStyle = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: vars.space[3],
} satisfies CSSProperties;

const placementGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, max-content)',
  justifyContent: 'center',
  columnGap: '22rem',
  rowGap: '16rem',
  paddingBlock: '14rem',
} satisfies CSSProperties;

const triggerRef = fn<(element: HTMLButtonElement | null) => void>();
const contentRef = fn<(element: HTMLDivElement | null) => void>();
const linkRef = fn<(element: HTMLButtonElement | null) => void>();

const usage = `<HoverCard>
  <HoverCard.Trigger>@maya</HoverCard.Trigger>
  <HoverCard.Content>
    <HoverCard.Profile
      name="Maya Chen"
      subtitle="Product designer"
      stats={[{ id: 'projects', label: 'Projects', value: 12 }]}
    />
  </HoverCard.Content>
</HoverCard>`;

const meta = {
  title: 'Surfaces/HoverCard',
  component: HoverCard,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Preview a person or reference by hovering over or focusing its trigger.',
      },
      usage: '- Uses the tooltip pattern: `role="tooltip"`; the open card describes the trigger. Repeat information available elsewhere. Do not add links, buttons or fields; use Popover for actions.\n- Hover opens after `openDelay` (500ms). Tab onto the trigger opens immediately; Enter or Space activate the trigger and open once. The pointer can rest on the card (WCAG 1.4.13).\n- Escape closes without moving focus and blocks reopening until the pointer leaves or focus moves. Tab/Shift+Tab away closes without moving focus. Arrows, Home and End pass through.\n- A touch tap on a button trigger toggles the card. A link supplied through `render` still navigates on click, Enter or tap.\n- `HoverCard.Group` controls the open member through `value` / `defaultValue` / `onValueChange`. Cards swap after 80ms while the group is warm.\n- Inside a modal, give the enclosing ThemeRoot a `portalContainer` inside the dialog.',
      source: { code: usage },
    },
  },
} satisfies Meta<typeof HoverCard>;

export default meta;

type Story = StoryObj<typeof meta>;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function ProfileExample({ before = true, ...props }: HoverCardProps & { before?: boolean }) {
  return (
    <div style={rowStyle}>
      {before && <Button>Before</Button>}
      <HoverCard {...props}>
        <HoverCard.Trigger ref={triggerRef}>{TRIGGER}</HoverCard.Trigger>
        <HoverCard.Content ref={contentRef}>
          <HoverCard.Profile {...PROFILE} />
        </HoverCard.Content>
      </HoverCard>
      <Button>Next</Button>
    </div>
  );
}
ProfileExample.displayName = 'ProfileExample';

/** Portaled content lives in the story document's body, outside the canvas. */
function bodyOf(canvasElement: HTMLElement) {
  return within(canvasElement.ownerDocument.body);
}

const queryCards = (canvasElement: HTMLElement) => bodyOf(canvasElement).queryAllByRole('tooltip');
const findCard = (canvasElement: HTMLElement) => bodyOf(canvasElement).findByRole('tooltip');

function getTrigger(canvasElement: HTMLElement, name = TRIGGER) {
  return within(canvasElement).getByRole('button', { name });
}

async function expectClosed(canvasElement: HTMLElement) {
  await waitFor(() => expect(queryCards(canvasElement)).toHaveLength(0));
}

async function expectOpenWithin(canvasElement: HTMLElement, timeout: number) {
  await waitFor(() => expect(queryCards(canvasElement)).toHaveLength(1), { timeout });
  return queryCards(canvasElement)[0]!;
}

async function expectFocus(element: HTMLElement) {
  await expect(element.ownerDocument.activeElement).toBe(element);
  await expect(getComputedStyle(element).outlineStyle).not.toBe('none');
  // Fractional devicePixelRatios device-snap outline widths (authored 2px computes ~1.49px).
  await expect(parseFloat(getComputedStyle(element).outlineWidth)).toBeGreaterThan(1);
}

/**
 * Geometry reads wait for the card's entry animation (token-timed opacity and offset) to finish,
 * so they measure its resting box rather than a frame mid-translation. Reduced motion has none.
 */
async function settled(card: HTMLElement) {
  await Promise.all(card.getAnimations().map((animation) => animation.finished));
  return card;
}

/** Tooltip contract: never focusable and no interactive descendants. */
async function expectReadOnly(card: HTMLElement) {
  await expect(card).toHaveAttribute('role', 'tooltip');
  await expect(card).not.toHaveAttribute('tabindex');
  await expect(card.querySelectorAll('a, button, input, select, textarea, [tabindex], [contenteditable]')).toHaveLength(0);
}

/** The first argument of every call to a spy arg, in order. */
const callValues = (spy: unknown) => (spy as Mock).mock.calls.map(([value]) => value);

/**
 * Collects `defaultPrevented` for every click once the page's own handlers ran (React listens
 * below the document), then cancels it so the test page is not navigated away.
 */
function recordClicks(document: Document) {
  const seen: boolean[] = [];
  const listener = (event: Event) => {
    seen.push(event.defaultPrevented);
    event.preventDefault();
  };
  document.addEventListener('click', listener);
  return { seen, stop: () => document.removeEventListener('click', listener) };
}

export const Default: Story = {
  render: (args) => <ProfileExample {...args} />,
  play: async ({ canvasElement, userEvent }) => {
    const trigger = getTrigger(canvasElement);
    await expect(triggerRef).toHaveBeenCalledWith(trigger);

    await userEvent.hover(trigger);
    // The open delay applies to hover: nothing is shown before it elapses.
    await sleep(OPEN_DELAY - TIMER_MARGIN);
    await expect(queryCards(canvasElement)).toHaveLength(0);

    const card = await expectOpenWithin(canvasElement, TIMER_MARGIN * 3);
    await expect(contentRef).toHaveBeenCalledWith(card);
    await expect(canvasElement.contains(card)).toBe(false);
    await expect(card).toHaveAttribute('data-ui', 'hover-card');
    await expect(trigger).toHaveAttribute('aria-describedby', card.id);
    await expect(trigger).toHaveAccessibleName(TRIGGER);
    await expectReadOnly(card);

    // Hoverable per WCAG 1.4.13: the pointer may rest on the card past the close delay.
    await userEvent.hover(card);
    await sleep(CLOSE_DELAY + TIMER_MARGIN);
    await expect(card).toBeVisible();

    await userEvent.unhover(card);
    await expectClosed(canvasElement);
    await expect(trigger).not.toHaveAttribute('aria-describedby');
  },
};

const PROFILE_SLOTS = ['avatar', 'identity', 'bio', 'stats', 'meta'] as const;

/** Native description hooks every Profile slot forwards to its element. */
const slotHooks = (slot: (typeof PROFILE_SLOTS)[number]) => ({
  id: `probe-${slot}-id`,
  'aria-describedby': 'profile-note',
  title: `${slot} title`,
});

export const HoverBridge: Story = {
  args: { onOpenChange: fn() },
  render: (args) => <ProfileExample {...args} />,
  play: async ({ args, canvasElement, userEvent }) => {
    const document = canvasElement.ownerDocument;
    const trigger = getTrigger(canvasElement);
    await userEvent.hover(trigger);
    const card = await settled(await expectOpenWithin(canvasElement, OPEN_DELAY + TIMER_MARGIN * 3));
    const t = trigger.getBoundingClientRect();
    const c = card.getBoundingClientRect();
    await expect(c.top).toBeGreaterThan(t.bottom + SUBPIXEL);

    // Walk straight down from the trigger, through the empty offset gap, onto the card.
    const x = Math.max(t.left, c.left) + 4;
    const point = (y: number) => ({ target: document.elementFromPoint(x, y)!, coords: { clientX: x, clientY: y } });
    const gapY = (t.bottom + c.top) / 2;
    await userEvent.pointer([point(t.bottom - 2), point(gapY)]);
    await expect(point(gapY).target).not.toBe(trigger);
    await expect(card.contains(point(gapY).target)).toBe(false);
    // Resting in the gap past the close delay keeps the card open.
    await sleep(CLOSE_DELAY + TIMER_MARGIN);
    await expect(card).toBeVisible();

    await userEvent.pointer(point(c.top + 8));
    await sleep(CLOSE_DELAY + TIMER_MARGIN);
    await expect(card).toBeVisible();
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(true);
  },
};

// Nondefault timings, apart from the defaults and from each other.
const SLOW_OPEN = 900;
const SLOW_CLOSE = 600;

export const CustomDelays: Story = {
  args: { onOpenChange: fn(), openDelay: SLOW_OPEN, closeDelay: SLOW_CLOSE },
  render: (args) => <ProfileExample {...args} />,
  play: async ({ args, canvasElement, userEvent }) => {
    const trigger = getTrigger(canvasElement);
    await userEvent.hover(trigger);
    // Past the default open delay but before the configured one: still closed.
    await sleep(SLOW_OPEN - TIMER_MARGIN);
    await expect(queryCards(canvasElement)).toHaveLength(0);
    await expectOpenWithin(canvasElement, TIMER_MARGIN * 3);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);

    // Past the default close delay but before the configured one: still open.
    await userEvent.unhover(trigger);
    await sleep(SLOW_CLOSE - TIMER_MARGIN);
    await expect(queryCards(canvasElement)).toHaveLength(1);
    await expectClosed(canvasElement);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(2);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);
  },
};

export const Profile: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: vars.space[3] }}>
      <HoverCard.Profile
        {...PROFILE}
        className="probe-profile"
        css={{ rowGap: '10px' }}
        sx={{ rowGap: '14px' }}
        slotProps={{
          avatar: { ...slotHooks('avatar'), className: 'probe-avatar', css: { paddingInlineEnd: '3px' } },
          identity: { ...slotHooks('identity'), className: 'probe-identity', css: { letterSpacing: '1px' } },
          bio: { ...slotHooks('bio'), className: 'probe-bio', css: { fontStyle: 'italic' } },
          stats: { ...slotHooks('stats'), className: 'probe-stats', css: { columnGap: '30px' } },
          meta: { ...slotHooks('meta'), className: 'probe-meta', css: { textDecorationLine: 'underline' } },
        }}
      />
      <span id="profile-note">From the review thread</span>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const profile = canvasElement.querySelector<HTMLElement>('[data-ui="hover-card-profile"]')!;
    const part = (name: string) => profile.querySelector<HTMLElement>(`.probe-${name}`)!;
    // Native attributes reach each slot's own element.
    for (const slot of PROFILE_SLOTS) {
      const hooks = slotHooks(slot);
      await expect(part(slot)).toHaveAttribute('id', hooks.id);
      await expect(part(slot)).toHaveAttribute('aria-describedby', hooks['aria-describedby']);
      await expect(part(slot)).toHaveAttribute('title', hooks.title);
    }
    await expect(part('bio')).toHaveAccessibleDescription('From the review thread');
    await expect(part('stats').tagName).toBe('DL');
    await expect(profile).toHaveClass('probe-profile');
    // Own styles → consumer css → sx.
    await expect(getComputedStyle(profile).rowGap).toBe('14px');
    await expect(getComputedStyle(part('avatar')).paddingInlineEnd).toBe('3px');
    await expect(getComputedStyle(part('identity')).letterSpacing).toBe('1px');
    await expect(getComputedStyle(part('bio')).fontStyle).toBe('italic');
    await expect(getComputedStyle(part('stats')).columnGap).toBe('30px');
    await expect(getComputedStyle(part('meta')).textDecorationLine).toBe('underline');

    // One identity announcement: the avatar is decorative beside the visible name.
    await expect(part('avatar')).toHaveAttribute('aria-hidden', 'true');
    await expect(within(profile).queryByRole('img')).toBeNull();
    await expect(within(profile).getAllByText(PROFILE.name)).toHaveLength(1);
  },
};

export const CustomPreview: Story = {
  args: { defaultOpen: true },
  render: (args) => (
    <HoverCard {...args}>
      <HoverCard.Trigger>v4.2</HoverCard.Trigger>
      <HoverCard.Content>
        <strong>Release 4.2</strong>
        <div>18 changes merged, 2 pending review.</div>
      </HoverCard.Content>
    </HoverCard>
  ),
  play: async ({ canvasElement }) => {
    const card = await findCard(canvasElement);
    await expect(card).toHaveTextContent('Release 4.2');
    await expectReadOnly(card);
    await expect(getTrigger(canvasElement, 'v4.2')).toHaveAccessibleDescription(
      'Release 4.2 18 changes merged, 2 pending review.',
    );
  },
};

const PLACEMENTS = ['top-start', 'right', 'bottom-end', 'left'] as const;

export const AllPlacements: Story = {
  render: (args) => (
    <div style={placementGridStyle}>
      {PLACEMENTS.map((placement) => (
        <HoverCard key={placement} {...args} placement={placement}>
          <HoverCard.Trigger>{placement}</HoverCard.Trigger>
          <HoverCard.Content>
            <HoverCard.Profile name="Maya Chen" subtitle={placement} />
          </HoverCard.Content>
        </HoverCard>
      ))}
    </div>
  ),
  play: async ({ canvasElement, userEvent }) => {
    for (const placement of PLACEMENTS) {
      await userEvent.tab();
      const trigger = getTrigger(canvasElement, placement);
      await expect(canvasElement.ownerDocument.activeElement).toBe(trigger);
      const card = await settled(await expectOpenWithin(canvasElement, IMMEDIATE));
      // Flip may change the side near viewport edges; the resolved side must match geometry.
      const side = card.dataset.side;
      const t = trigger.getBoundingClientRect();
      const c = card.getBoundingClientRect();
      const gaps: Record<string, number> = {
        top: t.top - c.bottom,
        bottom: c.top - t.bottom,
        left: t.left - c.right,
        right: c.left - t.right,
      };
      await expect(gaps[side!]).toBeGreaterThan(SUBPIXEL);
    }
    await userEvent.keyboard('{Escape}');
    await expectClosed(canvasElement);
  },
};

const MEMBERS = [
  { value: 'maya', name: 'Maya Chen' },
  { value: 'leo', name: 'Leo Park' },
  { value: 'ana', name: 'Ana Ruiz' },
] as const;

function GroupExample({ members = MEMBERS, ...props }: HoverCardGroupProps & { members?: typeof MEMBERS }) {
  return (
    <HoverCard.Group {...props}>
      <div style={rowStyle}>
        {members.map((member) => (
          <HoverCard key={member.value} value={member.value}>
            <HoverCard.Trigger>{`@${member.value}`}</HoverCard.Trigger>
            <HoverCard.Content>
              <HoverCard.Profile name={member.name} subtitle="Platform team" />
            </HoverCard.Content>
          </HoverCard>
        ))}
      </div>
    </HoverCard.Group>
  );
}
GroupExample.displayName = 'GroupExample';

type GroupStory = StoryObj<HoverCardGroupProps>;

export const GroupWarmTraversal: GroupStory = {
  args: { onValueChange: fn() },
  render: (args) => <GroupExample {...args} />,
  play: async ({ args, canvasElement, userEvent }) => {
    const [maya, leo, ana] = ['@maya', '@leo', '@ana'].map((name) => getTrigger(canvasElement, name)) as [
      HTMLElement,
      HTMLElement,
      HTMLElement,
    ];

    // Cold: the full open delay.
    await userEvent.hover(maya);
    await sleep(OPEN_DELAY - TIMER_MARGIN);
    await expect(queryCards(canvasElement)).toHaveLength(0);
    const first = await expectOpenWithin(canvasElement, TIMER_MARGIN * 3);
    await expect(first).toHaveTextContent('Maya Chen');
    await expect(first).toHaveAttribute('data-entry', 'cold');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('maya');

    // Warm (a card is open): the next member swaps in after the intent delay, one card at a time.
    await userEvent.hover(leo);
    await waitFor(() => expect(queryCards(canvasElement)[0]!).toHaveTextContent('Leo Park'), {
      timeout: INTENT_DELAY + TIMER_MARGIN * 2,
    });
    await expect(queryCards(canvasElement)).toHaveLength(1);
    await expect(queryCards(canvasElement)[0]!).toHaveAttribute('data-entry', 'warm');
    await expect(args.onValueChange).toHaveBeenLastCalledWith('leo');
    await expect(maya).not.toHaveAttribute('aria-describedby');

    // Warm (closed less than skipDelay ago): still the intent delay.
    await userEvent.unhover(leo);
    await expectClosed(canvasElement);
    await expect(args.onValueChange).toHaveBeenLastCalledWith(null);
    await userEvent.hover(ana);
    const third = await expectOpenWithin(canvasElement, INTENT_DELAY + TIMER_MARGIN * 2);
    await expect(third).toHaveTextContent('Ana Ruiz');

    // Cold again once the warm period has passed.
    await userEvent.unhover(ana);
    await expectClosed(canvasElement);
    await sleep(SKIP_DELAY + TIMER_MARGIN);
    await userEvent.hover(maya);
    await sleep(OPEN_DELAY - TIMER_MARGIN);
    await expect(queryCards(canvasElement)).toHaveLength(0);
    await expectOpenWithin(canvasElement, TIMER_MARGIN * 3);
    await expect(args.onValueChange).toHaveBeenCalledTimes(6);
    await expect(callValues(args.onValueChange)).toEqual(['maya', 'leo', null, 'ana', null, 'maya']);
  },
};

export const GroupPersistentMember: GroupStory = {
  args: { defaultValue: 'leo' },
  render: (args) => <GroupExample {...args} />,
  play: async ({ canvasElement }) => {
    // Persistent open member so the axe gate sees a grouped card.
    const card = await findCard(canvasElement);
    await expect(queryCards(canvasElement)).toHaveLength(1);
    await expect(card).toHaveTextContent('Leo Park');
    await expect(getTrigger(canvasElement, '@leo')).toHaveAttribute('aria-describedby', card.id);
  },
};

export const GroupControlledReject: GroupStory = {
  args: { value: 'maya', onValueChange: fn() },
  render: (args) => <GroupExample {...args} />,
  play: async ({ args, canvasElement, userEvent }) => {
    await expect((await findCard(canvasElement)).textContent).toContain('Maya Chen');
    await userEvent.tab();
    await userEvent.tab();
    const leo = getTrigger(canvasElement, '@leo');
    await expectFocus(leo);
    await waitFor(() => expect(args.onValueChange).toHaveBeenCalledWith('leo'));
    // The parent kept `maya`: Maya's card stays, Leo's never mounts, focus does not move.
    await sleep(TIMER_MARGIN);
    await expect(queryCards(canvasElement)).toHaveLength(1);
    await expect(queryCards(canvasElement)[0]!).toHaveTextContent('Maya Chen');
    await expect(leo).not.toHaveAttribute('aria-describedby');
    await expect(callValues(args.onValueChange).filter((value) => value === 'leo')).toHaveLength(1);
    await expect(canvasElement.ownerDocument.activeElement).toBe(leo);
  },
};

const ISOLATED_MEMBERS = [
  { value: '', name: 'Maya Chen' },
  { value: 'leo', name: 'Leo Park' },
] as unknown as typeof MEMBERS;

export const GroupIsolation: GroupStory = {
  render: () => (
    <div style={{ ...rowStyle, columnGap: '22rem' }}>
      <GroupExample members={ISOLATED_MEMBERS} defaultValue="" />
      <GroupExample members={MEMBERS.slice(2) as unknown as typeof MEMBERS} defaultValue="ana" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    // Each provider owns its own member: an empty-string id is a real member, and two groups
    // keep one card each.
    await waitFor(() => expect(queryCards(canvasElement)).toHaveLength(2));
    const texts = queryCards(canvasElement).map((card) => card.textContent);
    await expect(texts.some((text) => text?.includes('Maya Chen'))).toBe(true);
    await expect(texts.some((text) => text?.includes('Ana Ruiz'))).toBe(true);
  },
};

function UnmountGroupExample(props: HoverCardGroupProps) {
  const [members, setMembers] = useState<typeof MEMBERS>(MEMBERS);
  return (
    <>
      <GroupExample {...props} members={members} />
      <button
        type="button"
        style={FIXTURE_BUTTON}
        onClick={() => setMembers(MEMBERS.slice(1) as unknown as typeof MEMBERS)}
      >
        Remove Maya
      </button>
    </>
  );
}
UnmountGroupExample.displayName = 'UnmountGroupExample';

export const GroupMemberUnmount: GroupStory = {
  args: { defaultValue: 'maya', onValueChange: fn() },
  render: (args) => <UnmountGroupExample {...args} />,
  play: async ({ args, canvasElement }) => {
    await findCard(canvasElement);
    await expect(args.onValueChange).not.toHaveBeenCalled();
    // fireEvent keeps the pointer where it is: removal alone must clear the active member.
    fireEvent.click(within(canvasElement).getByRole('button', { name: 'Remove Maya' }));
    await expectClosed(canvasElement);
    await waitFor(() => expect(args.onValueChange).toHaveBeenCalledTimes(1));
    await expect(args.onValueChange).toHaveBeenLastCalledWith(null);
  },
};

function UnmountExample(props: HoverCardProps) {
  const [mounted, setMounted] = useState(true);
  return (
    <div style={rowStyle}>
      {mounted && (
        <HoverCard {...props}>
          <HoverCard.Trigger>{TRIGGER}</HoverCard.Trigger>
          <HoverCard.Content>
            <HoverCard.Profile {...PROFILE} />
          </HoverCard.Content>
        </HoverCard>
      )}
      <button type="button" style={FIXTURE_BUTTON} onClick={() => setMounted(false)}>
        Remove
      </button>
    </div>
  );
}
UnmountExample.displayName = 'UnmountExample';

export const PendingTimerCleanup: Story = {
  args: { onOpenChange: fn() },
  render: (args) => <UnmountExample {...args} />,
  play: async ({ args, canvasElement, userEvent }) => {
    await userEvent.hover(getTrigger(canvasElement));
    fireEvent.click(within(canvasElement).getByRole('button', { name: 'Remove' }));
    await sleep(OPEN_DELAY + TIMER_MARGIN);
    await expect(queryCards(canvasElement)).toHaveLength(0);
    await expect(args.onOpenChange).not.toHaveBeenCalled();
  },
};

export const LinkTrigger: Story = {
  args: { onOpenChange: fn() },
  render: (args) => (
    <div data-testid="prose">
      Reviewed by{' '}
      <HoverCard {...args}>
        <HoverCard.Trigger
          ref={linkRef}
          // Block padding on an inline box grows its hit area without growing the line box.
          sx={{ paddingBlock: vars.space[1] }}
          render={(props) => (
            <a {...props} href="#maya-profile">
              {TRIGGER}
            </a>
          )}
        />
        <HoverCard.Content>
          <HoverCard.Profile {...PROFILE} />
        </HoverCard.Content>
      </HoverCard>{' '}
      yesterday.
    </div>
  ),
  play: async ({ args, canvasElement, userEvent }) => {
    const link = within(canvasElement).getByRole('link', { name: TRIGGER });
    await expect(linkRef).toHaveBeenCalledWith(link);
    await expect(link).toHaveAttribute('data-ui', 'hover-card-trigger');
    const target = link.getBoundingClientRect();
    await expect(target.width).toBeGreaterThanOrEqual(TARGET_MIN);
    await expect(target.height).toBeGreaterThanOrEqual(TARGET_MIN);
    // The padded hit area overflows the prose line instead of pushing it taller.
    await expect(within(canvasElement).getByTestId('prose').getBoundingClientRect().height).toBeLessThan(
      target.height - SUBPIXEL,
    );
    const clicks = recordClicks(canvasElement.ownerDocument);
    try {
      // A click opens the card at once; the card never prevents the link's navigation.
      await userEvent.click(link);
      await expectOpenWithin(canvasElement, IMMEDIATE);
      await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
      await expect(clicks.seen).toEqual([false]);

      await userEvent.keyboard('{Escape}');
      await expectClosed(canvasElement);

      // Enter on the focused link: native activation, never prevented, and it reopens once.
      await expect(canvasElement.ownerDocument.activeElement).toBe(link);
      await userEvent.keyboard('{Enter}');
      await expect(clicks.seen).toEqual([false, false]);
      await expectOpenWithin(canvasElement, IMMEDIATE);
      await expect(args.onOpenChange).toHaveBeenCalledTimes(3);
    } finally {
      clicks.stop();
    }
  },
};

export const TouchButton: Story = {
  args: { onOpenChange: fn() },
  render: (args) => <ProfileExample {...args} />,
  play: async ({ args, canvasElement, userEvent }) => {
    const trigger = getTrigger(canvasElement);
    await userEvent.pointer({ keys: '[TouchA]', target: trigger });
    await expectOpenWithin(canvasElement, IMMEDIATE);
    // No emulated-hover open on top of the tap.
    await sleep(OPEN_DELAY + TIMER_MARGIN);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(true);

    await userEvent.pointer({ keys: '[TouchA]', target: trigger });
    await expectClosed(canvasElement);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(2);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);
  },
};

export const KeyboardNavigation: Story = {
  args: { onOpenChange: fn() },
  render: (args) => <ProfileExample {...args} />,
  play: async ({ args, canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    const trigger = getTrigger(canvasElement);
    const before = canvas.getByRole('button', { name: 'Before' });
    const next = canvas.getByRole('button', { name: 'Next' });

    await userEvent.tab();
    await userEvent.tab();
    await expectFocus(trigger);
    const card = await expectOpenWithin(canvasElement, IMMEDIATE);
    await expect(trigger).toHaveAttribute('aria-describedby', card.id);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);

    // The pointer leaving does not close a card that keyboard focus keeps open.
    await userEvent.hover(trigger);
    await userEvent.unhover(trigger);
    await sleep(CLOSE_DELAY + TIMER_MARGIN);
    await expect(queryCards(canvasElement)).toHaveLength(1);

    // Enter on an open card and arrow keys request nothing.
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard('{ArrowDown}{End}');
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(canvasElement.ownerDocument.activeElement).toBe(trigger);

    // Escape closes, keeps focus, and nothing reopens it while focus stays.
    await userEvent.keyboard('{Escape}');
    await expectClosed(canvasElement);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(2);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);
    await expectFocus(trigger);
    await sleep(OPEN_DELAY + TIMER_MARGIN);
    await expect(queryCards(canvasElement)).toHaveLength(0);

    // Enter and Space reopen through native activation, once each.
    await userEvent.keyboard('{Enter}');
    await expectOpenWithin(canvasElement, IMMEDIATE);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(3);
    await userEvent.keyboard('{Escape}');
    await expectClosed(canvasElement);
    await userEvent.keyboard(' ');
    await expectOpenWithin(canvasElement, IMMEDIATE);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(5);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(true);

    // Shift+Tab away closes without pulling focus back.
    await userEvent.tab({ shift: true });
    await expectClosed(canvasElement);
    await expectFocus(before);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(6);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);

    // Tab back in reopens; Tab out lands on the next control.
    await userEvent.tab();
    await expectOpenWithin(canvasElement, IMMEDIATE);
    await userEvent.tab();
    await expectClosed(canvasElement);
    await expectFocus(next);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(8);
  },
};

export const EscapeWhileHovered: Story = {
  args: { onOpenChange: fn() },
  render: (args) => <ProfileExample {...args} />,
  play: async ({ args, canvasElement, userEvent }) => {
    const trigger = getTrigger(canvasElement);
    await userEvent.hover(trigger);
    await expectOpenWithin(canvasElement, OPEN_DELAY + TIMER_MARGIN * 3);
    await userEvent.keyboard('{Escape}');
    await expectClosed(canvasElement);

    // The pointer still rests on the trigger: no reopen.
    await sleep(OPEN_DELAY + TIMER_MARGIN);
    await expect(queryCards(canvasElement)).toHaveLength(0);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(2);

    // Leaving and re-entering recovers.
    await userEvent.unhover(trigger);
    await userEvent.hover(trigger);
    await expectOpenWithin(canvasElement, OPEN_DELAY + TIMER_MARGIN * 3);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(3);
  },
};

export const OutsidePress: Story = {
  render: (args) => <ProfileExample {...args} />,
  play: async ({ canvasElement, userEvent }) => {
    await userEvent.tab();
    await userEvent.tab();
    await expectOpenWithin(canvasElement, IMMEDIATE);
    const next = within(canvasElement).getByRole('button', { name: 'Next' });
    await userEvent.click(next);
    await expectClosed(canvasElement);
    // The pressed control keeps the focus it received.
    await expect(canvasElement.ownerDocument.activeElement).toBe(next);
  },
};

const popoverOpenChange = fn<(open: boolean) => void>();

function PopoverHost(props: HoverCardProps) {
  return (
    <div style={rowStyle}>
      <Popover defaultOpen onOpenChange={popoverOpenChange}>
        <Popover.Trigger>Review</Popover.Trigger>
        <Popover.Content aria-label="Review">
          <div style={rowStyle}>
            <span>Requested by</span>
            <HoverCard {...props}>
              <HoverCard.Trigger>{TRIGGER}</HoverCard.Trigger>
              <HoverCard.Content>
                <HoverCard.Profile {...PROFILE} />
              </HoverCard.Content>
            </HoverCard>
            <Button>Approve</Button>
          </div>
        </Popover.Content>
      </Popover>
      <Button>Outside</Button>
    </div>
  );
}
PopoverHost.displayName = 'PopoverHost';

/** Both layers open, keyboard focus inside the popover but away from the card's trigger. */
async function openNestedLayers(canvasElement: HTMLElement) {
  popoverOpenChange.mockClear();
  const body = bodyOf(canvasElement);
  const popover = await body.findByRole('dialog', { name: 'Review' });
  await findCard(canvasElement);
  const approve = within(popover).getByRole('button', { name: 'Approve' });
  approve.focus();
  await expect(canvasElement.ownerDocument.activeElement).toBe(approve);
  return { popover, approve };
}

export const InsidePopoverEscape: Story = {
  args: { defaultOpen: true, onOpenChange: fn() },
  render: (args) => <PopoverHost {...args} />,
  play: async ({ args, canvasElement, userEvent }) => {
    const { popover, approve } = await openNestedLayers(canvasElement);

    // The first Escape belongs to the topmost layer: only the card closes.
    await userEvent.keyboard('{Escape}');
    await expectClosed(canvasElement);
    await expect(callValues(args.onOpenChange)).toEqual([false]);
    await expect(popoverOpenChange).not.toHaveBeenCalled();
    await expect(popover).toBeVisible();
    await expect(canvasElement.ownerDocument.activeElement).toBe(approve);

    // The next Escape reaches the popover.
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(bodyOf(canvasElement).queryByRole('dialog')).toBeNull());
    await expect(callValues(popoverOpenChange)).toEqual([false]);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
  },
};

export const InsidePopoverOutsidePress: Story = {
  args: { defaultOpen: true, onOpenChange: fn() },
  render: (args) => <PopoverHost {...args} />,
  play: async ({ args, canvasElement, userEvent }) => {
    const { popover } = await openNestedLayers(canvasElement);
    const outside = within(canvasElement).getByRole('button', { name: 'Outside' });

    // A press on the card is inside both layers: neither closes.
    await userEvent.click(await findCard(canvasElement));
    await expect(queryCards(canvasElement)).toHaveLength(1);
    await expect(args.onOpenChange).not.toHaveBeenCalled();
    await expect(popoverOpenChange).not.toHaveBeenCalled();

    // The first outside press belongs to the topmost layer: only the card closes.
    await userEvent.click(outside);
    await expectClosed(canvasElement);
    await expect(callValues(args.onOpenChange)).toEqual([false]);
    await expect(popoverOpenChange).not.toHaveBeenCalled();
    await expect(popover).toBeVisible();

    // The next outside press reaches the popover.
    await userEvent.click(outside);
    await waitFor(() => expect(bodyOf(canvasElement).queryByRole('dialog')).toBeNull());
    await expect(callValues(popoverOpenChange)).toEqual([false]);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
  },
};

function ControlledRejectExample(props: HoverCardProps) {
  const [open, setOpen] = useState(true);
  return (
    <div style={rowStyle}>
      <HoverCard {...props} open={open}>
        <HoverCard.Trigger aria-describedby="maya-note">{TRIGGER}</HoverCard.Trigger>
        <HoverCard.Content>
          <HoverCard.Profile {...PROFILE} />
        </HoverCard.Content>
      </HoverCard>
      <span id="maya-note">Mentioned in review</span>
      <Button onClick={() => setOpen(false)}>Hide preview</Button>
    </div>
  );
}
ControlledRejectExample.displayName = 'ControlledRejectExample';

export const ControlledReject: Story = {
  args: { onOpenChange: fn() },
  render: (args) => <ControlledRejectExample {...args} />,
  play: async ({ args, canvasElement, userEvent }) => {
    const trigger = getTrigger(canvasElement);
    // Visibility reads include opacity, so they wait for the entry animation.
    const card = await settled(await findCard(canvasElement));
    // Mounting open and focusing an open card request nothing.
    await userEvent.tab();
    await expectFocus(trigger);
    await expect(args.onOpenChange).not.toHaveBeenCalled();

    // Rejected Escape: one request, the card and merged description stay, focus stays.
    await userEvent.keyboard('{Escape}');
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);
    await expect(card).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-describedby', `maya-note ${card.id}`);
    await expect(canvasElement.ownerDocument.activeElement).toBe(trigger);

    // Rejected blur: focus moves on and is not pulled back.
    const hide = within(canvasElement).getByRole('button', { name: 'Hide preview' });
    await userEvent.tab();
    await waitFor(() => expect(args.onOpenChange).toHaveBeenCalledTimes(2));
    await expect(card).toBeVisible();
    await expectFocus(hide);

    // The parent closes it: no extra callback for an accepted prop update.
    await userEvent.keyboard('{Enter}');
    await expectClosed(canvasElement);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(2);
    await expect(trigger).toHaveAttribute('aria-describedby', 'maya-note');
  },
};

export const ExternalARIA: Story = {
  render: (args) => (
    <div style={rowStyle}>
      <span id="maya-label">Maya Chen profile</span>
      <HoverCard {...args}>
        <HoverCard.Trigger aria-labelledby="maya-label" aria-describedby="maya-note missing-note">
          {TRIGGER}
        </HoverCard.Trigger>
        <HoverCard.Content aria-describedby="maya-note">
          <HoverCard.Profile {...PROFILE} aria-describedby="maya-note" />
        </HoverCard.Content>
      </HoverCard>
      <span id="maya-note">Mentioned in review</span>
    </div>
  ),
  play: async ({ canvasElement, userEvent }) => {
    const trigger = within(canvasElement).getByRole('button', { name: 'Maya Chen profile' });
    await userEvent.tab();
    const card = await expectOpenWithin(canvasElement, IMMEDIATE);
    // Consumer ids (including an unresolved one) are kept and joined with the card's id.
    await expect(trigger).toHaveAttribute('aria-describedby', `maya-note missing-note ${card.id}`);
    await expect(trigger).toHaveAttribute('aria-labelledby', 'maya-label');
    await expect(trigger).toHaveAccessibleName('Maya Chen profile');
    await expect(card).toHaveAttribute('aria-describedby', 'maya-note');
    await expect(card.querySelector('[data-ui="hover-card-profile"]')).toHaveAttribute('aria-describedby', 'maya-note');

    await userEvent.keyboard('{Escape}');
    await expectClosed(canvasElement);
    await expect(trigger).toHaveAttribute('aria-describedby', 'maya-note missing-note');
    await expect(trigger).toHaveAttribute('aria-labelledby', 'maya-label');
  },
};

const FALSY_NODES = [false, null, 0, ''] as const;

export const FalsyMeta: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: vars.space[6] }}>
      {FALSY_NODES.map((value) => (
        <HoverCard.Profile
          key={String(value)}
          name="Maya Chen"
          subtitle={value}
          bio={value}
          meta={value}
          avatar={value}
          stats={[{ id: 'zero', label: 'Open reviews', value: 0 }]}
          data-falsy={String(value)}
          slotProps={{
            avatar: { className: 'probe-avatar' },
            identity: { className: 'probe-identity' },
            bio: { className: 'probe-bio' },
            meta: { className: 'probe-meta' },
          }}
        />
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const profile = (value: string) => canvasElement.querySelector<HTMLElement>(`[data-falsy="${value}"]`)!;
    for (const value of ['false', 'null']) {
      const root = profile(value);
      // Nothing renders: no wrappers, and the default Avatar stands in for the avatar.
      await expect(root.querySelector('.probe-bio')).toBeNull();
      await expect(root.querySelector('.probe-meta')).toBeNull();
      await expect(root.querySelector('.probe-identity')!.children).toHaveLength(1);
      await expect(root.querySelector('.probe-avatar [data-ui="avatar"]')).not.toBeNull();
    }
    // 0 is content: subtitle, bio, meta and the custom avatar all render it.
    const zero = profile('0');
    await expect(zero.querySelector('.probe-bio')).toHaveTextContent('0');
    await expect(zero.querySelector('.probe-meta')).toHaveTextContent('0');
    await expect(zero.querySelector('.probe-identity')!.children).toHaveLength(2);
    await expect(zero.querySelector('.probe-avatar')).toHaveTextContent('0');
    await expect(zero.querySelector('.probe-avatar [data-ui="avatar"]')).toBeNull();
    // '' renders like any other string (empty wrappers), consistent with the library's slots.
    const empty = profile('');
    await expect(empty.querySelector('.probe-bio')).toHaveTextContent('');
    await expect(empty.querySelector('.probe-avatar [data-ui="avatar"]')).toBeNull();
    // A zero stat renders as a formatted 0 in every profile.
    for (const value of ['false', 'null', '0', '']) {
      await expect(profile(value).querySelector('dd')).toHaveTextContent(new Intl.NumberFormat().format(0));
    }
  },
};

export const BrokenAvatar: Story = {
  render: () => <HoverCard.Profile {...PROFILE} src="data:image/png;base64,AAAA" />,
  play: async ({ canvasElement }) => {
    const profile = canvasElement.querySelector<HTMLElement>('[data-ui="hover-card-profile"]')!;
    // The failed image falls back to initials; the name is still announced once.
    await waitFor(() => expect(profile.querySelector('img')).toBeNull());
    await expect(profile.querySelector('[data-ui="avatar"]')).toHaveTextContent('MC');
    await expect(within(profile).queryByRole('img')).toBeNull();
    await expect(within(profile).getAllByText(PROFILE.name)).toHaveLength(1);
  },
};

const LONG_NAME = 'Maximiliana Alexandrina Montgomery-Featherstonehaugh de la Vega y Castellanos';

export const LongIdentity: Story = {
  args: { defaultOpen: true },
  render: (args) => (
    <HoverCard {...args}>
      <HoverCard.Trigger>@maximiliana</HoverCard.Trigger>
      <HoverCard.Content>
        <HoverCard.Profile
          name={LONG_NAME}
          subtitle="Principal accessibility engineer, Design Systems and Developer Experience"
          stats={[
            { id: 'contributions', label: 'Contributions this quarter', value: 1234567 },
            { id: 'reviews', label: 'Reviews', value: 98765 },
            { id: 'teams', label: 'Teams', value: 12 },
          ]}
        />
      </HoverCard.Content>
    </HoverCard>
  ),
  play: async ({ canvasElement }) => {
    const card = await settled(await findCard(canvasElement));
    const cardRect = card.getBoundingClientRect();
    const rootFontSize = parseFloat(getComputedStyle(card.ownerDocument.documentElement).fontSize);
    await expect(cardRect.width).toBeLessThanOrEqual(18.5 * rootFontSize + SUBPIXEL);
    // Long identity and formatted stats wrap inside the card instead of overflowing it.
    for (const element of [within(card).getByText(LONG_NAME), ...card.querySelectorAll('dd')]) {
      const rect = element.getBoundingClientRect();
      await expect(rect.left).toBeGreaterThanOrEqual(cardRect.left - SUBPIXEL);
      await expect(rect.right).toBeLessThanOrEqual(cardRect.right + SUBPIXEL);
    }
  },
};

const LOCALES = ['de-DE', 'ar-EG', 'en-IN'] as const;
const LOCALIZED_STATS: HoverCardStat[] = [
  { id: 'reviews', label: 'Reviews', value: 1234567 },
  { id: 'ratio', label: 'Approval', value: 0.5 },
  { id: 'stars', label: 'Stars', value: '1.2k' },
];

export const LocalizedStats: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: vars.space[6] }}>
      {LOCALES.map((locale) => (
        <HoverCard.Profile key={locale} name="Maya Chen" locale={locale} stats={LOCALIZED_STATS} data-locale={locale} />
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    for (const locale of LOCALES) {
      const profile = canvasElement.querySelector<HTMLElement>(`[data-locale="${locale}"]`)!;
      const dl = profile.querySelector('dl')!;
      const rows = Array.from(dl.children);
      await expect(rows).toHaveLength(LOCALIZED_STATS.length);
      for (const [index, stat] of LOCALIZED_STATS.entries()) {
        const [dt, dd] = Array.from(rows[index]!.children) as [Element, Element];
        // dt then dd in DOM order.
        await expect(dt.tagName).toBe('DT');
        await expect(dd.tagName).toBe('DD');
        await expect(dt).toHaveTextContent(String(stat.label));
        // Numbers go through Intl; strings are preformatted and stay as given.
        const expected =
          typeof stat.value === 'number' ? new Intl.NumberFormat(locale).format(stat.value) : stat.value;
        await expect(dd.textContent).toBe(expected);
        await expect(dd.getBoundingClientRect().right).toBeLessThanOrEqual(dl.getBoundingClientRect().right + SUBPIXEL);
      }
    }
  },
};

export const PersistentOpen: Story = {
  args: { defaultOpen: true },
  render: (args) => <ProfileExample {...args} />,
  play: async ({ canvasElement }) => {
    // Persistent open state so the axe gate sees the portaled card.
    const card = await findCard(canvasElement);
    await expect(getTrigger(canvasElement)).toHaveAttribute('aria-describedby', card.id);
    await expectThemedSurface(card, 'dark');
  },
};

export const PersistentOpenLight: Story = {
  decorators: [withLightTheme],
  args: { defaultOpen: true },
  render: (args) => <ProfileExample {...args} />,
  play: async ({ canvasElement }) => {
    const card = await findCard(canvasElement);
    await expect(canvasElement.contains(card)).toBe(false);
    await expectThemedSurface(card, 'light');
  },
};

export const LightTheme: Story = {
  decorators: [withLightTheme],
  render: (args) => <ProfileExample {...args} before={false} />,
  play: async ({ canvasElement, userEvent }) => {
    await userEvent.tab();
    await expectFocus(getTrigger(canvasElement));
    const card = await expectOpenWithin(canvasElement, IMMEDIATE);
    await expectThemedSurface(card, 'light');
    await userEvent.keyboard('{Escape}');
    await expectClosed(canvasElement);
  },
};

function ScopedHost({ children }: { children: ReactNode }) {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  return (
    <ThemeRoot theme="light" portalContainer={host} style={{ padding: vars.space[4], backgroundColor: vars.color.bg }}>
      {children}
      <div ref={setHost} data-overlay-host="" />
    </ThemeRoot>
  );
}
ScopedHost.displayName = 'ScopedHost';

export const ScopedThemePortal: Story = {
  args: { defaultOpen: true },
  render: (args) => (
    <ScopedHost>
      <ProfileExample {...args} />
    </ScopedHost>
  ),
  play: async ({ canvasElement }) => {
    const card = await findCard(canvasElement);
    // Portaled into the scope's host, keeping the nearest scope's theme and appearance.
    await expect(canvasElement.querySelector('[data-overlay-host]')!.contains(card)).toBe(true);
    await expectThemedSurface(card, 'light');
  },
};

function DialogHost(props: HoverCardProps) {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  return (
    <Dialog defaultOpen>
      <Dialog.Content>
        <Dialog.Title>Review</Dialog.Title>
        <ThemeRoot portalContainer={host}>
          <div style={rowStyle}>
            <span>Requested by</span>
            <HoverCard {...props}>
              <HoverCard.Trigger>{TRIGGER}</HoverCard.Trigger>
              <HoverCard.Content>
                <HoverCard.Profile {...PROFILE} />
              </HoverCard.Content>
            </HoverCard>
          </div>
          <div ref={setHost} data-overlay-host="" />
        </ThemeRoot>
        <Dialog.Close>Close</Dialog.Close>
      </Dialog.Content>
    </Dialog>
  );
}
DialogHost.displayName = 'DialogHost';

export const InsideNativeDialog: Story = {
  // Excluded from the docs page: its open overlay (modal/backdrop) covers the documentation.
  tags: ['!autodocs'],
  render: (args) => <DialogHost {...args} />,
  play: async ({ canvasElement, userEvent }) => {
    const dialog = within(canvasElement).getByRole('dialog') as HTMLDialogElement;
    const trigger = within(dialog).getByRole('button', { name: TRIGGER });
    for (let step = 0; step < 3 && canvasElement.ownerDocument.activeElement !== trigger; step += 1) {
      await userEvent.tab();
    }
    await expectFocus(trigger);
    const card = await expectOpenWithin(canvasElement, IMMEDIATE);
    // The card lives in the dialog's own host, so it is neither inert nor behind the top layer.
    await expect(dialog.contains(card)).toBe(true);

    // The card consumes Escape (default prevented), which keeps a real keypress from also
    // raising the dialog's close request. Synthetic keys never close a native dialog, so the
    // dialog staying open here is not itself the proof; the dispatch result is.
    const notPrevented = fireEvent.keyDown(trigger, { key: 'Escape' });
    await expectClosed(canvasElement);
    await expect(notPrevented).toBe(false);
    await expect(dialog.open).toBe(true);
    await expect(canvasElement.ownerDocument.activeElement).toBe(trigger);
  },
};

export const RTL: Story = {
  args: { defaultOpen: true },
  render: (args) => (
    <div dir="rtl" style={{ paddingInline: vars.space[10] }}>
      <ProfileExample {...args} before={false} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const card = await settled(await findCard(canvasElement));
    const trigger = getTrigger(canvasElement);
    // bottom-start resolves against the trigger's direction: right edges align under RTL and
    // the card extends toward the inline end (left).
    await expect(getComputedStyle(card).direction).toBe('rtl');
    await waitFor(() =>
      expect(Math.abs(card.getBoundingClientRect().right - trigger.getBoundingClientRect().right)).toBeLessThan(SUBPIXEL),
    );
    await expect(card.getBoundingClientRect().left).toBeLessThan(trigger.getBoundingClientRect().left - SUBPIXEL);
  },
};

export const ReducedMotion: Story = {
  args: { defaultOpen: true },
  parameters: {
    docs: {
      description: {
        story:
          'Enable reduced motion in the browser to check that entry fade and movement stop. Open, close and focus behavior stay the same.',
      },
    },
  },
  render: (args) => <ProfileExample {...args} />,
  play: async ({ canvasElement }) => {
    const card = await findCard(canvasElement);
    // Checks whichever preference the runner reports; it does not emulate one.
    const reduce = card.ownerDocument.defaultView!.matchMedia('(prefers-reduced-motion: reduce)').matches;
    await expect(getComputedStyle(card).animationName === 'none').toBe(reduce);
  },
};

export const ForcedColors: Story = {
  args: { defaultOpen: true },
  parameters: {
    docs: {
      description: {
        story: 'Enable forced colors in browser rendering settings to inspect the card border and trigger focus outline.',
      },
    },
  },
  render: (args) => <ProfileExample {...args} />,
  play: async ({ canvasElement }) => {
    const card = await findCard(canvasElement);
    // A real border outlines the card; the shadow is not its only edge.
    await expect(getComputedStyle(card).borderTopStyle).toBe('solid');
    await expect(parseFloat(getComputedStyle(card).borderTopWidth)).toBeGreaterThan(0);
  },
};
