import type { Meta, StoryObj } from '@storybook/react-vite';
import { base } from '@jfrader/tokens';
import { vars } from '@jfrader/tokens/vars';
import { expect, within } from 'storybook/test';
import { css } from '../../styling/css';
import { FORCED_COLORS } from '../../styling/media';
import { TokenFamily, TokenPanel, TokenRow } from './kit/primitives';
import { customProperty } from './kit/model';
import { TYPE_FAMILIES, typeTokenPath, type TypeTokenDoc } from './kit/type-model';

const referenceStyle = css({
  '& li': { gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr) minmax(0, 19rem)' },
  '& li > span': { justifyContent: 'start', minInlineSize: 0 },
  '@media (max-width: 900px)': {
    '& li': { gridTemplateColumns: 'minmax(0, 1fr)' },
    '& li > dl': { gridColumn: '1' },
  },
});

const specimenStyle = css({
  display: 'block',
  minInlineSize: 0,
  maxInlineSize: '100%',
  overflowWrap: 'anywhere',
  lineHeight: vars.lineHeight.base,
});
const familyStyle = css({ fontSize: '20px' });
const weightStyle = css({ fontSize: '18px' });
const leadingStyle = css({ maxInlineSize: '34ch', fontSize: vars.textSize.sm });
const trackingStyle = css({ fontSize: vars.textSize.sm });
const ruleStyle = css({
  inlineSize: '100%',
  borderBlockStartStyle: 'solid',
  borderBlockStartColor: vars.color.borderStrong,
  [FORCED_COLORS]: { borderBlockStartColor: 'CanvasText' },
});

function Specimen({ doc }: { doc: TypeTokenDoc }) {
  const value = `var(${customProperty(...doc.path)})`;
  if (doc.specimen === 'none') return null;
  if (doc.specimen === 'rule') return <span css={ruleStyle} style={{ borderBlockStartWidth: value }} aria-hidden="true" />;
  if (doc.specimen === 'family') return <span css={[specimenStyle, familyStyle]} style={{ fontFamily: value }}>The next chapter starts here.</span>;
  if (doc.specimen === 'weight') return <span css={[specimenStyle, weightStyle]} style={{ fontWeight: value }}>Save changes</span>;
  if (doc.specimen === 'leading') return <span css={[specimenStyle, leadingStyle]} style={{ lineHeight: value }}>A chapter begins.<br />The story continues.<br />Turn another page.</span>;
  if (doc.specimen === 'tracking') return <span css={[specimenStyle, trackingStyle]} style={{ letterSpacing: value }}>FIELD NOTES</span>;
  return <span css={specimenStyle} data-type-size="" style={{ fontSize: value }}>{doc.path[0] === 'editorial' ? 'The next chapter starts here.' : 'Save changes'}</span>;
}

const meta = {
  title: 'Theme/Typography',
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: { component: 'Font families, text sizes, weights, and line heights from the token source, with specimens and authored values. The editorial scale includes responsive headlines and reading-layout tokens.' },
      source: {
        language: 'tsx',
        code: `import { styled } from '@jfrader/ui';

const Paragraph = styled('p')(({ theme }) => ({
  fontFamily: theme.font.sans,
  fontSize: theme.textSize.lg,
  lineHeight: theme.lineHeight.relaxed,
}));

<Paragraph>The next chapter starts here.</Paragraph>`,
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Typography: Story = {
  render: () => (
    <TokenPanel>
      <div css={referenceStyle}>
        {TYPE_FAMILIES.map((family) => (
          <TokenFamily key={family.title} title={family.title} blurb={family.blurb} count={family.tokens.length}>
            {family.tokens.map((doc) => (
              <TokenRow
                key={typeTokenPath(doc.path)}
                name={typeTokenPath(doc.path)}
                variable={customProperty(...doc.path)}
                description={doc.description}
                preview={<Specimen doc={doc} />}
                values={[{ label: doc.specimen === 'family' ? 'Stack' : 'Value', value: doc.value }]}
              />
            ))}
          </TokenFamily>
        ))}
      </div>
    </TokenPanel>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const [group, source] of Object.entries({ font: base.font, textSize: base.textSize, fontWeight: base.fontWeight, lineHeight: base.lineHeight })) {
      for (const [key, value] of Object.entries(source)) {
        const row = canvas.getByText(typeTokenPath([group, key])).closest('li');
        if (!row) throw new Error(`Missing row for ${typeTokenPath([group, key])}`);
        await expect(within(row).getByText(value)).toBeVisible();
      }
    }
    await expect(canvasElement.querySelectorAll('li')).toHaveLength(TYPE_FAMILIES.reduce((total, family) => total + family.tokens.length, 0));
    const specimen = canvas.getByText(typeTokenPath(['textSize', 'lg'])).closest('li')?.querySelector('[data-type-size]');
    if (!specimen) throw new Error('Missing size specimen');
    const rootSize = Number.parseFloat(getComputedStyle(canvasElement.ownerDocument.documentElement).fontSize);
    await expect(Number.parseFloat(getComputedStyle(specimen).fontSize)).toBeCloseTo(Number.parseFloat(base.textSize.lg) * rootSize);
    await expect(canvasElement.ownerDocument.documentElement.scrollWidth).toBeLessThanOrEqual(canvasElement.ownerDocument.documentElement.clientWidth);
  },
};
