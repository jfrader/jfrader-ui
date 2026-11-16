import type { ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { base } from '@jfrader/tokens';
import { vars } from '@jfrader/tokens/vars';
import { expect, within } from 'storybook/test';
import { css } from '../../styling/css';
import { FORCED_COLORS } from '../../styling/media';
import { createTheme, themeTokenStyle, type ThemeTokens } from '../../styling/create-theme';
import { Button } from '../button';
import { Card } from '../card';
import { ThemeRoot } from '../theme-root';
import { OVERRIDE_GROUPS, type OverrideGroupName, type OverrideToken } from './kit/overrides-model';
import { RadiusSpecimen, ScaleBar, Swatch, TokenFamily, TokenPanel, TokenRow, shapeStyle, tokenStyle, type TokenValue } from './kit/primitives';

const PREVIEW_SIZE = '56px';

const referenceStyle = css({
  '& li': {
    gridTemplateColumns: `${PREVIEW_SIZE} minmax(0, 1fr) minmax(0, 19rem)`,
    '@media (max-width: 900px)': { gridTemplateColumns: `${PREVIEW_SIZE} minmax(0, 1fr)` },
  },
});

const barPreviewStyle = css({ display: 'block', inlineSize: '100%' });

const shadowPreviewStyle = css({
  inlineSize: '2rem',
  blockSize: '2rem',
  borderRadius: vars.radius.sm,
  [FORCED_COLORS]: { boxShadow: 'none !important' },
});

const letterPreviewStyle = css({ lineHeight: 1, whiteSpace: 'nowrap' });

type Preview = (token: OverrideToken) => ReactNode;

function letters(property: 'fontSize' | 'fontWeight' | 'fontFamily'): Preview {
  return ({ variable }) => (
    <span css={[letterPreviewStyle, tokenStyle(property, `var(${variable})`)]} aria-hidden="true">
      Aa
    </span>
  );
}

/** Groups whose value draws something; every other row shows its authored value only. */
const PREVIEWS: Partial<Record<OverrideGroupName, Preview>> = {
  color: ({ key, variable, value }) => <Swatch token={variable} value={value} label={`${key} swatch`} />,
  radius: ({ key, variable }) => <RadiusSpecimen variable={variable} pill={key === 'full'} />,
  space: ({ variable }) => (
    <span css={barPreviewStyle}>
      <ScaleBar value={`var(${variable})`} />
    </span>
  ),
  textSize: letters('fontSize'),
  fontWeight: letters('fontWeight'),
  font: letters('fontFamily'),
  shadow: ({ variable }) => (
    <span css={[shapeStyle, shadowPreviewStyle, tokenStyle('boxShadow', `var(${variable})`)]} aria-hidden="true" />
  ),
};

function valuesOf({ value, lightValue }: OverrideToken): TokenValue[] {
  return lightValue === undefined
    ? [{ label: 'Value', value }]
    : [
        { label: 'Dark', value },
        { label: 'Light', value: lightValue },
      ];
}

const meta = {
  id: 'theme-token-overrides',
  title: 'Theme/Token overrides',
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'An override replaces one token value inside a theme scope. Every token a map leaves out keeps the base theme value.',
      },
      usage: `Set overrides in one of three ways:

- \`createTheme({ tokens })\` merges the map over a derived accent family.
- \`ThemeRoot tokens\` applies the map to a subtree and the overlays opened inside it.
- \`themeTokenStyle(map)\` returns the custom-property declarations for a stylesheet.

Each row is one path a map may set, the custom property it writes, and its default. The [Theming guide](./?path=/docs/foundations-theming--docs) covers nested roots, portals, and CSS ordering.`,
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const COMPACT_ACCENT = '#0f766e';
const COMPACT_RADIUS = '0.25rem';

const compactTheme = createTheme({
  base: 'light',
  accent: COMPACT_ACCENT,
  tokens: { radius: { md: COMPACT_RADIUS }, space: { 4: '0.875rem' } },
});

export const CompactTheme: Story = {
  render: () => (
    <ThemeRoot theme="light" tokens={compactTheme}>
      <Card>
        <Card.Header>
          <Card.Title>Project settings</Card.Title>
        </Card.Header>
        <Card.Footer>
          <Button tone="accent">Save</Button>
        </Card.Footer>
      </Card>
    </ThemeRoot>
  ),
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { Button, Card, createTheme, ThemeRoot } from '@jfrader/ui';

const compact = createTheme({
  base: 'light',
  accent: '${COMPACT_ACCENT}',
  tokens: {
    radius: { md: '${COMPACT_RADIUS}' },
    space: { 4: '0.875rem' },
  },
});

<ThemeRoot theme="light" tokens={compact}>
  <Card>
    <Card.Header>
      <Card.Title>Project settings</Card.Title>
    </Card.Header>
    <Card.Footer>
      <Button tone="accent">Save</Button>
    </Card.Footer>
  </Card>
</ThemeRoot>`,
      },
    },
  },
  play: async ({ canvasElement }) => {
    const save = within(canvasElement).getByRole('button', { name: 'Save' });
    const rootSize = Number.parseFloat(getComputedStyle(canvasElement.ownerDocument.documentElement).fontSize);
    await expect(Number.parseFloat(getComputedStyle(save).borderTopLeftRadius)).toBeCloseTo(
      Number.parseFloat(COMPACT_RADIUS) * rootSize,
    );
    await expect(getComputedStyle(save).backgroundColor).toBe('rgb(15, 118, 110)');
  },
};

export const TokenOverrides: Story = {
  render: () => (
    <TokenPanel>
      <div css={referenceStyle}>
        {OVERRIDE_GROUPS.map((group) => {
          const preview = PREVIEWS[group.name];
          return (
            <TokenFamily key={group.name} title={group.title} blurb={group.summary} count={group.tokens.length}>
              {group.tokens.map((token) => (
                <TokenRow
                  key={token.key}
                  preview={preview ? preview(token) : null}
                  name={`${group.name}.${token.key}`}
                  variable={token.variable}
                  values={valuesOf(token)}
                />
              ))}
            </TokenFamily>
          );
        })}
      </div>
    </TokenPanel>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Paths are read from the token source and the property each one writes from `themeTokenStyle`,
    // not from the model the page renders, so a new token without a row fails here.
    const paths = (tree: object, prefix: readonly string[] = []): string[][] =>
      Object.entries(tree).flatMap(([key, value]) =>
        typeof value === 'string' ? [[...prefix, key]] : paths(value as object, [...prefix, key]),
      );
    const sourcePaths = paths(base);
    await expect(canvasElement.querySelectorAll('li')).toHaveLength(sourcePaths.length);
    for (const path of sourcePaths) {
      const name = path.join('.');
      const rows = canvas.getAllByText(name, { selector: 'li p' });
      await expect(rows, `rows for ${name}`).toHaveLength(1);
      const map = path.reduceRight<unknown>((inner, key) => ({ [key]: inner }), 'initial') as ThemeTokens;
      const [property] = Object.keys(themeTokenStyle(map));
      await expect(within(rows[0]!.closest('li')!).getByText(property!)).toBeVisible();
    }

    // A swatch paints through its custom property: overriding the property repaints it, and it never
    // takes the panel color.
    const fillOf = (name: string) =>
      canvas.getByText(name).closest('li')?.querySelector<HTMLElement>('[data-swatch]') as HTMLElement;
    const accent = fillOf('color.accent');
    const scope = accent.closest('ul') as HTMLElement;
    await expect(getComputedStyle(fillOf('color.text')).backgroundColor).not.toBe(
      getComputedStyle(fillOf('color.bg')).backgroundColor,
    );
    const override = 'rgb(1, 2, 3)';
    const declarations = Object.entries(themeTokenStyle({ color: { accent: override } }));
    for (const [property, value] of declarations) scope.style.setProperty(property, String(value));
    await expect(getComputedStyle(accent).backgroundColor).toBe(override);
    for (const [property] of declarations) scope.style.removeProperty(property);

    await expect(canvasElement.ownerDocument.documentElement.scrollWidth).toBeLessThanOrEqual(
      canvasElement.ownerDocument.documentElement.clientWidth,
    );
  },
};
