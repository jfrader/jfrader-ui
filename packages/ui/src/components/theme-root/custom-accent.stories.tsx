import type { CSSProperties } from 'react';
import { useState } from 'react';
import { renderToString } from 'react-dom/server';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { Button } from '../button';
import { Card } from '../card';
import { Pill } from '../pill';
import { TextField } from '../text-field';
import { Tooltip } from '../tooltip';
import { createTheme, ThemeRoot, type ThemeName, type ThemeTokens } from './index';

/** Accents the derived accent contrast is measured against. */
const TEST_ACCENTS = {
  violet: '#a78bff',
  red: '#e5484d',
  yellow: '#f5d90a',
  nearBlack: '#111111',
  white: '#ffffff',
} as const;

/** Differs from the stock dark palette in every accent role, so each derived value is observable. */
const OCEAN = '#2f5bd3';

const HEADER_ACCENT = TEST_ACCENTS.yellow;

const HEADER_THEMES = {
  dark: createTheme({ accent: HEADER_ACCENT }),
  light: createTheme({ base: 'light', accent: HEADER_ACCENT }),
} satisfies Record<ThemeName, ThemeTokens>;

const ACCENT_ROLES = [
  'accent',
  'accentHover',
  'accentText',
  'accentSoft',
  'accentSoftHover',
  'accentBorder',
  'accentContrast',
  'focusRing',
] as const satisfies readonly (keyof typeof vars.color)[];

const THEMES = ['dark', 'light'] as const satisfies readonly ThemeName[];

// Compile-time: `pnpm typecheck` fails if any of these is accepted.
const REJECTED_TOKENS: ThemeTokens[] = [
  // @ts-expect-error -- `accentHovr` is not a palette role.
  { color: { accentHovr: TEST_ACCENTS.red } },
  // @ts-expect-error -- `colour` is not a token group.
  { colour: { accent: TEST_ACCENTS.red } },
  // @ts-expect-error -- token values are CSS strings.
  { radius: { md: 12 } },
];

const ACCEPTED_TOKENS = {
  color: { accent: OCEAN, accentContrast: TEST_ACCENTS.white },
  radius: { md: vars.radius.lg },
} satisfies ThemeTokens;

const scopeStyle = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'end',
  gap: vars.space[3],
  padding: vars.space[4],
  borderRadius: vars.radius.lg,
  backgroundColor: vars.color.surface,
} satisfies CSSProperties;

const columnStyle = { ...scopeStyle, flexDirection: 'column' } satisfies CSSProperties;

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, auto)',
  gap: vars.space[3],
} satisfies CSSProperties;

const accentTextStyle = { color: vars.color.accentText } satisfies CSSProperties;

/** `var(--ui-color-accent)` → `--ui-color-accent`. */
const propertyName = (reference: string) => reference.slice('var('.length, -1);

/** The color `value` computes to on a throwaway probe inside `host` (so `var()` resolves there). */
function resolveColor(host: Element, value: string) {
  const probe = host.ownerDocument.createElement('span');
  probe.style.color = value;
  host.append(probe);
  const color = getComputedStyle(probe).color;
  probe.remove();
  return color;
}

/** `reference` resolved in the stock `theme` palette, on a throwaway themed host. */
function stockColor(document: Document, theme: ThemeName, reference: string) {
  const host = document.createElement('div');
  host.dataset.theme = theme;
  document.body.append(host);
  const color = resolveColor(host, reference);
  host.remove();
  return color;
}

/** WCAG 2 relative luminance of a CSS color as a canvas paints it in sRGB. */
function luminance(document: Document, color: string) {
  const context = document.createElement('canvas').getContext('2d')!;
  context.fillStyle = color;
  context.fillRect(0, 0, 1, 1);
  return Array.from(context.getImageData(0, 0, 1, 1).data)
    .slice(0, 3)
    .map((channel) => {
      const value = channel / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    })
    .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index]!, 0);
}

