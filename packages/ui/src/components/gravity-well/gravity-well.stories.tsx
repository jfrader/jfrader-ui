import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { styled } from '../../styling/styled';
import { FORCED_COLORS } from '../../styling/media';
import { GravityWell, type GravityWellItem } from './index';

type PricedTile = GravityWellItem & { price: number };
const PRICED_TILES: readonly PricedTile[] = [{ id: 'starter', content: 'Starter', price: 12 }];

/** Compile-time consumer check; never rendered. */
function GravityWellGenericChecks() {
  return (
    <GravityWell
      interactive={false}
      label="Plans"
      items={PRICED_TILES}
      renderItem={(item) => <span>{item.price}</span>}
    />
  );
}

/** Compile-time consumer check; never rendered. */
function GravityWellGenericRejection() {
  return (
    <GravityWell
      interactive={false}
      label="Plans"
      items={PRICED_TILES}
      // @ts-expect-error item carries the caller's fields, not arbitrary ones
      renderItem={(item) => <span>{item.missing}</span>}
    />
  );
}

const Frame = styled.div({
  display: 'grid',
  gap: vars.space[4],
  inlineSize: '100%',
  maxInlineSize: '640px',
  marginInline: 'auto',
  boxSizing: 'border-box',
  padding: vars.space[5],
  borderRadius: vars.radius.xl,
  background: vars.color.surfaceInset,
  border: `1px solid ${vars.color.border}`,
  [FORCED_COLORS]: { color: 'CanvasText', backgroundColor: 'Canvas' },
});

const WallTitle = styled.h2({
  margin: 0,
  fontFamily: vars.font.sans,
  fontSize: vars.textSize.lg,
  color: vars.color.text,
  [FORCED_COLORS]: { color: 'CanvasText' },
});

