import { StrictMode, useState, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fireEvent, fn, spyOn, waitFor, within } from 'storybook/test';
import { base } from '@jfrader/tokens';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { withLightTheme } from '../../testing/story-decorators';
import { Carousel, type CarouselProps } from './index';

const SUITES = [
  { key: 'harbour', name: 'Harbour suite', detail: 'Balcony over the marina, sleeps two.' },
  { key: 'garden', name: 'Garden suite', detail: 'Ground floor, opens onto the lemon trees.' },
  { key: 'tower', name: 'Tower suite', detail: 'Top floor with a reading nook.' },
  { key: 'loft', name: 'Loft suite', detail: 'Split level, sleeps four.' },
] as const;
const SUITE_NAMES = SUITES.map((suite) => suite.name);
const TARGET_PX = Number.parseFloat(base.space[8]);
const ROTATION_MS = 300;
const TRANSITION_MS = Number.parseFloat(base.motion.duration.fast) + 40;
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
/** Horizontal mouse travel that stays under the drag threshold. */
const SUB_THRESHOLD_PX = 4;
/** Horizontal mouse travel past the midpoint between two slides. */
const DRAG_PX = 240;

// The inset keeps the test runner's parked pointer (page origin) off the carousel, so hover
// pause only engages when a story hovers on purpose.
const frameStyle = css({ inlineSize: '32rem', maxInlineSize: 'calc(100vw - 2rem)', padding: vars.space[4] });
const narrowFrameStyle = css({ inlineSize: '18rem' });
const cardStyle = css({
  display: 'grid',
  alignContent: 'end',
  gap: vars.space[1],
  minBlockSize: '9rem',
  boxSizing: 'border-box',
  padding: vars.space[4],
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.lg,
  backgroundColor: vars.color.surfaceRaised,
  color: vars.color.text,
  fontSize: vars.textSize.sm,
});
const cardTitleStyle = css({ margin: 0, fontWeight: vars.fontWeight.semibold, fontSize: vars.textSize.md });
const cardTextStyle = css({ margin: 0, color: vars.color.textMuted });
const fixtureButtonStyle = css({ minBlockSize: vars.space[8], justifySelf: 'start' });

function SuiteCard({ name, detail, children }: { name: string; detail: string; children?: ReactNode }) {
  return (
    <div css={cardStyle}>
      <p css={cardTitleStyle}>{name}</p>
      <p css={cardTextStyle}>{detail}</p>
      {children}
    </div>
  );
}
SuiteCard.displayName = 'SuiteCard';

const suiteSlides = (count: number = SUITES.length) =>
  SUITES.slice(0, count).map((suite) => <SuiteCard key={suite.key} name={suite.name} detail={suite.detail} />);

const meta = {
  title: 'Data display/Carousel',
  component: Carousel,
  tags: ['autodocs'],
  args: { 'aria-label': 'Harbour suites', children: suiteSlides() },
  argTypes: {
    activation: { control: 'radio', options: ['auto', 'manual'] },
    children: { control: false },
  },
  decorators: [
    (Story) => (
      <div css={frameStyle}>
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      source: {
        code: '<Carousel aria-label="Harbour suites"><img key="sea" src="/sea.jpg" alt="Sea suite" /><img key="garden" src="/garden.jpg" alt="Garden suite" /></Carousel>',
      },
      description: {
        component:
          'A short, mounted set of peer slides with a slide picker, Previous/Next and native scroll-snap (trackpad, touch, mouse drag). Give every slide a stable key and, when slides have names, `getSlideLabel`. Nothing rotates by default: rotation needs `interval` plus Start (or an explicit playing seed), stops for good when focus enters the carousel or the parent declines a rotation step, pauses on hover, drag, offscreen and hidden pages, and is unavailable under reduced motion. A controlled `value` that the parent declines leaves the accepted slide in place and scrolls back to it.',
      },
    },
  },
} satisfies Meta<typeof Carousel>;

export default meta;
type Story = StoryObj<typeof meta>;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const bySelector = <T extends HTMLElement = HTMLElement>(root: HTMLElement, selector: string) =>
  root.querySelector<T>(selector)!;
const viewportOf = (root: HTMLElement) => bySelector(root, '[data-ui="carousel-viewport"]');
const slidesOf = (root: HTMLElement) => Array.from(root.querySelectorAll<HTMLElement>('[data-ui="carousel-slide"]'));
const statusOf = (root: HTMLElement) => bySelector(root, '[data-ui="carousel-status"]');

/** Distance between the viewport centre and the slide's centre, in CSS px. */
function offCentre(root: HTMLElement, index: number) {
  const frame = viewportOf(root).getBoundingClientRect();
  const slide = slidesOf(root)[index]!.getBoundingClientRect();
  return Math.abs(slide.left + slide.width / 2 - (frame.left + frame.width / 2));
}
async function expectCentred(root: HTMLElement, index: number) {
  await waitFor(
    async () => {
      await expect(offCentre(root, index)).toBeLessThan(2);
    },
    { timeout: 2000 },
  );
}

/** Selection, panel relationships and inert neighbours for the accepted slide. */
async function expectActive(root: HTMLElement, index: number) {
  const canvas = within(root);
  const tabs = canvas.getAllByRole('tab');
  const panels = slidesOf(root);
  for (const [position, tab] of tabs.entries()) {
    await expect(tab).toHaveAttribute('aria-selected', String(position === index));
    await expect(tab).toHaveAttribute('aria-controls', panels[position]!.id);
    await expect(panels[position]).toHaveAttribute('role', 'tabpanel');
    await expect(panels[position]).toHaveAttribute('aria-labelledby', tab.id);
    await expect(panels[position]).not.toHaveAttribute('aria-roledescription');
    if (position === index) {
      await expect(panels[position]).not.toHaveAttribute('inert');
      await expect(panels[position]).not.toHaveAttribute('aria-hidden');
    } else {
      await expect(panels[position]).toHaveAttribute('inert');
      await expect(panels[position]).toHaveAttribute('aria-hidden', 'true');
    }
  }
  await expect(canvas.getByRole('tabpanel')).toBe(panels[index]);
}

async function expectFocusRing(element: HTMLElement) {
  await expect(element.ownerDocument.activeElement).toBe(element);
  const style = getComputedStyle(element);
  await expect(style.outlineStyle).not.toBe('none');
  await expect(Math.abs(Number.parseFloat(style.outlineWidth) - 2)).toBeLessThan(1.1);
}

