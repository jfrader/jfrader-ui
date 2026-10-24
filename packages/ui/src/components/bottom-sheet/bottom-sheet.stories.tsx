// `styled` is the app-facing styling API; consumers import it from `@jfrader/ui`.
import { styled } from '../../index';
import { useRef, useState, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fireEvent, fn, waitFor, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { withLightTheme } from '../../testing/story-decorators';
import { expectContrastSurface } from '../../testing/theme-assertions';
import { expectAligned, expectInside, expectNoOverlap } from '../../testing/geometry-assertions';
import { OverlayPortal } from '../../overlay/overlay-portal';
import { Surface, type SurfacePartProps } from '../surface';
import { Card } from '../card';
import { Button as FixtureButton } from '../button';
import { ThemeRoot } from '../theme-root';
import { Popover } from '../popover';
import {
  BottomSheet,
  type BottomSheetComposedProps,
  type BottomSheetContentProps,
  type BottomSheetShorthandProps,
  type BottomSheetPanelProps,
  type BottomSheetProps,
  type BottomSheetSlotProps,
} from './index';

const TITLE = 'Trip details';
function ReplacementSheetContent(props: BottomSheetContentProps) {
  return <BottomSheet.Content {...props} data-testid="custom-sheet-content" />;
}

function ReplacementSheetPanel(props: BottomSheetPanelProps) {
  return <BottomSheet.Panel {...props} data-testid="custom-sheet-panel" />;
}

export const ShellAndPanelReplacements: StoryObj<typeof BottomSheet> = {
  tags: ['!autodocs'],
  render: () => <BottomSheet triggerLabel="Open trip" title={TITLE} content="Trip itinerary" closeLabel="Close" defaultOpen slots={{ content: ReplacementSheetContent, panel: ReplacementSheetPanel }} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const shell = canvas.getByTestId('custom-sheet-content');
    const panel = canvas.getByTestId('custom-sheet-panel');
    await expect(shell.tagName).toBe('DIALOG');
    await expect(shell).toHaveAttribute('open');
    await expect(panel.getAttribute('data-ui')?.split(' ')).toContain('bottom-sheet-panel');
    await expect(panel.className).not.toBe('');
    await expect(within(panel).getByRole('heading', { name: TITLE })).toBeInTheDocument();
    // The body scrolls; a scrollable region must be keyboard-reachable (axe: scrollable-region-focusable).
    await expect(panel.querySelector('[data-ui="bottom-sheet-body"]')).toHaveAttribute('tabindex', '0');
  },
};
const TRIGGER = 'Open trip';

const meta = {
  title: 'Surfaces/BottomSheet',
  component: BottomSheet,
  tags: ['autodocs'],
  args: { onOpenChange: fn(), onValueChange: fn() },
  parameters: {
    docs: {
      description: {
        component:
          'Open content from the bottom of the screen. Drag the handle or use the keyboard to change its height.',
      },
      sections: [
        { title: 'Shorthand and composed', stories: ['Default', 'Composed'] },
        { title: 'Keyboard', stories: ['KeyboardNavigation'] },
        { title: 'Controlled and disabled', stories: ['Controlled', 'ShorthandModeDisabled'] },
        { title: 'Native form', stories: ['NativeFormClose'] },
        { title: 'Nested', stories: ['NestedOverlay'] },
        { title: 'Drag', stories: ['DragToResize'] },
      ],
      usage: `### When to use
Use a bottom sheet on mobile viewports or touch devices for secondary tasks, filters, or details that open from the bottom without leaving the current view.

### Values and constraints

The sheet is always modal; the background page remains inert even at peek heights. Height snaps to stable ascending detents between 0 and 1; remount the sheet to change detent values. The panel rises when opening and finishes sinking before the dialog closes. Reduced motion disables sliding and spring travel. Floating overlays inside the sheet must portal into a container inside the sheet rather than the document body.

### Keyboard and accessibility

Focusing the handle: Arrow Up and Down navigate between adjacent detents, Home and End jump to the highest and lowest detents, and Enter or Space toggles between extremes. In the scrollable body, PageDown and Space expand to the maximum height before scrolling down. Escape cancels an active drag gesture first; a subsequent Escape dismisses the sheet.

Provide an accessible name for the sheet heading, resize handle, and close button. If the sheet contains complex structured content, opt out of the automatic accessible description so assistive technology reads content in order rather than as a single description string.`,
    },
  },
} satisfies Meta<typeof BottomSheet>;
export default meta;
type Story = StoryObj<(props: BottomSheetComposedProps) => ReactNode>;

