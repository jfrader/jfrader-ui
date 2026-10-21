import { useState, type ComponentPropsWithRef, type MouseEventHandler, type RefCallback } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, spyOn, waitFor, within, type Mock } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { ClassNames, css } from '../../styling/css';
import { withLightTheme } from '../../testing/story-decorators';
// `styled` is the app-facing styling API; consumers import it from `@jfrader/ui`.
import { styled } from '../../index';
import { ThemeRoot } from '../theme-root';
import { ButtonGroup, type ButtonGroupCompoundProps, type ButtonGroupEasyProps, type ButtonGroupItemProps, type ButtonGroupItemRecord, type ButtonGroupCompoundProps as ButtonGroupProps } from './index';

const FixtureButton = styled.button({
  minInlineSize: vars.space[8],
  minBlockSize: vars.space[8],
});
const Stack = styled.div({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: vars.space[4],
});
const FIXTURE_WIDTHS = { narrow: 320, wide: 800 } as const;
const NarrowContainer = styled.div({
  width: FIXTURE_WIDTHS.narrow,
  maxInlineSize: '100%',
});
const FIXTURE_SCALE = 1.25;
const ScaledContainer = styled.div({
  transform: `scale(${FIXTURE_SCALE})`,
  transformOrigin: 'top left',
  width: FIXTURE_WIDTHS.narrow,
  maxInlineSize: `${100 / FIXTURE_SCALE}%`,
});
const itemCss = css({ paddingInline: '29px' });
function Icon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M8 3v10M3 8h10" />
    </svg>
  );
}
Icon.displayName = 'Icon';
const meta = {
  title: 'Actions/ButtonGroup',
  component: ButtonGroup,
  tags: ['autodocs'],
  args: {
    'aria-label': 'Document actions',
    orientation: 'horizontal',
    variant: 'outline',
    tone: 'neutral',
    size: 'md',
  },
  parameters: {
    layout: 'padded',
    a11y: {
      config: {
        rules: [
          {
            id: 'aria-hidden-focus',
            selector: '[aria-hidden="true"]:not([data-floating-ui-focus-guard])',
          },
        ],
      },
    },
    docs: {
      description: {
        component:
          'Place related actions together, with an optional menu for more commands.',
      },
      sections: [
        { title: 'Actions', stories: ['Default', 'Compound'] },
        { title: 'Composition', stories: ['NativeFormActions', 'Link', 'WithMenu'] },
        { title: 'Layout', stories: ['Vertical'] },
      ],
      usage: `### When to use
Group related commands, not persistent choices. Use ToggleGroup for selection. Give the group an accessible name and name every icon-only action.

### Expanding actions

Each expanding action needs a unique identifier, an icon and a text label. Expansion reveals a label, not a selection: pointer movement or focus reveals it, and leaving returns to the focused or resting action. Touch activates on the first tap. Invalid identifiers fall back to the resting or first enabled action without a callback; when all actions are disabled, all labels stay visible.

### Actions and menus

Application code owns async completion and errors. Reserve room for changing result labels to avoid moving nearby actions. Give at most one action solid accent emphasis.
Accepted Escape or menu selection returns focus to the trigger; outside press and Tab-out do not.

### Keyboard and accessibility

- Tab/Shift+Tab visit every enabled action.
- Arrows matching the orientation wrap. Home/End move to the ends; horizontal arrows reverse in RTL.
- Enter/Space activate buttons. Links keep their native Enter/Space behavior.`,
      source: {
        code: '<ButtonGroup aria-label="Document actions">\n  <ButtonGroup.Item>Share</ButtonGroup.Item>\n  <ButtonGroup.Item>Duplicate</ButtonGroup.Item>\n  <ButtonGroup.Item>Archive</ButtonGroup.Item>\n</ButtonGroup>',
      },
    },
  },
  render: (args: ButtonGroupCompoundProps) => (
    <ButtonGroup {...args}>
      <ButtonGroup.Item>Share</ButtonGroup.Item>
      <ButtonGroup.Item>Duplicate</ButtonGroup.Item>
      <ButtonGroup.Item>Archive</ButtonGroup.Item>
    </ButtonGroup>
  ),
} satisfies Meta<ButtonGroupCompoundProps>;
export default meta;

function ButtonGroupHost(props: ComponentPropsWithRef<'div'>) {
  return <div {...props} data-testid="button-group-host" />;
}
function CustomItem(props: ButtonGroupItemProps) {
  return <ButtonGroup.Item {...props} data-testid="custom-button-group-item" />;
}

type Story = StoryObj<
  Omit<ButtonGroupCompoundProps, 'onClick' | 'component'> & {
    onClick?: MouseEventHandler<HTMLElement>;
    onMenuSelect?: () => void;
    onPartRef?: RefCallback<HTMLElement>;
  }
>;

export const Default: StoryObj<Omit<ButtonGroupEasyProps, 'component'>> = {
  name: 'Document actions',
  args: {
    label: 'Document actions',
    items: [
      { label: 'Share', onClick: fn() },
      { label: 'Duplicate', disabled: true },
      { label: 'Archive', onClick: fn() },
    ],
  },
  parameters: {
    docs: {
      description: { story: 'Group document commands and leave unavailable actions disabled.' },
      source: {
        language: 'tsx',
        code: `import { ButtonGroup } from '@jfrader/ui';

export function DocumentActions({ share, archive }: { share: () => void; archive: () => void }) {
  return <ButtonGroup label="Document actions" orientation="horizontal" variant="outline" tone="neutral" size="md" items={[
  { label: 'Share', onClick: share },
  { label: 'Duplicate', disabled: true },
  { label: 'Archive', onClick: archive },
  ]} />;
}`,
      },
    },
  },
  render: (args) => <ButtonGroup {...args} />,
  play: async ({ canvas, userEvent, args }) => {
    const group = canvas.getByRole('group', { name: 'Document actions' });
    await expect(group).toHaveAttribute('data-ui', 'button-group');
    const buttons = within(group).getAllByRole('button');
    await expect(buttons).toHaveLength(3);
    await expect(buttons[0]).toHaveTextContent('Share');
    await expect(buttons[1]).toHaveTextContent('Duplicate');
    await expect(buttons[1]).toBeDisabled();
    await expect(buttons[2]).toHaveTextContent('Archive');

    await userEvent.tab();
    await expect(buttons[0]).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    const firstItem = args.items[0];
    if (!firstItem) throw new Error('Expected the Share action.');
    await expect(firstItem.onClick).toHaveBeenCalledTimes(1);

    await userEvent.keyboard('{ArrowRight}');
    await expect(buttons[2]).toHaveFocus();
    await userEvent.keyboard(' ');
    const thirdItem = args.items[2];
    if (!thirdItem) throw new Error('Expected the Archive action.');
    await expect(thirdItem.onClick).toHaveBeenCalledTimes(1);
  },
};

