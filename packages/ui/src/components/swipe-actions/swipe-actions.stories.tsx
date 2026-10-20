import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, fireEvent, waitFor, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { withLightTheme } from '../../testing/story-decorators';
import {
  SwipeActions,
  type SwipeAction,
  type SwipeActionsCompoundProps,
  type SwipeActionsEasyProps,
  type SwipeActionsRecord,
  type SwipeActionsValue,
} from './index';
// `styled` is the app-facing styling API; consumers import it from `@jfrader/ui`.
import { styled } from '../../index';

const ListFrame = styled(SwipeActions)({ maxWidth: 480 });

const ResponsiveList = styled(SwipeActions)({ width: 480, maxWidth: '100%' });

const FixedList = styled(SwipeActions)({ width: 480 });

const FixtureButton = styled.button({ minHeight: vars.space[8] });

const CompactList = styled(SwipeActions)({ maxWidth: 320 });

const select = fn();
// These values exercise the documented css/sx and slot styling APIs.
const easyRowStyle = css({ paddingBlock: vars.space[2] });
const change = fn();
const leading: readonly SwipeAction[] = [
  {
    id: 'read',
    label: 'Mark as read',
    tone: 'accent',
    onSelect: () => select('read'),
  },
];
const trailing: readonly SwipeAction[] = [
  {
    id: 'archive',
    label: 'Archive',
    keepRow: true,
    onSelect: () => select('archive'),
  },
  {
    id: 'delete',
    label: 'Delete message',
    tone: 'danger',
    onSelect: () => select('delete'),
  },
];
const invoiceRow: SwipeActionsRecord = {
  id: 'invoice',
  label: 'Invoice',
  actionsLabel: 'Actions for Invoice',
  content: 'Invoice from Morgan',
  trailing,
};
const snippet = `<SwipeActions aria-label="Inbox" rows={[
  { id: 'invoice', label: 'Invoice', actionsLabel: 'Actions for Invoice', content: 'Invoice',
    trailing: [{ id: 'archive', label: 'Archive', onSelect: archive }] },
]} />`;
const meta = {
  title: 'Actions/SwipeActions',
  component: SwipeActions,
  tags: ['autodocs'],
  args: { 'aria-label': 'Inbox', onValueChange: change },
  parameters: {
    docs: {
      sections: [
        { title: 'Row actions', stories: ['EasyMode', 'Default'] },
        { title: 'Interaction', stories: ['KeepRow', 'ControlledRail'] },
      ],
      source: { code: snippet },
      description: {
        component:
          'Swipe a row to reveal actions, or open its actions menu.',
      },
      usage: `### Actions
- Use stable row identities and paginate long lists.
- Handle removal, confirmation, errors and undo in your app. Actions do not delete rows.
- The actions button offers the same commands as swiping.
- A full swipe can activate an action directly; ask for confirmation before destructive work.

### Keyboard and accessibility

- Enter, Space or ArrowDown opens the first menu item. ArrowUp opens the last.
- Arrows wrap and skip disabled commands. Home, End and typing move between commands.
- Escape closes the menu and restores focus. Tab leaves.`,
    },
    a11y: {
      config: {
        rules: [
          {
            id: 'aria-hidden-focus',
            selector: '[aria-hidden="true"]:not([data-floating-ui-focus-guard])',
          },
        ],
      },
    },
  },
  render: (args) => (
    <ListFrame {...args}>
      <SwipeActions.Row
        id="invoice"
        label="Invoice"
        actionsLabel="Actions for Invoice"
        leading={leading}
        trailing={trailing}
      >
        Invoice from Morgan
      </SwipeActions.Row>
    </ListFrame>
  ),
} satisfies Meta<SwipeActionsCompoundProps>;
export default meta;
type Story = StoryObj<SwipeActionsCompoundProps>;
export const EasyMode: StoryObj<SwipeActionsEasyProps> = {
  name: 'Inbox actions',
  args: { 'aria-label': 'Inbox', rows: [invoiceRow] },
  render: (args) => <SwipeActions {...args} />,
  parameters: { docs: {
    description: { story: 'Swipe the invoice or open its menu to archive or delete it.' },
    source: { language: 'tsx', code: `import { SwipeActions } from '@jfrader/ui';

export function Inbox({ onAction }: { onAction: (action: 'archive' | 'delete') => void }) {
  return <SwipeActions aria-label="Inbox" rows={[{
    id: 'invoice', label: 'Invoice', actionsLabel: 'Actions for Invoice', content: 'Invoice from Morgan',
    trailing: [
      { id: 'archive', label: 'Archive', keepRow: true, onSelect: () => onAction('archive') },
      { id: 'delete', label: 'Delete message', tone: 'danger', onSelect: () => onAction('delete') },
    ],
  }]} />;
}` },
  } },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const trigger = canvas.getByRole('button', { name: 'Actions for Invoice' });
    trigger.focus();
    await userEvent.keyboard('{ArrowDown}');
    const page = within(canvasElement.ownerDocument.body);
    const first = await page.findByRole('menuitem', { name: 'Archive' });
    await waitFor(() => expect(first).toHaveFocus());
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(trigger).toHaveFocus());
  },
};

