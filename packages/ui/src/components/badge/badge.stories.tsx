import type { ComponentPropsWithRef, CSSProperties } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { withLightTheme } from '../../testing/story-decorators';
import { Badge, type BadgeTone } from './index';

const TONES = ['accent', 'danger', 'neutral'] as const satisfies readonly BadgeTone[];

function SlotBadge(props: ComponentPropsWithRef<'span'>) {
  return <span {...props} data-slot="badge-marker" />;
}

export const MarkerReplacement: Story = {
  render: (args) => <Badge {...args} variant="dot" slots={{ badge: SlotBadge }} />,
  play: async ({ canvasElement }) => {
    const marker = canvasElement.querySelector('[data-slot="badge-marker"]');
    await expect(marker).toBeInTheDocument();
    await expect(marker).toHaveAttribute('data-ui', 'badge-marker');
    await expect(getComputedStyle(marker!).position).toBe('absolute');
    await expect(marker).toHaveAttribute('aria-hidden', 'true');
    await expect(canvasElement.querySelector('[data-ui="badge-marker"]:not([data-slot])')).toBeNull();
  },
};
const MARKER = '[data-ui="badge-marker"]';
const DOT_PX = 8;
const POSITION_TOLERANCE_PX = 1;

const rowStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: vars.space[6],
  padding: vars.space[3],
});

const squareStyle = {
  display: 'block',
  inlineSize: vars.space[6],
  blockSize: vars.space[6],
  borderRadius: vars.radius.sm,
  backgroundColor: vars.color.surfaceHover,
  border: `1px solid ${vars.color.borderStrong}`,
  boxSizing: 'border-box',
} satisfies CSSProperties;

const circleStyle = { borderRadius: vars.radius.full } satisfies CSSProperties;

const slotRootStyle = css({ marginInlineStart: vars.space[4] });
const slotBadgeStyle = css({ fontWeight: vars.fontWeight.semibold });

function Square({ round = false }: { round?: boolean }) {
  return <span style={{ ...squareStyle, ...(round ? circleStyle : {}) }} />;
}
Square.displayName = 'Square';

function getRoots(canvasElement: HTMLElement) {
  return Array.from(canvasElement.querySelectorAll<HTMLElement>('[data-ui="badge"]'));
}

function getMarker(root: HTMLElement) {
  return root.querySelector<HTMLElement>(MARKER);
}

