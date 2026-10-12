import { useRef, useState, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fireEvent, fn, waitFor, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { withLightTheme } from '../../testing/story-decorators';
import { ThemeRoot } from '../theme-root';
import { Popover } from '../popover';
import { BottomSheet, type BottomSheetContentProps, type BottomSheetProps } from './index';

const TITLE = 'Trip details';
const TRIGGER = 'Open trip';
const FIXTURE_BUTTON = {
  minHeight: '24px',
  minWidth: '24px',
  padding: '4px 10px',
} as const;
const USAGE = `<BottomSheet detents={[0.4, 0.9]}>
  <BottomSheet.Trigger>Trip details</BottomSheet.Trigger>
  <BottomSheet.Content><BottomSheet.Panel>
    <BottomSheet.Header>
      <BottomSheet.Handle aria-label="Resize sheet" />
      <BottomSheet.Title>Trip</BottomSheet.Title>
      <BottomSheet.Close>Close</BottomSheet.Close>
    </BottomSheet.Header>
    <BottomSheet.Body>Departure details</BottomSheet.Body>
  </BottomSheet.Panel></BottomSheet.Content>
</BottomSheet>`;
const meta = {
  title: 'Surfaces/BottomSheet',
  component: BottomSheet,
  tags: ['autodocs'],
  args: { onOpenChange: fn(), onValueChange: fn() },
  parameters: {
    docs: {
      source: { code: USAGE },
      description: {
        component:
          'Open content from the bottom of the screen. Drag the handle or use the keyboard to change its height.',
      },
      usage: `- The sheet is always modal. Its native dialog contains focus and blocks the background, even at peek height.
- Detents are stable, ascending fractions. \`value/defaultValue/onValueChange\` manages their numeric index independently of open state. Remount to change detent values.
- The panel rises to its detent on open and slides down before the dialog closes. Reduced motion skips spring travel on open, close, and accepted height changes.
- Supply translated Handle/Close names. \`getValueText\` and \`locale\` customize height text; the default uses Intl percentages.
- Floating children need a stable ThemeRoot \`portalContainer\` inside Content. Do not portal them to the body.
- Mobile keyboard, touch, and screen-reader behavior still need manual verification.

### Keyboard
- On Handle, Up/Down choose adjacent detents, Home/End choose tallest/smallest, and Enter/Space switch between the extremes.
- Escape cancels a drag first; otherwise it dismisses only the topmost layer.
- In Body, PageDown/Space expands before scrolling. Reverse reading keys scroll natively.`,
    },
  },
} satisfies Meta<typeof BottomSheet>;
export default meta;
type Story = StoryObj<typeof meta>;

function Parts({
  long = false,
  contentProps,
  children,
}: {
  long?: boolean;
  contentProps?: BottomSheetContentProps;
  children?: ReactNode;
}) {
  return (
    <>
      <BottomSheet.Trigger>{TRIGGER}</BottomSheet.Trigger>
      <BottomSheet.Content {...contentProps}>
        <BottomSheet.Panel>
          <BottomSheet.Header>
            <BottomSheet.Handle aria-label="Resize sheet" />
            <BottomSheet.Title>{TITLE}</BottomSheet.Title>
            <BottomSheet.Description>Departure and arrival information.</BottomSheet.Description>
            <BottomSheet.Close>Close</BottomSheet.Close>
          </BottomSheet.Header>
          <BottomSheet.Body tabIndex={0}>
            {children ?? (
              <>
                <p>Train 42 · Platform 3</p>
                {long &&
                  Array.from({ length: 24 }, (_, i) => (
                    <p key={i}>Stop {i + 1} · Check the platform before boarding.</p>
                  ))}
                <button style={FIXTURE_BUTTON}>Save trip</button>
              </>
            )}
          </BottomSheet.Body>
          <BottomSheet.Footer>
            <span>Departure 09:30</span>
          </BottomSheet.Footer>
        </BottomSheet.Panel>
      </BottomSheet.Content>
    </>
  );
}
const render: Story['render'] = (args) => (
  <BottomSheet {...args}>
    <Parts />
  </BottomSheet>
);
const dialogIn = (element: HTMLElement) =>
  element.querySelector<HTMLDialogElement>('[data-ui="bottom-sheet"]')!;
const panelIn = (element: HTMLElement) =>
  element.querySelector<HTMLDivElement>('[data-ui="bottom-sheet-panel"]')!;
async function settled(canvasElement: HTMLElement, fraction: number) {
  const panel = panelIn(canvasElement);
  await waitFor(
    async () => {
      const win = panel.ownerDocument.defaultView!;
      const height = win.visualViewport?.height ?? win.innerHeight;
      const before = panel.getBoundingClientRect().height;
      await new Promise<void>((resolve) =>
        win.requestAnimationFrame(() => win.requestAnimationFrame(() => resolve())),
      );
      await expect(Math.abs(panel.getBoundingClientRect().height - height * fraction)).toBeLessThan(
        3,
      );
      await expect(Math.abs(panel.getBoundingClientRect().height - before)).toBeLessThan(0.5);
      await expect(
        Math.abs(
          panel.getBoundingClientRect().bottom - (win.visualViewport?.offsetTop ?? 0) - height,
        ),
      ).toBeLessThan(3);
    },
    { timeout: 4000 },
  );
}
function pointer(element: Element, type: string, y: number, time: number, id = 1, primary = true) {
  const win = element.ownerDocument.defaultView!;
  const event = new win.PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    pointerId: id,
    isPrimary: primary,
    button: 0,
    clientY: y,
    clientX: 100,
    pointerType: 'touch',
  });
  Object.defineProperty(event, 'timeStamp', { value: time });
  fireEvent(element, event);
}
function touch(
  element: Element,
  type: string,
  x: number,
  y: number,
  time: number,
  multiple = false,
) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  const point = { identifier: 5, clientX: x, clientY: y, target: element };
  Object.defineProperties(event, {
    timeStamp: { value: time },
    touches: {
      value:
        type === 'touchend' || type === 'touchcancel'
          ? []
          : multiple
            ? [point, { ...point, identifier: 6 }]
            : [point],
    },
    changedTouches: { value: [point] },
  });
  fireEvent(element, event);
  return event;
}