export const EasyCustomization: Story = {
  render: () => (
    <SwipeActions
      aria-label="Inbox"
      className="incoming-list"
      rows={[{ ...invoiceRow, disabled: true }]}
      slotProps={{
        root: { className: 'inbox-list' },
        row: { sx: easyRowStyle, slotProps: { body: { className: 'invoice-body' } } },
      }}
    />
  ),
  parameters: { docs: { source: { code: '<SwipeActions aria-label="Inbox" rows={rows} slotProps={{ root: { className: "inbox-list" }, row: { sx: css({ paddingBlock: vars.space[2] }), slotProps: { body: { className: "invoice-body" } } } }} />' } } },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole('list', { name: 'Inbox' })).toHaveClass('incoming-list', 'inbox-list');
    await expect(canvasElement.querySelector('[data-ui="swipe-actions-body"]')).toHaveClass('invoice-body');
    await expect(canvas.getByRole('button', { name: 'Actions for Invoice' })).toBeDisabled();
  },
};

export const EasyControlled: Story = {
  args: { onValueChange: fn() },
  render: (args) => (
    <SwipeActions
      value={null}
      onValueChange={args.onValueChange}
      aria-label="Inbox"
      rows={[{
        ...invoiceRow,
        trailing: [{ id: 'disabled', label: 'Unavailable', disabled: true, onSelect: select }, ...trailing],
      }]}
    />
  ),
  parameters: { docs: { source: { code: '<SwipeActions value={value} onValueChange={setValue} aria-label="Inbox" rows={rows} />' } } },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const row = rowOf(canvasElement);
    const rail = row.querySelector<HTMLElement>('[data-ui="swipe-actions-rail"][data-side="trailing"]')!;
    const travel = -rail.getBoundingClientRect().width * 0.75;
    const gesture = pointer(row);
    try {
      gesture.fire('pointerdown', 0);
      gesture.fire('pointermove', travel);
      gesture.fire('pointerup', travel);
    } finally {
      gesture.restore();
    }
    await expect(args.onValueChange).toHaveBeenCalledWith({ id: 'invoice', side: 'trailing' });
    await near(row, 0);
    const trigger = canvas.getByRole('button', { name: 'Actions for Invoice' });
    trigger.focus();
    await userEvent.keyboard('{ArrowDown}');
    const first = await within(canvasElement.ownerDocument.body).findByRole('menuitem', { name: 'Archive' });
    await waitFor(() => expect(first).toHaveFocus());
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(trigger).toHaveFocus());
  },
};
const rowOf = (canvas: HTMLElement) =>
  canvas.querySelector<HTMLElement>('[data-ui="swipe-actions-row"]')!;
const offset = (row: HTMLElement) =>
  row.querySelector<HTMLElement>('[data-ui="swipe-actions-content"]')!.getBoundingClientRect()
    .left -
  row.getBoundingClientRect().left -
  parseFloat(getComputedStyle(row).borderLeftWidth);
async function near(row: HTMLElement, target: number) {
  await waitFor(async () => {
    await expect(Math.abs(offset(row) - target)).toBeLessThan(1.5);
  });
}
function pointer(row: HTMLElement) {
  const captured = new Set<number>();
  const originals = {
    set: row.setPointerCapture,
    has: row.hasPointerCapture,
    release: row.releasePointerCapture,
  };
  row.setPointerCapture = (id) => {
    captured.add(id);
  };
  row.hasPointerCapture = (id) => captured.has(id);
  row.releasePointerCapture = (id) => {
    captured.delete(id);
  };
  const rect = row.getBoundingClientRect();
  let time = 0;
  return {
    captured,
    fire: (type: string, dx: number, init: PointerEventInit = {}, target: Element = row) => {
      const event = new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        pointerId: 1,
        isPrimary: true,
        button: 0,
        pointerType: 'touch',
        clientX: rect.left + rect.width / 2 + dx,
        clientY: rect.top + rect.height / 2,
        ...init,
      });
      time += 100;
      Object.defineProperty(event, 'timeStamp', { value: time });
      return fireEvent(target, event);
    },
    restore: () => {
      row.setPointerCapture = originals.set;
      row.hasPointerCapture = originals.has;
      row.releasePointerCapture = originals.release;
    },
  };
}
async function reveal(row: HTMLElement, dx: number) {
  const p = pointer(row);
  try {
    p.fire('pointerdown', 0);
    p.fire('pointermove', dx);
    p.fire('pointerup', dx);
  } finally {
    p.restore();
  }
}

