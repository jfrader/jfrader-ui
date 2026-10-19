import { StrictMode, useId, useState, type ComponentPropsWithRef } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, waitFor, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { ClassNames, css } from '../../styling/css';
import { withLightTheme } from '../../testing/story-decorators';
import { createRefCleanupTracker } from '../../testing/interior-slot-assertions';
import { Button } from '../button';
import type { AvatarSize, AvatarStatus } from '../avatar';
import { AvatarGroup, type AvatarGroupMember } from './index';
import { PersonAvatar } from '../person-avatar';
import { sceneSource } from '../scene';
import { Stack } from '../stack';
import { Flex } from '../flex';

const SIZES = ['sm', 'md', 'lg'] as const satisfies readonly AvatarSize[];

export const Default: Story = {
  parameters: {
    docs: {
      description: { story: 'Mix procedural Scene images, PersonAvatar portraits and initials. Keep each portrait seed tied to its member id.' },
      source: {
        language: 'tsx',
        code: `import { AvatarGroup, PersonAvatar, sceneSource } from '@jfrader/ui';

<AvatarGroup
  members={[
    { id: 'ada', name: 'Ada Lovelace', src: sceneSource('avatar-ada') },
    { id: 'grace', name: 'Grace Hopper', status: 'online', avatarProps: {
      children: <PersonAvatar seed="grace" alt="" size="full" crop="circle" />,
    } },
    { id: 'margaret', name: 'Margaret Hamilton', status: 'busy' },
    { id: 'katherine', name: 'Katherine Johnson' },
    { id: 'hedy', name: 'Hedy Lamarr', status: 'away' },
  ]}
  max={4}
  size="md"
  label="Team members"
/>`,
      },
    },
  },
  args: { ref: fn() },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const group = canvas.getByRole('group', { name: 'Team members' });
    await expect(group).toBeInstanceOf(HTMLDivElement);
    await expect(args.ref).toHaveBeenCalledWith(group);
    await expect(canvas.getAllByRole('img')).toHaveLength(5);
    await expect(canvas.getByRole('img', { name: 'Ada Lovelace' }).querySelector('img')).not.toBeNull();
    await expect(canvas.getByRole('img', { name: 'Grace Hopper, online' }).querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    await expect(canvas.getByRole('img', { name: 'Margaret Hamilton, busy' })).toHaveTextContent('MH');
    await expect(canvas.getByRole('img', { name: 'Katherine Johnson' })).toBeInTheDocument();
    await expect(canvas.getByRole('img', { name: '1 more member' })).toBeInTheDocument();
    const describedBy = group.getAttribute('aria-describedby') ?? '';
    const summary = canvasElement.ownerDocument.getElementById(describedBy);
    await expect(summary).toHaveTextContent('5 members');
  },
};

function SlotOverflow(props: ComponentPropsWithRef<'span'>) {
  return <span {...props} data-slot="avatar-group-overflow" />;
}

export const OverflowReplacement: Story = {
  render: (args) => <AvatarGroup {...args} max={1} slots={{ overflow: SlotOverflow }} />,
  play: async ({ canvasElement }) => {
    const overflow = canvasElement.querySelector('[data-slot="avatar-group-overflow"]');
    await expect(overflow).toBeInTheDocument();
    await expect(overflow).toHaveAttribute('data-ui', 'avatar-group-overflow');
    await expect(getComputedStyle(overflow!).alignItems).toBe('center');
    await expect(overflow).toHaveAttribute('role', 'img');
    await expect(overflow).toHaveAccessibleName(/more members?/);
    await expect(canvasElement.querySelector('[data-ui="avatar-group-overflow"]:not([data-slot])')).toBeNull();
  },
};
const SIZE_PX = { sm: 24, md: 32, lg: 40 } as const;
const SEPARATION_BORDER_WIDTH = '2px';
const CSS_PIXEL = 1;
const STATUSES = ['online', 'away', 'busy', 'offline'] as const satisfies readonly AvatarStatus[];

const PHOTO_SRC = sceneSource('avatar-ada');
const BROKEN_SRC = 'data:image/png;base64,broken';

function SharedFallback(props: ComponentPropsWithRef<'span'>) {
  return <span {...props} data-replacement="shared" />;
}

function MemberFallback(props: ComponentPropsWithRef<'span'>) {
  return <span {...props} data-replacement="member" />;
}

