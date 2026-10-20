// `styled` is the app-facing styling API; consumers import it from `@jfrader/ui`.
import { styled } from '../../index';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { withLightTheme } from '../../testing/story-decorators';
import { Divider } from './index';
import { Card } from '../card';

const Stack = styled.div({
  display: 'grid',
  gap: vars.space[4],
  inlineSize: '360px',
  maxInlineSize: '100%',
  fontSize: vars.textSize.sm,
  color: vars.color.text,
});

const Prose = styled.p({ margin: 0 });

const Row = styled.div({
  display: 'flex',
  alignItems: 'center',
  gap: vars.space[3],
  fontSize: vars.textSize.sm,
  color: vars.color.text,
});

const meta = {
  title: 'Data display/Divider',
  component: Divider,
  parameters: {
    docs: {
      sections: [
        { title: 'Orientation', stories: ['Default', 'Vertical'] },
        { title: 'Labels', stories: ['Labeled'] },
        { title: 'Variants', stories: ['LineStyles'] },
        { title: 'Composition', stories: ['SectionGroups'] },
      ],
      description: { component: 'Separate sections with a line or a label.' },
      usage: `### When to use
Separate related sections or groups of actions without adding a heading.

### Layout

Give vertical separators a row with content or an explicit height; they have no intrinsic height. Set surrounding spacing on the parent.

### Keyboard and accessibility

Keep labels textual, not interactive. A separator is not a control and is skipped by Tab.`,
    },
  },
  decorators: [
    (Story) => (
      <Stack>
        <Story />
      </Stack>
    ),
  ],
} satisfies Meta<typeof Divider>;

export default meta;

type Story = StoryObj<typeof Divider>;

function Sections() {
  return (
    <>
      <Prose>Signed in as ana@example.com</Prose>
      <Divider />
      <Prose>3 active sessions</Prose>
    </>
  );
}
Sections.displayName = 'Sections';

function SignInOptions() {
  return (
    <>
      <Prose>Continue with GitHub</Prose>
      <Divider label="or" />
      <Prose>Continue with email</Prose>
    </>
  );
}
SignInOptions.displayName = 'SignInOptions';

function Toolbar() {
  return (
    <Row>
      <span>Bold</span>
      <span>Italic</span>
      <Divider orientation="vertical" />
      <span>Link</span>
    </Row>
  );
}
Toolbar.displayName = 'Toolbar';

export const Default: Story = {
  name: 'Horizontal separator',
  parameters: {
    docs: {
      description: {
        story: 'Separate account information from its session count.',
      },
      source: {
        language: 'tsx',
        code: `import { Divider, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const Prose = styled.p({ margin: 0 });

function Sections() {
  return (
    <>
      <Prose>Signed in as ana@example.com</Prose>
      <Divider />
      <Prose>3 active sessions</Prose>
    </>
  );
}

<Sections />;`,
      },
    },
  },
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
  name: 'Text label',
  parameters: {
    docs: {
      description: { story: 'Place a short label between sign-in options.' },
      source: {
        language: 'tsx',
        code: `import { Divider, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const Prose = styled.p({ margin: 0 });

function SignInOptions() {
  return (
    <>
      <Prose>Continue with GitHub</Prose>
      <Divider label="or" />
      <Prose>Continue with email</Prose>
    </>
  );
}

<SignInOptions />;`,
      },
    },
  },
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
  parameters: {
    docs: {
      source: {
        code: `<>
  <span id="divider-context">Sign-in options</span>
  <Divider label="or" aria-labelledby="divider-context" />
</>`,
      },
    },
  },
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
  parameters: {
    docs: {
      source: {
        code: '<Divider label={0} />',
      },
    },
  },
  args: {},
  render: () => <Divider label={0} />,
  play: async ({ canvasElement }) => {
    const separator = within(canvasElement).getByRole('separator', { name: '0' });
    await expect(separator.tagName).toBe('DIV');
  },
};

export const EmptyLabels: Story = {
  parameters: {
    docs: {
      source: {
        code: `<>
  <Divider label={false} />
  <Divider label={null} />
</>`,
      },
    },
  },
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
  parameters: {
    docs: {
      source: {
        code: `<>
  <button type="button">Before divider</button>
  <Divider />
  <button type="button">After divider</button>
</>`,
      },
    },
  },
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
  name: 'Vertical separator',
  parameters: {
    docs: {
      description: { story: 'Split groups in a toolbar row.' },
      source: {
        language: 'tsx',
        code: `import { Divider, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const Row = styled.div({
  display: 'flex',
  alignItems: 'center',
  gap: vars.space[3],
  fontSize: vars.textSize.sm,
  color: vars.color.text,
});

function Toolbar() {
  return (
    <Row>
      <span>Bold</span>
      <span>Italic</span>
      <Divider orientation="vertical" />
      <span>Link</span>
    </Row>
  );
}

<Toolbar />;`,
      },
    },
  },
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
  parameters: {
    docs: {
      source: {
        code: `const Row = styled.div({ display: 'flex' });

<ThemeRoot theme="light">
  <Divider />
  <Divider label="or" />
  <Row><span>Bold</span><Divider orientation="vertical" /><span>Link</span></Row>
</ThemeRoot>`,
      },
    },
  },
  decorators: [withLightTheme],
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

export const LineStyles: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Change the thickness or inset of a horizontal line with sx.',
      },
      source: {
        language: 'tsx',
        code: `import { Divider } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

<>
  <Divider sx={{ blockSize: vars.space[1] }} />
  <Divider sx={{ marginInline: vars.space[6] }} />
</>;`,
      },
    },
  },
  name: 'Line treatments',
  render: () => (
    <>
      <Divider sx={{ blockSize: vars.space[1] }} />
      <Divider sx={{ marginInline: vars.space[6] }} />
    </>
  ),
};

export const SectionGroups: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Compose a heading and two content groups with a separator.',
      },
      source: {
        language: 'tsx',
        code: `import { Card, Divider, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const Prose = styled.p({ margin: 0 });

<Card>
  <Card.Header><Card.Title>Account</Card.Title></Card.Header>
  <Card.Content sx={{ display: 'grid', gap: vars.space[4] }}>
    <Prose>Signed in as ana@example.com</Prose>
    <Divider />
    <Prose>3 active sessions</Prose>
  </Card.Content>
</Card>;`,
      },
    },
  },
  name: 'Grouped sections',
  render: () => (
    <Card>
      <Card.Header><Card.Title>Account</Card.Title></Card.Header>
      <Card.Content sx={{ display: 'grid', gap: vars.space[4] }}>
        <Prose>Signed in as ana@example.com</Prose>
        <Divider />
        <Prose>3 active sessions</Prose>
      </Card.Content>
    </Card>
  ),
};