export const Default: Story = {
  name: 'Compound rows',
  parameters: { docs: {
    description: { story: 'Compose a row with read actions on one side and archive or delete on the other.' },
    source: { language: 'tsx', code: `import { SwipeActions, styled } from '@jfrader/ui';

const Inbox = styled(SwipeActions)({ maxWidth: 480 });

export function Messages({ onAction }: { onAction: (action: 'read' | 'archive' | 'delete') => void }) {
  return <Inbox aria-label="Inbox">
    <SwipeActions.Row id="invoice" label="Invoice" actionsLabel="Actions for Invoice"
      leading={[{ id: 'read', label: 'Mark as read', tone: 'accent', onSelect: () => onAction('read') }]}
      trailing={[
        { id: 'archive', label: 'Archive', keepRow: true, onSelect: () => onAction('archive') },
        { id: 'delete', label: 'Delete message', tone: 'danger', onSelect: () => onAction('delete') },
      ]}>
      Invoice from Morgan
    </SwipeActions.Row>
  </Inbox>;
}` },
  } },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole('list', { name: 'Inbox' })).toBeInTheDocument();
    const trigger = canvas.getByRole('button', { name: 'Actions for Invoice' });
    await expect(trigger.getBoundingClientRect().height).toBeGreaterThanOrEqual(31);
    await expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    await expect(rowOf(canvasElement)).not.toHaveAttribute('role');
  },
};
export const LeadingOnly: Story = {
  render: (args) => (
    <SwipeActions {...args}>
      <SwipeActions.Row
        id="invoice"
        label="Invoice"
        actionsLabel="Actions for Invoice"
        leading={leading}
      >
        Invoice
      </SwipeActions.Row>
    </SwipeActions>
  ),
};
export const TrailingOnly: Story = {
  render: (args) => (
    <SwipeActions {...args}>
      <SwipeActions.Row
        id="invoice"
        label="Invoice"
        actionsLabel="Actions for Invoice"
        trailing={trailing}
      >
        Invoice
      </SwipeActions.Row>
    </SwipeActions>
  ),
};
export const TwoActionsEachSide: Story = {
  render: (args) => (
    <SwipeActions {...args}>
      <SwipeActions.Row
        id="invoice"
        label="Invoice"
        actionsLabel="Actions for Invoice"
        leading={[...leading, { id: 'pin', label: 'Pin message', onSelect: select }]}
        trailing={trailing}
      >
        Invoice
      </SwipeActions.Row>
    </SwipeActions>
  ),
};
export const AllTones: Story = {};
export const SnapAndSingleOpen: Story = {
  render: (args) => (
    <ResponsiveList {...args}>
      {['invoice', 'receipt'].map((id) => (
        <SwipeActions.Row
          key={id}
          id={id}
          label={id}
          actionsLabel={`Actions for ${id}`}
          fullSwipe={false}
          leading={leading}
          trailing={trailing}
        >
          {id}
        </SwipeActions.Row>
      ))}
    </ResponsiveList>
  ),
  play: async ({ canvasElement, args, userEvent }) => {
    const rows = canvasElement.querySelectorAll<HTMLElement>('[data-ui="swipe-actions-row"]');
    const p = pointer(rows[0]!);
    try {
      p.fire('pointerdown', 0);
      p.fire('pointermove', 4);
      p.fire('pointerup', 4);
      await near(rows[0]!, 0);
      await expect(args.onValueChange).toHaveBeenCalledTimes(0);
      p.fire('pointerdown', 0);
      p.fire('pointermove', 80);
      await expect(p.captured.has(1)).toBe(true);
      p.fire('pointerup', 80);
    } finally {
      p.restore();
    }
    await near(rows[0]!, 80);
    await expect(args.onValueChange).toHaveBeenNthCalledWith(1, {
      id: 'invoice',
      side: 'leading',
    });
    await reveal(rows[1]!, -150);
    await near(rows[1]!, -160);
    await near(rows[0]!, 0);
    await expect(args.onValueChange).toHaveBeenCalledTimes(3);
    await userEvent.click(within(rows[1]!).getByRole('button', { name: 'Actions for receipt' }));
    await near(rows[1]!, 0);
    await expect(args.onValueChange).toHaveBeenLastCalledWith(null);
    await userEvent.keyboard('{Escape}');
  },
};
export const FullSwipeOff: Story = {
  render: (args) => (
    <FixedList {...args}>
      <SwipeActions.Row
        id="invoice"
        label="Invoice"
        actionsLabel="Actions for Invoice"
        fullSwipe={false}
        leading={leading}
        trailing={trailing}
      >
        Invoice
      </SwipeActions.Row>
    </FixedList>
  ),
  play: async ({ canvasElement }) => {
    const row = rowOf(canvasElement);
    await reveal(row, 400);
    await near(row, 80);
    await expect(select).toHaveBeenCalledTimes(0);
  },
};
export const UncapturedReleaseOutside: Story = {
  ...FullSwipeOff,
  play: async ({ canvasElement }) => {
    const row = rowOf(canvasElement);
    const outside = canvasElement.ownerDocument.body;
    const p = pointer(row);
    try {
      // Sub-slop press, then vertical intent, each released outside the row before any capture.
      p.fire('pointerdown', 0);
      p.fire('pointermove', 4);
      p.fire('pointerup', 4, {}, outside);
      p.fire('pointerdown', 0, { pointerId: 2 });
      p.fire('pointermove', 0, { pointerId: 2, clientY: row.getBoundingClientRect().top + 150 });
      await expect(p.captured.size).toBe(0);
      p.fire('pointerup', 0, { pointerId: 2 }, outside);
      // A fresh pointer swipes normally: neither earlier gesture is still latched.
      p.fire('pointerdown', 0, { pointerId: 3 });
      p.fire('pointermove', 80, { pointerId: 3 });
      await expect(p.captured.has(3)).toBe(true);
      p.fire('pointerup', 80, { pointerId: 3 });
    } finally {
      p.restore();
    }
    await near(row, 80);
    await expect(row).toHaveAttribute('data-state', 'leading');
  },
};
export const MouseSelectionGuard: Story = {
  render: (args) => (
    <SwipeActions {...args}>
      <SwipeActions.Row id="invoice" label="Invoice" actionsLabel="Actions for Invoice" leading={leading}>
        Invoice <input aria-label="Note" />
      </SwipeActions.Row>
    </SwipeActions>
  ),
  play: async ({ canvas, canvasElement }) => {
    const row = rowOf(canvasElement);
    const p = pointer(row);
    try {
      const press = new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        pointerId: 1,
        isPrimary: true,
        button: 0,
        pointerType: 'mouse',
      });
      fireEvent(row.querySelector('[data-ui="swipe-actions-content"]')!, press);
      await expect(press.defaultPrevented).toBe(true);
      p.fire('pointerup', 0);
      const inputPress = new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        pointerId: 2,
        isPrimary: true,
        button: 0,
        pointerType: 'mouse',
      });
      fireEvent(canvas.getByRole('textbox', { name: 'Note' }), inputPress);
      await expect(inputPress.defaultPrevented).toBe(false);
    } finally {
      p.restore();
    }
  },
};
export const FullSwipe: Story = {
  play: async ({ canvasElement }) => {
    const row = rowOf(canvasElement);
    await reveal(row, 400);
    await near(row, 0);
    await expect(select).toHaveBeenCalledTimes(1);
    await expect(select).toHaveBeenLastCalledWith('read');
    await reveal(row, -400);
    await near(row, 0);
    await expect(select).toHaveBeenCalledTimes(2);
    await expect(select).toHaveBeenLastCalledWith('delete');
  },
};
export const KeepRow: Story = {
  name: 'Keep a row after an action',
  parameters: { docs: { description: { story: 'Press Archive to close the revealed rail without removing the invoice.' }, source: { language: 'tsx', code: `import { SwipeActions, styled } from '@jfrader/ui';

const Inbox = styled(SwipeActions)({ maxWidth: 480 });

export function Messages({ onAction }: { onAction: (action: 'read' | 'archive' | 'delete') => void }) {
  return (
    <Inbox aria-label="Inbox" defaultValue={{ id: 'invoice', side: 'trailing' }}>
      <SwipeActions.Row
        id="invoice"
        label="Invoice"
        actionsLabel="Actions for Invoice"
        leading={[{ id: 'read', label: 'Mark as read', tone: 'accent', onSelect: () => onAction('read') }]}
        trailing={[
          { id: 'archive', label: 'Archive', keepRow: true, onSelect: () => onAction('archive') },
          { id: 'delete', label: 'Delete message', tone: 'danger', onSelect: () => onAction('delete') },
        ]}
      >
        Invoice from Morgan
      </SwipeActions.Row>
    </Inbox>
  );
}` } } },
  args: { defaultValue: { id: 'invoice', side: 'trailing' } },
  play: async ({ canvasElement, userEvent }) => {
    const row = rowOf(canvasElement);
    await near(row, -160);
    const archive = row.querySelectorAll<HTMLButtonElement>('[data-ui="swipe-actions-action"]')[1]!;
    await expect(archive.getBoundingClientRect().height).toBeGreaterThanOrEqual(47);
    await userEvent.click(archive);
    await near(row, 0);
    await expect(select).toHaveBeenCalledTimes(1);
    await expect(select).toHaveBeenCalledWith('archive');
    await expect(row).toBeInTheDocument();
  },
};
export const PointerCancelArmed: Story = {
  play: async ({ canvasElement }) => {
    const row = rowOf(canvasElement);
    const p = pointer(row);
    try {
      for (const type of ['pointercancel', 'lostpointercapture']) {
        p.fire('pointerdown', 0);
        p.fire('pointermove', 400);
        p.fire(type, 400);
        await near(row, 0);
      }
      p.fire('pointerdown', 0);
      p.fire('pointermove', 20, {
        clientY: row.getBoundingClientRect().top + 150,
      });
      await expect(p.captured.size).toBe(0);
      p.fire('pointerup', 20);
      p.fire('pointerdown', 0, { button: 2 });
      p.fire('pointermove', 400);
      p.fire('pointerup', 400);
      p.fire('pointerdown', 0, { isPrimary: false });
      p.fire('pointermove', 400, { isPrimary: false });
      p.fire('pointerup', 400, { isPrimary: false });
      await near(row, 0);
      await expect(select).toHaveBeenCalledTimes(0);
    } finally {
      p.restore();
    }
  },
};
export const TouchCaptureTransfer: Story = {
  play: async ({ canvasElement }) => {
    const row = rowOf(canvasElement);
    const body = row.querySelector('[data-ui="swipe-actions-body"]')!;
    const p = pointer(row);
    try {
      // Touch implicitly captures to the pressed child; the horizontal lock moves capture to the
      // row, and the child's lostpointercapture bubbles up mid-gesture.
      p.fire('pointerdown', 0, {}, body);
      p.fire('gotpointercapture', 0, {}, body);
      p.fire('pointermove', -20, {}, body);
      await expect(p.captured.has(1)).toBe(true);
      p.fire('lostpointercapture', -20, {}, body);
      p.fire('gotpointercapture', -20);
      p.fire('pointermove', -120);
      await near(row, -120);
      p.fire('pointerup', -120);
    } finally {
      p.restore();
    }
    await near(row, -160);
    await expect(row).toHaveAttribute('data-state', 'trailing');
    await expect(select).toHaveBeenCalledTimes(0);
  },
};
export const DisabledAction: Story = {
  render: (args) => (
    <SwipeActions {...args}>
      <SwipeActions.Row
        id="invoice"
        label="Invoice"
        actionsLabel="Actions for Invoice"
        leading={leading.map((action) => ({ ...action, disabled: true }))}
        trailing={trailing}
      >
        Invoice
      </SwipeActions.Row>
    </SwipeActions>
  ),
};
export const DisabledRow: Story = {
  render: (args) => (
    <SwipeActions {...args}>
      <SwipeActions.Row
        id="invoice"
        label="Invoice"
        actionsLabel="Actions for Invoice"
        disabled
        leading={leading}
        trailing={trailing}
      >
        <a href="#invoice">Invoice</a>
      </SwipeActions.Row>
    </SwipeActions>
  ),
};
function Controlled(props: SwipeActionsCompoundProps) {
  const [value, setValue] = useState<SwipeActionsValue>(null);
  return (
    <SwipeActions
      {...props}
      value={value}
      onValueChange={(next) => {
        props.onValueChange?.(next);
        setValue(next);
      }}
    >
      <SwipeActions.Row
        id="invoice"
        label="Invoice"
        actionsLabel="Actions for Invoice"
        fullSwipe={false}
        leading={leading}
      >
        Invoice
      </SwipeActions.Row>
    </SwipeActions>
  );
}
export const ControlledRail: Story = {
  name: 'Control the revealed rail',
  parameters: { docs: {
    description: { story: 'Store the open rail in React state while disabling full-swipe activation.' },
    source: { language: 'tsx', code: `import { useState } from 'react';
import { SwipeActions, type SwipeActionsValue } from '@jfrader/ui';

export function Inbox({ onRead }: { onRead: () => void }) {
  const [value, setValue] = useState<SwipeActionsValue>(null);
  return <SwipeActions aria-label="Inbox" value={value} onValueChange={setValue}>
    <SwipeActions.Row id="invoice" label="Invoice" actionsLabel="Actions for Invoice"
      fullSwipe={false}
      leading={[{ id: 'read', label: 'Mark as read', tone: 'accent', onSelect: onRead }]}>
      Invoice
    </SwipeActions.Row>
  </SwipeActions>;
}` },
  } },
  render: (args) => <Controlled {...args} />,
  play: async ({ canvasElement, args }) => {
    await reveal(rowOf(canvasElement), 80);
    await near(rowOf(canvasElement), 80);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith({
      id: 'invoice',
      side: 'leading',
    });
  },
};
export const RejectedRail: Story = {
  ...LeadingOnly,
  args: { value: null },
  play: async ({ canvasElement, args }) => {
    const row = rowOf(canvasElement);
    const p = pointer(row);
    try {
      p.fire('pointerdown', 0);
      p.fire('pointermove', 45);
      p.fire('pointerup', 45);
    } finally {
      p.restore();
    }
    await near(row, 0);
    await expect(row).toHaveAttribute('data-state', 'closed');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith({
      id: 'invoice',
      side: 'leading',
    });
  },
};
export const Keyboard: Story = {
  render: (args) => (
    <>
      <SwipeActions {...args}>
        <SwipeActions.Row
          id="invoice"
          label="Invoice"
          actionsLabel="Actions for Invoice"
          leading={leading}
          trailing={[
            {
              id: 'unavailable',
              label: 'Unavailable',
              disabled: true,
              onSelect: select,
            },
            ...trailing,
          ]}
        >
          Invoice
        </SwipeActions.Row>
      </SwipeActions>
      <FixtureButton type="button">
        After list
      </FixtureButton>
    </>
  ),
  play: async ({ canvas, canvasElement, userEvent }) => {
    const body = within(canvasElement.ownerDocument.body);
    const trigger = canvas.getByRole('button', { name: 'Actions for Invoice' });
    await userEvent.tab();
    await expect(canvasElement.ownerDocument.activeElement).toBe(trigger);
    await expect(getComputedStyle(trigger).outlineStyle).not.toBe('none');
    await userEvent.keyboard('{ArrowUp}');
    const last = await body.findByRole('menuitem', { name: 'Delete message' });
    await waitFor(async () => {
      await expect(canvasElement.ownerDocument.activeElement).toBe(last);
    });
    await userEvent.keyboard('{ArrowDown}');
    await expect(canvasElement.ownerDocument.activeElement).toBe(
      body.getByRole('menuitem', { name: 'Mark as read' }),
    );
    await userEvent.keyboard('{End}{Home}{ArrowUp}');
    await expect(canvasElement.ownerDocument.activeElement).toBe(last);
    await userEvent.keyboard('{Home}{ArrowDown}');
    await expect(canvasElement.ownerDocument.activeElement).toBe(
      body.getByRole('menuitem', { name: 'Archive' }),
    );
    await userEvent.keyboard('d');
    await expect(canvasElement.ownerDocument.activeElement).toBe(last);
    await userEvent.keyboard('{Escape}');
    await waitFor(async () => {
      await expect(canvasElement.ownerDocument.activeElement).toBe(trigger);
    });
    await userEvent.keyboard('{Enter}');
    await body.findByRole('menu');
    await userEvent.keyboard('{Enter}');
    await waitFor(async () => {
      await expect(canvasElement.ownerDocument.activeElement).toBe(trigger);
    });
    await expect(select).toHaveBeenCalledTimes(1);
    await userEvent.keyboard(' ');
    await body.findByRole('menu');
    await userEvent.keyboard(' ');
    await expect(select).toHaveBeenCalledTimes(2);
    await userEvent.keyboard('{ArrowDown}');
    await body.findByRole('menu');
    await userEvent.tab();
    await waitFor(async () => {
      await expect(canvasElement.ownerDocument.activeElement).toBe(
        canvas.getByRole('button', { name: 'After list' }),
      );
    });
  },
};
export const MenuOpen: Story = {
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Actions for Invoice' }));
    await within(canvasElement.ownerDocument.body).findByRole('menu');
  },
};
export const LightTheme: Story = {
  decorators: [withLightTheme],
  globals: { theme: 'light' },
};
export const RTL: Story = {
  ...FullSwipeOff,
  args: { dir: 'rtl' },
  play: async ({ canvasElement }) => {
    const row = rowOf(canvasElement);
    await reveal(row, -80);
    await near(row, -80);
    await expect(row).toHaveAttribute('data-state', 'leading');
  },
};
export const ReducedMotion: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Enable reduced motion to check that released rows settle and disappear immediately. This story checks structure only.',
      },
    },
  },
};
export const ForcedColors: Story = {
  parameters: {
    docs: {
      source: { language: 'tsx', code: `import { SwipeActions, styled } from '@jfrader/ui';

const Inbox = styled(SwipeActions)({ maxWidth: 480 });

export function Messages({ onAction }: { onAction: (action: 'read' | 'archive' | 'delete') => void }) {
  return (
    <Inbox aria-label="Inbox" defaultValue={{ id: 'invoice', side: 'leading' }}>
      <SwipeActions.Row
        id="invoice"
        label="Invoice"
        actionsLabel="Actions for Invoice"
        leading={[{ id: 'read', label: 'Mark as read', tone: 'accent', onSelect: () => onAction('read') }]}
        trailing={[
          { id: 'archive', label: 'Archive', keepRow: true, onSelect: () => onAction('archive') },
          { id: 'delete', label: 'Delete message', tone: 'danger', onSelect: () => onAction('delete') },
        ]}
      >
        Invoice from Morgan
      </SwipeActions.Row>
    </Inbox>
  );
}` },
      description: {
        story:
          'Enable forced colors to check borders, command labels and focus outlines. This story checks structure only.',
      },
    },
  },
  args: { defaultValue: { id: 'invoice', side: 'leading' } },
};
export const Empty: Story = {
  render: (args) => <SwipeActions {...args} />,
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('list', { name: 'Inbox' })).toBeEmptyDOMElement();
  },
};
export const LongLabels: Story = {
  render: (args) => (
    <CompactList
      {...args}

      defaultValue={{ id: 'invoice', side: 'leading' }}
    >
      <SwipeActions.Row
        id="invoice"
        label="Invoice"
        actionsLabel="Actions for Invoice"
        leading={[
          {
            id: 'read',
            label: 'Mark this entire conversation as read',
            onSelect: select,
          },
        ]}
      >
        A detailed invoice with a long localized subject
      </SwipeActions.Row>
    </CompactList>
  ),
  play: async ({ canvasElement }) => {
    const row = rowOf(canvasElement);
    await near(row, 80);
    const label = row.querySelector<HTMLElement>('[data-ui="swipe-actions-action-label"]')!;
    await expect(label.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      row.getBoundingClientRect().bottom + 1.5,
    );
    await expect(label.getBoundingClientRect().width).toBeLessThanOrEqual(80);
  },
};
export const InteractiveRow: Story = {
  render: (args) => (
    <SwipeActions {...args}>
      <SwipeActions.Row
        id="invoice"
        label="Invoice"
        actionsLabel="Actions for Invoice"
        leading={leading}
      >
        <a href="#invoice">Open invoice</a>
        <input aria-label="Note" />
      </SwipeActions.Row>
    </SwipeActions>
  ),
  play: async ({ canvas, userEvent }) => {
    const input = canvas.getByRole('textbox', { name: 'Note' });
    await userEvent.type(input, 'Paid');
    await expect(input).toHaveValue('Paid');
    await expect(select).toHaveBeenCalledTimes(0);
  },
};
export const RapidRowSwitch: Story = { ...SnapAndSingleOpen };
export const ResizeDuringDrag: Story = {
  play: async ({ canvasElement }) => {
    const row = rowOf(canvasElement);
    const p = pointer(row);
    try {
      p.fire('pointerdown', 0);
      p.fire('pointermove', 80);
      row.style.width = '240px';
      p.fire('pointercancel', 80);
      await near(row, 0);
      await expect(select).toHaveBeenCalledTimes(0);
      p.fire('pointerdown', 0);
      p.fire('pointermove', 140);
      p.fire('pointerup', 140);
      await near(row, 0);
      await expect(select).toHaveBeenCalledTimes(1);
      await expect(select).toHaveBeenCalledWith('read');
    } finally {
      p.restore();
    }
  },
};
export const FalsyAndAria: Story = {
  render: (args) => (
    <>
      <span id="external-name">Messages</span>
      <span id="external-description">Today</span>
      <SwipeActions
        {...args}
        aria-label="Inbox"
        aria-labelledby="external-name unresolved-name"
        aria-describedby="external-description unresolved-description"
      >
        {[false, null, 0, ''].map((value, index) => (
          <SwipeActions.Row
            key={index}
            id={`falsy-${index}`}
            label="Message"
            actionsLabel={`Actions for message ${index}`}
            leading={[{ id: 'read', label: 'Read', icon: value, onSelect: select }]}
          >
            {value}
          </SwipeActions.Row>
        ))}
      </SwipeActions>
    </>
  ),
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('ul')).toHaveAttribute(
      'aria-labelledby',
      'external-name unresolved-name',
    );
    await expect(canvasElement.querySelector('ul')).toHaveAttribute(
      'aria-describedby',
      'external-description unresolved-description',
    );
    await expect(
      canvasElement.querySelectorAll('[data-ui="swipe-actions-action-icon"]'),
    ).toHaveLength(1);
  },
};
function RemovalExample(props: SwipeActionsCompoundProps) {
  const [ids, setIds] = useState(['first', 'second', 'third']);
  return (
    <>
      <SwipeActions {...props}>
        {ids.map((id) => (
          <SwipeActions.Row
            key={id}
            id={id}
            label={id}
            actionsLabel={`Actions for ${id}`}
            trailing={[
              {
                id: 'delete',
                label: 'Delete message',
                tone: 'danger',
                onSelect: () => setIds((current) => current.filter((value) => value !== id)),
              },
            ]}
          >
            {id}
          </SwipeActions.Row>
        ))}
      </SwipeActions>
      <FixtureButton
        type="button"

        onClick={() => setIds(['first', 'second', 'third'])}
      >
        Undo removal
      </FixtureButton>
    </>
  );
}
export const Removal: Story = {
  render: (args) => <RemovalExample {...args} />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole('button', { name: 'Actions for second' }));
    await userEvent.click(await body.findByRole('menuitem', { name: 'Delete message' }));
    await waitFor(async () => {
      await expect(canvas.queryByRole('button', { name: 'Actions for second' })).toBeNull();
    });
    await expect(canvasElement.ownerDocument.activeElement).toBe(
      canvas.getByRole('button', { name: 'Actions for third' }),
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Undo removal' }));
    await expect(canvas.getByRole('button', { name: 'Actions for second' })).toBeInTheDocument();
  },
};
export const Undo: Story = { ...Removal };
export const RemovalFallbacks: Story = {
  render: (args) => <RemovalExample {...args} />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    const body = within(canvasElement.ownerDocument.body);
    for (const [id, next] of [
      ['third', 'second'],
      ['second', 'first'],
      ['first', null],
    ] as const) {
      await userEvent.click(canvas.getByRole('button', { name: `Actions for ${id}` }));
      await userEvent.click(await body.findByRole('menuitem', { name: 'Delete message' }));
      const exiting = canvasElement.querySelector(`#${id}`);
      if (exiting) await expect(exiting).toHaveAttribute('inert');
      await waitFor(async () => {
        await expect(canvas.queryByRole('button', { name: `Actions for ${id}` })).toBeNull();
      });
      const destination = next
        ? canvas.getByRole('button', { name: `Actions for ${next}` })
        : canvas.getByRole('list', { name: 'Inbox' });
      await expect(canvasElement.ownerDocument.activeElement).toBe(destination);
      if (!next) await expect(getComputedStyle(destination).outlineStyle).not.toBe('none');
    }
  },
};
// This story tests the documented css/slot API and native style merging.
export const SlotStyles: Story = {
  render: (args) => (
    <SwipeActions {...args} sx={{ padding: vars.space[2] }}>
      <SwipeActions.Row
        id="invoice"
        label="Invoice"
        actionsLabel="Actions for Invoice"
        leading={leading}
        slotProps={{
          body: { sx: { paddingInline: vars.space[4] } },
          trigger: { sx: { minBlockSize: vars.space[12] } },
        }}
      >
        Invoice
      </SwipeActions.Row>
    </SwipeActions>
  ),
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole('button', { name: 'Actions for Invoice' }).getBoundingClientRect().height,
    ).toBeGreaterThanOrEqual(47);
  },
};

