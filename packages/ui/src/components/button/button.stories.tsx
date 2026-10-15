// `styled` is the app-facing styling API; consumers import it from `@jfrader/ui`.
import { styled } from '../../index';
import type { MouseEvent } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { withLightTheme } from '../../testing/story-decorators';
import { Button, type ButtonSize, type ButtonTone, type ButtonVariant } from './index';

const VARIANTS = ['solid', 'soft', 'outline', 'ghost'] as const satisfies readonly ButtonVariant[];
const TONES = ['neutral', 'accent', 'danger'] as const satisfies readonly ButtonTone[];
const SIZES = ['sm', 'md', 'lg'] as const satisfies readonly ButtonSize[];
const GRID_VARIANTS = ['solid', 'soft', 'outline'] as const satisfies readonly ButtonVariant[];
const linkRef = fn<(element: HTMLButtonElement | null) => void>();
const disabledLinkClick = fn();

function PlusIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M8 3v10M3 8h10" />
    </svg>
  );
}
PlusIcon.displayName = 'PlusIcon';

function ArrowIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8h10M9 4l4 4-4 4" />
    </svg>
  );
}
ArrowIcon.displayName = 'ArrowIcon';

const Grid = styled.div({
  display: 'grid',
  gridTemplateColumns: `repeat(${GRID_VARIANTS.length}, auto)`,
  gap: vars.space[3],
});

const Row = styled.div({
  display: 'flex',
  alignItems: 'center',
  gap: vars.space[3],
});

const Marker = styled.span({ color: vars.color.borderControl });

const meta = {
  title: 'Inputs/Button',
  component: Button,
  parameters: { docs: { description: { component: 'Run an action with a button. Show when it is loading or unavailable.' } } },
  tags: ['autodocs'],
  args: { children: 'Button', variant: 'solid', tone: 'neutral', size: 'md' },
  argTypes: {
    variant: { control: 'select', options: VARIANTS },
    tone: { control: 'radio', options: TONES },
    size: { control: 'radio', options: SIZES },
    loading: { control: 'boolean' },
    disabled: { control: 'boolean' },
  },
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { children: 'Save changes', tone: 'accent', type: 'submit' },
  render: (args) => <Button {...args} data-ui="custom" />,
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('button')).toHaveAttribute('data-ui', 'button');
  },
};

export const Variants: Story = {
  parameters: {
    docs: {
      source: {
        code: `import { Button } from '@jfrader/ui';

{['neutral', 'accent', 'danger'].map((tone) =>
  ['solid', 'soft', 'outline'].map((variant) => (
    <Button key={\`\${tone}-\${variant}\`} tone={tone} variant={variant}>
      {\`\${variant} \${tone}\`}
    </Button>
  )),
)}`,
      },
    },
  },
  render: (args) => (
    <Grid>
      {TONES.map((tone) =>
        GRID_VARIANTS.map((variant) => (
          <Button {...args} key={`${tone}-${variant}`} tone={tone} variant={variant}>
            {`${variant} ${tone}`}
          </Button>
        )),
      )}
    </Grid>
  ),
};

export const Sizes: Story = {
  parameters: {
    docs: {
      source: {
        code: `import { Button } from '@jfrader/ui';

{['sm', 'md', 'lg'].map((size) => (
  <Button key={size} size={size}>
    {size}
  </Button>
))}`,
      },
    },
  },
  render: (args) => (
    <Row>
      {SIZES.map((size) => (
        <Button {...args} key={size} size={size}>
          {size}
        </Button>
      ))}
    </Row>
  ),
};

export const ControlBoundaries: Story = {
  render: (args) => (
    <Row>
      <Marker aria-hidden="true" data-testid="boundary-color"  />
      <Button {...args} tone="neutral" variant="solid">solid neutral</Button>
      {TONES.map((tone) => (
        <Button {...args} key={tone} tone={tone} variant="outline">outline {tone}</Button>
      ))}
    </Row>
  ),
  play: async ({ canvas }) => {
    const expected = getComputedStyle(canvas.getByTestId('boundary-color')).color;
    for (const button of canvas.getAllByRole('button')) {
      await expect(getComputedStyle(button).borderColor).toBe(expected);
    }
  },
};

export const ControlBoundariesLight: Story = {
  ...ControlBoundaries,
  decorators: [withLightTheme],
  globals: { theme: 'light' },
};

