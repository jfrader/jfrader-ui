import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, waitFor, within } from 'storybook/test';
import { MotionConfig } from 'motion/react';
import { vars } from '@jfrader/tokens/vars';
import { styled } from '../../styling/styled';
import { withLightTheme } from '../../testing/story-decorators';
import { settleMotion } from '../../testing/motion-assertions';
import { expectInside, expectNoOverlap } from '../../testing/geometry-assertions';
import { RadialMenu, type RadialMenuAction } from './index';
import { Surface } from '../surface';

const Frame = styled(Surface)({
  boxSizing: 'border-box',
  inlineSize: `calc(${vars.space[8]} * 18)`,
  maxInlineSize: '100%',
  minBlockSize: `calc(${vars.space[8]} * 12)`,
  display: 'grid',
  gridTemplateRows: 'auto minmax(0, 1fr)',
  placeItems: 'center',
  padding: vars.space[8],
  gap: vars.space[4],
});
const NoteLabel = styled.p({
  justifySelf: 'start',
  margin: 0,
  fontFamily: vars.font.sans,
  fontSize: vars.textSize.sm,
  color: vars.color.textMuted,
});
const icon = (d: string) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);
const iconPaths = {
  copy: 'M7 7h9v9H7zM4 13V4h9',
  edit: 'M4 16l1-4 8-8 3 3-8 8zM11 6l3 3',
  share: 'M9 4H4v12h12v-5M12 4h4v4M16 4l-7 7',
  star: 'M10 3l2.2 4.5 4.8.7-3.5 3.4.8 4.9L10 14.2l-4.3 2.3.8-4.9L3 8.2l4.8-.7z',
  flag: 'M5 17V3M5 4h10l-2 3.5L15 11H5',
  move: 'M4 10h12M11 5l5 5-5 5',
  archive: 'M3 4h14v4H3zM4 8v8h12V8M8 11h4',
  delete: 'M4 6h12M8 6V4h4v2M6 6l1 10h6l1-10',
};
type ActionSpec = Omit<RadialMenuAction, 'id' | 'icon'> & { id: keyof typeof iconPaths };
const threeSpecs: readonly ActionSpec[] = [
  { id: 'copy', label: 'Copy' },
  { id: 'archive', label: 'Archive' },
  { id: 'delete', label: 'Delete', tone: 'danger' },
];
const eightSpecs: readonly ActionSpec[] = [
  { id: 'copy', label: 'Copy' },
  { id: 'edit', label: 'Edit' },
  { id: 'share', label: 'Share' },
  { id: 'star', label: 'Star' },
  { id: 'flag', label: 'Flag' },
  { id: 'move', label: 'Move' },
  { id: 'archive', label: 'Archive' },
  { id: 'delete', label: 'Delete', tone: 'danger' },
];
const toAction = (spec: ActionSpec): RadialMenuAction => ({ ...spec, icon: icon(iconPaths[spec.id]) });
const actions = threeSpecs.map(toAction);
const eightActions = eightSpecs.map(toAction);
const specLines = (specs: readonly ActionSpec[]) =>
  specs
    .map(({ id, label, tone }) => `  { id: '${id}', label: '${label}', icon: icon('${iconPaths[id]}')${tone ? `, tone: '${tone}'` : ''} },`)
    .join('\n');
const snippet = (specs: readonly ActionSpec[], props = '') => `import { RadialMenu, Surface, styled, type RadialMenuAction, type RadialMenuProps } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const icon = (d: string) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const Frame = styled(Surface)({
  boxSizing: 'border-box',
  inlineSize: \`calc(\${vars.space[8]} * 18)\`,
  maxInlineSize: '100%',
  minBlockSize: \`calc(\${vars.space[8]} * 12)\`,
  display: 'grid',
  gridTemplateRows: 'auto minmax(0, 1fr)',
  placeItems: 'center',
  padding: vars.space[8],
  gap: vars.space[4],
});
const NoteLabel = styled.p({
  justifySelf: 'start', margin: 0, fontFamily: vars.font.sans,
  fontSize: vars.textSize.sm, color: vars.color.textMuted,
});
const actions: readonly RadialMenuAction[] = [
${specLines(specs)}
];

export function NoteActions({ onAction }: Pick<RadialMenuProps, 'onAction'>) {
  return (
    <Frame>
      <NoteLabel>Product notes · Launch checklist</NoteLabel>
      <RadialMenu label="Note actions" actions={actions}${props} onAction={onAction} />
    </Frame>
  );
}`;

