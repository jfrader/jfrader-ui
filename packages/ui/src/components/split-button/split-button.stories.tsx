import { Component, useState, type ComponentPropsWithRef, type MouseEvent, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, spyOn, waitFor, within, type Mock } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { doubleRootText, expectControlMinimums } from '../../testing/control-size-assertions';
import { ClassNames, css } from '../../styling/css';
import { expectThemedSurface } from '../../testing/theme-assertions';
import { Button, type ButtonSize, type ButtonTone, type ButtonVariant } from '../button';
import { ThemeRoot } from '../theme-root';
import {
  SplitButton,
  type SplitButtonActionProps,
  type SplitButtonActionRecord,
  type SplitButtonComposedProps,
  type SplitButtonShorthandProps,
  type SplitButtonItemRecord,
} from './index';
// `styled` is the app-facing styling API; consumers import it from `@jfrader/ui`.
import { styled } from '../../index';

const NarrowFrame = styled.div({ inlineSize: '14rem' });
const exportSnippetBase = `import { Button, SplitButton, styled, type SplitButtonItemRecord } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const Row = styled.div({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: vars.space[3],
});`;

const shorthandSource = `${exportSnippetBase}

function ExportActions({ exportPdf, exportCsv, exportJson, deleteExport }: {
  exportPdf: () => void;
  exportCsv: () => void;
  exportJson: () => void;
  deleteExport: () => void;
}) {
  const items = [
    { label: 'CSV', onSelect: exportCsv },
    { label: 'Excel', disabled: true },
    { label: 'JSON', onSelect: exportJson },
    { type: 'separator' },
    { label: 'Delete export', tone: 'danger', onSelect: deleteExport },
  ] satisfies readonly SplitButtonItemRecord[];

  return <Row>
    <SplitButton label="Export PDF" onClick={exportPdf}
      menuLabel="Other export formats" aria-label="Export options" items={items} />
    <Button>After</Button>
  </Row>;
}`;

const LightThemeFrame = styled.div({ padding: vars.space[4], backgroundColor: vars.color.bg });

const GROUP = 'Export options';
const ACTION = 'Export PDF';
const TRIGGER = 'Other export formats';
const VARIANTS = ['solid', 'soft', 'outline', 'ghost'] as const satisfies readonly ButtonVariant[];
const TONES = ['accent', 'neutral', 'danger'] as const satisfies readonly ButtonTone[];
const SIZES = ['sm', 'md', 'lg'] as const satisfies readonly ButtonSize[];
const SIZE_PX: Record<ButtonSize, number> = { sm: 32, md: 40, lg: 48 };
// Sub-pixel layout and fractional devicePixelRatios: geometry is compared with a tolerance.
const TOLERANCE_PX = 1.5;
// Covers the base label fade (160ms) with margin.
const SETTLE_MS = 240;
// Longer than the menu's 500ms typeahead buffer.
const TYPEAHEAD_RESET_WAIT_MS = 600;

const Row = styled.div({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: vars.space[3],
});

const StackFrame = styled.div({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: vars.space[3],
});

// These values exercise registered classes and sx precedence.
const consumerCss = css({ marginInlineStart: vars.space[1], letterSpacing: '0.05em' });
const consumerSx = css({ marginInlineStart: vars.space[2] });

interface StoryArgs extends SplitButtonComposedProps {
  onAction?: (event: MouseEvent<HTMLButtonElement>) => void;
  onCsv?: () => void;
  onJson?: () => void;
  onDelete?: () => void;
}

function PdfIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 1.5h5l3 3v10H4z" />
      <path d="M8 7v5M6 10l2 2 2-2" />
    </svg>
  );
}
PdfIcon.displayName = 'PdfIcon';

function ExportSplitButton({ onAction, onCsv, onJson, onDelete, ...props }: StoryArgs) {
  return (
    <SplitButton {...props}>
      <SplitButton.Action onClick={onAction}>{ACTION}</SplitButton.Action>
      <SplitButton.Trigger aria-label={TRIGGER} />
      <SplitButton.Content>
        <SplitButton.Item onSelect={onCsv}>CSV</SplitButton.Item>
        <SplitButton.Item disabled>Excel</SplitButton.Item>
        <SplitButton.Item onSelect={onJson}>JSON</SplitButton.Item>
        <SplitButton.Separator />
        <SplitButton.Item tone="danger" onSelect={onDelete}>
          Delete export
        </SplitButton.Item>
      </SplitButton.Content>
    </SplitButton>
  );
}
ExportSplitButton.displayName = 'ExportSplitButton';

function ExportRow(args: StoryArgs) {
  return (
    <Row>
      <ExportSplitButton {...args} />
      <Button>After</Button>
    </Row>
  );
}
ExportRow.displayName = 'ExportRow';

/** Portaled content lives in the story document's body, outside the canvas. */
const bodyOf = (canvasElement: HTMLElement) => within(canvasElement.ownerDocument.body);
const callValues = (spy: unknown) => (spy as Mock).mock.calls.map(([value]) => value);
const getAction = (canvasElement: HTMLElement, name = ACTION) =>
  within(canvasElement).getByRole('button', { name });
const getTrigger = (canvasElement: HTMLElement, name = TRIGGER) =>
  within(canvasElement).getByRole('button', { name });
const getAfter = (canvasElement: HTMLElement) => within(canvasElement).getByRole('button', { name: 'After' });
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function expectActive(canvasElement: HTMLElement, element: Element) {
  await waitFor(() => expect(canvasElement.ownerDocument.activeElement).toBe(element));
}

async function expectItemFocused(canvasElement: HTMLElement, name: string) {
  await waitFor(() =>
    expect(canvasElement.ownerDocument.activeElement).toBe(bodyOf(canvasElement).getByRole('menuitem', { name })),
  );
}

async function expectClosed(canvasElement: HTMLElement, trigger = getTrigger(canvasElement)) {
  await waitFor(() => expect(bodyOf(canvasElement).queryByRole('menu')).toBeNull());
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
}

async function expectFocusRing(element: Element) {
  const style = getComputedStyle(element);
  await expect(style.outlineStyle).not.toBe('none');
  // Fractional devicePixelRatios compute the authored 2px ring as e.g. 1.48837px.
  await expect(Math.abs(parseFloat(style.outlineWidth) - 2)).toBeLessThan(1.1);
}

/** True when a stylesheet rule under `query` matching `element` sets `property` to `expected`. */
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

const meta = {
  title: 'Actions/SplitButton',
  component: SplitButton,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Run an action or choose another action from the menu beside it.',
      },
      sections: [
        { title: 'Basic', stories: ['Basic'] },
        { title: 'Menu actions', stories: ['Composed'] },
        { title: 'Disabled', stories: ['Disabled', 'DisabledParts'] },
        { title: 'Keyboard', stories: ['KeyboardActivation'] },
        { title: 'Placement', stories: ['Placement'] },
        { title: 'Composition', stories: ['WithIcon', 'Controlled'] },
      ],
      usage: `### When to use
Use a split button when one action is the default and related alternatives belong in a menu. Use Menu when there is no default action, or Button when there are no alternatives.

### Values and constraints

Opening the menu never runs the primary action. Choosing a menu item does not replace the default action. Keep both halves named: the icon-only opener needs a translated accessible name.

### Keyboard and accessibility

Tab visits the primary action, then the menu opener. Enter or Space runs the focused action. On the opener, Enter, Space or ArrowDown opens at the first enabled item; ArrowUp opens at the last.

Inside the menu, arrows wrap and skip disabled items; Home and End reach the ends, and typing searches item labels. Enter or Space selects. Escape closes and returns focus to the opener. Tab from the last item closes the menu and moves to the next control.`,
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
  args: {
    'aria-label': GROUP,
    variant: 'solid',
    tone: 'accent',
    size: 'md',
    onOpenChange: fn(),
    onAction: fn(),
    onCsv: fn(),
    onJson: fn(),
    onDelete: fn(),
  },
  argTypes: {
    variant: { control: 'select', options: VARIANTS },
    tone: { control: 'radio', options: TONES },
    size: { control: 'radio', options: SIZES },
    disabled: { control: 'boolean' },
  },
  render: (args) => <ExportRow {...args} />,
} satisfies Meta<StoryArgs>;

export default meta;

function SplitButtonHost(props: ComponentPropsWithRef<'div'>) {
  return <div {...props} data-testid="split-button-host" />;
}
function CustomAction(props: SplitButtonActionProps) {
  return <SplitButton.Action {...props} data-testid="custom-split-action" />;
}

type Story = StoryObj<Omit<StoryArgs, 'component'>>;

function ShorthandExample({
  onAction: _onAction,
  onCsv: _onCsv,
  onJson: _onJson,
  onDelete: _onDelete,
  ...args
}: SplitButtonShorthandProps & Partial<Pick<StoryArgs, 'onAction' | 'onCsv' | 'onJson' | 'onDelete'>>) {
  return (
    <Row>
      <SplitButton {...args} />
      <Button>After</Button>
    </Row>
  );
}

