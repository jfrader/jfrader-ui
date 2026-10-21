import type { CSSProperties } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { withLightTheme } from '../../testing/story-decorators';
import { ApiTable, type ApiComponentDoc } from './index';
import demo from './api-table.demo.json';

// Prototype fixture: the same shape @jfrader/storybook-docs emits from the component sources.
const data = demo as unknown as readonly ApiComponentDoc[];
const selectFamily = data.filter((component) => component.name.startsWith('Select.') || component.name === 'Select');
const selectCore = selectFamily.filter((component) => ['Select', 'Select.Trigger', 'Select.Item'].includes(component.name));
const moneyInput = data.filter((component) => component.name === 'MoneyInput');
const gravityWell = data.filter((component) => component.name === 'GravityWell');

const frameStyle = {
  display: 'grid',
  gap: vars.space[4],
  maxInlineSize: '980px',
} satisfies CSSProperties;

const introStyle = {
  margin: 0,
  color: vars.color.textMuted,
  fontSize: vars.textSize.sm,
} satisfies CSSProperties;

const meta = {
  title: 'Data display/ApiTable',
  component: ApiTable,
  parameters: {
    docs: {
      description: {
        component:
          'Document a component’s props and types: literal unions as chips, expanded members and signatures, real defaults, and a Slots panel built from `slots` and `slotProps`. Feed it the data the docs build already extracts.',
      },
      usage: `### Data
- \`components\` is an ordered list; each entry renders a heading and its own rows. Parts belong in the same list as their root (\`Select\`, \`Select.Trigger\`).
- \`members\` expands object types, \`signatures\` prints parameters, and \`tags\` surfaces deprecation, \`since\` and examples. Everything is optional, so partial data still renders.
- The Slots panel merges the \`slots\` and \`slotProps\` maps across every component in the list.

### Filtering
- The filter matches prop name, type, description and inherited source. Matches inside inherited props are shown automatically; the inherited group otherwise stays collapsed.
- Set \`searchable={false}\` when the page already has its own search.`,
    },
  },
  args: { components: selectCore },
  argTypes: {
    components: { control: false },
    density: { control: 'inline-radio', options: ['comfortable', 'compact'] },
    searchable: { control: 'boolean' },
    showSlots: { control: 'boolean' },
    headingLevel: { control: 'inline-radio', options: [2, 3, 4] },
  },
  decorators: [
    (Story) => (
      <div style={frameStyle}>
        <p style={introStyle}>Rendered from component sources, not hand-written rows.</p>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ApiTable>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const table = canvas.getByRole('region', { name: 'API reference' });
    await expect(table).toHaveAttribute('data-ui', 'api-table');
    await expect(table.querySelectorAll('[data-prop]').length).toBeGreaterThan(20);
    await expect(canvas.getByText('Slots')).toBeInTheDocument();
  },
};

export const Compact: Story = {
  args: { density: 'compact' },
};

export const MoneyInputSignature: Story = {
  args: { components: moneyInput },
};

export const GravityWellItemType: Story = {
  args: { components: gravityWell },
};

export const Light: Story = {
  decorators: [withLightTheme],
};

export const Narrow: Story = {
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};
