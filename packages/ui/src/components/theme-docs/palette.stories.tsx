import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { Swatch, TokenFamily, TokenPanel, TokenRow, type TokenValue } from './kit/primitives';
import {
  COLOR_FAMILIES,
  TOKEN_MODES,
  colorValue,
  contrastBetween,
  customProperty,
  tokenPath,
  type ColorRoleDoc,
  type TokenMode,
} from './kit/model';

const TOTAL_ROLES = COLOR_FAMILIES.reduce((total, family) => total + family.roles.length, 0);

const modeLabel: Record<TokenMode, string> = { dark: 'Dark', light: 'Light' };

function ColorToken({ doc }: { doc: ColorRoleDoc }) {
  const values: TokenValue[] = TOKEN_MODES.map((mode) => {
    const value = colorValue(mode, doc.role);
    return {
      label: modeLabel[mode],
      value,
      contrast: doc.contrast ? contrastBetween(value, colorValue(mode, doc.contrast.against), doc.contrast.min) : null,
    };
  });

  return (
    <TokenRow
      preview={<Swatch token={customProperty('color', doc.role)} label={`${doc.role} swatch`} />}
      name={tokenPath('color', doc.role)}
      variable={customProperty('color', doc.role)}
      description={doc.summary}
      values={values}
    />
  );
}

const meta = {
  title: 'Theme/Palette',
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Every color role in the system, with the value it takes on each palette. Rows are read from the token source, so the swatch, the CSS custom property and both authored values always describe the same thing.',
      },
      source: {
        language: 'tsx',
        code: `import { Button, Card } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

<Card sx={{ backgroundColor: vars.color.surface, borderColor: vars.color.border }}>
  <Card.Header>
    <Card.Title>Project settings</Card.Title>
    <Card.Description sx={{ color: vars.color.textMuted }}>
      Visible to everyone in the workspace.
    </Card.Description>
  </Card.Header>
  <Card.Footer>
    <Button tone="accent">Save</Button>
  </Card.Footer>
</Card>`,
      },
    },
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Palette: Story = {
  render: () => (
    <TokenPanel>
      {COLOR_FAMILIES.map((family) => (
        <TokenFamily key={family.id} title={family.title} blurb={family.blurb} count={family.roles.length}>
          {family.roles.map((doc) => (
            <ColorToken key={doc.role} doc={doc} />
          ))}
        </TokenFamily>
      ))}
    </TokenPanel>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const rows = canvasElement.querySelectorAll('li');
    await expect(rows).toHaveLength(TOTAL_ROLES);
    // Eleven families, each row carrying one value per palette.
    await expect(canvasElement.querySelectorAll('h2')).toHaveLength(COLOR_FAMILIES.length);
    for (const row of rows) await expect(row.querySelectorAll('dd')).toHaveLength(2);

    const muted = canvas.getByText('theme.color.textMuted').closest('li') as HTMLElement;
    await expect(within(muted).getAllByText(/:1 · (AA|AAA|Pass)$/)).toHaveLength(2);

    // The swatch paints the role through its custom property, so it is never the panel color.
    const fillOf = (name: string) =>
      canvas
        .getByText(name)
        .closest('li')
        ?.querySelector<HTMLElement>('[data-swatch]') as HTMLElement;
    await expect(getComputedStyle(fillOf('theme.color.text')).backgroundColor).not.toBe(
      getComputedStyle(fillOf('theme.color.bg')).backgroundColor,
    );
  },
};
