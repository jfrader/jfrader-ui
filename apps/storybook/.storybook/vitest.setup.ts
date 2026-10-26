import { configure, getConfig } from 'storybook/test';
import { beforeAll, beforeEach, afterEach } from 'vitest';
import { cdp } from 'vitest/browser';
import { auditDesign } from '../../../packages/ui/src/testing/design-assertions';

type EventWrapper = ReturnType<typeof getConfig>['eventWrapper'];

const reentrancyGuarded = new WeakSet<EventWrapper>();

/**
 * Makes Testing Library's `eventWrapper` reentrant, so play functions run without nested act()
 * diagnostics.
 *
 * `@storybook/react`'s own `beforeAll` sets `eventWrapper` to `act(cb)`. Every
 * `userEvent`/`fireEvent` dispatch in a play function goes through it. A dispatch can trigger
 * another dispatch synchronously: when a click or key closes an editor (InlineEdit), React
 * removes the focused input while committing inside that act. Chromium then fires `blur` on the
 * detached input, and user-event's blur listener sends a synthetic `change` through the same
 * `eventWrapper`. That second dispatch opens a nested act while the outer one is still flushing.
 * The nested act exits first and closes the act scope early, so React reports the rest of the
 * outer update as "not wrapped in act(...)" or "suspended inside an `act` scope ... not awaited".
 * Browsers fire blur on removal, so the component code is fine. Only the harness double-wraps.
 *
 * The guard calls a nested dispatch directly, without the wrapper. It still runs inside the
 * outer act scope, so its updates are batched and flushed by the act that is already open. Event
 * order, state updates and assertions are unchanged. The only thing removed is the redundant
 * inner act. Without the guard, every InlineEdit story that closes its editor in a play function
 * logs these warnings (11 stories). With it, no story logs any.
 *
 * This file is a Vitest setup file of the `storybook` project, so the guard exists only in test
 * runs; `storybook dev` and the static build never load it. The addon's own setup file registers
 * the `beforeAll` that runs the project annotations (and installs the act wrapper) before this
 * file runs, and Vitest runs `beforeAll` hooks in registration order, so this wraps the real act
 * wrapper. The returned cleanup restores the original wrapper. Installing the guard twice is a
 * no-op.
 */
function guardEventWrapperReentrancy() {
  const { eventWrapper } = getConfig();
  if (reentrancyGuarded.has(eventWrapper)) return;

  let depth = 0;
  const guarded: EventWrapper = (cb) => {
    if (depth > 0) return cb();
    depth += 1;
    try {
      return eventWrapper(cb);
    } finally {
      depth -= 1;
    }
  };
  reentrancyGuarded.add(guarded);
  configure({ eventWrapper: guarded });
  return () => configure({ eventWrapper });
}

beforeAll(guardEventWrapperReentrancy);

afterEach(() => {
  const leakedSx = document.querySelector('[sx]');
  if (leakedSx) throw new Error(`Unconsumed sx attribute on ${leakedSx.outerHTML}`);
  const failures = auditDesign(document);
  if (failures.length) throw new Error(`Design audit:\n${failures.join('\n')}`);
});

// Emulate the browser preference itself: mocking matchMedia does not activate CSS media rules.
const storyMediaPreferences: Readonly<Record<string, string | undefined>> = {
  'Caret Reduced Motion': 'prefers-reduced-motion',
  'Reduced Transparency': 'prefers-reduced-transparency',
  'Dial Reduced Motion': 'prefers-reduced-motion',
  'Morph Reduced Motion': 'prefers-reduced-motion',
  'Sheet Reduced Motion': 'prefers-reduced-motion',
  'Semantic Reduced Motion': 'prefers-reduced-motion',
  'Action Reduced Motion': 'prefers-reduced-motion',
  'Action Button Reduced Motion': 'prefers-reduced-motion',
  'Wallet Reduced Motion': 'prefers-reduced-motion',
  'Game Score Reduced Motion': 'prefers-reduced-motion',
  'Game Rounds Reduced Motion': 'prefers-reduced-motion',
  'Game Marks Reduced Motion': 'prefers-reduced-motion',
  'Poker chips reduced motion': 'prefers-reduced-motion',
  'Game Score Forced Colors': 'forced-colors',
  'Game Rounds Forced Colors': 'forced-colors',
  'Game Marks Forced Colors': 'forced-colors',
  'Game Seat Forced Colors': 'forced-colors',
  'Gravity Well Forced Colors': 'forced-colors',
  'Gravity Well Reduced Motion': 'prefers-reduced-motion',
};

// Touch emulation makes `(pointer: coarse)` match, so these stories measure the touch target sizes.
const touchStories = new Set([
  'Touch control sizes',
  'MoneyInput touch sizes',
  'NumberField touch sizes',
  'Dialog touch targets',
  'Drawer touch targets',
  'BottomSheet touch targets',
  'DialogStack touch targets',
]);
const isTouchStory = (name: string) => touchStories.has(name) || /^Touch table (320|390|768)$/.test(name);

beforeEach(async ({ task }) => {
  if (isTouchStory(task.name) || task.name === 'Desktop table controls') {
    await cdp().send('Emulation.setTouchEmulationEnabled', { enabled: isTouchStory(task.name) });
  }
  const preference = storyMediaPreferences[task.name];
  if (!preference) return;
  await cdp().send('Emulation.setEmulatedMedia', {
    features: [{ name: preference, value: preference === 'forced-colors' ? 'active' : 'reduce' }],
  });
});

afterEach(async ({ task }) => {
  if (isTouchStory(task.name) || task.name === 'Desktop table controls') {
    await cdp().send('Emulation.setTouchEmulationEnabled', { enabled: false });
  }
  if (!storyMediaPreferences[task.name]) return;
  await cdp().send('Emulation.setEmulatedMedia', { features: [] });
});