export const Default: StoryObj<Omit<SplitButtonShorthandProps, 'component'>> = {
  name: 'Shorthand mode',
  beforeEach: () => {
    const error = spyOn(console, 'error');
    return () => error.mockRestore();
  },
  args: {
    label: ACTION,
    onClick: fn(),
    menuLabel: TRIGGER,
    'aria-label': GROUP,
    items: [
      { label: 'CSV', onSelect: fn() },
      { label: 'Excel', disabled: true },
      { label: 'JSON', onSelect: fn() },
      { type: 'separator' },
      { label: 'Delete export', tone: 'danger', onSelect: fn() },
    ],
    onOpenChange: fn(),
  },
  parameters: {
    docs: {
      description: { story: 'Run Export PDF directly, or open the adjacent menu for another format.' },
      source: {
        language: 'tsx',
        code: shorthandSource,
      },
    },
  },
  render: (args) => <ShorthandExample {...args} />,
  play: async ({ args, canvasElement, userEvent }) => {
    const group = within(canvasElement).getByRole('group', { name: GROUP });
    await expect(console.error).not.toHaveBeenCalled();
    const action = getAction(canvasElement);
    const trigger = getTrigger(canvasElement);
    await expect(group).toHaveAttribute('data-ui', 'split-button');
    await expect(group.contains(action) && group.contains(trigger)).toBe(true);
    await expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger).not.toHaveAttribute('aria-controls');
    await expect(action).not.toHaveAttribute('aria-haspopup');

    // The Action runs the main action and never opens the menu.
    await userEvent.click(action);
    await expect(args.onClick).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).not.toHaveBeenCalled();
    await expect(bodyOf(canvasElement).queryByRole('menu')).toBeNull();

    // The Trigger opens the menu and never runs the main action.
    await userEvent.click(trigger);
    const menu = await bodyOf(canvasElement).findByRole('menu', { name: TRIGGER });
    await expect(canvasElement.contains(menu)).toBe(false);
    await expect(menu).toHaveAttribute('data-ui', 'split-button-content');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(trigger).toHaveAttribute('aria-controls', menu.id);
    await expectItemFocused(canvasElement, 'CSV');
    await expect(args.onClick).toHaveBeenCalledTimes(1);
    await expect(callValues(args.onOpenChange)).toEqual([true]);

    // Keyboard navigation skips disabled item
    const disabled = within(menu).getByRole('menuitem', { name: 'Excel' });
    await expect(disabled).toHaveAttribute('aria-disabled', 'true');
    await userEvent.keyboard('{ArrowDown}');
    await expectItemFocused(canvasElement, 'JSON');

    // Activating item selects it, closes menu, returns focus to trigger without running main onClick
    const csvItem = within(menu).getByRole('menuitem', { name: 'CSV' });
    await userEvent.click(csvItem);
    const firstActionItem = args.items[0] as SplitButtonActionRecord;
    await expect(firstActionItem.onSelect).toHaveBeenCalledTimes(1);
    await expectClosed(canvasElement);
    await expectActive(canvasElement, trigger);
    await expect(args.onClick).toHaveBeenCalledTimes(1);
    await expect(callValues(args.onOpenChange)).toEqual([true, false]);
  },
};

export const Basic: StoryObj<Omit<SplitButtonShorthandProps, 'component'>> = {
  name: 'Export with alternative formats',
  args: Default.args,
  render: Default.render,
  parameters: { docs: {
    description: { story: 'Run Export PDF directly, or open the adjacent menu for another format.' },
    source: { language: 'tsx', code: shorthandSource },
  } },
};

export const Composed: Story = {
  name: 'Compose menu actions',
  parameters: {
    docs: {
      description: { story: 'Group export formats above a separator and a destructive action.' },
      source: {
        language: 'tsx',
        code: `${exportSnippetBase}

function ExportActions({ exportPdf, exportCsv, exportJson, deleteExport }: {
  exportPdf: () => void;
  exportCsv: () => void;
  exportJson: () => void;
  deleteExport: () => void;
}) {
  return <Row>
  <SplitButton aria-label="Export options">
  <SplitButton.Action onClick={exportPdf}>Export PDF</SplitButton.Action>
  <SplitButton.Trigger aria-label="Other export formats" />
  <SplitButton.Content>
    <SplitButton.Item onSelect={exportCsv}>CSV</SplitButton.Item>
    <SplitButton.Item disabled>Excel</SplitButton.Item>
    <SplitButton.Item onSelect={exportJson}>JSON</SplitButton.Item>
    <SplitButton.Separator />
    <SplitButton.Item tone="danger" onSelect={deleteExport}>Delete export</SplitButton.Item>
  </SplitButton.Content>
  </SplitButton>
  <Button>After</Button>
  </Row>;
}`,
      },
    },
  },
  play: async ({ args, canvasElement, userEvent }) => {
    const group = within(canvasElement).getByRole('group', { name: GROUP });
    const action = getAction(canvasElement);
    const trigger = getTrigger(canvasElement);
    await expect(group).toHaveAttribute('data-ui', 'split-button');
    await expect(group.contains(action) && group.contains(trigger)).toBe(true);
    await expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger).not.toHaveAttribute('aria-controls');
    await expect(action).not.toHaveAttribute('aria-haspopup');

    // The Action runs the main action and never opens the menu.
    await userEvent.click(action);
    await expect(args.onAction).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).not.toHaveBeenCalled();
    await expect(bodyOf(canvasElement).queryByRole('menu')).toBeNull();

    // The Trigger opens the menu and never runs the main action.
    await userEvent.click(trigger);
    const menu = await bodyOf(canvasElement).findByRole('menu', { name: TRIGGER });
    await expect(canvasElement.contains(menu)).toBe(false);
    await expect(menu).toHaveAttribute('data-ui', 'split-button-content');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(trigger).toHaveAttribute('aria-controls', menu.id);
    await expectItemFocused(canvasElement, 'CSV');
    await expect(args.onAction).toHaveBeenCalledTimes(1);
    await expect(callValues(args.onOpenChange)).toEqual([true]);

    await userEvent.click(within(menu).getByRole('menuitem', { name: 'CSV' }));
    await expect(args.onCsv).toHaveBeenCalledTimes(1);
    await expectClosed(canvasElement);
    await expectActive(canvasElement, trigger);
    await expect(args.onAction).toHaveBeenCalledTimes(1);
    await expect(callValues(args.onOpenChange)).toEqual([true, false]);
  },
};

export const GeneratedPartProps: StoryObj<Omit<SplitButtonShorthandProps, 'component'>> = {
  name: 'Generated part props',
  args: {
    label: ACTION,
    onClick: fn(),
    menuLabel: TRIGGER,
    'aria-label': GROUP,
    items: [
      { label: 'CSV', onSelect: fn() },
      { type: 'separator' },
      { label: 'JSON', onSelect: fn() },
    ],
    slotProps: {
      root: { 'data-testid': 'custom-split-root', className: 'custom-split-class' },
      action: { className: 'custom-action-class' },
      trigger: { className: 'custom-trigger-class' },
      content: { className: 'custom-content-class' },
      item: { className: 'custom-item-class' },
      separator: { className: 'custom-separator-class' },
    },
  },
  render: (args) => <SplitButton {...args} />,
  parameters: { docs: { source: { code: `<SplitButton label="Export PDF" onClick={exportPdf} menuLabel="Other export formats" items={formats}
  slotProps={{ action: { className: 'custom-action-class' }, content: { className: 'custom-content-class' } }} />` } } },
  play: async ({ canvasElement, userEvent }) => {
    const root = within(canvasElement).getByTestId('custom-split-root');
    await expect(root).toHaveClass('custom-split-class');
    await expect(root).toHaveAttribute('data-ui', 'split-button');

    const action = within(root).getByRole('button', { name: ACTION });
    await expect(action).toHaveClass('custom-action-class');

    const trigger = within(root).getByRole('button', { name: TRIGGER });
    await expect(trigger).toHaveClass('custom-trigger-class');

    await userEvent.click(trigger);
    const menu = await bodyOf(canvasElement).findByRole('menu', { name: TRIGGER });
    await expect(menu).toHaveClass('custom-content-class');

    const item = within(menu).getByRole('menuitem', { name: 'CSV' });
    await expect(item).toHaveClass('custom-item-class');

    const separator = menu.querySelector('[data-ui="split-button-separator"]');
    await expect(separator).toHaveClass('custom-separator-class');

    await userEvent.keyboard('{Escape}');
    await expectClosed(canvasElement, trigger);
  },
};

// This story tests the documented css/slot API and native style merging.
export const ReplacedParts: StoryObj<Omit<SplitButtonShorthandProps, 'component'>> = {
  name: 'Replaced parts',
  args: {
    label: ACTION,
    onClick: fn(),
    menuLabel: TRIGGER,
    items: [
      { label: 'CSV', onSelect: fn() },
      { label: 'JSON', onSelect: fn() },
    ],
    slots: { root: SplitButtonHost, action: CustomAction },
    className: 'consumer-root',
    style: { fontStyle: 'normal' },
    sx: { fontStyle: 'normal' },
    slotProps: {
      root: { className: 'slot-root', style: { fontStyle: 'italic' }, sx: { fontStyle: 'italic' }, 'aria-label': 'Custom export' },
    },
  },
  render: (args) => <SplitButton {...args} component={SplitButtonHost} />,
  parameters: {
    docs: {
      source: {
        code: `<SplitButton label="Export PDF" menuLabel="Other export formats" items={items} component={SplitButtonHost} slots={{ action: CustomAction }} slotProps={{ root: { 'aria-label': 'Custom export' } }} />`,
      },
    },
  },
  play: async ({ canvasElement, userEvent, args }) => {
    const canvas = within(canvasElement);
    const host = canvas.getByTestId('split-button-host');
    await expect(host).toHaveClass('consumer-root', 'slot-root');
    await expect(host).toHaveStyle({ fontStyle: 'italic' });
    await expect(host).toHaveAttribute('aria-label', 'Custom export');
    await expect(host).toHaveAttribute('data-ui', 'split-button');
    const action = canvas.getByTestId('custom-split-action');
    await expect(action).toBeVisible();
    await userEvent.click(action);
    await expect(args.onClick).toHaveBeenCalledTimes(1);
    const trigger = canvas.getByRole('button', { name: TRIGGER });
    await userEvent.click(trigger);
    const menu = await bodyOf(canvasElement).findByRole('menu', { name: TRIGGER });
    await expect(menu).toBeVisible();
    await userEvent.keyboard('{Escape}');
  },
};

