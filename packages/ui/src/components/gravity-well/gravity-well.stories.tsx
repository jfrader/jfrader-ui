import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { styled } from '../../styling/styled';
import { GravityWell, type GravityWellItem } from './index';

const Frame = styled.div({
  display: 'grid',
  gap: vars.space[4],
  inlineSize: `min(640px, calc(100vw - ${vars.space[4]} * 2))`,
  maxInlineSize: '100%',
  boxSizing: 'border-box',
  padding: vars.space[5],
  borderRadius: vars.radius.xl,
  background: vars.color.surfaceInset,
  border: `1px solid ${vars.color.border}`,
});

const WallTitle = styled.h2({
  margin: 0,
  fontFamily: vars.font.sans,
  fontSize: vars.textSize.lg,
  color: vars.color.text,
});

const WallCaption = styled.p({
  margin: 0,
  fontFamily: vars.font.sans,
  fontSize: vars.textSize.sm,
  color: vars.color.textMuted,
});

const AvatarBadge = styled.span({
  fontWeight: 600,
  fontSize: vars.textSize.md,
  color: vars.color.text,
  userSelect: 'none',
});

const LongText = styled.span({
  paddingInline: vars.space[2],
  textAlign: 'center',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  maxInlineSize: '100%',
});

const defaultItems: readonly GravityWellItem[] = [
  { id: 'item-1', content: 'Alpha' },
  { id: 'item-2', content: 'Beta' },
  { id: 'item-3', content: 'Gamma' },
  { id: 'item-4', content: 'Delta' },
  { id: 'item-5', content: 'Epsilon' },
  { id: 'item-6', content: 'Zeta' },
  { id: 'item-7', content: 'Eta' },
  { id: 'item-8', content: 'Theta' },
  { id: 'item-9', content: 'Iota' },
  { id: 'item-10', content: 'Kappa' },
  { id: 'item-11', content: 'Lambda' },
  { id: 'item-12', content: 'Mu' },
];

const avatarItems: readonly GravityWellItem[] = [
  { id: 'av-1', content: <AvatarBadge>AL</AvatarBadge> },
  { id: 'av-2', content: <AvatarBadge>BK</AvatarBadge> },
  { id: 'av-3', content: <AvatarBadge>CR</AvatarBadge> },
  { id: 'av-4', content: <AvatarBadge>DT</AvatarBadge> },
  { id: 'av-5', content: <AvatarBadge>EF</AvatarBadge> },
  { id: 'av-6', content: <AvatarBadge>GH</AvatarBadge> },
  { id: 'av-7', content: <AvatarBadge>IJ</AvatarBadge> },
  { id: 'av-8', content: <AvatarBadge>KL</AvatarBadge> },
  { id: 'av-9', content: <AvatarBadge>MN</AvatarBadge> },
  { id: 'av-10', content: <AvatarBadge>OP</AvatarBadge> },
  { id: 'av-11', content: <AvatarBadge>QR</AvatarBadge> },
  { id: 'av-12', content: <AvatarBadge>ST</AvatarBadge> },
];

const controlLabels = {
  pause: 'Pause motion',
  resume: 'Resume motion',
};

const meta = {
  title: 'Showcase/GravityWell',
  component: GravityWell,
  tags: ['autodocs'],
  args: {
    items: defaultItems,
    label: 'Team directory showcase',
    controlLabels,
    onPulse: fn(),
    onValueChange: fn(),
    onPausedChange: fn(),
  },
  parameters: {
    docs: {
      description: {
        component:
           'Arrange logos, portraits or noninteractive tiles in a wall that responds to the pointer and keyboard.',
      },
      source: {
        language: 'tsx',
        code: `import { GravityWell } from '@jfrader/ui/gravity-well';

<GravityWell
  items={[
    { id: 'alpha', content: 'Alpha' },
    { id: 'beta', content: 'Beta' },
  ]}
  label="Team directory showcase"
  controlLabels={{ pause: 'Pause motion', resume: 'Resume motion' }}
/>`,
      },
      usage: `### Content
Supply unique item ids and noninteractive content. Do not put links, buttons or focusable descendants in tiles. This is a named group containing a list, not a selectable grid or gallery.

### Keyboard
Tab reaches the field and then the pause button. Arrow keys move the visual marker by row or column, with Left/Right reversed in RTL. Home and End move to the first and last item. Enter or Space requests one pulse. Moving the marker does not select an item. Controlled value requests only commit when the parent updates value.

### Motion
Use the pause button to freeze motion. Reduced motion and forced colors show static tiles. More than 60 items render without animated transforms.`,
    },
  },
  render: (args) => (
    <Frame>
      <WallCaption>STUDIO DIRECTORY</WallCaption>
      <WallTitle>Meet the teams</WallTitle>
      <GravityWell {...args} />
    </Frame>
  ),
} satisfies Meta<typeof GravityWell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { columns: 6 },
  play: async ({ canvasElement }) => {
    const field = canvasElement.querySelector('[data-ui="gravity-well-field"]')!;
    const box = field.getBoundingClientRect();
    await expect(box.width).toBeGreaterThan(box.height);
    const tiles = canvasElement.querySelectorAll('[data-ui="gravity-well-tile"]');
    await expect(tiles[1]!.getBoundingClientRect().left).toBeGreaterThan(tiles[0]!.getBoundingClientRect().left);
  },
};

