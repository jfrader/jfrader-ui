import { useState, type ReactNode } from 'react';
import type { Meta, StoryContext, StoryObj } from '@storybook/react-vite';
import { expect, fn, waitFor, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { expectThemedSurface } from '../../testing/theme-assertions';
import { withLightTheme } from '../../testing/story-decorators';
import { Stepper, type StepperProps, type StepperStep } from './index';
// `styled` is the app-facing styling API; consumers import it from `@jfrader/ui`.
import { styled } from '../../index';

const NarrowFrame = styled.div({ inlineSize: '20rem' });

const CompactFrame = styled.div({ inlineSize: '320px' });

// Raw fixture buttons must pass the global target-size (WCAG 2.5.8) axe gate in every environment.
const FixtureButton = styled.button({ minHeight: vars.space[6], minWidth: vars.space[6], padding: `${vars.space[1]} calc(${vars.space[2]} + ${vars.space[1]} / 2)`, boxSizing: 'border-box' });

const STEPS: readonly StepperStep[] = [
  { id: 'account', label: 'Account', description: 'Email and password' },
  { id: 'profile', label: 'Profile', description: 'Name and avatar' },
  { id: 'security', label: 'Security', description: 'Two-factor setup' },
  { id: 'review', label: 'Review', description: 'Confirm and submit' },
];

const USAGE = `<Stepper steps={steps} interactive value={currentStep}
  onValueChange={setCurrentStep} label="Checkout" />
// Render and validate current-step content in the app, not inside Stepper.`;

const Frame = styled.div({
  display: 'flex',
  flexDirection: 'column',
  gap: vars.space[4],
  inlineSize: '40rem',
  maxInlineSize: '100%',
});

const meta = {
  title: 'Navigation/Stepper',
  component: Stepper,
  parameters: {
    docs: {
      description: { component: 'Show progress through steps or return to a completed step.' },
      usage: `### Values
- Give each step a unique \`id\` and a \`label\`. \`value\` is a zero-based index; \`steps.length\` marks a nonempty flow complete. Values are floored and clamped to that range, and non-finite values become \`0\` without calling \`onValueChange\`.
- The initial index defaults to \`0\`. Use \`defaultValue\` to seed it, or pair \`value\` with \`onValueChange\` and update \`value\` to accept a request.
- With \`interactive\` omitted, the stepper is an indicator without controls. Set \`interactive\` to allow returning to enabled steps before the current index. Current and upcoming steps cannot be selected. Render step content and validate forward progress in your app.

### Keyboard
- In interactive mode, Tab enters at one step. Use Left and Right horizontally, or Up and Down vertically, to move through the current step and enabled completed steps. Horizontal keys reverse in RTL; movement stops at the ends.
- Home and End reach the first and last reachable steps. Focus movement does not change \`value\`; press Enter or Space on a completed step to return to it.

### Details
- \`details\` defaults to \`all\`. Set it to \`current\` to show only the current description. A step's \`error\` replaces its description and always remains visible, including in compact mode; it does not prevent returning to that step unless you also set \`disabled\`.
- \`orientation\` defaults to \`horizontal\`, and \`responsive\` defaults to \`true\`. At container widths of 30rem or less, horizontal steppers show markers and a current-step caption. Set \`responsive={false}\` to keep labels, or \`compact\` to use markers at any width.

### Localization
- Use \`locale\` for numerals, \`getStepLabel\` for step names and \`getChangeLabel\` for announcements. Translate \`label\` and \`completeLabel\`, which default to "Progress" and "All steps complete".
- \`announceChanges\` defaults to \`false\`. Enable it to announce accepted index changes politely; initial rendering and focus moves are not announced.

### Customization
- Use \`sx\` for the root and \`slotProps\` to style the list, items, heads, markers, labels, descriptions, connectors and caption. A step's \`icon\` replaces its numeral or status glyph.`,
    },
  },
  args: { steps: STEPS },
  argTypes: {
    orientation: { control: 'radio', options: ['horizontal', 'vertical'] },
    size: { control: 'radio', options: ['sm', 'md'] },
    details: { control: 'radio', options: ['all', 'current'] },
  },
  decorators: [
    (Story) => (
      <Frame>
        <Story />
      </Frame>
    ),
  ],
} satisfies Meta<typeof Stepper>;

export default meta;

type Story = Omit<StoryObj<StepperProps>, 'render' | 'play'> & {
  render?: (args: StepperProps) => ReactNode;
  play?: (context: StoryContext<StepperProps>) => Promise<void>;
};

function ControlledStepper(props: StepperProps) {
  const [value, setValue] = useState(props.value ?? 0);
  return (
    <Stepper
      {...props}
      value={value}
      onValueChange={(next) => {
        setValue(next);
        props.onValueChange?.(next);
      }}
    />
  );
}
ControlledStepper.displayName = 'ControlledStepper';

const getRoots = (canvasElement: HTMLElement) =>
  Array.from(canvasElement.querySelectorAll<HTMLElement>('[data-ui="stepper"]'));
const getRoot = (canvasElement: HTMLElement) => getRoots(canvasElement)[0]!;
const parts = (root: HTMLElement, part: string) =>
  Array.from(root.querySelectorAll<HTMLElement>(`[data-ui="stepper-${part}"]`));
const states = (root: HTMLElement) => parts(root, 'item').map((item) => item.dataset.state);

/** Focus landed on `element` in its own document and draws the 2px ring (DPR-tolerant). */
async function expectFocusRing(element: HTMLElement) {
  await expect(element.ownerDocument.activeElement).toBe(element);
  const style = getComputedStyle(element);
  await expect(style.outlineStyle).not.toBe('none');
  await expect(Math.abs(parseFloat(style.outlineWidth) - 2)).toBeLessThan(1.1);
}

/** Computed lengths at a fractional devicePixelRatio drift from the authored px value. */
async function expectPx(value: string, expected: number) {
  await expect(Math.abs(parseFloat(value) - expected)).toBeLessThan(1.1);
}

/** The current step differs from an upcoming one beyond color: a halo ring and heavier text. */
async function expectCurrentCue(root: HTMLElement) {
  const index = states(root).indexOf('current');
  const [current, upcoming] = [index, index + 1].map((i) => parts(root, 'marker')[i]!);
  const [currentStyle, upcomingStyle] = [current!, upcoming!].map((marker) => getComputedStyle(marker));
  await expect(upcomingStyle!.outlineStyle).toBe('none');
  await expect(currentStyle!.outlineStyle).toBe('solid');
  await expectPx(currentStyle!.outlineWidth, 2);
  await expectPx(currentStyle!.outlineOffset, 2);
  await expect(parseFloat(currentStyle!.fontWeight)).toBeGreaterThan(parseFloat(upcomingStyle!.fontWeight));
  const [currentLabel, upcomingLabel] = [index, index + 1].map((i) => getComputedStyle(parts(root, 'label')[i]!));
  await expect(parseFloat(currentLabel!.fontWeight)).toBeGreaterThan(parseFloat(upcomingLabel!.fontWeight));
  // The halo stays inside the head, clear of the head's own focus ring.
  const halo = current!.getBoundingClientRect();
  const head = parts(root, 'head')[index]!.getBoundingClientRect();
  const reach = parseFloat(currentStyle!.outlineWidth) + parseFloat(currentStyle!.outlineOffset);
  await expect(halo.left - reach).toBeGreaterThanOrEqual(head.left - 1);
  await expect(halo.top - reach).toBeGreaterThanOrEqual(head.top - 1);
  await expect(halo.bottom + reach).toBeLessThanOrEqual(head.bottom + 1);
}

/** Visually hidden yet still in the accessibility tree (not `display: none`, no aria-hidden ancestor). */
async function expectVisuallyHidden(element: HTMLElement) {
  const style = getComputedStyle(element);
  await expect(style.display).not.toBe('none');
  await expect(style.clipPath).toBe('inset(50%)');
  await expect(element.closest('[aria-hidden="true"]')).toBeNull();
}

/** The authored rule inside `condition` that targets one of `element`'s classes (optionally a pseudo-element). */
function findConditionalRule(element: HTMLElement, condition: string, pseudo = '') {
  for (const sheet of Array.from(element.ownerDocument.styleSheets)) {
    for (const rule of Array.from(sheet.cssRules)) {
      if (!(rule instanceof CSSMediaRule) || !rule.conditionText.includes(condition)) continue;
      for (const inner of Array.from(rule.cssRules)) {
        if (!(inner instanceof CSSStyleRule)) continue;
        const matches = Array.from(element.classList).some((name) =>
          inner.selectorText.split(',').some((selector) => selector.trim().startsWith(`.${name}${pseudo}`)),
        );
        if (matches) return inner;
      }
    }
  }
  return undefined;
}

export const Default: Story = {
  args: { value: 1 },
  parameters: { docs: { source: { language: 'tsx', code: `<Stepper value={1} steps={[
  { id: 'account', label: 'Account', description: 'Email and password' },
  { id: 'profile', label: 'Profile', description: 'Name and avatar' },
  { id: 'security', label: 'Security', description: 'Two-factor setup' },
  { id: 'review', label: 'Review', description: 'Confirm and submit' },
]} />` } } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const root = canvas.getByRole('group', { name: 'Progress' });
    await expect(root).toHaveAttribute('data-ui', 'stepper');
    const list = within(root).getByRole('list');
    await expect(list.tagName).toBe('OL');
    // Explicit roles keep list semantics where `list-style: none` would drop them (WebKit).
    await expect(list).toHaveAttribute('role', 'list');
    const items = within(list).getAllByRole('listitem');
    await expect(items).toHaveLength(4);
    for (const item of items) await expect(item).toHaveAttribute('role', 'listitem');
    await expect(states(root)).toEqual(['complete', 'current', 'upcoming', 'upcoming']);
    await expect(root.querySelectorAll('[aria-current="step"]')).toHaveLength(1);
    await expect(items[1]).toHaveAttribute('aria-current', 'step');
    await expect(items[0]).toHaveAccessibleName('Account, step 1 of 4, completed');
    await expect(items[1]).toHaveAccessibleName('Profile, step 2 of 4, current step');
    await expect(items[2]).toHaveAccessibleName('Security, step 3 of 4, upcoming');
    // Status is never color alone: a check glyph, then numerals.
    const markers = parts(root, 'marker');
    await expect(markers[0]!.querySelector('svg')).not.toBeNull();
    await expect(markers.slice(1).map((marker) => marker.dataset.numeral)).toEqual(['2', '3', '4']);
    await expectCurrentCue(root);
    await expect(parts(root, 'connector').map((connector) => connector.dataset.state)).toEqual([
      'complete',
      'upcoming',
      'upcoming',
    ]);
    await expect(canvas.queryAllByRole('button')).toHaveLength(0);
    // The current-step caption only shows when compact.
    await expect(getComputedStyle(parts(root, 'caption')[0]!).display).toBe('none');
  },
};

export const Horizontal: Story = {
  args: { value: 2, orientation: 'horizontal', responsive: false },
  play: async ({ canvasElement }) => {
    const root = getRoot(canvasElement);
    await expect(root).toHaveAttribute('data-orientation', 'horizontal');
    const [first, second] = parts(root, 'marker').map((marker) => marker.getBoundingClientRect());
    await expect(Math.abs(first!.top - second!.top)).toBeLessThan(1);
    await expect(second!.left).toBeGreaterThan(first!.right);
    for (const connector of parts(root, 'connector')) {
      await expect(connector.getBoundingClientRect().width).toBeGreaterThan(0);
    }
    for (const label of parts(root, 'label')) await expect(getComputedStyle(label).display).not.toBe('none');
  },
};

export const Vertical: Story = {
  args: { orientation: 'vertical', interactive: true, defaultValue: 2, onValueChange: fn() },
  play: async ({ args, canvasElement, userEvent }) => {
    const root = within(canvasElement).getByRole('navigation', { name: 'Progress' });
    await expect(root).toHaveAttribute('data-orientation', 'vertical');
    const [first, second] = parts(root, 'marker').map((marker) => marker.getBoundingClientRect());
    await expect(second!.top).toBeGreaterThan(first!.bottom);
    await expect(Math.abs(first!.left - second!.left)).toBeLessThan(1);
    const heads = parts(root, 'head');
    await userEvent.tab();
    await expectFocusRing(heads[2]!);
    await userEvent.keyboard('{ArrowUp}');
    await expectFocusRing(heads[1]!);
    // Horizontal arrows belong to the page in a vertical stepper.
    await userEvent.keyboard('{ArrowLeft}{ArrowRight}');
    await expectFocusRing(heads[1]!);
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    await expectFocusRing(heads[2]!);
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};

async function expectSizes(root: HTMLElement, markerSize: number) {
  for (const marker of parts(root, 'marker')) {
    const rect = marker.getBoundingClientRect();
    await expect(Math.round(rect.width)).toBe(markerSize);
    await expect(Math.round(rect.height)).toBe(markerSize);
  }
  for (const head of parts(root, 'head')) {
    const rect = head.getBoundingClientRect();
    await expect(rect.width).toBeGreaterThanOrEqual(32);
    await expect(rect.height).toBeGreaterThanOrEqual(32);
  }
}

export const Small: Story = {
  args: { size: 'sm', interactive: true, defaultValue: 2 },
  play: async ({ canvasElement }) => {
    const root = getRoot(canvasElement);
    await expect(root).toHaveAttribute('data-size', 'sm');
    // Small markers, but every target keeps the 32px floor.
    await expectSizes(root, 24);
  },
};

export const Medium: Story = {
  args: { size: 'md', interactive: true, defaultValue: 2 },
  play: async ({ canvasElement }) => {
    await expectSizes(getRoot(canvasElement), 32);
  },
};

export const Static: Story = {
  args: { value: 2 },
  render: (args) => (
    <>
      <FixtureButton type="button">Before</FixtureButton>
      <Stepper {...args} />
      <FixtureButton type="button">After</FixtureButton>
    </>
  ),
  parameters: { docs: { source: { code: '<Stepper steps={steps} value={2} />' } } },
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    const root = getRoot(canvasElement);
    await expect(root.tagName).toBe('DIV');
    await expect(root).toHaveAttribute('role', 'group');
    for (const head of parts(root, 'head')) {
      await expect(head.tagName).toBe('SPAN');
      await expect(head).not.toHaveAttribute('tabindex');
    }
    await userEvent.tab();
    await expect(canvas.getByRole('button', { name: 'Before' })).toHaveFocus();
    await userEvent.tab();
    await expect(canvas.getByRole('button', { name: 'After' })).toHaveFocus();
  },
};

export const Interactive: Story = {
  args: { interactive: true, defaultValue: 2, onValueChange: fn() },
  parameters: { docs: { source: { language: 'tsx', code: `<Stepper steps={[
  { id: 'account', label: 'Account', description: 'Email and password' },
  { id: 'profile', label: 'Profile', description: 'Name and avatar' },
  { id: 'security', label: 'Security', description: 'Two-factor setup' },
  { id: 'review', label: 'Review', description: 'Confirm and submit' },
]} interactive defaultValue={2} />` } } },
  play: async ({ args, canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    const root = canvas.getByRole('navigation', { name: 'Progress' });
    await expect(root.tagName).toBe('NAV');
    await expect(root).not.toHaveAttribute('role');
    const heads = canvas.getAllByRole('button');
    await expect(heads).toHaveLength(4);
    await expect(heads[0]).toHaveAccessibleName('Account, step 1 of 4, completed');
    await expect(heads[0]).not.toHaveAttribute('aria-disabled');
    await expect(heads[1]).not.toHaveAttribute('aria-disabled');
    await expect(heads[2]).toHaveAttribute('aria-disabled', 'true');
    await expect(heads[2]).toHaveAttribute('aria-current', 'step');
    await expect(heads[3]).toHaveAttribute('aria-disabled', 'true');
    await expect(heads.map((head) => head.tabIndex)).toEqual([-1, -1, 0, -1]);
    // The current and upcoming steps reject activation.
    await userEvent.click(heads[2]!);
    await userEvent.click(heads[3]!);
    await expect(args.onValueChange).not.toHaveBeenCalled();
    // Backward selection is accepted once and focus stays on the same button.
    const account = heads[0]!;
    await userEvent.click(account);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith(0);
    await expect(states(root)).toEqual(['current', 'upcoming', 'upcoming', 'upcoming']);
    await expect(canvas.getAllByRole('button')[0]).toBe(account);
    await expect(account.ownerDocument.activeElement).toBe(account);
    await expect(account).toHaveAttribute('aria-current', 'step');
    await expect(account).toHaveAttribute('aria-disabled', 'true');
    await expect(account.tabIndex).toBe(0);
    await userEvent.click(account);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
  },
};

export const DetailsCurrent: Story = {
  args: {
    details: 'current',
    value: 2,
    interactive: true,
    steps: [{ ...STEPS[0]!, error: 'Email bounced' }, ...STEPS.slice(1)],
  },
  play: async ({ canvasElement }) => {
    const root = getRoot(canvasElement);
    const details = parts(root, 'description');
    // The current description plus every error; other descriptions are not rendered.
    await expect(details.map((detail) => detail.textContent)).toEqual(['Email bounced', 'Two-factor setup']);
    const heads = parts(root, 'head');
    await expect(heads[1]).not.toHaveAttribute('aria-describedby');
    await expect(heads[2]).toHaveAccessibleDescription('Two-factor setup');
    await expect(heads[0]).toHaveAccessibleDescription('Email bounced');
  },
};

export const Compact: Story = {
  args: { compact: true, interactive: true, value: 1 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const root = getRoot(canvasElement);
    await expect(root).toHaveAttribute('data-compact');
    for (const label of parts(root, 'label')) await expect(getComputedStyle(label).display).toBe('none');
    for (const detail of parts(root, 'description')) await expectVisuallyHidden(detail);
    // Names, states and descriptions stay complete for assistive tech.
    const current = canvas.getByRole('button', { name: 'Profile, step 2 of 4, current step' });
    await expect(current).toHaveAccessibleDescription('Name and avatar');
    await expect(canvas.getByRole('button', { name: 'Review, step 4 of 4, upcoming' })).toBeInTheDocument();
    const caption = parts(root, 'caption')[0]!;
    await expect(getComputedStyle(caption).display).toBe('block');
    await expect(caption).toHaveAttribute('aria-hidden', 'true');
    await expect(caption).toHaveTextContent('ProfileName and avatar');
  },
};

export const CompactStatic: Story = {
  args: { compact: true, value: 1 },
  render: (args) => (
    <>
      <Stepper {...args} />
      <Stepper {...args} details="current" label="Current details" />
    </>
  ),
  parameters: { docs: { source: { code: '<Stepper steps={steps} value={1} compact />' } } },
  play: async ({ canvasElement }) => {
    const [all, current] = getRoots(canvasElement);
    // The caption repeats the current description aria-hidden; the originals stay exposed.
    for (const root of [all!, current!]) {
      await expect(parts(root, 'caption')[0]).toHaveAttribute('aria-hidden', 'true');
      for (const detail of parts(root, 'description')) await expectVisuallyHidden(detail);
    }
    await expect(parts(all!, 'description').map((detail) => detail.textContent)).toEqual(
      STEPS.map((step) => step.description),
    );
    const [currentDetail] = parts(current!, 'description');
    await expect(parts(current!, 'description')).toHaveLength(1);
    await expect(currentDetail).toHaveTextContent('Name and avatar');
    await expect(currentDetail!.closest('li')).toHaveAttribute('aria-current', 'step');
  },
};

export const ResponsiveNarrow: Story = {
  args: { value: 1 },
  render: (args) => (
    <NarrowFrame>
      <Stepper {...args} />
      <Stepper {...args} responsive={false} label="Fixed" />
      <Stepper {...args} orientation="vertical" label="Vertical" />
    </NarrowFrame>
  ),
  parameters: { docs: { source: { code: '<Stepper steps={steps} value={1} />' } } },
  play: async ({ canvasElement }) => {
    const [auto, fixed, vertical] = getRoots(canvasElement);
    // Below 30rem a responsive horizontal stepper folds to markers plus a caption.
    await expect(auto).not.toHaveAttribute('data-compact');
    for (const label of parts(auto!, 'label')) await expect(getComputedStyle(label).display).toBe('none');
    await expect(getComputedStyle(parts(auto!, 'caption')[0]!).display).toBe('block');
    for (const detail of parts(auto!, 'description')) await expectVisuallyHidden(detail);
    for (const root of [fixed!, vertical!]) {
      for (const label of parts(root, 'label')) await expect(getComputedStyle(label).display).not.toBe('none');
      await expect(getComputedStyle(parts(root, 'caption')[0]!).display).toBe('none');
    }
    for (const root of [auto!, fixed!, vertical!]) await expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth);
  },
};

const PROFILE_ERROR: StepperStep = { ...STEPS[1]!, error: 'Handle is already taken' };

export const ErrorCurrent: Story = {
  args: { interactive: true, value: 1, steps: [STEPS[0]!, PROFILE_ERROR, ...STEPS.slice(2)] },
  play: async ({ canvasElement }) => {
    const root = getRoot(canvasElement);
    const item = parts(root, 'item')[1]!;
    const head = within(item).getByRole('button');
    await expect(item).toHaveAttribute('data-state', 'error');
    await expect(item).toHaveAttribute('aria-current', 'step');
    await expect(head).toHaveAttribute('aria-current', 'step');
    await expect(head).toHaveAccessibleName('Profile, step 2 of 4, error');
    await expect(head).toHaveAccessibleDescription('Handle is already taken');
    await expect(parts(item, 'marker')[0]!.querySelector('svg')).not.toBeNull();
    // Error text is a description, not an interrupting alert.
    await expect(within(root).queryByRole('alert')).toBeNull();
  },
};

export const ErrorCompleted: Story = {
  args: {
    interactive: true,
    compact: true,
    value: 2,
    onValueChange: fn(),
    steps: [STEPS[0]!, PROFILE_ERROR, ...STEPS.slice(2)],
  },
  play: async ({ args, canvasElement, userEvent }) => {
    const root = getRoot(canvasElement);
    const item = parts(root, 'item')[1]!;
    await expect(item).toHaveAttribute('data-state', 'error');
    // Compact never hides a non-current error or its step label.
    await expect(getComputedStyle(parts(item, 'label')[0]!).display).not.toBe('none');
    const detail = parts(item, 'description')[0]!;
    await expect(getComputedStyle(detail).display).not.toBe('none');
    await expect(detail).toHaveTextContent('Handle is already taken');
    // A completed step with an error can still be revisited.
    const head = within(item).getByRole('button');
    await expect(head).not.toHaveAttribute('aria-disabled');
    await userEvent.click(head);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith(1);
  },
};

export const AllComplete: Story = {
  args: { interactive: true, value: 4, completeLabel: 'Account ready', onValueChange: fn() },
  play: async ({ args, canvasElement, userEvent }) => {
    const root = getRoot(canvasElement);
    await expect(root.querySelectorAll('[aria-current]')).toHaveLength(0);
    await expect(states(root)).toEqual(['complete', 'complete', 'complete', 'complete']);
    for (const connector of parts(root, 'connector')) await expect(connector).toHaveAttribute('data-state', 'complete');
    const caption = parts(root, 'caption')[0]!;
    await expect(caption).toHaveTextContent('Account ready');
    await expect(caption).not.toHaveAttribute('aria-hidden');
    await expect(getComputedStyle(caption).display).toBe('block');
    const heads = parts(root, 'head');
    await userEvent.tab();
    await expectFocusRing(heads[0]!);
    await userEvent.keyboard('{End}');
    await expectFocusRing(heads[3]!);
    await userEvent.keyboard('{ArrowLeft}{Enter}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith(2);
  },
};

export const FirstStep: Story = {
  args: { interactive: true, value: 0, onValueChange: fn() },
  play: async ({ args, canvasElement, userEvent }) => {
    const root = getRoot(canvasElement);
    await expect(states(root)).toEqual(['current', 'upcoming', 'upcoming', 'upcoming']);
    const heads = parts(root, 'head');
    await userEvent.tab();
    await expectFocusRing(heads[0]!);
    await userEvent.keyboard('{ArrowRight}{End}');
    await expectFocusRing(heads[0]!);
    await userEvent.keyboard('{Enter} ');
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};

export const Empty: Story = {
  args: { steps: [], interactive: true },
  play: async ({ canvasElement }) => {
    const root = within(canvasElement).getByRole('navigation', { name: 'Progress' });
    await expect(parts(root, 'item')).toHaveLength(0);
    await expect(root.querySelectorAll('[aria-current], button')).toHaveLength(0);
    // No complete caption for an empty flow.
    await expect(parts(root, 'caption')).toHaveLength(0);
  },
};

export const OneStep: Story = {
  args: { steps: [{ id: 'confirm', label: 'Confirm', description: 'One last look' }], value: 0 },
  play: async ({ canvasElement }) => {
    const root = getRoot(canvasElement);
    const [item] = parts(root, 'item');
    await expect(item).toHaveAttribute('aria-current', 'step');
    await expect(parts(root, 'connector')).toHaveLength(0);
    await expect(getComputedStyle(item!).gridTemplateColumns).not.toBe('none');
    await expect(item!.getBoundingClientRect().width).toBeGreaterThan(0);
  },
};

export const DisabledCompleted: Story = {
  args: {
    interactive: true,
    defaultValue: 2,
    onValueChange: fn(),
    steps: [STEPS[0]!, { ...STEPS[1]!, disabled: true }, ...STEPS.slice(2)],
  },
  play: async ({ args, canvasElement, userEvent }) => {
    const heads = parts(getRoot(canvasElement), 'head');
    await expect(heads[1]).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(heads[1]!);
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await userEvent.tab({ shift: true });
    await userEvent.tab();
    await expectFocusRing(heads[2]!);
    await userEvent.keyboard('{ArrowLeft}');
    await expectFocusRing(heads[0]!);
    await userEvent.keyboard('{ArrowRight}');
    await expectFocusRing(heads[2]!);
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};

export const LongLabels: Story = {
  args: {
    value: 1,
    locale: 'ar-EG',
    steps: [
      {
        id: 'verification',
        label: 'International compliance verification and identity confirmation',
        description: 'Government-issued documents with multi-factor validation',
      },
      { id: 'keys', label: 'Cryptographic key exchange', description: 'HardwareKeySynchronizationAndMutualVerification' },
      { id: 'done', label: 'Done' },
    ],
  },
  render: (args) => (
    <CompactFrame>
      <Stepper {...args} responsive={false} />
      <Stepper {...args} orientation="vertical" label="Vertical" />
    </CompactFrame>
  ),
  play: async ({ canvasElement }) => {
    for (const root of getRoots(canvasElement)) {
      await expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth);
      const bounds = root.getBoundingClientRect();
      for (const text of [...parts(root, 'label'), ...parts(root, 'description')]) {
        const rect = text.getBoundingClientRect();
        await expect(rect.right).toBeLessThanOrEqual(bounds.right + 0.5);
        await expect(rect.left).toBeGreaterThanOrEqual(bounds.left - 0.5);
      }
      // Intl numerals size their marker instead of overflowing it.
      const numeral = parts(root, 'marker')[2]!;
      await expect(numeral).toHaveAttribute('data-numeral', '٣');
      await expect(numeral.scrollWidth).toBeLessThanOrEqual(numeral.clientWidth);
    }
  },
};

export const LightTheme: Story = {
  args: { interactive: true, value: 2 },
  globals: { theme: 'light' },
  decorators: [withLightTheme],
  play: async ({ canvasElement }) => {
    const root = getRoot(canvasElement);
    const [complete] = parts(root, 'marker');
    await expectThemedSurface(complete!, 'light', vars.color.accent);
    await expectCurrentCue(root);
  },
};

export const RTL: Story = {
  args: { interactive: true, defaultValue: 2, dir: 'rtl', responsive: false },
  play: async ({ canvasElement, userEvent }) => {
    const root = getRoot(canvasElement);
    const [first, second] = parts(root, 'marker').map((marker) => marker.getBoundingClientRect());
    await expect(first!.left).toBeGreaterThan(second!.right);
    // The connector fill grows from the inline start, the right edge under RTL.
    const connector = parts(root, 'connector')[0]!;
    const originX = parseFloat(getComputedStyle(connector, '::after').transformOrigin);
    await expect(Math.abs(originX - connector.getBoundingClientRect().width)).toBeLessThan(1);
    const heads = parts(root, 'head');
    await userEvent.tab();
    await expectFocusRing(heads[2]!);
    await userEvent.keyboard('{ArrowRight}');
    await expectFocusRing(heads[1]!);
    await userEvent.keyboard('{ArrowLeft}');
    await expectFocusRing(heads[2]!);
  },
};

export const ReducedMotion: Story = {
  args: { value: 2 },
  parameters: {
    docs: {
      description: {
        story: 'Enable reduced motion and change steps. Connector and marker transitions should take 0s.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    // The runner does not emulate the media feature; this checks the authored override.
    const root = getRoot(canvasElement);
    const connectorRule = findConditionalRule(parts(root, 'connector')[0]!, 'prefers-reduced-motion: reduce', '::after');
    await expect(connectorRule?.style.transitionDuration).toBe('0s');
    const markerRule = findConditionalRule(parts(root, 'marker')[0]!, 'prefers-reduced-motion: reduce');
    await expect(markerRule?.style.transitionDuration).toBe('0s');
  },
};

export const ForcedColors: Story = {
  args: { value: 2, steps: [STEPS[0]!, STEPS[1]!, { ...STEPS[2]!, error: 'Code expired' }, STEPS[3]!] },
  parameters: {
    docs: {
      description: {
        story: 'Enable forced colors to check marker borders, check glyphs and error glyphs use system colors.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    // The runner does not emulate forced colors; this checks the authored rules and glyph shapes.
    const root = getRoot(canvasElement);
    const markers = parts(root, 'marker');
    await expect(findConditionalRule(markers[0]!, 'forced-colors: active')?.style.borderColor.toLowerCase()).toBe('canvastext');
    await expect(markers[0]!.querySelector('svg')).not.toBeNull();
    await expect(markers[2]!.querySelector('svg')).not.toBeNull();
    await expect(getComputedStyle(markers[2]!).boxShadow).toBe('none');
    // The current halo is an outline, so it stays a visible shape with system colors.
    const currentRule = findConditionalRule(markers[0]!, 'forced-colors: active', '[data-state="current"]');
    await expect(currentRule?.style.outlineColor.toLowerCase()).toBe('highlight');
  },
};

export const Keyboard: Story = {
  args: { interactive: true, defaultValue: 2, onValueChange: fn() },
  render: (args) => (
    <>
      <FixtureButton type="button">Before</FixtureButton>
      <Stepper {...args} />
      <FixtureButton type="button">After</FixtureButton>
    </>
  ),
  parameters: { docs: { source: { code: USAGE } } },
  play: async ({ args, canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    const root = getRoot(canvasElement);
    const heads = parts(root, 'head');
    const prevented: string[] = [];
    const recordPrevented = (event: KeyboardEvent) => {
      if (event.defaultPrevented) prevented.push(event.key);
    };
    root.ownerDocument.addEventListener('keydown', recordPrevented);
    try {
      await userEvent.tab();
      await userEvent.tab();
      await expectFocusRing(heads[2]!);
      await userEvent.keyboard('{ArrowLeft}');
      await expectFocusRing(heads[1]!);
      await userEvent.keyboard('{ArrowLeft}{ArrowLeft}');
      await expectFocusRing(heads[0]!);
      await userEvent.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}');
      await expectFocusRing(heads[2]!);
      // Vertical arrows stay with the page in a horizontal stepper.
      await userEvent.keyboard('{ArrowUp}{ArrowDown}');
      await expectFocusRing(heads[2]!);
      await expect(prevented).not.toContain('ArrowUp');
      await expect(prevented).not.toContain('ArrowDown');
      await userEvent.keyboard('{Home}');
      await expectFocusRing(heads[0]!);
      await userEvent.keyboard('{End}');
      await expectFocusRing(heads[2]!);
      await userEvent.keyboard('{Escape}');
      await expect(prevented).not.toContain('Escape');
      await userEvent.keyboard('{Home}');
      await expect(args.onValueChange).not.toHaveBeenCalled();
      // One tab stop that remembers the focused step.
      await userEvent.tab();
      await expect(canvas.getByRole('button', { name: 'After' })).toHaveFocus();
      await userEvent.tab({ shift: true });
      await expectFocusRing(heads[0]!);
      await userEvent.tab({ shift: true });
      await expect(canvas.getByRole('button', { name: 'Before' })).toHaveFocus();
      await userEvent.tab();
      await expectFocusRing(heads[0]!);
      await userEvent.keyboard('{Enter}');
      await expect(args.onValueChange).toHaveBeenCalledTimes(1);
      await expect(args.onValueChange).toHaveBeenCalledWith(0);
      await expect(states(root)).toEqual(['current', 'upcoming', 'upcoming', 'upcoming']);
      await expectFocusRing(heads[0]!);
      await userEvent.keyboard('{Enter} ');
      await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    } finally {
      root.ownerDocument.removeEventListener('keydown', recordPrevented);
    }
  },
};

export const ControlledRejected: Story = {
  args: { interactive: true, value: 2, onValueChange: fn() },
  play: async ({ args, canvasElement, userEvent }) => {
    const root = getRoot(canvasElement);
    const heads = parts(root, 'head');
    await userEvent.click(heads[0]!);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith(0);
    // The parent did not accept: the current step is unchanged and focus stays put.
    await expect(states(root)).toEqual(['complete', 'complete', 'current', 'upcoming']);
    await expect(heads[2]).toHaveAttribute('aria-current', 'step');
    await expectFocusRing(heads[0]!);
    await expect(heads[0]!.tabIndex).toBe(0);
    await userEvent.keyboard(' ');
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await expect(args.onValueChange).toHaveBeenLastCalledWith(0);
    await expect(states(root)).toEqual(['complete', 'complete', 'current', 'upcoming']);
  },
};

export const ControlledAccepted: Story = {
  args: { interactive: true, value: 3, onValueChange: fn() },
  render: (args) => <ControlledStepper {...args} />,
  parameters: { docs: { source: { code: USAGE } } },
  play: async ({ args, canvasElement, userEvent }) => {
    const root = getRoot(canvasElement);
    const heads = parts(root, 'head');
    await userEvent.click(heads[1]!);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith(1);
    await expect(states(root)).toEqual(['complete', 'current', 'upcoming', 'upcoming']);
    await expect(parts(root, 'head')[1]).toBe(heads[1]);
    await expectFocusRing(heads[1]!);
  },
};

export const Normalization: Story = {
  args: { onValueChange: fn() },
  render: (args) => (
    <>
      <Stepper {...args} value={Number.NaN} label="NaN" />
      <Stepper {...args} value={1.8} label="Fraction" />
      <Stepper {...args} value={-3} label="Negative" />
      <Stepper {...args} value={99} label="Past the end" />
      <Stepper {...args} defaultValue={Number.POSITIVE_INFINITY} label="Infinite default" />
    </>
  ),
  play: async ({ args, canvasElement }) => {
    const [nan, fraction, negative, past, infinite] = getRoots(canvasElement);
    await expect(states(nan!)[0]).toBe('current');
    await expect(states(fraction!)[1]).toBe('current');
    await expect(states(negative!)[0]).toBe('current');
    await expect(states(past!)).toEqual(['complete', 'complete', 'complete', 'complete']);
    await expect(states(infinite!)[0]).toBe('current');
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};

export const ExternalAria: Story = {
  args: { interactive: true, value: 1 },
  render: (args) => (
    <>
      <p id="stepper-heading">Checkout</p>
      <p id="stepper-alt-heading">Order</p>
      <p id="stepper-note">Steps can be revisited.</p>
      <p id="stepper-head-note">Opens the step again.</p>
      <Stepper
        {...args}
        aria-label="Checkout progress"
        aria-labelledby="stepper-heading"
        aria-describedby="stepper-note"
        slotProps={{ head: { 'aria-describedby': 'stepper-head-note' } }}
      />
      <Stepper {...args} aria-labelledby="stepper-alt-heading" />
      <Stepper {...args} label="Unresolved" slotProps={{ head: { 'aria-describedby': 'stepper-missing' } }} />
    </>
  ),
  play: async ({ canvasElement }) => {
    const [both, labelledOnly, unresolved] = getRoots(canvasElement);
    // Consumer label and labelledby both survive; labelledby wins the computed name.
    await expect(both).toHaveAttribute('aria-label', 'Checkout progress');
    await expect(both).toHaveAttribute('aria-labelledby', 'stepper-heading');
    await expect(both).toHaveAccessibleName('Checkout');
    await expect(both).toHaveAccessibleDescription('Steps can be revisited.');
    const head = parts(both!, 'head')[0]!;
    const detailId = parts(both!, 'description')[0]!.id;
    await expect(head.getAttribute('aria-describedby')).toBe(`stepper-head-note ${detailId}`);
    await expect(head).toHaveAccessibleDescription('Opens the step again. Email and password');
    // With only labelledby, the internal fallback name is dropped.
    await expect(labelledOnly).not.toHaveAttribute('aria-label');
    await expect(labelledOnly).toHaveAccessibleName('Order');
    // An unresolved consumer id is kept; the internal one still resolves.
    const unresolvedHead = parts(unresolved!, 'head')[0]!;
    const unresolvedDetail = parts(unresolved!, 'description')[0]!;
    await expect(unresolvedHead.getAttribute('aria-describedby')).toBe(`stepper-missing ${unresolvedDetail.id}`);
    await expect(unresolvedHead).toHaveAccessibleDescription('Email and password');
  },
};

const ICON_STEPS: readonly StepperStep[] = [
  { id: 'zero', label: 'Zero', icon: 0 },
  { id: 'empty', label: 'Empty', icon: '' },
  { id: 'false', label: 'False', icon: false },
  { id: 'null', label: 'Null', icon: null },
];

export const FalsyDetails: Story = {
  args: {
    interactive: true,
    value: 4,
    steps: [
      { id: 'zero', label: 'Zero', description: 0 },
      { id: 'empty', label: 'Empty', description: '' },
      { id: 'false', label: 'False', description: false, error: false },
      { id: 'null', label: 'Null', description: null, error: null },
      { id: 'zero-error', label: 'Zero error', error: 0 },
    ],
  },
  render: (args) => (
    <>
      <Stepper {...args} />
      <Stepper steps={ICON_STEPS} value={0} label="Icons" />
      <Stepper steps={STEPS} value={4} completeLabel={0} label="Zero caption" />
      <Stepper steps={STEPS} value={4} completeLabel={false} label="False caption" />
      <Stepper steps={STEPS} value={4} completeLabel={null} label="Null caption" />
      <Stepper steps={STEPS} value={4} completeLabel="" label="Empty caption" />
    </>
  ),
  parameters: { docs: { source: { code: '<Stepper steps={[{ id: "a", label: "A", description: 0 }]} />' } } },
  play: async ({ canvasElement }) => {
    const [stepper, icons, zeroCaption, falseCaption, nullCaption, emptyCaption] = getRoots(canvasElement);
    const items = parts(stepper!, 'item');
    const detail = (item: HTMLElement) => parts(item, 'description')[0];
    const head = (item: HTMLElement) => parts(item, 'head')[0]!;
    const marker = (item: HTMLElement) => parts(item, 'marker')[0]!;
    // 0 and '' are content.
    await expect(detail(items[0]!)).toHaveTextContent('0');
    await expect(detail(items[1]!)).toBeDefined();
    await expect(head(items[1]!)).toHaveAttribute('aria-describedby', detail(items[1]!)!.id);
    // false and null render nothing and leave no relationship behind.
    for (const item of [items[2]!, items[3]!]) {
      await expect(detail(item)).toBeUndefined();
      await expect(head(item)).not.toHaveAttribute('aria-describedby');
      await expect(item).toHaveAttribute('data-state', 'complete');
      await expect(marker(item).querySelector('svg')).not.toBeNull();
    }
    // Icons: 0 and '' replace the numeral; false and null fall back to it.
    const iconMarkers = parts(icons!, 'marker');
    await expect(iconMarkers.map((item) => item.textContent)).toEqual(['0', '', '', '']);
    await expect(iconMarkers.map((item) => item.dataset.numeral)).toEqual([undefined, undefined, '3', '4']);
    // error={0} is an error.
    await expect(items[4]).toHaveAttribute('data-state', 'error');
    await expect(head(items[4]!)).toHaveAccessibleDescription('0');
    await expect(parts(zeroCaption!, 'caption')[0]).toHaveTextContent('0');
    await expect(parts(emptyCaption!, 'caption')).toHaveLength(1);
    await expect(parts(falseCaption!, 'caption')).toHaveLength(0);
    await expect(parts(nullCaption!, 'caption')).toHaveLength(0);
  },
};

// Lengths further apart than the DPR tolerance, so precedence stays observable.
const SLOT_OVERRIDE = 3;
const CLASS_PADDING = 1;
const SX_PADDING = 6;
const px = (value: number) => `${value}px`;
const StyledStepper = styled(Stepper)({ paddingBlock: px(CLASS_PADDING) });

// Slot css and registered classes land before consumer sx.
export const SlotStyling: Story = {
  args: {
    value: 4,
    compact: true,
    sx: { paddingBlock: px(SX_PADDING) },
    slotProps: {
      root: { sx: { paddingInline: px(SLOT_OVERRIDE), paddingBlock: px(SLOT_OVERRIDE) } },
      list: { sx: { paddingBlock: px(SLOT_OVERRIDE) } },
      item: { sx: { paddingBlock: px(SLOT_OVERRIDE) } },
      head: { sx: { borderRadius: px(SLOT_OVERRIDE) } },
      marker: { sx: { borderRadius: px(SLOT_OVERRIDE) } },
      label: { sx: { letterSpacing: px(SLOT_OVERRIDE) } },
      description: { sx: { letterSpacing: px(SLOT_OVERRIDE) } },
      connector: { sx: { blockSize: px(SLOT_OVERRIDE) } },
      caption: { sx: { letterSpacing: px(SLOT_OVERRIDE) } },
    },
  },
  render: (args) => <StyledStepper {...args} />,
  play: async ({ canvasElement }) => {
    const root = getRoot(canvasElement);
    const style = (element: HTMLElement) => getComputedStyle(element);
    // Own styles → slotProps.root css → consumer sx.
    await expectPx(style(root).paddingTop, SX_PADDING);
    await expectPx(style(root).paddingLeft, SLOT_OVERRIDE);
    await expectPx(style(parts(root, 'list')[0]!).paddingTop, SLOT_OVERRIDE);
    await expectPx(style(parts(root, 'item')[0]!).paddingTop, SLOT_OVERRIDE);
    await expectPx(style(parts(root, 'head')[0]!).borderTopLeftRadius, SLOT_OVERRIDE);
    await expectPx(style(parts(root, 'marker')[0]!).borderTopLeftRadius, SLOT_OVERRIDE);
    await expectPx(style(parts(root, 'label')[0]!).letterSpacing, SLOT_OVERRIDE);
    await expectPx(style(parts(root, 'description')[0]!).letterSpacing, SLOT_OVERRIDE);
    await expectPx(style(parts(root, 'connector')[0]!).height, SLOT_OVERRIDE);
    await expectPx(style(parts(root, 'caption')[0]!).letterSpacing, SLOT_OVERRIDE);
  },
};

const staticRef = fn();
const interactiveRef = fn();

export const RefTarget: Story = {
  render: () => (
    <>
      <Stepper ref={staticRef} steps={STEPS} value={1} label="Static" />
      <Stepper ref={interactiveRef} steps={STEPS} value={1} interactive label="Interactive" />
    </>
  ),
  parameters: { docs: { source: { code: '<Stepper ref={navRef} steps={steps} interactive />' } } },
  play: async ({ canvasElement }) => {
    const [staticRoot, interactiveRoot] = getRoots(canvasElement);
    await expect(staticRoot!.tagName).toBe('DIV');
    await expect(interactiveRoot!.tagName).toBe('NAV');
    await expect(staticRef).toHaveBeenLastCalledWith(staticRoot);
    await expect(interactiveRef).toHaveBeenLastCalledWith(interactiveRoot);
  },
};

function AnnouncedStepper(props: StepperProps) {
  const [value, setValue] = useState(0);
  return (
    <>
      <FixtureButton type="button" onClick={() => setValue((current) => current + 1)}>
        Next
      </FixtureButton>
      <Stepper
        {...props}
        value={value}
        onValueChange={(next) => {
          setValue(next);
          props.onValueChange?.(next);
        }}
      />
    </>
  );
}
AnnouncedStepper.displayName = 'AnnouncedStepper';

export const AnnounceChanges: Story = {
  args: { interactive: true, announceChanges: true, locale: 'en-US', onValueChange: fn() },
  render: (args) => (
    <>
      <AnnouncedStepper {...args} />
      <Stepper steps={STEPS} value={1} label="Silent" />
    </>
  ),
  parameters: { docs: { source: { code: '<Stepper steps={steps} value={step} announceChanges />' } } },
  play: async ({ args, canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    const [announced, silent] = getRoots(canvasElement);
    await expect(parts(silent!, 'live')).toHaveLength(0);
    const live = parts(announced!, 'live')[0]!;
    await expect(live).toHaveAttribute('aria-live', 'polite');
    await expect(live).toHaveTextContent('');
    // External changes announce without emitting onValueChange.
    await userEvent.click(canvas.getByRole('button', { name: 'Next' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(live).toHaveTextContent('Step 3 of 4: Security'));
    await expect(args.onValueChange).not.toHaveBeenCalled();
    // Focus movement is not announced; an accepted selection is.
    const heads = parts(announced!, 'head');
    await userEvent.click(heads[1]!);
    await waitFor(() => expect(live).toHaveTextContent('Step 2 of 4: Profile'));
    await userEvent.keyboard('{ArrowLeft}');
    await expectFocusRing(heads[0]!);
    await expect(live).toHaveTextContent('Step 2 of 4: Profile');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
  },
};

function RemovableStepper({ keepFocus = false, ...props }: StepperProps & { keepFocus?: boolean }) {
  const [steps, setSteps] = useState(STEPS);
  return (
    <>
      <Stepper {...props} steps={steps} value={steps.findIndex((step) => step.id === 'review')} />
      <FixtureButton

        type="button"
        // Prevents the click from taking focus, so the update lands while a step is focused.
        onMouseDown={keepFocus ? (event) => event.preventDefault() : undefined}
        onClick={() => setSteps((current) => current.filter((step) => step.id !== 'profile'))}
      >
        Remove profile
      </FixtureButton>
    </>
  );
}
RemovableStepper.displayName = 'RemovableStepper';

export const ListChanges: Story = {
  args: { interactive: true },
  render: (args) => <RemovableStepper {...args} />,
  parameters: { docs: { source: { code: USAGE } } },
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    const root = getRoot(canvasElement);
    await userEvent.tab();
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}');
    await expectFocusRing(canvas.getByRole('button', { name: /^Profile/ }));
    const remove = canvas.getByRole('button', { name: 'Remove profile' });
    await userEvent.click(remove);
    await expect(canvas.queryByRole('button', { name: /^Profile/ })).toBeNull();
    // The removed step's tab stop moves to the current step without stealing focus.
    await expect(remove).toHaveFocus();
    const heads = parts(root, 'head');
    await expect(heads.map((head) => head.tabIndex)).toEqual([-1, -1, 0]);
    await userEvent.tab({ shift: true });
    await expectFocusRing(heads[2]!);
  },
};

export const ListChangesFocusedRemoval: Story = {
  args: { interactive: true },
  render: (args) => <RemovableStepper {...args} keepFocus />,
  parameters: { docs: { source: { code: USAGE } } },
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    const root = getRoot(canvasElement);
    await userEvent.tab();
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}');
    const profile = canvas.getByRole('button', { name: /^Profile/ });
    await expect(profile).toHaveFocus();
    await userEvent.click(canvas.getByRole('button', { name: 'Remove profile' }));
    await expect(profile.isConnected).toBe(false);
    // Focus was inside the stepper, so it re-anchors to the current step instead of the body.
    const heads = parts(root, 'head');
    await expect(heads.map((head) => head.tabIndex)).toEqual([-1, -1, 0]);
    await expect(root.ownerDocument.activeElement).toBe(heads[2]);
    await expect(heads[2]).toHaveAccessibleName('Review, step 3 of 3, current step');
  },
};