const AdapterMaterial = styled.div({ backgroundColor: vars.color.surfaceRaised, color: vars.color.text, border: `1px dashed ${vars.color.border}`, borderRadius: vars.radius.full, boxShadow: 'none' });
function SheetPaper({ className, ...props }: SurfacePartProps) {
  return <AdapterMaterial {...props} className={className} />;
}

function rootAdapterStory(component: BottomSheetPanelProps['component']): Story {
  // The slot style deliberately challenges the host-owned transform API.
  return {
    tags: ['!autodocs'],
    render: (args) => <BottomSheet {...args} defaultOpen><Parts panelProps={{
      component,
      slotProps: { root: {
        id: 'displaced-panel-id', className: 'panel-slot',
        ref: (node) => { if (node) node.dataset.rootRef = 'slot'; },
        style: { transform: 'none' },
      } },
    }} /></BottomSheet>,
    play: async ({ canvas, canvasElement, userEvent }) => {
      const shell = canvasElement.querySelector('dialog')!;
      const panel = shell.querySelector<HTMLElement>('[data-ui~="bottom-sheet-panel"]')!;
      await expect(panel).toHaveAttribute('data-root-ref', 'slot');
      await expect(panel.id).not.toBe('displaced-panel-id');
      await expect(panel).toHaveClass('panel-slot');
      await expect(panel.querySelector('[data-ui~="bottom-sheet-panel"]')).toBeNull();
      await expect(getComputedStyle(panel).borderEndStartRadius).toBe('0px');
      await userEvent.click(canvas.getByRole('button', { name: 'Resize sheet' }));
      await userEvent.keyboard('{End}');
      await expect(canvas.getByRole('button', { name: 'Resize sheet' })).toHaveAttribute('aria-expanded', 'false');
      await userEvent.keyboard('{Home}');
      await expect(canvas.getByRole('button', { name: 'Resize sheet' })).toHaveAttribute('aria-expanded', 'true');
      await waitFor(() => expect(Number.parseFloat(panel.style.getPropertyValue('--sheet-height'))).toBeGreaterThan(0));
      await expect(panel.style.transform).not.toBe('none');
      await userEvent.click(canvas.getByRole('button', { name: 'Close' }));
      await waitFor(() => expect(shell).not.toHaveAttribute('open'));
      await userEvent.click(canvas.getByRole('button', { name: TRIGGER }));
      await waitFor(() => expect(shell).toHaveAttribute('open'));
      await expect(shell.querySelector('[data-ui~="bottom-sheet-panel"]')).toBe(panel);
      if (component === SheetPaper) await expect(getComputedStyle(panel).borderTopStyle).toBe('dashed');
    },
  };
}

export const SurfaceAdapter = rootAdapterStory(Surface);
export const CardAdapter = rootAdapterStory(Card);
export const IndependentMaterialAdapter = rootAdapterStory(SheetPaper);
export const SurfaceAdapterLight: Story = {
  tags: ['!autodocs'], ...SurfaceAdapter, decorators: [withLightTheme], globals: { theme: 'light' } };

function ContrastPortalFixture({ theme = 'light', ...props }: BottomSheetComposedProps & { theme?: 'dark' | 'light' }) {
  const [panel, setPanel] = useState<HTMLDivElement | null>(null);
  return <ThemeRoot theme={theme} portalContainer={panel}>
    <BottomSheet {...props} defaultOpen>
      <BottomSheet.Content><BottomSheet.Panel appearance="contrast" ref={setPanel}>
        <BottomSheet.Header><BottomSheet.Title>Trip details</BottomSheet.Title><BottomSheet.Close>Close</BottomSheet.Close></BottomSheet.Header>
        <BottomSheet.Body tabIndex={0}>
          <Surface appearance="default" data-testid="inherited-sheet-surface">Departure information</Surface>
          <OverlayPortal><Surface data-testid="sheet-contrast-portal">Platform information</Surface></OverlayPortal>
        </BottomSheet.Body>
      </BottomSheet.Panel></BottomSheet.Content>
    </BottomSheet>
  </ThemeRoot>;
}