export const Default: Story = {
  render,
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: TRIGGER }));
    await expect(dialogIn(canvasElement).open).toBe(true);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(true);
    await settled(canvasElement, 0.45);
    await userEvent.click(canvas.getByRole('button', { name: 'Close' }));
    await waitFor(async () => {
      await expect(dialogIn(canvasElement).open).toBe(false);
    });
    await expect(args.onOpenChange).toHaveBeenCalledTimes(2);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);
    await expect(canvasElement.ownerDocument.activeElement).toBe(
      canvas.getByRole('button', { name: TRIGGER }),
    );
  },
};
interface SheetFrame {
  open: boolean;
  top: number;
  scrim: number;
  /** The shell's scroll offset; any scroll would cancel the panel's travel on screen. */
  scroll: number;
}

/** One reading per animation frame, from `start()` until `done` holds or the time runs out. */
async function sampleFrames(
  canvasElement: HTMLElement,
  start: () => void,
  done: (frame: SheetFrame) => boolean,
) {
  const dialog = dialogIn(canvasElement);
  const panel = panelIn(canvasElement);
  const win = dialog.ownerDocument.defaultView!;
  const frames: SheetFrame[] = [];
  const startedAt = win.performance.now();
  start();
  await new Promise<void>((resolve) => {
    const tick = () => {
      const frame = {
        open: dialog.open,
        top: panel.getBoundingClientRect().top,
        scrim: Number.parseFloat(dialog.style.getPropertyValue('--sheet-scrim')),
        scroll: dialog.scrollTop,
      };
      frames.push(frame);
      if (done(frame) || win.performance.now() - startedAt > 2000) resolve();
      else win.requestAnimationFrame(tick);
    };
    win.requestAnimationFrame(tick);
  });
  return frames;
}
const isMonotonic = (values: number[], direction: 1 | -1) =>
  values.every((value, index) => index === 0 || (value - values[index - 1]!) * direction >= -0.01);

