import { useId, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { withLightTheme } from '../../testing/story-decorators';
import { Button } from '../button';
import type { AvatarSize, AvatarStatus } from '../avatar';
import { AvatarGroup, type AvatarGroupMember } from './index';

const SIZES = ['sm', 'md', 'lg'] as const satisfies readonly AvatarSize[];
const SIZE_PX = { sm: 24, md: 32, lg: 40 } as const;
const STATUSES = ['online', 'away', 'busy', 'offline'] as const satisfies readonly AvatarStatus[];

// Procedural noise portrait: self-contained pixels, zero color literals.
const PHOTO_SRC = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
    '<filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="7"/>' +
    '<feColorMatrix values="1.6 0 0 0 -0.2  0 1.1 0 0 -0.1  0 0 1.8 0 0  0 0 0 0 1"/></filter>' +
    '<rect width="64" height="64" filter="url(#n)"/></svg>',
)}`;
const BROKEN_SRC = 'data:image/png;base64,broken';

const SAMPLE_MEMBERS: readonly AvatarGroupMember[] = [
  { id: 'ada', name: 'Ada Lovelace', src: PHOTO_SRC },
  { id: 'grace', name: 'Grace Hopper', status: 'online' },
  { id: 'margaret', name: 'Margaret Hamilton', status: 'busy' },
  { id: 'katherine', name: 'Katherine Johnson' },
  { id: 'hedy', name: 'Hedy Lamarr', status: 'away' },
];

const meta = {
  title: 'Data display/AvatarGroup',
  component: AvatarGroup,
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

export const Default: Story = {
  parameters: {
    docs: {
      source: {
        code: `<AvatarGroup\n  members={[\n    { id: 'ada', name: 'Ada Lovelace' },\n    { id: 'grace', name: 'Grace Hopper' },\n  ]}\n  max={1}\n  label="Editors"\n  locale="en-GB"\n/>`,
      },
    },
  },
  render: (args) => {
    let rootRef: HTMLDivElement | null = null;
    return (
      <AvatarGroup
        {...args}
        ref={(el) => {
          rootRef = el;
        }}
      />
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const group = canvas.getByRole('group', { name: 'Team members' });
    await expect(group).toBeInTheDocument();
    await expect(group).toBeInstanceOf(HTMLDivElement);

    // Max 4 with 5 members -> 4 visible avatars + 1 overflow
    await expect(canvas.getByRole('img', { name: 'Ada Lovelace' })).toBeInTheDocument();
    await expect(canvas.getByRole('img', { name: 'Grace Hopper, online' })).toBeInTheDocument();
    await expect(canvas.getByRole('img', { name: 'Margaret Hamilton, busy' })).toBeInTheDocument();
    await expect(canvas.getByRole('img', { name: 'Katherine Johnson' })).toBeInTheDocument();
    await expect(canvas.getByRole('img', { name: '1 more member' })).toBeInTheDocument();

    const describedBy = group.getAttribute('aria-describedby') ?? '';
    const summary = canvasElement.ownerDocument.getElementById(describedBy);
    await expect(summary).toHaveTextContent('5 members');
  },
};

export const Sizes: Story = {
  render: (args) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: vars.space[4] }}>
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
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const size of SIZES) {
      const group = canvas.getByRole('group', { name: `Size ${size}` });
      const avatar = within(group).getByRole('img', { name: 'Ada Lovelace' });
      const overflow = within(group).getByRole('img', { name: '1 more member' });
      const avatarRect = avatar.getBoundingClientRect();
      const overflowRect = overflow.getBoundingClientRect();
      expect(Math.round(avatarRect.width)).toBe(SIZE_PX[size]);
      expect(Math.round(avatarRect.height)).toBe(SIZE_PX[size]);
      expect(Math.round(overflowRect.width)).toBe(SIZE_PX[size]);
      expect(Math.round(overflowRect.height)).toBe(SIZE_PX[size]);
    }
  },
};

export const PhotosAndFallbacks: Story = {
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
    expect(parseFloat(style.marginInlineStart || style.marginLeft || '0')).toBe(0);
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: vars.space[4] }}>
      <AvatarGroup {...args} max={-2} label="Negative Max" members={SAMPLE_MEMBERS} />
      <AvatarGroup {...args} max={2.8} label="Fractional Max" members={SAMPLE_MEMBERS} />
      <AvatarGroup {...args} max={Number.NaN} label="NaN Max" members={SAMPLE_MEMBERS} />
    </div>
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
  },
};

export const LongOverflow: Story = {
  render: (args) => {
    const manyMembers: AvatarGroupMember[] = Array.from({ length: 150 }, (_, i) => ({
      id: `member-${i}`,
      name: `Member ${i + 1}`,
    }));
    return <AvatarGroup {...args} members={manyMembers} max={3} label="Long Overflow" />;
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const group = canvas.getByRole('group', { name: 'Long Overflow' });
    const overflow = within(group).getByRole('img', { name: '147 more members' });
    await expect(overflow).toBeInTheDocument();
    await expect(within(overflow).getByText('+147')).toHaveAttribute('aria-hidden', 'true');
    const describedBy = group.getAttribute('aria-describedby') ?? '';
    await expect(canvasElement.ownerDocument.getElementById(describedBy)).toHaveTextContent('150 members');
  },
};

function MemberUpdatesHarness() {
  const [members, setMembers] = useState<readonly AvatarGroupMember[]>([
    { id: '1', name: 'Ada Lovelace', src: BROKEN_SRC },
    { id: '2', name: 'Grace Hopper', src: PHOTO_SRC },
    { id: '3', name: 'Margaret Hamilton' },
  ]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: vars.space[3] }}>
      <Button
        onClick={() => {
          setMembers((prev) => [prev[1]!, prev[0]!, prev[2]!]);
        }}
      >
        Reorder members
      </Button>
      <AvatarGroup members={members} max={3} />
    </div>
  );
}

export const MemberUpdates: Story = {
  render: () => <MemberUpdatesHarness />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const adaBefore = canvas.getByRole('img', { name: 'Ada Lovelace' });
    await waitFor(() => expect(adaBefore).toHaveTextContent('AL'));

    const button = canvas.getByRole('button', { name: 'Reorder members' });
    await userEvent.click(button);

    // After reorder, Grace is first, Ada second. Ada retains broken-photo state by id.
    const avatars = canvas.getAllByRole('img');
    await expect(avatars[0]).toHaveAccessibleName('Grace Hopper');
    await expect(avatars[1]).toHaveAccessibleName('Ada Lovelace');
    await expect(avatars[1]).toHaveTextContent('AL');
    await expect(avatars[1]?.querySelector('img')).toBeNull();
  },
};

function ExternalAriaHarness() {
  const titleId = useId();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: vars.space[3] }}>
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
      <span id="external-hint">Core contributors</span>
      <AvatarGroup
        aria-describedby="external-hint"
        members={[{ id: '3', name: 'Margaret Hamilton' }]}
      />
    </div>
  );
}

export const ExternalAria: Story = {
  render: () => <ExternalAriaHarness />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // aria-labelledby suppresses fallback label
    const labelledByGroup = canvas.getByRole('group', { name: 'Design Leads' });
    await expect(labelledByGroup).not.toHaveAttribute('aria-label');

    // explicit aria-label overrides fallback label
    const labelledGroup = canvas.getByRole('group', { name: 'Engineers' });
    await expect(labelledGroup).toBeInTheDocument();

    // aria-describedby merges external id with internal summary id
    const describedGroup = canvas.getByRole('group', { name: 'Team members' });
    const describedBy = describedGroup.getAttribute('aria-describedby') ?? '';
    expect(describedBy).toContain('external-hint');
    const ids = describedBy.split(/\s+/);
    expect(ids).toHaveLength(2);
    const internalSummary = canvasElement.ownerDocument.getElementById(ids[1]!);
    await expect(internalSummary).toHaveTextContent('1 member');
  },
};

export const LocaleFormatting: Story = {
  args: {
    locale: 'ar-EG',
    max: 2,
    members: SAMPLE_MEMBERS,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const expectedCount = new Intl.NumberFormat('ar-EG').format(3);
    const overflow = canvas.getByRole('img', { name: `${expectedCount} more members` });
    await expect(overflow).toBeInTheDocument();
    await expect(within(overflow).getByText(`+${expectedCount}`)).toHaveAttribute('aria-hidden', 'true');
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
    const members = group.querySelectorAll('[data-ui="avatar-group-member"]');
    await expect(members).toHaveLength(2);
    const second = members[1] as HTMLElement;
    const computed = getComputedStyle(second);
    // Logical marginInlineStart maps to marginRight in RTL
    expect(computed.marginRight).toBe('-8px');
    expect(computed.marginLeft).toBe('0px');
  },
};

export const ForcedColors: Story = {
  args: {
    members: SAMPLE_MEMBERS,
    max: 3,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('group', { name: 'Team members' })).toBeInTheDocument();
  },
};

export const ReducedMotion: Story = {
  args: {
    members: SAMPLE_MEMBERS,
    max: 3,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('group', { name: 'Team members' })).toBeInTheDocument();
  },
};

export const KeyboardSkipsGroup: Story = {
  render: (args) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: vars.space[3] }}>
      <Button>Before</Button>
      <AvatarGroup {...args} />
      <Button>After</Button>
    </div>
  ),
  play: async ({ canvasElement }) => {
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

const consumerGroupStyle = css({ opacity: 0.85 });
const sxGroupStyle = css({ opacity: 0.95 });
const slotMemberStyle = css({ transform: 'none' });
const slotOverflowStyle = css({ letterSpacing: '0.05em' });
const slotSummaryStyle = css({ textTransform: 'uppercase' });
const sxAvatarStyle = css({ filter: 'none' });

export const ConsumerStylePrecedence: Story = {
  render: (args) => (
    <AvatarGroup
      {...args}
      max={1}
      className="consumer-group"
      css={consumerGroupStyle}
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
      ]}
    />
  ),
  play: async ({ canvasElement }) => {
    const group = within(canvasElement).getByRole('group', { name: 'Team members' });
    await expect(group).toHaveClass('consumer-group');
    // sx takes precedence over consumer css
    expect(getComputedStyle(group).opacity).toBe('0.95');

    const member = group.querySelector('[data-ui="avatar-group-member"]');
    await expect(member).toHaveClass('slot-member');

    const avatar = group.querySelector('[data-ui="avatar"]');
    await expect(avatar).toHaveClass('consumer-avatar');

    const overflow = group.querySelector('[data-ui="avatar-group-overflow"]');
    await expect(overflow).toHaveClass('slot-overflow');

    const summary = group.querySelector('[data-ui="avatar-group-summary"]');
    await expect(summary).toHaveClass('slot-summary');
  },
};