export const BottomSheetContrastPortal: Story = {
  globals: { theme: 'light' },
  tags: ['!autodocs'],
  render: (args) => <ContrastPortalFixture {...args} />,
  play: async ({ canvas, canvasElement }) => {
    const panel = canvasElement.querySelector<HTMLElement>('[data-ui~="bottom-sheet-panel"]')!;
    await expect(panel).toHaveAttribute('data-appearance', 'contrast');
    await expectContrastSurface(panel, 'light');
    const portal = await within(panel).findByTestId('sheet-contrast-portal');
    await expect(portal.closest('[data-ui="theme-boundary"]')).toHaveAttribute('data-appearance', 'contrast');
    await expect(getComputedStyle(portal).backgroundColor).toBe(getComputedStyle(panel).backgroundColor);
    await expect(getComputedStyle(canvas.getByTestId('inherited-sheet-surface')).backgroundColor).toBe(getComputedStyle(panel).backgroundColor);
    await expectAligned([
      canvas.getByRole('heading', { name: TITLE }),
      canvas.getByRole('button', { name: 'Close' }),
    ], 'top');
  },
};
export const BottomSheetContrastPortalDark: Story = {
  ...BottomSheetContrastPortal,
  globals: { theme: 'dark' },
  render: (args) => <ContrastPortalFixture {...args} theme="dark" />,
};

function Parts({
  long = false,
  contentProps,
  panelProps,
  children,
}: {
  long?: boolean;
  contentProps?: BottomSheetContentProps;
  panelProps?: BottomSheetPanelProps;
  children?: ReactNode;
}) {
  return (
    <>
      <BottomSheet.Trigger>{TRIGGER}</BottomSheet.Trigger>
      <BottomSheet.Content {...contentProps}>
        <BottomSheet.Panel {...panelProps}>
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
                <FixtureButton>Save trip</FixtureButton>
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

export const Default: StoryObj<(props: BottomSheetShorthandProps) => ReactNode> = {
  name: 'Trip itinerary',
  args: {
    triggerLabel: TRIGGER,
    title: TITLE,
    description: 'Departure and arrival information.',
    content: (
      <>
        <p>Train 42 · Platform 3</p>
        <FixtureButton>Save trip</FixtureButton>
      </>
    ),
    closeLabel: 'Close',
    onOpenChange: fn(),
  },
  parameters: {
    docs: {
      description: {
        story:
          'Open a trip itinerary from the bottom of the screen with generated title, description, and close button.',
      },
      source: {
        language: 'tsx',
        code: `import { BottomSheet, Button } from '@jfrader/ui';

<BottomSheet
  triggerLabel="Open trip"
  title="Trip details"
  description="Departure and arrival information."
  content={
    <>
      <p>Train 42 · Platform 3</p>
      <Button>Save trip</Button>
    </>
  }
  closeLabel="Close"
/>`,
      },
    },
  },
  render: (args) => <BottomSheet {...args} />,
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const trigger = canvas.getByRole('button', { name: TRIGGER });
    await userEvent.tab();
    await expect(trigger).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    const dialog = dialogIn(canvasElement);
    await expect(getComputedStyle(dialog).zIndex).toBe('200');
    await expect(dialog.open).toBe(true);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(true);
    await settled(canvasElement, 0.45);

    await expect(dialog).toHaveAccessibleName(TITLE);
    await expect(dialog).toHaveAccessibleDescription('Departure and arrival information.');
    const handle = canvas.getByRole('button', { name: TITLE });
    await expect(handle).toBeInTheDocument();

    const close = canvas.getByRole('button', { name: 'Close' });
    await userEvent.click(close);
    await waitFor(async () => {
      await expect(dialog.open).toBe(false);
    });
    await expect(args.onOpenChange).toHaveBeenCalledTimes(2);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);
    await expect(canvasElement.ownerDocument.activeElement).toBe(trigger);
  },
};

