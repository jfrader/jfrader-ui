import type { ComponentPropsWithRef, ReactNode } from 'react';
import { Fragment, useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within, type Mock } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { withLightTheme } from '../../testing/story-decorators';
import { expectThemedSurface } from '../../testing/theme-assertions';
import { Button } from '../button';
import { Popover } from '../popover';
import { Menu, type MenuComposedProps, type MenuShorthandProps } from './index';
// `styled` is the app-facing styling API; consumers import it from `@jfrader/ui`.
import { styled } from '../../index';

const TRIGGER = 'Options';
const LONG_LABEL = 'https://example.com/projects/averylongunbrokendocumentidentifierwithmanycharactersandnospaces';

const onEdit = fn();
const onDelete = fn();

const Row = styled.div({
  display: 'flex',
  gap: vars.space[3],
});

const meta = {
  title: 'Navigation/Menu',
  component: Menu,
  parameters: {
    docs: {
      description: { component: 'Open a menu and choose an action.' },
      sections: [
        { title: 'Basic', stories: ['Default', 'Composed'] },
        { title: 'Customization', stories: ['SlotProps', 'Glass'] },
        { title: 'State', stories: ['Controlled'] },
        { title: 'Keyboard and focus', stories: ['Keyboard', 'Typeahead', 'OutsidePress', 'SelectPreventDefault', 'SelectMovesFocus'] },
      ],
      usage: `### When to use
Use a menu for a short list of actions. Use a select for choosing a form value. Keep a similar-tone backdrop behind translucent menus so text remains readable; reduced transparency uses an opaque fill.

### Keyboard and accessibility

- Give the menu button a clear action label.
- Enter, Space or ArrowDown opens on the first enabled item; ArrowUp opens on the last. Pointer opening also focuses the first item.
- Arrows wrap and skip disabled items; Home/End reach the ends. Typeahead resets after 500ms.
- Escape or selection returns focus to the trigger after an accepted close, unless the selected action already moved focus elsewhere. Outside press and Tab out close without moving focus.
- Shift+Tab from the first item returns to the trigger and leaves the menu open; Tab re-enters it.
- Skipping disabled items and leaving the menu open on Shift+Tab differ from APG. Disabled items stay visible.
- Focus is not trapped. An action can keep the menu open by preventing its click's default behavior.`,
    },
    // Floating UI's focus guards are aria-hidden spans with tabindex=0 that forward focus
    // immediately; axe flags them as aria-hidden-focus (known false positive). Every other
    // aria-hidden element is still checked.
    a11y: {
      config: {
        rules: [{ id: 'aria-hidden-focus', selector: '[aria-hidden="true"]:not([data-floating-ui-focus-guard])' }],
      },
    },
  },
} satisfies Meta<typeof Menu>;

export default meta;

type Story = StoryObj<(props: MenuComposedProps) => ReactNode>;
type ShorthandStory = StoryObj<(props: MenuShorthandProps) => ReactNode>;
// @ts-expect-error Generated-part slot keys are closed.
type UnknownSlot = NonNullable<MenuShorthandProps['slotProps']>['unknown'];
// @ts-expect-error Replacement slot keys are closed.
type UnknownReplacement = NonNullable<MenuShorthandProps['slots']>['unknown'];

function MenuRootAdapter(props: ComponentPropsWithRef<'div'>) {
  return <div {...props} data-testid="custom-menu-root" />;
}
function UnusedMenuRoot() { return null; }

function ReplacementTrigger(props: ComponentPropsWithRef<'button'>) {
  return <button {...props} data-testid="replacement-trigger" />;
}
function ReplacementContent(props: ComponentPropsWithRef<'div'>) {
  return <section {...props} data-testid="replacement-content" />;
}
function ReplacementItem(props: ComponentPropsWithRef<'button'>) {
  return <button {...props} data-testid="replacement-item" />;
}
function ReplacementSeparator(props: ComponentPropsWithRef<'div'>) {
  return <div {...props} data-testid="replacement-separator" />;
}

export const ReplacementSlots: ShorthandStory = {
  args: {
    triggerLabel: 'Replacement actions',
    items: [{ type: 'item', label: 'Edit' }, { type: 'separator' }],
    slots: { trigger: ReplacementTrigger, content: ReplacementContent, item: ReplacementItem, separator: ReplacementSeparator },
    slotProps: {
      trigger: { className: 'replacement-trigger', onClick: fn(), ref: fn() },
      content: { className: 'replacement-content', ref: fn() },
      item: { className: 'replacement-item' },
      separator: { className: 'replacement-separator' },
    },
  },
  render: (args) => <Menu {...args} />,
  play: async ({ canvasElement, args, userEvent }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    const trigger = canvas.getByTestId('replacement-trigger');
    await expect(trigger).toHaveAttribute('data-ui', 'menu-trigger');
    await expect(trigger).toHaveClass('replacement-trigger');
    await expect(trigger.className).toMatch(/css-/);
    await expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    await userEvent.click(trigger);
    await expect(args.slotProps?.trigger?.onClick).toHaveBeenCalled();
    await expect(args.slotProps?.trigger?.ref).toHaveBeenCalledWith(trigger);
    const content = await body.findByTestId('replacement-content');
    await expect(content).toHaveAttribute('data-ui', 'menu');
    await expect(content).toHaveClass('replacement-content');
    await expect(content.className).toMatch(/css-/);
    await expect(content).toHaveAttribute('role', 'menu');
    await expect(trigger).toHaveAttribute('aria-controls', content.id);
    await expect(args.slotProps?.content?.ref).toHaveBeenCalledWith(content);
    const item = body.getByTestId('replacement-item');
    await expect(item).toHaveAttribute('data-ui', 'menu-item');
    await expect(item).toHaveClass('replacement-item');
    await expect(item).toHaveAttribute('role', 'menuitem');
    const separator = body.getByTestId('replacement-separator');
    await expect(separator).toHaveAttribute('data-ui', 'menu-separator');
    await expect(separator).toHaveClass('replacement-separator');
    await expect(separator).toHaveAttribute('role', 'separator');
    await expect(canvasElement.querySelector('[data-ui="menu-trigger"]:not([data-testid="replacement-trigger"])')).toBeNull();
    await expect(canvasElement.ownerDocument.querySelector('div[role="menu"]')).toBeNull();
    await expect(item).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(content).not.toBeInTheDocument());
    await expect(trigger).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.click(await body.findByTestId('replacement-item'));
    await waitFor(() => expect(trigger).toHaveAttribute('aria-expanded', 'false'));
    await expect(trigger).toHaveFocus();
  },
};