function contrastRatio(document: Document, first: string, second: string) {
  const a = luminance(document, first);
  const b = luminance(document, second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** Parses server markup off-document and returns its ThemeRoot element. */
function serverRoot(document: Document, markup: string) {
  const host = document.createElement('div');
  host.innerHTML = markup;
  return host.querySelector<HTMLElement>('[data-ui="theme-root"]')!;
}

function IsolationExample() {
  const [showRed, setShowRed] = useState(true);
  return (
    <ThemeRoot tokens={HEADER_THEMES.dark} data-testid="outer" style={columnStyle}>
      <ThemeRoot tokens={createTheme({ accent: OCEAN })} data-testid="ocean" style={scopeStyle}>
        <Pill tone="neutral">Ocean scope</Pill>
      </ThemeRoot>
      {showRed && (
        <ThemeRoot tokens={createTheme({ accent: TEST_ACCENTS.red })} data-testid="red" style={scopeStyle}>
          <Pill tone="neutral">Red scope</Pill>
        </ThemeRoot>
      )}
      <ThemeRoot data-testid="carried" style={scopeStyle}>
        <Pill tone="neutral">Same theme, no tokens</Pill>
      </ThemeRoot>
      <ThemeRoot theme="light" data-testid="dropped" style={scopeStyle}>
        <Pill tone="neutral">Light theme, no tokens</Pill>
      </ThemeRoot>
      <Card appearance="contrast" data-testid="contrast-card">
        Contrast card
      </Card>
      <Button onClick={() => setShowRed(false)}>Remove red scope</Button>
    </ThemeRoot>
  );
}
IsolationExample.displayName = 'IsolationExample';

const meta = {
  title: 'Theming/Custom accent',
  component: ThemeRoot,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Set an accent color for a section of your app.',
      },
      usage: `### Setup
- Call \`createTheme({ base, accent, tokens })\` to derive an accent family for the \`dark\` or \`light\` base.
- Pass the result to \`ThemeRoot\` as \`tokens\`, with \`theme\` matching \`base\`.
- Explicit \`tokens\` override derived values.

### Contrast
- Check text and focus-ring contrast with your chosen accent. Some colors need explicit overrides.
- See [Custom palettes](https://github.com/jfrader/jfrader-ui/blob/master/docs/consuming-jfrader-ui.md#custom-palettes) for color formats, contrast limits, and document-level themes.`,
    },
  },
  args: { theme: 'dark' },
  argTypes: {
    theme: { control: 'radio', options: THEMES },
  },
  render: ({ theme = 'dark', ...args }) => (
    <ThemeRoot {...args} theme={theme} tokens={HEADER_THEMES[theme]} data-testid="scope" style={scopeStyle}>
      <Pill tone="accent">Beta</Pill>
      <TextField label="Search" placeholder="Projects, people…" />
      <Tooltip defaultOpen placement="bottom">
        <Tooltip.Trigger>Shortcuts</Tooltip.Trigger>
        <Tooltip.Content>Press ? to list them</Tooltip.Content>
      </Tooltip>
      <Button tone="accent">New project</Button>
    </ThemeRoot>
  ),
} satisfies Meta<typeof ThemeRoot>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Dark: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const scope = canvas.getByTestId('scope');
    const derived = HEADER_THEMES[args.theme ?? 'dark'].color!;
    for (const role of ACCENT_ROLES) {
      const value = getComputedStyle(scope).getPropertyValue(propertyName(vars.color[role])).trim();
      await expect(value).not.toBe('');
      await expect(resolveColor(scope, value)).toBe(resolveColor(scope, derived[role]!));
    }
    await expect(getComputedStyle(canvas.getByRole('button', { name: 'New project' })).backgroundColor).toBe(
      resolveColor(scope, HEADER_ACCENT),
    );
    // The tooltip portals to the body and keeps the scope's tokens there.
    const tooltip = await within(canvasElement.ownerDocument.body).findByRole('tooltip');
    await expect(canvasElement.contains(tooltip)).toBe(false);
    await expect(resolveColor(tooltip, vars.color.accent)).toBe(resolveColor(scope, HEADER_ACCENT));
    await expect(resolveColor(tooltip, vars.color.accentText)).toBe(resolveColor(scope, derived.accentText!));
  },
};

export const Light: Story = {
  ...Dark,
  args: { theme: 'light' },
};