export const ComposedMembers: Story = {
  render: (args) => <AvatarGroup {...args} max={3} avatarProps={{
    children: '★', className: 'shared-avatar',
    slots: { fallback: SharedFallback },
    slotProps: { fallback: { className: 'shared-fallback', title: 'Shared artwork', css: { fontWeight: vars.fontWeight.bold } } },
    sx: { outline: `1px solid ${vars.color.border}` },
  }} members={[
    { id: 'ada', name: 'Ada Lovelace', avatarProps: {
      children: <PersonAvatar seed="ada" alt="" size="full" crop="circle" />,
      className: 'member-avatar', slots: { fallback: MemberFallback },
      slotProps: { fallback: { className: 'member-fallback', title: 'Ada artwork', css: { opacity: 1 } } },
      sx: { outlineWidth: '2px' },
    } },
    { id: 'grace', name: 'Grace Hopper' },
    { id: 'margaret', name: 'Margaret Hamilton', avatarProps: { children: null } },
    { id: 'hidden', name: 'Katherine Johnson' },
  ]} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByRole('img')).toHaveLength(4);
    const ada = canvas.getByRole('img', { name: 'Ada Lovelace' });
    await expect(ada).toHaveClass('shared-avatar', 'member-avatar');
    const art = ada.querySelector('[data-ui="avatar-fallback"]')!;
    await expect(art).toHaveClass('shared-fallback', 'member-fallback');
    await expect(art).toHaveAttribute('data-replacement', 'member');
    await expect(art).toHaveAttribute('title', 'Ada artwork');
    await expect(getComputedStyle(art).fontWeight).toBe('700');
    await expect(getComputedStyle(art).opacity).toBe('1');
    await expect(getComputedStyle(ada).outlineWidth).toBe('2px');
    await expectBorderWidth(ada, SEPARATION_BORDER_WIDTH);
    await expect(canvas.getByRole('img', { name: 'Grace Hopper' })).toHaveTextContent('★');
    await expect(canvas.getByRole('img', { name: 'Margaret Hamilton' })).toHaveTextContent('MH');
    await expect(canvas.getByRole('img', { name: '1 more member' })).toHaveTextContent('+1');
    await expect(ada.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  },
};

export const ComposedRefCleanup: Story = {
  play: async ({ canvasElement }) => {
    const host = canvasElement.ownerDocument.createElement('div');
    canvasElement.append(host);
    const root = createRoot(host);
    const sharedImage = createRefCleanupTracker<HTMLImageElement>();
    const ownImage = createRefCleanupTracker<HTMLImageElement>();
    const sharedFallback = createRefCleanupTracker<HTMLSpanElement>();
    const ownFallback = createRefCleanupTracker<HTMLSpanElement>();
    const sharedStatus = createRefCleanupTracker<HTMLSpanElement>();
    const ownStatus = createRefCleanupTracker<HTMLSpanElement>();
    const render = (src?: string) => flushSync(() => root.render(<StrictMode><AvatarGroup members={[
      { id: 'ada', name: 'Ada', src, status: 'online', avatarProps: { slotProps: {
        image: { ref: ownImage.ref }, fallback: { ref: ownFallback.ref }, status: { ref: ownStatus.ref },
      } } },
    ]} avatarProps={{ slotProps: {
      image: { ref: sharedImage.ref }, fallback: { ref: sharedFallback.ref }, status: { ref: sharedStatus.ref },
    } }} /></StrictMode>));
    try {
      render();
      await expect(sharedFallback.getNode()).toBe(host.querySelector('[data-ui="avatar-fallback"]'));
      await expect(ownFallback.getNode()).toBe(sharedFallback.getNode());
      await expect(sharedStatus.getNode()).toBe(host.querySelector('[data-ui="avatar-status"]'));
      await expect(ownStatus.getNode()).toBe(sharedStatus.getNode());
      render(PHOTO_SRC);
      await expect(sharedFallback.isCleanedUp()).toBe(true);
      await expect(ownFallback.isCleanedUp()).toBe(true);
      await expect(sharedImage.getNode()).toBe(host.querySelector('img'));
      await expect(ownImage.getNode()).toBe(sharedImage.getNode());
    } finally { flushSync(() => root.unmount()); host.remove(); }
    for (const tracker of [sharedImage, ownImage, sharedFallback, ownFallback, sharedStatus, ownStatus]) {
      await expect(tracker.getAttachCount()).toBeGreaterThan(0);
      await expect(tracker.getCleanupCount()).toBe(tracker.getAttachCount());
      await expect(tracker.getNode()).toBeNull();
    }
  },
};

// Overflow count wider than every size token: six digits plus grouping separators.
const HUGE_VISIBLE = 3;
const HUGE_HIDDEN = 123_456;
const HUGE_MEMBERS: readonly AvatarGroupMember[] = Array.from(
  { length: HUGE_VISIBLE + HUGE_HIDDEN },
  (_, i) => ({ id: `member-${i}`, name: `Member ${i + 1}` }),
);

// Chromium snaps border widths down to whole device pixels, so a fractional device pixel ratio
// computes an authored 2px border as e.g. 1.48837px. The loss stays under one CSS pixel, which
// still tells the 2px, 3px and 4px widths these stories compare apart.
async function expectBorderWidth(element: HTMLElement, authored: string) {
  const expected = parseFloat(authored);
  const actual = parseFloat(getComputedStyle(element).borderTopWidth);
  await expect(actual).toBeGreaterThan(expected - CSS_PIXEL);
  await expect(actual).toBeLessThanOrEqual(expected);
}