export const WithIcons: Story = {
  args: { startIcon: <PlusIcon />, endIcon: <ArrowIcon /> },
};

export const LightTheme: Story = {
  decorators: [withLightTheme],
  args: { tone: 'accent', variant: 'soft', children: 'Soft accent' },
};

export const Loading: Story = {
  args: { loading: true, tone: 'accent', children: 'Saving…', onClick: fn() },
  play: async ({ args, canvasElement }) => {
    const button = within(canvasElement).getByRole('button');
    await expect(button).toHaveAttribute('aria-busy', 'true');
    await expect(button).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(button);
    await expect(args.onClick).not.toHaveBeenCalled();
  },
};

export const Disabled: Story = {
  args: { disabled: true, onClick: fn() },
  play: async ({ args, canvasElement }) => {
    const button = within(canvasElement).getByRole('button');
    await userEvent.click(button);
    await expect(args.onClick).not.toHaveBeenCalled();
  },
};

export const KeyboardActivation: Story = {
  args: { onClick: fn() },
  play: async ({ args, canvasElement }) => {
    const button = within(canvasElement).getByRole('button');
    canvasElement.tabIndex = -1;
    canvasElement.focus();
    await userEvent.tab();
    canvasElement.removeAttribute('tabindex');
    await expect(button).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await expect(args.onClick).toHaveBeenCalledTimes(1);
    await userEvent.keyboard('[Space]');
    await expect(args.onClick).toHaveBeenCalledTimes(2);
    await expect(getComputedStyle(button).outlineWidth).not.toBe('0px');
  },
};

export const RenderAsLink: Story = {
  // The handler cancels navigation so the play test stays on the story.
  args: {
    tone: 'accent',
    children: 'Read the docs',
    onClick: fn((event: MouseEvent<HTMLElement>) => event.preventDefault()),
  },
  render: (args) => (
    <Row>
      <Button {...args} ref={linkRef} render={(props) => <a {...props} href="#docs" />} />
      <Button
        {...args}
        disabled
        onClick={disabledLinkClick}
        render={(props) => <a {...props} href="#disabled-docs" />}
      >
        Disabled docs
      </Button>
    </Row>
  ),
  play: async ({ args, canvasElement }) => {
    const link = within(canvasElement).getByRole('link', { name: 'Read the docs' });
    await expect(link).toHaveAttribute('href', '#docs');
    await expect(link).toHaveAttribute('data-ui', 'button');
    await expect(link).not.toHaveAttribute('type');
    await expect(canvasElement.querySelector('button')).toBeNull();
    await expect(linkRef).toHaveBeenLastCalledWith(link);
    await expect(linkRef.mock.calls.at(-1)?.[0]).toBeInstanceOf(HTMLAnchorElement);
    canvasElement.tabIndex = -1;
    canvasElement.focus();
    await userEvent.tab();
    canvasElement.removeAttribute('tabindex');
    await expect(link).toHaveFocus();
    await expect(getComputedStyle(link).outlineWidth).not.toBe('0px');
    await userEvent.keyboard('{Enter}');
    await expect(args.onClick).toHaveBeenCalledTimes(1);

    const disabledLink = within(canvasElement).getByRole('link', { name: 'Disabled docs' });
    await expect(disabledLink).toHaveAttribute('aria-disabled', 'true');
    disabledLinkClick.mockClear();
    const document = canvasElement.ownerDocument;
    const locationBefore = document.location.href;
    const defaultClick = fn((event: Event) => event.defaultPrevented);
    const observeClick = (event: Event) => {
      if (event.target === disabledLink) defaultClick(event);
    };
    document.addEventListener('click', observeClick);
    try {
      link.focus();
      await userEvent.tab();
      await expect(disabledLink).toHaveFocus();
      await userEvent.keyboard('{Enter}');
      await expect(defaultClick).toHaveBeenCalledTimes(1);
      await expect(defaultClick).toHaveLastReturnedWith(true);
      await userEvent.click(disabledLink);
      await expect(defaultClick).toHaveBeenCalledTimes(2);
      await expect(defaultClick).toHaveLastReturnedWith(true);
      await expect(disabledLinkClick).not.toHaveBeenCalled();
      await expect(document.location.href).toBe(locationBefore);
      await expect(args.onClick).toHaveBeenCalledTimes(1);
    } finally {
      document.removeEventListener('click', observeClick);
    }
  },
};
