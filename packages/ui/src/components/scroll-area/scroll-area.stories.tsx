import { StrictMode, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fireEvent, fn, waitFor } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { withLightTheme } from '../../testing/story-decorators';
import { ScrollArea, type ScrollAreaProps } from './index';

const meta = {
  title: 'Layout/ScrollArea',
  component: ScrollArea,
  tags: ['autodocs'],
  args: { maxBlockSize: '16rem', slotProps: { viewport: { 'aria-label': 'Activity' } } },
  parameters: {
    docs: {
      description: {
        component:
          'Native scrolling for constrained panels. Constrain the viewport with maxBlockSize or a sized parent. This component does not virtualize content. Tab enters and leaves the viewport; arrows, PageUp/PageDown, Home/End and Space retain browser scrolling behavior. Name the viewport through slotProps.viewport.',
      },
      source: {
        code: '<ScrollArea maxBlockSize="16rem" slotProps={{ viewport: { "aria-label": "Activity" } }}><ActivityList /></ScrollArea>',
      },
    },
  },
  decorators: [
    (Story) => (
      <div
        style={{
          inlineSize: `min(32rem, calc(100vw - ${vars.space[8]}))`,
          color: vars.color.text,
          fontFamily: vars.font.sans,
          lineHeight: vars.lineHeight.base,
        }}
      >
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ScrollArea>;
export default meta;
type Story = StoryObj<typeof meta>;

function Items({ count = 30, horizontal = false }: { count?: number; horizontal?: boolean }) {
  return (
    <ol
      style={{
        margin: 0,
        padding: vars.space[4],
        listStyle: 'none',
        display: horizontal ? 'flex' : 'grid',
        gap: vars.space[4],
      }}
    >
      {Array.from({ length: count }, (_, index) => (
        <li
          key={index}
          style={{
            padding: vars.space[4],
            background: vars.color.surfaceRaised,
            border: `1px solid ${vars.color.border}`,
            borderRadius: vars.radius.sm,
            ...(horizontal ? { minInlineSize: '12rem', scrollSnapAlign: 'start' } : {}),
          }}
        >
          Activity {index + 1}
        </li>
      ))}
    </ol>
  );
}
const viewport = (element: HTMLElement) =>
  element.querySelector<HTMLDivElement>('[data-ui="scroll-area-viewport"]')!;
const track = (element: HTMLElement, axis = 'block') =>
  element.querySelector<HTMLDivElement>(`[data-ui="scroll-area-track"][data-axis="${axis}"]`)!;
const thumb = (element: HTMLElement, axis = 'block') =>
  element.querySelector<HTMLDivElement>(`[data-ui="scroll-area-thumb"][data-axis="${axis}"]`)!;
const overflowReady = async (element: HTMLElement, axis = 'block') => {
  await waitFor(async () => {
    await expect(track(element, axis).hidden).toBe(false);
  });
};

export const Default: Story = {
  render: (args) => (
    <ScrollArea {...args}>
      <Items />
    </ScrollArea>
  ),
  play: async ({ canvasElement }) => {
    await overflowReady(canvasElement);
    await expect(viewport(canvasElement).style.getPropertyValue('--fade-top')).toBe('0px');
    await expect(viewport(canvasElement).style.getPropertyValue('--fade-bottom')).toBe(
      'var(--scroll-area-fade)',
    );
    const bounds = track(canvasElement).getBoundingClientRect();
    await expect(bounds.width).toBeGreaterThanOrEqual(24);
    await expect(thumb(canvasElement).getBoundingClientRect().height).toBeGreaterThanOrEqual(32);
  },
};
export const HorizontalSnap: Story = {
  args: { orientation: 'horizontal', snap: 'x mandatory' },
  render: (args) => (
    <ScrollArea {...args}>
      <Items horizontal />
    </ScrollArea>
  ),
  play: async ({ canvasElement }) => {
    await overflowReady(canvasElement, 'inline');
    await expect(getComputedStyle(viewport(canvasElement)).scrollSnapType).toBe('x mandatory');
  },
};
export const BothAxes: Story = {
  args: { orientation: 'both' },
  render: (args) => (
    <ScrollArea {...args}>
      <div style={{ minInlineSize: '60rem' }}>
        <Items />
      </div>
    </ScrollArea>
  ),
  play: async ({ canvasElement }) => {
    await overflowReady(canvasElement);
    await overflowReady(canvasElement, 'inline');
    await expect(track(canvasElement).getBoundingClientRect().bottom).toBeLessThanOrEqual(
      track(canvasElement, 'inline').getBoundingClientRect().top,
    );
  },
};
export const AlwaysVisible: Story = {
  ...Default,
  args: { scrollbars: 'always' },
  play: async ({ canvasElement }) => {
    await overflowReady(canvasElement);
    await waitFor(async () => {
      await expect(getComputedStyle(track(canvasElement)).opacity).toBe('1');
    });
  },
};
export const NativeBars: Story = {
  ...Default,
  args: { scrollbars: 'native' },
  play: async ({ canvasElement }) => {
    await expect(track(canvasElement).hidden).toBe(true);
    await expect(getComputedStyle(viewport(canvasElement)).scrollbarWidth).toBe('auto');
  },
};
export const NoFade: Story = {
  ...Default,
  args: { fade: 0 },
  play: async ({ canvasElement }) => {
    await overflowReady(canvasElement);
    await expect(getComputedStyle(viewport(canvasElement)).getPropertyValue('--scroll-area-fade')).toBe(
      '0px',
    );
  },
};
export const LightTheme: Story = { ...Default, decorators: [withLightTheme], globals: { theme: 'light' } };
export const ShortTrack: Story = {
  ...Default,
  args: { maxBlockSize: vars.space[6] },
  play: async ({ canvasElement }) => {
    await overflowReady(canvasElement);
    const height = track(canvasElement).getBoundingClientRect().height;
    await expect(thumb(canvasElement).getBoundingClientRect().height).toBeLessThanOrEqual(height);
    await expect(thumb(canvasElement).style.getPropertyValue('--thumb-position')).toBe('0px');
  },
};
export const Empty: Story = {
  render: (args) => <ScrollArea {...args} />,
  play: async ({ canvasElement }) => {
    await expect(track(canvasElement).hidden).toBe(true);
    await waitFor(async () => {
      await expect(viewport(canvasElement).style.getPropertyValue('--fade-bottom')).toBe('0px');
    });
  },
};
export const NoOverflow: Story = {
  render: (args) => (
    <ScrollArea {...args}>
      <Items count={1} />
    </ScrollArea>
  ),
  play: Empty.play,
};

function DynamicExample(args: ScrollAreaProps) {
  const [count, setCount] = useState(1);
  return (
    <>
      <button onClick={() => setCount(count === 1 ? 30 : 1)}>Toggle content</button>
      <ScrollArea {...args}>
        <Items count={count} />
      </ScrollArea>
    </>
  );
}
export const DynamicContent: Story = {
  render: (args) => <DynamicExample {...args} />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    await expect(track(canvasElement).hidden).toBe(true);
    await userEvent.click(canvas.getByRole('button', { name: 'Toggle content' }));
    await overflowReady(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Toggle content' }));
    await waitFor(async () => {
      await expect(track(canvasElement).hidden).toBe(true);
    });
  },
};
export const RTL: Story = {
  args: { orientation: 'horizontal', dir: 'rtl', onEdgeChange: fn() },
  render: (args) => (
    <ScrollArea {...args}>
      <Items horizontal />
    </ScrollArea>
  ),
  play: async ({ canvasElement, args }) => {
    await overflowReady(canvasElement, 'inline');
    const node = viewport(canvasElement);
    await expect(getComputedStyle(node).direction).toBe('rtl');
    await expect(args.onEdgeChange).toHaveBeenLastCalledWith({
      top: false,
      bottom: false,
      left: true,
      right: false,
    });
    node.scrollLeft = -(node.scrollWidth - node.clientWidth);
    await waitFor(async () => {
      await expect(args.onEdgeChange).toHaveBeenLastCalledWith({
        top: false,
        bottom: false,
        left: false,
        right: true,
      });
      await expect(thumb(canvasElement, 'inline').style.getPropertyValue('--thumb-position')).toBe('0px');
    });
  },
};
export const ForcedColors: Story = {
  ...Default,
  args: { scrollbars: 'native' },
  parameters: {
    docs: {
      description: {
        story:
          'Native fallback structure. Media-query behavior is verified separately with browser emulation.',
      },
    },
  },
  play: NativeBars.play,
};
export const ReducedMotion: Story = {
  ...Default,
  parameters: {
    docs: {
      description: {
        story: 'Scrolling structure; this story does not emulate the reduced-motion preference.',
      },
    },
  },
};
export const KeyboardNavigation: Story = {
  render: (args) => (
    <>
      <button>Before</button>
      <ScrollArea {...args}>
        <Items />
        <button>Inside</button>
        <textarea aria-label="Notes" defaultValue="Notes" />
      </ScrollArea>
      <button>After</button>
    </>
  ),
  play: async ({ canvas, canvasElement, userEvent }) => {
    const node = viewport(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Before' }));
    await userEvent.tab();
    await expect(node.ownerDocument.activeElement).toBe(node);
    await expect(getComputedStyle(node).outlineStyle).not.toBe('none');
    await expect(getComputedStyle(node).maskImage).toBe('none');
    await userEvent.keyboard('{ArrowDown}{ArrowUp}{PageDown}{PageUp}{End}{Home} {Shift>} {/Shift}{Escape}');
    await expect(node.ownerDocument.activeElement).toBe(node);
    node.scrollTop = node.scrollHeight;
    await waitFor(async () => {
      await expect(node.scrollTop).toBeGreaterThan(0);
      await expect(node.style.getPropertyValue('--fade-bottom')).toBe('0px');
    });
    await userEvent.tab();
    await expect(node.ownerDocument.activeElement).toBe(canvas.getByRole('button', { name: 'Inside' }));
    await userEvent.tab();
    await expect(node.ownerDocument.activeElement).toBe(canvas.getByRole('textbox'));
    await userEvent.keyboard('{ArrowLeft}');
    await userEvent.type(canvas.getByRole('textbox'), ' saved');
    await expect(canvas.getByRole('textbox')).toHaveValue('Notes saved');
    await userEvent.tab();
    await expect(node.ownerDocument.activeElement).toBe(canvas.getByRole('button', { name: 'After' }));
    await userEvent.tab({ shift: true });
    await userEvent.tab({ shift: true });
    await userEvent.tab({ shift: true });
    await expect(node.ownerDocument.activeElement).toBe(node);
    await userEvent.tab({ shift: true });
    await expect(node.ownerDocument.activeElement).toBe(canvas.getByRole('button', { name: 'Before' }));
  },
};
const rootAttachment = fn((_node: HTMLDivElement | null) => {});
const viewportAttachment = fn((_node: HTMLDivElement | null) => {});
export const RefsAndSlots: Story = {
  args: {
    ref: rootAttachment,
    slotProps: {
      viewport: {
        ref: viewportAttachment,
        'aria-label': 'Activity',
        'aria-labelledby': 'external-title missing-title',
        'aria-describedby': 'external-description',
        css: { paddingInline: vars.space[3] },
        onScroll: fn(),
      },
      track: { css: { backgroundColor: vars.color.surfaceInset } },
      thumb: { css: { borderRadius: vars.radius.sm } },
    },
    onScroll: fn(),
  },
  render: (args) => (
    <StrictMode>
      <span id="external-title">Updates</span>
      <span id="external-description" style={{ backgroundColor: vars.color.surfaceInset }}>
        Recent activity
      </span>
      <ScrollArea {...args}>
        <Items />
      </ScrollArea>
    </StrictMode>
  ),
  play: async ({ canvasElement, args }) => {
    await overflowReady(canvasElement);
    const root = canvasElement.querySelector('[data-ui="scroll-area"]');
    const node = viewport(canvasElement);
    const capturedRoot = rootAttachment.mock.calls.find(([element]) => element !== null)?.[0];
    const capturedViewport = viewportAttachment.mock.calls.find(([element]) => element !== null)?.[0];
    await expect(capturedRoot).toBe(root);
    await expect(capturedViewport).toBe(node);
    await expect(node).toHaveAttribute('aria-label', 'Activity');
    await expect(node).toHaveAttribute('aria-labelledby', 'external-title missing-title');
    await expect(node).toHaveAttribute('aria-describedby', 'external-description');
    await expect(getComputedStyle(node).paddingInlineStart).toBe('12px');
    await expect(getComputedStyle(thumb(canvasElement)).borderRadius).toBe('8px');
    await expect(getComputedStyle(track(canvasElement)).backgroundColor).toBe(
      getComputedStyle(canvasElement.querySelector('#external-description')!).backgroundColor,
    );
    fireEvent.scroll(node);
    await expect(args.onScroll).toHaveBeenCalledTimes(1);
    await expect(args.slotProps?.viewport?.onScroll).toHaveBeenCalledTimes(1);
    await expect(args.onScroll).toHaveBeenLastCalledWith(
      expect.objectContaining({ currentTarget: null, target: node }),
    );
  },
};
export const FalsyContent: Story = {
  render: (args) => (
    <>
      {[false, null, 0, ''].map((value, index) => (
        <ScrollArea {...args} slotProps={{ viewport: { 'aria-label': `Activity ${index + 1}` } }} key={index}>
          {value}
        </ScrollArea>
      ))}
    </>
  ),
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelectorAll('[data-ui="scroll-area-viewport"]')).toHaveLength(4);
    for (const node of canvasElement.querySelectorAll('[data-ui="scroll-area-track"]'))
      await expect(node).toHaveAttribute('hidden');
    await expect(canvasElement).toHaveTextContent('0');
  },
};
export const WheelConversion: Story = {
  args: {
    orientation: 'horizontal',
    wheelToHorizontal: true,
    slotProps: { viewport: { 'aria-label': 'Activity', onWheel: fn() } },
  },
  render: (args) => (
    <ScrollArea {...args}>
      <Items horizontal />
    </ScrollArea>
  ),
  play: async ({ canvasElement, args }) => {
    await overflowReady(canvasElement, 'inline');
    const node = viewport(canvasElement);
    await expect(fireEvent.wheel(node, { deltaY: -30, cancelable: true })).toBe(true);
    await expect(fireEvent.wheel(node, { deltaY: 30, ctrlKey: true, cancelable: true })).toBe(true);
    await expect(fireEvent.wheel(node, { deltaY: 30, metaKey: true, cancelable: true })).toBe(true);
    await expect(fireEvent.wheel(node, { deltaY: 30, deltaX: 10, cancelable: true })).toBe(true);
    await expect(node.scrollLeft).toBe(0);
    await expect(fireEvent.wheel(node, { deltaY: 2, deltaMode: 1, cancelable: true })).toBe(false);
    await expect(node.scrollLeft).toBeGreaterThan(2);
    await expect(fireEvent.wheel(node, { deltaY: 1, deltaMode: 2, cancelable: true })).toBe(false);
    await expect(node.scrollLeft).toBeGreaterThan(node.clientWidth);
    node.scrollLeft = node.scrollWidth;
    await expect(fireEvent.wheel(node, { deltaY: 30, cancelable: true })).toBe(true);
    await expect(args.slotProps?.viewport?.onWheel).toHaveBeenCalledTimes(7);
  },
};
export const PointerInteraction: Story = {
  args: { scrollbars: 'always', snap: 'y proximity' },
  render: Default.render,
  play: async ({ canvasElement, userEvent }) => {
    await overflowReady(canvasElement);
    const node = viewport(canvasElement);
    const pill = thumb(canvasElement);
    const bar = track(canvasElement);
    const bounds = pill.getBoundingClientRect();
    const originalSnap = node.style.scrollSnapType;
    await userEvent.pointer([
      { keys: '[MouseLeft>]', target: pill, coords: { clientX: bounds.left + 12, clientY: bounds.top + 12 } },
      { target: bar, coords: { clientX: bounds.left + 12, clientY: bounds.top + 72 } },
    ]);
    await expect(node.style.scrollSnapType).toBe('none');
    await waitFor(async () => {
      await expect(node.scrollTop).toBeGreaterThan(0);
    });
    await userEvent.pointer({ keys: '[/MouseLeft]', target: bar });
    await expect(node.style.scrollSnapType).toBe(originalSnap);
    await expect(canvasElement.querySelector('[data-dragging]')).toBeNull();
    await userEvent.pointer({ keys: '[MouseRight]', target: pill });
    await expect(node.style.scrollSnapType).toBe(originalSnap);
    const start = async () => {
      const current = pill.getBoundingClientRect();
      await userEvent.pointer({
        keys: '[MouseLeft>]',
        target: pill,
        coords: { clientX: current.left + 12, clientY: current.top + 12 },
      });
      await expect(node.style.scrollSnapType).toBe('none');
    };
    await start();
    fireEvent.pointerCancel(bar, { pointerId: 1 });
    await expect(node.style.scrollSnapType).toBe(originalSnap);
    await expect(canvasElement.querySelector('[data-dragging]')).toBeNull();
    await userEvent.pointer({ keys: '[/MouseLeft]', target: bar });
    await start();
    fireEvent.lostPointerCapture(bar, { pointerId: 1 });
    await expect(node.style.scrollSnapType).toBe(originalSnap);
    await expect(canvasElement.querySelector('[data-dragging]')).toBeNull();
    await userEvent.pointer({ keys: '[/MouseLeft]', target: bar });
  },
};

export const WheelVeto: Story = {
  ...WheelConversion,
  args: {
    orientation: 'horizontal',
    wheelToHorizontal: true,
    slotProps: { viewport: { 'aria-label': 'Activity', onWheel: fn((event) => event.preventDefault()) } },
  },
  play: async ({ canvasElement, args }) => {
    await overflowReady(canvasElement, 'inline');
    const node = viewport(canvasElement);
    await expect(fireEvent.wheel(node, { deltaY: 100, cancelable: true })).toBe(false);
    await expect(node.scrollLeft).toBe(0);
    await expect(args.slotProps?.viewport?.onWheel).toHaveBeenCalledTimes(1);
  },
};

export const RTLWheel: Story = {
  ...WheelConversion,
  args: { orientation: 'horizontal', wheelToHorizontal: true, dir: 'rtl' },
  play: async ({ canvasElement }) => {
    await overflowReady(canvasElement, 'inline');
    const node = viewport(canvasElement);
    await expect(fireEvent.wheel(node, { deltaY: 100, cancelable: true })).toBe(false);
    await expect(node.scrollLeft).toBe(-100);
    await expect(fireEvent.wheel(node, { deltaY: -100, cancelable: true })).toBe(false);
    await expect(node.scrollLeft).toBe(0);
    await expect(fireEvent.wheel(node, { deltaY: -100, cancelable: true })).toBe(true);
  },
};

export const ParentConstrained: Story = {
  args: { maxBlockSize: undefined, sx: { blockSize: '12rem' } },
  render: Default.render,
  play: async ({ canvasElement }) => {
    await overflowReady(canvasElement);
    await expect(viewport(canvasElement).getBoundingClientRect().height).toBe(192);
  },
};

function UnmountExample(args: ScrollAreaProps) {
  const [mounted, setMounted] = useState(true);
  return (
    <StrictMode>
      <button onClick={() => setMounted(false)}>Remove panel</button>
      {mounted && (
        <ScrollArea {...args}>
          <Items />
        </ScrollArea>
      )}
    </StrictMode>
  );
}
const cleanupRef = fn((_node: HTMLDivElement | null) => fn());
export const RefCleanup: Story = {
  args: { snap: 'y proximity', slotProps: { viewport: { 'aria-label': 'Activity', ref: cleanupRef } } },
  render: (args) => <UnmountExample {...args} />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    await overflowReady(canvasElement);
    const ref = cleanupRef;
    const node = viewport(canvasElement);
    const originalSnap = node.style.scrollSnapType;
    await expect(ref.mock.calls.every(([element]) => element === node)).toBe(true);
    const cleanup = ref.mock.results.at(-1)!.value;
    await expect(cleanup).not.toHaveBeenCalled();
    const pill = thumb(canvasElement);
    const bounds = pill.getBoundingClientRect();
    await userEvent.pointer({
      keys: '[MouseLeft>]',
      target: pill,
      coords: { clientX: bounds.left + 12, clientY: bounds.top + 12 },
    });
    await expect(node.style.scrollSnapType).toBe('none');
    fireEvent.click(canvas.getByRole('button', { name: 'Remove panel' }));
    await expect(cleanup).toHaveBeenCalledTimes(1);
    await expect(canvasElement.querySelector('[data-ui="scroll-area"]')).toBeNull();
    await expect(ref.mock.calls.every(([element]) => element === node)).toBe(true);
    await expect(node.style.scrollSnapType).toBe(originalSnap);
    await userEvent.pointer({
      keys: '[/MouseLeft]',
      target: canvas.getByRole('button', { name: 'Remove panel' }),
    });
  },
};

export const AutoHide: Story = {
  ...Default,
  args: { hideDelay: 60 },
  play: async ({ canvasElement }) => {
    await overflowReady(canvasElement);
    const node = viewport(canvasElement);
    const root = node.parentElement!;
    fireEvent.scroll(node);
    await expect(root).toHaveAttribute('data-scrolling');
    await waitFor(async () => {
      await expect(root).not.toHaveAttribute('data-scrolling');
    });
  },
};