/** Restyle the generated trigger and every action with slotProps. */
// This story tests native props and sx forwarded through the slot API.
export const SlotProps: ShorthandStory = {
  name: 'Part props and replacement',
  parameters: { docs: {
    description: { story: 'Replace the outer wrapper and customize the generated trigger and actions.' },
    source: { language: 'tsx', code: `import type { ComponentPropsWithRef } from 'react';
import { Menu } from '@jfrader/ui';

function MenuRoot(props: ComponentPropsWithRef<'div'>) {
  return <div {...props} />;
}

<Menu
  triggerLabel="Actions"
  slots={{ root: MenuRoot }}
  items={[
    { type: 'item', label: 'Edit' },
    { type: 'separator' },
    { type: 'item', label: 'Delete' },
  ]}
  slotProps={{
    root: { 'data-ui': 'menu custom' },
    trigger: { sx: { fontStyle: 'italic' } },
    item: { className: 'custom-action' },
  }}
/>` },
  } },
  args: {
    triggerLabel: 'Actions',
    component: UnusedMenuRoot,
    slots: { root: MenuRootAdapter },
    items: [{ type: 'item', label: 'Edit' }, { type: 'separator' }, { type: 'item', label: 'Delete' }],
    slotProps: { root: { 'data-ui': 'menu custom' }, trigger: { sx: { fontStyle: 'italic' } }, item: { className: 'custom-action' } },
  },
  render: (args) => <Menu {...args} />,
  play: async ({ canvasElement, userEvent }) => {
    await expect(within(canvasElement).getByTestId('custom-menu-root')).toHaveAttribute('data-ui', 'menu custom');
    const trigger = within(canvasElement).getByRole('button', { name: 'Actions' });
    await expect(trigger).toHaveStyle({ fontStyle: 'italic' });
    await userEvent.click(trigger);
    const body = within(canvasElement.ownerDocument.body);
    await expect(body.getByRole('menuitem', { name: 'Edit' })).toHaveClass('custom-action');
    await userEvent.click(body.getByRole('menuitem', { name: 'Edit' }));
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  },
};

export const Default: ShorthandStory = {
  name: 'Shorthand mode',
  args: {
    triggerLabel: TRIGGER,
    items: [
      { type: 'item', label: 'Edit', onSelect: onEdit },
      { type: 'item', label: 'Duplicate', disabled: true },
      { type: 'separator' },
      { type: 'item', label: 'Delete', onSelect: onDelete },
    ],
    onOpenChange: fn(),
    slotProps: { content: { className: 'shorthand-menu-content' } },
  },
  parameters: { docs: {
    description: { story: 'Open Options to choose an action, with a disabled command and a separator.' },
    source: { language: 'tsx', code: `import { Button, Menu, styled, type MenuAction } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const Row = styled.div({ display: 'flex', gap: vars.space[3] });
const actions = [
  { type: 'item', label: 'Edit', onSelect: edit },
  { type: 'item', label: 'Duplicate', disabled: true },
  { type: 'separator' },
  { type: 'item', label: 'Delete', onSelect: remove },
] satisfies MenuAction[];

<Row>
  <Menu triggerLabel="Options" items={actions} slotProps={{ content: { className: 'shorthand-menu-content' } }} />
  <Button>After</Button>
</Row>` } } },
  render: (args) => <Row><Menu {...args} /><Button>After</Button></Row>,
  play: async ({ canvasElement, args, userEvent }) => {
    onEdit.mockClear();
    onDelete.mockClear();
    const trigger = await focusTrigger(canvasElement);
    await userEvent.keyboard('{ArrowDown}');
    const menu = await bodyOf(canvasElement).findByRole('menu', { name: TRIGGER });
    await expect(menu).toHaveClass('shorthand-menu-content');
    await expect(trigger).toHaveAttribute('aria-controls', menu.id);
    await expect(menu).toHaveAttribute('aria-labelledby', trigger.id);
    await expectFocused(canvasElement, 'Edit');
    await expect(getComputedStyle(canvasElement.ownerDocument.activeElement!).outlineStyle).not.toBe('none');
    const disabled = within(menu).getByRole('menuitem', { name: 'Duplicate' });
    await expect(disabled).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(disabled);
    await expect(menu).toBeVisible();
    await userEvent.keyboard('{End}');
    await expectFocused(canvasElement, 'Delete');
    await userEvent.keyboard('{Home}{ArrowDown}');
    await expectFocused(canvasElement, 'Delete');
    await userEvent.keyboard('{Enter}');
    await expect(onDelete).toHaveBeenCalledTimes(1);
    await expectClosed(canvasElement);
    await expect(trigger).toHaveFocus();
    await userEvent.keyboard('{ArrowUp}');
    await expectFocused(canvasElement, 'Delete');
    await userEvent.keyboard('{Escape}');
    await expectClosed(canvasElement);
    await expect(trigger).toHaveFocus();
    await userEvent.click(trigger);
    await expectFocused(canvasElement, 'Edit');
    await userEvent.keyboard('d');
    await expectFocused(canvasElement, 'Delete');
    await userEvent.tab();
    await expectClosed(canvasElement);
    await expect(within(canvasElement).getByRole('button', { name: 'After' })).toHaveFocus();
    await userEvent.click(trigger);
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'After' }));
    await expectClosed(canvasElement);
    await expect(within(canvasElement).getByRole('button', { name: 'After' })).toHaveFocus();
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);
  },
};