export const Compound: Story = {
  name: 'Composed actions',
  parameters: { docs: {
    description: { story: 'Write each action as a child when composing the group yourself.' },
    source: { language: 'tsx', code: `import { ButtonGroup } from '@jfrader/ui';

<ButtonGroup aria-label="Document actions" orientation="horizontal" variant="outline" tone="neutral" size="md">
  <ButtonGroup.Item>Share</ButtonGroup.Item>
  <ButtonGroup.Item>Duplicate</ButtonGroup.Item>
  <ButtonGroup.Item>Archive</ButtonGroup.Item>
</ButtonGroup>` },
  } },
  args: {
    'aria-label': 'Document actions',
  },
  render: (args) => (
    <ButtonGroup {...args}>
      <ButtonGroup.Item>Share</ButtonGroup.Item>
      <ButtonGroup.Item>Duplicate</ButtonGroup.Item>
      <ButtonGroup.Item>Archive</ButtonGroup.Item>
    </ButtonGroup>
  ),
  play: async ({ canvas }) => {
    const group = canvas.getByRole('group', { name: 'Document actions' });
    await expect(group).not.toHaveAttribute('aria-orientation');
    const items = canvas.getAllByRole('button');
    for (const item of items) {
      await expect(item).toHaveAttribute('data-ui', 'button-group-item button');
      await expect(item).not.toHaveAttribute('aria-pressed');
      await expect(item.getBoundingClientRect().height).toBeGreaterThanOrEqual(31);
    }
    const first = getComputedStyle(items[0]!),
      middle = getComputedStyle(items[1]!),
      last = getComputedStyle(items[2]!);
    await expect(parseFloat(first.borderTopLeftRadius)).toBeGreaterThan(0);
    await expect(parseFloat(first.borderTopRightRadius)).toBe(0);
    await expect(parseFloat(middle.borderTopLeftRadius)).toBe(0);
    await expect(parseFloat(middle.borderTopRightRadius)).toBe(0);
    await expect(parseFloat(last.borderTopRightRadius)).toBeGreaterThan(0);
    await expect(
      Math.abs(items[0]!.getBoundingClientRect().right - items[1]!.getBoundingClientRect().left),
    ).toBeLessThan(1.1);
  },
};

export const NativeFormActions: StoryObj<Omit<ButtonGroupEasyProps, 'component'> & { onSave: () => void }> = {
  name: 'Form actions',
  args: {
    label: 'Document actions',
    items: [
      { label: 'Save', type: 'submit', name: 'action', value: 'save' },
      { label: 'Cancel', type: 'button' },
    ],
    onSave: fn(),
  },
  render: ({ onSave, ...args }) => (
    <form onSubmit={(event) => { event.preventDefault(); onSave(); }}>
      <ButtonGroup {...args} />
    </form>
  ),
  parameters: { docs: {
    description: { story: 'Submit a form from one action while keeping Cancel out of submission.' },
    source: { language: 'tsx', code: `import { ButtonGroup } from '@jfrader/ui';

export function DocumentForm({ saveDocument }: { saveDocument: () => void }) {
  return <form onSubmit={(event) => { event.preventDefault(); saveDocument(); }}>
  <ButtonGroup label="Document actions" orientation="horizontal" variant="outline" tone="neutral" size="md" items={[
    { label: 'Save', type: 'submit', name: 'action', value: 'save' },
    { label: 'Cancel', type: 'button' },
  ]} />
</form>;
}` } } },
  play: async ({ canvas, userEvent, args }) => {
    const save = canvas.getByRole('button', { name: 'Save' });
    await expect(save).toHaveAttribute('type', 'submit');
    await expect(save).toHaveAttribute('name', 'action');
    await expect(save).toHaveAttribute('value', 'save');
    await userEvent.click(save);
    await expect(args.onSave).toHaveBeenCalledTimes(1);
    await userEvent.click(canvas.getByRole('button', { name: 'Cancel' }));
    await expect(args.onSave).toHaveBeenCalledTimes(1);
  },
};

// The slot API takes `css` values, so this story keeps the documented spelling.
export const GeneratedPartProps: StoryObj<Omit<ButtonGroupEasyProps, 'component'>> = {
  name: 'Generated part props',
  args: {
    label: 'Document actions',
    items: [
      { label: 'Share', onClick: fn(), sx: { fontStyle: 'normal', fontWeight: vars.fontWeight.semibold } },
      { label: 'Guide', href: '/guide', sx: { fontWeight: vars.fontWeight.semibold } },
    ],
    slotProps: {
      root: { 'data-testid': 'custom-root', className: 'custom-root-class' },
      item: { className: 'custom-item-class', sx: { fontStyle: 'italic' } },
      link: { className: 'custom-link-class', sx: { fontStyle: 'italic' } },
    },
  },
  render: (args) => <ButtonGroup {...args} />,
  parameters: { docs: { source: { code: `<ButtonGroup label="Document actions" items={actions}
  slotProps={{ item: { sx: { fontStyle: 'italic' } }, link: { sx: { fontStyle: 'italic' } } }} />` } } },
  play: async ({ canvas }) => {
    const root = canvas.getByTestId('custom-root');
    await expect(root).toHaveClass('custom-root-class');
    await expect(root).toHaveAttribute('data-ui', 'button-group');

    const button = within(root).getByRole('button', { name: 'Share' });
    await expect(button).toHaveClass('custom-item-class');
    await expect(getComputedStyle(button).fontStyle).toBe('normal');
    await expect(getComputedStyle(button).fontWeight).toBe('600');

    const link = within(root).getByRole('link', { name: 'Guide' });
    await expect(link).toHaveClass('custom-link-class');
    await expect(getComputedStyle(link).fontStyle).toBe('italic');
    await expect(getComputedStyle(link).fontWeight).toBe('600');
    await expect(link).toHaveAttribute('href', '/guide');
  },
};