export const GeneratedItemEvents: StoryObj<Omit<SplitButtonShorthandProps, 'component'>> = {
  args: {
    label: ACTION,
    menuLabel: TRIGGER,
    items: [{ label: 'CSV', onSelect: fn() }],
    slotProps: { item: { onClick: fn((event: MouseEvent<HTMLButtonElement>) => event.preventDefault()) } },
  },
  render: (args) => <SplitButton {...args} />,
  parameters: { docs: { source: { code: `<SplitButton label="Export PDF" menuLabel="Other export formats" items={formats}
  slotProps={{ item: { onClick: (event) => event.preventDefault() } }} />` } } },
  play: async ({ canvasElement, userEvent, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: TRIGGER }));
    const doc = within(canvasElement.ownerDocument.body);
    await userEvent.click(await doc.findByRole('menuitem', { name: 'CSV' }));
    await expect(args.slotProps?.item?.onClick).toHaveBeenCalledTimes(1);
    await expect(args.items[0]?.onSelect).toHaveBeenCalledTimes(1);
    await expect(doc.getByRole('menu')).toBeVisible();
    await userEvent.keyboard('{Escape}');
    await expect(canvas.getByRole('button', { name: TRIGGER })).toHaveFocus();
  },
};

function shorthandModeTypeContracts() {
  const items: readonly SplitButtonItemRecord[] = [{ label: 'CSV' }];
  // @ts-expect-error Shorthand mode rejects composed children.
  <SplitButton label="Export" menuLabel="More" items={items}>Child</SplitButton>;
  // @ts-expect-error Composed mode rejects items.
  <SplitButton items={items}>Child</SplitButton>;
  // @ts-expect-error Composed mode rejects slotProps.
  <SplitButton slotProps={{ root: {} }}>Child</SplitButton>;
}
void shorthandModeTypeContracts;

// Room beside the Trigger and off the viewport edge, so the end-aligned menu is neither flipped nor shifted.
const Roomy = styled.div({
  display: 'flex',
  justifyContent: 'flex-end',
  inlineSize: '24rem',
  maxInlineSize: '100%',
  boxSizing: 'border-box',
  paddingInline: vars.space[4],
});

export const Placement: Story = {
  name: 'End-aligned menu',
  parameters: { docs: {
    description: { story: 'Open a menu aligned with the inline end of its trigger.' },
    source: { language: 'tsx', code: `import { SplitButton, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const Frame = styled.div({
  display: 'flex', justifyContent: 'flex-end', inlineSize: '24rem',
  maxInlineSize: '100%', boxSizing: 'border-box', paddingInline: vars.space[4],
});

function ExportActions({ exportPdf, exportCsv, exportJson, deleteExport }: {
  exportPdf: () => void;
  exportCsv: () => void;
  exportJson: () => void;
  deleteExport: () => void;
}) {
  return <Frame>
    <SplitButton aria-label="Export options">
      <SplitButton.Action onClick={exportPdf}>Export PDF</SplitButton.Action>
      <SplitButton.Trigger aria-label="Other export formats" />
      <SplitButton.Content>
        <SplitButton.Item onSelect={exportCsv}>CSV</SplitButton.Item>
        <SplitButton.Item disabled>Excel</SplitButton.Item>
        <SplitButton.Item onSelect={exportJson}>JSON</SplitButton.Item>
        <SplitButton.Separator />
        <SplitButton.Item tone="danger" onSelect={deleteExport}>Delete export</SplitButton.Item>
      </SplitButton.Content>
    </SplitButton>
  </Frame>;
}` },
  } },
  render: (args) => (
    <Roomy>
      <ExportSplitButton {...args} />
    </Roomy>
  ),
  play: async ({ canvasElement, userEvent }) => {
    const trigger = getTrigger(canvasElement);
    await userEvent.click(trigger);
    const menu = await bodyOf(canvasElement).findByRole('menu', { name: TRIGGER });
    await expect(menu).toHaveAttribute('dir', 'ltr');
    // The default bottom-end placement aligns the menu's inline end with the Trigger's.
    await waitFor(() =>
      expect(Math.abs(menu.getBoundingClientRect().right - trigger.getBoundingClientRect().right)).toBeLessThan(
        TOLERANCE_PX,
      ),
    );
    await expect(menu.getBoundingClientRect().top).toBeGreaterThanOrEqual(trigger.getBoundingClientRect().bottom);
  },
};

export const Variants: Story = {
  render: (args) => (
    <StackFrame>
      {VARIANTS.map((variant) => (
        <ExportSplitButton key={variant} {...args} aria-label={`${GROUP} ${variant}`} variant={variant} />
      ))}
    </StackFrame>
  ),
  play: async ({ canvasElement }) => {
    for (const variant of VARIANTS) {
      const group = within(canvasElement).getByRole('group', { name: `${GROUP} ${variant}` });
      const action = within(group).getByRole('button', { name: ACTION });
      const trigger = within(group).getByRole('button', { name: TRIGGER });
      await expect(Math.abs(trigger.getBoundingClientRect().height - action.getBoundingClientRect().height)).toBeLessThan(
        TOLERANCE_PX,
      );
      if (variant === 'solid') {
        // Only the Action carries the solid fill; the Trigger is subordinate.
        await expect(getComputedStyle(trigger).backgroundColor).not.toBe(getComputedStyle(action).backgroundColor);
      }
    }
  },
};

export const Tones: Story = {
  render: (args) => (
    <StackFrame>
      {TONES.map((tone) => (
        <ExportSplitButton key={tone} {...args} aria-label={`${GROUP} ${tone}`} tone={tone} />
      ))}
    </StackFrame>
  ),
  play: async ({ canvasElement }) => {
    const backgrounds = TONES.map((tone) => {
      const group = within(canvasElement).getByRole('group', { name: `${GROUP} ${tone}` });
      return getComputedStyle(within(group).getByRole('button', { name: ACTION })).backgroundColor;
    });
    await expect(new Set(backgrounds).size).toBe(TONES.length);
  },
};

export const RootRelativeSizes: Story = {
  name: 'Root-relative control sizes', beforeEach: doubleRootText,
  render: (args, context) => Sizes.render!(args, context),
  play: async ({ canvasElement }) => { await expectControlMinimums(canvasElement.querySelectorAll('[data-ui~="split-button-action"]')); },
};
export const Sizes: Story = {
  render: (args) => (
    <Row>
      {SIZES.map((size) => (
        <ExportSplitButton key={size} {...args} aria-label={`${GROUP} ${size}`} size={size} />
      ))}
    </Row>
  ),
  play: async ({ canvasElement }) => {
    for (const size of SIZES) {
      const group = within(canvasElement).getByRole('group', { name: `${GROUP} ${size}` });
      const action = within(group).getByRole('button', { name: ACTION }).getBoundingClientRect();
      const trigger = within(group).getByRole('button', { name: TRIGGER }).getBoundingClientRect();
      // The Trigger is a square of the size's control height; both halves share that height.
      await expect(Math.abs(trigger.width - SIZE_PX[size])).toBeLessThan(TOLERANCE_PX);
      await expect(Math.abs(trigger.height - SIZE_PX[size])).toBeLessThan(TOLERANCE_PX);
      await expect(Math.abs(action.height - SIZE_PX[size])).toBeLessThan(TOLERANCE_PX);
      await expect(trigger.width).toBeGreaterThanOrEqual(32 - TOLERANCE_PX);
    }
  },
};

export const Secondary: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `${exportSnippetBase}

export function ExportRow({
  exportPdf,
  exportCsv,
  exportJson,
  deleteExport,
}: {
  exportPdf?: () => void;
  exportCsv?: () => void;
  exportJson?: () => void;
  deleteExport?: () => void;
}) {
  return (
    <Row>
      <SplitButton
        aria-label="Export options"
        variant="outline"
        tone="neutral"
        size="sm"
      >
        <SplitButton.Action onClick={exportPdf}>
          Export PDF
        </SplitButton.Action>
        <SplitButton.Trigger aria-label="Other export formats" />
        <SplitButton.Content>
          <SplitButton.Item onSelect={exportCsv}>
            CSV
          </SplitButton.Item>
          <SplitButton.Item disabled>Excel</SplitButton.Item>
          <SplitButton.Item onSelect={exportJson}>
            JSON
          </SplitButton.Item>
          <SplitButton.Separator />
          <SplitButton.Item tone="danger" onSelect={deleteExport}>
            Delete export
          </SplitButton.Item>
        </SplitButton.Content>
      </SplitButton>
      <Button>After</Button>
    </Row>
  );
}`,
      },
    },
  },
  args: { variant: 'outline', tone: 'neutral', size: 'sm' },
  play: async ({ canvasElement }) => {
    const action = getAction(canvasElement);
    const trigger = getTrigger(canvasElement);
    // Outline halves share one divider: the Action drops its inline-end border.
    await expect(getComputedStyle(action).borderRightWidth).toBe('0px');
    await expect(getComputedStyle(trigger).borderLeftStyle).toBe('solid');
    await expect(parseFloat(getComputedStyle(trigger).borderLeftWidth)).toBeGreaterThan(0);
    await expect(Math.abs(trigger.getBoundingClientRect().height - SIZE_PX.sm)).toBeLessThan(TOLERANCE_PX);
  },
};

export const WithIcon: Story = {
  name: 'Primary action with an icon',
  parameters: { docs: {
    description: { story: 'Add a decorative file icon without changing the primary action’s accessible name.' },
    source: { language: 'tsx', code: `import { SplitButton } from '@jfrader/ui';

function PdfIcon() {
  return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"
    strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 1.5h5l3 3v10H4z" />
    <path d="M8 7v5M6 10l2 2 2-2" />
  </svg>;
}

function ExportActions({ exportPdf, exportCsv }: { exportPdf: () => void; exportCsv: () => void }) {
  return <SplitButton aria-label="Export options">
    <SplitButton.Action startIcon={<PdfIcon />} onClick={exportPdf}>Export PDF</SplitButton.Action>
    <SplitButton.Trigger aria-label="Other export formats" />
    <SplitButton.Content>
      <SplitButton.Item onSelect={exportCsv}>CSV</SplitButton.Item>
    </SplitButton.Content>
  </SplitButton>;
}` },
  } },
  render: ({ onAction, onCsv, onJson: _onJson, onDelete: _onDelete, ...args }) => (
    <SplitButton {...args}>
      <SplitButton.Action startIcon={<PdfIcon />} onClick={onAction}>
        {ACTION}
      </SplitButton.Action>
      <SplitButton.Trigger aria-label={TRIGGER} />
      <SplitButton.Content>
        <SplitButton.Item onSelect={onCsv}>CSV</SplitButton.Item>
      </SplitButton.Content>
    </SplitButton>
  ),
  play: async ({ canvasElement }) => {
    const action = getAction(canvasElement);
    // The decorative icon leads the label and stays out of the accessible name.
    const icon = action.firstElementChild!;
    await expect(icon).toHaveAttribute('aria-hidden', 'true');
    await expect(icon.querySelector('svg')).not.toBeNull();
    await expect(action).toHaveAccessibleName(ACTION);
  },
};