export const ShorthandModeOpen: ShorthandStory = { ...Default, tags: ['!autodocs'], name: 'Shorthand mode open', args: { ...Default.args, defaultOpen: true }, play: undefined };
export const ShorthandModeLight: ShorthandStory = { ...ShorthandModeOpen, tags: ['!autodocs'], name: 'Shorthand mode light', decorators: [withLightTheme], globals: { theme: 'light' } };

/** Open a translucent action menu. */
export const Glass: ShorthandStory = {
  args: {
    appearance: 'glass',
    triggerLabel: TRIGGER,
    items: [{ type: 'item', label: 'Edit' }, { type: 'item', label: 'Delete' }],
  },
  name: 'Glass material',
  parameters: { docs: {
    description: { story: 'Open a translucent menu with Edit and Delete actions.' },
    source: { language: 'tsx', code: `import { Menu } from '@jfrader/ui';

<Menu appearance="glass" triggerLabel="Options" items={[
  { type: 'item', label: 'Edit' },
  { type: 'item', label: 'Delete' },
]} />` },
  } },
  render: (args) => <Menu {...args} />,
  play: async ({ canvasElement, userEvent }) => {
    const trigger = await focusTrigger(canvasElement);
    await userEvent.keyboard('{ArrowDown}');
    const menu = await bodyOf(canvasElement).findByRole('menu', { name: TRIGGER });
    await expect(canvasElement.contains(menu)).toBe(false);
    await expect(getComputedStyle(menu).backdropFilter).not.toBe('none');
    await expect(getComputedStyle(menu).backgroundImage).toContain('linear-gradient');
    const reference = menu.ownerDocument.createElement('div');
    reference.style.boxShadow = `inset 0 1px 0 ${vars.color.surfaceHighlight}, ${vars.shadow.overlay}`;
    menu.append(reference);
    try {
      await expect(getComputedStyle(menu).boxShadow).toBe(getComputedStyle(reference).boxShadow);
    } finally {
      reference.remove();
    }
    await expectFocused(canvasElement, 'Edit');
    await expect(getComputedStyle(canvasElement.ownerDocument.activeElement!).outlineStyle).not.toBe('none');
    await userEvent.keyboard('{ArrowDown}');
    await expectFocused(canvasElement, 'Delete');
    await userEvent.keyboard('{Escape}');
    await expectClosed(canvasElement);
    await expect(trigger).toHaveFocus();
    await userEvent.click(trigger);
  },
};

/** The glass popup retains the scoped light palette through its portal. */
export const GlassLight: ShorthandStory = {
  ...Glass,
  decorators: [withLightTheme],
  globals: { theme: 'light' },
  play: async (context) => {
    await Glass.play?.(context);
    const menu = await bodyOf(context.canvasElement).findByRole('menu');
    await expect(menu.closest('[data-theme]')).toHaveAttribute('data-theme', 'light');
  },
};

/** Apply the same glass material to custom menu anatomy. */
export const GlassCompound: Story = {
  args: { appearance: 'glass' },
  parameters: { docs: { source: { language: 'tsx', code: '<Menu appearance="glass"><Menu.Trigger>Options</Menu.Trigger><Menu.Content><Menu.Item>Edit</Menu.Item><Menu.Item>Delete</Menu.Item></Menu.Content></Menu>' } } },
  render: (args) => <Menu {...args}><Menu.Trigger>{TRIGGER}</Menu.Trigger><Menu.Content><Menu.Item>Edit</Menu.Item><Menu.Item>Delete</Menu.Item></Menu.Content></Menu>,
  play: async ({ canvasElement, userEvent }) => {
    await userEvent.click(getTrigger(canvasElement));
    const menu = await bodyOf(canvasElement).findByRole('menu');
    await expect(getComputedStyle(menu).backdropFilter).not.toBe('none');
  },
};

/** Align glass menu actions for right-to-left text. */
export const GlassRTL: ShorthandStory = {
  ...Glass,
  args: { ...Glass.args, slotProps: { trigger: { dir: 'rtl' }, content: { dir: 'rtl' } } },
  parameters: { docs: { source: { language: 'tsx', code: '<Menu appearance="glass" triggerLabel="Options" items={[{ type: "item", label: "Edit" }, { type: "item", label: "Delete" }]} slotProps={{ trigger: { dir: "rtl" }, content: { dir: "rtl" } }} />' } } },
  play: async (context) => {
    await Glass.play?.(context);
    const menu = await bodyOf(context.canvasElement).findByRole('menu');
    await expect(getComputedStyle(menu).direction).toBe('rtl');
    await expect(getComputedStyle(within(menu).getByRole('menuitem', { name: 'Edit' })).textAlign).toBe('start');
  },
};

/** Reduced transparency replaces the glass popup with an opaque surface. */
export const ReducedTransparency: ShorthandStory = {
  ...Glass,
  name: 'Reduced Transparency',
  tags: ['!autodocs'],
  play: async ({ canvasElement, userEvent }) => {
    await expect(window.matchMedia('(prefers-reduced-transparency: reduce)').matches).toBe(true);
    await userEvent.click(getTrigger(canvasElement));
    const menu = await bodyOf(canvasElement).findByRole('menu');
    const reference = menu.ownerDocument.createElement('div');
    reference.style.backgroundColor = vars.color.surfaceRaised;
    menu.append(reference);
    try {
      const style = getComputedStyle(menu);
      await expect(style.backgroundColor).toBe(getComputedStyle(reference).backgroundColor);
      await expect(style.backgroundImage).toBe('none');
      await expect(style.backdropFilter).toBe('none');
    } finally {
      reference.remove();
    }
  },
};

