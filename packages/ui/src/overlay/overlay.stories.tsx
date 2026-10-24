import { StrictMode, useLayoutEffect, useState, type ComponentPropsWithRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fireEvent, fn, waitFor, within } from 'storybook/test';
import { Dialog } from '../components/dialog/dialog';
import { Popover } from '../components/popover/popover';
import { Menu } from '../components/menu/menu';
import { Select } from '../components/select/select';
import { Combobox } from '../components/combobox/combobox';
import { DatePicker } from '../components/date-picker/date-picker';
import { Tooltip } from '../components/tooltip/tooltip';
import { useOverlayFloating } from './use-overlay-floating';
import { useScrollLock } from './use-scroll-lock';

const meta = { title: 'Internals/Overlay' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const FAMILY_OPTIONS = [{ value: 'apple', label: 'Apple' }, { value: 'pear', label: 'Pear' }];

function FamilyPopup({ children, ...props }: ComponentPropsWithRef<'div'>) {
  return (
    <div {...props}>
      {children}
      <Menu triggerLabel="Date actions" items={[{ type: 'item', label: 'Save date' }]} />
      <Select label="Date fruit" options={FAMILY_OPTIONS} />
      <Combobox label="Search fruit" options={FAMILY_OPTIONS} />
      <Tooltip triggerLabel="Date help" content="Choose a date" openDelay={0} />
    </div>
  );
}

export const WholeFamilyNesting: Story = {
  tags: ['!autodocs'],
  render: () => (
    <>
      <Popover defaultOpen>
        <Popover.Trigger>Planner</Popover.Trigger>
        <Popover.Content aria-label="Planner">
          <DatePicker label="Plan date" defaultValue="2026-10-18" locale="en-US" slots={{ popup: FamilyPopup }} />
        </Popover.Content>
      </Popover>
      <button>Outside family</button>
    </>
  ),
  play: async ({ canvasElement, userEvent }) => {
    const body = within(canvasElement.ownerDocument.body);
    const planner = body.getByRole('dialog', { name: 'Planner' });
    const date = within(planner).getByRole('combobox', { name: 'Plan date' });
    date.focus();
    await userEvent.keyboard('{ArrowDown}');
    const popup = await body.findByRole('dialog', { name: 'Plan date' });
    const outside = body.getByRole('button', { name: 'Outside family' });

    for (const { role, name, surface } of [
      { role: 'button', name: 'Date actions', surface: 'menu' },
      { role: 'combobox', name: 'Date fruit', surface: 'listbox' },
      { role: 'combobox', name: 'Search fruit', surface: 'listbox' },
      { role: 'button', name: 'Date help', surface: 'tooltip' },
    ]) {
      const trigger = within(popup).getByRole(role, { name });
      trigger.focus();
      if (surface !== 'tooltip') await userEvent.keyboard('{ArrowDown}');
      await body.findByRole(surface);
      await userEvent.keyboard('{Escape}');
      await waitFor(() => expect(body.queryByRole(surface)).toBeNull());
      await expect(trigger).toHaveFocus();
      await expect(popup).toBeVisible();
      await expect(planner).toBeVisible();

      if (surface === 'tooltip') {
        date.focus();
        trigger.focus();
      } else {
        await userEvent.keyboard('{ArrowDown}');
      }
      await body.findByRole(surface);
      await userEvent.click(outside);
      await waitFor(() => expect(body.queryByRole(surface)).toBeNull());
      await expect(outside).toHaveFocus();
      await expect(popup).toBeVisible();
      await expect(planner).toBeVisible();
    }

    await userEvent.click(outside);
    await waitFor(() => expect(body.queryByRole('dialog', { name: 'Plan date' })).toBeNull());
    await expect(outside).toHaveFocus();
    await expect(planner).toBeVisible();
    date.focus();
    await userEvent.keyboard('{ArrowDown}');
    await body.findByRole('grid');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(body.queryByRole('dialog', { name: 'Plan date' })).toBeNull());
    await expect(date).toHaveFocus();
    await expect(planner).toBeVisible();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(body.queryByRole('dialog', { name: 'Planner' })).toBeNull());
  },
};