export const FixedColumns: Story = {
  args: {
    columns: 3,
    items: defaultItems.slice(0, 9),
  },
};

export const NarrowContainer: Story = {
  parameters: { docs: { description: { story: 'Fixed columns keep their minimum tile size in a narrow container instead of collapsing.' } } },
  render: (args) => (
    <div style={{ inlineSize: 200 }}>
      <GravityWell {...args} />
    </div>
  ),
  args: { columns: 3, items: defaultItems.slice(0, 9) },
  play: async ({ canvasElement }) => {
    const field = canvasElement.querySelector<HTMLElement>('[data-ui="gravity-well-field"]');
    if (!field) throw new Error('Missing gravity-well field');
    for (const tile of Array.from(field.querySelectorAll<HTMLElement>('[data-ui="gravity-well-tile"]'))) {
      await expect(tile.getBoundingClientRect().width).toBeGreaterThanOrEqual(56 - 0.5);
    }
    // Borders round the client area down by up to a pixel per side; the tiles must not clip.
    await expect(field.scrollWidth).toBeLessThanOrEqual(field.clientWidth + 2);
  },
};

export const AutoColumns: Story = {
  args: {
    minTileSize: 72,
    items: Array.from({ length: 16 }, (_, i) => ({
      id: `auto-${i + 1}`,
      content: `Item ${i + 1}`,
    })),
  },
};

export const ZeroStrength: Story = {
  args: {
    strength: 0,
  },
};

export const Static: Story = {
  args: {
    interactive: false,
  },
};

export const SixtyTiles: Story = {
  args: {
    items: Array.from({ length: 60 }, (_, i) => ({
      id: `tile-${i + 1}`,
      content: `${i + 1}`,
    })),
  },
};

export const OverBudgetStatic: Story = {
  args: {
    items: Array.from({ length: 64 }, (_, i) => ({
      id: `over-${i + 1}`,
      content: `${i + 1}`,
    })),
  },
};

export const Empty: Story = {
  args: {
    items: [],
  },
};

export const AvatarWall: Story = {
  render: (args) => (
    <Frame>
      <GravityWell {...args} items={avatarItems} />
    </Frame>
  ),
};

export const FalsyTile: Story = {
  args: {
    items: [
      { id: 'f-zero', content: 0 },
      { id: 'f-empty', content: '' },
      { id: 'f-false', content: false },
      { id: 'f-normal', content: 'Normal' },
    ],
  },
};

export const RaggedLastRow: Story = {
  args: {
    columns: 4,
    items: defaultItems.slice(0, 10),
  },
};

export const LongNames: Story = {
  render: (args) => (
    <Frame>
      <GravityWell
        {...args}
        columns={3}
        items={[
          {
            id: 'long-1',
            content: (
              <LongText>Supercalifragilisticexpialidocious Department</LongText>
            ),
          },
          {
            id: 'long-2',
            content: (
              <LongText>International Telecommunications Committee</LongText>
            ),
          },
          {
            id: 'long-3',
            content: (
              <LongText>Distributed Autonomous Infrastructure Team</LongText>
            ),
          },
        ]}
      />
    </Frame>
  ),
};

export const LightTheme: Story = {
  globals: { theme: 'light' },
};

export const RTL: Story = {
  args: {
    dir: 'rtl',
  },
};

export const ReducedMotion: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'When reduced motion is preferred, transforms are frozen, rendering a static grid while keyboard location remains operable.',
      },
    },
  },
};

export const ForcedColors: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Under forced colors, high-contrast system outlines mark active cells without color dimming.',
      },
    },
  },
};