export const LightTheme: Story = {
  tags: ['!autodocs'],
  globals: { theme: 'light' },
  args: { defaultOpen: true },
  play: async ({ canvasElement }) => {
    const menu = await bodyOf(canvasElement).findByRole('menu', { name: TRIGGER });
    await expectThemedSurface(menu, 'light');
  },
};

export const PersistentOpen: Story = {
  tags: ['!autodocs'],
  args: { defaultOpen: true },
  play: async ({ canvasElement }) => {
    // Persistent open state so the axe gate sees the portaled menu.
    const menu = await bodyOf(canvasElement).findByRole('menu', { name: TRIGGER });
    await expect(within(menu).getAllByRole('menuitem')).toHaveLength(4);
    await expect(within(menu).getByRole('menuitem', { name: 'Excel' })).toHaveAttribute('aria-disabled', 'true');
    await expect(within(menu).getByRole('separator')).toHaveAttribute('data-ui', 'split-button-separator');
    const danger = within(menu).getByRole('menuitem', { name: 'Delete export' });
    await expect(getComputedStyle(danger).color).not.toBe(
      getComputedStyle(within(menu).getByRole('menuitem', { name: 'CSV' })).color,
    );
  },
};

export const KeyboardActivation: Story = {
  name: 'Keyboard activation',
  parameters: {
    docs: {
      description: { story: 'Tab between both halves, then use Enter, Space or arrows to open the menu.' },
      source: {
        language: 'tsx',
        code: `${exportSnippetBase}

export function ExportRow({
  exportPdf,
  exportCsv,
  exportJson,
  deleteExport,
}: {
  exportPdf?: () => void;
  exportCsv?: () => void;
  exportJson?: () => void;
  deleteExport?: () => void;
}) {
  return (
    <Row>
      <SplitButton aria-label="Export options">
        <SplitButton.Action onClick={exportPdf}>
          Export PDF
        </SplitButton.Action>
        <SplitButton.Trigger aria-label="Other export formats" />
        <SplitButton.Content>
          <SplitButton.Item onSelect={exportCsv}>
            CSV
          </SplitButton.Item>
          <SplitButton.Item disabled>Excel</SplitButton.Item>
          <SplitButton.Item onSelect={exportJson}>
            JSON
          </SplitButton.Item>
          <SplitButton.Separator />
          <SplitButton.Item tone="danger" onSelect={deleteExport}>
            Delete export
          </SplitButton.Item>
        </SplitButton.Content>
      </SplitButton>
      <Button>After</Button>
    </Row>
  );
}`,
      },
    },
  },
  play: async ({ args, canvasElement, userEvent }) => {
    const action = getAction(canvasElement);
    const trigger = getTrigger(canvasElement);

    // Tab visits the Action, then the Trigger; Shift+Tab reverses.
    await userEvent.tab();
    await expectActive(canvasElement, action);
    await expectFocusRing(action);
    await userEvent.tab();
    await expectActive(canvasElement, trigger);
    await expectFocusRing(trigger);
    await userEvent.tab({ shift: true });
    await expectActive(canvasElement, action);

    // Enter and Space each run the main action exactly once, without opening the menu.
    await userEvent.keyboard('{Enter}');
    await expect(args.onAction).toHaveBeenCalledTimes(1);
    await userEvent.keyboard(' ');
    await expect(args.onAction).toHaveBeenCalledTimes(2);
    await expect(args.onOpenChange).not.toHaveBeenCalled();
    await expectActive(canvasElement, action);

    // Enter, Space and ArrowDown on the Trigger open on the first enabled item.
    await userEvent.tab();
    for (const key of ['{Enter}', ' ', '{ArrowDown}']) {
      await userEvent.keyboard(key);
      await expectItemFocused(canvasElement, 'CSV');
      await userEvent.keyboard('{Escape}');
      await expectClosed(canvasElement);
      await expectActive(canvasElement, trigger);
    }
    // ArrowUp opens on the last enabled item.
    await userEvent.keyboard('{ArrowUp}');
    await expectItemFocused(canvasElement, 'Delete export');
    await userEvent.keyboard('{Escape}');
    await expectClosed(canvasElement);

    await expect(args.onAction).toHaveBeenCalledTimes(2);
    await expect(callValues(args.onOpenChange)).toEqual([true, false, true, false, true, false, true, false]);
  },
};

export const MenuNavigation: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `${exportSnippetBase}

export function ExportRow({
  exportPdf,
  exportCsv,
  exportJson,
  deleteExport,
}: {
  exportPdf?: () => void;
  exportCsv?: () => void;
  exportJson?: () => void;
  deleteExport?: () => void;
}) {
  return (
    <Row>
      <SplitButton aria-label="Export options">
        <SplitButton.Action onClick={exportPdf}>
          Export PDF
        </SplitButton.Action>
        <SplitButton.Trigger aria-label="Other export formats" />
        <SplitButton.Content>
          <SplitButton.Item onSelect={exportCsv}>
            CSV
          </SplitButton.Item>
          <SplitButton.Item disabled>Excel</SplitButton.Item>
          <SplitButton.Item onSelect={exportJson}>
            JSON
          </SplitButton.Item>
          <SplitButton.Separator />
          <SplitButton.Item tone="danger" onSelect={deleteExport}>
            Delete export
          </SplitButton.Item>
        </SplitButton.Content>
      </SplitButton>
      <Button>After</Button>
    </Row>
  );
}`,
      },
    },
  },
  play: async ({ args, canvasElement, userEvent }) => {
    const trigger = getTrigger(canvasElement);
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    await expectItemFocused(canvasElement, 'CSV');
    await expectFocusRing(bodyOf(canvasElement).getByRole('menuitem', { name: 'CSV' }));

    // Arrows skip the disabled item and wrap both ways.
    await userEvent.keyboard('{ArrowDown}');
    await expectItemFocused(canvasElement, 'JSON');
    await userEvent.keyboard('{ArrowDown}');
    await expectItemFocused(canvasElement, 'Delete export');
    await userEvent.keyboard('{ArrowDown}');
    await expectItemFocused(canvasElement, 'CSV');
    await userEvent.keyboard('{ArrowUp}');
    await expectItemFocused(canvasElement, 'Delete export');
    await userEvent.keyboard('{ArrowUp}');
    await expectItemFocused(canvasElement, 'JSON');
    await userEvent.keyboard('{ArrowUp}');
    await expectItemFocused(canvasElement, 'CSV');

    await userEvent.keyboard('{End}');
    await expectItemFocused(canvasElement, 'Delete export');
    await userEvent.keyboard('{Home}');
    await expectItemFocused(canvasElement, 'CSV');

    // Typeahead never lands on the disabled "Excel".
    await userEvent.keyboard('j');
    await expectItemFocused(canvasElement, 'JSON');
    await wait(TYPEAHEAD_RESET_WAIT_MS);
    await userEvent.keyboard('e');
    await expectItemFocused(canvasElement, 'JSON');
    await wait(TYPEAHEAD_RESET_WAIT_MS);
    await userEvent.keyboard('d');
    await expectItemFocused(canvasElement, 'Delete export');

    // Enter selects once, closes and returns focus to the Trigger.
    await userEvent.keyboard('{ArrowUp}');
    await expectItemFocused(canvasElement, 'JSON');
    await userEvent.keyboard('{Enter}');
    await expect(args.onJson).toHaveBeenCalledTimes(1);
    await expectClosed(canvasElement);
    await expectActive(canvasElement, trigger);

    // Space selects too.
    await userEvent.keyboard('{ArrowUp}');
    await expectItemFocused(canvasElement, 'Delete export');
    await userEvent.keyboard(' ');
    await expect(args.onDelete).toHaveBeenCalledTimes(1);
    await expectClosed(canvasElement);
    await expectActive(canvasElement, trigger);

    await expect(args.onCsv).not.toHaveBeenCalled();
    await expect(args.onAction).not.toHaveBeenCalled();
  },
};

export const FocusReturn: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `${exportSnippetBase}

export function ExportRow({
  exportPdf,
  exportCsv,
  exportJson,
  deleteExport,
}: {
  exportPdf?: () => void;
  exportCsv?: () => void;
  exportJson?: () => void;
  deleteExport?: () => void;
}) {
  return (
    <Row>
      <SplitButton aria-label="Export options">
        <SplitButton.Action onClick={exportPdf}>
          Export PDF
        </SplitButton.Action>
        <SplitButton.Trigger aria-label="Other export formats" />
        <SplitButton.Content>
          <SplitButton.Item onSelect={exportCsv}>
            CSV
          </SplitButton.Item>
          <SplitButton.Item disabled>Excel</SplitButton.Item>
          <SplitButton.Item onSelect={exportJson}>
            JSON
          </SplitButton.Item>
          <SplitButton.Separator />
          <SplitButton.Item tone="danger" onSelect={deleteExport}>
            Delete export
          </SplitButton.Item>
        </SplitButton.Content>
      </SplitButton>
      <Button>After</Button>
    </Row>
  );
}`,
      },
    },
  },
  play: async ({ canvasElement, userEvent }) => {
    const { ownerDocument } = canvasElement;
    const trigger = getTrigger(canvasElement);

    // Shift+Tab from the first item lands on the Trigger with the menu still open; Tab re-enters.
    await userEvent.click(trigger);
    await expectItemFocused(canvasElement, 'CSV');
    await userEvent.tab({ shift: true });
    await expectActive(canvasElement, trigger);
    await expect(bodyOf(canvasElement).getByRole('menu')).toBeVisible();
    await userEvent.tab();
    await expectItemFocused(canvasElement, 'CSV');

    // Tab from the last item closes the menu and moves on.
    await userEvent.keyboard('{End}');
    await userEvent.tab();
    await expectClosed(canvasElement);
    await expectActive(canvasElement, getAfter(canvasElement));

    // An outside press closes the menu without focusing the Trigger, even transiently.
    await userEvent.click(trigger);
    await bodyOf(canvasElement).findByRole('menu');
    const seen: Element[] = [];
    const record = () => {
      if (ownerDocument.activeElement) seen.push(ownerDocument.activeElement);
    };
    ownerDocument.addEventListener('focusin', record);
    await userEvent.click(getAfter(canvasElement));
    ownerDocument.removeEventListener('focusin', record);
    await expectClosed(canvasElement);
    await expect(ownerDocument.activeElement).toBe(getAfter(canvasElement));
    await expect(seen).not.toContain(trigger);
  },
};