/** Declarations authored for `element` inside `@media` rules whose condition includes `feature`. */
function mediaDeclarations(element: Element, feature: string) {
  return Array.from(element.ownerDocument.styleSheets)
    .flatMap((sheet) => {
      try {
        return Array.from(sheet.cssRules);
      } catch {
        return [];
      }
    })
    .filter((rule): rule is CSSMediaRule => rule instanceof CSSMediaRule && rule.conditionText.includes(feature))
    .flatMap((rule) => Array.from(rule.cssRules))
    .filter((rule): rule is CSSStyleRule => rule instanceof CSSStyleRule && element.matches(rule.selectorText))
    .map((rule) => rule.style);
}

const MOUSE_POINTER_ID = 1;

/**
 * Synthetic mouse pointer on the viewport. Synthetic pointers are not active, so the browser
 * would reject a real capture; `capture` records the call instead. Real capture is browser QA.
 */
function mouseOn(viewport: HTMLElement) {
  const capture = spyOn(viewport, 'setPointerCapture').mockImplementation(() => {});
  const box = viewport.getBoundingClientRect();
  const x = box.left + box.width / 2;
  const y = box.top + box.height / 2;
  const fire = (type: string, dx: number, dy = 0) =>
    fireEvent(
      viewport,
      new PointerEvent(type, {
        bubbles: true,
        pointerId: MOUSE_POINTER_ID,
        pointerType: 'mouse',
        button: 0,
        clientX: x + dx,
        clientY: y + dy,
      }),
    );
  /** Press, move through `steps` (horizontal offsets) and finish with `end`. */
  const drag = (steps: number[], end: 'pointerup' | 'pointercancel' = 'pointerup') => {
    fire('pointerdown', 0);
    for (const step of steps) fire('pointermove', step);
    fire(end, steps.at(-1) ?? 0);
  };
  return { fire, drag, capture };
}

/** Steps a drag passes through on its way to `distance` (negative is leftward). */
const dragSteps = (distance: number) => [10, 80, 160, Math.abs(distance)].map((step) => Math.sign(distance) * step);

function ControlledCarousel(props: CarouselProps) {
  const [value, setValue] = useState(0);
  return (
    <Carousel
      {...props}
      value={value}
      onValueChange={(next) => {
        setValue(next);
        props.onValueChange?.(next);
      }}
    />
  );
}
ControlledCarousel.displayName = 'ControlledCarousel';

export const Default: Story = {
  args: { onValueChange: fn() },
  play: async ({ args, canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    const region = canvas.getByRole('region', { name: 'Harbour suites' });
    await expect(region).toHaveAttribute('aria-roledescription', 'carousel');
    await expect(region).toHaveAttribute('data-ui', 'carousel');
    await expect(canvas.getByRole('tablist', { name: 'Choose slide' })).toBeInTheDocument();
    await expect(canvas.getByRole('group', { name: 'Slides' })).toBe(viewportOf(canvasElement));
    await expect(canvas.getAllByRole('tab').map((tab) => tab.getAttribute('aria-label'))).toEqual([
      'Slide 1 of 4',
      'Slide 2 of 4',
      'Slide 3 of 4',
      'Slide 4 of 4',
    ]);
    await expect(canvas.queryByRole('button', { name: /rotation/ })).not.toBeInTheDocument();
    await expectActive(canvasElement, 0);
    await expect(statusOf(canvasElement)).toHaveTextContent('Slide 1 of 4');
    await expect(statusOf(canvasElement)).toHaveAttribute('aria-live', 'polite');
    await expectCentred(canvasElement, 0);

    const previous = canvas.getByRole('button', { name: 'Previous slide' });
    const next = canvas.getByRole('button', { name: 'Next slide' });
    await expect(previous).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(previous);
    await expect(args.onValueChange).not.toHaveBeenCalled();

    await userEvent.click(next);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith(1);
    await expect(next).toHaveFocus();
    await expectActive(canvasElement, 1);
    await expect(statusOf(canvasElement)).toHaveTextContent('Slide 2 of 4');
    await expectCentred(canvasElement, 1);
  },
};

export const NamedSlides: Story = {
  args: { getSlideLabel: (index) => SUITE_NAMES[index]! },
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByRole('tab').map((tab) => tab.getAttribute('aria-label'))).toEqual(SUITE_NAMES);
    await expect(canvas.getByRole('tabpanel', { name: 'Harbour suite' })).toBeInTheDocument();
    await userEvent.click(canvas.getByRole('tab', { name: 'Tower suite' }));
    await expect(canvas.getByRole('tabpanel', { name: 'Tower suite' })).toHaveTextContent('reading nook');
    await expect(statusOf(canvasElement)).toHaveTextContent('Tower suite');
  },
};

export const CustomSlideSize: Story = {
  args: { slideSize: '12rem' },
  play: async ({ canvasElement }) => {
    const rem = Number.parseFloat(getComputedStyle(canvasElement.ownerDocument.documentElement).fontSize);
    const slide = slidesOf(canvasElement)[0]!;
    await expect(Math.abs(slide.getBoundingClientRect().width - 12 * rem)).toBeLessThan(1);
    await expectCentred(canvasElement, 0);
  },
};

export const OversizedSlides: Story = {
  args: { slideSize: '80rem' },
  play: async ({ canvasElement }) => {
    const viewport = viewportOf(canvasElement).getBoundingClientRect();
    for (const slide of slidesOf(canvasElement))
      await expect(slide.getBoundingClientRect().width).toBeLessThanOrEqual(viewport.width + 1);
    await expectCentred(canvasElement, 0);
  },
};

