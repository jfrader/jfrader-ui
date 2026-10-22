import type { Meta, StoryObj } from '@storybook/react-vite';
import { base } from '@jfrader/tokens';
import { vars } from '@jfrader/tokens/vars';
import { expect, within } from 'storybook/test';
import { css } from '../../styling/css';
import { FORCED_COLORS } from '../../styling/media';
import { customProperty, tokenPath } from './kit/model';
import { ScaleBar, TokenFamily, TokenPanel, TokenRow, tokenStyle } from './kit/primitives';
import { FIXED_SIZES, RADII, SPACE_STEPS } from './kit/space-model';

const SPACE_PREVIEW_SIZE = '48px';
const SHAPE_PREVIEW_SIZE = '44px';
const MAX_SIZE_PREVIEW = '72px';

const spacePreviewStyle = css({
  display: 'block',
  inlineSize: SPACE_PREVIEW_SIZE,
  flexShrink: 0,
});

const shapeStyle = css({
  display: 'block',
  boxSizing: 'border-box',
  flexShrink: 0,
  backgroundColor: vars.color.surfaceRaised,
  border: `1px solid ${vars.color.borderStrong}`,
  [FORCED_COLORS]: { borderColor: 'CanvasText' },
});

const radiusStyle = css({ inlineSize: SHAPE_PREVIEW_SIZE, blockSize: SHAPE_PREVIEW_SIZE });
const pillStyle = css({ blockSize: vars.space[6] });
const sizeStyle = css({
  maxInlineSize: SHAPE_PREVIEW_SIZE,
  maxBlockSize: MAX_SIZE_PREVIEW,
  borderRadius: vars.radius.sm,
});

const meta = {
  id: 'theme-spacing-and-shape',
  title: 'Theme/Spacing & shape',
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'The spacing scale, corner radii, and fixed component sizes, with their authored CSS values.',
      },
      source: {
        language: 'tsx',
        code: `import { Card, theme } from '@jfrader/ui';

<Card sx={{ padding: theme.space[4], borderRadius: theme.radius.lg }}>
  Project settings
</Card>`,
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Spacing: Story = {
  render: () => (
    <TokenPanel>
      <TokenFamily title="Space scale" blurb="Gaps between siblings come from this scale." count={SPACE_STEPS.length}>
        {SPACE_STEPS.map((doc) => (
          <TokenRow
            key={doc.key}
            preview={<span css={[spacePreviewStyle]} data-space={doc.key}><ScaleBar value={doc.value} /></span>}
            name={doc.name}
            variable={doc.variable}
            values={[{ label: 'Value', value: doc.value }]}
          />
        ))}
      </TokenFamily>
      <TokenFamily title="Radii" blurb="Corners, from tight controls to pills." count={RADII.length}>
        {RADII.map((doc) => (
          <TokenRow
            key={doc.key}
            preview={<span css={[shapeStyle, radiusStyle, doc.key === 'full' ? pillStyle : undefined, tokenStyle('borderRadius', `var(${doc.variable})`)]} aria-hidden="true" />}
            name={doc.name}
            variable={doc.variable}
            values={[{ label: 'Value', value: doc.value }]}
          />
        ))}
      </TokenFamily>
      <TokenFamily title="Fixed sizes" count={FIXED_SIZES.length}>
        {FIXED_SIZES.map((doc) => (
          <TokenRow
            key={doc.key}
            preview={/^(?:\d*\.)?\d+(?:px|rem|em|ch|vw|vh)$/.test(doc.value) ? (
              <span
                css={[
                  shapeStyle,
                  sizeStyle,
                  tokenStyle('inlineSize', `var(${doc.variable})`),
                  tokenStyle('blockSize', `var(${doc.variable})`),
                ]}
                aria-hidden="true"
              />
            ) : <span aria-hidden="true" />}
            name={doc.name}
            variable={doc.variable}
            description={doc.description}
            values={[{ label: 'Value', value: doc.value }]}
          />
        ))}
      </TokenFamily>
    </TokenPanel>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const groups = [base.space, base.radius, base.size];
    await expect(canvas.getAllByRole('listitem')).toHaveLength(groups.reduce((total, group) => total + Object.keys(group).length, 0));
    for (const [group, tokens] of Object.entries({ space: base.space, radius: base.radius, size: base.size })) {
      for (const [key, value] of Object.entries(tokens)) {
        const name = group === 'space' ? `${tokenPath(group)}[${key}]` : tokenPath(group, key);
        const row = canvas.getByText(name).closest('li');
        if (!row) throw new Error(`Missing row for ${name}`);
        await expect(within(row).getByText(customProperty(group, key))).toBeVisible();
        await expect(within(row).getByText(value)).toBeVisible();
        await expect(row.querySelectorAll('dd')).toHaveLength(1);
      }
    }
    const bar = canvasElement.querySelector<HTMLElement>('[data-space="12"] > span');
    if (!bar) throw new Error('Missing space scale bar');
    await expect(getComputedStyle(bar).inlineSize).toBe(base.space[12]);
  },
};
