import {
  FieldReplacementRoot,
  FieldSugarRoot,
  FieldReplacementInput,
  fieldRootStyles,
  expectFieldSlotCustomization,
} from '../../testing/field-slot-fixtures';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fireEvent, fn, spyOn, waitFor } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { withLightTheme } from '../../testing/story-decorators';
import { findConditionalStyle } from '../../testing/conditional-style';
// `styled` is the app-facing styling API; consumers import it from `@jfrader/ui`.
import { styled } from '../../index';
import { ExpandingSearch, type ExpandingSearchProps } from './index';

const FixtureButton = styled.button({ minInlineSize: vars.space[6], minBlockSize: vars.space[6] });
const Frame = styled.div({ inlineSize: 420, maxInlineSize: '100%' });
const Stack = styled.div({ display: 'grid', gap: vars.space[4] });
const NarrowLaneFrame = styled.div({ inlineSize: 180 });
const meta = {
  title: 'Inputs/ExpandingSearch', component: ExpandingSearch, tags: ['autodocs'],
  args: { triggerLabel: 'Search members', inputProps: { placeholder: 'Name or email' } },
  decorators: [(Story) => <Frame><Story /></Frame>],
  parameters: { docs: {
    sections: [
      { title: 'Search entry', stories: ['Default', 'Controlled'] },
      { title: 'Layout', stories: ['Sizes', 'Anchors'] },
      { title: 'Forms', stories: ['FormReset'] },
    ],
    description: { component: 'Open a search field from a button without moving nearby toolbar items.' },
    usage: `### Keyboard
Enter or Space opens and focuses the searchbox. Escape collapses without clearing the query; accepted closure returns focus to the button. Tab and Shift+Tab move through the field and clear action. Leaving closes without returning focus. Controlled open requests take effect only when accepted.

### Layout and results

Reserve space for expansion in the toolbar. Supply filtering and results in your application. Query entry, clearing, validation and form reset follow SearchField behaviour.`,
  } },
} satisfies Meta<typeof ExpandingSearch>;
export default meta;
type Story = StoryObj<typeof meta>;

function ControlledSearch(props: ExpandingSearchProps) {
  const [open, setOpen] = useState(props.defaultOpen ?? false);
  const [value, setValue] = useState(props.defaultValue ?? '');
  return <ExpandingSearch {...props} open={open} value={value} onOpenChange={(next) => { props.onOpenChange?.(next); setOpen(next); }} onValueChange={(next) => { props.onValueChange?.(next); setValue(next); }} />;
}
ControlledSearch.displayName = 'ControlledExpandingSearch';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const TOLERANCE = 1.1;
const near = (actual: number, expected: number) => Math.abs(actual - expected) < TOLERANCE;
const parts = (canvasElement: HTMLElement) => {
  const root = canvasElement.querySelector<HTMLElement>('[data-ui="expanding-search"]')!;
  return { root, shell: root.children[1] as HTMLElement };
};
/** Waits for the open morph to settle on the lane-capped target before axe reads the geometry. */
async function settledOpen(canvasElement: HTMLElement) {
  const { root, shell } = parts(canvasElement);
  await waitFor(async () => { await expect(near(shell.getBoundingClientRect().width, root.children[0]!.getBoundingClientRect().width)).toBe(true); });
}
/** Resolves a token length through a throwaway element, independent of the component's own measurement. */
function resolvePx(host: HTMLElement, radius: string) {
  const probe = host.ownerDocument.createElement('span');
  probe.style.borderStartStartRadius = radius;
  host.append(probe);
  const value = parseFloat(getComputedStyle(probe).borderStartStartRadius);
  probe.remove();
  return value;
}
async function expectFocus(element: HTMLElement, ring = element) {
  await expect(element.ownerDocument.activeElement).toBe(element);
  await expect(getComputedStyle(ring).outlineStyle).not.toBe('none');
  await expect(parseFloat(getComputedStyle(ring).outlineWidth)).toBeGreaterThan(1);
}