export const ReplacedParts: StoryObj<Omit<ButtonGroupEasyProps, 'component'>> = {
  name: 'Replaced parts',
  args: {
    items: [
      { label: 'Share', onClick: fn() },
      { label: 'Duplicate', onClick: fn() },
    ],
    slots: { root: ButtonGroupHost, item: CustomItem },
    className: 'consumer-root',
    style: { fontStyle: 'normal' },
    sx: { fontStyle: 'normal' },
    slotProps: {
      root: { className: 'slot-root', style: { fontStyle: 'italic' }, sx: { fontStyle: 'italic' }, 'aria-label': 'Project actions', 'data-ui': 'custom-group' },
    },
  },
  render: (args) => <ButtonGroup {...args} component={ButtonGroupHost} />,
  parameters: {
    docs: {
      source: {
        code: `<ButtonGroup items={actions} component={ButtonGroupHost} slots={{ item: CustomItem }} slotProps={{ root: { 'aria-label': 'Project actions' } }} />`,
      },
    },
  },
  play: async ({ canvas, userEvent }) => {
    const host = canvas.getByTestId('button-group-host');
    await expect(host).toHaveClass('consumer-root', 'slot-root');
    await expect(host).toHaveStyle({ fontStyle: 'italic' });
    await expect(host).toHaveAttribute('aria-label', 'Project actions');
    await expect(host).toHaveAttribute('data-ui', 'button-group custom-group');
    const items = canvas.getAllByTestId('custom-button-group-item');
    await expect(items).toHaveLength(2);
    await userEvent.tab();
    await expect(items[0]).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    await expect(items[1]).toHaveFocus();
  },
};

function easyModeTypeContracts() {
  const items: readonly ButtonGroupItemRecord[] = [{ label: 'Action' }];
  // @ts-expect-error Easy mode rejects compound children.
  <ButtonGroup items={items}>Child</ButtonGroup>;
  // @ts-expect-error Compound mode rejects items.
  <ButtonGroup items={items} label="Group">Child</ButtonGroup>;
  // @ts-expect-error Compound mode rejects slotProps.
  <ButtonGroup slotProps={{ root: {} }}>Child</ButtonGroup>;
}
void easyModeTypeContracts;

export const Variants: Story = {
  render: (args) => (
    <Stack>
      {(['outline', 'solid', 'soft', 'ghost'] as const).map((variant) => (
        <ButtonGroup {...args} key={variant} variant={variant} aria-label={`${variant} actions`}>
          <ButtonGroup.Item>Share</ButtonGroup.Item>
          <ButtonGroup.Item>Duplicate</ButtonGroup.Item>
          <ButtonGroup.Item>Archive</ButtonGroup.Item>
        </ButtonGroup>
      ))}
    </Stack>
  ),
};
export const Tones: Story = {
  render: (args) => (
    <ButtonGroup {...args}>
      <ButtonGroup.Item variant="solid" tone="accent">
        Share
      </ButtonGroup.Item>
      <ButtonGroup.Item>Duplicate</ButtonGroup.Item>
      <ButtonGroup.Item tone="danger">Delete</ButtonGroup.Item>
    </ButtonGroup>
  ),
};
export const Sizes: Story = {
  render: (args) => (
    <Stack>
      {(['sm', 'md', 'lg'] as const).map((size) => (
        <ButtonGroup {...args} size={size} key={size} aria-label={`${size} actions`}>
          <ButtonGroup.Item>Share</ButtonGroup.Item>
          <ButtonGroup.Item>Duplicate</ButtonGroup.Item>
        </ButtonGroup>
      ))}
    </Stack>
  ),
  play: async ({ canvas }) => {
    for (const [index, group] of canvas.getAllByRole('group').entries()) {
      await expect(
        within(group).getAllByRole('button')[0]!.getBoundingClientRect().height,
      ).toBeGreaterThanOrEqual([31, 39, 47][index]!);
    }
  },
};
export const LightTheme: Story = {
  decorators: [withLightTheme],
  globals: { theme: 'light' },
};
export const Vertical: Story = {
  name: 'Vertical actions',
  parameters: { docs: { description: { story: 'Stack commands and move between them with Up and Down.' }, source: { language: 'tsx', code: `import { ButtonGroup } from '@jfrader/ui';

<ButtonGroup aria-label="Document actions" orientation="vertical" variant="outline" tone="neutral" size="md">
  <ButtonGroup.Item>Share</ButtonGroup.Item>
  <ButtonGroup.Item>Duplicate</ButtonGroup.Item>
  <ButtonGroup.Item>Archive</ButtonGroup.Item>
</ButtonGroup>` } } },
  args: { orientation: 'vertical' },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const items = canvas.getAllByRole('button');
    canvasElement.tabIndex = -1;
    canvasElement.focus();
    await userEvent.tab();
    canvasElement.removeAttribute('tabindex');
    await userEvent.keyboard('{ArrowUp}');
    await expect(canvasElement.ownerDocument.activeElement).toBe(items[2]);
    await userEvent.keyboard('{ArrowDown}');
    await expect(canvasElement.ownerDocument.activeElement).toBe(items[0]);
    await userEvent.keyboard('{End}{ArrowUp}');
    await expect(canvasElement.ownerDocument.activeElement).toBe(items[1]);
    await userEvent.keyboard('{Home}{ArrowRight}');
    await expect(canvasElement.ownerDocument.activeElement).toBe(items[0]);
    await expect(parseFloat(getComputedStyle(items[0]!).borderBottomLeftRadius)).toBe(0);
    await expect(parseFloat(getComputedStyle(items[2]!).borderBottomLeftRadius)).toBeGreaterThan(0);
  },
};
export const RTL: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import { ButtonGroup } from '@jfrader/ui';

<ButtonGroup aria-label="Document actions" dir="rtl" orientation="horizontal" variant="outline" tone="neutral" size="md">
  <ButtonGroup.Item>Share</ButtonGroup.Item>
  <ButtonGroup.Item>Duplicate</ButtonGroup.Item>
  <ButtonGroup.Item>Archive</ButtonGroup.Item>