const WallCaption = styled.p({
  margin: 0,
  fontFamily: vars.font.sans,
  fontSize: vars.textSize.sm,
  color: vars.color.textMuted,
  [FORCED_COLORS]: { color: 'CanvasText' },
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

const directoryItemsCode = `const items = [
  'Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta',
  'Eta', 'Theta', 'Iota', 'Kappa', 'Lambda', 'Mu',
].map((content, index) => ({ id: 'item-' + (index + 1), content }));`;

function directoryCode(items: string, attributes = '', avatars = false) {
  return `import { styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';
import { GravityWell } from '@jfrader/ui/gravity-well';

const Frame = styled.div({
  display: 'grid', gap: vars.space[4],
  inlineSize: '100%', maxInlineSize: '640px', marginInline: 'auto',
  boxSizing: 'border-box', padding: vars.space[5],
  borderRadius: vars.radius.xl, background: vars.color.surfaceInset,
  border: \`1px solid \${vars.color.border}\`,
});
${avatars ? `const AvatarBadge = styled.span({
  fontWeight: 600, fontSize: vars.textSize.md, color: vars.color.text, userSelect: 'none',
});` : `const WallTitle = styled.h2({
  margin: 0, fontFamily: vars.font.sans, fontSize: vars.textSize.lg, color: vars.color.text,
});
const WallCaption = styled.p({
  margin: 0, fontFamily: vars.font.sans, fontSize: vars.textSize.sm, color: vars.color.textMuted,
});`}

${items}

export function Directory() {
  return <Frame>
    ${avatars ? '' : `<WallCaption>STUDIO DIRECTORY</WallCaption>
    <WallTitle>Meet the teams</WallTitle>`}
    <GravityWell items={items} label="Team directory showcase" ${attributes}
      controlLabels={{ pause: 'Pause motion', resume: 'Resume motion' }} />
  </Frame>;
}`;
}

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
    layout: 'padded',
    docs: {
      description: {
        component:
           'Arrange logos, portraits or noninteractive tiles in a wall that responds to the pointer and keyboard.',
      },
      sections: [
        { title: 'Directory', stories: ['Default', 'AvatarWall'] },
        { title: 'Layout', stories: ['FixedColumns', 'AutoColumns'] },
        { title: 'Motion', stories: ['Static'] },
      ],
      source: {
        language: 'tsx',
        code: directoryCode(directoryItemsCode, 'columns={6}'),
      },
      usage: `### Content
Supply unique item ids and noninteractive content. Do not put links, buttons or focusable descendants in tiles. This is a named group containing a list, not a selectable grid or gallery.

### Keyboard and accessibility

Tab reaches the field and then the pause button. Arrow keys move the visual marker by row or column, with Left/Right reversed in RTL. Home and End move to the first and last item. Enter or Space requests one pulse. Moving the marker does not select an item. In controlled use, accept location requests in your application before the marker moves.

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
  name: 'Team directory',
  parameters: { docs: {
    description: { story: 'Move the pointer over the teams or use arrow keys to move the marker.' },
    source: { language: 'tsx', code: directoryCode(directoryItemsCode, 'columns={6}') },
  } },
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
  name: 'Three-column directory',
  parameters: { docs: {
    description: { story: 'Keep nine teams arranged in three columns.' },
    source: { language: 'tsx', code: directoryCode(`const items = [
  'Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta', 'Iota',
].map((content, index) => ({ id: 'item-' + (index + 1), content }));`, 'columns={3}') },
  } },
  args: {
    columns: 3,
    items: defaultItems.slice(0, 9),
  },
};

export const NarrowContainer: Story = {
  parameters: { docs: { description: { story: 'Scroll fixed columns in a narrow container. Arrow keys keep the current tile in view.' } } },
  render: (args) => (
    <div style={{ inlineSize: 200 }}>
      <GravityWell {...args} />
    </div>
  ),
  args: { columns: 3, items: defaultItems.slice(0, 9), defaultPaused: true },
  play: async ({ canvasElement, userEvent, args }) => {
    const field = canvasElement.querySelector<HTMLElement>('[data-ui="gravity-well-field"]');
    if (!field) throw new Error('Missing gravity-well field');
    for (const tile of Array.from(field.querySelectorAll<HTMLElement>('[data-ui="gravity-well-tile"]'))) {
      await expect(tile.getBoundingClientRect().width).toBeGreaterThanOrEqual(56 - 0.5);
    }
    await expect(field.getBoundingClientRect().width).toBeLessThanOrEqual(200);
    await expect(getComputedStyle(field).overflowX).toBe('auto');
    await expect(field.scrollWidth).toBeGreaterThan(field.clientWidth);
    await userEvent.tab();
    await expect(field.ownerDocument.activeElement).toBe(field);
    await expect(getComputedStyle(field).outlineStyle).not.toBe('none');
    for (const key of ['{End}', '{Home}']) {
      await userEvent.keyboard(key);
      const active = field.querySelector('[aria-current="true"]')!.getBoundingClientRect();
      const bounds = field.getBoundingClientRect();
      await expect(active.left).toBeGreaterThanOrEqual(bounds.left + 4);
      await expect(active.right).toBeLessThanOrEqual(bounds.right - 4);
      await userEvent.keyboard('{Enter}');
      await expect(args.onPulse).toHaveBeenLastCalledWith(expect.objectContaining({
        x: active.left - bounds.left + active.width / 2,
        y: active.top - bounds.top + active.height / 2,
      }));
    }
    await expect(args.onPulse).toHaveBeenCalledTimes(2);
  },
};

export const NarrowContainerRtl: Story = {
  ...NarrowContainer,
  args: { ...NarrowContainer.args, dir: 'rtl' },
};

export const AutoColumns: Story = {
  name: 'Responsive columns',
  parameters: { docs: {
    description: { story: 'Resize the directory to fit columns around a 72-pixel minimum tile size.' },
    source: { language: 'tsx', code: directoryCode(`const items = Array.from({ length: 16 }, (_, index) => ({
  id: 'auto-' + (index + 1), content: 'Item ' + (index + 1),
}));`, 'minTileSize={72}') },
  } },
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
  name: 'Static directory',
  parameters: { docs: {
    description: { story: 'Display teams without pointer or keyboard motion.' },
    source: { language: 'tsx', code: directoryCode(directoryItemsCode, 'interactive={false}') },
  } },
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
  name: 'Portrait tiles',
  parameters: { docs: {
    description: { story: 'Use initials as noninteractive tile content.' },
    source: { language: 'tsx', code: directoryCode(`const items = [
  'AL', 'BK', 'CR', 'DT', 'EF', 'GH', 'IJ', 'KL', 'MN', 'OP', 'QR', 'ST',
].map((initials, index) => ({
  id: 'av-' + (index + 1), content: <AvatarBadge>{initials}</AvatarBadge>,
}));`, '', true) },
  } },
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
  name: 'Gravity Well Reduced Motion',
  parameters: {
    docs: {
      description: {
        story:
          'When reduced motion is preferred, transforms are frozen, rendering a static grid while keyboard location remains operable.',
      },
    },
  },
  play: async ({ canvasElement, userEvent, args }) => {
    await expect(window.matchMedia('(prefers-reduced-motion: reduce)').matches).toBe(true);
    const field = canvasElement.querySelector<HTMLElement>('[data-ui="gravity-well-field"]')!;
    await userEvent.tab();
    await expect(field).toBe(field.ownerDocument.activeElement);
    await userEvent.keyboard('{ArrowRight}{Enter}');
    await expect(args.onPulse).toHaveBeenCalledTimes(1);
    await expect(field.querySelector('[aria-current="true"]')).toHaveTextContent('Beta');
    for (const tile of field.querySelectorAll('[data-ui="gravity-well-tile"]')) {
      await expect(getComputedStyle(tile).transform).toBe('none');
      await expect(getComputedStyle(tile).transitionDuration).toBe('0s');
    }
  },
};

export const ForcedColors: Story = {
  name: 'Gravity Well Forced Colors',
  parameters: {
    docs: {
      description: {
        story:
          'Under forced colors, high-contrast system outlines mark active cells without color dimming.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const field = canvasElement.querySelector('[data-ui="gravity-well-field"]')!;
    const tile = canvasElement.querySelector('[data-ui="gravity-well-tile"]')!;
    await expect(window.matchMedia('(forced-colors: active)').matches).toBe(true);
    await expect(getComputedStyle(tile).backgroundColor).toBe(getComputedStyle(field).backgroundColor);
    await expect(getComputedStyle(tile).borderTopColor).toBe(getComputedStyle(field).borderTopColor);
    await expect(getComputedStyle(tile).forcedColorAdjust).toBe('auto');
  },
};
