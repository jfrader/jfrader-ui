import { StrictMode, useState, type ComponentPropsWithRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fireEvent, fn, spyOn, waitFor } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
// `styled` is the app-facing styling API; consumers import it from `@jfrader/ui`.
import { styled } from '../../index';
import { withLightTheme } from '../../testing/story-decorators';
import { ScrollArea, type ScrollAreaProps } from './index';

function ReplacementScrollPart(props: ComponentPropsWithRef<'div'>) {
  return <div {...props} data-replaced="true" />;
}
export const ReplaceScrollParts: Story = {
  args: { scrollbars: 'always', slots: { viewport: ReplacementScrollPart, track: ReplacementScrollPart, thumb: ReplacementScrollPart } },
  render: (args) => <ScrollArea {...args}><Items /></ScrollArea>,
  play: async ({ canvasElement }) => {
    const parts = canvasElement.querySelectorAll<HTMLElement>('[data-replaced]');
    await expect(parts).toHaveLength(5);
    for (const part of parts) {
      await expect(part).toHaveAttribute('data-ui');
      await expect(part.className).not.toBe('');
    }
    await expect(viewport(canvasElement)).toHaveAttribute('aria-label', 'Activity');
    await expect(viewport(canvasElement)).toHaveAttribute('tabindex', '0');
  },
};

const Text = styled.h2({ margin: 0, fontSize: vars.textSize.md });
const Frame = styled.div({ inlineSize: `min(32rem, calc(100vw - ${vars.space[8]}))`, color: vars.color.text, fontFamily: vars.font.sans, lineHeight: vars.lineHeight.base });
const ActivityList = styled.ol({ margin: 0, padding: vars.space[4], listStyle: 'none', display: 'grid', gap: vars.space[4] });
const HorizontalActivityList = styled(ActivityList)({ display: 'flex' });
const ActivityItem = styled.li({ padding: vars.space[4], background: vars.color.surfaceRaised, border: `1px solid ${vars.color.border}`, borderRadius: vars.radius.sm });
const HorizontalActivityItem = styled(ActivityItem)({ minInlineSize: '12rem', scrollSnapAlign: 'start' });
const WideContent = styled.div({ minInlineSize: '60rem' });
const Description = styled.span({ backgroundColor: vars.color.surfaceInset });
const meta = {
  title: 'Layout/ScrollArea',
  component: ScrollArea,
  tags: ['autodocs'],
  args: { maxBlockSize: '16rem', slotProps: { viewport: { 'aria-label': 'Activity' } } },
  parameters: {
    docs: {
      sections: [
        { title: 'Axes', stories: ['Default', 'HorizontalSnap', 'BothAxes'] },
        { title: 'Sizes', stories: ['ParentConstrained'] },
        { title: 'Scroll shadows', stories: ['NoFade'] },
        { title: 'Keyboard', stories: ['KeyboardNavigation'] },
        { title: 'Composition', stories: ['ActivityPanel'] },
      ],
      description: {
        component: 'Scroll content within a panel with a height limit.',
      },
      usage: `### When to use
Keep overflowing content inside a bounded panel. Content is not virtualized; use a virtualized list for large datasets.

### Layout

Constrain the height with a limit or a sized parent. Horizontal content needs a width larger than the viewport to overflow.

### Keyboard and accessibility

Give the scrolling region an accessible name. Tab enters and leaves the viewport; arrows, Page Up/Down, Home/End and Space use native browser scrolling. Keep controls inside reachable by Tab.`,
      source: {
        code: '<ScrollArea maxBlockSize="16rem" slotProps={{ viewport: { "aria-label": "Activity" } }}><ActivityList /></ScrollArea>',
      },
    },
  },
  decorators: [
    (Story) => (
      <Frame>
        <Story />
      </Frame>
    ),
  ],
} satisfies Meta<typeof ScrollArea>;
export default meta;
type Story = StoryObj<typeof meta>;