const listRef = fn();
const rowRef = fn();
export const Refs: Story = {
  render: (args) => (
    <SwipeActions {...args} ref={listRef}>
      <SwipeActions.Row
        ref={rowRef}
        id="invoice"
        label="Invoice"
        actionsLabel="Actions for Invoice"
        leading={leading}
      >
        Invoice
      </SwipeActions.Row>
    </SwipeActions>
  ),
  play: async ({ canvasElement }) => {
    await expect(
      listRef.mock.calls.some(([node]) => node === canvasElement.querySelector('ul')),
    ).toBe(true);
    await expect(rowRef.mock.calls.some(([node]) => node === rowOf(canvasElement))).toBe(true);
  },
};
export const ReverseFlick: Story = {
  play: async ({ canvasElement }) => {
    const row = rowOf(canvasElement);
    const p = pointer(row);
    try {
      p.fire('pointerdown', 0);
      p.fire('pointermove', 400);
      p.fire('pointermove', 290);
      p.fire('pointerup', 290);
      await near(row, 80);
      await expect(select).toHaveBeenCalledTimes(0);
    } finally {
      p.restore();
    }
  },
};
export const FlickAndClickSuppression: Story = {
  play: async ({ canvasElement }) => {
    const row = rowOf(canvasElement);
    const p = pointer(row);
    try {
      p.fire('pointerdown', 0);
      p.fire('pointermove', 180);
      p.fire('pointerup', 180);
      const click = new MouseEvent('click', { bubbles: true, cancelable: true });
      fireEvent(row, click);
      await expect(click.defaultPrevented).toBe(true);
      await near(row, 0);
      await expect(select).toHaveBeenCalledTimes(1);
      await expect(select).toHaveBeenCalledWith('read');
    } finally {
      p.restore();
    }
  },
};
function ExternalStateExample(props: SwipeActionsCompoundProps) {
  const [value, setValue] = useState<SwipeActionsValue>({ id: 'invoice', side: 'leading' });
  return (
    <>
      <SwipeActions {...props} value={value}>
        <SwipeActions.Row
          id="invoice"
          label="Invoice"
          actionsLabel="Actions for Invoice"
          leading={leading}
          trailing={trailing}
        >
          Invoice
        </SwipeActions.Row>
      </SwipeActions>
      <FixtureButton type="button" onClick={() => setValue(null)}>
        Reset rail
      </FixtureButton>
      <FixtureButton
        type="button"

        onClick={() => setValue({ id: 'missing', side: 'leading' })}
      >
        Set missing row
      </FixtureButton>
      <FixtureButton
        type="button"

        onClick={() => setValue({ id: 'invoice', side: 'trailing' })}
      >
        Set trailing rail
      </FixtureButton>
    </>
  );
}
export const ExternalReset: Story = {
  render: (args) => <ExternalStateExample {...args} />,
  play: async ({ canvas, canvasElement, args }) => {
    const row = rowOf(canvasElement);
    await near(row, 80);
    fireEvent.click(canvas.getByRole('button', { name: 'Reset rail' }));
    await near(row, 0);
    fireEvent.click(canvas.getByRole('button', { name: 'Set trailing rail' }));
    await near(row, -160);
    fireEvent.click(canvas.getByRole('button', { name: 'Set missing row' }));
    await near(row, 0);
    await expect(args.onValueChange).toHaveBeenCalledTimes(0);
  },
};
export const EscapeRail: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import { SwipeActions, styled } from '@jfrader/ui';