function overflowCount(overflow: HTMLElement): HTMLElement {
  const count = overflow.querySelector<HTMLElement>('[aria-hidden="true"]');
  if (!count) throw new Error('Overflow count text is missing');
  return count;
}

// The visible count must fit inside the overflow border box at its token block size.
async function expectCountWithinOverflow(overflow: HTMLElement, size: AvatarSize) {
  const box = overflow.getBoundingClientRect();
  const text = overflowCount(overflow).getBoundingClientRect();
  const style = getComputedStyle(overflow);
  await expect(Math.round(box.height)).toBe(SIZE_PX[size]);
  await expect(Math.round(box.width)).toBeGreaterThanOrEqual(SIZE_PX[size]);
  await expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);
  await expect(Math.floor(text.left)).toBeGreaterThanOrEqual(Math.floor(box.left + parseFloat(style.borderLeftWidth)));
  await expect(Math.ceil(text.right)).toBeLessThanOrEqual(Math.ceil(box.right - parseFloat(style.borderRightWidth)));
  await expect(Math.floor(text.top)).toBeGreaterThanOrEqual(Math.floor(box.top));
  await expect(Math.ceil(text.bottom)).toBeLessThanOrEqual(Math.ceil(box.bottom));
}

function summaryOf(group: HTMLElement): HTMLElement {
  const summary = group.querySelector<HTMLElement>('[data-ui="avatar-group-summary"]');
  if (!summary) throw new Error('Group summary is missing');
  return summary;
}

const SAMPLE_MEMBERS: readonly AvatarGroupMember[] = [
  { id: 'ada', name: 'Ada Lovelace', src: PHOTO_SRC },
  { id: 'grace', name: 'Grace Hopper', status: 'online', avatarProps: {
    children: <PersonAvatar seed="grace" alt="" size="full" crop="circle" />,
  } },
  { id: 'margaret', name: 'Margaret Hamilton', status: 'busy' },
  { id: 'katherine', name: 'Katherine Johnson' },
  { id: 'hedy', name: 'Hedy Lamarr', status: 'away' },
];

const meta = {
  title: 'Data display/AvatarGroup',
  component: AvatarGroup,
  parameters: {
    docs: {
      description: { component: 'Show people together, with a count for those who do not fit.' },
      usage: `### Members
- Pass \`members\` in display order with a unique \`id\` for each person. \`max\` defaults to 4 people, with an additional overflow count. Set \`max={0}\` to show only the count.
- \`max\` does not respond to available width. Set it yourself for your layout. Fractions round down, negative values become 0, and non-finite values fall back to 4.

### Labels
- The group and overflow are not controls. If you need to open a member list, provide a separate button.
- For another language, set \`label\`, \`getOverflowLabel\` and \`getSummaryLabel\`. \`locale\` formats numbers only. Set it explicitly for server rendering.`,
    },
  },
  tags: ['autodocs'],
  args: {
    members: SAMPLE_MEMBERS,
    max: 4,
    size: 'md',
    label: 'Team members',
  },
  argTypes: {
    size: { control: 'radio', options: SIZES },
    max: { control: 'number' },
  },
} satisfies Meta<typeof AvatarGroup>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Sizes: Story = {
  render: (args) => (
    <Stack>
      {SIZES.map((size) => (
        <AvatarGroup
          {...args}
          key={size}
          size={size}
          max={1}
          label={`Size ${size}`}
          members={[
            { id: 'ada', name: 'Ada Lovelace' },
            { id: 'grace', name: 'Grace Hopper' },
          ]}
        />
      ))}
    </Stack>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const size of SIZES) {
      const group = canvas.getByRole('group', { name: `Size ${size}` });
      const avatar = within(group).getByRole('img', { name: 'Ada Lovelace' });
      const overflow = within(group).getByRole('img', { name: '1 more member' });
      const avatarRect = avatar.getBoundingClientRect();
      const overflowRect = overflow.getBoundingClientRect();
      await expect(Math.round(avatarRect.width)).toBe(SIZE_PX[size]);
      await expect(Math.round(avatarRect.height)).toBe(SIZE_PX[size]);
      // The overflow circle keeps the size token as a minimum but grows to fit its count text,
      // whose rendered width depends on the environment's font metrics (CI vs local).
      await expect(overflowRect.width).toBeGreaterThanOrEqual(SIZE_PX[size] - 0.5);
      await expect(Math.round(overflowRect.height)).toBe(SIZE_PX[size]);
    }
  },
};