function Items({ count = 30, horizontal = false }: { count?: number; horizontal?: boolean }) {
  const List = horizontal ? HorizontalActivityList : ActivityList;
  const Item = horizontal ? HorizontalActivityItem : ActivityItem;
  return (
    <List>
      {Array.from({ length: count }, (_, index) => (
        <Item key={index}>
          Activity {index + 1}
        </Item>
      ))}
    </List>
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
// Fractional devicePixelRatio and subpixel layout shift computed lengths and scroll offsets; compare
// equalities within a pixel and bounds within half a pixel.
const PX_TOLERANCE = 1.1;
const SUBPIXEL_TOLERANCE = 0.5;
const expectLength = async (actual: string | number, expected: string | number) => {
  const difference = parseFloat(String(actual)) - parseFloat(String(expected));
  await expect(Math.abs(difference)).toBeLessThan(PX_TOLERANCE);
};
const expectAtMost = async (actual: number, bound: number) => {
  await expect(actual).toBeLessThanOrEqual(bound + SUBPIXEL_TOLERANCE);
};
const expectAtLeast = async (actual: number, bound: number) => {
  await expect(actual).toBeGreaterThanOrEqual(bound - SUBPIXEL_TOLERANCE);
};
const FixtureButton = styled.button({ minHeight: vars.space[6], minWidth: vars.space[6], paddingBlock: vars.space[1], paddingInline: `calc(${vars.space[5]} / 2)`, boxSizing: 'border-box' });
/** Story-only: the computed value an authored length (a token or rem) resolves to on a throwaway probe. */
const resolveLength = (document: Document, property: string, value: string) => {
  const probe = document.createElement('div');
  probe.style.setProperty(property, value);
  document.body.append(probe);
  const resolved = getComputedStyle(probe).getPropertyValue(property);
  probe.remove();
  return resolved;
};
/**
 * Story-only: the declarations authored inside `@media (<condition>)` whose selector targets `element`
 * (pseudo-element rules are keyed by their pseudo). Reads the CSSOM; it does not activate the media query.
 */
const mediaRules = (element: Element, condition: string) => {
  const found: { pseudo: string; style: CSSStyleDeclaration }[] = [];
  for (const sheet of Array.from(element.ownerDocument.styleSheets)) {
    for (const rule of Array.from(sheet.cssRules)) {
      if (!('conditionText' in rule) || !String(rule.conditionText).includes(condition)) continue;
      for (const inner of Array.from((rule as CSSMediaRule).cssRules)) {
        if (!('selectorText' in inner)) continue;
        const styleRule = inner as CSSStyleRule;
        for (const selector of styleRule.selectorText.split(',')) {
          const [base = '', pseudo = ''] = selector.trim().split('::');
          if (element.matches(base)) found.push({ pseudo, style: styleRule.style });
        }
      }
    }
  }
  return found;
};
const mediaValue = (element: Element, condition: string, property: string, pseudo = '') =>
  mediaRules(element, condition)
    .filter((rule) => rule.pseudo === pseudo)
    .map((rule) => rule.style.getPropertyValue(property))
    .filter(Boolean)
    .at(-1);
const FORCED_COLORS_QUERY = 'forced-colors: active';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const TRACK_PAGE_FRACTION = 0.9;

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Scroll a height-limited list of activity entries.',
      },
      source: {
        language: 'tsx',
        code: `import { ScrollArea, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const ActivityList = styled.ol({
  margin: 0,
  padding: vars.space[4],
  listStyle: 'none',
  display: 'grid',
  gap: vars.space[4],
});

const HorizontalActivityList = styled(ActivityList)({ display: 'flex' });

const ActivityItem = styled.li({
  padding: vars.space[4],
  background: vars.color.surfaceRaised,
  border: \`1px solid \${vars.color.border}\`,
  borderRadius: vars.radius.sm,
});

const HorizontalActivityItem = styled(ActivityItem)({
  minInlineSize: '12rem',
  scrollSnapAlign: 'start',
});

function ActivityEntries({
  count = 30,
  horizontal = false,
}: {
  count?: number;
  horizontal?: boolean;
}) {
  const List = horizontal ? HorizontalActivityList : ActivityList;
  const Item = horizontal ? HorizontalActivityItem : ActivityItem;
  return (
    <List>
      {Array.from({ length: count }, (_, index) => (
        <Item key={index}>Activity {index + 1}</Item>
      ))}
    </List>
  );
}

<ScrollArea maxBlockSize="16rem" slotProps={{ viewport: { 'aria-label': 'Activity' } }}>
  <ActivityEntries />
</ScrollArea>;`,
      },
    },
  },
  name: 'Vertical activity',
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
    await expectAtLeast(bounds.width, 24);
    await expectAtLeast(thumb(canvasElement).getBoundingClientRect().height, 32);
  },
};
export const HorizontalSnap: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Scroll sideways through entries that snap to their starting edge.',
      },
      source: {
        language: 'tsx',
        code: `import { ScrollArea, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const ActivityList = styled.ol({
  margin: 0,
  padding: vars.space[4],
  listStyle: 'none',
  display: 'grid',
  gap: vars.space[4],
});

const HorizontalActivityList = styled(ActivityList)({ display: 'flex' });

const ActivityItem = styled.li({
  padding: vars.space[4],
  background: vars.color.surfaceRaised,
  border: \`1px solid \${vars.color.border}\`,
  borderRadius: vars.radius.sm,
});

const HorizontalActivityItem = styled(ActivityItem)({
  minInlineSize: '12rem',
  scrollSnapAlign: 'start',
});

function ActivityEntries({
  count = 30,
  horizontal = false,
}: {
  count?: number;
  horizontal?: boolean;
}) {
  const List = horizontal ? HorizontalActivityList : ActivityList;
  const Item = horizontal ? HorizontalActivityItem : ActivityItem;
  return (
    <List>
      {Array.from({ length: count }, (_, index) => (
        <Item key={index}>Activity {index + 1}</Item>
      ))}
    </List>
  );
}

<ScrollArea
  maxBlockSize="16rem"
  slotProps={{ viewport: { 'aria-label': 'Activity' } }}
  orientation="horizontal"
  snap="x mandatory"
>
  <ActivityEntries horizontal />
</ScrollArea>;`,
      },
    },
  },
  name: 'Horizontal snapping',
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
  parameters: {
    docs: {
      description: {
        story: 'Scroll content that exceeds both the width and height of the viewport.',
      },
      source: {
        language: 'tsx',
        code: `import { ScrollArea, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const WideContent = styled.div({ minInlineSize: '60rem' });

const ActivityList = styled.ol({
  margin: 0,
  padding: vars.space[4],
  listStyle: 'none',
  display: 'grid',
  gap: vars.space[4],
});

const HorizontalActivityList = styled(ActivityList)({ display: 'flex' });

const ActivityItem = styled.li({
  padding: vars.space[4],
  background: vars.color.surfaceRaised,
  border: \`1px solid \${vars.color.border}\`,
  borderRadius: vars.radius.sm,
});

const HorizontalActivityItem = styled(ActivityItem)({
  minInlineSize: '12rem',
  scrollSnapAlign: 'start',
});

function ActivityEntries({
  count = 30,
  horizontal = false,
}: {
  count?: number;
  horizontal?: boolean;
}) {
  const List = horizontal ? HorizontalActivityList : ActivityList;
  const Item = horizontal ? HorizontalActivityItem : ActivityItem;
  return (
    <List>
      {Array.from({ length: count }, (_, index) => (
        <Item key={index}>Activity {index + 1}</Item>
      ))}
    </List>
  );
}

<ScrollArea
  maxBlockSize="16rem"
  slotProps={{ viewport: { 'aria-label': 'Activity' } }}
  orientation="both"
>
  <WideContent>
    <ActivityEntries />
  </WideContent>
</ScrollArea>;`,
      },
    },
  },
  name: 'Two-axis scrolling',
  args: { orientation: 'both' },
  render: (args) => (
    <ScrollArea {...args}>
      <WideContent>
        <Items />
      </WideContent>
    </ScrollArea>
  ),
  play: async ({ canvasElement }) => {
    await overflowReady(canvasElement);
    await overflowReady(canvasElement, 'inline');
    await expectAtMost(
      track(canvasElement).getBoundingClientRect().bottom,
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
  parameters: {
    docs: {
      description: { story: 'Keep the list edges unmasked while scrolling.' },
      source: {
        language: 'tsx',
        code: `import { ScrollArea, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const ActivityList = styled.ol({
  margin: 0,
  padding: vars.space[4],
  listStyle: 'none',
  display: 'grid',
  gap: vars.space[4],
});

const HorizontalActivityList = styled(ActivityList)({ display: 'flex' });

const ActivityItem = styled.li({
  padding: vars.space[4],
  background: vars.color.surfaceRaised,
  border: \`1px solid \${vars.color.border}\`,
  borderRadius: vars.radius.sm,
});

const HorizontalActivityItem = styled(ActivityItem)({
  minInlineSize: '12rem',
  scrollSnapAlign: 'start',
});

function ActivityEntries({
  count = 30,
  horizontal = false,
}: {
  count?: number;
  horizontal?: boolean;
}) {
  const List = horizontal ? HorizontalActivityList : ActivityList;
  const Item = horizontal ? HorizontalActivityItem : ActivityItem;
  return (
    <List>
      {Array.from({ length: count }, (_, index) => (
        <Item key={index}>Activity {index + 1}</Item>
      ))}
    </List>
  );
}

<ScrollArea maxBlockSize="16rem" slotProps={{ viewport: { 'aria-label': 'Activity' } }} fade={0}>
  <ActivityEntries />
</ScrollArea>;`,
      },
    },
  },
  name: 'Without edge fades',
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
    await expectAtMost(thumb(canvasElement).getBoundingClientRect().height, height);
    await expectLength(thumb(canvasElement).style.getPropertyValue('--thumb-position'), 0);
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
      <FixtureButton type="button" onClick={() => setCount(count === 1 ? 30 : 1)}>
        Toggle content
      </FixtureButton>
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
      await expectLength(thumb(canvasElement, 'inline').style.getPropertyValue('--thumb-position'), 0);
    });
  },
};
// Structural check: asserts the authored forced-colors fallback rules against the unemulated computed
// baseline. Real media emulation is verified in browser QA.
export const ForcedColors: Story = {
  ...Default,
  parameters: {
    docs: {
      description: {
        story: 'Shows replacement bars and edge fades. Check forced-colors rendering in a browser.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    await overflowReady(canvasElement);
    const node = viewport(canvasElement);
    const computed = getComputedStyle(node);
    await expect(computed.maskImage).toContain('linear-gradient');
    await expect(computed.scrollbarWidth).toBe('none');
    await expect(mediaValue(node, FORCED_COLORS_QUERY, 'mask-image')).toBe('none');
    await expect(mediaValue(node, FORCED_COLORS_QUERY, 'scrollbar-width')).toBe('auto');
    await expect(mediaValue(node, FORCED_COLORS_QUERY, 'display', '-webkit-scrollbar')).toBe('block');
    for (const axis of ['block', 'inline'])
      await expect(mediaValue(track(canvasElement, axis), FORCED_COLORS_QUERY, 'display')).toBe('none');
  },
};
// Stubs matchMedia to drive the track-press behavior branch and reads the reduced-motion transition
// rules from the CSSOM. Reduced motion covers the component's own motion: bar transitions and the
// track-press scrollTo. Keyboard and wheel scrolling stay native, so their animation follows the
// browser's smooth-scrolling setting, not prefers-reduced-motion. Real media emulation is verified in
// browser QA.
export const ReducedMotion: Story = {
  ...Default,
  args: { scrollbars: 'always' },
  parameters: {
    docs: {
      description: {
        story:
          'Pressing a track scrolls one page, without animation under reduced motion. The browser controls keyboard and wheel scrolling animation.',
      },
    },
  },
  play: async ({ canvasElement, userEvent }) => {
    await overflowReady(canvasElement);
    const node = viewport(canvasElement);
    const win = node.ownerDocument.defaultView!;
    await expect(getComputedStyle(node).scrollBehavior).toBe('auto');
    await expect(mediaValue(track(canvasElement), REDUCED_MOTION_QUERY, 'transition')).toContain('none');
    await expect(mediaValue(thumb(canvasElement), REDUCED_MOTION_QUERY, 'transition', 'after')).toContain(
      'none',
    );
    const page = Math.min(node.scrollHeight - node.clientHeight, TRACK_PAGE_FRACTION * node.clientHeight);
    const realMatchMedia = win.matchMedia.bind(win);
    const scrollTo = spyOn(node, 'scrollTo');
    for (const [reduce, behavior] of [
      [false, 'smooth'],
      [true, 'auto'],
    ] as const) {
      const matchMedia = spyOn(win, 'matchMedia').mockImplementation((query) =>
        query === REDUCED_MOTION_QUERY
          ? Object.defineProperty(realMatchMedia(query), 'matches', { value: reduce })
          : realMatchMedia(query),
      );
      try {
        node.scrollTo({ top: 0, behavior: 'instant' });
        scrollTo.mockClear();
        const bounds = thumb(canvasElement).getBoundingClientRect();
        await userEvent.pointer({
          keys: '[MouseLeft]',
          target: track(canvasElement),
          coords: { clientX: bounds.left + bounds.width / 2, clientY: bounds.bottom + bounds.height / 2 },
        });
        await expect(matchMedia).toHaveBeenCalledWith(REDUCED_MOTION_QUERY);
        await expect(scrollTo).toHaveBeenCalledTimes(1);
        await expect(scrollTo).toHaveBeenLastCalledWith(
          expect.objectContaining({ behavior, top: expect.closeTo(page, 0) }),
        );
        await waitFor(async () => {
          await expectLength(node.scrollTop, page);
        });
      } finally {
        matchMedia.mockRestore();
      }
    }
    scrollTo.mockRestore();
  },
};
const NATIVE_KEYS = ['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' ', 'Escape'] as const;
const insideActivation = fn();
// The play userEvent dispatches untrusted keydowns, which never run the browser's native scroll, so the
// keyboard loop proves the component leaves each key's default action alone and keeps focus. Offset and
// clamp assertions drive the viewport through scrollTo; real key-scroll offsets are verified in browser QA.
export const KeyboardNavigation: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Tab into the named viewport, scroll with native keys, then Tab to the controls inside.',
      },
      source: {
        language: 'tsx',
        code: `import { ScrollArea, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const ActivityList = styled.ol({
  margin: 0,
  padding: vars.space[4],
  listStyle: 'none',
  display: 'grid',
  gap: vars.space[4],
});

const HorizontalActivityList = styled(ActivityList)({ display: 'flex' });

const ActivityItem = styled.li({
  padding: vars.space[4],
  background: vars.color.surfaceRaised,
  border: \`1px solid \${vars.color.border}\`,
  borderRadius: vars.radius.sm,
});

const HorizontalActivityItem = styled(ActivityItem)({
  minInlineSize: '12rem',
  scrollSnapAlign: 'start',
});

function ActivityEntries({
  count = 30,
  horizontal = false,
}: {
  count?: number;
  horizontal?: boolean;
}) {
  const List = horizontal ? HorizontalActivityList : ActivityList;
  const Item = horizontal ? HorizontalActivityItem : ActivityItem;
  return (
    <List>
      {Array.from({ length: count }, (_, index) => (
        <Item key={index}>Activity {index + 1}</Item>
      ))}
    </List>
  );
}

const ActionButton = styled.button({
  minHeight: vars.space[6],
  minWidth: vars.space[6],
  paddingBlock: vars.space[1],
  paddingInline: \`calc(\${vars.space[5]} / 2)\`,
  boxSizing: 'border-box',
});

<>
  <ActionButton type="button">Before</ActionButton>
  <ScrollArea maxBlockSize="16rem" slotProps={{ viewport: { 'aria-label': 'Activity' } }}>
    <ActivityEntries />
    <ActionButton type="button">Inside</ActionButton>
    <textarea aria-label="Notes" defaultValue="Notes" />
  </ScrollArea>
  <ActionButton type="button">After</ActionButton>
</>;`,
      },
    },
  },
  name: 'Keyboard scrolling',
  args: { onEdgeChange: fn() },
  render: (args) => (
    <>
      <FixtureButton type="button">
        Before
      </FixtureButton>
      <ScrollArea {...args}>
        <Items />
        <FixtureButton type="button" onClick={insideActivation}>
          Inside
        </FixtureButton>
        <textarea aria-label="Notes" defaultValue="Notes" />
      </ScrollArea>
      <FixtureButton type="button">
        After
      </FixtureButton>
    </>
  ),
  play: async ({ args, canvas, canvasElement, userEvent }) => {
    insideActivation.mockClear();
    await overflowReady(canvasElement);
    const node = viewport(canvasElement);
    const document = node.ownerDocument;
    await userEvent.click(canvas.getByRole('button', { name: 'Before' }));
    await userEvent.tab();
    await expect(document.activeElement).toBe(node);
    await expect(getComputedStyle(node).outlineStyle).not.toBe('none');
    await expect(getComputedStyle(node).maskImage).toBe('none');

    const keydowns: KeyboardEvent[] = [];
    const record = (event: KeyboardEvent) => keydowns.push(event);
    document.addEventListener('keydown', record);
    try {
      for (const key of NATIVE_KEYS) {
        keydowns.length = 0;
        await userEvent.keyboard(key === ' ' ? ' ' : `{${key}}`);
        await expect(keydowns.map((event) => event.key)).toEqual([key]);
        await expect(keydowns[0]!.defaultPrevented).toBe(false);
        await expect(document.activeElement).toBe(node);
      }
      keydowns.length = 0;
      await userEvent.keyboard('{Shift>} {/Shift}');
      await expect(keydowns.map((event) => [event.key, event.shiftKey, event.defaultPrevented])).toEqual([
        ['Shift', true, false],
        [' ', true, false],
      ]);
      await expect(document.activeElement).toBe(node);
    } finally {
      document.removeEventListener('keydown', record);
    }

    const maximum = node.scrollHeight - node.clientHeight;
    const edgeReports = () => (args.onEdgeChange as ReturnType<typeof fn>).mock.calls.length;
    const nextFrame = () =>
      new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const expectBoundary = async (offset: number, edges: { top: boolean; bottom: boolean }) => {
      await waitFor(async () => {
        await expectLength(node.scrollTop, offset);
        await expect(args.onEdgeChange).toHaveBeenLastCalledWith({ ...edges, left: false, right: false });
      });
      await expect(node.style.getPropertyValue('--fade-top')).toBe(
        edges.top ? 'var(--scroll-area-fade)' : '0px',
      );
      await expect(node.style.getPropertyValue('--fade-bottom')).toBe(
        edges.bottom ? 'var(--scroll-area-fade)' : '0px',
      );
    };
    node.scrollTo({ top: maximum });
    await expectBoundary(maximum, { top: true, bottom: false });
    const thumbTravel =
      track(canvasElement).getBoundingClientRect().height -
      thumb(canvasElement).getBoundingClientRect().height;
    await expectLength(thumb(canvasElement).style.getPropertyValue('--thumb-position'), thumbTravel);
    const atEnd = node.scrollTop;
    const reportsAtEnd = edgeReports();
    node.scrollTo({ top: maximum * 2 });
    await userEvent.keyboard('{End}');
    await expect(node.scrollTop).toBe(atEnd);
    await nextFrame();
    await expect(edgeReports()).toBe(reportsAtEnd);
    node.scrollTo({ top: -maximum });
    await expectBoundary(0, { top: false, bottom: true });
    await expectLength(thumb(canvasElement).style.getPropertyValue('--thumb-position'), 0);
    const startReports = edgeReports();
    node.scrollTo({ top: 0 });
    await userEvent.keyboard('{Home}');
    await expect(node.scrollTop).toBe(0);
    await nextFrame();
    await expect(edgeReports()).toBe(startReports);
    await expect(document.activeElement).toBe(node);

    await userEvent.tab();
    const inside = canvas.getByRole('button', { name: 'Inside' });
    await expect(document.activeElement).toBe(inside);
    await userEvent.keyboard(' ');
    await expect(insideActivation).toHaveBeenCalledTimes(1);
    await expect(document.activeElement).toBe(inside);
    await userEvent.tab();
    await expect(document.activeElement).toBe(canvas.getByRole('textbox'));
    await userEvent.keyboard('{ArrowLeft}');
    await userEvent.type(canvas.getByRole('textbox'), ' saved');
    await expect(canvas.getByRole('textbox')).toHaveValue('Notes saved');
    await userEvent.tab();
    await expect(document.activeElement).toBe(canvas.getByRole('button', { name: 'After' }));
    await userEvent.tab({ shift: true });
    await userEvent.tab({ shift: true });
    await userEvent.tab({ shift: true });
    await expect(document.activeElement).toBe(node);
    await userEvent.tab({ shift: true });
    await expect(document.activeElement).toBe(canvas.getByRole('button', { name: 'Before' }));
    await expect(insideActivation).toHaveBeenCalledTimes(1);
  },
};
const rootAttachment = fn((_node: HTMLDivElement | null) => {});
const viewportAttachment = fn((_node: HTMLDivElement | null) => {});
// This story exercises the documented viewport, track and thumb slot `css` API.
export const RefsAndSlots: Story = {
  args: {
    ref: rootAttachment,
    slotProps: {
      viewport: {
        ref: viewportAttachment,
        'aria-label': 'Activity',
        'aria-labelledby': 'external-title missing-title',
        'aria-describedby': 'external-description',
        sx: { paddingInline: vars.space[3] },
        onScroll: fn(),
      },
      track: { sx: { backgroundColor: vars.color.surfaceInset } },
      thumb: { sx: { borderRadius: vars.radius.sm } },
    },
    onScroll: fn(),
  },
  render: (args) => (
    <StrictMode>
      <span id="external-title">Updates</span>
      <Description id="external-description">
        Recent activity
      </Description>
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
    const { ownerDocument } = node;
    await expectLength(
      getComputedStyle(node).paddingInlineStart,
      resolveLength(ownerDocument, 'padding-inline-start', vars.space[3]),
    );
    await expectLength(
      getComputedStyle(thumb(canvasElement)).borderTopLeftRadius,
      resolveLength(ownerDocument, 'border-top-left-radius', vars.radius.sm),
    );
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

// React registers wheel listeners as passive, so a cancelling wheel handler attaches natively.
const vetoWheel = fn((event: WheelEvent) => event.preventDefault());
const attachWheelVeto = (node: HTMLDivElement | null) => {
  node?.addEventListener('wheel', vetoWheel, { passive: false });
  return () => node?.removeEventListener('wheel', vetoWheel);
};
export const WheelVeto: Story = {
  ...WheelConversion,
  args: {
    orientation: 'horizontal',
    wheelToHorizontal: true,
    slotProps: { viewport: { 'aria-label': 'Activity', ref: attachWheelVeto } },
  },
  play: async ({ canvasElement }) => {
    vetoWheel.mockClear();
    await overflowReady(canvasElement, 'inline');
    const node = viewport(canvasElement);
    await expect(fireEvent.wheel(node, { deltaY: 100, cancelable: true })).toBe(false);
    await expect(node.scrollLeft).toBe(0);
    await expect(vetoWheel).toHaveBeenCalledTimes(1);
  },
};

export const RTLWheel: Story = {
  ...WheelConversion,
  args: { orientation: 'horizontal', wheelToHorizontal: true, dir: 'rtl' },
  play: async ({ canvasElement }) => {
    await overflowReady(canvasElement, 'inline');
    const node = viewport(canvasElement);
    await expect(fireEvent.wheel(node, { deltaY: 100, cancelable: true })).toBe(false);
    await expectLength(node.scrollLeft, -100);
    await expect(fireEvent.wheel(node, { deltaY: -100, cancelable: true })).toBe(false);
    await expectLength(node.scrollLeft, 0);
    await expect(fireEvent.wheel(node, { deltaY: -100, cancelable: true })).toBe(true);
  },
};

const PARENT_BLOCK_SIZE = '12rem';
export const ParentConstrained: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Keep the scrolling viewport within an explicitly sized panel.',
      },
      source: {
        language: 'tsx',
        code: `import { ScrollArea, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const ActivityList = styled.ol({
  margin: 0,
  padding: vars.space[4],
  listStyle: 'none',
  display: 'grid',
  gap: vars.space[4],
});

const HorizontalActivityList = styled(ActivityList)({ display: 'flex' });

const ActivityItem = styled.li({
  padding: vars.space[4],
  background: vars.color.surfaceRaised,
  border: \`1px solid \${vars.color.border}\`,
  borderRadius: vars.radius.sm,
});

const HorizontalActivityItem = styled(ActivityItem)({
  minInlineSize: '12rem',
  scrollSnapAlign: 'start',
});

function ActivityEntries({
  count = 30,
  horizontal = false,
}: {
  count?: number;
  horizontal?: boolean;
}) {
  const List = horizontal ? HorizontalActivityList : ActivityList;
  const Item = horizontal ? HorizontalActivityItem : ActivityItem;
  return (
    <List>
      {Array.from({ length: count }, (_, index) => (
        <Item key={index}>Activity {index + 1}</Item>
      ))}
    </List>
  );
}

<ScrollArea sx={{ blockSize: '12rem' }} slotProps={{ viewport: { 'aria-label': 'Activity' } }}>
  <ActivityEntries />
</ScrollArea>;`,
      },
    },
  },
  name: 'Fixed-height panel',
  args: { maxBlockSize: undefined, sx: { blockSize: PARENT_BLOCK_SIZE } },
  render: Default.render,
  play: async ({ canvasElement }) => {
    await overflowReady(canvasElement);
    const node = viewport(canvasElement);
    await expectLength(
      node.getBoundingClientRect().height,
      resolveLength(node.ownerDocument, 'block-size', PARENT_BLOCK_SIZE),
    );
  },
};