export const Composed: Story = {
  name: 'Composed anatomy',
  parameters: {
    docs: {
      description: {
        story:
          'Arrange the trigger, dialog shell, animated panel, header, handle, body, and footer with composed parts.',
      },
      source: {
        language: 'tsx',
        code: `import { BottomSheet, Button } from '@jfrader/ui';

<BottomSheet>
  <BottomSheet.Trigger>Open trip</BottomSheet.Trigger>
  <BottomSheet.Content>
    <BottomSheet.Panel>
      <BottomSheet.Header>
        <BottomSheet.Handle aria-label="Resize sheet" />
        <BottomSheet.Title>Trip details</BottomSheet.Title>
        <BottomSheet.Description>Departure and arrival information.</BottomSheet.Description>
        <BottomSheet.Close>Close</BottomSheet.Close>
      </BottomSheet.Header>
      <BottomSheet.Body>
        <p>Train 42 · Platform 3</p>
        <Button>Save trip</Button>
      </BottomSheet.Body>
      <BottomSheet.Footer>
        <span>Departure 09:30</span>
      </BottomSheet.Footer>
    </BottomSheet.Panel>
  </BottomSheet.Content>
</BottomSheet>`,
      },
    },
  },
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

export const ShorthandModeKeyboard: StoryObj<(props: BottomSheetShorthandProps) => ReactNode> = {
  name: 'Shorthand mode keyboard',
  args: {
    triggerLabel: TRIGGER,
    title: TITLE,
    description: 'Departure and arrival information.',
    content: (
      <>
        <p>Train 42 · Platform 3</p>
        <FixtureButton>Save trip</FixtureButton>
      </>
    ),
    closeLabel: 'Close',
    onOpenChange: fn(),
  },
  render: (args) => <BottomSheet {...args} />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    const trigger = canvas.getByRole('button', { name: TRIGGER });
    await userEvent.tab();
    await expect(trigger).toHaveFocus();
    await userEvent.keyboard(' ');
    const dialog = dialogIn(canvasElement);
    await expect(dialog.open).toBe(true);
    await settled(canvasElement, 0.45);

    const handle = canvas.getByRole('button', { name: TITLE });
    const originalCapture = handle.setPointerCapture;
    const capture = fn();
    handle.setPointerCapture = capture;
    try {
      pointer(handle, 'pointerdown', 100, 0);
      await expect(capture).toHaveBeenCalledWith(1);
      pointer(handle, 'pointercancel', 100, 1);
    } finally {
      handle.setPointerCapture = originalCapture;
    }
    await userEvent.click(handle);
    await userEvent.keyboard('{ArrowUp}');
    await settled(canvasElement, 0.92);
    await expect(handle).toHaveAttribute('aria-expanded', 'true');

    await userEvent.keyboard('{ArrowDown}');
    await settled(canvasElement, 0.45);
    await expect(handle).toHaveAttribute('aria-expanded', 'false');

    await userEvent.keyboard('{Escape}');
    await waitFor(async () => {
      await expect(dialog.open).toBe(false);
    });
    await expect(canvasElement.ownerDocument.activeElement).toBe(trigger);
  },
};

function ControlledShorthandBottomSheet(props: BottomSheetShorthandProps) {
  const [open, setOpen] = useState(false);
  return (
    <BottomSheet
      {...props}
      open={open}
      onOpenChange={(next) => {
        props.onOpenChange?.(next);
        setOpen(next);
      }}
    />
  );
}
ControlledShorthandBottomSheet.displayName = 'ControlledShorthandBottomSheet';

export const ShorthandModeControlled: StoryObj<(props: BottomSheetShorthandProps) => ReactNode> = {
  name: 'Shorthand mode controlled',
  args: {
    triggerLabel: TRIGGER,
    title: TITLE,
    description: 'Departure and arrival information.',
    content: (
      <>
        <p>Train 42 · Platform 3</p>
        <FixtureButton>Save trip</FixtureButton>
      </>
    ),
    closeLabel: 'Close',
    onOpenChange: fn(),
  },
  render: (args) => <ControlledShorthandBottomSheet {...args} />,
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const trigger = canvas.getByRole('button', { name: TRIGGER });
    await userEvent.click(trigger);
    const dialog = dialogIn(canvasElement);
    await expect(dialog.open).toBe(true);
    await expect(args.onOpenChange).toHaveBeenCalledWith(true);
    await settled(canvasElement, 0.45);

    const close = canvas.getByRole('button', { name: 'Close' });
    await userEvent.click(close);
    await waitFor(async () => {
      await expect(dialog.open).toBe(false);
    });
    await expect(args.onOpenChange).toHaveBeenCalledWith(false);
    await expect(canvasElement.ownerDocument.activeElement).toBe(trigger);
  },
};