export const PhotosAndFallbacks: Story = {
  parameters: { docs: { description: { story: 'A procedural Scene image, a failed image showing initials, and initials without a source.' } } },
  args: {
    max: 3,
    members: [
      { id: 'photo', name: 'Ada Lovelace', src: PHOTO_SRC },
      { id: 'broken', name: 'Grace Hopper', src: BROKEN_SRC },
      { id: 'initials', name: 'Margaret Hamilton' },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const photoAvatar = canvas.getByRole('img', { name: 'Ada Lovelace' });
    const photoImg = photoAvatar.querySelector('img');
    await expect(photoImg).not.toBeNull();
    await expect(photoImg).toHaveAttribute('alt', '');
    await waitFor(() => expect(photoImg?.complete).toBe(true));

    const brokenAvatar = canvas.getByRole('img', { name: 'Grace Hopper' });
    await waitFor(() => expect(brokenAvatar).toHaveTextContent('GH'));
    await expect(brokenAvatar.querySelector('img')).toBeNull();

    const initialsAvatar = canvas.getByRole('img', { name: 'Margaret Hamilton' });
    await expect(initialsAvatar).toHaveTextContent('MH');
  },
};

export const AllStatuses: Story = {
  args: {
    max: 5,
    members: [
      { id: 's1', name: 'Ada Lovelace', status: 'online' },
      { id: 's2', name: 'Grace Hopper', status: 'away' },
      { id: 's3', name: 'Margaret Hamilton', status: 'busy' },
      { id: 's4', name: 'Katherine Johnson', status: 'offline' },
      { id: 's5', name: 'Hedy Lamarr', status: 'online', statusLabel: 'en línea' },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const status of STATUSES) {
      const avatar = canvas.getByRole('img', { name: new RegExp(`, ${status}$`) });
      const dot = avatar.querySelector(`[data-status="${status}"]`);
      await expect(dot).toHaveAttribute('aria-hidden', 'true');
    }
    await expect(canvas.getByRole('img', { name: 'Hedy Lamarr, en línea' })).toBeInTheDocument();
  },
};

export const Overflow: Story = {
  args: {
    max: 2,
    members: SAMPLE_MEMBERS,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const avatars = canvas.getAllByRole('img');
    await expect(avatars).toHaveLength(3);
    const overflow = canvas.getByRole('img', { name: '3 more members' });
    await expect(overflow).toBeInTheDocument();
    await expect(within(overflow).getByText('+3')).toHaveAttribute('aria-hidden', 'true');

    const group = canvas.getByRole('group', { name: 'Team members' });
    const describedBy = group.getAttribute('aria-describedby') ?? '';
    await expect(canvasElement.ownerDocument.getElementById(describedBy)).toHaveTextContent('5 members');
  },
};

export const MaxZero: Story = {
  args: {
    max: 0,
    members: [
      { id: 'ada', name: 'Ada Lovelace' },
      { id: 'grace', name: 'Grace Hopper' },
      { id: 'margaret', name: 'Margaret Hamilton' },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const images = canvas.getAllByRole('img');
    await expect(images).toHaveLength(1);
    const overflow = canvas.getByRole('img', { name: '3 more members' });
    await expect(overflow).toBeInTheDocument();
    await expect(within(overflow).getByText('+3')).toHaveAttribute('aria-hidden', 'true');

    // First child overflow must not carry negative margin
    const style = getComputedStyle(overflow);
    await expect(parseFloat(style.marginInlineStart)).toBe(0);
  },
};

export const Empty: Story = {
  args: {
    members: [],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryAllByRole('img')).toHaveLength(0);
    const group = canvas.getByRole('group', { name: 'Team members' });
    const describedBy = group.getAttribute('aria-describedby') ?? '';
    await expect(canvasElement.ownerDocument.getElementById(describedBy)).toHaveTextContent('0 members');
  },
};

export const DuplicateNamesWithUniqueIds: Story = {
  args: {
    max: 2,
    members: [
      { id: 'ada-photo', name: 'Ada Lovelace', src: PHOTO_SRC },
      { id: 'ada-broken', name: 'Ada Lovelace', src: BROKEN_SRC },
    ],
  },
  play: async ({ canvasElement }) => {
    const avatars = within(canvasElement).getAllByRole('img', { name: 'Ada Lovelace' });
    await expect(avatars).toHaveLength(2);
    await waitFor(() => expect(avatars[1]).toHaveTextContent('AL'));
    await expect(avatars[0]?.querySelector('img')).not.toBeNull();
    await expect(avatars[1]?.querySelector('img')).toBeNull();
  },
};

export const InvalidMax: Story = {
  render: (args) => (
    <Stack>
      <AvatarGroup {...args} max={-2} label="Negative Max" members={SAMPLE_MEMBERS} />
      <AvatarGroup {...args} max={2.8} label="Fractional Max" members={SAMPLE_MEMBERS} />
      <AvatarGroup {...args} max={Number.NaN} label="NaN Max" members={SAMPLE_MEMBERS} />
      <AvatarGroup {...args} max={Number.POSITIVE_INFINITY} label="Infinite Max" members={SAMPLE_MEMBERS} />
      <AvatarGroup {...args} max={Number.MAX_SAFE_INTEGER} label="Huge Max" members={SAMPLE_MEMBERS} />
    </Stack>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // max={-2} normalizes to 0: only overflow +5
    const negGroup = canvas.getByRole('group', { name: 'Negative Max' });
    await expect(within(negGroup).queryAllByRole('img')).toHaveLength(1);
    await expect(within(negGroup).getByRole('img', { name: '5 more members' })).toBeInTheDocument();

    // max={2.8} normalizes to 2: 2 avatars + overflow +3
    const fracGroup = canvas.getByRole('group', { name: 'Fractional Max' });
    await expect(within(fracGroup).queryAllByRole('img')).toHaveLength(3);
    await expect(within(fracGroup).getByRole('img', { name: '3 more members' })).toBeInTheDocument();

    // max={NaN} normalizes to default 4: 4 avatars + overflow +1
    const nanGroup = canvas.getByRole('group', { name: 'NaN Max' });
    await expect(within(nanGroup).queryAllByRole('img')).toHaveLength(5);
    await expect(within(nanGroup).getByRole('img', { name: '1 more member' })).toBeInTheDocument();

    // Every non-finite max, Infinity included, normalizes to the default 4
    const infiniteGroup = canvas.getByRole('group', { name: 'Infinite Max' });
    await expect(within(infiniteGroup).queryAllByRole('img')).toHaveLength(5);
    await expect(within(infiniteGroup).getByRole('img', { name: '1 more member' })).toBeInTheDocument();

    // A huge finite max shows everyone without an overflow
    const hugeGroup = canvas.getByRole('group', { name: 'Huge Max' });
    await expect(within(hugeGroup).queryAllByRole('img')).toHaveLength(SAMPLE_MEMBERS.length);
    await expect(hugeGroup.querySelector('[data-ui="avatar-group-overflow"]')).toBeNull();
  },
};

const MAX_BOUNDARIES = [
  { offset: -1, hidden: 1 },
  { offset: 0, hidden: 0 },
  { offset: 1, hidden: 0 },
] as const;

export const MaxBoundaries: Story = {
  render: (args) => (
    <Stack>
      {MAX_BOUNDARIES.map(({ offset }) => (
        <AvatarGroup
          {...args}
          key={offset}
          max={SAMPLE_MEMBERS.length + offset}
          label={`Max count ${offset < 0 ? '-' : '+'} ${Math.abs(offset)}`}
          members={SAMPLE_MEMBERS}
        />
      ))}
    </Stack>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const { offset, hidden } of MAX_BOUNDARIES) {
      const group = canvas.getByRole('group', { name: `Max count ${offset < 0 ? '-' : '+'} ${Math.abs(offset)}` });
      const people = group.querySelectorAll('[data-ui="avatar-group-member"]');
      await expect(people).toHaveLength(SAMPLE_MEMBERS.length - hidden);
      const overflow = group.querySelector('[data-ui="avatar-group-overflow"]');
      if (hidden === 0) {
        await expect(overflow).toBeNull();
      } else {
        await expect(overflow).toHaveAccessibleName(`${hidden} more member`);
      }
      await expect(summaryOf(group)).toHaveTextContent(`${SAMPLE_MEMBERS.length} members`);
    }
  },
};