export const EntranceAndExit: Story = {
  render,
  play: async ({ canvas, canvasElement, args }) => {
    const trigger = canvas.getByRole('button', { name: TRIGGER });
    const win = canvasElement.ownerDocument.defaultView!;
    const viewportBottom = (win.visualViewport?.offsetTop ?? 0) + (win.visualViewport?.height ?? win.innerHeight);
    const detentTop = viewportBottom - (win.visualViewport?.height ?? win.innerHeight) * 0.45;

    // Entrance: the panel rises from below the viewport to the selected detent; the scrim follows.
    trigger.focus();
    const entrance = await sampleFrames(
      canvasElement,
      () => trigger.click(),
      (frame) => Math.abs(frame.top - detentTop) < 1,
    );
    await expect(entrance.every((frame) => frame.scroll === 0)).toBe(true);
    await expect(entrance[0]!.top).toBeGreaterThan(viewportBottom - (viewportBottom - detentTop) / 2);
    await expect(new Set(entrance.map((frame) => frame.top)).size).toBeGreaterThan(2);
    await expect(isMonotonic(entrance.map((frame) => frame.top), -1)).toBe(true);
    await expect(isMonotonic(entrance.map((frame) => frame.scrim), 1)).toBe(true);
    await settled(canvasElement, 0.45);

    // Exit: the dialog stays open while the panel sinks, then closes and returns focus.
    const close = canvas.getByRole('button', { name: 'Close' });
    const exit = await sampleFrames(canvasElement, () => close.click(), (frame) => !frame.open);
    const retained = exit.filter((frame) => frame.open);
    await expect(retained.length).toBeGreaterThan(1);
    await expect(retained.every((frame) => frame.scroll === 0)).toBe(true);
    await expect(new Set(retained.map((frame) => frame.top)).size).toBeGreaterThan(1);
    await expect(isMonotonic(retained.map((frame) => frame.top), 1)).toBe(true);
    await expect(retained.at(-1)!.top).toBeGreaterThan(detentTop);
    await expect(isMonotonic(retained.map((frame) => frame.scrim), -1)).toBe(true);
    await expect(exit.at(-1)!.open).toBe(false);
    await waitFor(() => expect(canvasElement.ownerDocument.activeElement).toBe(trigger));
    await expect(args.onOpenChange).toHaveBeenCalledTimes(2);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);
  },
};
export const ReopenDuringExit: Story = {
  render,
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const trigger = canvas.getByRole('button', { name: TRIGGER });
    await userEvent.click(trigger);
    await settled(canvasElement, 0.45);
    const panel = panelIn(canvasElement);
    const rest = panel.getBoundingClientRect().top;
    fireEvent.click(canvas.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(panel.getBoundingClientRect().top).toBeGreaterThan(rest + 1));
    await expect(dialogIn(canvasElement).open).toBe(true);
    // Mid-exit the logical state is already closed; a programmatic reopen turns the panel back.
    fireEvent.click(trigger);
    await settled(canvasElement, 0.45);
    await expect(dialogIn(canvasElement).open).toBe(true);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(3);
    for (const [index, open] of [true, false, true].entries()) {
      await expect(args.onOpenChange).toHaveBeenNthCalledWith(index + 1, open);
    }
  },
};
export const SingleDetent: Story = {
  // Excluded from the docs page: its open overlay (modal/backdrop) covers the documentation.
  tags: ['!autodocs'],
  args: { detents: [0.6], defaultOpen: true },
  render,
  play: async ({ canvas, canvasElement, args, userEvent }) => {
    const handle = canvas.getByRole('button', { name: 'Resize sheet' });
    await expect(handle).toBeDisabled();
    await userEvent.click(handle);
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await settled(canvasElement, 0.6);
    await expect(canvas.getByRole('button', { name: 'Close' })).toBeEnabled();
  },
};
export const ThreeDetents: Story = {
  // Excluded from the docs page: its open overlay (modal/backdrop) covers the documentation.
  tags: ['!autodocs'],
  args: { detents: [0.3, 0.6, 0.9], defaultOpen: true },
  render,
  play: async ({ canvas, canvasElement, args, userEvent }) => {
    const handle = canvas.getByRole('button', { name: 'Resize sheet' });
    handle.focus();
    await userEvent.keyboard('{ArrowUp}');
    await settled(canvasElement, 0.6);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith(1);
    await userEvent.keyboard('{ArrowUp}');
    await settled(canvasElement, 0.9);
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await expect(args.onValueChange).toHaveBeenLastCalledWith(2);
  },
};
export const LongContent: Story = {
  // Excluded from the docs page: its open overlay (modal/backdrop) covers the documentation.
  tags: ['!autodocs'],
  args: { defaultOpen: true },
  render: (args) => (
    <BottomSheet {...args}>
      <Parts long />
    </BottomSheet>
  ),
  play: async ({ canvasElement }) => {
    await settled(canvasElement, 0.45);
    const body = canvasElement.querySelector<HTMLElement>('[data-ui="bottom-sheet-body"]')!;
    await expect(body.scrollHeight).toBeGreaterThan(body.clientHeight);
    await expect(body.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      panelIn(canvasElement).getBoundingClientRect().bottom + 1,
    );
    body.scrollTop = 50;
    await expect(body.scrollTop).toBeGreaterThan(0);
  },
};
export const LightTheme: Story = {
  // Excluded from the docs page: its open overlay (modal/backdrop) covers the documentation.
  tags: ['!autodocs'],
  args: { defaultOpen: true },
  render,
  decorators: [withLightTheme],
  globals: { theme: 'light' },
};
export const PersistentPeek: Story = { 
  // Excluded from the docs page: its open overlay (modal/backdrop) covers the documentation.
  tags: ['!autodocs'],
args: { defaultOpen: true }, render };
export const PersistentExpanded: Story = {
  // Excluded from the docs page: its open overlay (modal/backdrop) covers the documentation.
  tags: ['!autodocs'],
  args: { defaultOpen: true, defaultValue: 1 },
  render,
};
export const PersistentLight: Story = {
  // Excluded from the docs page: its open overlay (modal/backdrop) covers the documentation.
  tags: ['!autodocs'],
  ...PersistentExpanded,
  decorators: [withLightTheme],
  globals: { theme: 'light' },
};
export const NoDescription: Story = {
  // Excluded from the docs page: its open overlay (modal/backdrop) covers the documentation.
  tags: ['!autodocs'],
  args: { defaultOpen: true },
  render: (args) => (
    <BottomSheet {...args}>
      <Parts contentProps={{ withDescription: false }} />
    </BottomSheet>
  ),
  play: async ({ canvasElement }) => {
    await expect(dialogIn(canvasElement)).not.toHaveAttribute('aria-describedby');
  },
};