export const ShorthandModeRejectedClose: ShorthandStory = {
  ...Default,
  tags: ['!autodocs'],
  name: 'Shorthand mode rejected close',
  args: { ...Default.args, open: true },
  play: async ({ canvasElement, args, userEvent }) => {
    await expectFocused(canvasElement, 'Edit');
    await userEvent.keyboard('{Escape}');
    await expect(args.onOpenChange).toHaveBeenCalledWith(false);
    await expect(bodyOf(canvasElement).getByRole('menu')).toBeVisible();
    await expectFocused(canvasElement, 'Edit');
  },
};

function shorthandModeTypeContracts() {
  // @ts-expect-error Collection mode rejects composed children.
  <Menu triggerLabel="Actions" items={[]}>Composed</Menu>;
  // @ts-expect-error Collection mode requires its trigger label.
  <Menu items={[]} />;
  // @ts-expect-error Separators cannot carry selection callbacks.
  <Menu triggerLabel="Actions" items={[{ type: 'separator', onSelect: onEdit }]} />;
}
void shorthandModeTypeContracts;

function MenuExample(props: MenuComposedProps) {
  return (
    <Row>
      <Menu {...props}>
        <Menu.Trigger>{TRIGGER}</Menu.Trigger>
        <Menu.Content>
          <Menu.Item onSelect={onEdit}>Edit</Menu.Item>
          <Menu.Item disabled>Duplicate</Menu.Item>
          <Menu.Separator />
          <Menu.Item onSelect={onDelete}>Delete</Menu.Item>
        </Menu.Content>
      </Menu>
      <Button>After</Button>
    </Row>
  );
}
MenuExample.displayName = 'MenuExample';

function ControlledMenu(props: MenuComposedProps) {
  const [open, setOpen] = useState(false);
  return (
    <MenuExample
      {...props}
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        props.onOpenChange?.(next);
      }}
    />
  );
}
ControlledMenu.displayName = 'ControlledMenu';

/** Portaled content lives in the story document's body, outside the canvas. */
function bodyOf(canvasElement: HTMLElement) {
  return within(canvasElement.ownerDocument.body);
}

function mediaRuleSets(element: Element, query: string, property: string, expected: string) {
  return Array.from(element.ownerDocument.styleSheets).some((sheet) =>
    Array.from(sheet.cssRules).some(
      (rule) =>
        rule instanceof CSSMediaRule &&
        rule.conditionText.includes(query) &&
        Array.from(rule.cssRules).some(
          (inner) =>
            inner instanceof CSSStyleRule &&
            element.matches(inner.selectorText) &&
            inner.style.getPropertyValue(property).toLowerCase() === expected,
        ),
    ),
  );
}

const callValues = (spy: unknown) => (spy as Mock).mock.calls.map(([value]) => value);

function getTrigger(canvasElement: HTMLElement) {
  return within(canvasElement).getByRole('button', { name: TRIGGER });
}

async function expectFocused(canvasElement: HTMLElement, name: string) {
  await waitFor(() =>
    expect(canvasElement.ownerDocument.activeElement).toBe(bodyOf(canvasElement).getByRole('menuitem', { name })),
  );
}

async function expectClosed(canvasElement: HTMLElement) {
  await waitFor(() => expect(bodyOf(canvasElement).queryByRole('menu')).toBeNull());
  await expect(getTrigger(canvasElement)).toHaveAttribute('aria-expanded', 'false');
}

async function focusTrigger(canvasElement: HTMLElement) {
  const trigger = getTrigger(canvasElement);
  await userEvent.tab();
  await expect(canvasElement.ownerDocument.activeElement).toBe(trigger);
  return trigger;
}

export const Composed: Story = {
  name: 'Composed anatomy',
  parameters: { docs: {
    description: { story: 'Compose the trigger, actions, and separator explicitly.' },
    source: { language: 'tsx', code: `import { Button, Menu, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const Row = styled.div({ display: 'flex', gap: vars.space[3] });

<Row>
<Menu>
  <Menu.Trigger>Options</Menu.Trigger>
  <Menu.Content>
    <Menu.Item onSelect={edit}>Edit</Menu.Item>
    <Menu.Item disabled>Duplicate</Menu.Item>
    <Menu.Separator />
    <Menu.Item onSelect={remove}>Delete</Menu.Item>
  </Menu.Content>
</Menu>
<Button>After</Button>
</Row>` } } },
  render: (args) => <MenuExample {...args} />,
  play: async ({ canvasElement }) => {
    onEdit.mockClear();
    const trigger = getTrigger(canvasElement);
    await expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger).not.toHaveAttribute('aria-controls');

    await userEvent.click(trigger);
    const menu = await bodyOf(canvasElement).findByRole('menu', { name: TRIGGER });
    await expect(canvasElement.contains(menu)).toBe(false);
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(trigger).toHaveAttribute('aria-controls', menu.id);
    await expect(within(menu).getAllByRole('menuitem')).toHaveLength(3);
    await expect(within(menu).getByRole('separator')).toBeVisible();
    // Pointer open focuses the first enabled item.
    await expectFocused(canvasElement, 'Edit');

    await userEvent.click(within(menu).getByRole('menuitem', { name: 'Edit' }));
    await expect(onEdit).toHaveBeenCalledTimes(1);
    await expectClosed(canvasElement);
    await waitFor(() => expect(canvasElement.ownerDocument.activeElement).toBe(trigger));
  },
};