export const LongOverflow: Story = {
  args: { locale: 'en-US', max: HUGE_VISIBLE },
  render: (args) => (
    <Stack>
      {SIZES.map((size) => (
        <AvatarGroup {...args} key={size} size={size} members={HUGE_MEMBERS} label={`Long overflow ${size}`} />
      ))}
    </Stack>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const format = new Intl.NumberFormat('en-US');
    for (const size of SIZES) {
      const group = canvas.getByRole('group', { name: `Long overflow ${size}` });
      const overflow = within(group).getByRole('img', { name: `${format.format(HUGE_HIDDEN)} more members` });
      await expect(overflowCount(overflow)).toHaveTextContent(`+${format.format(HUGE_HIDDEN)}`);
      await expectCountWithinOverflow(overflow, size);
      await expect(summaryOf(group)).toHaveTextContent(`${format.format(HUGE_MEMBERS.length)} members`);
    }
  },
};

function MemberUpdatesHarness() {
  const [members, setMembers] = useState<readonly AvatarGroupMember[]>([
    { id: '1', name: 'Ada Lovelace', src: BROKEN_SRC },
    { id: '2', name: 'Grace Hopper', src: PHOTO_SRC },
    { id: '3', name: 'Margaret Hamilton' },
  ]);

  return (
    <Stack gap="sm">
      <Button
        onClick={() => {
          setMembers((prev) => [prev[1]!, prev[0]!, prev[2]!]);
        }}
      >
        Reorder members
      </Button>
      <AvatarGroup members={members} max={3} />
    </Stack>
  );
}

export const MemberUpdates: Story = {
  render: () => <MemberUpdatesHarness />,
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    const adaBefore = canvas.getByRole('img', { name: 'Ada Lovelace' });
    const graceBefore = canvas.getByRole('img', { name: 'Grace Hopper' });
    const margaretBefore = canvas.getByRole('img', { name: 'Margaret Hamilton' });
    await waitFor(() => expect(adaBefore).toHaveTextContent('AL'));

    await userEvent.click(canvas.getByRole('button', { name: 'Reorder members' }));

    // Keyed by member id: the same nodes move, so Ada keeps her broken-photo fallback.
    const avatars = canvas.getAllByRole('img');
    await expect(avatars).toHaveLength(3);
    await expect(avatars[0]).toBe(graceBefore);
    await expect(avatars[1]).toBe(adaBefore);
    await expect(avatars[2]).toBe(margaretBefore);
    await expect(adaBefore).toHaveTextContent('AL');
    await expect(adaBefore.querySelector('img')).toBeNull();
    await expect(graceBefore.querySelector('img')).not.toBeNull();
  },
};