export const ShorthandModeDisabled: StoryObj<(props: BottomSheetShorthandProps) => ReactNode> = {
  name: 'Disabled trigger',
  args: {
    triggerLabel: TRIGGER,
    title: TITLE,
    description: 'Departure and arrival information.',
    content: (
      <>
        <p>Train 42 · Platform 3</p>
        <FixtureButton>Save trip</FixtureButton>
      </>
    ),
    closeLabel: 'Close',
    onOpenChange: fn(),
    slotProps: {
      trigger: {
        disabled: true,
      },
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'Disable the trigger button to prevent opening the bottom sheet.',
      },
      source: {
        language: 'tsx',
        code: `import { BottomSheet, Button } from '@jfrader/ui';

<BottomSheet
  triggerLabel="Open trip"
  title="Trip details"
  description="Departure and arrival information."
  content={
    <>
      <p>Train 42 · Platform 3</p>
      <Button>Save trip</Button>
    </>
  }
  closeLabel="Close"
  slotProps={{
    trigger: {
      disabled: true,
    },
  }}
/>`,
      },
    },
  },
  render: (args) => <BottomSheet {...args} />,
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const trigger = canvas.getByRole('button', { name: TRIGGER });
    await expect(trigger).toBeDisabled();
    await userEvent.click(trigger);
    await expect(dialogIn(canvasElement).open).toBe(false);
    await expect(args.onOpenChange).not.toHaveBeenCalled();
  },
};

export const ShorthandModeCustomizationSlotProps: StoryObj<(props: BottomSheetShorthandProps) => ReactNode> = {
  name: 'Shorthand mode customization slotProps',
  args: {
    triggerLabel: TRIGGER,
    title: TITLE,
    description: 'Departure and arrival information.',
    content: (
      <>
        <p>Train 42 · Platform 3</p>
        <FixtureButton>Save trip</FixtureButton>
      </>
    ),
    closeLabel: 'Close',
    onOpenChange: fn(),
    slotProps: {
      trigger: { className: 'custom-trigger', 'data-testid': 'custom-trigger' },
      content: { className: 'custom-content', 'data-testid': 'custom-content' },
      panel: {
        slots: { root: SheetPaper },
        className: 'custom-panel',
        'data-testid': 'custom-panel',
      },
      header: { className: 'custom-header', 'data-testid': 'custom-header' },
      handle: { className: 'custom-handle', 'data-testid': 'custom-handle', 'aria-label': 'Adjust height' },
      title: { className: 'custom-title', 'data-testid': 'custom-title' },
      description: { className: 'custom-description', 'data-testid': 'custom-description' },
      close: { className: 'custom-close', 'data-testid': 'custom-close' },
      body: { className: 'custom-body', 'data-testid': 'custom-body' },
    },
  },
  render: (args) => <BottomSheet {...args} />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    const trigger = canvas.getByTestId('custom-trigger');
    await expect(trigger).toHaveClass('custom-trigger');
    await userEvent.click(trigger);
    const dialog = dialogIn(canvasElement);
    await expect(dialog.open).toBe(true);
    await settled(canvasElement, 0.45);
    await expect(dialog).toHaveClass('custom-content');
    await expect(dialog).toHaveAttribute('data-testid', 'custom-content');

    const panel = canvasElement.querySelector<HTMLElement>('[data-testid="custom-panel"]')!;
    await expect(panel).toHaveClass('custom-panel');
    await expect(getComputedStyle(panel).borderTopStyle).toBe('dashed');

    const header = canvasElement.querySelector<HTMLElement>('[data-testid="custom-header"]')!;
    await expect(header).toHaveClass('custom-header');

    const handle = canvas.getByTestId('custom-handle');
    await expect(handle).toHaveClass('custom-handle');
    await expect(handle).toHaveAttribute('aria-label', 'Adjust height');

    const title = canvas.getByRole('heading', { name: TITLE });
    await expect(title).toHaveClass('custom-title');
    await expect(title).toHaveAttribute('data-testid', 'custom-title');

    const desc = canvasElement.querySelector<HTMLElement>('[data-testid="custom-description"]')!;
    await expect(desc).toHaveClass('custom-description');

    const close = canvas.getByRole('button', { name: 'Close' });
    await expect(close).toHaveClass('custom-close');
    await expect(close).toHaveAttribute('data-testid', 'custom-close');

    const body = canvasElement.querySelector<HTMLElement>('[data-testid="custom-body"]')!;
    await expect(body).toHaveClass('custom-body');

    await userEvent.click(close);
    await waitFor(async () => {
      await expect(dialog.open).toBe(false);
    });
    await expect(canvasElement.ownerDocument.activeElement).toBe(trigger);
  },
};