export const Open: Story = {
  tags: ['!autodocs'],
  args: { defaultOpen: true },
  render: (args) => <MenuExample {...args} />,
  play: async ({ canvasElement }) => {
    // Persistent open state so the axe gate sees the portaled menu.
    const menu = await bodyOf(canvasElement).findByRole('menu', { name: TRIGGER });
    await expect(within(menu).getByRole('menuitem', { name: 'Duplicate' })).toHaveAttribute('aria-disabled', 'true');
  },
};

export const ForcedColors: Story = {
  tags: ['!autodocs'],
  args: { defaultOpen: true },
  render: (args) => <MenuExample {...args} />,
  parameters: {
    docs: {
      description: {
        story:
          'Structural check of the authored separator rules; it does not emulate forced colors. Browser QA verifies the rendered line.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const menu = await bodyOf(canvasElement).findByRole('menu', { name: TRIGGER });
    const separator = within(menu).getByRole('separator');
    await expect(separator).toBeVisible();
    await expect(getComputedStyle(separator).blockSize).toBe('1px');
    await expect(mediaRuleSets(separator, 'forced-colors: active', 'background-color', 'canvastext')).toBe(true);
    await expect(mediaRuleSets(separator, 'forced-colors: active', 'forced-color-adjust', 'none')).toBe(true);
  },
};

export const ScrollableRtl: Story = {
  tags: ['!autodocs'],
  args: { defaultOpen: true },
  render: (args) => (
    <Menu {...args}>
      <Menu.Trigger dir="rtl">Options</Menu.Trigger>
      <Menu.Content dir="rtl">
        {Array.from({ length: 20 }, (_, index) => (
          <Fragment key={index}>
            {index > 0 && index % 5 === 0 && <Menu.Separator />}
            <Menu.Item disabled={index === 1}>
              {index === 0 ? LONG_LABEL : `Project ${index + 1}: review the latest changes before publishing`}
            </Menu.Item>
          </Fragment>
        ))}
      </Menu.Content>
    </Menu>
  ),
  play: async ({ canvasElement, userEvent }) => {
    const menu = await bodyOf(canvasElement).findByRole('menu');
    await expect(getComputedStyle(menu).direction).toBe('rtl');
    await expect(menu.scrollHeight).toBeGreaterThan(menu.clientHeight);
    await expect(menu.getBoundingClientRect().height).toBeLessThanOrEqual(280);
    await expect(menu.scrollWidth).toBeLessThanOrEqual(menu.clientWidth);
    for (const separator of within(menu).getAllByRole('separator')) {
      await expect(separator.getBoundingClientRect().height).toBeGreaterThanOrEqual(1);
    }
    await userEvent.keyboard('{End}');
    const last = within(menu).getAllByRole('menuitem').at(-1)!;
    await waitFor(() => expect(last).toHaveFocus());
    await expect(last.getBoundingClientRect().bottom).toBeLessThanOrEqual(menu.getBoundingClientRect().bottom);
    await userEvent.keyboard('{Home}');
    await expectFocused(canvasElement, LONG_LABEL);
    const first = within(menu).getByRole('menuitem', { name: LONG_LABEL });
    await expect(first.getBoundingClientRect().height).toBeGreaterThan(32);
    for (const item of within(menu).getAllByRole('menuitem')) {
      await expect(item.getBoundingClientRect().height).toBeGreaterThanOrEqual(32);
    }
  },
};

export const Controlled: Story = {
  name: 'Controlled opening',
  parameters: { docs: {
    description: { story: 'Keep opening and dismissal in application state.' },
    source: { language: 'tsx', code: `import { useState } from 'react';
import { Button, Menu, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const Row = styled.div({ display: 'flex', gap: vars.space[3] });

function Actions() {
  const [open, setOpen] = useState(false);
  return (
    <Row>
      <Menu open={open} onOpenChange={setOpen}>
        <Menu.Trigger>Options</Menu.Trigger>
        <Menu.Content>
          <Menu.Item onSelect={edit}>Edit</Menu.Item>
          <Menu.Item disabled>Duplicate</Menu.Item>
          <Menu.Separator />
          <Menu.Item onSelect={remove}>Delete</Menu.Item>
        </Menu.Content>
      </Menu>
      <Button>After</Button>
    </Row>
  );
}` },
  } },
  args: { onOpenChange: fn() },
  render: (args) => <ControlledMenu {...args} />,
  play: async ({ args, canvasElement }) => {
    const trigger = getTrigger(canvasElement);
    await userEvent.click(trigger);
    await bodyOf(canvasElement).findByRole('menu');
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(true);

    await userEvent.click(bodyOf(canvasElement).getByRole('menuitem', { name: 'Delete' }));
    await expectClosed(canvasElement);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(2);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);

    await waitFor(() => expect(canvasElement.ownerDocument.activeElement).toBe(trigger));
    await userEvent.keyboard('{ArrowDown}');
    await expectFocused(canvasElement, 'Edit');
    await expect(args.onOpenChange).toHaveBeenCalledTimes(3);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(true);

    await userEvent.keyboard('{Escape}');
    await expectClosed(canvasElement);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(4);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);
  },
};