const Inbox = styled(SwipeActions)({ maxWidth: 480 });

export function Messages({ onAction }: { onAction: (action: 'read' | 'archive' | 'delete') => void }) {
  return (
    <Inbox aria-label="Inbox" defaultValue={{ id: 'invoice', side: 'leading' }}>
      <SwipeActions.Row
        id="invoice"
        label="Invoice"
        actionsLabel="Actions for Invoice"
        leading={[{ id: 'read', label: 'Mark as read', tone: 'accent', onSelect: () => onAction('read') }]}
        trailing={[
          { id: 'archive', label: 'Archive', keepRow: true, onSelect: () => onAction('archive') },
          { id: 'delete', label: 'Delete message', tone: 'danger', onSelect: () => onAction('delete') },
        ]}
      >
        Invoice from Morgan
      </SwipeActions.Row>
    </Inbox>
  );
}` } } },
  args: { defaultValue: { id: 'invoice', side: 'leading' } },
  play: async ({ canvasElement, userEvent, args }) => {
    const row = rowOf(canvasElement);
    await near(row, 80);
    const active = canvasElement.ownerDocument.activeElement;
    await userEvent.keyboard('{Escape}');
    await near(row, 0);
    await expect(canvasElement.ownerDocument.activeElement).toBe(active);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith(null);
  },
};
export const MissingAndDisabledRails: Story = {
  ...DisabledAction,
  play: async ({ canvasElement }) => {
    const row = rowOf(canvasElement);
    await reveal(row, 400);
    await near(row, 0);
    await expect(select).toHaveBeenCalledTimes(0);
  },
};
export const PointerRemovalPreservesFocus: Story = {
  render: (args) => <RemovalExample {...args} />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    const undo = canvas.getByRole('button', { name: 'Undo removal' });
    await userEvent.click(undo);
    await reveal(rowOf(canvasElement), -800);
    await waitFor(async () => {
      await expect(canvas.queryByRole('button', { name: 'Actions for first' })).toBeNull();
    });
    await expect(canvasElement.ownerDocument.activeElement).toBe(undo);
  },
};
