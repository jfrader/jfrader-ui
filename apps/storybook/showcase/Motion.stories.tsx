// Foundations: the duration tokens are CSS strings, Motion and timers want numbers, and both must be
// the same value. `motionDurationMs` reads them from the token object; this page shows the pairs and
// proves them against the generated custom properties.
import type { CSSProperties } from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { base } from '@jfrader/tokens';
import { vars } from '@jfrader/tokens/vars';
import { Button, ThemeProvider } from '@jfrader/ui';
import { css, type SerializedStyles } from '../../../packages/ui/src/styling/css';
import { REDUCED_MOTION } from '../../../packages/ui/src/styling/media';
import { motionDurationMs } from '../../../packages/ui/src/styling/motion-timings';

const DURATIONS = ['fast', 'base', 'slow'] as const;
type Duration = (typeof DURATIONS)[number];

const SHIFT = '9rem';

const rowStyle = {
  display: 'grid',
  gridTemplateColumns: `auto ${SHIFT} max-content`,
  alignItems: 'center',
  gap: vars.space[4],
} satisfies CSSProperties;

const trackStyle = css({
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  inlineSize: SHIFT,
  blockSize: vars.space[8],
  border: `1px dashed ${vars.color.borderControl}`,
  borderRadius: vars.radius.sm,
});

const dotStyle = css({
  inlineSize: vars.space[6],
  blockSize: vars.space[6],
  borderRadius: vars.radius.full,
  backgroundColor: vars.color.accent,
  transitionProperty: 'translate',
  transitionTimingFunction: vars.motion.easeStandard,
  '&[data-shifted="true"]': { translate: `calc(${SHIFT} - ${vars.space[6]})` },
  [REDUCED_MOTION]: { transitionDuration: '0s' },
});

const durationStyles: Record<Duration, SerializedStyles> = {
  fast: css({ transitionDuration: vars.motion.duration.fast }),
  base: css({ transitionDuration: vars.motion.duration.base }),
  slow: css({ transitionDuration: vars.motion.duration.slow }),
};

const meta = {
  title: 'Foundations/Motion',
  tags: ['dev'],
  decorators: [
    (Story) => (
      <ThemeProvider>
        <Story />
      </ThemeProvider>
    ),
  ],
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

/** Each duration token and the number Motion gets for the same token. */
export const Durations: Story = {
  render: () => {
    const [shifted, setShifted] = useState(false);
    const dot = (duration: Duration) => (
      <span data-shifted={shifted} data-duration={duration} css={[dotStyle, durationStyles[duration]]} />
    );
    return (
      <div style={{ display: 'grid', gap: vars.space[4], justifyItems: 'start' }}>
        {DURATIONS.map((duration) => (
          <div key={duration} style={rowStyle}>
            <code>{`motionDurationMs.${duration} = ${motionDurationMs[duration]}`}</code>
            <div css={trackStyle}>{dot(duration)}</div>
            <span>{`${duration} · ${base.motion.duration[duration]}`}</span>
          </div>
        ))}
        <Button tone="accent" onClick={() => setShifted((value) => !value)}>
          Move
        </Button>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const dot = (duration: Duration) => canvasElement.querySelector<HTMLElement>(`[data-duration="${duration}"]`)!;

    for (const duration of DURATIONS) {
      // The number Motion receives is the token value, and the CSS applies that same duration.
      await expect(motionDurationMs[duration]).toBe(Number.parseFloat(base.motion.duration[duration]));
      // The CSS applies the same token: computed durations come back in seconds.
      await expect(getComputedStyle(dot(duration)).transitionDuration).toBe(`${motionDurationMs[duration] / 1000}s`);
      await expect(dot(duration).dataset.shifted).toBe('false');
    }

    const before = dot('slow').getBoundingClientRect().left;
    await userEvent.click(canvas.getByRole('button', { name: 'Move' }));
    for (const duration of DURATIONS) {
      await expect(dot(duration).dataset.shifted).toBe('true');
    }
    // The move completes on the token's own schedule, with nothing waiting for a transition event.
    await waitFor(async () => {
      await expect(dot('slow').getBoundingClientRect().left).toBeGreaterThan(before + 100);
    });
  },
};

export const ReducedMotionRule: Story = {
  render: () => <span data-ui="motion-probe" css={[dotStyle, durationStyles.base]} />,
  play: async ({ canvasElement }) => {
    const probe = canvasElement.querySelector<HTMLElement>('[data-ui="motion-probe"]')!;
    const selectors = Array.from(probe.classList, (name) => `.${name}`);
    const rules = Array.from(canvasElement.ownerDocument.styleSheets)
      .flatMap((sheet) => Array.from(sheet.cssRules))
      .filter(
        (rule): rule is CSSMediaRule =>
          rule instanceof CSSMediaRule && rule.conditionText.includes('prefers-reduced-motion'),
      )
      .flatMap((rule) => Array.from(rule.cssRules))
      .filter((rule): rule is CSSStyleRule => rule instanceof CSSStyleRule);
    await expect(
      rules.some((rule) => selectors.includes(rule.selectorText) && rule.style.transitionDuration === '0s'),
    ).toBe(true);
  },
};