</ButtonGroup>` } } },
  args: { dir: 'rtl' },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const items = canvas.getAllByRole('button');
    canvasElement.tabIndex = -1;
    canvasElement.focus();
    await userEvent.tab();
    canvasElement.removeAttribute('tabindex');
    await userEvent.keyboard('{ArrowLeft}');
    await expect(canvasElement.ownerDocument.activeElement).toBe(items[1]);
    await userEvent.keyboard('{ArrowRight}{ArrowRight}');
    await expect(canvasElement.ownerDocument.activeElement).toBe(items[2]);
    await expect(parseFloat(getComputedStyle(items[0]!).borderTopRightRadius)).toBeGreaterThan(0);
    await expect(parseFloat(getComputedStyle(items[0]!).borderTopLeftRadius)).toBe(0);
    await expect(parseFloat(getComputedStyle(items[2]!).borderTopLeftRadius)).toBeGreaterThan(0);
  },
};
export const KeyboardActivation: Story = {
  args: { onClick: fn() },
  render: ({ onClick, ...args }) => (
    <>
      <ButtonGroup {...args}>
        <ButtonGroup.Item onClick={onClick}>Share</ButtonGroup.Item>
        <ButtonGroup.Item disabled>Duplicate</ButtonGroup.Item>
        <ButtonGroup.Label>0</ButtonGroup.Label>
        <ButtonGroup.Item onClick={onClick}>Archive</ButtonGroup.Item>
      </ButtonGroup>
      <FixtureButton>After</FixtureButton>
    </>
  ),
  play: async ({ args, canvas, canvasElement, userEvent }) => {
    const share = canvas.getByRole('button', { name: 'Share' }),
      archive = canvas.getByRole('button', { name: 'Archive' }),
      after = canvas.getByRole('button', { name: 'After' });
    canvasElement.tabIndex = -1;
    canvasElement.focus();
    await userEvent.tab();
    canvasElement.removeAttribute('tabindex');
    await expect(canvasElement.ownerDocument.activeElement).toBe(share);
    await expect(getComputedStyle(share).outlineStyle).not.toBe('none');
    await expect(Math.abs(parseFloat(getComputedStyle(share).outlineWidth) - 2)).toBeLessThan(1.1);
    await userEvent.tab();
    await expect(canvasElement.ownerDocument.activeElement).toBe(archive);
    await userEvent.tab();
    await expect(canvasElement.ownerDocument.activeElement).toBe(after);
    await userEvent.tab({ shift: true });
    await expect(canvasElement.ownerDocument.activeElement).toBe(archive);
    await userEvent.tab({ shift: true });
    await expect(canvasElement.ownerDocument.activeElement).toBe(share);
    await userEvent.keyboard('{ArrowLeft}');
    await expect(canvasElement.ownerDocument.activeElement).toBe(archive);
    await userEvent.keyboard('{ArrowRight}{End}{Home}');
    await expect(canvasElement.ownerDocument.activeElement).toBe(share);
    await expect(args.onClick).not.toHaveBeenCalled();
    await userEvent.keyboard('{Enter}');
    await expect(args.onClick).toHaveBeenCalledTimes(1);
    await expect(args.onClick).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: 'click', currentTarget: null }),
    );
    await userEvent.keyboard('[Space]');
    await expect(args.onClick).toHaveBeenCalledTimes(2);
    await userEvent.click(canvas.getByRole('button', { name: 'Duplicate' }));
    await expect(args.onClick).toHaveBeenCalledTimes(2);
  },
};
export const Disabled: Story = {
  args: { disabled: true, onClick: fn() },
  render: ({ onClick, ...args }) => (
    <ButtonGroup {...args}>
      <ButtonGroup.Item onClick={onClick}>Share</ButtonGroup.Item>
      <ButtonGroup.Item disabled={false} onClick={onClick}>
        Duplicate
      </ButtonGroup.Item>
      <ButtonGroup.Link href="#disabled" onClick={onClick}>
        Docs
      </ButtonGroup.Link>
    </ButtonGroup>
  ),
  play: async ({ args, canvas, userEvent }) => {
    await expect(canvas.getByRole('group')).not.toHaveAttribute('aria-disabled');
    for (const button of canvas.getAllByRole('button')) {
      await expect(button).toBeDisabled();
      await userEvent.click(button);
    }
    const link = canvas.getByText('Docs').closest('a')!;
    await expect(link).not.toHaveAttribute('href');
    await expect(link).toHaveAttribute('tabindex', '-1');
    await userEvent.click(link);
    await expect(args.onClick).not.toHaveBeenCalled();
  },
};
export const DisabledItems: Story = {
  args: { onClick: fn() },
  render: ({ onClick, ...args }) => (
    <ButtonGroup {...args}>
      <ButtonGroup.Item>Share</ButtonGroup.Item>
      <ButtonGroup.Item aria-disabled onClick={onClick}>
        Duplicate
      </ButtonGroup.Item>
      <ButtonGroup.Item disabled>Archive</ButtonGroup.Item>
    </ButtonGroup>
  ),
  play: async ({ args, canvas, userEvent }) => {
    const item = canvas.getByRole('button', { name: 'Duplicate' });
    await userEvent.click(item);
    await userEvent.keyboard('{Enter}[Space]');
    await expect(args.onClick).not.toHaveBeenCalled();
    await expect(item.tabIndex).toBe(0);
  },
};
export const EmptyGroup: Story = {
  render: (args) => <ButtonGroup {...args} />,
};
export const IconOnly: Story = {
  render: (args) => (
    <ButtonGroup {...args}>
      <ButtonGroup.Item iconOnly label="Add page" startIcon={<Icon />} />
      <ButtonGroup.Item iconOnly aria-label="Add section" startIcon={<Icon />} />
    </ButtonGroup>
  ),
  play: async ({ canvas, canvasElement, userEvent }) => {
    canvasElement.tabIndex = -1;
    canvasElement.focus();
    await userEvent.tab();
    canvasElement.removeAttribute('tabindex');
    await expect(canvas.getByRole('button', { name: 'Add page' })).toHaveFocus();
    await expect(await within(canvasElement.ownerDocument.body).findByRole('tooltip')).toHaveTextContent(
      'Add page',
    );
    await userEvent.keyboard('{Escape}');
  },
};
export const ZoomValue: Story = {
  render: (args) => (
    <ButtonGroup {...args} aria-label="Zoom">
      <ButtonGroup.Item aria-label="Zoom out">−</ButtonGroup.Item>
      <ButtonGroup.Label>
        {new Intl.NumberFormat(undefined, { style: 'percent' }).format(1)}
      </ButtonGroup.Label>
      <ButtonGroup.Item aria-label="Zoom in">+</ButtonGroup.Item>
    </ButtonGroup>
  ),
};
export const Link: Story = {
  name: 'Actions and navigation',
  parameters: { docs: {
    description: { story: 'Place a documentation link beside a button without changing native link activation.' },
    source: { language: 'tsx', code: `import { ButtonGroup } from '@jfrader/ui';