export const Keyboard: Story = {
  name: 'Keyboard navigation',
  parameters: { docs: {
    description: { story: 'Open with Enter or an arrow key, then navigate past the disabled action.' },
    source: { language: 'tsx', code: `import { Button, Menu, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const Row = styled.div({ display: 'flex', gap: vars.space[3] });

<Row>
  <Menu>
    <Menu.Trigger>Options</Menu.Trigger>
    <Menu.Content>
      <Menu.Item onSelect={edit}>Edit</Menu.Item>
      <Menu.Item disabled>Duplicate</Menu.Item>
      <Menu.Separator />
      <Menu.Item onSelect={remove}>Delete</Menu.Item>
    </Menu.Content>
  </Menu>
  <Button>After</Button>
</Row>` },
  } },
  render: (args) => <MenuExample {...args} />,
  play: async ({ canvasElement }) => {
    const { ownerDocument } = canvasElement;
    const trigger = await focusTrigger(canvasElement);

    // Enter, Space and ArrowDown each open on the first enabled item.
    for (const key of ['{Enter}', ' ', '{ArrowDown}']) {
      await userEvent.keyboard(key);
      await expectFocused(canvasElement, 'Edit');
      await userEvent.keyboard('{Escape}');
      await expectClosed(canvasElement);
      await waitFor(() => expect(ownerDocument.activeElement).toBe(trigger));
    }

    await userEvent.keyboard('{Enter}');
    await expectFocused(canvasElement, 'Edit');
    const edit = bodyOf(canvasElement).getByRole('menuitem', { name: 'Edit' });
    await expect(getComputedStyle(edit).outlineWidth).not.toBe('0px');

    // The disabled item stays in the menu but arrows skip it.
    const duplicate = bodyOf(canvasElement).getByRole('menuitem', { name: 'Duplicate' });
    await expect(duplicate).toBeVisible();
    await expect(duplicate).toHaveAttribute('aria-disabled', 'true');
    await userEvent.keyboard('{ArrowDown}');
    await expectFocused(canvasElement, 'Delete');

    // Arrows wrap in both directions.
    await userEvent.keyboard('{ArrowDown}');
    await expectFocused(canvasElement, 'Edit');
    await userEvent.keyboard('{ArrowUp}');
    await expectFocused(canvasElement, 'Delete');

    // The active highlight follows the roving focus.
    const deleteItem = bodyOf(canvasElement).getByRole('menuitem', { name: 'Delete' });
    expect(deleteItem.getAttribute('data-active')).not.toBeNull();
    expect(edit.getAttribute('data-active')).toBeNull();

    // Enter activates once, closes and returns focus to the trigger.
    onDelete.mockClear();
    await userEvent.keyboard('{Enter}');
    await expect(onDelete).toHaveBeenCalledTimes(1);
    await expectClosed(canvasElement);
    await waitFor(() => expect(ownerDocument.activeElement).toBe(trigger));

    // Space activates too (ArrowUp reopens on the last enabled item).
    onDelete.mockClear();
    await userEvent.keyboard('{ArrowUp}');
    await expectFocused(canvasElement, 'Delete');
    await userEvent.keyboard(' ');
    await expect(onDelete).toHaveBeenCalledTimes(1);
    await expectClosed(canvasElement);
    await waitFor(() => expect(ownerDocument.activeElement).toBe(trigger));
  },
};

export const ArrowUpOpensLast: Story = {
  render: (args) => <MenuExample {...args} />,
  play: async ({ canvasElement }) => {
    await focusTrigger(canvasElement);
    await userEvent.keyboard('{ArrowUp}');
    await bodyOf(canvasElement).findByRole('menu');
    await expectFocused(canvasElement, 'Delete');
  },
};

export const Typeahead: Story = {
  parameters: { docs: {
    description: { story: 'Type B or S in Settings to focus Billing or Security, skipping disabled Backup.' },
    source: { language: 'tsx', code: `import { Menu } from '@jfrader/ui';

<Menu>
  <Menu.Trigger>Settings</Menu.Trigger>
  <Menu.Content>
    <Menu.Item>Account</Menu.Item>
    <Menu.Item disabled>Backup</Menu.Item>
    <Menu.Item>Billing</Menu.Item>
    <Menu.Item>Security</Menu.Item>
  </Menu.Content>
</Menu>` },
  } },
  render: (args) => (
    <Menu {...args}>
      <Menu.Trigger>Settings</Menu.Trigger>
      <Menu.Content>
        <Menu.Item>Account</Menu.Item>
        <Menu.Item disabled>Backup</Menu.Item>
        <Menu.Item>Billing</Menu.Item>
        <Menu.Item>Security</Menu.Item>
      </Menu.Content>
    </Menu>
  ),
  play: async ({ canvasElement }) => {
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    await expectFocused(canvasElement, 'Account');

    // Typeahead skips the disabled "Backup" and lands on "Billing".
    await userEvent.keyboard('b');
    await expectFocused(canvasElement, 'Billing');

    // After the 500ms reset a new buffer starts ("s", not "bs").
    await new Promise((resolve) => setTimeout(resolve, 600));
    await userEvent.keyboard('s');
    await expectFocused(canvasElement, 'Security');
  },
};

export const EscapeReturnsFocus: Story = {
  render: (args) => <MenuExample {...args} />,
  play: async ({ canvasElement }) => {
    const trigger = await focusTrigger(canvasElement);
    await userEvent.keyboard('{Enter}');
    await expectFocused(canvasElement, 'Edit');
    await userEvent.keyboard('{ArrowDown}');
    await expectFocused(canvasElement, 'Delete');

    await userEvent.keyboard('{Escape}');
    await expectClosed(canvasElement);
    await waitFor(() => expect(canvasElement.ownerDocument.activeElement).toBe(trigger));
  },
};

