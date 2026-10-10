import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { Pill, type PillTone } from './index';

const TONES = ['neutral', 'accent', 'success', 'warning', 'danger'] as const satisfies readonly PillTone[];
const PILL_HEIGHT = 20;

const rowStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: vars.space[2],
});

const proseStyle = css({
  margin: 0,
  fontSize: vars.textSize.md,
  color: vars.color.text,
});

const meta = {
  title: 'Data display/Pill',
  component: Pill,
  args: { children: 'Draft', tone: 'neutral' },
  argTypes: {
    tone: { control: 'select', options: TONES },
  },
} satisfies Meta<typeof Pill>;

export default meta;

type Story = StoryObj<typeof meta>;

function ToneRow() {
  return (
    <div css={rowStyle}>
      {TONES.map((tone) => (
        <Pill key={tone} tone={tone}>
          {tone}
        </Pill>
      ))}
    </div>
  );
}

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const pill = within(canvasElement).getByText('Draft');
    await expect(pill).toHaveAttribute('data-ui', 'pill');
    await expect(pill).toHaveAttribute('data-tone', 'neutral');
  },
};

export const Tones: Story = {
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
    <p css={proseStyle}>
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
  globals: { theme: 'light' },
  render: () => <ToneRow />,
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelectorAll('[data-ui="pill"]')).toHaveLength(TONES.length);
  },
};
