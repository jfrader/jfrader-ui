import type { Meta, StoryObj } from '@storybook/react-vite';
import { base } from '@jfrader/tokens';
import { vars } from '@jfrader/tokens/vars';
import { expect, within } from 'storybook/test';
import { css, keyframes } from '../../styling/css';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import { customProperty, tokenPath } from './kit/model';
import { CARD_MATERIAL_TOKENS, DURATION_FAMILIES, EASING_TOKENS, LAYER_TOKENS, SHADOW_TOKENS } from './kit/motion-model';
import { TokenFamily, TokenPanel, TokenRow, tokenStyle } from './kit/primitives';

const referenceStyle = css({
  '& li': {
    gridTemplateColumns: '112px minmax(0, 1fr) minmax(0, 19rem)',
    '@media (max-width: 900px)': { gridTemplateColumns: '112px minmax(0, 1fr)' },
  },
  '& dl': { '@media (max-width: 640px)': { gridColumn: '1 / -1' } },
  '& dd': { marginInlineStart: 0 },
});

const elevationStyle = css({
  display: 'block',
  boxSizing: 'border-box',
  inlineSize: '96px',
  blockSize: '64px',
  marginBlock: vars.space[3],
  borderRadius: vars.radius.md,
  backgroundColor: vars.color.surfaceRaised,
  border: `1px solid ${vars.color.borderSubtle}`,
  [FORCED_COLORS]: { borderColor: 'CanvasText', boxShadow: 'none !important' },
});

const slide = keyframes({
  from: { transform: 'translateX(0)' },
  to: { transform: `translateX(calc(96px - ${vars.space[4]}))` },
});

const trackStyle = css({
  display: 'block',
  inlineSize: '96px',
  blockSize: vars.space[4],
  borderRadius: vars.radius.sm,
  backgroundColor: vars.color.surfaceInset,
  outline: `1px solid ${vars.color.borderStrong}`,
  [FORCED_COLORS]: { outlineColor: 'CanvasText' },
});

const squareStyle = css({
  display: 'block',
  inlineSize: vars.space[4],
  blockSize: vars.space[4],
  borderRadius: 0,
  backgroundColor: vars.color.accent,
  animationName: slide,
  animationDuration: vars.motion.duration.presence,
  animationTimingFunction: vars.motion.easeStandard,
  animationIterationCount: 'infinite',
  animationDirection: 'alternate',
  [REDUCED_MOTION]: {
    animation: 'none',
    transform: `translateX(calc(96px - ${vars.space[4]}))`,
  },
  [FORCED_COLORS]: { backgroundColor: 'Highlight' },
});

function SlidePreview({ duration, easing }: { duration?: string; easing?: string }) {
  return (
    <span css={[trackStyle]} aria-hidden="true">
      <span
        css={[
          squareStyle,
          duration ? tokenStyle('animationDuration', duration) : undefined,
          easing ? tokenStyle('animationTimingFunction', easing) : undefined,
        ]}
        data-motion-square=""
      />
    </span>
  );
}

const meta = {
  id: 'theme-elevation-and-motion',
  title: 'Theme/Elevation & motion',
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Shadows, durations, easing curves, playing-card material, and stacking tokens. Motion specimens stop at their end position when reduced motion is enabled.',
      },
      source: {
        language: 'tsx',
        code: `import { Card, styled, theme } from '@jfrader/ui';

const FloatingCard = styled(Card)({
  boxShadow: theme.shadow.floating,
  transitionProperty: 'box-shadow',
  transitionDuration: theme.motion.duration.base,
  '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
});

<FloatingCard>Project settings</FloatingCard>`,
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Elevation: Story = {
  render: () => (
    <TokenPanel>
      <div css={[referenceStyle]}>
        <TokenFamily title="Shadows" blurb="Raised surfaces, overlays, floating panels, and cards in flight." count={SHADOW_TOKENS.length}>
          {SHADOW_TOKENS.map(({ role, values }) => (
            <TokenRow
              key={role}
              preview={<span css={[elevationStyle, tokenStyle('boxShadow', `var(${customProperty('shadow', role)})`)]} aria-hidden="true" />}
              name={tokenPath('shadow', role)}
              variable={customProperty('shadow', role)}
              values={values}
            />
          ))}
        </TokenFamily>
        {DURATION_FAMILIES.map((family) => (
          <TokenFamily key={family.title} title={family.title} blurb={family.blurb} count={family.roles.length}>
            {family.roles.map((role) => (
              <TokenRow
                key={role}
                preview={<SlidePreview duration={vars.motion.duration[role]} />}
                name={tokenPath('motion', 'duration', role)}
                variable={customProperty('motion', 'duration', role)}
                values={[{ label: 'Value', value: base.motion.duration[role] }]}
              />
            ))}
          </TokenFamily>
        ))}
        <TokenFamily title="Easings" blurb="Each curve moves the same distance over the presence duration." count={EASING_TOKENS.length}>
          {EASING_TOKENS.map(({ role, value }) => (
            <TokenRow
              key={role}
              preview={<SlidePreview easing={`var(${customProperty('motion', role)})`} />}
              name={tokenPath('motion', role)}
              variable={customProperty('motion', role)}
              values={[{ label: 'Value', value }]}
            />
          ))}
        </TokenFamily>
        <TokenFamily title="Card material" blurb="Blur, tilt, and perspective define the playing-card surface." count={CARD_MATERIAL_TOKENS.length}>
          {CARD_MATERIAL_TOKENS.map(({ role, value }) => (
            <TokenRow key={role} preview={null} name={tokenPath('cardMaterial', role)} variable={customProperty('cardMaterial', role)} values={[{ label: 'Value', value }]} />
          ))}
        </TokenFamily>
        <TokenFamily title="Layering" blurb="Cards in flight use this stacking level above the table." count={LAYER_TOKENS.length}>
          {LAYER_TOKENS.map(({ role, value }) => (
            <TokenRow key={role} preview={null} name={tokenPath('zIndex', role)} variable={customProperty('zIndex', role)} values={[{ label: 'Value', value }]} />
          ))}
        </TokenFamily>
      </div>
    </TokenPanel>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const paths = [
      ...Object.keys(base.shadow).map((role) => tokenPath('shadow', role)),
      ...Object.keys(base.motion.duration).map((role) => tokenPath('motion', 'duration', role)),
      ...Object.keys(base.motion).filter((role) => role !== 'duration').map((role) => tokenPath('motion', role)),
      ...Object.keys(base.cardMaterial).map((role) => tokenPath('cardMaterial', role)),
      ...Object.keys(base.zIndex).map((role) => tokenPath('zIndex', role)),
    ];
    await expect(canvas.getAllByRole('listitem')).toHaveLength(paths.length);
    for (const path of paths) {
      const row = canvas.getByText(path).closest('li');
      await expect(row).not.toBeNull();
      await expect(row?.querySelector('dd')).not.toBeNull();
    }
    await expect(canvasElement.ownerDocument.documentElement.scrollWidth).toBeLessThanOrEqual(canvasElement.ownerDocument.documentElement.clientWidth);
  },
};