<ButtonGroup aria-label="Document actions" orientation="horizontal" variant="outline" tone="neutral" size="md">
  <ButtonGroup.Item>Share</ButtonGroup.Item>
  <ButtonGroup.Link href="#docs">Documentation</ButtonGroup.Link>
</ButtonGroup>` },
  } },
  args: { onClick: fn((event) => event.preventDefault()) },
  render: ({ onClick, ...args }) => (
    <ButtonGroup {...args}>
      <ButtonGroup.Item>Share</ButtonGroup.Item>
      <ButtonGroup.Link href="#docs" onClick={onClick}>
        Documentation
      </ButtonGroup.Link>
    </ButtonGroup>
  ),
  play: async ({ args, canvas, userEvent }) => {
    const link = canvas.getByRole('link', { name: 'Documentation' });
    await expect(link).toHaveAttribute('href', '#docs');
    link.focus();
    await userEvent.keyboard('[Space]');
    await expect(args.onClick).not.toHaveBeenCalled();
    await userEvent.keyboard('{Enter}');
    await expect(args.onClick).toHaveBeenCalledTimes(1);
  },
};
const MenuExample = (args: ButtonGroupProps) => (
  <>
    <ButtonGroup {...args}>
      <ButtonGroup.Item>Share</ButtonGroup.Item>
      <ButtonGroup.Trigger aria-label="More actions" />
      <ButtonGroup.Content>
        <ButtonGroup.MenuItem>Duplicate</ButtonGroup.MenuItem>
        <ButtonGroup.MenuItem disabled>Move</ButtonGroup.MenuItem>
        <ButtonGroup.Separator />
        <ButtonGroup.MenuItem tone="danger">Delete</ButtonGroup.MenuItem>
      </ButtonGroup.Content>
    </ButtonGroup>
    <FixtureButton>After</FixtureButton>
  </>
);
MenuExample.displayName = 'MenuExample';
const menuRender: NonNullable<Story['render']> = (args) => <MenuExample {...args} />;
export const WithMenu: Story = {
  name: 'Overflow menu',
  parameters: { docs: {
    description: { story: 'Open More actions to reach secondary commands and a destructive action.' },
    source: { language: 'tsx', code: `import { ButtonGroup, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const NextAction = styled.button({ minInlineSize: vars.space[8], minBlockSize: vars.space[8] });

<>
  <ButtonGroup aria-label="Document actions" orientation="horizontal" variant="outline" tone="neutral" size="md">
    <ButtonGroup.Item>Share</ButtonGroup.Item>
    <ButtonGroup.Trigger aria-label="More actions" />
    <ButtonGroup.Content>
      <ButtonGroup.MenuItem>Duplicate</ButtonGroup.MenuItem>
      <ButtonGroup.MenuItem disabled>Move</ButtonGroup.MenuItem>
      <ButtonGroup.Separator />
      <ButtonGroup.MenuItem tone="danger">Delete</ButtonGroup.MenuItem>
    </ButtonGroup.Content>
  </ButtonGroup>
  <NextAction>After</NextAction>
</>` },
  } },
  args: { onOpenChange: fn() },
  render: menuRender,
  play: async ({ args, canvas, canvasElement, userEvent }) => {
    const trigger = canvas.getByRole('button', { name: 'More actions' }),
      body = within(canvasElement.ownerDocument.body);
    trigger.focus();
    await userEvent.keyboard('{ArrowUp}');
    const last = await body.findByRole('menuitem', { name: 'Delete' });
    await waitFor(async () => {
      await expect(canvasElement.ownerDocument.activeElement).toBe(last);
    });
    await userEvent.keyboard('{Home}');
    await expect(body.getByRole('menuitem', { name: 'Duplicate' })).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    await expect(last).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    await waitFor(async () => {
      await expect(trigger).toHaveFocus();
    });
    await expect(args.onOpenChange).toHaveBeenCalledTimes(2);
    await expect(args.onOpenChange).toHaveBeenNthCalledWith(1, true);
    await expect(args.onOpenChange).toHaveBeenNthCalledWith(2, false);
    await userEvent.keyboard('{ArrowDown}');
    await body.findByRole('menu');
    await userEvent.keyboard('d');
    await userEvent.keyboard('{Enter}');
    await waitFor(async () => {
      await expect(trigger).toHaveFocus();
    });
    await expect(args.onOpenChange).toHaveBeenCalledTimes(4);
  },
};
export const PersistentOpen: Story = {
  tags: ['!autodocs'],
  args: { open: true },
  render: menuRender,
};
export const ControlledReject: Story = {
  args: { open: false, onOpenChange: fn() },
  render: menuRender,
  play: async ({ args, canvas, userEvent }) => {
    const trigger = canvas.getByRole('button', { name: 'More actions' });
    await userEvent.click(trigger);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenCalledWith(true);
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  },
};
export const ControlledRejectClose: Story = {
  tags: ['!autodocs'],
  args: { open: true, onOpenChange: fn() },
  render: menuRender,
  play: async ({ args, canvasElement, userEvent }) => {
    const body = within(canvasElement.ownerDocument.body),
      item = await body.findByRole('menuitem', { name: 'Duplicate' });
    item.focus();
    await userEvent.keyboard('{Escape}');
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenCalledWith(false);
    await expect(body.getByRole('menu')).toBeInTheDocument();
    await expect(item).toHaveFocus();
  },
};
export const VerticalMenu: Story = {
  ...WithMenu,
  args: { orientation: 'vertical', onOpenChange: fn() },
};
export const AriaMerge: Story = {
  args: { ref: fn() },
  render: (args) => (
    <>
      <span id="button-group-name">Editing</span>
      <span id="button-group-description">Current document</span>
      <ButtonGroup
        {...args}
        aria-label="Fallback"
        aria-labelledby="button-group-name"
        aria-describedby="button-group-description"
      >
        <ButtonGroup.Item
          aria-label="Share document"
          aria-labelledby="unresolved-item-name"
          aria-describedby="button-group-description"
        >
          Share
        </ButtonGroup.Item>
        <ButtonGroup.Item
          aria-label="Add"
          startIcon={<Icon />}
          iconOnly
          aria-describedby="button-group-description"
        />
        <ButtonGroup.Trigger aria-label="More" />
        <ButtonGroup.Content
          aria-label="Commands"
          aria-labelledby="button-group-name"
          aria-describedby="button-group-description"
        >
          <ButtonGroup.MenuItem>Duplicate</ButtonGroup.MenuItem>
        </ButtonGroup.Content>
      </ButtonGroup>
    </>
  ),
  play: async ({ args, canvas, canvasElement, userEvent }) => {
    const group = canvas.getByRole('group', { name: 'Editing' });
    await expect(args.ref).toHaveBeenLastCalledWith(group);
    const share = canvas.getByRole('button', { name: 'Share document' });
    await expect(share).toHaveAttribute('aria-labelledby', 'unresolved-item-name');
    await expect(share).toHaveAttribute('aria-label', 'Share document');
    await expect(share).toHaveAttribute('aria-describedby', 'button-group-description');
    const add = canvas.getByRole('button', { name: 'Add' });
    await userEvent.click(add);
    add.focus();
    await userEvent.keyboard('{Tab}{Shift>}{Tab}{/Shift}');
    const tooltip = await within(canvasElement.ownerDocument.body).findByRole('tooltip');
    await expect(add.getAttribute('aria-describedby')?.split(' ')).toEqual(
      expect.arrayContaining(['button-group-description', tooltip.id]),
    );
    await userEvent.keyboard('{Escape}');
  },
};
export const FalsyContent: Story = {
  render: (args) => (
    <Stack>
      {([false, null, 0, ''] as const).map((value, index) => (
        <ButtonGroup {...args} key={index} aria-label={`Content ${index}`}>
          <ButtonGroup.Item aria-label={value === 0 ? undefined : 'Add'} startIcon={value} endIcon={value}>
            {value}
          </ButtonGroup.Item>
          <ButtonGroup.Label data-testid={`value-${index}`}>{value}</ButtonGroup.Label>
        </ButtonGroup>
      ))}
    </Stack>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByTestId('value-2')).toHaveTextContent('0');
    for (const index of [0, 1, 3]) {
      await expect(canvas.getByTestId(`value-${index}`)).toBeEmptyDOMElement();
      const item = within(canvas.getAllByRole('group')[index]!).getByRole('button');
      await expect(item.querySelector('[aria-hidden]')).toBeNull();
    }
  },
};
function ReservedExample({
  args,
  reserveLabels = ['Save', 'Changes saved'],
}: {
  args: Parameters<NonNullable<Story['render']>>[0];
  reserveLabels?: readonly string[];
}) {
  const [saved, setSaved] = useState(false);
  return (
    <ButtonGroup {...args}>
      <ButtonGroup.Item onClick={() => setSaved(!saved)} reserveLabels={reserveLabels} data-testid="reserved">
        {saved ? 'Changes saved' : 'Save'}
      </ButtonGroup.Item>
      <ButtonGroup.Item>Duplicate</ButtonGroup.Item>
    </ButtonGroup>
  );
}
export const ReservedLabels: Story = {
  render: (args) => <ReservedExample args={args} />,
  beforeEach: () => {
    const errors = spyOn(console, 'error');
    return () => errors.mockRestore();
  },
  play: async ({ canvas, userEvent }) => {
    const item = canvas.getByTestId('reserved'),
      before = item.getBoundingClientRect().width;
    const labelParts = () =>
      [...item.querySelectorAll('[data-button-group-labels] > span')].map((node) => [
        node.textContent,
        node.hasAttribute('data-live') ? 'live' : 'reservation',
      ]);
    for (const live of ['Changes saved', 'Save', 'Changes saved']) {
      await userEvent.click(item);
      await expect(item).toHaveAccessibleName(live);
      await expect(labelParts()).toEqual([
        ['Save', 'reservation'],
        ['Changes saved', 'reservation'],
        [live, 'live'],
      ]);
      await expect(Math.abs(item.getBoundingClientRect().width - before)).toBeLessThan(1.1);
    }
    const keyWarnings = (console.error as Mock).mock.calls.filter(([message]) =>
      /same key/.test(String(message)),
    );
    await expect(keyWarnings).toEqual([]);
  },
};
export const RepeatedReservedLabels: Story = {
  ...ReservedLabels,
  render: (args) => <ReservedExample args={args} reserveLabels={['Save', 'Changes saved', 'Save']} />,
};
function CompactExample({ args }: { args: Parameters<NonNullable<Story['render']>>[0] }) {
  const [wide, setWide] = useState(false);
  return (
    <div>
      <div style={{ width: wide ? FIXTURE_WIDTHS.wide : FIXTURE_WIDTHS.narrow, maxInlineSize: '100%' }}>
        <ButtonGroup {...args}>
          <ButtonGroup.Item label="Add document" startIcon={<Icon />}>
            Añadir documento compartido
          </ButtonGroup.Item>
          <ButtonGroup.Item label="Add section" startIcon={<Icon />}>
            Añadir una nueva sección
          </ButtonGroup.Item>
          <ButtonGroup.Item>Archive</ButtonGroup.Item>
        </ButtonGroup>
      </div>
      <FixtureButton onClick={() => setWide(!wide)}>
        Resize
      </FixtureButton>
    </div>
  );
}
export const CollapseAt320px: Story = {
  render: (args) => <CompactExample args={args} />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    const group = canvas.getByRole('group');
    await waitFor(async () => {
      await expect(group).toHaveAttribute('data-compact');
    });
    await expect(canvas.getByRole('button', { name: 'Add document' })).toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: 'Resize' }));
    await expect(group.getBoundingClientRect().right).toBeLessThanOrEqual(canvasElement.getBoundingClientRect().right + 1);
    if (group.parentElement!.clientWidth < FIXTURE_WIDTHS.wide) return;
    await waitFor(async () => {
      await expect(group).not.toHaveAttribute('data-compact');
    });
    await expect(canvas.getByRole('button', { name: 'Añadir documento compartido' })).toBeInTheDocument();
  },
};
export const PersistentCompact: Story = {
  ...CollapseAt320px,
  play: async ({ canvas }) => {
    await waitFor(async () => {
      await expect(canvas.getByRole('group')).toHaveAttribute('data-compact');
    });
    await expect(canvas.getByRole('button', { name: 'Add document' })).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Add section' })).toBeInTheDocument();
  },
};
export const LongLocalizedLabels: Story = {
  args: { collapseLabels: false, orientation: 'vertical' },
  render: (args) => (
    <NarrowContainer>
      <ButtonGroup {...args}>
        <ButtonGroup.Item>Alle ausgewählten Dokumente gemeinsam veröffentlichen</ButtonGroup.Item>{' '}
        <ButtonGroup.Item>Ausgewählte Dokumente archivieren</ButtonGroup.Item>
      </ButtonGroup>
    </NarrowContainer>
  ),
  play: async ({ canvas }) => {
    const group = canvas.getByRole('group'),
      item = canvas.getAllByRole('button')[0]!;
    await expect(item.scrollWidth - item.clientWidth).toBeLessThan(1.1);
    await expect(group.getBoundingClientRect().width).toBeLessThanOrEqual(321);
  },
};
export const ThemeRootPortal: Story = {
  tags: ['!autodocs'],
  render: (args) => (
    <ThemeRoot theme="light" sx={{ backgroundColor: vars.color.surface, padding: vars.space[4] }}>
      <ButtonGroup {...args} open>
        <ButtonGroup.Trigger aria-label="More actions" />
        <ButtonGroup.Content>
          <ButtonGroup.MenuItem>Duplicate</ButtonGroup.MenuItem>
        </ButtonGroup.Content>
      </ButtonGroup>
    </ThemeRoot>
  ),
  play: async ({ canvasElement }) => {
    const menu = await within(canvasElement.ownerDocument.body).findByRole('menu');
    await expect(menu.closest('[data-theme="light"]')).not.toBeNull();
  },
};
export const PointerCancel: Story = {
  play: async ({ canvas, userEvent }) => {
    const group = canvas.getByRole('group');
    await userEvent.hover(canvas.getAllByRole('button')[0]!);
    const highlight = group.querySelector<HTMLElement>('[data-button-group-highlight]')!;
    await waitFor(async () => {
      await expect(getComputedStyle(highlight).opacity).toBe('1');
    });
    group.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true }));
    await waitFor(async () => {
      await expect(getComputedStyle(highlight).opacity).toBe('0');
    });
  },
};
export const PreventDefault: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import { ButtonGroup } from '@jfrader/ui';

<ButtonGroup
  aria-label="Document actions"
  orientation="horizontal"
  variant="outline"
  tone="neutral"
  size="md"
  onKeyDown={(event) => event.preventDefault()}
>
  <ButtonGroup.Item>Share</ButtonGroup.Item>
  <ButtonGroup.Item>Duplicate</ButtonGroup.Item>
  <ButtonGroup.Item>Archive</ButtonGroup.Item>
</ButtonGroup>` } } },
  args: { onKeyDown: fn((event) => event.preventDefault()) },
  play: async ({ args, canvas, userEvent }) => {
    const items = canvas.getAllByRole('button');
    items[0]!.focus();
    await userEvent.keyboard('{ArrowRight}');
    await expect(items[0]).toHaveFocus();
    await expect(args.onKeyDown).toHaveBeenCalledTimes(1);
  },
};
export const SxPrecedence: Story = {
  render: (args) => (
    <ClassNames>
      {({ css: className }) => (
        <ButtonGroup {...args} className={className({ columnGap: '5px' })} sx={{ columnGap: '7px' }}>
          <ButtonGroup.Item className={className(itemCss)} sx={{ paddingInline: '37px', borderRadius: '17px' }}>
            Share
          </ButtonGroup.Item>
          <ButtonGroup.Label className={className(itemCss)} sx={{ paddingInline: '37px' }}>
            100%
          </ButtonGroup.Label>
          <ButtonGroup.Link href="#docs" sx={itemCss}>
            Docs
          </ButtonGroup.Link>
        </ButtonGroup>
      )}
    </ClassNames>
  ),
  play: async ({ canvas }) => {
    await expect(parseFloat(getComputedStyle(canvas.getByText('100%')).paddingInlineStart)).toBeCloseTo(
      37,
      0,
    );
    await expect(
      parseFloat(getComputedStyle(canvas.getByRole('link', { name: 'Docs' })).paddingInlineStart),
    ).toBeCloseTo(29, 0);
    await expect(parseFloat(getComputedStyle(canvas.getByRole('group')).columnGap)).toBeCloseTo(7, 0);
    await expect(parseFloat(getComputedStyle(canvas.getByRole('button')).borderTopRightRadius)).toBeCloseTo(
      17,
      0,
    );
    await expect(parseFloat(getComputedStyle(canvas.getByRole('button')).paddingInlineStart)).toBeCloseTo(
      37,
      0,
    );
  },
};
export const ReducedMotion: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Enable reduced motion in the browser to check this example. The play does not set the preference.',
      },
    },
  },
};
export const ForcedColors: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Enable forced colors in the browser to check this example. The play does not set the preference.',
      },
    },
  },
};