export const TabMovesOn: Story = {
  render: (args) => <MenuExample {...args} />,
  play: async ({ canvasElement }) => {
    const trigger = await focusTrigger(canvasElement);
    await userEvent.keyboard('{Enter}');
    await expectFocused(canvasElement, 'Edit');

    // Shift+Tab from the first item returns focus to the trigger; the menu stays open while
    // focus is on the reference, and Tab re-enters the menu at the first item.
    await userEvent.tab({ shift: true });
    await waitFor(() => expect(canvasElement.ownerDocument.activeElement).toBe(trigger));
    await expect(bodyOf(canvasElement).getByRole('menu')).toBeVisible();
    await userEvent.tab();
    await expectFocused(canvasElement, 'Edit');

    // Forward from the last item closes the menu and moves on to the next page control.
    await userEvent.keyboard('{ArrowUp}');
    await expectFocused(canvasElement, 'Delete');
    await userEvent.tab();
    await expectClosed(canvasElement);
    await waitFor(() =>
      expect(canvasElement.ownerDocument.activeElement).toBe(
        within(canvasElement).getByRole('button', { name: 'After' }),
      ),
    );
  },
};

export const OutsidePress: Story = {
  name: 'Outside press',
  parameters: { docs: {
    description: { story: 'Click After while the menu is open to dismiss it without returning focus to Options.' },
    source: { language: 'tsx', code: `import { Button, Menu, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const Row = styled.div({ display: 'flex', gap: vars.space[3] });

<Row>
  <Menu>
    <Menu.Trigger>Options</Menu.Trigger>
    <Menu.Content>
      <Menu.Item onSelect={edit}>Edit</Menu.Item>
      <Menu.Item disabled>Duplicate</Menu.Item>
      <Menu.Separator />
      <Menu.Item onSelect={remove}>Delete</Menu.Item>
    </Menu.Content>
  </Menu>
  <Button>After</Button>
</Row>` },
  } },
  render: (args) => <MenuExample {...args} />,
  play: async ({ canvasElement }) => {
    const { ownerDocument } = canvasElement;
    await userEvent.click(getTrigger(canvasElement));
    await bodyOf(canvasElement).findByRole('menu');

    // Record every focus change: an outside press must not transiently focus the trigger.
    const seen: Element[] = [];
    const record = () => {
      if (ownerDocument.activeElement) seen.push(ownerDocument.activeElement);
    };
    ownerDocument.addEventListener('focusin', record);

    const after = within(canvasElement).getByRole('button', { name: 'After' });
    await userEvent.click(after);
    ownerDocument.removeEventListener('focusin', record);

    await expectClosed(canvasElement);
    await expect(ownerDocument.activeElement).toBe(after);
    await expect(seen).not.toContain(getTrigger(canvasElement));
  },
};

export const SelectPreventDefault: Story = {
  name: 'Keep open after selection',
  parameters: { docs: {
    description: { story: 'Choose Edit to run the action without dismissing the menu.' },
    source: { language: 'tsx', code: `import { Menu } from '@jfrader/ui';

<Menu>
  <Menu.Trigger>Options</Menu.Trigger>
  <Menu.Content>
    <Menu.Item onSelect={edit} onClick={(event) => event.preventDefault()}>Edit</Menu.Item>
    <Menu.Item>Delete</Menu.Item>
  </Menu.Content>
</Menu>` },
  } },
  render: (args) => (
    <Menu {...args}>
      <Menu.Trigger>{TRIGGER}</Menu.Trigger>
      <Menu.Content>
        <Menu.Item onSelect={onEdit} onClick={(event) => event.preventDefault()}>
          Edit
        </Menu.Item>
        <Menu.Item>Delete</Menu.Item>
      </Menu.Content>
    </Menu>
  ),
  play: async ({ canvasElement }) => {
    onEdit.mockClear();
    await userEvent.click(getTrigger(canvasElement));
    await userEvent.click(await bodyOf(canvasElement).findByRole('menuitem', { name: 'Edit' }));
    // onSelect still runs; the consumer's preventDefault keeps the menu open.
    await expect(onEdit).toHaveBeenCalledTimes(1);
    await expect(bodyOf(canvasElement).getByRole('menu')).toBeVisible();
  },
};

function RenameExample(props: MenuComposedProps) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <Row>
      <Menu {...props}>
        <Menu.Trigger>{TRIGGER}</Menu.Trigger>
        <Menu.Content>
          <Menu.Item
            onSelect={() => {
              onEdit();
              input.current?.focus();
            }}
          >
            Rename
          </Menu.Item>
        </Menu.Content>
      </Menu>
      <input ref={input} aria-label="Name" />
    </Row>
  );
}

export const SelectMovesFocus: Story = {
  name: 'Move focus after selection',
  parameters: { docs: {
    description: { story: 'Choose Rename to focus the Name field instead of returning to the menu button.' },
    source: { language: 'tsx', code: `import { useRef } from 'react';
import { Menu, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const Row = styled.div({ display: 'flex', gap: vars.space[3] });

function Rename() {
  const input = useRef<HTMLInputElement>(null);
  return (
    <Row>
      <Menu>
        <Menu.Trigger>Options</Menu.Trigger>
        <Menu.Content>
          <Menu.Item onSelect={() => { edit(); input.current?.focus(); }}>Rename</Menu.Item>
        </Menu.Content>
      </Menu>
      <input ref={input} aria-label="Name" />
    </Row>
  );
}` },
  } },
  render: (args) => <RenameExample {...args} />,
  play: async ({ canvasElement }) => {
    onEdit.mockClear();
    const input = within(canvasElement).getByRole('textbox', { name: 'Name' });
    await focusTrigger(canvasElement);
    await userEvent.keyboard('{Enter}');
    await expectFocused(canvasElement, 'Rename');
    await userEvent.keyboard('{Enter}');
    await expect(onEdit).toHaveBeenCalledTimes(1);
    await expectClosed(canvasElement);
    // The accepted close does not pull focus back from where the command sent it.
    await expect(canvasElement.ownerDocument.activeElement).toBe(input);
  },
};

export const LightThemeOpen: Story = {
  tags: ['!autodocs'],
  decorators: [withLightTheme],
  args: { defaultOpen: true },
  render: (args) => <MenuExample {...args} />,
  play: async ({ canvasElement }) => {
    const menu = await bodyOf(canvasElement).findByRole('menu', { name: TRIGGER });
    await expect(menu).toBeVisible();
    await expect(canvasElement.contains(menu)).toBe(false);
    await expectThemedSurface(menu, 'light');
  },
};