export const ShorthandModeWithoutDescription: StoryObj<(props: BottomSheetShorthandProps) => ReactNode> = {
  tags: ['!autodocs'],
  name: 'Shorthand mode without description',
  args: {
    triggerLabel: TRIGGER,
    title: TITLE,
    description: undefined,
    content: (
      <>
        <p>Train 42 · Platform 3</p>
      </>
    ),
    closeLabel: 'Close',
    onOpenChange: fn(),
  },
  render: (args) => <BottomSheet {...args} defaultOpen />,
  play: async ({ canvas, canvasElement }) => {
    const dialog = dialogIn(canvasElement);
    await settled(canvasElement, 0.45);
    await expect(dialog).not.toHaveAttribute('aria-describedby');
    await expect(canvasElement.querySelector('[data-ui="bottom-sheet-description"]')).toBeNull();
  },
};

function shorthandModeTypeContracts() {
  // @ts-expect-error Presentation mode rejects composed children.
  <BottomSheet triggerLabel="Open" title="Trip" content="Trip" closeLabel="Close">Composed</BottomSheet>;
  // @ts-expect-error Presentation mode requires title and closeLabel.
  <BottomSheet triggerLabel="Open" content="Trip" />;
  // @ts-expect-error Named presentation props cannot leak into composed mode.
  <BottomSheet title="Trip"><BottomSheet.Content /></BottomSheet>;
}
void shorthandModeTypeContracts;
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
export const EntranceSurvivesInlineResize: Story = {
  render,
  play: async ({ canvas, canvasElement }) => {
    const trigger = canvas.getByRole('button', { name: TRIGGER });
    const win = canvasElement.ownerDocument.defaultView!;
    const viewportBottom = (win.visualViewport?.offsetTop ?? 0) + (win.visualViewport?.height ?? win.innerHeight);
    const detentTop = viewportBottom - (win.visualViewport?.height ?? win.innerHeight) * 0.45;

    // Hiding the page scrollbar resizes the viewport inline only; the panel keeps rising.
    const entrance = await sampleFrames(
      canvasElement,
      () => {
        trigger.click();
        win.requestAnimationFrame(() => win.dispatchEvent(new Event('resize')));
      },
      (frame) => Math.abs(frame.top - detentTop) < 1,
    );
    await expect(new Set(entrance.map((frame) => frame.top)).size).toBeGreaterThan(2);
    await expect(isMonotonic(entrance.map((frame) => frame.top), -1)).toBe(true);
    await settled(canvasElement, 0.45);
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

/** Long names wrap beside the close button on narrow sheets. */
export const LongHeader: StoryObj<(props: BottomSheetShorthandProps) => ReactNode> = {
  tags: ['!autodocs'],
  args: {
    defaultOpen: true,
    triggerLabel: TRIGGER,
    title: 'InternationalIntercontinentalConnectionConfirmation',
    description: 'Departure and arrival information. Check the platform before boarding.',
    content: <p>{'InternationalIntercontinentalConnectionConfirmation'.repeat(3)}</p>,
    closeLabel: 'Close',
    sx: { maxInlineSize: '24rem' },
  },
  render: (args) => <BottomSheet {...args} />,
  play: async ({ canvas, canvasElement }) => {
    await settled(canvasElement, 0.45);
    const panel = panelIn(canvasElement);
    const title = canvas.getByRole('heading');
    const close = canvas.getByRole('button', { name: 'Close' });
    for (const direction of ['ltr', 'rtl']) {
      panel.dir = direction;
      const body = canvasElement.querySelector<HTMLElement>('[data-ui="bottom-sheet-body"]')!;
      await expect(body.scrollWidth).toBeLessThanOrEqual(body.clientWidth + 1);
      await expect(title.scrollWidth).toBeLessThanOrEqual(title.clientWidth + 1);
      await expectInside(title, panel);
      await expectInside(close, panel);
      await expectNoOverlap(title, close);
    }
    panel.removeAttribute('dir');
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

function ControlledExample(args: BottomSheetComposedProps) {
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
  name: 'Controlled detent and open state',
  parameters: {
    docs: {
      description: {
        story: 'Drive the sheet visibility and active detent index from external state.',
      },
      source: {
        language: 'tsx',
        code: `import { useState } from 'react';
import { BottomSheet, Button } from '@jfrader/ui';

function ControlledTripSheet() {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(0);

  return (
    <BottomSheet
      open={open}
      onOpenChange={setOpen}
      value={value}
      onValueChange={setValue}
    >
      <BottomSheet.Trigger>Open trip</BottomSheet.Trigger>
      <BottomSheet.Content>
        <BottomSheet.Panel>
          <BottomSheet.Header>
            <BottomSheet.Handle aria-label="Resize sheet" />
            <BottomSheet.Title>Trip details</BottomSheet.Title>
            <BottomSheet.Description>Departure and arrival information.</BottomSheet.Description>
            <BottomSheet.Close>Close</BottomSheet.Close>
          </BottomSheet.Header>
          <BottomSheet.Body>
            <p>Train 42 · Platform 3</p>
            <Button>Save trip</Button>
          </BottomSheet.Body>
          <BottomSheet.Footer>
            <span>Departure 09:30</span>
          </BottomSheet.Footer>
        </BottomSheet.Panel>
      </BottomSheet.Content>
    </BottomSheet>
  );
}`,
      },
    },
  },
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
  name: 'Keyboard navigation',
  parameters: {
    docs: {
      description: {
        story:
          'Step between detents with ArrowUp, ArrowDown, Home, End, or Space, and close with Escape.',
      },
      source: {
        language: 'tsx',
        code: `import { BottomSheet, Button } from '@jfrader/ui';

<BottomSheet>
  <BottomSheet.Trigger>Open trip</BottomSheet.Trigger>
  <BottomSheet.Content>
    <BottomSheet.Panel>
      <BottomSheet.Header>
        <BottomSheet.Handle aria-label="Resize sheet" />
        <BottomSheet.Title>Trip details</BottomSheet.Title>
        <BottomSheet.Description>Departure and arrival information.</BottomSheet.Description>
        <BottomSheet.Close>Close</BottomSheet.Close>
      </BottomSheet.Header>
      <BottomSheet.Body>
        <p>Train 42 · Platform 3</p>
        <Button>Save trip</Button>
      </BottomSheet.Body>
      <BottomSheet.Footer>
        <span>Departure 09:30</span>
      </BottomSheet.Footer>
    </BottomSheet.Panel>
  </BottomSheet.Content>
</BottomSheet>`,
      },
    },
  },
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
    await waitFor(() => expect(panelIn(canvasElement).getBoundingClientRect().height).toBeLessThan(h * 0.1));
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

export const DragToResize: Story = {
  name: 'Drag to resize and dismiss',
  args: { detents: [0.3, 0.6, 0.9] },
  parameters: {
    docs: {
      description: {
        story:
          'Drag the header or handle to settle at adjacent detents or swipe down to dismiss.',
      },
      source: {
        language: 'tsx',
        code: `import { BottomSheet, Button } from '@jfrader/ui';

<BottomSheet detents={[0.3, 0.6, 0.9]}>
  <BottomSheet.Trigger>Open trip</BottomSheet.Trigger>
  <BottomSheet.Content>
    <BottomSheet.Panel>
      <BottomSheet.Header>
        <BottomSheet.Handle aria-label="Resize sheet" />
        <BottomSheet.Title>Trip details</BottomSheet.Title>
        <BottomSheet.Description>Departure and arrival information.</BottomSheet.Description>
        <BottomSheet.Close>Close</BottomSheet.Close>
      </BottomSheet.Header>
      <BottomSheet.Body>
        <p>Train 42 · Platform 3</p>
        <Button>Save trip</Button>
      </BottomSheet.Body>
      <BottomSheet.Footer>
        <span>Departure 09:30</span>
      </BottomSheet.Footer>
    </BottomSheet.Panel>
  </BottomSheet.Content>
</BottomSheet>`,
      },
    },
  },
  render,
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

function NativeCloseExample({ mode, ...args }: BottomSheetComposedProps & { mode: 'form' | 'ref' }) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <BottomSheet {...args}>
      <Parts contentProps={{ ref }}>
        <form method="dialog">
          <FixtureButton

            type={mode === 'form' ? 'submit' : 'button'}
            onClick={mode === 'ref' ? () => ref.current?.close() : undefined}
          >
            Complete
          </FixtureButton>
        </form>
      </Parts>
    </BottomSheet>
  );
}
// close() and <form method="dialog"> flip `open` synchronously but notify from the queued
// `close` event, so wait for the notification itself, then assert its exact count.
async function nativeClosed(
  canvasElement: HTMLElement,
  onOpenChange: BottomSheetComposedProps['onOpenChange'],
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
  name: 'Native form submission',
  parameters: {
    docs: {
      description: {
        story:
          'Submit a method="dialog" form to close the sheet and return focus to the trigger.',
      },
      source: {
        language: 'tsx',
        code: `import { BottomSheet, Button } from '@jfrader/ui';

<BottomSheet>
  <BottomSheet.Trigger>Open trip</BottomSheet.Trigger>
  <BottomSheet.Content>
    <BottomSheet.Panel>
      <BottomSheet.Header>
        <BottomSheet.Handle aria-label="Resize sheet" />
        <BottomSheet.Title>Trip details</BottomSheet.Title>
        <BottomSheet.Description>Departure and arrival information.</BottomSheet.Description>
        <BottomSheet.Close>Close</BottomSheet.Close>
      </BottomSheet.Header>
      <BottomSheet.Body>
        <form method="dialog">
          <Button type="submit">Complete</Button>
        </form>
      </BottomSheet.Body>
      <BottomSheet.Footer>
        <span>Departure 09:30</span>
      </BottomSheet.Footer>
    </BottomSheet.Panel>
  </BottomSheet.Content>
</BottomSheet>`,
      },
    },
  },
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
function UnmountExample(args: BottomSheetComposedProps) {
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
              <FixtureButton onClick={() => setMounted(false)}>
                Remove sheet
              </FixtureButton>
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
function FalsyExample(args: BottomSheetComposedProps) {
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
              <FixtureButton key={index} onClick={() => setContent(value)}>
                State {index}
              </FixtureButton>
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

function NestedExample(args: BottomSheetComposedProps) {
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
                  <FixtureButton>Details</FixtureButton>
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
  name: 'Nested popover',
  parameters: {
    docs: {
      description: {
        story:
          'Host a popover inside the sheet so Escape dismisses the popover before closing the sheet.',
      },
      source: {
        language: 'tsx',
        code: `import { useState } from 'react';
import { BottomSheet, Button, Popover, ThemeRoot } from '@jfrader/ui';

function NestedSheetExample() {
  const [host, setHost] = useState<HTMLDivElement | null>(null);

  return (
    <BottomSheet>
      <BottomSheet.Trigger>Open trip</BottomSheet.Trigger>
      <BottomSheet.Content>
        <div ref={setHost} />
        <ThemeRoot portalContainer={host}>
          <BottomSheet.Panel>
            <BottomSheet.Header>
              <BottomSheet.Handle aria-label="Resize sheet" />
              <BottomSheet.Title>Trip details</BottomSheet.Title>
              <BottomSheet.Close>Close</BottomSheet.Close>
            </BottomSheet.Header>
            <BottomSheet.Body>
              <Popover>
                <Popover.Trigger>Connection</Popover.Trigger>
                <Popover.Content aria-label="Connection">
                  <Button>Details</Button>
                </Popover.Content>
              </Popover>
            </BottomSheet.Body>
          </BottomSheet.Panel>
        </ThemeRoot>
      </BottomSheet.Content>
    </BottomSheet>
  );
}`,
      },
    },
  },
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
export const AdapterDrag: Story = { ...DragSettleAndDismiss, render: (args) => <BottomSheet {...args}><Parts panelProps={{ component: SheetPaper }} /></BottomSheet> };
export const AdapterKeyboard: Story = { ...KeyboardNavigation, render: (args) => <BottomSheet {...args}><Parts panelProps={{ component: SheetPaper }} /></BottomSheet> };
export const AdapterReducedMotion: Story = { ...ReducedMotion, render: (args) => <BottomSheet {...args}><Parts panelProps={{ component: SheetPaper }} /></BottomSheet> };
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

function ExternalValueExample(args: BottomSheetComposedProps) {
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
            <FixtureButton onClick={() => setValue(1)}>
              Set expanded
            </FixtureButton>
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