function ExternalAriaHarness() {
  const titleId = useId();
  const crewTitleId = useId();
  return (
    <Stack gap="sm">
      <h3 id={titleId}>Design Leads</h3>
      <AvatarGroup
        aria-labelledby={titleId}
        label="Ignored fallback"
        members={[{ id: '1', name: 'Ada Lovelace' }]}
      />
      <AvatarGroup
        aria-label="Engineers"
        label="Ignored fallback"
        members={[{ id: '2', name: 'Grace Hopper' }]}
      />
      <h3 id={crewTitleId}>Release crew</h3>
      <AvatarGroup
        aria-labelledby={crewTitleId}
        aria-label="On-call engineers"
        label="Ignored fallback"
        members={[{ id: '4', name: 'Katherine Johnson' }]}
      />
      {/* Intentionally unresolved: a consumer labelledby is kept as given, so this group has no fallback name. */}
      <AvatarGroup
        aria-labelledby="missing-heading"
        label="Ignored fallback"
        members={[{ id: '5', name: 'Hedy Lamarr' }]}
      />
      <span id="external-hint">Core contributors</span>
      <AvatarGroup
        aria-describedby="external-hint"
        members={[{ id: '3', name: 'Margaret Hamilton' }]}
      />
    </Stack>
  );
}

export const ExternalAria: Story = {
  render: () => <ExternalAriaHarness />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // aria-labelledby suppresses the fallback label
    const labelledByGroup = canvas.getByRole('group', { name: 'Design Leads' });
    await expect(labelledByGroup).not.toHaveAttribute('aria-label');

    // explicit aria-label overrides the fallback label
    await expect(canvas.getByRole('group', { name: 'Engineers' })).toBeInTheDocument();

    // A consumer aria-label survives next to aria-labelledby; labelledby wins the accessible name
    const bothGroup = canvas.getByRole('group', { name: 'Release crew' });
    await expect(bothGroup).toHaveAttribute('aria-label', 'On-call engineers');
    await expect(bothGroup).toHaveAttribute('aria-labelledby');

    // An unresolved labelledby reference is kept as given and still suppresses the fallback
    const unresolvedGroup = canvasElement.querySelector<HTMLElement>('[aria-labelledby="missing-heading"]');
    await expect(unresolvedGroup).not.toBeNull();
    await expect(unresolvedGroup).not.toHaveAttribute('aria-label');
    await expect(unresolvedGroup).toHaveAccessibleName('');

    // aria-describedby merges the external id with the internal summary id
    const describedGroup = canvas.getByRole('group', { name: 'Team members' });
    const ids = (describedGroup.getAttribute('aria-describedby') ?? '').split(/\s+/);
    await expect(ids).toEqual(['external-hint', summaryOf(describedGroup).id]);
    await expect(describedGroup).toHaveAccessibleDescription('Core contributors 1 member');

    // Summary ids are unique per instance and each group describes itself with its own summary
    const groups = Array.from(canvasElement.querySelectorAll<HTMLElement>('[data-ui="avatar-group"]'));
    await expect(groups).toHaveLength(5);
    const summaryIds = groups.map((group) => summaryOf(group).id);
    await expect(new Set(summaryIds).size).toBe(groups.length);
    for (const [index, group] of groups.entries()) {
      await expect(group.getAttribute('aria-describedby')?.split(/\s+/)).toContain(summaryIds[index]);
    }
  },
};

export const LocaleFormatting: Story = {
  args: {
    locale: 'ar-EG',
    max: 2,
    members: SAMPLE_MEMBERS,
  },
  render: (args) => (
    <Stack>
      <AvatarGroup {...args} />
      {SIZES.map((size) => (
        <AvatarGroup
          {...args}
          key={size}
          size={size}
          max={HUGE_VISIBLE}
          members={HUGE_MEMBERS}
          label={`Long count ${size}`}
        />
      ))}
    </Stack>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const format = new Intl.NumberFormat('ar-EG');
    const shortGroup = canvas.getByRole('group', { name: 'Team members' });
    const expectedCount = format.format(3);
    const overflow = within(shortGroup).getByRole('img', { name: `${expectedCount} more members` });
    await expect(within(overflow).getByText(`+${expectedCount}`)).toHaveAttribute('aria-hidden', 'true');

    for (const size of SIZES) {
      const group = canvas.getByRole('group', { name: `Long count ${size}` });
      const longOverflow = within(group).getByRole('img', { name: `${format.format(HUGE_HIDDEN)} more members` });
      await expect(overflowCount(longOverflow)).toHaveTextContent(`+${format.format(HUGE_HIDDEN)}`);
      await expectCountWithinOverflow(longOverflow, size);
    }
  },
};