export const MenuSelection: Story = {
  args: { onMenuSelect: fn(), onOpenChange: fn() },
  render: ({ onMenuSelect, ...args }) => (
    <ButtonGroup {...args}>
      <ButtonGroup.Trigger aria-label="More actions" />
      <ButtonGroup.Content>
        <ButtonGroup.MenuItem onSelect={onMenuSelect}>Duplicate</ButtonGroup.MenuItem>
        <ButtonGroup.MenuItem onClick={(event) => event.preventDefault()} onSelect={onMenuSelect}>
          Keep open
        </ButtonGroup.MenuItem>
      </ButtonGroup.Content>
    </ButtonGroup>
  ),
  play: async ({ args, canvas, canvasElement, userEvent }) => {
    const trigger = canvas.getByRole('button', { name: 'More actions' });
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(trigger);
    await userEvent.click(await body.findByRole('menuitem', { name: 'Keep open' }));
    await expect(args.onMenuSelect).not.toHaveBeenCalled();
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(body.getByRole('menu')).toBeInTheDocument();
    await userEvent.click(body.getByRole('menuitem', { name: 'Duplicate' }));
    await expect(args.onMenuSelect).toHaveBeenCalledTimes(1);
    await expect(args.onMenuSelect).toHaveBeenCalledWith();
    await expect(args.onOpenChange).toHaveBeenCalledTimes(2);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);
    await waitFor(async () => {
      await expect(trigger).toHaveFocus();
    });
  },
};

