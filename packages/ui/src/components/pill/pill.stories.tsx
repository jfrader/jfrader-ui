import type { CSSProperties } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { withLightTheme } from '../../testing/story-decorators';
import { Pill, type PillTone } from './index';

const TONES = ['neutral', 'accent', 'success', 'warning', 'danger'] as const satisfies readonly PillTone[];
const PILL_HEIGHT = 20;

const rowStyle = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: vars.space[2],
} satisfies CSSProperties;

const proseStyle = {
  margin: 0,
  fontSize: vars.textSize.md,
  color: vars.color.text,
} satisfies CSSProperties;

const meta = {
  title: 'Data display/Pill',
  component: Pill,
  parameters: {
    docs: {
      description: { component: 'Show a status or category beside other content.' },
      usage: `### Status
- \`tone\` defaults to \`neutral\`; choose \`accent\`, \`success\`, \`warning\` or \`danger\` to change its colors. Write the status in \`children\` so color is not the only cue.
- Text stays on one line without truncation. Keep the label short or give it room in your layout.

### Actions
- Pill renders a span with no interaction or live-region role. Use a button for an action and a status region when updates need to be announced.`,
    },
  },
  args: { children: 'Draft', tone: 'neutral' },
  argTypes: {
    tone: { control: 'select', options: TONES },
  },
} satisfies Meta<typeof Pill>;

export default meta;

type Story = StoryObj<typeof meta>;

function ToneRow() {
  return (
    <div style={rowStyle}>
      {TONES.map((tone) => (
        <Pill key={tone} tone={tone}>
          {tone}
        </Pill>
      ))}
    </div>
  );
}
ToneRow.displayName = 'ToneRow';

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const pill = within(canvasElement).getByText('Draft');
    await expect(pill).toHaveAttribute('data-ui', 'pill');
    await expect(pill).toHaveAttribute('data-tone', 'neutral');
  },
};

export const Tones: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `<>
  <Pill tone="neutral">neutral</Pill>
  <Pill tone="accent">accent</Pill>
  <Pill tone="success">success</Pill>
  <Pill tone="warning">warning</Pill>
  <Pill tone="danger">danger</Pill>
</>`,
      },
    },
  },
  render: () => <ToneRow />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const tone of TONES) {
      const pill = canvas.getByText(tone);
      await expect(pill).toHaveAttribute('data-tone', tone);
      await expect(Math.round(pill.getBoundingClientRect().height)).toBe(PILL_HEIGHT);
    }
  },
};

export const InlineWithText: Story = {
  args: { tone: 'accent', children: 'Beta' },
  render: (args) => (
    <p style={proseStyle}>
      Shared workspaces <Pill {...args} /> are rolling out this week.
    </p>
  ),
  play: async ({ canvasElement }) => {
    const paragraph = canvasElement.querySelector('p') as HTMLElement;
    await expect(paragraph).toHaveTextContent('Shared workspaces Beta are rolling out this week.');
    await expect(within(canvasElement).getByText('Beta').tagName).toBe('SPAN');
  },
};

export const LightTheme: Story = {
  parameters: {
    docs: {
      source: {
        code: `<ThemeRoot theme="light">
<>
  <Pill tone="neutral">neutral</Pill>
  <Pill tone="accent">accent</Pill>
  <Pill tone="success">success</Pill>
  <Pill tone="warning">warning</Pill>
  <Pill tone="danger">danger</Pill>
</>
</ThemeRoot>`,
      },
    },
  },
  decorators: [withLightTheme],
  render: () => <ToneRow />,
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelectorAll('[data-ui="pill"]')).toHaveLength(TONES.length);
  },
};