const body = (canvasElement: HTMLElement) => within(canvasElement.ownerDocument.body);
async function expectRing(menu: HTMLElement, trigger: HTMLElement) {
  const items = within(menu).getAllByRole('menuitem');
  await expect(menu).toHaveAttribute('data-linear', 'false');
  for (const [index, item] of items.entries()) {
    const box = item.getBoundingClientRect();
    await expect(box.width).toBeGreaterThanOrEqual(44);
    await expect(Math.abs(box.width - box.height)).toBeLessThan(0.5);
    await expectNoOverlap(item, trigger);
    await expectInside(item, item.ownerDocument.documentElement);
    for (const other of items.slice(index + 1)) await expectNoOverlap(item, other);
  }
}

const meta = {
  title: 'Showcase/RadialMenu',
  component: RadialMenu,
  tags: ['autodocs'],
  args: { label: 'Note actions', actions, onAction: fn(), onOpenChange: fn() },
  render: (args) => (
    <Frame>
      <NoteLabel>Product notes · Launch checklist</NoteLabel>
      <RadialMenu {...args} />
    </Frame>
  ),
  parameters: {
    layout: 'padded',
    a11y: {
      config: {
        rules: [
          {
            id: 'aria-hidden-focus',
            selector:
              '[aria-hidden="true"]:not([data-floating-ui-focus-guard])',
          },
        ],
      },
    },
    docs: {
      sections: [
        { title: 'Object actions', stories: ['Default', 'EightActions'] },
      ],
      description: {
        component:
          'Choose a short object action from buttons arranged around a trigger.',
      },
      usage: `### Keyboard and accessibility

Enter, Space and ArrowDown open the menu. ArrowUp opens on the last action. Up/Down and Left/Right wrap between enabled actions; horizontal arrows follow RTL. Home/End jump, and typing finds an action. Escape returns to the trigger after an accepted close. Tab leaves without moving focus back.

Click the hub, then an action. Hold the hub for 250ms and drag over an action to select on release. Release elsewhere to cancel. Disabled actions cannot run. A pending action blocks repeat requests; a rejection leaves a readable failure and allows retry.

\`label\` names the hub button. The focused, hovered or targeted action's label shows between the hub and the arc.

### Values and constraints

Use three to eight actions. The arc widens past \`spread\`, up to a full ring, when the actions need more room. More than eight actions, a radius that cannot clear the hub, or a viewport that cannot fit the ring use a vertical menu. Reduced motion removes the entrance animation.`,
      source: { language: 'tsx', code: snippet(threeSpecs) },
    },
  },
} satisfies Meta<typeof RadialMenu>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  name: 'Note actions',
  parameters: { docs: { description: { story: 'Open the hub to copy, archive or delete a note.' } } },
};
export const EightActions: Story = {
  name: 'Eight actions',
  args: { actions: eightActions },
  parameters: { docs: {
    description: { story: 'Open eight actions; the arc closes into a full ring around the hub.' },
    source: { language: 'tsx', code: snippet(eightSpecs) },
  } },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const trigger = canvas.getByRole('button', { name: 'Note actions' });
    await userEvent.click(trigger);
    const menu = await body(canvasElement).findByRole('menu');
    await settleMotion(menu);
    await expectRing(menu, trigger);
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(trigger).toHaveFocus());
  },
};
export const Light: Story = {
  globals: { theme: 'light' },
  decorators: [withLightTheme],
};
export const RTL: Story = { args: { dir: 'rtl' } };
export const Disabled: Story = { args: { disabled: true } };
export const Empty: Story = { args: { actions: [] } };
export const ReducedMotion: Story = {
  name: 'Reduced motion',
  decorators: [(Story) => <MotionConfig reducedMotion="always"><Story /></MotionConfig>],
  parameters: {
    docs: {
      description: {
        story:
          'Open the hub; actions appear in place without flying out.',
      },
    },
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const trigger = canvas.getByRole('button', { name: 'Note actions' });
    await userEvent.click(trigger);
    const menu = body(canvasElement).getByRole('menu');
    await expect(menu).toHaveAttribute('data-reduced-motion');
    for (const item of within(menu).getAllByRole('menuitem')) {
      await expect(getComputedStyle(item).transitionDuration.split(', ').every((value) => value === '0s')).toBe(true);
    }
    await userEvent.keyboard('{Escape}');
    await expect(body(canvasElement).queryByRole('menu')).toBeNull();
    await expect(trigger).toHaveFocus();
  },
};
export const PersistentOpen: Story = {
  tags: ['!autodocs'],
  args: { defaultOpen: true },
  play: async ({ canvas, canvasElement }) => {
    const menu = await body(canvasElement).findByRole('menu');
    await settleMotion(menu);
    const trigger = canvas.getByRole('button', { name: 'Note actions' });
    const hub = trigger.getBoundingClientRect();
    await expect(hub.width).toBeGreaterThanOrEqual(44);
    await expect(Math.abs(hub.width - hub.height)).toBeLessThan(0.5);
    await expectRing(menu, trigger);
    // The ring is concentric with the hub.
    const box = menu.getBoundingClientRect();
    await expect(Math.abs(box.left + box.width / 2 - (hub.left + hub.width / 2))).toBeLessThan(1);
    await expect(Math.abs(box.top + box.height / 2 - (hub.top + hub.height / 2))).toBeLessThan(1);
  },
};
export const LinearFallback: Story = {
  tags: ['!autodocs'],
  args: { defaultOpen: true, radius: 40, spread: 20 },
  play: async ({ canvasElement }) => {
    const menu = await body(canvasElement).findByRole('menu');
    await settleMotion(menu);
    await expect(menu).toHaveAttribute('data-linear', 'true');
    for (const [index, item] of within(menu).getAllByRole('menuitem').entries()) {
      await expect(item).toHaveTextContent(actions[index]!.label);
      await expect(item.getBoundingClientRect().height).toBeGreaterThanOrEqual(32);
      await expect(item.getBoundingClientRect().width).toBeGreaterThan(item.getBoundingClientRect().height);
    }
    await expect(menu.querySelector('[data-ui~="radial-menu-caption"]')).toBeNull();
  },
};
export const LongActionList: Story = {
  tags: ['!autodocs'],
  args: {
    defaultOpen: true,
    actions: Array.from({ length: 16 }, (_, index) => ({
      id: `archive-${index}`,
      label: `Archive revision ${index + 1}: ProductLaunchChecklistForTheUpcomingRelease`,
    })),
  },
  play: async ({ canvasElement, userEvent }) => {
    const doc = canvasElement.ownerDocument;
    const menu = await within(doc.body).findByRole('menu');
    await settleMotion(menu);
    await expectInside(menu, doc.documentElement);
    await expect(menu.scrollHeight).toBeGreaterThan(menu.clientHeight);
    await expect(menu.scrollWidth).toBeLessThanOrEqual(menu.clientWidth);
    const items = within(menu).getAllByRole('menuitem');
    for (const item of items) {
      await expect(item.getBoundingClientRect().height).toBeGreaterThanOrEqual(32);
    }
    await userEvent.keyboard('{End}');
    await expect(doc.activeElement).toBe(items.at(-1));
    await expectInside(items.at(-1)!, menu);
  },
};
export const Keyboard: Story = {
  tags: ['!autodocs'],
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    await expect(canvas.queryByRole('status')).toBeNull();
    const trigger = canvas.getByRole('button', { name: 'Note actions' });
    const doc = canvasElement.ownerDocument;
    await userEvent.tab();
    await expect(trigger).toHaveFocus();
    await expect(getComputedStyle(trigger).outlineStyle).not.toBe('none');
    await userEvent.keyboard('{ArrowUp}');
    const menu = await within(doc.body).findByRole('menu');
    const items = within(menu).getAllByRole('menuitem');
    const caption = () => menu.querySelector('[data-ui~="radial-menu-caption"]');
    await waitFor(() => expect(doc.activeElement).toBe(items[2]));
    await expect(caption()).toHaveTextContent('Delete');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await userEvent.keyboard('{Home}');
    await expect(doc.activeElement).toBe(items[0]);
    await expect(caption()).toHaveTextContent('Copy');
    await expect(getComputedStyle(items[0]!).outlineStyle).not.toBe('none');
    await userEvent.keyboard('{ArrowDown}');
    await expect(doc.activeElement).toBe(items[1]);
    await expect(caption()).toHaveTextContent('Archive');
    await userEvent.keyboard('{End}{Escape}');
    await waitFor(() => expect(trigger).toHaveFocus());
    await userEvent.keyboard('{Enter}');
    const reopened = await within(doc.body).findByRole('menu');
    await userEvent.click(
      within(reopened).getByRole('menuitem', { name: 'Copy' }),
    );
    await expect(args.onAction).toHaveBeenCalledTimes(1);
    await expect(args.onAction).toHaveBeenCalledWith('copy');
    await waitFor(() => expect(trigger).toHaveFocus());
  },
};
export const RejectedOpen: Story = {
  tags: ['!autodocs'],
  args: { open: false },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Note actions' }));
    await expect(args.onOpenChange).toHaveBeenCalledWith(true);
    await expect(
      within(canvasElement.ownerDocument.body).queryByRole('menu'),
    ).toBeNull();
  },
};
export const HoldDrag: Story = {
  tags: ['!autodocs'],
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const trigger = canvas.getByRole('button', { name: 'Note actions' });
    await userEvent.pointer({ target: trigger, keys: '[MouseLeft>]' });
    const menu = await within(canvasElement.ownerDocument.body).findByRole(
      'menu',
    );
    await settleMotion(menu);
    const action = within(menu).getByRole('menuitem', { name: 'Archive' });
    const rect = action.getBoundingClientRect();
    await userEvent.pointer({
      target: trigger,
      coords: {
        clientX: rect.x + rect.width / 2,
        clientY: rect.y + rect.height / 2,
      },
    });
    await expect(action).toHaveAttribute('data-targeted', 'true');
    await expect(menu.querySelector('[data-ui~="radial-menu-caption"]')).toHaveTextContent('Archive');
    await userEvent.pointer({ target: trigger, keys: '[/MouseLeft]' });
    await expect(args.onAction).toHaveBeenCalledTimes(1);
    await expect(args.onAction).toHaveBeenCalledWith('archive');
    await waitFor(() =>
      expect(
        within(canvasElement.ownerDocument.body).queryByRole('menu'),
      ).toBeNull(),
    );
  },
};
export const Pending: Story = {
  tags: ['!autodocs'],
  args: { defaultOpen: true, onAction: fn(() => new Promise<void>(() => {})) },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const menu = await within(canvasElement.ownerDocument.body).findByRole(
      'menu',
    );
    await settleMotion(menu);
    const copy = within(menu).getByRole('menuitem', { name: 'Copy' });
    await userEvent.click(copy);
    await userEvent.click(copy);
    await expect(args.onAction).toHaveBeenCalledTimes(1);
    await expect(menu).toHaveAttribute('aria-busy', 'true');
    await expect(copy.querySelector('[data-ui~="spinner-indicator"]')).not.toBeNull();
    await expect(canvas.getByRole('status')).toHaveTextContent('Copy: pending');
  },
};
export const RejectedClose: Story = {
  tags: ['!autodocs'],
  args: { open: true },
  play: async ({ canvasElement, userEvent }) => {
    const menu = await within(canvasElement.ownerDocument.body).findByRole(
      'menu',
    );
    await settleMotion(menu);
    const copy = within(menu).getByRole('menuitem', { name: 'Copy' });
    copy.focus();
    await userEvent.keyboard('{Escape}');
    await expect(menu).toBeVisible();
    await expect(copy).toHaveFocus();
  },
};
export const Failure: Story = {
  tags: ['!autodocs'],
  args: {
    defaultOpen: true,
    onAction: fn(async () => {
      throw new Error('Unavailable');
    }),
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const menu = await within(canvasElement.ownerDocument.body).findByRole(
      'menu',
    );
    await settleMotion(menu);
    await userEvent.click(within(menu).getByRole('menuitem', { name: 'Copy' }));
    await expect(await canvas.findByRole('status')).toHaveTextContent(
      'Copy: failed',
    );
  },
};