function ControlledExport(args: StoryArgs) {
  const [open, setOpen] = useState(false);
  return (
    <ExportRow
      {...args}
      open={open}
      onOpenChange={(next) => {
        args.onOpenChange?.(next);
        setOpen(next);
      }}
    />
  );
}
ControlledExport.displayName = 'ControlledExport';

export const Controlled: Story = {
  name: 'Controlled menu',
  parameters: { docs: {
    description: { story: 'Keep menu visibility in application state and accept open and close requests.' },
    source: { language: 'tsx', code: `import { useState } from 'react';
${exportSnippetBase}

function ExportActions({ exportPdf, exportCsv, exportJson, deleteExport }: {
  exportPdf: () => void;
  exportCsv: () => void;
  exportJson: () => void;
  deleteExport: () => void;
}) {
  const [open, setOpen] = useState(false);
  return <Row>
    <SplitButton aria-label="Export options" open={open} onOpenChange={setOpen}>
      <SplitButton.Action onClick={exportPdf}>Export PDF</SplitButton.Action>
      <SplitButton.Trigger aria-label="Other export formats" />
      <SplitButton.Content>
        <SplitButton.Item onSelect={exportCsv}>CSV</SplitButton.Item>
        <SplitButton.Item disabled>Excel</SplitButton.Item>
        <SplitButton.Item onSelect={exportJson}>JSON</SplitButton.Item>
        <SplitButton.Separator />
        <SplitButton.Item tone="danger" onSelect={deleteExport}>Delete export</SplitButton.Item>
      </SplitButton.Content>
    </SplitButton>
    <Button>After</Button>
  </Row>;
}` },
  } },
  render: (args) => <ControlledExport {...args} />,
  play: async ({ args, canvasElement, userEvent }) => {
    const trigger = getTrigger(canvasElement);
    await userEvent.click(trigger);
    await bodyOf(canvasElement).findByRole('menu');
    await userEvent.keyboard('{Escape}');
    await expectClosed(canvasElement);
    await expectActive(canvasElement, trigger);
    await expect(callValues(args.onOpenChange)).toEqual([true, false]);
  },
};

export const RejectedOpen: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { useState } from 'react';
${exportSnippetBase}

export function ExportRow({
  exportPdf,
  exportCsv,
  exportJson,
  deleteExport,
}: {
  exportPdf?: () => void;
  exportCsv?: () => void;
  exportJson?: () => void;
  deleteExport?: () => void;
}) {
  const [open] = useState(false);

  return (
    <Row>
      <SplitButton
        aria-label="Export options"
        open={open}
        onOpenChange={(next) => {
          // Prevent opening the menu
        }}
      >
        <SplitButton.Action onClick={exportPdf}>
          Export PDF
        </SplitButton.Action>
        <SplitButton.Trigger aria-label="Other export formats" />
        <SplitButton.Content>
          <SplitButton.Item onSelect={exportCsv}>
            CSV
          </SplitButton.Item>
          <SplitButton.Item disabled>Excel</SplitButton.Item>
          <SplitButton.Item onSelect={exportJson}>
            JSON
          </SplitButton.Item>
          <SplitButton.Separator />
          <SplitButton.Item tone="danger" onSelect={deleteExport}>
            Delete export
          </SplitButton.Item>
        </SplitButton.Content>
      </SplitButton>
      <Button>After</Button>
    </Row>
  );
}`,
      },
    },
  },
  args: { open: false },
  play: async ({ args, canvasElement, userEvent }) => {
    const trigger = getTrigger(canvasElement);
    // A rejected open request commits nothing: no menu, no aria-expanded, focus stays put.
    await userEvent.click(trigger);
    await expect(callValues(args.onOpenChange)).toEqual([true]);
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger).not.toHaveAttribute('aria-controls');
    await expect(bodyOf(canvasElement).queryByRole('menu')).toBeNull();
    await expectActive(canvasElement, trigger);
    await userEvent.keyboard('{ArrowDown}');
    await expect(callValues(args.onOpenChange)).toEqual([true, true]);
    await expect(bodyOf(canvasElement).queryByRole('menu')).toBeNull();
  },
};

export const ControlledReject: Story = {
  tags: ['!autodocs'],
  args: { open: true },
  play: async ({ args, canvasElement, userEvent }) => {
    const trigger = getTrigger(canvasElement);
    const menu = await bodyOf(canvasElement).findByRole('menu', { name: TRIGGER });
    await expect(trigger).toHaveAttribute('aria-controls', menu.id);

    // A rejected selection close keeps the menu and the focused item.
    const json = within(menu).getByRole('menuitem', { name: 'JSON' });
    await userEvent.click(json);
    await expect(args.onJson).toHaveBeenCalledTimes(1);
    await expect(callValues(args.onOpenChange)).toEqual([false]);
    await expectActive(canvasElement, json);

    // A rejected Escape does the same.
    await userEvent.keyboard('{Escape}');
    await expect(callValues(args.onOpenChange)).toEqual([false, false]);
    await expect(bodyOf(canvasElement).getByRole('menu')).toBe(menu);
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expectActive(canvasElement, json);
  },
};

export const Disabled: Story = {
  name: 'Disabled split button',
  parameters: {
    docs: {
      description: { story: 'Disable both the primary action and the menu opener together.' },
      source: {
        language: 'tsx',
        code: `${exportSnippetBase}

