import { StrictMode, useLayoutEffect, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fireEvent, fn, waitFor, within } from 'storybook/test';
import { Dialog } from '../components/dialog/dialog';
import { useOverlayFloating } from './use-overlay-floating';
import { useScrollLock } from './use-scroll-lock';

const meta = { title: 'Internals/Overlay' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

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