export const Derivation: Story = {
  render: () => (
    <ThemeRoot tokens={createTheme({ accent: OCEAN })} data-testid="scope" style={scopeStyle}>
      <Button tone="accent">Deploy</Button>
    </ThemeRoot>
  ),
  play: async ({ canvasElement }) => {
    const scope = within(canvasElement).getByTestId('scope');
    const derived = createTheme({ accent: OCEAN }).color!;
    for (const role of ACCENT_ROLES) {
      const value = getComputedStyle(scope).getPropertyValue(propertyName(vars.color[role])).trim();
      await expect(value).not.toBe('');
      await expect(resolveColor(scope, value)).toBe(resolveColor(scope, derived[role]!));
      await expect(resolveColor(scope, value)).not.toBe(stockColor(canvasElement.ownerDocument, 'dark', vars.color[role]));
    }
  },
};

export const AccentContrast: Story = {
  render: () => (
    <div style={gridStyle}>
      {Object.entries(TEST_ACCENTS).flatMap(([name, accent]) =>
        THEMES.map((theme) => (
          <ThemeRoot
            key={`${name}-${theme}`}
            theme={theme}
            tokens={createTheme({ base: theme, accent })}
            data-testid="swatch"
            style={scopeStyle}
          >
            <Button tone="accent">{`${name} ${theme}`}</Button>
            {theme === 'light' && <span style={accentTextStyle}>{`${name} text`}</span>}
          </ThemeRoot>
        )),
      )}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const { ownerDocument } = canvasElement;
    const swatches = within(canvasElement).getAllByTestId('swatch');
    await expect(swatches).toHaveLength(Object.keys(TEST_ACCENTS).length * THEMES.length);
    for (const swatch of swatches) {
      // Text on the accent fill, measured from the rendered pixels.
      const button = within(swatch).getByRole('button');
      const { color, backgroundColor } = getComputedStyle(button);
      await expect(contrastRatio(ownerDocument, color, backgroundColor)).toBeGreaterThanOrEqual(4.5);
      if (swatch.dataset.theme !== 'light') continue;
      // Accent as text on the light surface.
      const text = within(swatch).getByText(/ text$/);
      const surface = getComputedStyle(swatch).backgroundColor;
      await expect(contrastRatio(ownerDocument, getComputedStyle(text).color, surface)).toBeGreaterThanOrEqual(4.5);
    }
  },
};

const PRECEDENCE_SCOPES = {
  explicit: { theme: 'dark', tokens: createTheme({ accent: OCEAN, tokens: { color: { accentHover: TEST_ACCENTS.red } } }) },
  dark: { theme: 'dark', tokens: createTheme({ accent: OCEAN }) },
  light: { theme: 'light', tokens: createTheme({ base: 'light', accent: OCEAN }) },
} satisfies Record<string, { theme: ThemeName; tokens: ThemeTokens }>;