function ControlledExample(args: BottomSheetProps) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(0);
  return (
    <BottomSheet
      {...args}
      open={open}
      value={value}
      onOpenChange={(next) => {
        args.onOpenChange?.(next);
        setOpen(next);
      }}
      onValueChange={(next) => {
        args.onValueChange?.(next);
        setValue(next);
      }}
    >
      <Parts />
    </BottomSheet>
  );
}
export const Controlled: Story = {
  render: ControlledExample,
  play: async ({ canvas, canvasElement, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: TRIGGER }));
    await userEvent.click(canvas.getByRole('button', { name: 'Resize sheet' }));
    await settled(canvasElement, 0.92);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith(1);
    await userEvent.keyboard('{Escape}');
    await waitFor(async () => {
      await expect(dialogIn(canvasElement).open).toBe(false);
    });
    await userEvent.click(canvas.getByRole('button', { name: TRIGGER }));
    await settled(canvasElement, 0.92);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
  },
};
export const ControlledRejectDetent: Story = {
  // Excluded from the docs page: its open overlay (modal/backdrop) covers the documentation.
  tags: ['!autodocs'],
  args: { defaultOpen: true, value: 0 },
  render: (args) => (
    <BottomSheet {...args}>
      <Parts long />
    </BottomSheet>
  ),
  play: async ({ canvas, canvasElement, args, userEvent }) => {
    const handle = canvas.getByRole('button', { name: 'Resize sheet' });
    await userEvent.click(handle);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith(1);
    await expect(handle).toHaveAttribute('aria-expanded', 'false');
    await expect(canvas.getByRole('status')).toBeEmptyDOMElement();
    await settled(canvasElement, 0.45);
    await userEvent.click(canvas.getByRole('button', { name: 'Save trip' }));
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    const button = canvas.getByRole('button', { name: 'Save trip' });
    const body = canvasElement.querySelector<HTMLElement>('[data-ui="bottom-sheet-body"]')!;
    await waitFor(async () => {
      await expect(button.getBoundingClientRect().bottom).toBeLessThanOrEqual(
        body.getBoundingClientRect().bottom + 2,
      );
    });
  },
};
export const ControlledRejectClose: Story = {
  // Excluded from the docs page: its open overlay (modal/backdrop) covers the documentation.
  tags: ['!autodocs'],
  args: { open: true },
  render,
  play: async ({ canvas, canvasElement, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Close' }));
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);
    await expect(dialogIn(canvasElement).open).toBe(true);
    const header = canvasElement.querySelector('[data-ui="bottom-sheet-header"]')!;
    const win = canvasElement.ownerDocument.defaultView!;
    pointer(header, 'pointerdown', 100, 0);
    pointer(header, 'pointermove', win.innerHeight, 100);
    pointer(header, 'pointerup', win.innerHeight, 300);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(2);
    await settled(canvasElement, 0.45);
    await expect(dialogIn(canvasElement).open).toBe(true);
  },
};

