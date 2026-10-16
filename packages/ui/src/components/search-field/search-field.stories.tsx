import {
  FieldReplacementRoot,
  FieldSugarRoot,
  FieldReplacementLabel,
  fieldRootStyles,
  expectFieldSlotCustomization,
} from '../../testing/field-slot-fixtures';
import { useRef, useState, type FormEvent } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fireEvent, fn } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
// `styled` is the app-facing styling API; consumers import it from `@jfrader/ui`.
import { styled } from '../../index';
import { withLightTheme } from '../../testing/story-decorators';
import { SearchField, type SearchFieldProps } from './index';

// Raw fixture buttons must pass the global target-size (WCAG 2.5.8) axe gate in every environment.
const FixtureButton = styled.button({ minHeight: vars.space[6], minWidth: vars.space[6], paddingBlock: vars.space[1], paddingInline: `calc(${vars.space[5]} / 2)`, boxSizing: 'border-box' });


const sizes = ['sm', 'md', 'lg'] as const;
const heights = { sm: 32, md: 40, lg: 48 };
const Stack = styled.div({ display: 'grid', gap: vars.space[4], inlineSize: 'min(100%, 320px)' });
const usage = '<SearchField label="Search members" value={query} onValueChange={setQuery} placeholder="Name or email" />';
const meta = {
  title: 'Inputs/SearchField', component: SearchField, tags: ['autodocs'],
  args: { label: 'Search members', placeholder: 'Name or email' },
  argTypes: { size: { control: 'radio', options: sizes } },
  decorators: [(Story) => <Stack><Story /></Stack>],
  parameters: { docs: {
    description: { component: 'Enter a search query and clear it with a button or Escape.' },
    usage: `- The input is a native searchbox. The caller handles filtering, fetching and debounce.
- Tab and Shift+Tab move between the input, clear button and page.
- Enter or Space on clear empties the query and returns focus to the input.
- Escape clears a nonempty editable query. When empty, Escape remains available to parent dismissals.
- Enter in the input submits the form natively.`,
    source: { code: usage },
  } },
} satisfies Meta<typeof SearchField>;
export default meta;
type Story = StoryObj<Meta<SearchFieldProps & { onFormSubmit?: (event: FormEvent<HTMLFormElement>) => void }>>;

function ControlledField(props: SearchFieldProps) {
  const [value, setValue] = useState(props.defaultValue ?? '');
  return <SearchField {...props} value={value} onValueChange={(next) => { props.onValueChange?.(next); setValue(next); }} />;
}
ControlledField.displayName = 'ControlledSearchField';

function ExternalUpdateField(props: SearchFieldProps) {
  const [value, setValue] = useState('first');
  return <><SearchField {...props} value={value} /><FixtureButton type="button" onClick={() => setValue('second')}>Update query</FixtureButton></>;
}
ExternalUpdateField.displayName = 'ExternalUpdateSearchField';

function DefaultUpdateField(props: SearchFieldProps) {
  const [seed, setSeed] = useState('first');
  return <><SearchField {...props} defaultValue={seed} /><FixtureButton type="button" onClick={() => setSeed('second')}>Update default</FixtureButton></>;
}
DefaultUpdateField.displayName = 'DefaultUpdateSearchField';

function RefField(props: SearchFieldProps) {
  const ref = useRef<HTMLInputElement>(null);
  return <><SearchField {...props} ref={ref} /><FixtureButton type="button" onClick={() => ref.current?.focus()}>Focus query</FixtureButton></>;
}
RefField.displayName = 'RefSearchField';

async function expectFocus(element: HTMLElement, ring: HTMLElement = element) {
  await expect(element.ownerDocument.activeElement).toBe(element);
  await expect(getComputedStyle(ring).outlineStyle).not.toBe('none');
  // Fractional devicePixelRatios device-snap outline widths (authored 2px computes ~1.49px).
  await expect(parseFloat(getComputedStyle(ring).outlineWidth)).toBeGreaterThan(1);
}

// The shell is the visible control: it carries the ring, never the bare input inside it.
async function expectInputFocus(input: HTMLElement) {
  await expectFocus(input, input.parentElement!);
  await expect(getComputedStyle(input).outlineStyle).toBe('none');
}