const closeRequest = fn();
export const NoncancelableNativeClose: Story = {
  render: () => (
    <Dialog defaultOpen onOpenChange={closeRequest}>
      <Dialog.Content onCancel={(event) => event.preventDefault()} withDescription={false}>
        <Dialog.Title>Platform closure</Dialog.Title>
        <Dialog.Close>Close platform dialog</Dialog.Close>
      </Dialog.Content>
    </Dialog>
  ),
  play: async ({ canvasElement }) => {
    closeRequest.mockClear();
    const dialog = within(canvasElement.ownerDocument.body).getByRole('dialog') as HTMLDialogElement;
    fireEvent(dialog, new Event('cancel', { cancelable: false }));
    await expect(closeRequest).not.toHaveBeenCalled();
    dialog.close();
    await waitFor(() => expect(closeRequest).toHaveBeenCalledTimes(1));
    await expect(closeRequest).toHaveBeenCalledWith(false);
  },
};

export const FallbackAcceptedClose: Story = {
  render: () => (
    <Dialog defaultOpen onOpenChange={closeRequest}>
      <Dialog.Content withDescription={false}>
        <Dialog.Title>Fallback closure</Dialog.Title>
        <Dialog.Close>Close fallback</Dialog.Close>
      </Dialog.Content>
    </Dialog>
  ),
  play: async ({ canvasElement, userEvent }) => {
    closeRequest.mockClear();
    const body = within(canvasElement.ownerDocument.body);
    const dialog = body.getByRole('dialog');
    Object.defineProperty(dialog, 'requestClose', { value: undefined, configurable: true });
    try {
      await userEvent.click(body.getByRole('button', { name: 'Close fallback' }));
      await expect(closeRequest).toHaveBeenCalledTimes(1);
      await expect(closeRequest).toHaveBeenCalledWith(false);
      // The native close waits for the exit transition to settle; wait for it instead of
      // racing the animation promise.
      await waitFor(() => expect(dialog).not.toHaveAttribute('open'));
    } finally {
      Reflect.deleteProperty(dialog, 'requestClose');
    }
  },
};

export const FallbackCancelVeto: Story = {
  render: () => (
    <Dialog defaultOpen>
      <Dialog.Content onCancel={(event) => event.preventDefault()} withDescription={false}>
        <Dialog.Title>Fallback veto</Dialog.Title>
        <Dialog.Close>Close fallback</Dialog.Close>
      </Dialog.Content>
    </Dialog>
  ),
  play: async ({ canvasElement, userEvent }) => {
    const body = within(canvasElement.ownerDocument.body);
    const dialog = body.getByRole('dialog');
    Object.defineProperty(dialog, 'requestClose', { value: undefined, configurable: true });
    try {
      await userEvent.click(body.getByRole('button', { name: 'Close fallback' }));
      await expect(dialog).toHaveAttribute('open');
    } finally {
      Reflect.deleteProperty(dialog, 'requestClose');
    }
  },
};

const parentCancel = fn();
const parentClose = fn();
export const NestedNativeEvents: Story = {
  render: () => (
    <Dialog defaultOpen>
      <Dialog.Content onCancel={parentCancel} onClose={parentClose} withDescription={false}>
        <Dialog.Title>Parent dialog</Dialog.Title>
        <Dialog defaultOpen>
          <Dialog.Content withDescription={false} onCancel={(event) => event.preventDefault()}>
            <Dialog.Title>Child dialog</Dialog.Title>
            <Dialog.Close>Close child</Dialog.Close>
          </Dialog.Content>
        </Dialog>
      </Dialog.Content>
    </Dialog>
  ),
  play: async ({ canvasElement }) => {
    parentCancel.mockClear();
    parentClose.mockClear();
    const body = within(canvasElement.ownerDocument.body);
    const child = body.getByRole('dialog', { name: 'Child dialog' }) as HTMLDialogElement;
    fireEvent(child, new Event('cancel', { cancelable: true }));
    await expect(parentCancel).toHaveBeenCalledTimes(1);
    child.close();
    await waitFor(() => expect(child.open).toBe(false));
    await waitFor(() => expect(body.queryByRole('dialog', { name: 'Child dialog' })).toBeNull());
    await waitFor(() => expect(parentClose).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(body.getByRole('dialog', { name: 'Parent dialog' })).toHaveAttribute('open'));
    await expect(canvasElement.ownerDocument.body.style.overflow).toBe('hidden');
  },
};

function Lock({ active }: { active: boolean }) {
  useScrollLock(active);
  return null;
}

function NestedLocks() {
  const [count, setCount] = useState(0);
  return (
    <StrictMode>
      {count > 0 && <Lock active />}
      {count > 1 && <Lock active />}
      <button onClick={() => setCount(2)}>Lock both</button>
      <button onClick={() => setCount(1)}>Release child</button>
      <button onClick={() => setCount(0)}>Release parent</button>
    </StrictMode>
  );
}