export const LightTheme: Story = {
  decorators: [withLightTheme],
  render: (args) => <MenuExample {...args} />,
  play: async ({ canvasElement }) => {
    await userEvent.click(getTrigger(canvasElement));
    const menu = await bodyOf(canvasElement).findByRole('menu');
    await expect(menu).toBeVisible();
    await expectThemedSurface(menu, 'light');
    await userEvent.keyboard('{Escape}');
    await expectClosed(canvasElement);
  },
};

export const TriggerRole: Story = {
  tags: ['!autodocs'],
  render: (args) => <MenuExample {...args} />,
  play: async ({ canvasElement, userEvent }) => {
    const trigger = getTrigger(canvasElement);
    // A native button: no explicit role overrides it, open or closed.
    await expect(trigger).not.toHaveAttribute('role');
    await userEvent.click(trigger);
    await bodyOf(canvasElement).findByRole('menu', { name: TRIGGER });
    await expect(trigger).not.toHaveAttribute('role');
    await expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
  },
};

const popoverOpenChange = fn<(open: boolean) => void>();

function PopoverHost(props: MenuComposedProps) {
  return (
    <Row>
      <Popover defaultOpen onOpenChange={popoverOpenChange}>
        <Popover.Trigger>Project</Popover.Trigger>
        <Popover.Content aria-label="Project">
          <MenuExample {...props} />
        </Popover.Content>
      </Popover>
      <Button>Outside</Button>
    </Row>
  );
}
PopoverHost.displayName = 'PopoverHost';

/** The menu sits in an open popover's content; it is not inside any menu. */
async function findHostedMenuTrigger(canvasElement: HTMLElement) {
  popoverOpenChange.mockClear();
  const popover = await bodyOf(canvasElement).findByRole('dialog', { name: 'Project' });
  return { popover, trigger: within(popover).getByRole('button', { name: TRIGGER }) };
}

async function expectHostedMenuClosed(canvasElement: HTMLElement, trigger: HTMLElement) {
  await waitFor(() => expect(bodyOf(canvasElement).queryByRole('menu')).toBeNull());
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
}

export const InsidePopover: Story = {
  tags: ['!autodocs'],
  args: { onOpenChange: fn() },
  render: (args) => <PopoverHost {...args} />,
  play: async ({ args, canvasElement, userEvent }) => {
    onEdit.mockClear();
    const { popover, trigger } = await findHostedMenuTrigger(canvasElement);
    await expect(trigger).not.toHaveAttribute('role');
    await expect(within(popover).queryByRole('menuitem')).toBeNull();
    await expect(trigger).toHaveAttribute('aria-haspopup', 'menu');

    // Pointer open focuses the first item; selecting closes the menu only.
    await userEvent.click(trigger);
    const menu = await bodyOf(canvasElement).findByRole('menu', { name: TRIGGER });
    await expect(trigger).not.toHaveAttribute('role');
    await expect(trigger).toHaveAttribute('aria-controls', menu.id);
    await expectFocused(canvasElement, 'Edit');
    await userEvent.click(within(menu).getByRole('menuitem', { name: 'Edit' }));
    await expect(onEdit).toHaveBeenCalledTimes(1);
    await expectHostedMenuClosed(canvasElement, trigger);
    await waitFor(() => expect(canvasElement.ownerDocument.activeElement).toBe(trigger));

    // Keyboard open, arrows, then Escape: the menu closes and focus returns to its trigger.
    await userEvent.keyboard('{Enter}');
    await expectFocused(canvasElement, 'Edit');
    await userEvent.keyboard('{ArrowDown}');
    await expectFocused(canvasElement, 'Delete');
    await userEvent.keyboard('{Escape}');
    await expectHostedMenuClosed(canvasElement, trigger);
    await waitFor(() => expect(canvasElement.ownerDocument.activeElement).toBe(trigger));
    await expect(callValues(args.onOpenChange)).toEqual([true, false, true, false]);
    await expect(popoverOpenChange).not.toHaveBeenCalled();
    await expect(popover).toBeVisible();

    // Tab from the last item closes the menu and moves on inside the popover.
    await userEvent.keyboard('{Enter}');
    await expectFocused(canvasElement, 'Edit');
    await userEvent.keyboard('{ArrowUp}');
    await expectFocused(canvasElement, 'Delete');
    await userEvent.tab();
    await expectHostedMenuClosed(canvasElement, trigger);
    await waitFor(() =>
      expect(canvasElement.ownerDocument.activeElement).toBe(within(popover).getByRole('button', { name: 'After' })),
    );
    await expect(callValues(args.onOpenChange)).toEqual([true, false, true, false, true, false]);
    await expect(popoverOpenChange).not.toHaveBeenCalled();

    // A press outside both surfaces closes the menu, its topmost child layer, only.
    await userEvent.click(trigger);
    await expectFocused(canvasElement, 'Edit');
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Outside' }));
    await expectHostedMenuClosed(canvasElement, trigger);
    await expect(within(canvasElement).getByRole('button', { name: 'Outside' })).toHaveFocus();
    await expect(popoverOpenChange).not.toHaveBeenCalled();
    await expect(popover).toBeVisible();
    await expect(callValues(args.onOpenChange)).toEqual([true, false, true, false, true, false, true, false]);

    // With the menu closed, Escape reaches the popover.
    within(popover).getByRole('button', { name: 'After' }).focus();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(bodyOf(canvasElement).queryByRole('dialog')).toBeNull());
    await expect(callValues(popoverOpenChange)).toEqual([false]);
  },
};