const bookSpy = fn();
export const InteractiveSlides: Story = {
  args: {
    onValueChange: fn(),
    children: SUITES.map((suite) => (
      <SuiteCard key={suite.key} name={suite.name} detail={suite.detail}>
        <input aria-label={`${suite.name} guests`} defaultValue="2" css={fixtureButtonStyle} />
        <button type="button" css={fixtureButtonStyle} onClick={() => bookSpy(suite.key)}>
          Book {suite.name}
        </button>
      </SuiteCard>
    )),
  },
  beforeEach: () => {
    bookSpy.mockClear();
  },
  play: async ({ args, canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    await userEvent.tab();
    await expectFocusRing(viewportOf(canvasElement));
    await userEvent.tab();
    const guests = canvas.getByRole('textbox', { name: 'Harbour suite guests' });
    await expect(guests).toHaveFocus();
    // Editing keys belong to the slide's own control.
    await userEvent.keyboard('{ArrowLeft}{Home}{End}{ArrowRight}');
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await userEvent.tab();
    await expect(canvas.getByRole('button', { name: 'Book Harbour suite' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await expect(bookSpy).toHaveBeenCalledTimes(1);
    await expect(bookSpy).toHaveBeenLastCalledWith('harbour');
    // Neighbouring slides are inert: hidden from the accessibility tree and not focusable.
    await expect(canvas.queryByRole('button', { name: 'Book Garden suite' })).not.toBeInTheDocument();
    const gardenBook = canvas.getByRole('button', { name: 'Book Garden suite', hidden: true });
    gardenBook.focus();
    await expect(gardenBook).not.toHaveFocus();
  },
};

export const KeyboardNavigation: Story = {
  args: { onValueChange: fn() },
  play: async ({ args, canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    const viewport = viewportOf(canvasElement);
    const tabs = canvas.getAllByRole('tab');
    await userEvent.tab();
    await expectFocusRing(viewport);
    await userEvent.keyboard('{ArrowLeft}');
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await userEvent.keyboard('{ArrowRight}');
    await expect(args.onValueChange).toHaveBeenNthCalledWith(1, 1);
    await userEvent.keyboard('{End}');
    await expect(args.onValueChange).toHaveBeenNthCalledWith(2, 3);
    await userEvent.keyboard('{ArrowRight}');
    await userEvent.keyboard('{Home}');
    await expect(args.onValueChange).toHaveBeenNthCalledWith(3, 0);
    await expect(args.onValueChange).toHaveBeenCalledTimes(3);
    await expect(viewport).toHaveFocus();

    // One tab stop in the picker; auto activation selects on focus, exactly once.
    await userEvent.tab();
    await expectFocusRing(tabs[0]!);
    await expect(tabs.filter((tab) => tab.tabIndex === 0)).toEqual([tabs[0]]);
    await userEvent.keyboard('{ArrowLeft}');
    await expect(tabs[3]).toHaveFocus();
    await expect(args.onValueChange).toHaveBeenNthCalledWith(4, 3);
    await userEvent.keyboard('{ArrowRight}');
    await expect(tabs[0]).toHaveFocus();
    await expect(args.onValueChange).toHaveBeenNthCalledWith(5, 0);
    await userEvent.keyboard('{End}');
    await expect(args.onValueChange).toHaveBeenNthCalledWith(6, 3);
    await userEvent.keyboard('{Enter}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(6);
    await expectActive(canvasElement, 3);
    await expect(tabs.filter((tab) => tab.tabIndex === 0)).toEqual([tabs[3]]);

    await userEvent.tab();
    await expect(canvas.getByRole('button', { name: 'Previous slide' })).toHaveFocus();
    await userEvent.tab();
    const next = canvas.getByRole('button', { name: 'Next slide' });
    await expectFocusRing(next);
    await expect(next).toHaveAttribute('aria-disabled', 'true');
    await userEvent.keyboard('{Enter}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(6);
    await userEvent.tab({ shift: true });
    await userEvent.keyboard(' ');
    await expect(args.onValueChange).toHaveBeenNthCalledWith(7, 2);
    await userEvent.tab({ shift: true });
    await expect(tabs[2]).toHaveFocus();
    await userEvent.tab({ shift: true });
    await expect(viewport).toHaveFocus();
    await expect(args.onValueChange).toHaveBeenCalledTimes(7);
  },
};

export const ManualIndicators: Story = {
  args: { activation: 'manual', onValueChange: fn() },
  play: async ({ args, canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    const tabs = canvas.getAllByRole('tab');
    await userEvent.tab();
    await userEvent.tab();
    await expect(tabs[0]).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    await expect(tabs[1]).toHaveFocus();
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(tabs[1]!.tabIndex).toBe(0);
    await expect(tabs[0]!.tabIndex).toBe(-1);
    await expectActive(canvasElement, 0);
    await userEvent.keyboard('{Enter}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith(1);
    await userEvent.keyboard('{End} ');
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await expect(args.onValueChange).toHaveBeenLastCalledWith(3);
    await userEvent.click(tabs[2]!);
    await expect(args.onValueChange).toHaveBeenCalledTimes(3);
    await expect(args.onValueChange).toHaveBeenLastCalledWith(2);
    await expectActive(canvasElement, 2);
  },
};

export const Controlled: Story = {
  args: { onValueChange: fn() },
  render: (args) => <ControlledCarousel {...args} />,
  play: async ({ args, canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('tab', { name: 'Slide 3 of 4' }));
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith(2);
    await expectActive(canvasElement, 2);
    const next = canvas.getByRole('button', { name: 'Next slide' });
    await userEvent.click(next);
    await expect(args.onValueChange).toHaveBeenLastCalledWith(3);
    await expect(next).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(next);
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await expect(next).toHaveFocus();
    await expectCentred(canvasElement, 3);
  },
};

export const RejectedControlled: Story = {
  args: { value: 0, onValueChange: fn() },
  play: async ({ args, canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Next slide' }));
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith(1);
    await expectActive(canvasElement, 0);

    // Focused but unselected after a declined auto activation; still exactly one tab stop.
    const third = canvas.getByRole('tab', { name: 'Slide 3 of 4' });
    await userEvent.click(third);
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await expect(args.onValueChange).toHaveBeenLastCalledWith(2);
    await expect(third).toHaveFocus();
    await expectActive(canvasElement, 0);
    await expect(canvas.getAllByRole('tab').filter((tab) => tab.tabIndex === 0)).toEqual([third]);
    // A retry on the focused tab issues one more request.
    await userEvent.keyboard('{Enter}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(3);

    // A drag that the parent declines requests once, then scrolls back to the accepted slide.
    const mouse = mouseOn(viewportOf(canvasElement));
    mouse.drag(dragSteps(-DRAG_PX));
    await expect(mouse.capture).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledTimes(4);
    await expect(args.onValueChange).toHaveBeenLastCalledWith(1);
    await expectActive(canvasElement, 0);
    await expectCentred(canvasElement, 0);
    await sleep(200);
    await expect(args.onValueChange).toHaveBeenCalledTimes(4);
  },
};

const slideClick = fn();
export const PointerSnap: Story = {
  args: {
    onValueChange: fn(),
    children: SUITES.map((suite) => (
      <div key={suite.key} onClick={() => slideClick(suite.key)}>
        <SuiteCard name={suite.name} detail={suite.detail} />
      </div>
    )),
  },
  beforeEach: () => {
    slideClick.mockClear();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Mouse drag on the slide surface, released past the midpoint, requests the next slide once. Touch and trackpad scrolling stay native and settle through scroll-snap.',
      },
    },
  },
  play: async ({ args, canvasElement }) => {
    const viewport = viewportOf(canvasElement);
    const mouse = mouseOn(viewport);
    const startScroll = viewport.scrollLeft;

    // Travel under the threshold is a press, not a drag: no capture, scroll or request.
    mouse.fire('pointerdown', 0);
    mouse.fire('pointermove', -SUB_THRESHOLD_PX);
    await expect(viewport).not.toHaveAttribute('data-dragging');
    await expect(viewport.scrollLeft).toBe(startScroll);
    mouse.fire('pointerup', -SUB_THRESHOLD_PX);
    await expect(mouse.capture).not.toHaveBeenCalled();
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expectActive(canvasElement, 0);

    // Mostly vertical travel is not a horizontal drag.
    mouse.fire('pointerdown', 0);
    mouse.fire('pointermove', -3, 20);
    mouse.fire('pointerup', -3, 20);
    await expect(mouse.capture).not.toHaveBeenCalled();
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(viewport).not.toHaveAttribute('data-dragging');

    mouse.fire('pointerdown', 0);
    for (const step of dragSteps(-DRAG_PX)) mouse.fire('pointermove', step);
    await expect(viewport).toHaveAttribute('data-dragging', 'true');
    await expect(mouse.capture).toHaveBeenCalledTimes(1);
    await expect(mouse.capture).toHaveBeenLastCalledWith(MOUSE_POINTER_ID);
    await expect(viewport.scrollLeft).toBeGreaterThan(startScroll);
    mouse.fire('pointerup', -DRAG_PX);
    fireEvent.click(slidesOf(canvasElement)[0]!.firstElementChild!);
    await expect(slideClick).not.toHaveBeenCalled();
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith(1);
    await expectActive(canvasElement, 1);
    await expectCentred(canvasElement, 1);
    // The settled scroll does not request the same slide again.
    await sleep(200);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);

    // A later click is a click again.
    fireEvent.click(slidesOf(canvasElement)[1]!.firstElementChild!);
    await expect(slideClick).toHaveBeenCalledTimes(1);
    await expect(slideClick).toHaveBeenLastCalledWith('garden');

    // A cancelled drag restores the accepted slide without a request.
    mouse.drag(dragSteps(-DRAG_PX), 'pointercancel');
    await expect(mouse.capture).toHaveBeenCalledTimes(2);
    await expectCentred(canvasElement, 1);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
  },
};

export const RTLPointerDrag: Story = {
  args: { dir: 'rtl', onValueChange: fn() },
  parameters: {
    docs: { description: { story: 'Under RTL later slides sit to the left, so dragging rightward moves forward.' } },
  },
  play: async ({ args, canvasElement }) => {
    const mouse = mouseOn(viewportOf(canvasElement));
    await expectCentred(canvasElement, 0);
    // Toward the start edge there is nothing to reach.
    mouse.drag(dragSteps(-DRAG_PX));
    await expectCentred(canvasElement, 0);
    await expect(args.onValueChange).not.toHaveBeenCalled();

    mouse.drag(dragSteps(DRAG_PX));
    await expect(mouse.capture).toHaveBeenCalledTimes(2);
    await expect(mouse.capture).toHaveBeenLastCalledWith(MOUSE_POINTER_ID);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith(1);
    await expectActive(canvasElement, 1);
    await expectCentred(canvasElement, 1);
  },
};

export const ScrollSettle: Story = {
  args: { onValueChange: fn() },
  parameters: {
    docs: {
      description: {
        story:
          'A programmatic `scrollBy` stands in for a trackpad or touch scroll (synthetic wheel events do not scroll). Once the viewport settles, the nearest slide is requested once. Real wheel and touch inertia is browser QA.',
      },
    },
  },
  play: async ({ args, canvasElement }) => {
    const viewport = viewportOf(canvasElement);
    await expectCentred(canvasElement, 0);
    const frame = viewport.getBoundingClientRect();
    const second = slidesOf(canvasElement)[1]!.getBoundingClientRect();
    viewport.scrollBy({ left: second.left + second.width / 2 - (frame.left + frame.width / 2), behavior: 'instant' });
    await waitFor(async () => {
      await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    });
    await expect(args.onValueChange).toHaveBeenLastCalledWith(1);
    await expectActive(canvasElement, 1);
    await sleep(200);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
  },
};

export const RotationStopped: Story = {
  args: { interval: ROTATION_MS, onValueChange: fn(), onPlayingValueChange: fn() },
  play: async ({ args, canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    const rotation = canvas.getByRole('button', { name: 'Start slide rotation' });
    await expect(rotation).not.toHaveAttribute('aria-pressed');
    await sleep(ROTATION_MS * 3);
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await userEvent.tab();
    await expectFocusRing(rotation);
    await expect(args.onPlayingValueChange).not.toHaveBeenCalled();
    await userEvent.tab();
    await expect(viewportOf(canvasElement)).toHaveFocus();
  },
};

export const RotationRunning: Story = {
  args: { interval: ROTATION_MS, defaultPlayingValue: true, onValueChange: fn(), onPlayingValueChange: fn() },
  play: async ({ args, canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Stop slide rotation' })).toBeInTheDocument();
    await expect(statusOf(canvasElement)).toHaveAttribute('aria-live', 'off');
    await waitFor(async () => {
      await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    });
    await expect(args.onValueChange).toHaveBeenLastCalledWith(1);
    await expectActive(canvasElement, 1);

    // Hover pauses for its duration only.
    await userEvent.hover(canvas.getByRole('region'));
    const paused = callCount(args.onValueChange);
    await sleep(ROTATION_MS * 3);
    await expect(callCount(args.onValueChange)).toBe(paused);
    await userEvent.unhover(canvas.getByRole('region'));
    await waitFor(async () => {
      await expect(callCount(args.onValueChange)).toBe(paused + 1);
    });
    await expect(args.onPlayingValueChange).not.toHaveBeenCalled();
  },
};

/** Call count of a spy, read without an assertion. */
function callCount(spy: unknown) {
  return (spy as ReturnType<typeof fn>).mock.calls.length;
}

export const RotationWrapsAround: Story = {
  args: {
    interval: ROTATION_MS,
    defaultPlayingValue: true,
    defaultValue: 3,
    onValueChange: fn(),
  },
  play: async ({ args }) => {
    await waitFor(async () => {
      await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    });
    await expect(args.onValueChange).toHaveBeenLastCalledWith(0);
  },
};

export const FocusStopped: Story = {
  args: { interval: ROTATION_MS, autoPlay: true, onValueChange: fn(), onPlayingValueChange: fn() },
  play: async ({ args, canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    const rotation = canvas.getByRole('button', { name: 'Stop slide rotation' });
    await userEvent.tab();
    await expect(rotation).toHaveFocus();
    await expect(args.onPlayingValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onPlayingValueChange).toHaveBeenLastCalledWith(false);
    await expect(rotation).toHaveTextContent('Start slide rotation');
    await expect(statusOf(canvasElement)).toHaveAttribute('aria-live', 'polite');
    // Leaving does not restart rotation.
    await userEvent.tab();
    await userEvent.tab({ shift: true });
    await sleep(ROTATION_MS * 3);
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(args.onPlayingValueChange).toHaveBeenCalledTimes(1);

    // Start clears the latch while the button keeps focus.
    await expect(rotation).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await expect(args.onPlayingValueChange).toHaveBeenCalledTimes(2);
    await expect(args.onPlayingValueChange).toHaveBeenLastCalledWith(true);
    await expect(rotation).toHaveTextContent('Stop slide rotation');
    await waitFor(async () => {
      await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    });
    await userEvent.click(rotation);
    await expect(args.onPlayingValueChange).toHaveBeenCalledTimes(3);
    await expect(args.onPlayingValueChange).toHaveBeenLastCalledWith(false);
    await expect(rotation).toHaveTextContent('Start slide rotation');
    await expect(rotation).toHaveFocus();
  },
};

const mockHidden = () => spyOn(document, 'hidden', 'get');
const pageHidden: { spy?: ReturnType<typeof mockHidden> } = {};
const stubPageHidden = () => {
  pageHidden.spy = mockHidden().mockReturnValue(false);
  return () => pageHidden.spy?.mockRestore();
};
function setPageHidden(hidden: boolean) {
  pageHidden.spy!.mockReturnValue(hidden);
  document.dispatchEvent(new Event('visibilitychange'));
}

export const RotationSafety: Story = {
  args: {
    interval: ROTATION_MS,
    value: 0,
    playingValue: true,
    onValueChange: fn(),
    onPlayingValueChange: fn(),
  },
  beforeEach: stubPageHidden,
  parameters: {
    docs: {
      description: { story: 'The parent declines both slide and playing changes; rotation still stops.' },
    },
  },
  play: async ({ args, canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    const region = canvas.getByRole('region');
    const rotation = canvas.getByRole('button', { name: 'Stop slide rotation' });
    await waitFor(async () => {
      await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    });
    await expect(args.onValueChange).toHaveBeenLastCalledWith(1);
    // The declined request stops rotation; the control says so and nothing is reported.
    await expect(rotation).toHaveTextContent('Start slide rotation');
    await expect(region).not.toHaveAttribute('data-rotating');
    await expect(statusOf(canvasElement)).toHaveAttribute('aria-live', 'polite');
    await expect(args.onPlayingValueChange).not.toHaveBeenCalled();

    // Pause/resume cycles do not repeat the request.
    await userEvent.hover(region);
    await userEvent.unhover(region);
    setPageHidden(true);
    setPageHidden(false);
    await sleep(ROTATION_MS * 3);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(rotation).toHaveTextContent('Start slide rotation');
    await expect(args.onPlayingValueChange).not.toHaveBeenCalled();

    // Start retries once (playingValue is already true, so nothing to report); the second
    // decline stops it again. The keyboard keeps the pointer from hover-pausing it.
    rotation.focus();
    await userEvent.keyboard('{Enter}');
    await expect(args.onPlayingValueChange).not.toHaveBeenCalled();
    await expect(rotation).toHaveTextContent('Stop slide rotation');
    await waitFor(async () => {
      await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    });
    await expect(args.onValueChange).toHaveBeenLastCalledWith(1);
    await expect(rotation).toHaveTextContent('Start slide rotation');

    // A declined Stop still stops. Pressed from outside, focus arrives first; the press still
    // means Stop.
    await userEvent.keyboard('{Enter}');
    await expect(rotation).toHaveTextContent('Stop slide rotation');
    rotation.blur();
    await userEvent.click(rotation);
    await expect(args.onPlayingValueChange).toHaveBeenCalledTimes(2);
    await expect(args.onPlayingValueChange).toHaveBeenNthCalledWith(1, false);
    await expect(args.onPlayingValueChange).toHaveBeenNthCalledWith(2, false);
    await expect(rotation).toHaveTextContent('Start slide rotation');
    await sleep(ROTATION_MS * 3);
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
  },
};
const offscreenSpacerStyle = css({ blockSize: '300vh' });
export const BackgroundPause: Story = {
  args: { interval: ROTATION_MS, defaultPlayingValue: true, onValueChange: fn() },
  decorators: [
    (Story) => (
      <>
        <div data-testid="spacer" css={offscreenSpacerStyle} />
        <Story />
      </>
    ),
  ],
  beforeEach: stubPageHidden,
  play: async ({ args, canvasElement }) => {
    const region = within(canvasElement).getByRole('region');
    // Offscreen: no rotation until the carousel scrolls into view.
    await sleep(ROTATION_MS * 3);
    await expect(args.onValueChange).not.toHaveBeenCalled();
    // Hidden page: no rotation even when in view.
    setPageHidden(true);
    region.scrollIntoView({ block: 'center', behavior: 'instant' });
    await sleep(ROTATION_MS * 3);
    await expect(args.onValueChange).not.toHaveBeenCalled();
    setPageHidden(false);
    await waitFor(async () => {
      await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    });
    within(canvasElement).getByTestId('spacer').remove();
  },
};

function Unmountable(props: CarouselProps) {
  const [mounted, setMounted] = useState(true);
  return (
    <>
      {mounted && <Carousel {...props} />}
      <button type="button" css={fixtureButtonStyle} onClick={() => setMounted(false)}>
        Unmount
      </button>
    </>
  );
}
Unmountable.displayName = 'Unmountable';

export const UnmountCleanup: Story = {
  args: { interval: ROTATION_MS, defaultPlayingValue: true, onValueChange: fn() },
  render: (args) => <Unmountable {...args} />,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    fireEvent.click(canvas.getByRole('button', { name: 'Unmount' }));
    await expect(canvas.queryByRole('region')).not.toBeInTheDocument();
    await sleep(ROTATION_MS * 3);
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};

export const Empty: Story = {
  args: { children: [false, null, undefined], interval: ROTATION_MS, defaultPlayingValue: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('region', { name: 'Harbour suites' })).toHaveTextContent('No slides');
    await expect(canvasElement.querySelector('[data-ui="carousel-empty"]')).toBeInTheDocument();
    await expect(canvas.queryByRole('tablist')).not.toBeInTheDocument();
    await expect(canvas.queryByRole('tabpanel')).not.toBeInTheDocument();
    await expect(canvas.queryAllByRole('button')).toHaveLength(0);
    await expect(canvasElement.querySelector('[data-ui="carousel-viewport"]')).not.toBeInTheDocument();
    await expect(canvasElement.querySelector('[data-ui="carousel-status"]')).not.toBeInTheDocument();
  },
};

export const FalsySlides: Story = {
  args: { children: [0, '', false, null, 'Plain text slide'], onValueChange: fn() },
  parameters: {
    docs: { description: { story: '`0` and strings are slides; `false`, `null` and `undefined` are not.' } },
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const slides = slidesOf(canvasElement);
    await expect(slides).toHaveLength(3);
    await expect(canvas.getAllByRole('tab')).toHaveLength(3);
    await expect(slides[0]).toHaveTextContent('0');
    await expect(slides[1]).toHaveTextContent('');
    await expect(slides[2]).toHaveTextContent('Plain text slide');
    await expectActive(canvasElement, 0);
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};

export const SingleSlide: Story = {
  args: { children: suiteSlides(1), interval: ROTATION_MS, defaultPlayingValue: true, onValueChange: fn() },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const [slide] = slidesOf(canvasElement);
    await expect(slide).not.toHaveAttribute('role');
    await expect(slide).not.toHaveAttribute('inert');
    await expect(slide).not.toHaveAttribute('aria-labelledby');
    await expect(canvas.queryByRole('tablist')).not.toBeInTheDocument();
    await expect(canvas.queryAllByRole('button')).toHaveLength(0);
    await expect(viewportOf(canvasElement)).not.toHaveAttribute('tabindex');
    await expect(canvasElement.querySelector('[data-ui="carousel-status"]')).not.toBeInTheDocument();
    await sleep(ROTATION_MS * 2);
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};

function RemovableSlides(props: Omit<CarouselProps, 'children'>) {
  const [count, setCount] = useState<number>(SUITES.length);
  return (
    <Carousel {...props}>
      {SUITES.slice(0, count).map((suite, index) => (
        <SuiteCard key={suite.key} name={suite.name} detail={suite.detail}>
          {index === count - 1 && (
            <button type="button" css={fixtureButtonStyle} onClick={() => setCount((value) => value - 1)}>
              Remove {suite.name}
            </button>
          )}
        </SuiteCard>
      ))}
    </Carousel>
  );
}
RemovableSlides.displayName = 'RemovableSlides';

export const RemovedActiveSlide: Story = {
  args: { defaultValue: 3, onValueChange: fn() },
  render: ({ children: _children, ...args }) => <RemovableSlides {...args} />,
  play: async ({ args, canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    await userEvent.tab();
    await userEvent.tab();
    const remove = canvas.getByRole('button', { name: 'Remove Loft suite' });
    await expect(remove).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await expect(canvas.getAllByRole('tab')).toHaveLength(3);
    // The index clamps to the new last slide without a callback; focus lands on the viewport.
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expectActive(canvasElement, 2);
    await expect(viewportOf(canvasElement)).toHaveFocus();
    await expect(statusOf(canvasElement)).toHaveTextContent('Slide 3 of 3');
    await expectCentred(canvasElement, 2);
  },
};

export const KeyReorder: Story = {
  args: { onValueChange: fn() },
  render: ({ children: _children, ...args }) => {
    function Reorderable() {
      const [reversed, setReversed] = useState(false);
      const slides = suiteSlides();
      return (
        <>
          <Carousel {...args} defaultValue={1}>
            {reversed ? [...slides].reverse() : slides}
          </Carousel>
          <button type="button" css={fixtureButtonStyle} onClick={() => setReversed(true)}>
            Reverse
          </button>
        </>
      );
    }
    return <Reorderable />;
  },
  play: async ({ args, canvasElement, userEvent }) => {
    const before = slidesOf(canvasElement);
    const reverse = within(canvasElement).getByRole('button', { name: 'Reverse' });
    await userEvent.click(reverse);
    // Focus outside the carousel stays where it is.
    await expect(reverse).toHaveFocus();
    const after = slidesOf(canvasElement);
    // Keyed slides keep their DOM identity; the index stays put and no callback fires.
    await expect(after[3]).toBe(before[0]);
    await expect(after[2]).toBe(before[1]);
    await expectActive(canvasElement, 1);
    await expect(after[1]).toHaveTextContent('Tower suite');
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};

type Suite = { key: string; name: string; detail: string };
const renovated = (suite: Suite): Suite => ({ ...suite, key: `${suite.key}-renovated`, name: `Renovated ${suite.name}` });

/** Slides whose own buttons replace that slide or reverse the order, keeping the count. */
function ChangingSlides(props: Omit<CarouselProps, 'children'>) {
  const [suites, setSuites] = useState<readonly Suite[]>(SUITES);
  return (
    <Carousel {...props}>
      {suites.map((suite) => (
        <SuiteCard key={suite.key} name={suite.name} detail={suite.detail}>
          <button
            type="button"
            css={fixtureButtonStyle}
            onClick={() => setSuites((list) => list.map((item) => (item.key === suite.key ? renovated(item) : item)))}
          >
            Replace {suite.name}
          </button>
          <button type="button" css={fixtureButtonStyle} onClick={() => setSuites((list) => [...list].reverse())}>
            Reverse from {suite.name}
          </button>
        </SuiteCard>
      ))}
    </Carousel>
  );
}
ChangingSlides.displayName = 'ChangingSlides';

export const ReplacedFocusedSlide: Story = {
  args: { onValueChange: fn() },
  render: ({ children: _children, ...args }) => <ChangingSlides {...args} />,
  play: async ({ args, canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    await userEvent.tab();
    await userEvent.tab();
    await expect(canvas.getByRole('button', { name: 'Replace Harbour suite' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    // Same count and index, new slide: focus moves to the viewport instead of the body.
    await expect(canvas.getAllByRole('tab')).toHaveLength(SUITES.length);
    await expectActive(canvasElement, 0);
    await expect(slidesOf(canvasElement)[0]).toHaveTextContent('Renovated Harbour suite');
    await expect(viewportOf(canvasElement)).toHaveFocus();
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};

export const ReorderedFocusedSlide: Story = {
  args: { onValueChange: fn() },
  render: ({ children: _children, ...args }) => <ChangingSlides {...args} />,
  play: async ({ args, canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.tab();
    await expect(canvas.getByRole('button', { name: 'Reverse from Harbour suite' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    // The focused slide moved to an inactive position: focus moves to the viewport.
    await expectActive(canvasElement, 0);
    await expect(slidesOf(canvasElement)[0]).toHaveTextContent('Loft suite');
    await expect(slidesOf(canvasElement)[3]).toHaveTextContent('Harbour suite');
    await expect(viewportOf(canvasElement)).toHaveFocus();
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};

const disabledBook = fn();
export const Disabled: Story = {
  args: {
    disabled: true,
    interval: ROTATION_MS,
    defaultPlayingValue: true,
    onValueChange: fn(),
    children: SUITES.map((suite) => (
      <SuiteCard key={suite.key} name={suite.name} detail={suite.detail}>
        <button type="button" css={fixtureButtonStyle} onClick={() => disabledBook(suite.key)}>
          Book {suite.name}
        </button>
      </SuiteCard>
    )),
  },
  beforeEach: () => {
    disabledBook.mockClear();
  },
  play: async ({ args, canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    await expect(viewportOf(canvasElement)).not.toHaveAttribute('tabindex');
    await expect(canvas.getByRole('button', { name: 'Start slide rotation' })).toHaveAttribute('aria-disabled', 'true');
    for (const tab of canvas.getAllByRole('tab')) await expect(tab).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(canvas.getByRole('button', { name: 'Next slide' }));
    await userEvent.click(canvas.getByRole('tab', { name: 'Slide 3 of 4' }));
    await userEvent.keyboard('{ArrowRight}{Enter}');
    await sleep(ROTATION_MS * 2);
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await userEvent.click(canvas.getByRole('button', { name: 'Book Harbour suite' }));
    await expect(disabledBook).toHaveBeenCalledTimes(1);
  },
};

export const Narrow: Story = {
  args: {
    locale: 'de-DE',
    labels: {
      slideCount: (index, count) =>
        `Unterkunft ${new Intl.NumberFormat('de-DE').format(index + 1)} von ${new Intl.NumberFormat('de-DE').format(count)}`,
    },
    children: Array.from({ length: 12 }, (_, index) => {
      const suite = SUITES[index % SUITES.length]!;
      return <SuiteCard key={`${suite.key}-${index}`} name={suite.name} detail={suite.detail} />;
    }),
  },
  decorators: [
    (Story) => (
      <div css={narrowFrameStyle}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    const viewport = viewportOf(canvasElement).getBoundingClientRect();
    await expect(slidesOf(canvasElement)[0]!.getBoundingClientRect().width).toBeLessThanOrEqual(viewport.width + 1);
    const targets = [...canvas.getAllByRole('tab'), ...canvas.getAllByRole('button')];
    for (const target of targets) {
      const box = target.getBoundingClientRect();
      await expect(box.width).toBeGreaterThanOrEqual(TARGET_PX - 0.5);
      await expect(box.height).toBeGreaterThanOrEqual(TARGET_PX - 0.5);
    }
    const status = statusOf(canvasElement);
    await expect(status).toHaveTextContent('Unterkunft 1 von 12');
    await expect(status.scrollWidth).toBeLessThanOrEqual(status.clientWidth + 1);
    // The picker scrolls instead of shrinking targets; the focused tab is revealed.
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.keyboard('{End}');
    const last = canvas.getByRole('tab', { name: 'Unterkunft 12 von 12' });
    await expect(last).toHaveFocus();
    const list = canvas.getByRole('tablist').getBoundingClientRect();
    const lastBox = last.getBoundingClientRect();
    await expect(lastBox.right).toBeLessThanOrEqual(list.right + 1);
    await expect(lastBox.left).toBeGreaterThanOrEqual(list.left - 1);
  },
};

export const LightTheme: Story = {
  args: { interval: ROTATION_MS },
  globals: { theme: 'light' },
  decorators: [withLightTheme],
};

export const RTL: Story = {
  args: { dir: 'rtl', onValueChange: fn() },
  play: async ({ args, canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    await expectCentred(canvasElement, 0);
    await userEvent.tab();
    await userEvent.keyboard('{ArrowLeft}');
    await expect(args.onValueChange).toHaveBeenNthCalledWith(1, 1);
    await expectCentred(canvasElement, 1);
    // Later slides sit to the left in RTL.
    const [first, second] = slidesOf(canvasElement);
    await expect(second!.getBoundingClientRect().left).toBeLessThan(first!.getBoundingClientRect().left);
    await userEvent.keyboard('{ArrowRight}');
    await expect(args.onValueChange).toHaveBeenNthCalledWith(2, 0);
    await userEvent.tab();
    await userEvent.keyboard('{ArrowLeft}');
    await expect(canvas.getByRole('tab', { name: 'Slide 2 of 4' })).toHaveFocus();
    await expect(args.onValueChange).toHaveBeenNthCalledWith(3, 1);
    const glyph = canvas.getByRole('button', { name: 'Next slide' }).querySelector('svg')!;
    await expect(getComputedStyle(glyph).transform).toBe('matrix(-1, 0, 0, 1, 0, 0)');
  },
};

/** Fake reduced-motion preference the story can flip at runtime. */
const reducedMotionPreference = { set: (_matches: boolean) => {} };
function stubReducedMotion(initial: boolean) {
  let matches = initial;
  const listeners = new Set<() => void>();
  const realMatchMedia = window.matchMedia.bind(window);
  const spy = spyOn(window, 'matchMedia').mockImplementation((query: string) =>
    query === REDUCED_MOTION_QUERY
      ? ({
          media: query,
          get matches() {
            return matches;
          },
          addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
          removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
        } as unknown as MediaQueryList)
      : realMatchMedia(query),
  );
  reducedMotionPreference.set = (next) => {
    matches = next;
    listeners.forEach((listener) => listener());
  };
  return () => spy.mockRestore();
}

export const ReducedMotion: Story = {
  args: { interval: ROTATION_MS, defaultPlayingValue: true, onValueChange: fn(), onPlayingValueChange: fn() },
  beforeEach: () => stubReducedMotion(true),
  parameters: {
    docs: {
      description: {
        story:
          'Driven by a stubbed `matchMedia` preference, not real media emulation: rotation is unavailable and slide changes scroll instantly. Browser QA covers the real preference.',
      },
    },
  },
  play: async ({ args, canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    const rotation = canvas.getByRole('button', { name: 'Start slide rotation' });
    await expect(rotation).toHaveAttribute('aria-disabled', 'true');
    await sleep(ROTATION_MS * 3);
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await userEvent.click(rotation);
    await expect(args.onPlayingValueChange).not.toHaveBeenCalled();

    const viewport = viewportOf(canvasElement);
    const scrollTo = spyOn(viewport, 'scrollTo');
    await userEvent.click(canvas.getByRole('button', { name: 'Next slide' }));
    await expect(scrollTo).toHaveBeenLastCalledWith(expect.objectContaining({ behavior: 'instant' }));
    scrollTo.mockRestore();
    await expect(offCentre(canvasElement, 1)).toBeLessThan(2);

    // Returning to normal motion does not restart rotation on its own.
    reducedMotionPreference.set(false);
    await waitFor(async () => {
      await expect(rotation).not.toHaveAttribute('aria-disabled');
    });
    await expect(rotation).toHaveTextContent('Start slide rotation');
    await sleep(ROTATION_MS * 3);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);

    // A runtime switch to reduced motion stops rotation at once.
    await userEvent.click(rotation);
    await expect(rotation).toHaveTextContent('Stop slide rotation');
    reducedMotionPreference.set(true);
    await waitFor(async () => {
      await expect(rotation).toHaveAttribute('aria-disabled', 'true');
    });
    await expect(rotation).toHaveTextContent('Start slide rotation');

    const pill = canvas.getAllByRole('tab')[0]!.firstElementChild!;
    await expect(mediaDeclarations(pill, 'prefers-reduced-motion')).toContainEqual(
      expect.objectContaining({ transitionDuration: '0s' }),
    );
  },
};

export const ForcedColors: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Structural check of the authored forced-colors rules; it does not emulate forced colors. Browser QA verifies the rendered picker.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const tabs = within(canvasElement).getAllByRole('tab');
    await expect(mediaDeclarations(tabs[0]!.firstElementChild!, 'forced-colors')).toContainEqual(
      expect.objectContaining({ backgroundColor: 'highlight' }),
    );
    await expect(mediaDeclarations(tabs[1]!.firstElementChild!, 'forced-colors')).toContainEqual(
      expect.objectContaining({ backgroundColor: 'canvastext' }),
    );
    // Selection is a shape change too, not only a colour change.
    await sleep(TRANSITION_MS);
    const selected = tabs[0]!.firstElementChild!.getBoundingClientRect().width;
    const unselected = tabs[1]!.firstElementChild!.getBoundingClientRect().width;
    await expect(selected).toBeGreaterThan(unselected * 2);
  },
};

const rootRef = fn();
export const AriaAndStyling: Story = {
  args: {
    ref: rootRef,
    role: 'group',
    'aria-label': undefined,
    'aria-labelledby': 'carousel-heading',
    'aria-describedby': 'carousel-hint',
    labels: { carouselRole: 'Galerie' },
    sx: { paddingBlock: '7px' },
    slotProps: {
      tabList: { 'aria-labelledby': 'carousel-heading' },
      viewport: { 'aria-label': 'Suite photos' },
      slide: { 'aria-describedby': 'carousel-hint', 'aria-labelledby': 'missing-id' },
      status: { css: { letterSpacing: '3px' } },
      indicator: { css: { minInlineSize: '40px' } },
    },
  },
  render: (args) => (
    <StrictMode>
      <p id="carousel-heading">Featured suites</p>
      <p id="carousel-hint">Use the picker to change suites.</p>
      <Carousel {...args} />
    </StrictMode>
  ),
  beforeEach: () => {
    rootRef.mockClear();
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const root = canvas.getByRole('group', { name: 'Featured suites' });
    await expect(root).toHaveAttribute('aria-roledescription', 'Galerie');
    await expect(root).toHaveAttribute('aria-describedby', 'carousel-hint');
    await expect(rootRef).toHaveBeenLastCalledWith(root);
    const tablist = canvas.getByRole('tablist', { name: 'Featured suites' });
    await expect(tablist).not.toHaveAttribute('aria-label');
    await expect(canvas.getByRole('group', { name: 'Suite photos' })).toBe(viewportOf(canvasElement));
    const [slide] = slidesOf(canvasElement);
    const tab = canvas.getAllByRole('tab')[0]!;
    await expect(slide).toHaveAttribute('aria-labelledby', `missing-id ${tab.id}`);
    await expect(slide).toHaveAttribute('aria-describedby', 'carousel-hint');
    await expect(canvas.getByRole('tabpanel', { name: 'Slide 1 of 4' })).toBe(slide);
    await expect(Number.parseFloat(getComputedStyle(root).paddingTop)).toBeCloseTo(7, 0);
    await expect(Number.parseFloat(getComputedStyle(statusOf(canvasElement)).letterSpacing)).toBeCloseTo(3, 0);
    await expect(tab.getBoundingClientRect().width).toBeGreaterThanOrEqual(39.5);
  },
};