const germanOverflowLabel = fn((_hidden: number, formatted: string) => `${formatted} weitere Mitglieder`);
const germanSummaryLabel = fn((_total: number, formatted: string) => `${formatted} Mitglieder`);

export const CountLabelCallbacks: Story = {
  args: {
    locale: 'de-DE',
    max: HUGE_VISIBLE,
    label: 'Teammitglieder',
    getOverflowLabel: germanOverflowLabel,
    getSummaryLabel: germanSummaryLabel,
  },
  render: (args) => <AvatarGroup {...args} members={HUGE_MEMBERS} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const format = new Intl.NumberFormat('de-DE');
    const hiddenCall = [HUGE_HIDDEN, format.format(HUGE_HIDDEN)];
    const totalCall = [HUGE_MEMBERS.length, format.format(HUGE_MEMBERS.length)];

    // Every render passes the raw count and its Intl-formatted string
    await expect(germanOverflowLabel).toHaveBeenCalled();
    for (const call of germanOverflowLabel.mock.calls) await expect(call).toEqual(hiddenCall);
    await expect(germanSummaryLabel).toHaveBeenCalled();
    for (const call of germanSummaryLabel.mock.calls) await expect(call).toEqual(totalCall);

    const group = canvas.getByRole('group', { name: 'Teammitglieder' });
    await expect(within(group).getByRole('img', { name: `${hiddenCall[1]} weitere Mitglieder` })).toBeInTheDocument();
    await expect(summaryOf(group)).toHaveTextContent(`${totalCall[1]} Mitglieder`);
  },
};

export const LightTheme: Story = {
  globals: { theme: 'light' },
  decorators: [withLightTheme],
  args: {
    members: SAMPLE_MEMBERS,
    max: 3,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('group', { name: 'Team members' })).toBeInTheDocument();
    await expect(canvas.getByRole('img', { name: '2 more members' })).toBeInTheDocument();
  },
};

export const RTL: Story = {
  render: (args) => (
    <div dir="rtl">
      <AvatarGroup
        {...args}
        members={[
          { id: '1', name: 'Member 1' },
          { id: '2', name: 'Member 2' },
        ]}
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const group = within(canvasElement).getByRole('group', { name: 'Team members' });
    const members = group.querySelectorAll<HTMLElement>('[data-ui="avatar-group-member"]');
    await expect(members).toHaveLength(2);
    const computed = getComputedStyle(members[1]!);
    // Logical marginInlineStart maps to marginRight in RTL
    await expect(computed.marginRight).toBe('-4px');
    await expect(computed.marginLeft).toBe('0px');
  },
};

const FORCED_COLORS_CONDITION = 'forced-colors: active';

// Declarations Emotion emitted for this element's classes inside the forced-colors media block.
function forcedColorsDeclarations(element: Element): CSSStyleDeclaration[] {
  const selectors = new Set(Array.from(element.classList, (name) => `.${name}`));
  return Array.from(element.ownerDocument.styleSheets)
    .flatMap((sheet) => Array.from(sheet.cssRules))
    .filter((rule): rule is CSSMediaRule => rule instanceof CSSMediaRule && rule.conditionText.includes(FORCED_COLORS_CONDITION))
    .flatMap((rule) => Array.from(rule.cssRules))
    .filter((rule): rule is CSSStyleRule => rule instanceof CSSStyleRule && selectors.has(rule.selectorText))
    .map((rule) => rule.style);
}

// Structural check only: the separation is a real border and a forced-colors rule maps it to
// system colors. The browser runner cannot emulate forced colors; rendering is a manual QA check.
export const ForcedColorsRule: Story = {
  args: {
    members: SAMPLE_MEMBERS,
    max: 3,
  },
  play: async ({ canvasElement }) => {
    const group = within(canvasElement).getByRole('group', { name: 'Team members' });
    const separated = [
      ...group.querySelectorAll<HTMLElement>('[data-ui="avatar"]'),
      within(group).getByRole('img', { name: '2 more members' }),
    ];
    await expect(separated).toHaveLength(4);
    for (const element of separated) {
      const style = getComputedStyle(element);
      await expect(style.borderTopStyle).toBe('solid');
      await expectBorderWidth(element, SEPARATION_BORDER_WIDTH);
      const borderColors = forcedColorsDeclarations(element).map((rule) => rule.borderColor.toLowerCase());
      await expect(borderColors).toContain('canvas');
    }
  },
};

const ANIMATED_PARTS = '[data-ui="avatar-group"], [data-ui="avatar-group"] *';