export const Default: Story = {
  play: async ({ canvas }) => {
    const input = canvas.getByRole('searchbox', { name: 'Search members' });
    await expect(input).toHaveAttribute('type', 'search');
    await expect(input).not.toHaveAttribute('aria-expanded');
    await expect(canvas.queryByRole('button')).toBeNull();
  },
};
export const Populated: Story = { args: { defaultValue: 'Ada' } };
export const EmptyClearMessage: Story = {
  args: { defaultValue: 'Ada', messages: { clear: '' }, onValueChange: fn() },
  play: async ({ canvas, userEvent, args }) => {
    const clear = canvas.getByRole('button', { name: 'Clear search' });
    await expect(clear).toHaveAccessibleName('Clear search');
    await userEvent.click(clear);
    await expect(canvas.getByRole('searchbox')).toHaveValue('');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('');
  },
};
export const Description: Story = { args: { description: 'Search by name or email.' } };
export const Error: Story = {
  args: { defaultValue: 'Ada', description: 'Search by name or email.', error: 'Enter at least four characters.' },
  play: async ({ canvas }) => {
    const input = canvas.getByRole('searchbox');
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    await expect(input).toHaveAccessibleDescription('Search by name or email. Enter at least four characters.');
    await expect(input.getAttribute('aria-describedby')).toContain(canvas.getByRole('alert').id);
  },
};
export const Required: Story = {
  args: { required: true },
  play: async ({ canvas }) => { await expect(canvas.getByRole('searchbox')).toBeRequired(); },
};
export const Sizes: Story = {
  render: (args) => <>{sizes.map((size) => <SearchField {...args} key={size} size={size} label={`Search ${size}`} defaultValue="Ada" />)}</>,
  play: async ({ canvas }) => {
    for (const [index, size] of sizes.entries()) {
      await expect(canvas.getAllByRole('searchbox')[index]!.getBoundingClientRect().height).toBe(heights[size]);
      const target = canvas.getAllByRole('button')[index]!.getBoundingClientRect();
      await expect(target.width).toBeGreaterThanOrEqual(24);
      await expect(target.height).toBeGreaterThanOrEqual(24);
    }
  },
};
export const Disabled: Story = {
  args: { disabled: true, defaultValue: 'Ada', onValueChange: fn() },
  play: async ({ canvas, userEvent, args }) => {
    await expect(canvas.getByRole('searchbox')).toBeDisabled();
    const button = canvas.getByRole('button');
    await expect(button).toBeDisabled();
    await userEvent.click(button);
    await expect(args.onValueChange).toHaveBeenCalledTimes(0);
  },
};
export const ReadOnly: Story = {
  args: { readOnly: true, defaultValue: 'Ada', onValueChange: fn() },
  play: async ({ canvas, userEvent, args }) => {
    const input = canvas.getByRole('searchbox');
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    fireEvent(input, escape);
    await expect(escape.defaultPrevented).toBe(false);
    await userEvent.click(input);
    await userEvent.keyboard('{Escape}x');
    await expect(input).toHaveValue('Ada');
    await expect(canvas.queryByRole('button')).toBeNull();
    await expect(args.onValueChange).toHaveBeenCalledTimes(0);
  },
};
export const NotClearable: Story = {
  args: { clearable: false, defaultValue: 'Ada', onValueChange: fn() },
  play: async ({ canvas, userEvent, args }) => {
    const input = canvas.getByRole('searchbox');
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    fireEvent(input, escape);
    await expect(escape.defaultPrevented).toBe(false);
    await userEvent.click(input);
    await userEvent.keyboard('{Escape}');
    await expect(input).toHaveValue('Ada');
    await expect(canvas.queryByRole('button')).toBeNull();
    await expect(args.onValueChange).toHaveBeenCalledTimes(0);
  },
};
export const Controlled: Story = {
  args: { onChange: fn(), onValueChange: fn() }, render: (args) => <ControlledField {...args} />,
  play: async ({ canvas, userEvent, args }) => {
    const input = canvas.getByRole('searchbox');
    await userEvent.type(input, 'Ada');
    await expect(input).toHaveValue('Ada');
    await expect(args.onChange).toHaveBeenCalledTimes(3);
    await expect(args.onValueChange).toHaveBeenCalledTimes(3);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('Ada');
    const nativeSpy = args.onChange as ReturnType<typeof fn>;
    const valueSpy = args.onValueChange as ReturnType<typeof fn>;
    for (let i = 0; i < 3; i++) await expect(nativeSpy.mock.invocationCallOrder[i]).toBeLessThan(valueSpy.mock.invocationCallOrder[i]!);
  },
};
export const Uncontrolled: Story = {
  args: { defaultValue: 'Ada', onValueChange: fn() },
  play: async ({ canvas, userEvent, args }) => {
    const input = canvas.getByRole('searchbox');
    const width = input.getBoundingClientRect().width;
    await userEvent.click(canvas.getByRole('button', { name: 'Clear search' }));
    await expect(input).toHaveValue('');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('');
    await expect(input.ownerDocument.activeElement).toBe(input);
    await expect(input.getBoundingClientRect().width).toBe(width);
    await userEvent.type(input, 'x');
    await expect(input.getBoundingClientRect().width).toBe(width);
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
  },
};
export const RejectedClear: Story = {
  args: { value: 'Ada', onChange: fn(), onValueChange: fn() },
  play: async ({ canvas, userEvent, args }) => {
    const input = canvas.getByRole('searchbox');
    await userEvent.click(canvas.getByRole('button'));
    await expect(input.ownerDocument.activeElement).toBe(input);
    await expect(input).toHaveValue('Ada');
    await expect(canvas.getByRole('button')).toBeVisible();
    await expect(args.onChange).toHaveBeenCalledTimes(0);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await userEvent.keyboard('{Escape}');
    await expect(input).toHaveValue('Ada');
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await userEvent.keyboard('x');
    await expect(input).toHaveValue('Ada');
    await expect(args.onChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledTimes(3);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('Adax');
  },
};
export const ExternalUpdates: Story = {
  args: { onValueChange: fn() }, render: (args) => <ExternalUpdateField {...args} />,
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Update query' }));
    await expect(canvas.getByRole('searchbox')).toHaveValue('second');
    await expect(args.onValueChange).toHaveBeenCalledTimes(0);
  },
};
export const DefaultDoesNotReseed: Story = {
  args: { onValueChange: fn() }, render: (args) => <DefaultUpdateField {...args} />,
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Update default' }));
    await expect(canvas.getByRole('searchbox')).toHaveValue('first');
    await expect(args.onValueChange).toHaveBeenCalledTimes(0);
  },
};
export const Keyboard: Story = {
  args: { defaultValue: 'Ada', onValueChange: fn(), onChange: fn() },
  render: (args) => <><FixtureButton type="button">Before</FixtureButton><SearchField {...args} /><FixtureButton type="button">After</FixtureButton></>,
  play: async ({ canvas, userEvent, args }) => {
    const input = canvas.getByRole('searchbox');
    await userEvent.tab();
    await expect(canvas.getByRole('button', { name: 'Before' }).ownerDocument.activeElement).toBe(canvas.getByRole('button', { name: 'Before' }));
    await userEvent.tab();
    await expectInputFocus(input);
    await userEvent.tab();
    await expectFocus(canvas.getByRole('button', { name: 'Clear search' }));
    await userEvent.tab();
    await expect(input.ownerDocument.activeElement).toBe(canvas.getByRole('button', { name: 'After' }));
    await userEvent.tab({ shift: true });
    await expectFocus(canvas.getByRole('button', { name: 'Clear search' }));
    await userEvent.tab({ shift: true });
    await expectInputFocus(input);
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    await expectInputFocus(input);
    await expect(input).toHaveValue('');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onChange).toHaveBeenCalledTimes(0);
    await userEvent.keyboard('x');
    await userEvent.tab();
    await userEvent.keyboard(' ');
    await expectInputFocus(input);
    await expect(args.onValueChange).toHaveBeenCalledTimes(3);
    await userEvent.keyboard('y{Home}');
    await expect((input as HTMLInputElement).selectionStart).toBe(0);
    await userEvent.keyboard('{End}');
    await expect((input as HTMLInputElement).selectionStart).toBe(1);
    await userEvent.keyboard('{ArrowLeft}');
    await expect((input as HTMLInputElement).selectionStart).toBe(0);
    await userEvent.keyboard('{ArrowRight}');
    await expect((input as HTMLInputElement).selectionStart).toBe(1);
    await userEvent.keyboard('{Escape}');
    await expect(input).toHaveValue('');
    await expect(args.onValueChange).toHaveBeenCalledTimes(5);
    fireEvent(input, new Event('search', { bubbles: true }));
    await expect(args.onValueChange).toHaveBeenCalledTimes(5);
    const emptyEscape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    fireEvent(input, emptyEscape);
    await expect(emptyEscape.defaultPrevented).toBe(false);
    await expect(args.onValueChange).toHaveBeenCalledTimes(5);
    await userEvent.tab();
    await expect(input.ownerDocument.activeElement).toBe(canvas.getByRole('button', { name: 'After' }));
    await userEvent.tab({ shift: true });
    await expectInputFocus(input);
  },
};
export const CompositionAndVeto: Story = {
  args: { defaultValue: 'Ada', onValueChange: fn(), onKeyDown: (event) => { if (event.key === 'Escape' && event.shiftKey) event.preventDefault(); } },
  play: async ({ canvas, userEvent, args }) => {
    const input = canvas.getByRole('searchbox');
    const escape = new KeyboardEvent('keydown', { key: 'Escape', isComposing: true, bubbles: true, cancelable: true });
    fireEvent(input, escape);
    await expect(escape.defaultPrevented).toBe(false);
    await userEvent.click(input);
    await userEvent.keyboard('{Shift>}{Escape}{/Shift}');
    await expect(input).toHaveValue('Ada');
    await expect(args.onValueChange).toHaveBeenCalledTimes(0);
  },
};
export const ExternalAria: Story = {
  args: { label: undefined, 'aria-labelledby': 'search-name', 'aria-describedby': 'search-help', description: 'Name or email.', error: 'No matches.', required: true },
  render: (args) => <><span id="search-name">Find members</span><span id="search-help">Directory</span><SearchField {...args} /></>,
  play: async ({ canvas }) => {
    const input = canvas.getByRole('searchbox', { name: 'Find members' });
    await expect(input).toHaveAttribute('aria-labelledby', 'search-name');
    await expect(input).toHaveAccessibleDescription('Directory Name or email. No matches.');
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    await expect(input).toBeRequired();
  },
};
export const FalsyNodes: Story = {
  render: (args) => <><SearchField {...args} label={0} description={0} error={0} /><SearchField {...args} description={false} error={false} aria-invalid="grammar" /></>,
  play: async ({ canvas }) => {
    const inputs = canvas.getAllByRole('searchbox');
    await expect(inputs[0]).toHaveAccessibleName('0');
    await expect(inputs[0]).toHaveAttribute('aria-invalid', 'true');
    await expect(inputs[1]).toHaveAttribute('aria-invalid', 'grammar');
    await expect(inputs[1]).not.toHaveAttribute('aria-describedby');
    await expect(canvas.getAllByRole('alert')).toHaveLength(1);
    await expect(inputs[0]!.id).not.toBe(inputs[1]!.id);
  },
};
export const FormReset: Story = {
  args: { defaultValue: 'Ada', name: 'query', onValueChange: fn(), onChange: fn() },
  render: (args) => <form onSubmit={(event) => event.preventDefault()}><SearchField {...args} /><FixtureButton type="reset">Reset query</FixtureButton></form>,
  play: async ({ canvas, userEvent, args }) => {
    const input = canvas.getByRole('searchbox') as HTMLInputElement;
    await expect(new FormData(input.form!).getAll('query')).toEqual(['Ada']);
    await userEvent.type(input, 'x');
    await expect(input).toHaveValue('Adax');
    await userEvent.click(canvas.getByRole('button', { name: 'Reset query' }));
    await expect(input).toHaveValue('Ada');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onChange).toHaveBeenCalledTimes(1);
  },
};
export const ControlledReset: Story = {
  ...FormReset, args: { value: 'Ada', name: 'query', onValueChange: fn() },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Reset query' }));
    await expect(canvas.getByRole('searchbox')).toHaveValue('Ada');
    await expect(args.onValueChange).toHaveBeenCalledTimes(0);
  },
};
export const FormSubmission: Story = {
  args: { defaultValue: 'Ada', onValueChange: fn(), onFormSubmit: fn() },
  render: ({ onFormSubmit, ...args }) => <form onSubmit={(event) => { event.preventDefault(); onFormSubmit?.(event); }}><SearchField {...args} /><FixtureButton type="submit">Search</FixtureButton></form>,
  play: async ({ canvas, userEvent, args }) => {
    const input = canvas.getByRole('searchbox');
    await userEvent.click(input);
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    await expect(args.onFormSubmit).toHaveBeenCalledTimes(0);
    await userEvent.type(input, 'x');
    await userEvent.tab();
    await userEvent.keyboard(' ');
    await expect(args.onFormSubmit).toHaveBeenCalledTimes(0);
    await expect(args.onValueChange).toHaveBeenCalledTimes(3);
    await userEvent.keyboard('y');
    await userEvent.keyboard('{Enter}');
    await expect(args.onFormSubmit).toHaveBeenCalledTimes(1);
  },
};
export const CancelledReset: Story = {
  args: { defaultValue: 'Ada', onValueChange: fn() },
  render: (args) => <form onReset={(event) => event.preventDefault()}><SearchField {...args} /><FixtureButton type="reset">Reset query</FixtureButton></form>,
  play: async ({ canvas, userEvent, args }) => {
    const input = canvas.getByRole('searchbox');
    await userEvent.type(input, 'x');
    await userEvent.click(canvas.getByRole('button', { name: 'Reset query' }));
    await expect(input).toHaveValue('Adax');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
  },
};
export const RefAndStyles: Story = {
  args: { dir: 'rtl', className: 'consumer-root', slotProps: { root: { css: { paddingInline: vars.space[1] } } }, sx: { paddingInline: vars.space[3] } },
  render: (args) => <RefField {...args} />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    const input = canvas.getByRole('searchbox');
    await userEvent.click(canvas.getByRole('button', { name: 'Focus query' }));
    await expect(input.ownerDocument.activeElement).toBe(input);
    const root = canvasElement.querySelector('[data-ui="search-field"]')!;
    await expect(root).toHaveAttribute('dir', 'rtl');
    await expect(root).toHaveClass('consumer-root');
    await expect(getComputedStyle(root).paddingInlineStart).toBe('12px');
  },
};
export const LightTheme: Story = { decorators: [withLightTheme], globals: { theme: 'light' }, args: { defaultValue: 'Ada', description: 'Search by name or email.' } };
export const NarrowToolbar: Story = { args: { defaultValue: 'Ada', sx: { inlineSize: '160px' } } };
export const LongCopy: Story = { args: { label: 'Buscar miembros por nombre o dirección de correo electrónico', defaultValue: 'Ada', messages: { clear: 'Borrar el texto de búsqueda de miembros' } } };
export const RTL: Story = {
  args: { dir: 'rtl', label: 'Buscar miembros', defaultValue: 'Ada' },
  play: async ({ canvas }) => { await expect(getComputedStyle(canvas.getByRole('searchbox')).direction).toBe('rtl'); },
};
export const ForcedColors: Story = { args: { defaultValue: 'Ada' }, parameters: { docs: { description: { story: 'Enable forced colors in the browser (see docs/qa-gates.md). This check is manual.' } } } };
export const ReducedMotion: Story = { args: { defaultValue: 'Ada' }, parameters: { docs: { description: { story: 'Enable prefers-reduced-motion: reduce in the browser (see docs/qa-gates.md). This check is manual.' } } } };
export const CustomIcons: Story = {
  args: { defaultValue: 'Ada', searchIcon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="10" cy="10" r="6" /><path d="m15 15 6 6" /></svg>, clearIcon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M6 12h12" /></svg> },
};

const StyledSearchField = styled(SearchField)({ borderRadius: '9px' });
/** Replace the wrapper and generated label; pass native props through slotProps. */
export const SlotCustomization: Story = {
  args: {
    ref: fn(),
    onClick: fn(),
    className: 'consumer-root',
    title: 'consumer title',
    style: fieldRootStyles.consumer,
    sx: { borderRadius: '11px' },
    component: FieldSugarRoot,
    slots: { root: FieldReplacementRoot, label: FieldReplacementLabel },
    slotProps: {
      root: {
        onClick: fn(),
        ref: fn(),
        className: 'slot-root',
        title: 'slot title',
        style: fieldRootStyles.slot,
        css: { borderRadius: '8px' },
      },
      label: { ref: fn(), title: 'generated part' },
    },
  },
  render: (args) => <StyledSearchField {...args} />,
  parameters: {
    docs: {
      source: {
        code: "function MyRoot(props) { return <div {...props} />; }\nfunction MyLabel(props) { return <label {...props} />; }\n\n<SearchField label=\"Name\"\n  component={MyRoot}\n  slots={{ label: MyLabel }}\n  slotProps={{ root: { css: { borderRadius: '8px' } }, label: { title: 'Name' } }}\n  sx={{ borderRadius: '11px' }}\n/>",
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
        part: args.slotProps?.label?.ref,
        consumer: args.ref,
      },
      'input',
    );
  },
};

/** Use component as shorthand for the wrapper's root slot. */
export const ComponentRoot: Story = {
  args: { component: FieldSugarRoot },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[data-slot-root="component"]')).not.toBeNull();
  },
};

export type SearchFieldSlotTypeRegression = {
  // @ts-expect-error Unknown structural keys are rejected.
  unknownSlot: NonNullable<import('./index').SearchFieldProps['slots']>['notASlot'];
  // @ts-expect-error Unknown prop keys are rejected.
  unknownSlotProps: NonNullable<import('./index').SearchFieldProps['slotProps']>['notASlot'];
};