function UnmountExample(args: ScrollAreaProps) {
  const [mounted, setMounted] = useState(true);
  return (
    <StrictMode>
      <FixtureButton type="button" onClick={() => setMounted(false)}>
        Remove panel
      </FixtureButton>
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

export const ActivityPanel: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Keep the section heading outside the scrolling list.',
      },
      source: {
        language: 'tsx',
        code: `import { ScrollArea, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const Text = styled.h2({ margin: 0, fontSize: vars.textSize.md });

const ActivityList = styled.ol({
  margin: 0,
  padding: vars.space[4],
  listStyle: 'none',
  display: 'grid',
  gap: vars.space[4],
});

const HorizontalActivityList = styled(ActivityList)({ display: 'flex' });

const ActivityItem = styled.li({
  padding: vars.space[4],
  background: vars.color.surfaceRaised,
  border: \`1px solid \${vars.color.border}\`,
  borderRadius: vars.radius.sm,
});

const HorizontalActivityItem = styled(ActivityItem)({
  minInlineSize: '12rem',
  scrollSnapAlign: 'start',
});

function ActivityEntries({
  count = 30,
  horizontal = false,
}: {
  count?: number;
  horizontal?: boolean;
}) {
  const List = horizontal ? HorizontalActivityList : ActivityList;
  const Item = horizontal ? HorizontalActivityItem : ActivityItem;
  return (
    <List>
      {Array.from({ length: count }, (_, index) => (
        <Item key={index}>Activity {index + 1}</Item>
      ))}
    </List>
  );
}

<section aria-label="Recent activity">
  <Text>Recent activity</Text>
  <ScrollArea maxBlockSize="16rem" slotProps={{ viewport: { 'aria-label': 'Activity entries' } }}>
    <ActivityEntries />
  </ScrollArea>
</section>;`,
      },
    },
  },
  name: 'Activity section',
  render: () => (
    <section aria-label="Recent activity">
      <Text>Recent activity</Text>
      <ScrollArea
        maxBlockSize="16rem"
        slotProps={{ viewport: { 'aria-label': 'Activity entries' } }}
      >
        <Items />
      </ScrollArea>
    </section>
  ),
};