export const Default: Story = {
  name: 'Search members',
  parameters: { docs: {
    description: { story: 'Open the field to search by name or email.' },
    source: { language: 'tsx', code: `import { ExpandingSearch } from '@jfrader/ui';

<ExpandingSearch triggerLabel="Search members" inputProps={{ placeholder: 'Name or email' }} />` },
  } },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await expect(canvas.queryByRole('searchbox')).toBeNull();
    const trigger = canvas.getByRole('button', { name: 'Search members' });
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(trigger);
    const input = canvas.getByRole('searchbox', { name: 'Search members' });
    await expect(input.ownerDocument.activeElement).toBe(input);
    const { shell } = parts(canvasElement);
    const fieldRadius = resolvePx(canvasElement, vars.radius.sm);
    await waitFor(async () => {
      await expect(near(shell.getBoundingClientRect().width, 384)).toBe(true);
      await expect(near(parseFloat(getComputedStyle(input.parentElement!).borderStartStartRadius), fieldRadius)).toBe(true);
    });
  },
};
export const PersistentOpen: Story = { tags: ['!autodocs'], args: { defaultOpen: true, defaultValue: 'Ada' } };
export const Description: Story = { tags: ['!autodocs'], args: { defaultOpen: true, label: 'Search members', description: 'Search by name or email.' } };
export const Error: Story = { tags: ['!autodocs'], args: { defaultOpen: true, error: 'Enter at least four characters.', defaultValue: 'Ada', inputProps: { required: true } } };
export const Sizes: Story = {
  name: 'Search sizes',
  parameters: { docs: {
    description: { story: 'Choose a search control size for the surrounding toolbar.' },
    source: { language: 'tsx', code: `import { ExpandingSearch, Stack } from '@jfrader/ui';

<Stack>
  <ExpandingSearch size="sm" triggerLabel="Search sm" inputProps={{ placeholder: 'Name or email' }} />
  <ExpandingSearch size="md" triggerLabel="Search md" inputProps={{ placeholder: 'Name or email' }} />
  <ExpandingSearch size="lg" triggerLabel="Search lg" inputProps={{ placeholder: 'Name or email' }} />
</Stack>` },
  } },
  render: (args) => <Stack>{(['sm', 'md', 'lg'] as const).map((size) => <ExpandingSearch {...args} key={size} size={size} triggerLabel={`Search ${size}`} />)}</Stack>,
  play: async ({ canvas }) => {
    for (const [index, size] of [32, 40, 48].entries()) {
      const rect = canvas.getAllByRole('button')[index]!.getBoundingClientRect();
      await expect(near(rect.width, size)).toBe(true);
      await expect(near(rect.height, size)).toBe(true);
      await expect(near(parseFloat(getComputedStyle(canvas.getAllByRole('button')[index]!).borderStartStartRadius), size / 2)).toBe(true);
    }
  },
};
export const Anchors: Story = {
  name: 'Expansion direction',
  parameters: { docs: {
    description: { story: 'Expand from the logical start or end of the search lane.' },
    source: { language: 'tsx', code: `import { ExpandingSearch, Stack } from '@jfrader/ui';

<Stack>
  <ExpandingSearch anchor="start" triggerLabel="Search from start" inputProps={{ placeholder: 'Name or email' }} />
  <ExpandingSearch anchor="end" triggerLabel="Search from end" inputProps={{ placeholder: 'Name or email' }} />
</Stack>` },
  } },
  render: (args) => <Stack><ExpandingSearch {...args} anchor="start" triggerLabel="Search from start" /><ExpandingSearch {...args} anchor="end" triggerLabel="Search from end" /></Stack>,
};
export const Uncontrolled: Story = {
  args: { defaultValue: 'Ada', onOpenChange: fn(), onValueChange: fn() },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button'));
    const input = canvas.getByRole('searchbox');
    await expect(input).toHaveValue('Ada');
    await userEvent.keyboard('{Escape}');
    await expect(canvas.queryByRole('searchbox')).toBeNull();
    await expect(args.onOpenChange).toHaveBeenCalledTimes(2);
    await expect(args.onOpenChange).toHaveBeenNthCalledWith(1, true);
    await expect(args.onOpenChange).toHaveBeenNthCalledWith(2, false);
    await expect(args.onValueChange).toHaveBeenCalledTimes(0);
    await userEvent.keyboard('{Enter}');
    await expect(canvas.getByRole('searchbox')).toHaveValue('Ada');
    await expect(args.onOpenChange).toHaveBeenCalledTimes(3);
    await settledOpen(canvasElement);
  },
};
export const Controlled: Story = {
  ...Uncontrolled,
  name: 'Controlled search',
  parameters: { docs: {
    description: { story: 'Keep the query when the field closes and opens again.' },
    source: { language: 'tsx', code: `import { useState } from 'react';
import { ExpandingSearch } from '@jfrader/ui';

export function MemberSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('Ada');
  return <ExpandingSearch triggerLabel="Search members" open={open} onOpenChange={setOpen}
    value={query} onValueChange={setQuery} inputProps={{ placeholder: 'Name or email' }} />;
}` },
  } },
  render: (args) => <ControlledSearch {...args} />,
  args: { defaultValue: 'Ada', onOpenChange: fn(), onValueChange: fn() },
};
export const RejectedOpen: Story = {
  args: { open: false, onOpenChange: fn() },
  play: async ({ canvas, userEvent, args }) => {
    const trigger = canvas.getByRole('button');
    await userEvent.tab();
    await expectFocus(trigger);
    await userEvent.keyboard('{Enter}');
    await expect(canvas.queryByRole('searchbox')).toBeNull();
    await expectFocus(trigger);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(true);
    await userEvent.keyboard(' ');
    await expect(args.onOpenChange).toHaveBeenCalledTimes(2);
  },
};
export const RejectedClose: Story = {
  tags: ['!autodocs'],
  args: { open: true, defaultValue: 'Ada', onOpenChange: fn(), onValueChange: fn() },
  play: async ({ canvas, userEvent, args }) => {
    const input = canvas.getByRole('searchbox');
    await userEvent.tab();
    await userEvent.keyboard('{Escape}');
    await expectFocus(input, input.parentElement!);
    await expect(input).toHaveValue('Ada');
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);
    await expect(args.onValueChange).toHaveBeenCalledTimes(0);
  },
};
export const RejectedQuery: Story = {
  tags: ['!autodocs'],
  args: { defaultOpen: true, value: 'Ada', onValueChange: fn() },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Clear search' }));
    await expect(canvas.getByRole('searchbox')).toHaveValue('Ada');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('');
  },
};
export const Keyboard: Story = {
  args: { onOpenChange: fn(), onValueChange: fn() },
  render: (args) => <><FixtureButton>Before</FixtureButton><ExpandingSearch {...args} /><FixtureButton>After</FixtureButton></>,
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.tab();
    await userEvent.tab();
    const trigger = canvas.getByRole('button', { name: 'Search members' });
    await expectFocus(trigger);
    await userEvent.keyboard(' ');
    const input = canvas.getByRole('searchbox');
    await expectFocus(input, input.parentElement!);
    await userEvent.keyboard('x');
    await expect(input).toHaveValue('x');
    await userEvent.tab();
    await expectFocus(canvas.getByRole('button', { name: 'Clear search' }));
    await userEvent.keyboard('{Enter}');
    await expectFocus(input, input.parentElement!);
    await expect(input).toHaveValue('');
    await userEvent.keyboard('y{Escape}');
    await expectFocus(trigger);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(2);
    await expect(args.onValueChange).toHaveBeenCalledTimes(3);
    await userEvent.keyboard('{Enter}');
    await expect(canvas.getByRole('searchbox')).toHaveValue('y');
    await userEvent.tab();
    await userEvent.tab();
    await expect(input.ownerDocument.activeElement).toBe(canvas.getByRole('button', { name: 'After' }));
    await expect(canvas.queryByRole('searchbox')).toBeNull();
    await userEvent.tab({ shift: true });
    await expectFocus(trigger);
    await userEvent.keyboard('{Enter}');
    await userEvent.tab({ shift: true });
    await expect(input.ownerDocument.activeElement).toBe(canvas.getByRole('button', { name: 'Before' }));
    await expect(args.onOpenChange).toHaveBeenCalledTimes(6);
    await expect(canvas.queryByRole('searchbox')).toBeNull();
  },
};
export const CompositionAndVeto: Story = {
  tags: ['!autodocs'],
  args: { defaultOpen: true, defaultValue: 'Ada', onOpenChange: fn(), onValueChange: fn(), inputProps: { onKeyDown: (event) => { if (event.shiftKey) event.preventDefault(); } } },
  play: async ({ canvas, userEvent, args }) => {
    const input = canvas.getByRole('searchbox');
    const event = new KeyboardEvent('keydown', { key: 'Escape', isComposing: true, bubbles: true, cancelable: true });
    fireEvent(input, event);
    await expect(event.defaultPrevented).toBe(false);
    await userEvent.click(input);
    await userEvent.keyboard('{Shift>}{Escape}{/Shift}');
    await expect(input).toHaveValue('Ada');
    await expect(args.onOpenChange).toHaveBeenCalledTimes(0);
    await expect(args.onValueChange).toHaveBeenCalledTimes(0);
  },
};
export const ExternalAria: Story = {
  tags: ['!autodocs'],
  args: { defaultOpen: true, inputProps: { 'aria-label': 'Fallback name', 'aria-labelledby': 'member-name missing-name', 'aria-describedby': 'member-help missing-help' }, description: 'Name or email.', error: 'No matches.' },
  render: (args) => <><span id="member-name">Find members</span><span id="member-help">Directory</span><ExpandingSearch {...args} /></>,
  play: async ({ canvas }) => {
    const input = canvas.getByRole('searchbox', { name: 'Find members' });
    await expect(input).toHaveAttribute('aria-label', 'Fallback name');
    await expect(input).toHaveAttribute('aria-labelledby', 'member-name missing-name');
    await expect(input.getAttribute('aria-describedby')).toContain('member-help missing-help');
    await expect(input).toHaveAccessibleDescription('Directory Name or email. No matches.');
  },
};
export const FalsyNodes: Story = {
  tags: ['!autodocs'],
  render: (args) => <Stack>{([false, null, 0, ''] as const).map((node, index) => <ExpandingSearch {...args} key={index} defaultOpen triggerLabel={`Search ${index}`} label={node} description={node} error={node} searchIcon={node} clearIcon={node} messages={{ clear: node === 0 ? 'Clear search 0' : 'Clear search' }} inputProps={{ 'aria-label': `Search ${index}` }} defaultValue="x" />)}</Stack>,
  play: async ({ canvas }) => {
    const inputs = canvas.getAllByRole('searchbox');
    await expect(inputs).toHaveLength(4);
    for (const index of [0, 1]) await expect(inputs[index]).not.toHaveAttribute('aria-describedby');
    await expect(inputs[2]).toHaveAccessibleDescription('0 0');
    for (const input of [inputs[2]!, inputs[3]!]) {
      for (const id of input.getAttribute('aria-describedby')!.split(' ')) await expect(input.ownerDocument.getElementById(id)).not.toBeNull();
    }
    await expect(canvas.getAllByRole('alert')).toHaveLength(2);
  },
};
export const Disabled: Story = {
  args: { disabled: true, onOpenChange: fn() },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button'));
    await expect(canvas.getByRole('button')).toBeDisabled();
    await expect(args.onOpenChange).toHaveBeenCalledTimes(0);
  },
};
export const DisabledOpen: Story = { tags: ['!autodocs'], args: { defaultOpen: true, disabled: true, defaultValue: 'Ada' } };
export const ReadOnly: Story = { tags: ['!autodocs'], args: { defaultOpen: true, inputProps: { readOnly: true }, defaultValue: 'Ada' } };
export const ClearThenCollapse: Story = {
  tags: ['!autodocs'],
  args: { defaultOpen: true, defaultValue: 'Ada', onOpenChange: fn(), onValueChange: fn() },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.tab();
    await userEvent.tab();
    await expectFocus(canvas.getByRole('button', { name: 'Clear search' }));
    await userEvent.keyboard('{Escape}');
    await expectFocus(canvas.getByRole('button', { name: 'Search members' }));
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);
    await expect(args.onValueChange).toHaveBeenCalledTimes(0);
  },
};
export const FormReset: Story = {
  name: 'Reset a search form',
  parameters: { docs: {
    description: { story: 'Reset the search query to its initial value with a native form reset.' },
    source: { language: 'tsx', code: `import { Button, ExpandingSearch } from '@jfrader/ui';

<form>
  <ExpandingSearch triggerLabel="Search members" defaultValue="Ada" inputProps={{ name: 'query' }} />
  <Button type="reset">Reset query</Button>
</form>` },
  } },
  args: { defaultValue: 'Ada', inputProps: { name: 'query' }, onValueChange: fn() },
  render: (args) => <form><ExpandingSearch {...args} /><FixtureButton type="reset">Reset query</FixtureButton></form>,
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Search members' }));
    await userEvent.keyboard('x{Escape}');
    await userEvent.click(canvas.getByRole('button', { name: 'Reset query' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Search members' }));
    const input = canvas.getByRole('searchbox') as HTMLInputElement;
    await expect(input).toHaveValue('Ada');
    await expect(new FormData(input.form!).get('query')).toBe('Ada');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('Adax');
    await settledOpen(canvasElement);
  },
};
export const LightTheme: Story = { ...PersistentOpen, tags: ['!autodocs'], decorators: [withLightTheme], globals: { theme: 'light' } };
export const RTL: Story = {
  tags: ['!autodocs'],
  args: { defaultOpen: true, dir: 'rtl', defaultValue: 'Ada' },
  play: async ({ canvas }) => { await expect(getComputedStyle(canvas.getByRole('searchbox')).direction).toBe('rtl'); },
};
export const NarrowLane: Story = {
  render: (args) => <NarrowLaneFrame><ExpandingSearch {...args} /><FixtureButton>Neighbor</FixtureButton></NarrowLaneFrame>,
  play: async ({ canvas, userEvent, canvasElement }) => {
    const neighbor = canvas.getByRole('button', { name: 'Neighbor' });
    const before = neighbor.getBoundingClientRect();
    await userEvent.click(canvas.getByRole('button', { name: 'Search members' }));
    const { root, shell } = parts(canvasElement);
    await waitFor(async () => { await expect(near(shell.getBoundingClientRect().width, root.getBoundingClientRect().width)).toBe(true); });
    await expect(near(neighbor.getBoundingClientRect().top, before.top)).toBe(true);
    await expect(near(neighbor.getBoundingClientRect().left, before.left)).toBe(true);
  },
};
// This story tests native inline styles and the documented sx/slot css API.
export const RefAndStyles: Story = {
  tags: ['!autodocs'],
  args: {
    defaultOpen: true, ref: fn(), inputRef: fn(), id: 'member-search', title: 'Member search', style: { letterSpacing: '0.1em' },
    sx: { paddingBlock: vars.space[3] }, inputProps: { style: { wordSpacing: '0.2em' } },
    slotProps: { control: { sx: { fontWeight: vars.fontWeight.medium } }, shell: { sx: { borderRadius: 0 } } },
  },
  play: async ({ canvas, canvasElement, args }) => {
    const { root } = parts(canvasElement);
    const input = canvas.getByRole('searchbox');
    await expect(args.ref).toHaveBeenLastCalledWith(root);
    await expect(args.inputRef).toHaveBeenLastCalledWith(input);
    await expect(root).toHaveAttribute('id', 'member-search');
    await expect(root).toHaveAttribute('title', 'Member search');
    await expect(root.style.letterSpacing).toBe('0.1em');
    await expect(input.style.wordSpacing).toBe('0.2em');
    await expect(parseFloat(getComputedStyle(root).paddingBlockStart)).toBeGreaterThan(10);
    await expect(getComputedStyle(input).fontWeight).toBe('500');
    await expect(getComputedStyle(input.parentElement!).borderStartStartRadius).toBe('0px');
  },
};
export const ForcedColors: Story = {
  ...PersistentOpen,
  tags: ['!autodocs'],
  parameters: { docs: { description: { story: 'Checks CSS rules without emulating forced colors. Enable forced colors in the browser to check rendering.' } } },
  play: async ({ canvas }) => {
    const trigger = canvas.getByRole('button', { name: 'Search members', hidden: true });
    await expect(findConditionalStyle(trigger, 'forced-colors: active', 'border-color')?.toLowerCase()).toBe('buttontext');
    await expect(findConditionalStyle(canvas.getByRole('searchbox').parentElement!, 'forced-colors: active', 'border-color')?.toLowerCase()).toBe('canvastext');
  },
};
export const ReducedMotion: Story = {
  parameters: { docs: { description: { story: 'Mocks `matchMedia` to test instant opening/closing with reduced motion and spring motion without it. Check rendering with browser media emulation.' } } },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const { shell } = parts(canvasElement);
    const win = shell.ownerDocument.defaultView!;
    const realMatchMedia = win.matchMedia.bind(win);
    const fieldRadius = resolvePx(canvasElement, vars.radius.sm);
    const frames: { width: number; radius: number }[] = [];
    const observer = new MutationObserver(() => frames.push({ width: parseFloat(shell.style.inlineSize), radius: parseFloat(shell.style.getPropertyValue('--expanding-search-radius')) }));
    const between = (value: number, a: number, b: number) => value > Math.min(a, b) + TOLERANCE / 2 && value < Math.max(a, b) - TOLERANCE / 2;
    // Collapsed: 40px circle (radius 20px); expanded: 384px field with the radius.sm corner.
    const morph = async (act: () => Promise<void>, open: boolean, reduce: boolean) => {
      const [from, to] = open ? [{ width: 40, radius: 20 }, { width: 384, radius: fieldRadius }] : [{ width: 384, radius: fieldRadius }, { width: 40, radius: 20 }];
      frames.length = 0;
      await act();
      if (reduce) await expect(near(shell.getBoundingClientRect().width, to.width)).toBe(true);
      await waitFor(async () => { await expect(near(shell.getBoundingClientRect().width, to.width)).toBe(true); });
      await expect(near(parseFloat(shell.style.getPropertyValue('--expanding-search-radius')), to.radius)).toBe(true);
      const widths = frames.filter((frame) => between(frame.width, from.width, to.width));
      const radii = frames.filter((frame) => between(frame.radius, from.radius, to.radius));
      if (reduce) {
        await expect(widths).toHaveLength(0);
        await expect(radii).toHaveLength(0);
      } else {
        await expect(widths.length).toBeGreaterThan(0);
        await expect(radii.length).toBeGreaterThan(0);
      }
    };
    observer.observe(shell, { attributeFilter: ['style'] });
    try {
      for (const reduce of [true, false]) {
        const matchMedia = spyOn(win, 'matchMedia').mockImplementation((query) =>
          query === REDUCED_MOTION_QUERY ? Object.defineProperty(realMatchMedia(query), 'matches', { value: reduce }) : realMatchMedia(query));
        try {
          await morph(() => userEvent.click(canvas.getByRole('button', { name: 'Search members' })), true, reduce);
          await expect(matchMedia).toHaveBeenCalledWith(REDUCED_MOTION_QUERY);
          await morph(() => userEvent.keyboard('{Escape}'), false, reduce);
        } finally {
          matchMedia.mockRestore();
        }
      }
    } finally {
      observer.disconnect();
    }
  },
};

const StyledExpandingSearch = styled(ExpandingSearch)({ borderRadius: '9px' });
/** Replace the wrapper and generated control; pass native props through slotProps. */
export const SlotCustomization: Story = {
  tags: ['!autodocs'],
  args: {
    defaultOpen: true,
    label: 'Search members',
    ref: fn(),
    onClick: fn(),
    className: 'consumer-root',
    title: 'consumer title',
    style: fieldRootStyles.consumer,
    sx: { borderRadius: '11px' },
    component: FieldSugarRoot,
    slots: { root: FieldReplacementRoot, control: FieldReplacementInput },
    slotProps: {
      root: {
        onClick: fn(),
        ref: fn(),
        className: 'slot-root',
        title: 'slot title',
        style: fieldRootStyles.slot,
        sx: { borderRadius: '8px' },
      },
      control: { ref: fn(), title: 'generated part' },
    },
  },
  render: (args) => <StyledExpandingSearch {...args} />,
  parameters: {
    docs: {
      source: {
        code: "function MyRoot(props) { return <div {...props} />; }\nfunction MyInput(props) { return <input {...props} />; }\n\n<ExpandingSearch label=\"Name\" triggerLabel=\"Search members\" defaultOpen\n  component={MyRoot}\n  slots={{ control: MyInput }}\n  slotProps={{ root: { sx: { borderRadius: '8px' } }, control: { title: 'Name' } }}\n  sx={{ borderRadius: '11px' }}\n/>",
      },
    },
  },
  play: async ({ canvasElement, args }) => {
    await expectFieldSlotCustomization(
      canvasElement,
      {
        rootEvent: args.slotProps?.root?.onClick,
        consumerEvent: args.onClick,
        root: args.slotProps?.root?.ref,
        part: args.slotProps?.control?.ref,
        consumer: args.ref,
      },
      'root',
    );
  },
};

/** Use component as shorthand for the wrapper's root slot. */
export const ComponentRoot: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import type { ComponentPropsWithRef } from 'react';
import { ExpandingSearch, styled } from '@jfrader/ui';

const Toolbar = styled.div({ inlineSize: 420, maxInlineSize: '100%' });

function SearchRoot(props: ComponentPropsWithRef<'div'>) {
  return <div {...props} />;
}

<Toolbar>
  <ExpandingSearch component={SearchRoot} triggerLabel="Search members" inputProps={{ placeholder: 'Name or email' }} />
</Toolbar>` } } },
  args: { component: FieldSugarRoot },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[data-slot-root="component"]')).not.toBeNull();
  },
};

export type ExpandingSearchSlotTypeRegression = {
  // @ts-expect-error Unknown structural keys are rejected.
  unknownSlot: NonNullable<import('./index').ExpandingSearchProps['slots']>['notASlot'];
  // @ts-expect-error Unknown prop keys are rejected.
  unknownSlotProps: NonNullable<import('./index').ExpandingSearchProps['slotProps']>['notASlot'];
};