export const KeyboardNavigation: Story = {
  render,
  play: async ({ canvas, canvasElement, args, userEvent }) => {
    const trigger = canvas.getByRole('button', { name: TRIGGER });
    await userEvent.tab();
    await expect(canvasElement.ownerDocument.activeElement).toBe(trigger);
    await expect(getComputedStyle(trigger).outlineStyle).not.toBe('none');
    await userEvent.keyboard('{Enter}');
    await expect(canvasElement.ownerDocument.activeElement).toBe(panelIn(canvasElement));
    await expect(panelIn(canvasElement).matches(':focus-visible')).toBe(true);
    await expect(getComputedStyle(panelIn(canvasElement)).outlineStyle).not.toBe('none');
    await userEvent.tab();
    const handle = canvas.getByRole('button', { name: 'Resize sheet' });
    await expect(canvasElement.ownerDocument.activeElement).toBe(handle);
    await expect(getComputedStyle(handle).outlineStyle).not.toBe('none');
    await expect(handle.getBoundingClientRect().height).toBeGreaterThanOrEqual(31);
    await expect(handle.getBoundingClientRect().width).toBeGreaterThanOrEqual(31);
    for (const [keys, value, count] of [
      ['{ArrowUp}{ArrowUp}', 1, 1],
      ['{ArrowDown}{ArrowDown}', 0, 2],
      ['{Home}', 1, 3],
      ['{End}', 0, 4],
      ['{Enter}', 1, 5],
      [' ', 0, 6],
    ] as const) {
      await userEvent.keyboard(keys);
      await expect(args.onValueChange).toHaveBeenCalledTimes(count);
      await expect(args.onValueChange).toHaveBeenLastCalledWith(value);
    }
    await settled(canvasElement, 0.45);
    await userEvent.tab();
    await expect(canvasElement.ownerDocument.activeElement).toBe(
      canvas.getByRole('button', { name: 'Close' }),
    );
    await userEvent.tab({ shift: true });
    await expect(canvasElement.ownerDocument.activeElement).toBe(handle);
    await userEvent.tab({ shift: true });
    await expect(dialogIn(canvasElement).contains(canvasElement.ownerDocument.activeElement)).toBe(
      true,
    );
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.tab();
    await expect(canvasElement.ownerDocument.activeElement).toBe(
      canvas.getByRole('button', { name: 'Save trip' }),
    );
    await userEvent.keyboard('{Escape}');
    await waitFor(async () => {
      await expect(dialogIn(canvasElement).open).toBe(false);
    });
    await expect(canvasElement.ownerDocument.activeElement).toBe(trigger);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(2);
  },
};
export const BodyReadingKeys: Story = {
  // Excluded from the docs page: its open overlay (modal/backdrop) covers the documentation.
  tags: ['!autodocs'],
  args: { defaultOpen: true },
  render,
  play: async ({ canvasElement, args, userEvent }) => {
    const body = canvasElement.querySelector<HTMLElement>('[data-ui="bottom-sheet-body"]')!;
    body.focus();
    await userEvent.keyboard('{PageUp}{ArrowDown}');
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await userEvent.keyboard('{PageDown}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith(1);
    await userEvent.keyboard('{PageDown} ');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
  },
};

export const DragSettleAndDismiss: Story = {
  // Excluded from the docs page: its open overlay (modal/backdrop) covers the documentation.
  tags: ['!autodocs'],
  args: { defaultOpen: true, detents: [0.3, 0.6, 0.9] },
  render,
  play: async ({ canvasElement, args }) => {
    await settled(canvasElement, 0.3);
    const header = canvasElement.querySelector('[data-ui="bottom-sheet-header"]')!;
    const h = canvasElement.ownerDocument.defaultView!.innerHeight;
    pointer(header, 'pointerdown', h * 0.7, 0);
    await expect(getComputedStyle(header).userSelect).toBe('none');
    pointer(header, 'pointermove', h * 0.4, 100);
    pointer(header, 'pointerup', h * 0.4, 300);
    await expect(getComputedStyle(header).userSelect).not.toBe('none');
    await settled(canvasElement, 0.6);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith(1);
    await expect(args.onOpenChange).not.toHaveBeenCalled();
    pointer(header, 'pointerdown', h * 0.4, 400);
    pointer(header, 'pointermove', h * 0.95, 500);
    await expect(panelIn(canvasElement).getBoundingClientRect().height).toBeLessThan(h * 0.1);
    pointer(header, 'pointerup', h * 0.95, 700);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await waitFor(async () => {
      await expect(dialogIn(canvasElement).open).toBe(false);
    });
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
  },
};
export const GestureCancel: Story = {
  // Excluded from the docs page: its open overlay (modal/backdrop) covers the documentation.
  tags: ['!autodocs'],
  args: { defaultOpen: true },
  render,
  play: async ({ canvasElement, args, userEvent }) => {
    await settled(canvasElement, 0.45);
    const header = canvasElement.querySelector('[data-ui="bottom-sheet-header"]')!;
    for (const type of ['pointercancel', 'lostpointercapture']) {
      pointer(header, 'pointerdown', 100, 0);
      pointer(header, 'pointermove', 500, 100);
      pointer(header, type, 500, 110);
      await expect(getComputedStyle(header).userSelect).not.toBe('none');
      pointer(header, 'pointerup', 500, 120);
      await settled(canvasElement, 0.45);
    }
    pointer(header, 'pointerdown', 100, 0);
    pointer(header, 'pointermove', 500, 100);
    pointer(header, 'pointerdown', 500, 110, 2, false);
    pointer(header, 'pointerup', 500, 120);
    await settled(canvasElement, 0.45);
    const title = canvasElement.querySelector('[data-ui="bottom-sheet-title"]')!;
    pointer(title, 'pointerdown', 100, 0);
    pointer(title, 'pointermove', 500, 100);
    pointer(title, 'pointerup', 500, 120);
    await settled(canvasElement, 0.45);
    await expect(getComputedStyle(header).touchAction).toBe('auto');
    await expect(
      getComputedStyle(canvasElement.querySelector('[data-ui="bottom-sheet-handle"]')!).touchAction,
    ).toBe('none');
    pointer(header, 'pointerdown', 100, 0);
    pointer(header, 'pointermove', 500, 100);
    await userEvent.keyboard('{Escape}');
    await settled(canvasElement, 0.45);
    await expect(args.onOpenChange).not.toHaveBeenCalled();
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await userEvent.keyboard('{Escape}');
    await waitFor(async () => {
      await expect(dialogIn(canvasElement).open).toBe(false);
    });
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);
  },
};
export const TouchHandoff: Story = {
  // Excluded from the docs page: its open overlay (modal/backdrop) covers the documentation.
  tags: ['!autodocs'],
  args: { defaultOpen: true },
  render: (args) => (
    <BottomSheet {...args}>
      <Parts long />
    </BottomSheet>
  ),
  play: async ({ canvasElement, args }) => {
    await settled(canvasElement, 0.45);
    const body = canvasElement.querySelector('[data-ui="bottom-sheet-body"]')!;
    const paragraph = body.querySelector('p')!;
    touch(paragraph, 'touchstart', 100, 300, 0);
    touch(paragraph, 'touchmove', 102, 250, 100);
    touch(paragraph, 'touchend', 102, 250, 200);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith(1);
    await settled(canvasElement, 0.92);
    touch(paragraph, 'touchstart', 100, 300, 300);
    touch(paragraph, 'touchmove', 180, 302, 400);
    touch(paragraph, 'touchend', 180, 302, 500);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    touch(paragraph, 'touchstart', 100, 300, 600);
    touch(paragraph, 'touchmove', 100, 700, 700);
    touch(paragraph, 'touchcancel', 100, 700, 800);
    await settled(canvasElement, 0.92);
    await expect(args.onOpenChange).not.toHaveBeenCalled();
  },
};
export const DynamicViewport: Story = {
  // Excluded from the docs page: its open overlay (modal/backdrop) covers the documentation.
  tags: ['!autodocs'],
  args: { defaultOpen: true },
  render,
  play: async ({ canvasElement, args }) => {
    await settled(canvasElement, 0.45);
    fireEvent(canvasElement.ownerDocument.defaultView!, new Event('resize'));
    await settled(canvasElement, 0.45);
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(within(canvasElement).getByRole('status')).toBeEmptyDOMElement();
  },
};