export const DisabledMenuTrigger: Story = {
  args: { onOpenChange: fn() },
  render: (args) => (
    <ButtonGroup {...args}>
      <ButtonGroup.Item>Share</ButtonGroup.Item>
      <ButtonGroup.Trigger aria-label="More actions" aria-disabled />
      <ButtonGroup.Content>
        <ButtonGroup.MenuItem>Duplicate</ButtonGroup.MenuItem>
      </ButtonGroup.Content>
    </ButtonGroup>
  ),
  play: async ({ args, canvas, userEvent }) => {
    const trigger = canvas.getByRole('button', { name: 'More actions' });
    await userEvent.click(trigger);
    trigger.focus();
    await userEvent.keyboard('{ArrowUp}{ArrowDown}{Enter}[Space]');
    await expect(args.onOpenChange).not.toHaveBeenCalled();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger.tabIndex).toBe(0);
  },
};

export const HighlightGeometry: Story = {
  render: (args) => (
    <ScaledContainer>
      <ButtonGroup
        {...args}
        collapseLabels={false}
        sx={{ border: '2px solid', borderColor: vars.color.borderControl }}
      >
        <ButtonGroup.Item>Share</ButtonGroup.Item>
        <ButtonGroup.Item>Duplicate document</ButtonGroup.Item>
        <ButtonGroup.Item>Archive</ButtonGroup.Item>
      </ButtonGroup>
    </ScaledContainer>
  ),
  play: async ({ canvas, userEvent }) => {
    const group = canvas.getByRole('group'),
      items = canvas.getAllByRole('button');
    const highlight = group.querySelector<HTMLElement>('[data-button-group-highlight]')!;
    for (const item of items) {
      await userEvent.hover(item);
      await waitFor(
        async () => {
          await expect(
            Math.abs(highlight.getBoundingClientRect().width - item.getBoundingClientRect().width),
          ).toBeLessThan(1.5);
          await expect(
            Math.abs(highlight.getBoundingClientRect().left - item.getBoundingClientRect().left),
          ).toBeLessThan(1.5);
        },
        { timeout: 2000 },
      );
    }
  },
};