export const StrictModeScrollLocks: Story = {
  render: () => <NestedLocks />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    const doc = canvasElement.ownerDocument;
    const initial = [doc.documentElement.style.overflow, doc.body.style.overflow] as const;
    await userEvent.click(canvas.getByRole('button', { name: 'Lock both' }));
    await expect(doc.documentElement.style.overflow).toBe('hidden');
    await userEvent.click(canvas.getByRole('button', { name: 'Release child' }));
    await expect(doc.body.style.overflow).toBe('hidden');
    await userEvent.click(canvas.getByRole('button', { name: 'Release parent' }));
    await expect([doc.documentElement.style.overflow, doc.body.style.overflow]).toEqual(initial);
    doc.documentElement.style.overflow = 'hidden';
    doc.body.style.overflow = 'hidden';
    try {
      await userEvent.click(canvas.getByRole('button', { name: 'Lock both' }));
      await userEvent.click(canvas.getByRole('button', { name: 'Release child' }));
      await userEvent.click(canvas.getByRole('button', { name: 'Release parent' }));
      await expect(doc.documentElement.style.overflow).toBe('hidden');
      await expect(doc.body.style.overflow).toBe('hidden');
    } finally {
      [doc.documentElement.style.overflow, doc.body.style.overflow] = initial;
    }
  },
};

function CompensationHarness() {
  const [active, setActive] = useState(false);
  useScrollLock(active);
  return (
    <>
      <button onClick={() => setActive(true)}>Lock</button>
      <button onClick={() => setActive(false)}>Release</button>
    </>
  );
}

export const ScrollbarSpaceCompensation: Story = {
  render: () => <CompensationHarness />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    const doc = canvasElement.ownerDocument;
    const view = doc.defaultView!;
    const root = doc.documentElement;
    const innerWidth = Object.getOwnPropertyDescriptor(view, 'innerWidth');
    const clientWidth = Object.getOwnPropertyDescriptor(root, 'clientWidth');
    // Simulate a classic 15px scrollbar: the viewport is wider than the client area until the
    // lock hides overflow, which removes the scrollbar.
    Object.defineProperty(view, 'innerWidth', { configurable: true, get: () => 1280 });
    Object.defineProperty(root, 'clientWidth', {
      configurable: true,
      get: () => (root.style.overflow === 'hidden' ? 1280 : 1265),
    });
    try {
      await userEvent.click(canvas.getByRole('button', { name: 'Lock' }));
      // The reserved inline-end padding keeps the content width identical once the scrollbar hides.
      await expect(root.style.paddingInlineEnd).toBe('15px');
      await userEvent.click(canvas.getByRole('button', { name: 'Release' }));
      await expect(root.style.paddingInlineEnd).toBe('');
    } finally {
      if (innerWidth) Object.defineProperty(view, 'innerWidth', innerWidth);
      else Reflect.deleteProperty(view, 'innerWidth');
      if (clientWidth) Object.defineProperty(root, 'clientWidth', clientWidth);
      else Reflect.deleteProperty(root, 'clientWidth');
    }
  },
};

function EdgeFloating() {
  const [edge, setEdge] = useState<'top' | 'bottom'>('top');
  const floating = useOverlayFloating({ open: true, onOpenChange: () => {}, placement: 'bottom-start', gap: 4, strategy: 'fixed' });
  const { setPositionReference } = floating.refs;
  useLayoutEffect(() => {
    setPositionReference({
      getBoundingClientRect: () => new DOMRect(100, edge === 'top' ? 2 : window.innerHeight - 2, 0, 0),
    });
  }, [edge, setPositionReference]);
  return (
    <>
      <button onClick={() => setEdge('top')}>Top edge</button>
      <button onClick={() => setEdge('bottom')}>Bottom edge</button>
      <div ref={floating.refs.setFloating} style={floating.floatingStyles}>Edge surface</div>
    </>
  );
}

export const ExtremePointerEdges: Story = {
  render: () => <EdgeFloating />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    for (const name of ['Top edge', 'Bottom edge']) {
      await userEvent.click(canvas.getByRole('button', { name }));
      await waitFor(() => {
        const rect = canvas.getByText('Edge surface').getBoundingClientRect();
        expect(rect.top).toBeGreaterThanOrEqual(8);
        expect(rect.bottom).toBeLessThanOrEqual(canvasElement.ownerDocument.defaultView!.innerHeight - 8);
      });
    }
  },
};