// Structural check only: no part declares an animation or transition, so reduced-motion and
// default rendering match. The OS reduced-motion setting itself is a manual QA check.
export const StaticMotion: Story = {
  args: {
    members: SAMPLE_MEMBERS,
    max: 3,
  },
  play: async ({ canvasElement }) => {
    const parts = canvasElement.querySelectorAll<HTMLElement>(ANIMATED_PARTS);
    await expect(parts.length).toBeGreaterThan(0);
    for (const part of parts) {
      const style = getComputedStyle(part);
      await expect(style.animationName).toBe('none');
      await expect(style.transitionDuration.split(',').every((duration) => parseFloat(duration) === 0)).toBe(true);
    }
  },
};

export const KeyboardSkipsGroup: Story = {
  render: (args) => (
    <Flex align="center" gap="sm" wrap>
      <Button>Before</Button>
      <AvatarGroup {...args} />
      <Button>After</Button>
    </Flex>
  ),
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    const before = canvas.getByRole('button', { name: 'Before' });
    const after = canvas.getByRole('button', { name: 'After' });
    const group = canvas.getByRole('group', { name: 'Team members' });

    before.focus();
    await expect(canvasElement.ownerDocument.activeElement).toBe(before);
    await expect(getComputedStyle(before).outlineStyle).not.toBe('none');

    await userEvent.tab();
    await expect(canvasElement.ownerDocument.activeElement).toBe(after);
    await expect(getComputedStyle(after).outlineStyle).not.toBe('none');
    await expect(group.contains(canvasElement.ownerDocument.activeElement)).toBe(false);

    await userEvent.tab({ shift: true });
    await expect(canvasElement.ownerDocument.activeElement).toBe(before);
    await expect(getComputedStyle(before).outlineStyle).not.toBe('none');
    await expect(group.contains(canvasElement.ownerDocument.activeElement)).toBe(false);
  },
};

// Each override is distinguishable in computed style; conflicting ones fight a built-in value.
const OVERRIDE = {
  groupCssOpacity: '0.85',
  groupSxOpacity: '0.95',
  memberMargin: '0px',
  overflowBorderWidth: '4px',
  summaryWhiteSpace: 'pre',
  avatarBorderWidth: '3px',
} as const;

const consumerGroupStyle = css({ opacity: OVERRIDE.groupCssOpacity });
const sxGroupStyle = css({ opacity: OVERRIDE.groupSxOpacity });
const slotMemberStyle = css({ '&:not(:first-of-type)': { marginInlineStart: OVERRIDE.memberMargin } });
const slotOverflowStyle = css({ borderWidth: OVERRIDE.overflowBorderWidth });
const slotSummaryStyle = css({ whiteSpace: OVERRIDE.summaryWhiteSpace });
const sxAvatarStyle = css({ borderWidth: OVERRIDE.avatarBorderWidth });

export const ConsumerStylePrecedence: Story = {
  render: (args) => (
    <ClassNames>
      {({ css: className }) => (
        <AvatarGroup
          {...args}
          max={2}
          className={`consumer-group ${className(consumerGroupStyle)}`}
          sx={sxGroupStyle}
          slotProps={{
            member: { className: 'slot-member', css: slotMemberStyle },
            overflow: { className: 'slot-overflow', css: slotOverflowStyle },
            summary: { className: 'slot-summary', css: slotSummaryStyle },
          }}
          avatarProps={{
            className: 'consumer-avatar',
            sx: sxAvatarStyle,
          }}
          members={[
            { id: '1', name: 'Member 1' },
            { id: '2', name: 'Member 2' },
            { id: '3', name: 'Member 3' },
          ]}
        />
      )}
    </ClassNames>
  ),
  play: async ({ canvasElement }) => {
    const group = within(canvasElement).getByRole('group', { name: 'Team members' });
    await expect(group).toHaveClass('consumer-group');
    // sx wins over an incoming Emotion class.
    await expect(getComputedStyle(group).opacity).toBe(OVERRIDE.groupSxOpacity);

    // Slot css wins over the built-in negative overlap
    const members = group.querySelectorAll<HTMLElement>('[data-ui="avatar-group-member"]');
    await expect(members).toHaveLength(2);
    for (const member of members) await expect(member).toHaveClass('slot-member');
    await expect(getComputedStyle(members[1]!).marginInlineStart).toBe(OVERRIDE.memberMargin);

    // Slot css wins over the built-in 2px separation border
    const overflow = within(group).getByRole('img', { name: '1 more member' });
    await expect(overflow).toHaveClass('slot-overflow');
    await expectBorderWidth(overflow, OVERRIDE.overflowBorderWidth);

    // Slot css wins over the visually hidden nowrap
    const summary = summaryOf(group);
    await expect(summary).toHaveClass('slot-summary');
    await expect(getComputedStyle(summary).whiteSpace).toBe(OVERRIDE.summaryWhiteSpace);

    // avatarProps.sx wins over the group's separation border on every Avatar
    const avatars = group.querySelectorAll<HTMLElement>('[data-ui="avatar"]');
    await expect(avatars).toHaveLength(2);
    for (const avatar of avatars) {
      await expect(avatar).toHaveClass('consumer-avatar');
      await expectBorderWidth(avatar, OVERRIDE.avatarBorderWidth);
    }
  },
};