export const NestedGroups: Story = {
  render: (args) => (
    <ButtonGroup {...args}>
      <ButtonGroup.Item>Share</ButtonGroup.Item>
      <ButtonGroup aria-label="Nested actions">
        <ButtonGroup.Item>Add</ButtonGroup.Item>
        <ButtonGroup.Item>Remove</ButtonGroup.Item>
      </ButtonGroup>
      <ButtonGroup.Item>Archive</ButtonGroup.Item>
    </ButtonGroup>
  ),
  play: async ({ canvas, userEvent }) => {
    const share = canvas.getByRole('button', { name: 'Share' }),
      archive = canvas.getByRole('button', { name: 'Archive' });
    share.focus();
    await userEvent.keyboard('{ArrowRight}');
    await expect(archive).toHaveFocus();
    const add = canvas.getByRole('button', { name: 'Add' }),
      remove = canvas.getByRole('button', { name: 'Remove' });
    add.focus();
    await userEvent.keyboard('{ArrowLeft}');
    await expect(remove).toHaveFocus();
  },
};

export const PartRefs: Story = {
  tags: ['!autodocs'],
  args: { onPartRef: fn() },
  render: ({ onPartRef, ...args }) => (
    <ButtonGroup {...args} ref={onPartRef} open>
      <ButtonGroup.Item ref={onPartRef}>Share</ButtonGroup.Item>
      <ButtonGroup.Link ref={onPartRef} href="#docs">
        Docs
      </ButtonGroup.Link>
      <ButtonGroup.Label ref={onPartRef}>100%</ButtonGroup.Label>
      <ButtonGroup.Trigger ref={onPartRef} aria-label="More actions" />
      <ButtonGroup.Content ref={onPartRef}>
        <ButtonGroup.MenuItem ref={onPartRef}>Duplicate</ButtonGroup.MenuItem>
        <ButtonGroup.Separator ref={onPartRef} />
      </ButtonGroup.Content>
    </ButtonGroup>
  ),
  play: async ({ args, canvas, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    const nodes = [
      canvas.getByRole('group'),
      canvas.getByRole('button', { name: 'Share' }),
      canvas.getByRole('link', { name: 'Docs' }),
      canvas.getByText('100%'),
      canvas.getByRole('button', { name: 'More actions' }),
      await body.findByRole('menu'),
      body.getByRole('menuitem'),
      body.getByRole('separator'),
    ];
    for (const node of nodes) await expect(args.onPartRef).toHaveBeenCalledWith(node);
    await expect(ButtonGroup.Item.displayName).toBe('ButtonGroup.Item');
    await expect(ButtonGroup.Link.displayName).toBe('ButtonGroup.Link');
    await expect(ButtonGroup.Label.displayName).toBe('ButtonGroup.Label');
    await expect(ButtonGroup.Trigger.displayName).toBe('ButtonGroup.Trigger');
    await expect(ButtonGroup.Content.displayName).toBe('ButtonGroup.Content');
    await expect(ButtonGroup.MenuItem.displayName).toBe('ButtonGroup.MenuItem');
    await expect(ButtonGroup.Separator.displayName).toBe('ButtonGroup.Separator');
  },
};

export const DefaultOpen: Story = {
  tags: ['!autodocs'], args: { defaultOpen: true }, render: menuRender };

function ControlledMenuExample({ args }: { args: Parameters<NonNullable<Story['render']>>[0] }) {
  const [open, setOpen] = useState(false);
  return (
    <MenuExample
      {...args}
      open={open}
      onOpenChange={(next) => {
        args.onOpenChange?.(next);
        setOpen(next);
      }}
    />
  );
}
ControlledMenuExample.displayName = 'ControlledMenuExample';
export const Controlled: Story = {
  ...WithMenu,
  render: (args) => <ControlledMenuExample args={args} />,
};
