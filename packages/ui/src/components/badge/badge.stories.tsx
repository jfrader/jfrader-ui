import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { Badge, type BadgeTone } from './index';

const TONES = ['neutral', 'accent', 'success', 'warning', 'danger'] as const satisfies readonly BadgeTone[];
const BADGE_HEIGHT = 20;

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
  title: 'Components/Badge',
  component: Badge,
  args: { children: 'Draft', tone: 'neutral' },
  argTypes: {
    tone: { control: 'select', options: TONES },
  },
} satisfies Meta<typeof Badge>;

export default meta;

type Story = StoryObj<typeof meta>;

function ToneRow() {
  return (
    <div css={rowStyle}>
      {TONES.map((tone) => (
        <Badge key={tone} tone={tone}>
          {tone}
        </Badge>
      ))}
    </div>
  );
}

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const badge = within(canvasElement).getByText('Draft');
    await expect(badge).toHaveAttribute('data-ui', 'badge');
    await expect(badge).toHaveAttribute('data-tone', 'neutral');
  },
};

export const Tones: Story = {
  render: () => <ToneRow />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const tone of TONES) {
      const badge = canvas.getByText(tone);
      await expect(badge).toHaveAttribute('data-tone', tone);
      await expect(Math.round(badge.getBoundingClientRect().height)).toBe(BADGE_HEIGHT);
    }
  },
};

export const InlineWithText: Story = {
  args: { tone: 'accent', children: 'Beta' },
  render: (args) => (
    <p css={proseStyle}>
      Shared workspaces <Badge {...args} /> are rolling out this week.
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
    await expect(canvasElement.querySelectorAll('[data-ui="badge"]')).toHaveLength(TONES.length);
  },
};