// The marker's center sits on the anchored corner of the child.
function markerCenter(marker: HTMLElement) {
  const rect = marker.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

async function expectMarkerAt(marker: HTMLElement, x: number, y: number) {
  const center = markerCenter(marker);
  await expect(Math.abs(center.x - x)).toBeLessThanOrEqual(POSITION_TOLERANCE_PX);
  await expect(Math.abs(center.y - y)).toBeLessThanOrEqual(POSITION_TOLERANCE_PX);
}

const meta = {
  title: 'Data display/Badge',
  component: Badge,
  parameters: {
    docs: {
      description: { component: 'Add a count or dot to an icon or control.' },
      usage: '- The count does not join the control’s accessible name. If the control has an `aria-label`, include the count, for example `Inbox, 3 unread`.\n- When the control is named by its text, the count is read after its name.',
    },
  },
  args: { children: <Square />, badgeContent: 4 },
  argTypes: {
    variant: { control: 'radio', options: ['standard', 'dot'] },
    tone: { control: 'select', options: TONES },
    overlap: { control: 'radio', options: ['rectangular', 'circular'] },
  },
  decorators: [
    (Story) => (
      <div css={rowStyle}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Badge>;

export default meta;

type Story = StoryObj<typeof meta>;

/** If the wrapped control has an `aria-label`, include the count in it: `aria-label="Inbox, 3 unread"`. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const [root] = getRoots(canvasElement);
    const marker = within(canvasElement).getByText('4');
    await expect(marker).toHaveAttribute('data-ui', 'badge-marker');
    await expect(marker).toHaveAttribute('data-tone', 'accent');
    await expect(marker).not.toHaveAttribute('aria-hidden');
    await expect(root).toHaveTextContent('4');
    const rootRect = root!.getBoundingClientRect();
    await expectMarkerAt(marker, rootRect.right, rootRect.top);
  },
};

export const MaxContent: Story = {
  render: (args) => (
    <>
      <Badge {...args} badgeContent={1500} />
      <Badge {...args} badgeContent={10} max={9} />
      <Badge {...args} badgeContent={9} max={9} />
      <Badge {...args} badgeContent={-7} />
      <Badge {...args} badgeContent={7} max={0} />
    </>
  ),
  play: async ({ canvasElement }) => {
    const markers = getRoots(canvasElement).map(getMarker);
    await expect(markers.map((marker) => marker?.textContent)).toEqual(['99+', '9+', '9', '-7', '0+']);
  },
};

export const ShowZero: Story = {
  render: (args) => (
    <>
      <Badge {...args} badgeContent={0} />
      <Badge {...args} badgeContent={0} showZero />
    </>
  ),
  play: async ({ canvasElement }) => {
    const [hidden, shown] = getRoots(canvasElement);
    await expect(getMarker(hidden!)).toBeNull();
    await expect(getMarker(shown!)).toHaveTextContent(/^0$/);
  },
};

export const VisibilityMatrix: Story = {
  render: (args) => (
    <>
      <Badge {...args} badgeContent={0} />
      <Badge {...args} badgeContent={0} showZero />
      <Badge {...args} badgeContent={undefined} />
      <Badge {...args} badgeContent={undefined} showZero />
      <Badge {...args} badgeContent={null} />
      <Badge {...args} badgeContent={false} />
      <Badge {...args} badgeContent={true} />
      <Badge {...args} badgeContent={7} />
    </>
  ),
  play: async ({ canvasElement }) => {
    const [zero, shownZero, absent, absentWithShowZero, nullContent, falseContent, trueContent, seven] =
      getRoots(canvasElement);
    for (const root of [zero, absent, absentWithShowZero, nullContent, falseContent, trueContent]) {
      await expect(getMarker(root!)).toBeNull();
    }
    await expect(getMarker(shownZero!)).toBeVisible();
    await expect(getMarker(shownZero!)).toHaveTextContent(/^0$/);
    await expect(getMarker(seven!)).toBeVisible();
    await expect(getMarker(seven!)).toHaveTextContent(/^7$/);
  },
};

export const Dot: Story = {
  args: { variant: 'dot' },
  render: (args) => (
    <>
      <Badge {...args} />
      <Badge {...args} badgeContent={undefined} />
      <Badge {...args} badgeContent={undefined} invisible />
    </>
  ),
  play: async ({ canvasElement }) => {
    const [withContent, withoutContent, invisible] = getRoots(canvasElement);
    const marker = getMarker(withContent!) as HTMLElement;
    await expect(marker).toHaveAttribute('aria-hidden', 'true');
    await expect(marker).toHaveAttribute('data-variant', 'dot');
    await expect(marker.textContent).toBe('');
    const rect = marker.getBoundingClientRect();
    await expect(Math.round(rect.width)).toBe(DOT_PX);
    await expect(Math.round(rect.height)).toBe(DOT_PX);
    const emptyDot = getMarker(withoutContent!);
    await expect(emptyDot).toBeVisible();
    await expect(emptyDot).toHaveAttribute('data-variant', 'dot');
    await expect(emptyDot).toHaveAttribute('aria-hidden', 'true');
    await expect(emptyDot).toBeEmptyDOMElement();
    await expect(getMarker(invisible!)).toBeNull();
  },
};

export const Invisible: Story = {
  args: { invisible: true },
  play: async ({ canvasElement }) => {
    const [root] = getRoots(canvasElement);
    await expect(getMarker(root!)).toBeNull();
    await expect(root).not.toHaveTextContent('4');
  },
};

export const Anchors: Story = {
  render: (args) => (
    <>
      <Badge {...args} anchor={{ vertical: 'top', horizontal: 'start' }} />
      <Badge {...args} anchor={{ vertical: 'top', horizontal: 'end' }} />
      <Badge {...args} anchor={{ vertical: 'bottom', horizontal: 'start' }} />
      <Badge {...args} anchor={{ vertical: 'bottom', horizontal: 'end' }} />
    </>
  ),
  play: async ({ canvasElement }) => {
    const corners = [
      { x: 'left', y: 'top' },
      { x: 'right', y: 'top' },
      { x: 'left', y: 'bottom' },
      { x: 'right', y: 'bottom' },
    ] as const;
    for (const [index, root] of getRoots(canvasElement).entries()) {
      const rect = root.getBoundingClientRect();
      const corner = corners[index]!;
      await expectMarkerAt(getMarker(root) as HTMLElement, rect[corner.x], rect[corner.y]);
    }
  },
};

export const OverlapCircular: Story = {
  args: { overlap: 'circular', children: <Square round /> },
  play: async ({ canvasElement }) => {
    const marker = getMarker(getRoots(canvasElement)[0]!) as HTMLElement;
    const { borderTopLeftRadius } = getComputedStyle(marker);
    await expect(parseFloat(borderTopLeftRadius)).toBeGreaterThanOrEqual(marker.getBoundingClientRect().height / 2);
  },
};

export const RTL: Story = {
  render: (args) => (
    <div dir="rtl">
      <Badge {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const [root] = getRoots(canvasElement);
    const marker = getMarker(root!) as HTMLElement;
    await expect(getComputedStyle(marker).insetInlineEnd).toBe('0px');
    // Inline-end is the left edge in RTL: the marker straddles the child's top-left corner.
    const rootRect = root!.getBoundingClientRect();
    await expectMarkerAt(marker, rootRect.left, rootRect.top);
    await expect(marker.getBoundingClientRect().left).toBeLessThan(rootRect.left);
  },
};

export const SlotProps: Story = {
  args: {
    className: 'consumer-root',
    slotProps: {
      root: { className: 'slot-root', css: slotRootStyle },
      badge: { className: 'slot-badge', css: slotBadgeStyle },
    },
  },
  play: async ({ canvasElement }) => {
    const [root] = getRoots(canvasElement);
    const marker = getMarker(root!) as HTMLElement;
    await expect(root).toHaveClass('consumer-root', 'slot-root');
    await expect(marker).toHaveClass('slot-badge');
    await expect(getComputedStyle(root!).marginInlineStart).toBe('16px');
    await expect(getComputedStyle(marker).fontWeight).toBe('600');
  },
};

export const LightTheme: Story = {
  decorators: [withLightTheme],
  render: (args) => (
    <>
      {TONES.map((tone) => (
        <Badge {...args} key={tone} tone={tone} />
      ))}
      {TONES.map((tone) => (
        <Badge {...args} key={`dot-${tone}`} tone={tone} variant="dot" />
      ))}
    </>
  ),
  play: async ({ canvasElement }) => {
    const markers = canvasElement.querySelectorAll(MARKER);
    await expect(markers).toHaveLength(TONES.length * 2);
  },
};