function NativeCloseExample({ mode, ...args }: BottomSheetProps & { mode: 'form' | 'ref' }) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <BottomSheet {...args}>
      <Parts contentProps={{ ref }}>
        <form method="dialog">
          <button
            style={FIXTURE_BUTTON}
            type={mode === 'form' ? 'submit' : 'button'}
            onClick={mode === 'ref' ? () => ref.current?.close() : undefined}
          >
            Complete
          </button>
        </form>
      </Parts>
    </BottomSheet>
  );
}
// close() and <form method="dialog"> flip `open` synchronously but notify from the queued
// `close` event, so wait for the notification itself, then assert its exact count.
async function nativeClosed(
  canvasElement: HTMLElement,
  onOpenChange: BottomSheetProps['onOpenChange'],
  calls: number,
) {
  await waitFor(async () => {
    await expect(onOpenChange).toHaveBeenCalledTimes(calls);
  });
  await expect(onOpenChange).toHaveBeenLastCalledWith(false);
  await expect(dialogIn(canvasElement).open).toBe(false);
}
const nativeClosePlay: Story['play'] = async ({ canvas, canvasElement, args, userEvent }) => {
  await userEvent.click(canvas.getByRole('button', { name: TRIGGER }));
  await userEvent.click(canvas.getByRole('button', { name: 'Complete' }));
  await nativeClosed(canvasElement, args.onOpenChange, 2);
  await expect(canvasElement.ownerDocument.activeElement).toBe(
    canvas.getByRole('button', { name: TRIGGER }),
  );
  await userEvent.click(canvas.getByRole('button', { name: TRIGGER }));
  await expect(dialogIn(canvasElement).open).toBe(true);
};
export const NativeFormClose: Story = {
  render: (args) => <NativeCloseExample {...args} mode="form" />,
  play: nativeClosePlay,
};
export const RefClose: Story = {
  render: (args) => <NativeCloseExample {...args} mode="ref" />,
  play: nativeClosePlay,
};
export const CancelVeto: Story = {
  // Excluded from the docs page: its open overlay (modal/backdrop) covers the documentation.
  tags: ['!autodocs'],
  args: { defaultOpen: true },
  render: (args) => (
    <BottomSheet {...args}>
      <Parts contentProps={{ onCancel: (event) => event.preventDefault() }} />
    </BottomSheet>
  ),
  play: async ({ canvas, canvasElement, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Close' }));
    await userEvent.keyboard('{Escape}');
    await expect(dialogIn(canvasElement).open).toBe(true);
    await expect(args.onOpenChange).not.toHaveBeenCalled();
  },
};
function UnmountExample(args: BottomSheetProps) {
  const [mounted, setMounted] = useState(true);
  return (
    <BottomSheet {...args}>
      <BottomSheet.Trigger>{TRIGGER}</BottomSheet.Trigger>
      {mounted && (
        <BottomSheet.Content>
          <BottomSheet.Panel>
            <BottomSheet.Header>
              <BottomSheet.Title>{TITLE}</BottomSheet.Title>
              <BottomSheet.Close>Close</BottomSheet.Close>
            </BottomSheet.Header>
            <BottomSheet.Body>
              <button style={FIXTURE_BUTTON} onClick={() => setMounted(false)}>
                Remove sheet
              </button>
            </BottomSheet.Body>
          </BottomSheet.Panel>
        </BottomSheet.Content>
      )}
    </BottomSheet>
  );
}
export const UnmountOpen: Story = {
  render: UnmountExample,
  play: async ({ canvas, canvasElement, args, userEvent }) => {
    const trigger = canvas.getByRole('button', { name: TRIGGER });
    await userEvent.click(trigger);
    await userEvent.click(canvas.getByRole('button', { name: 'Remove sheet' }));
    await expect(dialogIn(canvasElement)).toBeNull();
    await expect(canvasElement.ownerDocument.activeElement).toBe(trigger);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(true);
  },
};

export const ExternalARIA: Story = {
  // Excluded from the docs page: its open overlay (modal/backdrop) covers the documentation.
  tags: ['!autodocs'],
  args: { defaultOpen: true },
  render: (args) => (
    <BottomSheet {...args}>
      <Parts
        contentProps={{
          'aria-label': 'Journey',
          'aria-labelledby': 'external-title unresolved-title',
          'aria-describedby': 'external-description unresolved-description',
        }}
      >
        <h3 id="external-title">Connection</h3>
        <p id="external-description">Change at Central.</p>
      </Parts>
    </BottomSheet>
  ),
  play: async ({ canvasElement }) => {
    const dialog = dialogIn(canvasElement);
    await expect(dialog).toHaveAttribute('aria-label', 'Journey');
    await expect(dialog.getAttribute('aria-labelledby')).toContain(
      'external-title unresolved-title',
    );
    await expect(dialog.getAttribute('aria-labelledby')).toContain(
      canvasElement.querySelector('[data-ui="bottom-sheet-title"]')!.id,
    );
    await expect(dialog.getAttribute('aria-describedby')).toContain(
      'external-description unresolved-description',
    );
    await expect(dialog.getAttribute('aria-describedby')).toContain(
      canvasElement.querySelector('[data-ui="bottom-sheet-description"]')!.id,
    );
  },
};
function FalsyExample(args: BottomSheetProps) {
  const [content, setContent] = useState<ReactNode>(false);
  return (
    <BottomSheet {...args}>
      <BottomSheet.Content aria-label="Content">
        <BottomSheet.Panel>
          <BottomSheet.Header>
            <BottomSheet.Title>{content}</BottomSheet.Title>
            <BottomSheet.Description>{content}</BottomSheet.Description>
            <BottomSheet.Close>Close</BottomSheet.Close>
          </BottomSheet.Header>
          <BottomSheet.Body>
            <p>Content states</p>
          </BottomSheet.Body>
          <BottomSheet.Footer>
            {[false, null, 0, ''].map((value, index) => (
              <button key={index} style={FIXTURE_BUTTON} onClick={() => setContent(value)}>
                State {index}
              </button>
            ))}
          </BottomSheet.Footer>
        </BottomSheet.Panel>
      </BottomSheet.Content>
    </BottomSheet>
  );
}
export const FalsyContent: Story = {
  // Excluded from the docs page: its open overlay (modal/backdrop) covers the documentation.
  tags: ['!autodocs'],
  args: { defaultOpen: true },
  render: FalsyExample,
  play: async ({ canvas, canvasElement, userEvent }) => {
    for (const index of [0, 1, 2, 3]) {
      await userEvent.click(canvas.getByRole('button', { name: `State ${index}` }));
      if (index === 2) {
        await expect(
          canvasElement.querySelector('[data-ui="bottom-sheet-title"]'),
        ).toHaveTextContent('0');
        await expect(dialogIn(canvasElement)).toHaveAttribute('aria-labelledby');
        await expect(dialogIn(canvasElement)).toHaveAttribute('aria-describedby');
      } else {
        await expect(canvasElement.querySelector('[data-ui="bottom-sheet-title"]')).toBeNull();
        await expect(
          canvasElement.querySelector('[data-ui="bottom-sheet-description"]'),
        ).toBeNull();
        await expect(dialogIn(canvasElement)).not.toHaveAttribute('aria-labelledby');
        await expect(dialogIn(canvasElement)).not.toHaveAttribute('aria-describedby');
      }
    }
  },
};

function NestedExample(args: BottomSheetProps) {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  return (
    <BottomSheet {...args}>
      <BottomSheet.Trigger>{TRIGGER}</BottomSheet.Trigger>
      <BottomSheet.Content>
        <div ref={setHost} />
        <ThemeRoot portalContainer={host}>
          <BottomSheet.Panel>
            <BottomSheet.Header>
              <BottomSheet.Handle aria-label="Resize sheet" />
              <BottomSheet.Title>{TITLE}</BottomSheet.Title>
              <BottomSheet.Close>Close</BottomSheet.Close>
            </BottomSheet.Header>
            <BottomSheet.Body>
              <Popover>
                <Popover.Trigger>Connection</Popover.Trigger>
                <Popover.Content aria-label="Connection">
                  <button style={FIXTURE_BUTTON}>Details</button>
                </Popover.Content>
              </Popover>
            </BottomSheet.Body>
          </BottomSheet.Panel>
        </ThemeRoot>
      </BottomSheet.Content>
    </BottomSheet>
  );
}
export const NestedOverlay: Story = {
  render: NestedExample,
  play: async ({ canvas, canvasElement, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: TRIGGER }));
    await userEvent.click(canvas.getByRole('button', { name: 'Connection' }));
    await expect(canvas.getByRole('dialog', { name: 'Connection' })).toBeVisible();
    await expect(
      dialogIn(canvasElement).contains(canvas.getByRole('dialog', { name: 'Connection' })),
    ).toBe(true);
    await userEvent.keyboard('{Escape}');
    await waitFor(async () => {
      await expect(canvas.queryByRole('dialog', { name: 'Connection' })).toBeNull();
    });
    await expect(dialogIn(canvasElement).open).toBe(true);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(true);
    await userEvent.click(canvas.getByRole('button', { name: 'Connection' }));
    await userEvent.click(dialogIn(canvasElement));
    await expect(dialogIn(canvasElement).open).toBe(true);
    await waitFor(async () => {
      await expect(canvas.queryByRole('dialog', { name: 'Connection' })).toBeNull();
    });
    await userEvent.keyboard('{Escape}');
    await waitFor(async () => {
      await expect(dialogIn(canvasElement).open).toBe(false);
    });
    await expect(args.onOpenChange).toHaveBeenCalledTimes(2);
  },
};
export const RTL: Story = {
  // Excluded from the docs page: its open overlay (modal/backdrop) covers the documentation.
  tags: ['!autodocs'],
  args: { defaultOpen: true },
  render: (args) => (
    <BottomSheet {...args}>
      <Parts contentProps={{ dir: 'rtl' }} />
    </BottomSheet>
  ),
  play: async ({ canvasElement }) => {
    await expect(getComputedStyle(panelIn(canvasElement)).direction).toBe('rtl');
    await settled(canvasElement, 0.45);
  },
};
export const ReducedMotion: Story = {
  // Excluded from the docs page: its open overlay (modal/backdrop) covers the documentation.
  tags: ['!autodocs'],
  args: { defaultOpen: true },
  render,
  parameters: {
    docs: {
      description: {
        story:
          'Enable reduced motion in the browser. Height changes should settle without animation; this story does not set the preference.',
      },
    },
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Resize sheet' }));
    await settled(canvasElement, 0.92);
  },
};
export const ForcedColors: Story = {
  // Excluded from the docs page: its open overlay (modal/backdrop) covers the documentation.
  tags: ['!autodocs'],
  args: { defaultOpen: true },
  render,
  parameters: {
    docs: {
      description: {
        story:
          'Enable forced colors in the browser to check system colors on the border and grabber.',
      },
    },
  },
  play: async ({ canvas, canvasElement }) => {
    await expect(getComputedStyle(panelIn(canvasElement)).borderTopStyle).toBe('solid');
    const handle = canvas.getByRole('button', { name: 'Resize sheet' });
    await expect(getComputedStyle(handle, '::after').height).not.toBe('0px');
  },
};
export const StylingAndRefs: Story = {
  // Excluded from the docs page: its open overlay (modal/backdrop) covers the documentation.
  tags: ['!autodocs'],
  args: { defaultOpen: true },
  render: (args) => (
    <BottomSheet {...args}>
      <Parts contentProps={{ ref: contentRefSpy, sx: { '--fixture': 'sheet' } }} />
    </BottomSheet>
  ),
  play: async ({ canvasElement }) => {
    await expect(contentRefSpy).toHaveBeenCalledWith(dialogIn(canvasElement));
    await expect(getComputedStyle(dialogIn(canvasElement)).getPropertyValue('--fixture')).toBe(
      'sheet',
    );
  },
};
const contentRefSpy = fn();