export const Precedence: Story = {
  render: () => (
    <div style={gridStyle}>
      {Object.entries(PRECEDENCE_SCOPES).map(([id, { theme, tokens }]) => (
        <ThemeRoot key={id} theme={theme} tokens={tokens} data-testid={id} style={scopeStyle}>
          <Button tone="accent">{`Deploy (${id})`}</Button>
        </ThemeRoot>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const { ownerDocument } = canvasElement;
    const canvas = within(canvasElement);
    const explicit = canvas.getByTestId('explicit');
    const dark = canvas.getByTestId('dark');
    const light = canvas.getByTestId('light');
    const darkDerived = PRECEDENCE_SCOPES.dark.tokens.color!;
    const lightDerived = PRECEDENCE_SCOPES.light.tokens.color!;

    // Explicit tokens beat the derived value; the roles they leave out stay derived.
    await expect(resolveColor(explicit, vars.color.accentHover)).toBe(resolveColor(explicit, TEST_ACCENTS.red));
    await expect(resolveColor(explicit, vars.color.accentSoft)).toBe(resolveColor(explicit, darkDerived.accentSoft!));

    // `base: 'light'` derives the light variants: hover darkens instead of lightening.
    await expect(resolveColor(dark, vars.color.accentHover)).toBe(resolveColor(dark, darkDerived.accentHover!));
    await expect(resolveColor(light, vars.color.accentHover)).toBe(resolveColor(light, lightDerived.accentHover!));
    await expect(resolveColor(light, vars.color.accentHover)).not.toBe(resolveColor(dark, vars.color.accentHover));
    const accentLuminance = luminance(ownerDocument, resolveColor(dark, vars.color.accent));
    await expect(luminance(ownerDocument, resolveColor(dark, vars.color.accentHover))).toBeGreaterThan(accentLuminance);
    await expect(luminance(ownerDocument, resolveColor(light, vars.color.accentHover))).toBeLessThan(accentLuminance);

    // Roles outside the accent family keep the named theme's own values.
    await expect(resolveColor(light, vars.color.surface)).toBe(stockColor(ownerDocument, 'light', vars.color.surface));
  },
};

export const Isolation: Story = {
  render: () => <IsolationExample />,
  play: async ({ canvasElement }) => {
    const { ownerDocument } = canvasElement;
    const canvas = within(canvasElement);
    const accentOf = (id: string) => resolveColor(canvas.getByTestId(id), vars.color.accent);
    const outer = canvas.getByTestId('outer');
    const yellow = resolveColor(outer, TEST_ACCENTS.yellow);

    // Siblings keep their own accents and neither leaks into the outer scope.
    await expect(accentOf('ocean')).toBe(resolveColor(outer, OCEAN));
    await expect(accentOf('red')).toBe(resolveColor(outer, TEST_ACCENTS.red));
    await expect(accentOf('outer')).toBe(yellow);
    // A same-theme root and a contrast surface keep the outer tokens; another theme drops them.
    await expect(accentOf('carried')).toBe(yellow);
    await expect(accentOf('contrast-card')).toBe(yellow);
    await expect(accentOf('dropped')).toBe(stockColor(ownerDocument, 'light', vars.color.accent));

    await userEvent.click(canvas.getByRole('button', { name: 'Remove red scope' }));
    await waitFor(() => expect(canvas.queryByTestId('red')).toBeNull());
    await expect(accentOf('outer')).toBe(yellow);
    await expect(accentOf('ocean')).toBe(resolveColor(outer, OCEAN));
  },
};

export const ServerMarkup: Story = {
  render: () => (
    <ThemeRoot tokens={createTheme({ accent: TEST_ACCENTS.red })} style={scopeStyle}>
      <Button tone="accent">Save</Button>
    </ThemeRoot>
  ),
  play: async ({ canvasElement }) => {
    const { ownerDocument } = canvasElement;
    const tokens = createTheme({ accent: TEST_ACCENTS.red });
    const root = serverRoot(ownerDocument, renderToString(<ThemeRoot tokens={tokens} />));
    // The scope's custom properties ship in the server markup, before any client script runs.
    for (const role of ACCENT_ROLES) {
      await expect(root.style.getPropertyValue(propertyName(vars.color[role]))).toBe(tokens.color![role]);
    }
    const plain = serverRoot(ownerDocument, renderToString(<ThemeRoot />));
    await expect(plain.hasAttribute('style')).toBe(false);
  },
};

export const TokenTyping: Story = {
  render: () => (
    <ThemeRoot tokens={ACCEPTED_TOKENS} style={scopeStyle}>
      <Button tone="accent">Typed tokens</Button>
    </ThemeRoot>
  ),
  play: async ({ canvasElement }) => {
    const { ownerDocument } = canvasElement;
    const accepted = serverRoot(ownerDocument, renderToString(<ThemeRoot tokens={ACCEPTED_TOKENS} />));
    await expect(accepted.style.getPropertyValue(propertyName(vars.color.accent))).toBe(OCEAN);
    await expect(accepted.style.getPropertyValue(propertyName(vars.radius.md))).toBe(vars.radius.lg);
    // Paths the types reject declare nothing at runtime either.
    for (const tokens of REJECTED_TOKENS) {
      const root = serverRoot(ownerDocument, renderToString(<ThemeRoot tokens={tokens} />));
      await expect(root.hasAttribute('style')).toBe(false);
    }
  },
};