export function ExportRow({
  exportPdf,
  exportCsv,
  exportJson,
  deleteExport,
}: {
  exportPdf?: () => void;
  exportCsv?: () => void;
  exportJson?: () => void;
  deleteExport?: () => void;
}) {
  return (
    <Row>
      <SplitButton aria-label="Export options" disabled>
        <SplitButton.Action onClick={exportPdf}>
          Export PDF
        </SplitButton.Action>
        <SplitButton.Trigger aria-label="Other export formats" />
        <SplitButton.Content>
          <SplitButton.Item onSelect={exportCsv}>
            CSV
          </SplitButton.Item>
          <SplitButton.Item disabled>Excel</SplitButton.Item>
          <SplitButton.Item onSelect={exportJson}>
            JSON
          </SplitButton.Item>
          <SplitButton.Separator />
          <SplitButton.Item tone="danger" onSelect={deleteExport}>
            Delete export
          </SplitButton.Item>
        </SplitButton.Content>
      </SplitButton>
      <Button>After</Button>
    </Row>
  );
}`,
      },
    },
  },
  args: { disabled: true },
  play: async ({ args, canvasElement, userEvent }) => {
    const action = getAction(canvasElement);
    const trigger = getTrigger(canvasElement);
    await expect(action).toBeDisabled();
    await expect(trigger).toBeDisabled();

    // Natively disabled halves leave the tab order.
    await userEvent.tab();
    await expectActive(canvasElement, getAfter(canvasElement));
    await userEvent.click(action);
    await userEvent.click(trigger);
    await expect(args.onAction).not.toHaveBeenCalled();
    await expect(args.onOpenChange).not.toHaveBeenCalled();
    await expect(bodyOf(canvasElement).queryByRole('menu')).toBeNull();
  },
};

export const DisabledParts: Story = {
  name: 'Disable one half',
  parameters: { docs: {
    description: { story: 'Disable only the primary action or only the menu opener.' },
    source: { language: 'tsx', code: `import { SplitButton, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const Stack = styled.div({
  display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: vars.space[3],
});

function ExportActions({ exportPdf, exportCsv }: { exportPdf: () => void; exportCsv: () => void }) {
  return <Stack>
    <SplitButton aria-label="Action disabled">
      <SplitButton.Action disabled onClick={exportPdf}>Export PDF</SplitButton.Action>
      <SplitButton.Trigger aria-label="Other export formats" />
      <SplitButton.Content>
        <SplitButton.Item onSelect={exportCsv}>CSV</SplitButton.Item>
      </SplitButton.Content>
    </SplitButton>
    <SplitButton aria-label="Trigger disabled">
      <SplitButton.Action onClick={exportPdf}>Export PDF</SplitButton.Action>
      <SplitButton.Trigger disabled aria-label="Other export formats" />
      <SplitButton.Content>
        <SplitButton.Item onSelect={exportCsv}>CSV</SplitButton.Item>
      </SplitButton.Content>
    </SplitButton>
  </Stack>;
}` },
  } },
  render: ({ onAction, onCsv, onJson: _onJson, onDelete: _onDelete, ...args }) => (
    <StackFrame>
      <SplitButton {...args} aria-label="Action disabled">
        <SplitButton.Action disabled onClick={onAction}>
          {ACTION}
        </SplitButton.Action>
        <SplitButton.Trigger aria-label={TRIGGER} />
        <SplitButton.Content>
          <SplitButton.Item onSelect={onCsv}>CSV</SplitButton.Item>
        </SplitButton.Content>
      </SplitButton>
      <SplitButton {...args} aria-label="Trigger disabled">
        <SplitButton.Action onClick={onAction}>{ACTION}</SplitButton.Action>
        <SplitButton.Trigger disabled aria-label={TRIGGER} />
        <SplitButton.Content>
          <SplitButton.Item onSelect={onCsv}>CSV</SplitButton.Item>
        </SplitButton.Content>
      </SplitButton>
    </StackFrame>
  ),
  play: async ({ args, canvasElement, userEvent }) => {
    const first = within(within(canvasElement).getByRole('group', { name: 'Action disabled' }));
    const second = within(within(canvasElement).getByRole('group', { name: 'Trigger disabled' }));
    await expect(first.getByRole('button', { name: ACTION })).toBeDisabled();
    await expect(first.getByRole('button', { name: TRIGGER })).toBeEnabled();
    await expect(second.getByRole('button', { name: ACTION })).toBeEnabled();
    await expect(second.getByRole('button', { name: TRIGGER })).toBeDisabled();

    // Tab order skips each disabled half.
    await userEvent.tab();
    await expectActive(canvasElement, first.getByRole('button', { name: TRIGGER }));
    await userEvent.tab();
    await expectActive(canvasElement, second.getByRole('button', { name: ACTION }));
    await userEvent.keyboard('{Enter}');
    await expect(args.onAction).toHaveBeenCalledTimes(1);
    await userEvent.tab();
    await expect(canvasElement.ownerDocument.activeElement).not.toBe(second.getByRole('button', { name: TRIGGER }));
    await expect(args.onOpenChange).not.toHaveBeenCalled();
  },
};

export const DisabledItems: Story = {
  tags: ['!autodocs'],
  args: { defaultOpen: true },
  play: async ({ args, canvasElement, userEvent }) => {
    const menu = await bodyOf(canvasElement).findByRole('menu');
    const excel = within(menu).getByRole('menuitem', { name: 'Excel' });
    await expect(excel).toHaveAttribute('aria-disabled', 'true');
    await expect(excel).toBeVisible();
    // A disabled item neither selects nor closes the menu.
    await userEvent.click(excel);
    await expect(bodyOf(canvasElement).getByRole('menu')).toBe(menu);
    await expect(args.onOpenChange).not.toHaveBeenCalled();
  },
};

function DisableWhileOpenHarness({ controlled, ...args }: StoryArgs & { controlled: boolean }) {
  const [disabled, setDisabled] = useState(false);
  return (
    <Row>
      <ExportSplitButton
        {...args}
        aria-label={controlled ? 'Controlled' : 'Uncontrolled'}
        disabled={disabled}
        {...(controlled ? { open: true } : { defaultOpen: true })}
      />
      <Button data-toggle-disabled="" onClick={() => setDisabled((value) => !value)}>
        {controlled ? 'Toggle controlled' : 'Toggle uncontrolled'}
      </Button>
    </Row>
  );
}
DisableWhileOpenHarness.displayName = 'DisableWhileOpenHarness';

export const DisableWhileOpen: Story = {
  tags: ['!autodocs'],
  render: (args) => <DisableWhileOpenHarness {...args} controlled />,
  play: async ({ args, canvasElement, userEvent }) => {
    const menu = await bodyOf(canvasElement).findByRole('menu');
    const toggle = within(canvasElement).getByRole('button', { name: 'Toggle controlled' });
    // A DOM click skips the pointerdown an outside-press dismissal listens for.
    toggle.click();
    await waitFor(() => expect(getTrigger(canvasElement)).toBeDisabled());

    // The parent is asked once; it keeps the menu open, so the menu stays but cannot act.
    await expect(callValues(args.onOpenChange)).toEqual([false]);
    await expect(bodyOf(canvasElement).getByRole('menu')).toBe(menu);
    for (const item of within(menu).getAllByRole('menuitem')) {
      await expect(item).toHaveAttribute('aria-disabled', 'true');
    }
    await userEvent.click(within(menu).getByRole('menuitem', { name: 'CSV' }));
    await expect(args.onCsv).not.toHaveBeenCalled();
    await expect(callValues(args.onOpenChange)).toEqual([false]);

    // Re-enabling and re-disabling asks again, once.
    toggle.click();
    await waitFor(() => expect(getTrigger(canvasElement)).toBeEnabled());
    toggle.click();
    await waitFor(() => expect(getTrigger(canvasElement)).toBeDisabled());
    await expect(callValues(args.onOpenChange)).toEqual([false, false]);
  },
};

export const DisableWhileOpenUncontrolled: Story = {
  tags: ['!autodocs'],
  render: (args) => <DisableWhileOpenHarness {...args} controlled={false} />,
  play: async ({ args, canvasElement }) => {
    await bodyOf(canvasElement).findByRole('menu');
    within(canvasElement).getByRole('button', { name: 'Toggle uncontrolled' }).click();
    await expectClosed(canvasElement);
    await expect(getTrigger(canvasElement)).toBeDisabled();
    await expect(callValues(args.onOpenChange)).toEqual([false]);
  },
};

export const EmptyMenu: Story = {
  render: ({ onAction, onCsv: _onCsv, onJson: _onJson, onDelete: _onDelete, ...args }) => (
    <SplitButton {...args}>
      <SplitButton.Action onClick={onAction}>{ACTION}</SplitButton.Action>
      <SplitButton.Trigger aria-label={TRIGGER} />
      <SplitButton.Content />
    </SplitButton>
  ),
  play: async ({ canvasElement, userEvent }) => {
    const trigger = getTrigger(canvasElement);
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.keyboard('{ArrowDown}');
    const menu = await bodyOf(canvasElement).findByRole('menu', { name: TRIGGER });
    await expect(within(menu).queryAllByRole('menuitem')).toHaveLength(0);
    await expect(canvasElement.ownerDocument.activeElement?.getAttribute('role')).not.toBe('menuitem');
    await userEvent.keyboard('{Escape}');
    await expectClosed(canvasElement);
    await expectActive(canvasElement, trigger);
    // End open so the axe gate sees the empty menu.
    await userEvent.click(trigger);
    await bodyOf(canvasElement).findByRole('menu', { name: TRIGGER });
  },
};

export const LongLabels: Story = {
  render: ({ onAction, onCsv, onJson: _onJson, onDelete: _onDelete, ...args }) => (
    <NarrowFrame data-testid="narrow">
      <SplitButton {...args}>
        <SplitButton.Action onClick={onAction}>Export the quarterly revenue report as PDF</SplitButton.Action>
        <SplitButton.Trigger aria-label={TRIGGER} />
        <SplitButton.Content>
          <SplitButton.Item onSelect={onCsv}>Export the quarterly revenue report as CSV</SplitButton.Item>
        </SplitButton.Content>
      </SplitButton>
    </NarrowFrame>
  ),
  play: async ({ canvasElement }) => {
    const narrow = within(canvasElement).getByTestId('narrow').getBoundingClientRect();
    const group = within(canvasElement).getByRole('group').getBoundingClientRect();
    const action = getAction(canvasElement, 'Export the quarterly revenue report as PDF').getBoundingClientRect();
    const trigger = getTrigger(canvasElement).getBoundingClientRect();
    // The label wraps inside the container; the Trigger stays square-wide and matches the height.
    await expect(group.width).toBeLessThanOrEqual(narrow.width + TOLERANCE_PX);
    await expect(action.height).toBeGreaterThan(SIZE_PX.md + TOLERANCE_PX);
    await expect(Math.abs(trigger.width - SIZE_PX.md)).toBeLessThan(TOLERANCE_PX);
    await expect(Math.abs(trigger.height - action.height)).toBeLessThan(TOLERANCE_PX);
  },
};

export const RTL: Story = {
  args: { 'aria-label': 'אפשרויות ייצוא' },
  render: ({ onAction, onCsv, onJson, onDelete: _onDelete, ...args }) => (
    <Roomy dir="rtl" lang="he">
      <SplitButton {...args}>
        <SplitButton.Action onClick={onAction}>ייצוא PDF</SplitButton.Action>
        <SplitButton.Trigger aria-label="פורמטים נוספים" />
        <SplitButton.Content>
          <SplitButton.Item onSelect={onCsv}>CSV</SplitButton.Item>
          <SplitButton.Item onSelect={onJson}>JSON</SplitButton.Item>
        </SplitButton.Content>
      </SplitButton>
    </Roomy>
  ),
  play: async ({ canvasElement, userEvent }) => {
    const action = getAction(canvasElement, 'ייצוא PDF');
    const trigger = getTrigger(canvasElement, 'פורמטים נוספים');
    // The Trigger sits at the inline end, which is the left in RTL; outer corners follow.
    await expect(trigger.getBoundingClientRect().right).toBeLessThanOrEqual(
      action.getBoundingClientRect().left + TOLERANCE_PX,
    );
    await expect(getComputedStyle(action).borderTopRightRadius).not.toBe('0px');
    await expect(getComputedStyle(action).borderTopLeftRadius).toBe('0px');
    await expect(getComputedStyle(trigger).borderTopLeftRadius).not.toBe('0px');
    await expect(getComputedStyle(trigger).borderTopRightRadius).toBe('0px');

    // The portaled menu takes the group's direction and aligns to the Trigger's inline end.
    await userEvent.click(trigger);
    const menu = await bodyOf(canvasElement).findByRole('menu', { name: 'פורמטים נוספים' });
    await expect(menu).toHaveAttribute('dir', 'rtl');
    await waitFor(() =>
      expect(Math.abs(menu.getBoundingClientRect().left - trigger.getBoundingClientRect().left)).toBeLessThan(
        TOLERANCE_PX,
      ),
    );
    // Arrow keys stay vertical in RTL.
    await expectItemFocused(canvasElement, 'CSV');
    await userEvent.keyboard('{ArrowDown}');
    await expectItemFocused(canvasElement, 'JSON');
  },
};

function ScopedHost({ children }: { children: ReactNode }) {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  return (
    <ThemeRoot theme="light" portalContainer={host}><LightThemeFrame>
      {children}
      <div ref={setHost} data-overlay-host="" />
    </LightThemeFrame></ThemeRoot>
  );
}
ScopedHost.displayName = 'ScopedHost';

export const ThemeRootPortal: Story = {
  tags: ['!autodocs'],
  args: { defaultOpen: true },
  render: (args) => (
    <ScopedHost>
      <ExportSplitButton {...args} />
    </ScopedHost>
  ),
  play: async ({ canvasElement }) => {
    const menu = await bodyOf(canvasElement).findByRole('menu', { name: TRIGGER });
    // Portaled into the scope's host, keeping the nearest ThemeRoot's theme.
    await expect(canvasElement.querySelector('[data-overlay-host]')!.contains(menu)).toBe(true);
    await expectThemedSurface(menu, 'light');
  },
};

export const AriaMerge: Story = {
  tags: ['!autodocs'],
  args: { 'aria-label': undefined, defaultOpen: true },
  render: ({ onAction, onCsv, onJson: _onJson, onDelete: _onDelete, ...args }) => (
    <StackFrame>
      <span id="export-label">Export</span>
      <span id="export-help">Formats follow workspace settings</span>
      <span id="formats-label">More formats</span>
      <SplitButton {...args} aria-labelledby="export-label" aria-describedby="export-help">
        <SplitButton.Action aria-describedby="export-help missing-id" onClick={onAction}>
          {ACTION}
        </SplitButton.Action>
        <SplitButton.Trigger aria-labelledby="formats-label" aria-describedby="export-help" />
        <SplitButton.Content aria-labelledby="export-label" aria-describedby="export-help">
          <SplitButton.Item onSelect={onCsv}>CSV</SplitButton.Item>
        </SplitButton.Content>
      </SplitButton>
      <SplitButton {...args} aria-label="Share options">
        <SplitButton.Action>Share</SplitButton.Action>
        <SplitButton.Trigger aria-label="Other share targets" />
        <SplitButton.Content aria-label="Share targets">
          <SplitButton.Item>Email</SplitButton.Item>
        </SplitButton.Content>
      </SplitButton>
    </StackFrame>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const group = canvas.getByRole('group', { name: 'Export' });
    await expect(group).toHaveAttribute('aria-describedby', 'export-help');
    await expect(group).toHaveAccessibleDescription('Formats follow workspace settings');

    // Consumer ids survive on both halves, an unresolved one included.
    const action = within(group).getByRole('button', { name: ACTION });
    await expect(action).toHaveAttribute('aria-describedby', 'export-help missing-id');
    const trigger = within(group).getByRole('button', { name: 'More formats' });
    await expect(trigger).toHaveAttribute('aria-labelledby', 'formats-label');
    await expect(trigger).toHaveAttribute('aria-describedby', 'export-help');
    await expect(trigger).toHaveAttribute('aria-haspopup', 'menu');

    // Consumer label ids join the Trigger's label ids and the Trigger itself.
    const menu = await bodyOf(canvasElement).findByRole('menu', { name: 'Export More formats' });
    await expect(menu).toHaveAttribute('aria-labelledby', `export-label formats-label ${trigger.id}`);
    await expect(menu).toHaveAttribute('aria-describedby', 'export-help');
    await expect(trigger).toHaveAttribute('aria-controls', menu.id);

    // A consumer aria-label replaces the Trigger-derived name; ids stay unique per instance.
    const share = canvas.getByRole('group', { name: 'Share options' });
    const shareTrigger = within(share).getByRole('button', { name: 'Other share targets' });
    const shareMenu = await bodyOf(canvasElement).findByRole('menu', { name: 'Share targets' });
    await expect(shareMenu).not.toHaveAttribute('aria-labelledby');
    await expect(shareTrigger).toHaveAttribute('aria-controls', shareMenu.id);
    await expect(shareMenu.id).not.toBe(menu.id);
    await expect(shareTrigger.id).not.toBe(trigger.id);
  },
};

const actionRef = fn();
const triggerRef = fn();
const contentRef = fn();
const itemRef = fn();
const separatorRef = fn();

export const RefTargets: Story = {
  tags: ['!autodocs'],
  args: { defaultOpen: true, ref: fn() },
  render: ({ onAction, onCsv, onJson: _onJson, onDelete: _onDelete, ...args }) => (
    <SplitButton {...args}>
      <SplitButton.Action ref={actionRef} onClick={onAction}>
        {ACTION}
      </SplitButton.Action>
      <SplitButton.Trigger ref={triggerRef} aria-label={TRIGGER} />
      <SplitButton.Content ref={contentRef}>
        <SplitButton.Item ref={itemRef} onSelect={onCsv}>
          CSV
        </SplitButton.Item>
        <SplitButton.Separator ref={separatorRef} />
        <SplitButton.Item>JSON</SplitButton.Item>
      </SplitButton.Content>
    </SplitButton>
  ),
  play: async ({ args, canvasElement }) => {
    const view = canvasElement.ownerDocument.defaultView!;
    const group = within(canvasElement).getByRole('group', { name: GROUP });
    const action = getAction(canvasElement);
    const trigger = getTrigger(canvasElement);
    const menu = await bodyOf(canvasElement).findByRole('menu');
    const item = within(menu).getByRole('menuitem', { name: 'CSV' });
    const separator = within(menu).getByRole('separator');

    await expect(args.ref).toHaveBeenLastCalledWith(group);
    await expect(group).toBeInstanceOf(view.HTMLDivElement);
    await expect(actionRef).toHaveBeenLastCalledWith(action);
    await expect(action).toBeInstanceOf(view.HTMLButtonElement);
    await expect(triggerRef).toHaveBeenLastCalledWith(trigger);
    await expect(trigger).toBeInstanceOf(view.HTMLButtonElement);
    await expect(contentRef).toHaveBeenLastCalledWith(menu);
    await expect(itemRef).toHaveBeenLastCalledWith(item);
    await expect(separatorRef).toHaveBeenLastCalledWith(separator);

    // Each half is one native button carrying its part marker alongside Button's.
    await expect(action).toHaveAttribute('data-ui', 'split-button-action button');
    await expect(trigger).toHaveAttribute('data-ui', 'split-button-trigger button');
    await expect(action.querySelector('button, [role="button"]')).toBeNull();
    await expect(trigger.querySelector('button, [role="button"]')).toBeNull();
    await expect(item).toHaveAttribute('data-ui', 'split-button-item');
    await expect(separator).toHaveAttribute('data-ui', 'split-button-separator');
    await expect(action).toHaveAttribute('type', 'button');
    await expect(trigger).toHaveAttribute('type', 'button');

    await expect(SplitButton.displayName).toBe('SplitButton');
    await expect(
      [SplitButton.Action, SplitButton.Trigger, SplitButton.Content, SplitButton.Item, SplitButton.Separator].map(
        (part) => part.displayName,
      ),
    ).toEqual([
      'SplitButton.Action',
      'SplitButton.Trigger',
      'SplitButton.Content',
      'SplitButton.Item',
      'SplitButton.Separator',
    ]);
  },
};

export const NativeEventVeto: Story = {
  render: ({ onAction, onCsv, onJson: _onJson, onDelete: _onDelete, ...args }) => (
    <SplitButton {...args}>
      <SplitButton.Action onClick={onAction}>{ACTION}</SplitButton.Action>
      <SplitButton.Trigger
        aria-label={TRIGGER}
        onClick={(event) => event.preventDefault()}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') event.preventDefault();
        }}
      />
      <SplitButton.Content>
        <SplitButton.Item onSelect={onCsv} onClick={(event) => event.preventDefault()}>
          CSV
        </SplitButton.Item>
      </SplitButton.Content>
    </SplitButton>
  ),
  play: async ({ args, canvasElement, userEvent }) => {
    const trigger = getTrigger(canvasElement);
    // The consumer's preventDefault vetoes the open request from a click and from ArrowDown.
    await userEvent.click(trigger);
    await userEvent.keyboard('{ArrowDown}');
    await expect(bodyOf(canvasElement).queryByRole('menu')).toBeNull();
    await expect(args.onOpenChange).not.toHaveBeenCalled();

    // ArrowUp is not vetoed; the item's preventDefault keeps the menu open after selection.
    await userEvent.keyboard('{ArrowUp}');
    const menu = await bodyOf(canvasElement).findByRole('menu');
    await userEvent.click(within(menu).getByRole('menuitem', { name: 'CSV' }));
    await expect(args.onCsv).toHaveBeenCalledTimes(1);
    await expect(bodyOf(canvasElement).getByRole('menu')).toBe(menu);
    await expect(callValues(args.onOpenChange)).toEqual([true]);
    await expect(args.onAction).not.toHaveBeenCalled();
  },
};

export const Loading: Story = {
  render: ({ onAction, onCsv, onJson: _onJson, onDelete: _onDelete, ...args }) => (
    <SplitButton {...args}>
      <SplitButton.Action loading onClick={onAction}>
        {ACTION}
      </SplitButton.Action>
      <SplitButton.Trigger aria-label={TRIGGER} />
      <SplitButton.Content>
        <SplitButton.Item onSelect={onCsv}>CSV</SplitButton.Item>
      </SplitButton.Content>
    </SplitButton>
  ),
  play: async ({ args, canvasElement, userEvent }) => {
    const action = getAction(canvasElement);
    await expect(action).toHaveAttribute('aria-busy', 'true');
    await expect(action).toHaveAttribute('aria-disabled', 'true');
    // Loading blocks activation and keeps focus.
    await userEvent.tab();
    await expectActive(canvasElement, action);
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    await expect(args.onAction).not.toHaveBeenCalled();
    await expectActive(canvasElement, action);
    // The Trigger stays usable.
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    await expectItemFocused(canvasElement, 'CSV');
  },
};

const RESERVED = ['Export PDF', 'Exporting…', 'Exported'] as const;

function ReservedLabelsHarness(args: StoryArgs) {
  const [step, setStep] = useState(0);
  return (
    <ExportSplitButtonWithLabel
      {...args}
      label={RESERVED[step]!}
      onAction={(event) => {
        args.onAction?.(event);
        setStep((current) => (current + 1) % RESERVED.length);
      }}
    />
  );
}
ReservedLabelsHarness.displayName = 'ReservedLabelsHarness';

function ExportSplitButtonWithLabel({ label, onAction, onCsv, ...args }: Omit<StoryArgs, 'label'> & { label: string }) {
  const { onJson: _onJson, onDelete: _onDelete, ...props } = args;
  return (
    <SplitButton {...props}>
      <SplitButton.Action reserveLabels={RESERVED} onClick={onAction}>
        {label}
      </SplitButton.Action>
      <SplitButton.Trigger aria-label={TRIGGER} />
      <SplitButton.Content>
        <SplitButton.Item onSelect={onCsv}>CSV</SplitButton.Item>
      </SplitButton.Content>
    </SplitButton>
  );
}
ExportSplitButtonWithLabel.displayName = 'ExportSplitButtonWithLabel';

export const ReservedLabels: Story = {
  render: (args) => <ReservedLabelsHarness {...args} />,
  play: async ({ args, canvasElement, userEvent }) => {
    const action = getAction(canvasElement, 'Export PDF');
    const width = action.getBoundingClientRect().width;
    const live = () => action.querySelector('[data-ui="split-button-label"] > :last-child')!;
    await expect(live()).not.toHaveAttribute('data-swapped');

    for (const label of ['Exporting…', 'Exported', 'Export PDF']) {
      await userEvent.click(action);
      // The accessible name is the current label only; the reserved copies are hidden.
      await waitFor(() => expect(action).toHaveAccessibleName(label));
      await expect(live()).toHaveAttribute('data-swapped');
      await wait(SETTLE_MS);
      await expect(Math.abs(action.getBoundingClientRect().width - width)).toBeLessThan(TOLERANCE_PX);
    }
    await expect(args.onAction).toHaveBeenCalledTimes(3);
  },
};

export const TriggerChildren: Story = {
  render: ({ onAction: _onAction, onCsv: _onCsv, onJson: _onJson, onDelete: _onDelete, ...args }) => (
    <StackFrame>
      {(
        [
          ['default', undefined, 'Trigger default'],
          ['false', false, 'Trigger false'],
          ['null', null, 'Trigger null'],
          // Visible text belongs in the accessible name.
          ['zero', 0, '0 more formats'],
          ['empty', '', 'Trigger empty'],
        ] as const
      ).map(([name, children, label]) => (
        <SplitButton key={name} {...args} aria-label={`Group ${name}`}>
          <SplitButton.Action>{ACTION}</SplitButton.Action>
          <SplitButton.Trigger aria-label={label}>{children}</SplitButton.Trigger>
          <SplitButton.Content />
        </SplitButton>
      ))}
    </StackFrame>
  ),
  play: async ({ canvasElement }) => {
    const trigger = (name: string) => getTrigger(canvasElement, name === 'zero' ? '0 more formats' : `Trigger ${name}`);
    await expect(trigger('default').querySelector('[aria-hidden="true"] > svg')).not.toBeNull();
    for (const name of ['false', 'null', 'empty']) {
      await expect(trigger(name).childElementCount).toBe(0);
    }
    const zero = trigger('zero').querySelector('[aria-hidden="true"]');
    await expect(zero).toHaveTextContent('0');
    await expect(trigger('zero')).toHaveAccessibleName('0 more formats');
  },
};

class UsageErrorBoundary extends Component<{ children: ReactNode }, { message: string | null }> {
  state = { message: null };
  static getDerivedStateFromError(error: Error) {
    return { message: error.message };
  }
  render() {
    return this.state.message === null ? this.props.children : <p data-usage-error="">{this.state.message}</p>;
  }
}

export const UsageErrors: Story = {
  tags: ['!autodocs'],
  render: () => (
    <StackFrame>
      <UsageErrorBoundary>
        <SplitButton.Trigger aria-label={TRIGGER} />
      </UsageErrorBoundary>
      <UsageErrorBoundary>
        <SplitButton aria-label={GROUP} defaultOpen>
          <SplitButton.Action>{ACTION}</SplitButton.Action>
          <SplitButton.Trigger aria-label={TRIGGER} />
          <SplitButton.Item>CSV</SplitButton.Item>
        </SplitButton>
      </UsageErrorBoundary>
    </StackFrame>
  ),
  play: async ({ canvasElement }) => {
    const messages = Array.from(canvasElement.querySelectorAll('[data-usage-error]'), (node) => node.textContent);
    await expect(messages).toEqual([
      'SplitButton.Trigger must be rendered inside <SplitButton>.',
      'SplitButton.Item must be rendered inside <SplitButton.Content>.',
    ]);
  },
};

export const ReducedMotion: Story = {
  tags: ['!autodocs'],
  parameters: {
    docs: {
      description: {
        story:
          'Enable reduced motion to check behavior in the browser. This story checks CSS rules only.',
      },
    },
  },
  args: { defaultOpen: true },
  render: (args) => <ReservedLabelsHarness {...args} />,
  play: async ({ canvasElement, userEvent }) => {
    await bodyOf(canvasElement).findByRole('menu');
    const trigger = getTrigger(canvasElement);
    const chevronWrapper = trigger.querySelector('[aria-hidden="true"]')!;
    await expect(getComputedStyle(chevronWrapper).transitionProperty).toBe('transform');
    await expect(mediaRuleSets(chevronWrapper, 'prefers-reduced-motion: reduce', 'transform', 'none')).toBe(true);
    await expect(mediaRuleSets(chevronWrapper, 'prefers-reduced-motion: reduce', 'transition-duration', '0s')).toBe(
      true,
    );
    await expect(mediaRuleSets(trigger, 'prefers-reduced-motion: reduce', 'transition-duration', '0s')).toBe(true);

    await userEvent.click(getAction(canvasElement, 'Export PDF'));
    const live = canvasElement.querySelector('[data-ui="split-button-label"] > [data-swapped]')!;
    await expect(getComputedStyle(live).animationName).not.toBe('none');
    await expect(mediaRuleSets(live, 'prefers-reduced-motion: reduce', 'animation-name', 'none')).toBe(true);
  },
};

export const ForcedColors: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Enable forced colors to check both buttons in the browser. This story checks CSS rules only.',
      },
      source: {
        language: 'tsx',
        code: `${exportSnippetBase}

export function ExportRow({
  exportPdf,
  exportCsv,
  exportJson,
  deleteExport,
}: {
  exportPdf?: () => void;
  exportCsv?: () => void;
  exportJson?: () => void;
  deleteExport?: () => void;
}) {
  return (
    <Row>
      <SplitButton aria-label="Export options">
        <SplitButton.Action onClick={exportPdf}>
          Export PDF
        </SplitButton.Action>
        <SplitButton.Trigger aria-label="Other export formats" />
        <SplitButton.Content>
          <SplitButton.Item onSelect={exportCsv}>
            CSV
          </SplitButton.Item>
          <SplitButton.Item disabled>Excel</SplitButton.Item>
          <SplitButton.Item onSelect={exportJson}>
            JSON
          </SplitButton.Item>
          <SplitButton.Separator />
          <SplitButton.Item tone="danger" onSelect={deleteExport}>
            Delete export
          </SplitButton.Item>
        </SplitButton.Content>
      </SplitButton>
      <Button>After</Button>
    </Row>
  );
}`,
      },
    },
  },
  play: async ({ canvasElement }) => {
    const action = getAction(canvasElement);
    const trigger = getTrigger(canvasElement);
    await expect(mediaRuleSets(action, 'forced-colors: active', 'border-color', 'buttontext')).toBe(true);
    await expect(mediaRuleSets(trigger, 'forced-colors: active', 'border-color', 'buttontext')).toBe(true);
    await expect(
      mediaRuleSets(trigger.querySelector('[aria-hidden="true"]')!, 'forced-colors: active', 'color', 'buttontext'),
    ).toBe(true);
    // A real divider border, not a fill change, separates the halves.
    await expect(getComputedStyle(trigger).borderLeftStyle).toBe('solid');
    await expect(parseFloat(getComputedStyle(trigger).borderLeftWidth)).toBeGreaterThan(0);
  },
};

// This story tests the documented css/slot API and native style merging.
export const SxPrecedence: Story = {
  tags: ['!autodocs'],
  args: { defaultOpen: true, sx: consumerSx, className: 'consumer-root' },
  render: ({ onAction, onCsv, onJson: _onJson, onDelete: _onDelete, ...args }) => (
    <ClassNames>{({ css: register }) => <SplitButton {...args} className={`consumer-root ${register(consumerCss)}`}>
      <SplitButton.Action className={`consumer-action ${register(consumerCss)}`} sx={consumerSx} onClick={onAction}>
        {ACTION}
      </SplitButton.Action>
      <SplitButton.Trigger className={`consumer-trigger ${register(consumerCss)}`} sx={consumerSx} aria-label={TRIGGER} />
      <SplitButton.Content className={`consumer-content ${register(consumerCss)}`} sx={consumerSx}>
        <SplitButton.Item className={`consumer-item ${register(consumerCss)}`} sx={consumerSx} onSelect={onCsv}>
          CSV
        </SplitButton.Item>
        <SplitButton.Separator className={`consumer-separator ${register(consumerCss)}`} sx={consumerSx} />
      </SplitButton.Content>
    </SplitButton>}</ClassNames>
  ),
  play: async ({ canvasElement }) => {
    const menu = await bodyOf(canvasElement).findByRole('menu');
    const parts: Array<[string, HTMLElement]> = [
      ['consumer-root', within(canvasElement).getByRole('group')],
      ['consumer-action', getAction(canvasElement)],
      ['consumer-trigger', getTrigger(canvasElement)],
      ['consumer-content', menu],
      ['consumer-item', within(menu).getByRole('menuitem', { name: 'CSV' })],
      ['consumer-separator', within(menu).getByRole('separator')],
    ];
    for (const [className, element] of parts) {
      await expect(element).toHaveClass(className);
      // Registered classes (including stray Emotion css) land before sx.
      await expect(getComputedStyle(element).marginInlineStart).toBe('8px');
      await expect(getComputedStyle(element).letterSpacing).not.toBe('normal');
    }
    // Own join styles survive under consumer overrides.
    await expect(getComputedStyle(getAction(canvasElement)).borderTopRightRadius).toBe('0px');
    await expect(getComputedStyle(getTrigger(canvasElement)).borderTopLeftRadius).toBe('0px');
  },
};