function ExternalValueExample(args: BottomSheetProps) {
  const [value, setValue] = useState(0);
  return (
    <BottomSheet {...args} value={value} detents={[0.45, 0.92]}>
      <BottomSheet.Content>
        <BottomSheet.Panel>
          <BottomSheet.Header>
            <BottomSheet.Handle aria-label="Resize sheet" />
            <BottomSheet.Title>{TITLE}</BottomSheet.Title>
            <BottomSheet.Close>Close</BottomSheet.Close>
          </BottomSheet.Header>
          <BottomSheet.Body>
            <p>Train 42</p>
          </BottomSheet.Body>
          <BottomSheet.Footer>
            <button style={FIXTURE_BUTTON} onClick={() => setValue(1)}>
              Set expanded
            </button>
          </BottomSheet.Footer>
        </BottomSheet.Panel>
      </BottomSheet.Content>
    </BottomSheet>
  );
}
export const ExternalValue: Story = {
  // Excluded from the docs page: its open overlay (modal/backdrop) covers the documentation.
  tags: ['!autodocs'],
  args: { defaultOpen: true, locale: 'de-DE' },
  render: ExternalValueExample,
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    await expect(canvas.getByRole('status')).toBeEmptyDOMElement();
    await userEvent.click(canvas.getByRole('button', { name: 'Set expanded' }));
    await settled(canvasElement, 0.92);
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(canvas.getByRole('button', { name: 'Resize sheet' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    await expect(canvas.getByRole('status').textContent).toBe(
      new Intl.NumberFormat('de-DE', { style: 'percent' }).format(0.92),
    );
    fireEvent(canvasElement.ownerDocument.defaultView!, new Event('resize'));
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};
export const NativeRejectedRepair: Story = {
  // Excluded from the docs page: its open overlay (modal/backdrop) covers the documentation.
  tags: ['!autodocs'],
  args: { open: true },
  render: (args) => <NativeCloseExample {...args} mode="ref" />,
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Complete' }));
    await nativeClosed(canvasElement, args.onOpenChange, 1);
    await userEvent.click(canvas.getByRole('button', { name: TRIGGER }));
    await waitFor(async () => {
      await expect(dialogIn(canvasElement).open).toBe(true);
    });
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
  },
};
