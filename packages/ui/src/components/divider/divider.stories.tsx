import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { Divider } from './index';

const stackStyle = css({
  display: 'grid',
  gap: vars.space[4],
  inlineSize: '360px',
  fontSize: vars.textSize.sm,
  color: vars.color.text,
});

const rowStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: vars.space[3],
  fontSize: vars.textSize.sm,
  color: vars.color.text,
});

const proseStyle = css({ margin: 0 });

const meta = {
  title: 'Components/Divider',
  component: Divider,
  decorators: [
    (Story) => (
      <div css={stackStyle}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Divider>;

export default meta;

type Story = StoryObj<typeof Divider>;

function Sections() {
  return (
    <>
      <p css={proseStyle}>Signed in as ana@example.com</p>
      <Divider />
      <p css={proseStyle}>3 active sessions</p>
    </>
  );
}

function SignInOptions() {
  return (
    <>
      <p css={proseStyle}>Continue with GitHub</p>
      <Divider label="or" />
      <p css={proseStyle}>Continue with email</p>
    </>
  );
}

function Toolbar() {
  return (
    <div css={rowStyle}>
      <span>Bold</span>
      <span>Italic</span>
      <Divider orientation="vertical" />
      <span>Link</span>
    </div>
  );
}

export const Default: Story = {
  args: {},
  render: () => <Sections />,
  play: async ({ canvasElement }) => {
    const separator = within(canvasElement).getByRole('separator');
    await expect(separator.tagName).toBe('HR');
    await expect(separator).not.toHaveAttribute('role');
    await expect(separator).toHaveAttribute('data-orientation', 'horizontal');
    const { width, height } = separator.getBoundingClientRect();
    await expect(height).toBe(1);
    await expect(width).toBeGreaterThan(0);
  },
};

export const Labeled: Story = {
  args: {},
  render: () => <SignInOptions />,
  play: async ({ canvasElement }) => {
    const separator = within(canvasElement).getByRole('separator', { name: 'or' });
    await expect(separator.tagName).toBe('DIV');
    await expect(separator).toHaveAttribute('aria-orientation', 'horizontal');
    const label = separator.querySelector('[data-ui="divider-label"]') as HTMLElement;
    await expect(label).toBeVisible();
    await expect(separator.getAttribute('aria-labelledby')).toBe(label.id);

    for (const pseudo of ['::before', '::after']) {
      await expect(getComputedStyle(separator, pseudo).blockSize).toBe('1px');
      await expect(getComputedStyle(separator, pseudo).flexGrow).toBe('1');
    }
    // The label sits centred between the two lines.
    const separatorRect = separator.getBoundingClientRect();
    const labelRect = label.getBoundingClientRect();
    const separatorCentre = separatorRect.left + separatorRect.width / 2;
    const labelCentre = labelRect.left + labelRect.width / 2;
    await expect(Math.abs(separatorCentre - labelCentre)).toBeLessThanOrEqual(1);
  },
};

export const ExternalLabelledBy: Story = {
  args: {},
  render: () => (
    <>
      <span id="divider-context">Sign-in options</span>
      <Divider label="or" aria-labelledby="divider-context" />
    </>
  ),
  play: async ({ canvasElement }) => {
    const separator = within(canvasElement).getByRole('separator', { name: 'or Sign-in options' });
    await expect(separator.getAttribute('aria-labelledby')?.split(' ')).toContain('divider-context');
  },
};

export const ZeroLabel: Story = {
  args: {},
  render: () => <Divider label={0} />,
  play: async ({ canvasElement }) => {
    const separator = within(canvasElement).getByRole('separator', { name: '0' });
    await expect(separator.tagName).toBe('DIV');
  },
};

export const EmptyLabels: Story = {
  args: {},
  render: () => (
    <>
      <Divider label={false} />
      <Divider label={null} />
    </>
  ),
  play: async ({ canvasElement }) => {
    const separators = within(canvasElement).getAllByRole('separator');
    await expect(separators).toHaveLength(2);
    for (const separator of separators) {
      await expect(separator.tagName).toBe('HR');
      await expect(separator).not.toHaveAttribute('role');
      await expect(separator).not.toHaveAttribute('aria-labelledby');
      await expect(separator.children).toHaveLength(0);
    }
    await expect(separators[0]!.parentElement).toBe(separators[1]!.parentElement);
    await expect(separators[0]!.parentElement?.children).toHaveLength(2);
    await expect(canvasElement.querySelector('div[data-ui="divider"]')).toBeNull();
  },
};

export const KeyboardFocus: Story = {
  render: () => (
    <>
      <button type="button">Before divider</button>
      <Divider />
      <button type="button">After divider</button>
    </>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const separator = canvas.getByRole('separator');
    await expect(separator.tagName).toBe('HR');
    canvas.getByRole('button', { name: 'Before divider' }).focus();
    await expect(canvas.getByRole('button', { name: 'Before divider' })).toHaveFocus();
    await userEvent.tab();
    await expect(canvas.getByRole('button', { name: 'After divider' })).toHaveFocus();
    await expect(separator).not.toHaveFocus();
  },
};

export const Vertical: Story = {
  render: () => <Toolbar />,
  play: async ({ canvasElement }) => {
    const separator = within(canvasElement).getByRole('separator');
    await expect(separator.tagName).toBe('DIV');
    await expect(separator).toHaveAttribute('aria-orientation', 'vertical');
    await expect(separator).toHaveAttribute('data-orientation', 'vertical');
    const row = separator.parentElement as HTMLElement;
    const { width, height } = separator.getBoundingClientRect();
    await expect(width).toBe(1);
    // No intrinsic block size: it stretches to the parent row.
    await expect(height).toBe(row.getBoundingClientRect().height);
  },
};

export const LightTheme: Story = {
  globals: { theme: 'light' },
  render: () => (
    <>
      <Sections />
      <SignInOptions />
      <Toolbar />
    </>
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getAllByRole('separator')).toHaveLength(3);
  },
};
