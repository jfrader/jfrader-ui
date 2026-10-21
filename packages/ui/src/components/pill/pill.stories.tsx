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
      sections: [
        { title: 'Labels', stories: ['InlineWithText', 'Default'] },
        { title: 'Status colors', stories: ['Tones'] },
      ],
      description: { component: 'Show a status or category beside other content.' },
      usage: `### Status
- Write the status in text so color is not the only cue. Use Badge for a notification count or dot on content.
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
  name: 'Status label',
  parameters: { docs: { description: { story: 'Mark an item as a draft.' }, source: { language: 'tsx', code: `import { Pill } from '@jfrader/ui';

<Pill>Draft</Pill>` } } },
  play: async ({ canvasElement }) => {
    const pill = within(canvasElement).getByText('Draft');
    await expect(pill).toHaveAttribute('data-ui', 'pill');
    await expect(pill).toHaveAttribute('data-tone', 'neutral');
  },
};

export const Tones: Story = {
  name: 'Tonal labels',
  parameters: {
    docs: {
      description: { story: 'Compare the five tones with a text label for each.' },
      source: {
        language: 'tsx',
        code: `import { Pill, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const Labels = styled.div({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: vars.space[2] });

<Labels>
  <Pill tone="neutral">neutral</Pill>
  <Pill tone="accent">accent</Pill>
  <Pill tone="success">success</Pill>
  <Pill tone="warning">warning</Pill>
  <Pill tone="danger">danger</Pill>
</Labels>`,
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
  name: 'Label in text',
  parameters: { docs: { description: { story: 'Add a release label within an announcement.' }, source: { language: 'tsx', code: `import { Pill, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const Announcement = styled.p({ margin: 0, fontSize: vars.textSize.md, color: vars.color.text });

<Announcement>
  Shared workspaces <Pill tone="accent">Beta</Pill> are rolling out this week.
</Announcement>` } } },
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

export const EnlargedLabel: Story = {
  tags: ['!autodocs'],
  args: { children: 'Awaiting review', sx: { fontSize: '2rem' } },
  play: async ({ canvasElement }) => {
    const pill = within(canvasElement).getByText('Awaiting review');
    await expect(pill.getBoundingClientRect().height).toBeGreaterThanOrEqual(parseFloat(getComputedStyle(pill).fontSize));
  },
};
