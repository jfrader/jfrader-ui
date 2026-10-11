import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fireEvent, fn, waitFor } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { withLightTheme } from '../../testing/story-decorators';
import { TagInput, type TagInputProps } from './index';

// Raw fixture buttons must pass the global target-size (WCAG 2.5.8) axe gate in every environment.
const FIXTURE_BUTTON = { minHeight: '24px', minWidth: '24px', padding: '4px 10px', boxSizing: 'border-box' } as const;

const sizes = ['sm', 'md', 'lg'] as const;
const heights = { sm: 32, md: 40, lg: 48 };
const stackStyle = css({ display: 'grid', gap: vars.space[4], inlineSize: 'min(100%, 360px)' });
const usage = `<TagInput
  label="Topics"
  defaultValue={['design', 'motion']}
  description="Press Enter or comma to add."
  onValueChange={saveTopics}
/>`;

const meta = {
  title: 'Inputs/TagInput',
  component: TagInput,
  tags: ['autodocs'],
  args: { label: 'Topics', description: 'Press Enter or comma to add.', placeholder: 'Add a topic' },
  argTypes: { size: { control: 'radio', options: sizes } },
  decorators: [(Story) => <div css={stackStyle}><Story /></div>],
  parameters: {
    docs: {
      description: {
        component: [
          'Native text input that commits short strings into an ordered, named list of removable tokens. Use it for free-form keywords or application-validated recipients; use a select-style control for a fixed set of choices.',
          '',
          '**Two state axes.** `value`/`defaultValue`/`onValueChange` own the committed tokens; `inputValue`/`defaultInputValue`/`onInputChange` own the draft. A commit requests the new list first and an empty draft second; a parent may accept or reject each independently.',
          '',
          '**Commit rules.** The draft goes through `normalize` (trim by default). Empty results are ignored. A duplicate is compared with `Intl.Collator` (`sensitivity: "accent"`: case-insensitive, accents distinct) under `locale`. `maxTokens` and `validateToken` reject additions; every rejection keeps the draft and is announced. Without `","` in `separators`, commas are ordinary token text.',
          '',
          '**Blur.** With `commitOnBlur` the draft commits only when focus leaves the whole field; moving to a remove button does not commit.',
          '',
          '**Keyboard.** Enter or comma: commit the draft (an empty Enter keeps native form submission). Backspace at caret 0: pick the last token; Backspace or Delete again: remove it. ArrowLeft at caret 0 or while picked: pick the previous token (stops at the first). ArrowRight while picked: pick the next token, or return to the input past the last. Escape: drop the pick. Typing or pasting edits the draft and drops the pick. Tab and Shift+Tab follow DOM order: each remove button, then the input, then the page. IME composition bypasses every shortcut; held keys never remove tokens.',
          '',
          '**Forms.** With `name`, each committed token submits as a repeated field in list order; the draft never submits. `required` means at least one committed token.',
        ].join('\n'),
      },
      source: { code: usage },
    },
  },
} satisfies Meta<typeof TagInput>;
export default meta;
type Story = StoryObj<typeof meta>;

type Spy = ReturnType<typeof fn>;

function ControlledField(props: TagInputProps) {
  const [value, setValue] = useState<readonly string[]>(props.defaultValue ?? []);
  return (
    <TagInput
      {...props}
      defaultValue={undefined}
      value={value}
      onValueChange={(next) => {
        props.onValueChange?.(next);
        setValue(next);
      }}
    />
  );
}
ControlledField.displayName = 'ControlledTagInput';

function DraftControlledField(props: TagInputProps) {
  const [draft, setDraft] = useState('');
  return (
    <>
      <TagInput
        {...props}
        inputValue={draft}
        onInputChange={(next) => {
          props.onInputChange?.(next);
          setDraft(next);
        }}
      />
      <output data-testid="draft">{draft}</output>
    </>
  );
}
DraftControlledField.displayName = 'DraftControlledTagInput';

function ExternalUpdateField(props: TagInputProps) {
  const [value, setValue] = useState<readonly string[]>(['design']);
  return (
    <>
      <TagInput {...props} value={value} />
      <button style={FIXTURE_BUTTON} type="button" onClick={() => setValue(['motion', 'type'])}>
        Replace topics
      </button>
    </>
  );
}
ExternalUpdateField.displayName = 'ExternalUpdateTagInput';

const inputOf = (canvas: { getByRole: (role: 'textbox', options?: object) => HTMLElement }) =>
  canvas.getByRole('textbox') as HTMLInputElement;
const shellOf = (input: HTMLElement) => input.parentElement!;
const tokenTexts = (root: HTMLElement) => Array.from(root.querySelectorAll('li'), (li) => li.textContent);

async function expectRing(element: HTMLElement) {
  const style = getComputedStyle(element);
  await expect(style.outlineStyle).not.toBe('none');
  // Fractional devicePixelRatios device-snap outline widths (authored 2px computes ~1.49px).
  await expect(parseFloat(style.outlineWidth)).toBeGreaterThan(1);
}

/** The draft input has DOM focus; its shell draws the ring. */
async function expectInputFocus(input: HTMLElement) {
  await expect(input.ownerDocument.activeElement).toBe(input);
  await expectRing(shellOf(input));
}

async function expectFocus(element: HTMLElement) {
  await expect(element.ownerDocument.activeElement).toBe(element);
  await expectRing(element);
}

export const Default: Story = {
  args: { onValueChange: fn(), onInputChange: fn() },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const input = canvas.getByRole('textbox', { name: 'Topics' });
    await expect(input).toHaveAttribute('type', 'text');
    await expect(input).not.toHaveAttribute('role');
    await expect(canvas.queryByRole('list')).toBeNull();
    await userEvent.type(input, 'design{Enter}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith(['design']);
    await expect(args.onInputChange).toHaveBeenCalledTimes(7);
    await expect(args.onInputChange).toHaveBeenLastCalledWith('');
    await expect(input).toHaveValue('');
    const list = canvas.getByRole('list', { name: 'Tags' });
    await expect(tokenTexts(list)).toEqual(['design']);
    // New tokens fade in; wait out the entrance before checking visibility.
    await waitFor(() => expect(canvas.getByRole('button', { name: 'Remove design' })).toBeVisible());
    await waitFor(() => expect(canvas.getByRole('status')).toHaveTextContent('Added design'));
    await expect(canvasElement.querySelector('[data-ui="tag-input"]')).not.toBeNull();
    await expect(TagInput.displayName).toBe('TagInput');
  },
};

export const Empty: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole('list')).toBeNull();
    await expect(canvas.getByRole('textbox')).toHaveAttribute('placeholder', 'Add a topic');
  },
};

export const Prefilled: Story = { args: { defaultValue: ['design', 'motion', 'accessibility'] } };

export const Controlled: Story = {
  args: { defaultValue: ['design'], onValueChange: fn(), onChange: fn() },
  render: (args) => <ControlledField {...args} />,
  play: async ({ canvas, userEvent, args }) => {
    const input = inputOf(canvas);
    const before = (args.defaultValue ?? []) as string[];
    await userEvent.type(input, 'motion,');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    const next = (args.onValueChange as Spy).mock.calls[0]![0] as string[];
    await expect(next).toEqual(['design', 'motion']);
    await expect(next).not.toBe(before);
    await expect(before).toEqual(['design']);
    await expect(input).toHaveValue('');
    await expect(args.onChange).toHaveBeenCalledTimes(6);
    await userEvent.click(canvas.getByRole('button', { name: 'Remove design' }));
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await expect(args.onValueChange).toHaveBeenLastCalledWith(['motion']);
    await expect(tokenTexts(canvas.getByRole('list'))).toEqual(['motion']);
    await expect(input.ownerDocument.activeElement).toBe(input);
    await waitFor(() => expect(canvas.getByRole('status')).toHaveTextContent('Removed design'));
  },
};

export const DraftControlled: Story = {
  args: { onInputChange: fn(), onValueChange: fn() },
  render: (args) => <DraftControlledField {...args} />,
  play: async ({ canvas, userEvent, args }) => {
    const input = inputOf(canvas);
    await userEvent.type(input, 'ux');
    await expect(canvas.getByTestId('draft')).toHaveTextContent('ux');
    await expect(args.onInputChange).toHaveBeenCalledTimes(2);
    await userEvent.keyboard('{Enter}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onInputChange).toHaveBeenCalledTimes(3);
    await expect(args.onInputChange).toHaveBeenLastCalledWith('');
    await expect(input).toHaveValue('');
    await expect(canvas.getByTestId('draft')).toHaveTextContent('');
  },
};

export const ControlledReject: Story = {
  args: { value: ['design'], onValueChange: fn(), onInputChange: fn() },
  play: async ({ canvas, userEvent, args }) => {
    const input = inputOf(canvas);
    await userEvent.type(input, 'x{Enter}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith(['design', 'x']);
    // The draft axis is independent: its clear is accepted while the list stays as given.
    await expect(input).toHaveValue('');
    await expect(tokenTexts(canvas.getByRole('list'))).toEqual(['design']);
    await userEvent.keyboard('{Backspace}');
    await userEvent.keyboard('{Backspace}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await expect(args.onValueChange).toHaveBeenLastCalledWith([]);
    await expect(tokenTexts(canvas.getByRole('list'))).toEqual(['design']);
    await expect(canvas.getByRole('listitem')).not.toHaveAttribute('data-picked');
    await new Promise((resolve) => setTimeout(resolve, 50));
    await expect(canvas.getByRole('status')).not.toHaveTextContent('Added x');
    await expect(canvas.getByRole('status')).not.toHaveTextContent('Removed design');
  },
};

export const ControlledDraftReject: Story = {
  args: { inputValue: 'draft', onInputChange: fn(), onValueChange: fn() },
  play: async ({ canvas, userEvent, args }) => {
    const input = inputOf(canvas);
    await userEvent.type(input, 'x');
    await expect(input).toHaveValue('draft');
    await expect(args.onInputChange).toHaveBeenCalledTimes(1);
    await expect(args.onInputChange).toHaveBeenLastCalledWith('draftx');
    await userEvent.keyboard('{Enter}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith(['draft']);
    await expect(args.onInputChange).toHaveBeenCalledTimes(2);
    await expect(args.onInputChange).toHaveBeenLastCalledWith('');
    await expect(input).toHaveValue('draft');
    await userEvent.keyboard('{Enter}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onInputChange).toHaveBeenCalledTimes(2);
    await expect(canvas.getByRole('status')).toHaveTextContent('draft is already added');
  },
};

export const ExternalUpdates: Story = {
  args: { onValueChange: fn() },
  render: (args) => <ExternalUpdateField {...args} />,
  play: async ({ canvas, userEvent, args }) => {
    const input = inputOf(canvas);
    await userEvent.click(input);
    await userEvent.keyboard('{Backspace}');
    await expect(canvas.getByRole('listitem')).toHaveAttribute('data-picked');
    await userEvent.click(canvas.getByRole('button', { name: 'Replace topics' }));
    await expect(tokenTexts(canvas.getByRole('list'))).toEqual(['motion', 'type']);
    await expect(input).not.toHaveAttribute('aria-describedby', expect.stringContaining('picked'));
    for (const item of canvas.getAllByRole('listitem')) await expect(item).not.toHaveAttribute('data-picked');
    await expect(args.onValueChange).toHaveBeenCalledTimes(0);
  },
};

export const Sizes: Story = {
  render: (args) => (
    <>
      {sizes.map((size) => (
        <TagInput {...args} key={size} size={size} label={`Topics ${size}`} defaultValue={['design']} />
      ))}
    </>
  ),
  play: async ({ canvas }) => {
    const inputs = canvas.getAllByRole('textbox');
    for (const [index, size] of sizes.entries()) {
      const shell = shellOf(inputs[index]!).getBoundingClientRect();
      await expect(Math.abs(shell.height - heights[size])).toBeLessThan(1);
      const target = canvas.getAllByRole('button')[index]!.getBoundingClientRect();
      await expect(target.width).toBeGreaterThanOrEqual(24);
      await expect(target.height).toBeGreaterThanOrEqual(24);
    }
  },
};

export const Wrapping: Story = {
  args: {
    defaultValue: ['design', 'motion', 'accessibility', 'typography', 'color', 'layout', 'research'],
    sx: { inlineSize: '220px' },
  },
  play: async ({ canvas }) => {
    const shell = shellOf(inputOf(canvas));
    await expect(shell.scrollWidth).toBeLessThanOrEqual(shell.clientWidth);
    await expect(shell.getBoundingClientRect().height).toBeGreaterThan(heights.md);
    const right = shell.getBoundingClientRect().right;
    for (const item of canvas.getAllByRole('listitem')) {
      await expect(item.getBoundingClientRect().right).toBeLessThanOrEqual(right);
    }
  },
};

const LONG_TOKEN = 'interaction-design-for-multilingual-onboarding-flows-across-regions';
export const LongToken: Story = {
  args: { defaultValue: [LONG_TOKEN, 'ux'], sx: { inlineSize: '240px' } },
  play: async ({ canvas }) => {
    const shell = shellOf(inputOf(canvas));
    const [long] = canvas.getAllByRole('listitem');
    await expect(long!.getBoundingClientRect().width).toBeLessThanOrEqual(shell.clientWidth);
    await expect(long).toHaveTextContent(LONG_TOKEN);
    const remove = canvas.getByRole('button', { name: `Remove ${LONG_TOKEN}` });
    await expect(remove.getBoundingClientRect().width).toBeGreaterThanOrEqual(24);
    await expect(remove.getBoundingClientRect().right).toBeLessThanOrEqual(shell.getBoundingClientRect().right);
  },
};

export const CommaDisabled: Story = {
  args: { separators: ['Enter'], onValueChange: fn(), label: 'Recipients', description: 'Press Enter to add.' },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.type(inputOf(canvas), 'Lovelace, Ada{Enter}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith(['Lovelace, Ada']);
    await waitFor(() => expect(canvas.getByRole('button', { name: 'Remove Lovelace, Ada' })).toBeVisible());
  },
};

export const Duplicate: Story = {
  args: { defaultValue: ['Design'], onValueChange: fn(), onInputChange: fn() },
  play: async ({ canvas, userEvent, args }) => {
    const input = inputOf(canvas);
    // Accents stay distinct; case does not.
    await userEvent.type(input, 'désign{Enter}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith(['Design', 'désign']);
    await userEvent.type(input, 'DESIGN{Enter}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(input).toHaveValue('DESIGN');
    await expect(args.onInputChange).toHaveBeenCalledTimes(13);
    const status = canvas.getByRole('status');
    await expect(status).toHaveTextContent('Design is already added');
    await expect(status).toBeVisible();
    await expect(canvas.getAllByRole('listitem')[0]).toHaveAttribute('data-duplicate');
    await userEvent.keyboard(',');
    await expect(input).toHaveValue('DESIGN');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
  },
};

export const Locale: Story = {
  args: { locale: 'tr', defaultValue: ['istanbul'], onValueChange: fn() },
  play: async ({ canvas, userEvent, args }) => {
    // Turkish dotted capital İ folds to i; the dotless I does not.
    await userEvent.type(inputOf(canvas), 'İSTANBUL{Enter}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(0);
    await userEvent.clear(inputOf(canvas));
    await userEvent.type(inputOf(canvas), 'ISTANBUL{Enter}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
  },
};

export const InvalidToken: Story = {
  args: {
    label: 'Recipients',
    description: 'Press Enter to add an email address.',
    validateToken: (token) => (token.includes('@') ? null : 'Enter an email address.'),
    onValueChange: fn(),
    onInputChange: fn(),
  },
  play: async ({ canvas, userEvent, args }) => {
    const input = inputOf(canvas);
    await userEvent.type(input, '   {Enter}');
    await expect(input).toHaveValue('   ');
    await expect(args.onValueChange).toHaveBeenCalledTimes(0);
    await userEvent.clear(input);
    await userEvent.type(input, 'ada{Enter}');
    await expect(input).toHaveValue('ada');
    await expect(args.onValueChange).toHaveBeenCalledTimes(0);
    await expect(input).not.toHaveAttribute('aria-invalid');
    await expect(canvas.getByRole('status')).toHaveTextContent('Enter an email address.');
    await userEvent.type(input, '@example.com{Enter}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith(['ada@example.com']);
    await userEvent.type(input, 'grace{Enter}');
    await expect(canvas.getByRole('status')).toHaveTextContent('Enter an email address.');
  },
};

export const MaxTokens: Story = {
  args: { maxTokens: 2, defaultValue: ['design', 'motion', 'type'], onValueChange: fn() },
  play: async ({ canvas, userEvent, args }) => {
    await expect(canvas.getAllByRole('listitem')).toHaveLength(3);
    const input = inputOf(canvas);
    await userEvent.type(input, 'color{Enter}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(0);
    await expect(input).toHaveValue('color');
    await expect(canvas.getByRole('status')).toHaveTextContent('Tag limit reached: 2');
  },
};

export const Error: Story = {
  args: { defaultValue: ['design'], error: 'Add a topic from the style guide.' },
  play: async ({ canvas }) => {
    const input = inputOf(canvas);
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    await expect(input).toHaveAccessibleDescription('Press Enter or comma to add. Add a topic from the style guide.');
    await expect(input.getAttribute('aria-describedby')).toContain(canvas.getByRole('alert').id);
    await expect(shellOf(input)).toHaveAttribute('data-invalid');
  },
};

export const Disabled: Story = {
  args: { disabled: true, name: 'topics', defaultValue: ['design'], onValueChange: fn() },
  render: (args) => <form><TagInput {...args} /></form>,
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    await expect(inputOf(canvas)).toBeDisabled();
    const remove = canvas.getByRole('button', { name: 'Remove design' });
    await expect(remove).toBeDisabled();
    await userEvent.click(remove);
    await expect(args.onValueChange).toHaveBeenCalledTimes(0);
    await expect(new FormData(canvasElement.querySelector('form')!).getAll('topics')).toEqual([]);
    await userEvent.tab();
    await expect(canvasElement.ownerDocument.activeElement).toBe(canvasElement.ownerDocument.body);
  },
};

export const ReadOnly: Story = {
  args: { readOnly: true, defaultValue: ['design', 'motion'], onValueChange: fn(), onInputChange: fn() },
  play: async ({ canvas, userEvent, args }) => {
    const input = inputOf(canvas);
    await expect(canvas.queryByRole('button')).toBeNull();
    await userEvent.click(input);
    await expect(input.ownerDocument.activeElement).toBe(input);
    await userEvent.keyboard('x{Backspace}{ArrowLeft}{Delete}{Enter}');
    for (const item of canvas.getAllByRole('listitem')) await expect(item).not.toHaveAttribute('data-picked');
    await expect(tokenTexts(canvas.getByRole('list'))).toEqual(['design', 'motion']);
    await expect(args.onValueChange).toHaveBeenCalledTimes(0);
    await expect(args.onInputChange).toHaveBeenCalledTimes(0);
  },
};

export const Required: Story = {
  args: { required: true, onValueChange: fn() },
  play: async ({ canvas, userEvent }) => {
    const input = inputOf(canvas);
    await expect(input).toHaveAttribute('aria-required', 'true');
    await expect(input).not.toHaveAttribute('required');
    await expect(input.validity.valid).toBe(false);
    await expect(input.validationMessage).toBe('Add at least one tag.');
    // A draft alone does not satisfy the requirement.
    await userEvent.type(input, 'design');
    await expect(input.validity.valid).toBe(false);
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(input.validity.valid).toBe(true));
  },
};

export const BlurCommitOff: Story = {
  args: { commitOnBlur: false, onValueChange: fn() },
  render: (args) => <><TagInput {...args} /><button style={FIXTURE_BUTTON} type="button">After</button></>,
  play: async ({ canvas, userEvent, args }) => {
    const input = inputOf(canvas);
    await userEvent.type(input, 'design');
    await userEvent.tab();
    await expect(input.ownerDocument.activeElement).toBe(canvas.getByRole('button', { name: 'After' }));
    await expect(args.onValueChange).toHaveBeenCalledTimes(0);
    await expect(input).toHaveValue('design');
  },
};

export const BlurCommit: Story = {
  args: { onValueChange: fn() },
  render: (args) => <><TagInput {...args} /><button style={FIXTURE_BUTTON} type="button">After</button></>,
  play: async ({ canvas, userEvent, args }) => {
    const input = inputOf(canvas);
    await userEvent.type(input, 'design');
    await userEvent.tab();
    const after = canvas.getByRole('button', { name: 'After' });
    await expect(input.ownerDocument.activeElement).toBe(after);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith(['design']);
    await expect(input).toHaveValue('');
  },
};

export const FocusWithinBlurRegression: Story = {
  args: { defaultValue: ['design', 'motion'], onValueChange: fn() },
  render: (args) => <><TagInput {...args} /><button style={FIXTURE_BUTTON} type="button">After</button></>,
  play: async ({ canvas, userEvent, args }) => {
    const input = inputOf(canvas);
    await userEvent.type(input, 'type');
    await userEvent.tab({ shift: true });
    await expectFocus(canvas.getByRole('button', { name: 'Remove motion' }));
    await expect(args.onValueChange).toHaveBeenCalledTimes(0);
    await userEvent.tab();
    await expectInputFocus(input);
    await expect(args.onValueChange).toHaveBeenCalledTimes(0);
    // Pointer removal keeps the draft, refocuses the input and never commits it.
    await userEvent.click(canvas.getByRole('button', { name: 'Remove design' }));
    await expect(input.ownerDocument.activeElement).toBe(input);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith(['motion']);
    await expect(input).toHaveValue('type');
    await userEvent.tab();
    await expect(input.ownerDocument.activeElement).toBe(canvas.getByRole('button', { name: 'After' }));
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await expect(args.onValueChange).toHaveBeenLastCalledWith(['motion', 'type']);
    // Shift+Tab back into the field takes focus without committing or stealing it.
    await userEvent.tab({ shift: true });
    await expectInputFocus(input);
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
  },
};

export const Keyboard: Story = {
  args: { defaultValue: ['design', 'motion'], onValueChange: fn(), onKeyDown: fn() },
  render: (args) => (
    <>
      <button style={FIXTURE_BUTTON} type="button">Before</button>
      <TagInput {...args} />
      <button style={FIXTURE_BUTTON} type="button">After</button>
    </>
  ),
  play: async ({ canvas, userEvent, args }) => {
    const input = inputOf(canvas);
    const before = canvas.getByRole('button', { name: 'Before' });
    const after = canvas.getByRole('button', { name: 'After' });
    const status = canvas.getByRole('status');
    const picked = () => canvas.getAllByRole('listitem').filter((item) => item.hasAttribute('data-picked'));
    const valueCalls = args.onValueChange as Spy;

    await userEvent.tab();
    await expect(input.ownerDocument.activeElement).toBe(before);
    // DOM order: remove buttons in list order, then the draft input.
    await userEvent.tab();
    await expectFocus(canvas.getByRole('button', { name: 'Remove design' }));
    await userEvent.tab();
    await expectFocus(canvas.getByRole('button', { name: 'Remove motion' }));
    await userEvent.tab();
    await expectInputFocus(input);
    await userEvent.tab();
    await expect(input.ownerDocument.activeElement).toBe(after);
    await userEvent.tab({ shift: true });
    await expectInputFocus(input);
    await userEvent.tab({ shift: true });
    await expectFocus(canvas.getByRole('button', { name: 'Remove motion' }));
    await userEvent.tab();
    await expectInputFocus(input);

    // Enter and comma commit.
    await userEvent.keyboard('a11y{Enter}');
    await expect(valueCalls).toHaveBeenCalledTimes(1);
    await expect(valueCalls).toHaveBeenLastCalledWith(['design', 'motion', 'a11y']);
    await userEvent.keyboard('type,');
    await expect(valueCalls).toHaveBeenCalledTimes(2);
    await expect(valueCalls).toHaveBeenLastCalledWith(['design', 'motion', 'a11y', 'type']);
    await expect(input).toHaveValue('');

    // Backspace at caret 0 picks the last token and keeps the draft.
    await userEvent.keyboard('x{Home}{Backspace}');
    await expect(input).toHaveValue('x');
    await expect(picked().map((item) => item.textContent)).toEqual(['type']);
    await expect(input).toHaveAccessibleDescription(expect.stringContaining('type'));
    await expect(status).toHaveTextContent('type selected. Press Backspace to remove it.');
    await expectInputFocus(input);
    await expectRing(picked()[0]!);

    // ArrowLeft moves to earlier tokens and stops at the first.
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}{ArrowLeft}');
    await expect(picked().map((item) => item.textContent)).toEqual(['design']);
    await userEvent.keyboard('{ArrowLeft}');
    await expect(picked().map((item) => item.textContent)).toEqual(['design']);

    // ArrowRight walks back and returns to the input past the last token.
    await userEvent.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}');
    await expect(picked().map((item) => item.textContent)).toEqual(['type']);
    await userEvent.keyboard('{ArrowRight}');
    await expect(picked()).toHaveLength(0);
    await expect(input.selectionStart).toBe(0);
    await expect(input).toHaveValue('x');

    // Escape drops the pick without changes.
    await userEvent.keyboard('{ArrowLeft}');
    await expect(picked()).toHaveLength(1);
    await userEvent.keyboard('{Escape}');
    await expect(picked()).toHaveLength(0);
    await expect(input.selectionStart).toBe(0);

    // Backspace then Delete removes the picked token once; the draft stays.
    await userEvent.keyboard('{Backspace}{Delete}');
    await expect(valueCalls).toHaveBeenCalledTimes(3);
    await expect(valueCalls).toHaveBeenLastCalledWith(['design', 'motion', 'a11y']);
    await expect(input).toHaveValue('x');
    await expect(picked()).toHaveLength(0);
    await waitFor(() => expect(status).toHaveTextContent('Removed type'));

    // Delete without a pick is native editing, never a removal.
    await userEvent.keyboard('{Delete}');
    await expect(input).toHaveValue('');
    await expect(valueCalls).toHaveBeenCalledTimes(3);

    // Typing while picked edits the draft and drops the pick.
    await userEvent.keyboard('{Backspace}y');
    await expect(picked()).toHaveLength(0);
    await expect(input).toHaveValue('y');
    await expect(valueCalls).toHaveBeenCalledTimes(3);

    // Remove buttons activate once with Enter and Space and return focus to the input.
    await userEvent.tab({ shift: true });
    await expectFocus(canvas.getByRole('button', { name: 'Remove a11y' }));
    await userEvent.keyboard('{Enter}');
    await expectInputFocus(input);
    await expect(valueCalls).toHaveBeenCalledTimes(4);
    await expect(valueCalls).toHaveBeenLastCalledWith(['design', 'motion']);
    await userEvent.tab({ shift: true });
    await expectFocus(canvas.getByRole('button', { name: 'Remove motion' }));
    await userEvent.keyboard(' ');
    await expectInputFocus(input);
    await expect(valueCalls).toHaveBeenCalledTimes(5);
    await expect(valueCalls).toHaveBeenLastCalledWith(['design']);
    await expect(input).toHaveValue('y');
  },
};

export const RepeatAndComposition: Story = {
  args: { defaultValue: ['design', 'motion'], onValueChange: fn() },
  play: async ({ canvas, userEvent, args }) => {
    const input = inputOf(canvas);
    await userEvent.click(input);
    const held = new KeyboardEvent('keydown', { key: 'Backspace', repeat: true, bubbles: true, cancelable: true });
    fireEvent(input, held);
    await expect(canvas.getAllByRole('listitem').filter((item) => item.hasAttribute('data-picked'))).toHaveLength(0);
    await userEvent.keyboard('{Backspace}');
    fireEvent(input, new KeyboardEvent('keydown', { key: 'Backspace', repeat: true, bubbles: true, cancelable: true }));
    await expect(args.onValueChange).toHaveBeenCalledTimes(0);
    await userEvent.keyboard('{Escape}');

    await userEvent.type(input, 'デザイン');
    const composing = new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true, cancelable: true });
    fireEvent(input, composing);
    await expect(composing.defaultPrevented).toBe(false);
    await expect(args.onValueChange).toHaveBeenCalledTimes(0);
    await userEvent.keyboard('{Enter}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith(['design', 'motion', 'デザイン']);

    // An empty Enter is left to the page (native form submission).
    const emptyEnter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    fireEvent(input, emptyEnter);
    await expect(emptyEnter.defaultPrevented).toBe(false);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
  },
};

export const FormSubmission: Story = {
  args: { name: 'topics', defaultValue: ['design'], onValueChange: fn() },
  render: (args) => (
    <form onSubmit={(event) => event.preventDefault()}>
      <TagInput {...args} />
      <button style={FIXTURE_BUTTON} type="submit">Save</button>
    </form>
  ),
  play: async ({ canvas, canvasElement, userEvent }) => {
    const form = canvasElement.querySelector('form')!;
    const submit = fn((event: SubmitEvent) => event.preventDefault());
    form.addEventListener('submit', submit);
    const input = inputOf(canvas);
    await userEvent.type(input, 'motion{Enter}');
    await expect(submit).toHaveBeenCalledTimes(0);
    await userEvent.type(input, 'draft');
    await expect(new FormData(form).getAll('topics')).toEqual(['design', 'motion']);
    await userEvent.clear(input);
    await userEvent.keyboard('{Enter}');
    await expect(submit).toHaveBeenCalledTimes(1);
    form.removeEventListener('submit', submit);
  },
};

export const FormReset: Story = {
  args: { name: 'topics', defaultValue: ['design', 'motion'], onValueChange: fn(), onInputChange: fn() },
  render: (args) => (
    <form onSubmit={(event) => event.preventDefault()}>
      <TagInput {...args} />
      <button style={FIXTURE_BUTTON} type="reset">Reset topics</button>
    </form>
  ),
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const form = canvasElement.querySelector('form')!;
    const input = inputOf(canvas);
    await expect(new FormData(form).getAll('topics')).toEqual(['design', 'motion']);
    await userEvent.type(input, 'a11y{Enter}');
    await userEvent.click(canvas.getByRole('button', { name: 'Remove design' }));
    await expect(new FormData(form).getAll('topics')).toEqual(['motion', 'a11y']);
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await userEvent.type(input, 'draft');
    // Pressing reset leaves the field first, which commits the draft once.
    await userEvent.click(canvas.getByRole('button', { name: 'Reset topics' }));
    await expect(args.onValueChange).toHaveBeenCalledTimes(3);
    await expect(args.onValueChange).toHaveBeenLastCalledWith(['motion', 'a11y', 'draft']);
    const draftCalls = (args.onInputChange as Spy).mock.calls.length;
    await waitFor(() => expect(new FormData(form).getAll('topics')).toEqual(['design', 'motion']));
    await expect(input).toHaveValue('');
    await expect(args.onValueChange).toHaveBeenCalledTimes(3);
    await expect(args.onInputChange).toHaveBeenCalledTimes(draftCalls);
  },
};

export const ControlledReset: Story = {
  ...FormReset,
  args: { name: 'topics', value: ['design'], onValueChange: fn() },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Reset topics' }));
    await expect(new FormData(canvasElement.querySelector('form')!).getAll('topics')).toEqual(['design']);
    await expect(args.onValueChange).toHaveBeenCalledTimes(0);
  },
};

export const BooleanAndZeroNodes: Story = {
  render: (args) => (
    <>
      <TagInput {...args} label={0} description={0} error={0} />
      <TagInput {...args} label="False slots" description={false} error={false} aria-invalid="grammar" />
      <TagInput {...args} label="Null slots" description={null} error={null} />
      <TagInput {...args} label="Empty slots" description="" error="" />
    </>
  ),
  play: async ({ canvas, canvasElement }) => {
    const [zero, falsy, nulls, empty] = canvas.getAllByRole('textbox');
    await expect(zero).toHaveAccessibleName('0');
    await expect(zero).toHaveAttribute('aria-invalid', 'true');
    await expect(zero).toHaveAccessibleDescription('0 0');
    await expect(falsy).toHaveAttribute('aria-invalid', 'grammar');
    await expect(falsy).not.toHaveAttribute('aria-describedby');
    await expect(nulls).not.toHaveAttribute('aria-describedby');
    await expect(nulls).not.toHaveAttribute('aria-invalid');
    // Empty strings are content: the relationships point at rendered (empty) parts.
    await expect(empty).toHaveAttribute('aria-invalid', 'true');
    for (const id of empty!.getAttribute('aria-describedby')!.split(' ')) {
      await expect(canvasElement.ownerDocument.getElementById(id)).not.toBeNull();
    }
    await expect(canvas.getAllByRole('alert')).toHaveLength(2);
    await expect(new Set([zero, falsy, nulls, empty].map((input) => input!.id)).size).toBe(4);
  },
};

export const ExternalAria: Story = {
  render: (args) => (
    <>
      <span id="tags-extra-name">for the article</span>
      <span id="tags-extra-help">Shown on the card.</span>
      <TagInput
        {...args}
        aria-labelledby="tags-extra-name"
        aria-describedby="tags-extra-help"
        description="Press Enter to add."
        error="Add one more topic."
      />
      <TagInput {...args} label="Unresolved" description={undefined} aria-describedby="tags-missing-id" />
    </>
  ),
  play: async ({ canvas }) => {
    const [input, unresolved] = canvas.getAllByRole('textbox');
    await expect(input).toHaveAccessibleName('Topics for the article');
    await expect(input!.getAttribute('aria-labelledby')!.split(' ')).toHaveLength(2);
    await expect(input!.getAttribute('aria-labelledby')).toContain('tags-extra-name');
    await expect(input).toHaveAccessibleDescription('Shown on the card. Press Enter to add. Add one more topic.');
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    await expect(unresolved).toHaveAttribute('aria-describedby', 'tags-missing-id');
    await expect(unresolved).toHaveAccessibleName('Unresolved');
  },
};

export const RefAndStyles: Story = {
  args: {
    defaultValue: ['design'],
    className: 'consumer-root',
    slotProps: {
      root: { css: { paddingInline: vars.space[1] } },
      token: { css: { paddingInlineStart: vars.space[3] } },
      remove: { css: { color: vars.color.dangerText } },
      list: { className: 'consumer-list' },
    },
    sx: { paddingInline: vars.space[3] },
    messages: { listLabel: 'Article topics', remove: (token: string) => `Delete ${token}` },
    ref: fn(),
  },
  play: async ({ canvas, canvasElement, args }) => {
    const input = inputOf(canvas);
    // The ref receives the real draft input, not a wrapper.
    await expect((args.ref as Spy).mock.calls[0]![0]).toBe(input);
    const root = canvasElement.querySelector<HTMLElement>('[data-ui="tag-input"]')!;
    await expect(root).toHaveClass('consumer-root');
    await expect(getComputedStyle(root).paddingInlineStart).toBe('12px');
    await expect(getComputedStyle(canvas.getByRole('listitem')).paddingInlineStart).toBe('12px');
    const probe = canvasElement.ownerDocument.createElement('span');
    probe.style.color = vars.color.dangerText;
    root.append(probe);
    await expect(getComputedStyle(canvas.getByRole('button', { name: 'Delete design' })).color).toBe(getComputedStyle(probe).color);
    probe.remove();
    await expect(canvas.getByRole('list', { name: 'Article topics' })).toHaveClass('consumer-list');
  },
};

export const LightTheme: Story = {
  decorators: [withLightTheme],
  globals: { theme: 'light' },
  args: { defaultValue: ['design', 'motion'], error: 'Add a topic from the style guide.' },
};

export const RTL: Story = {
  args: { dir: 'rtl', label: 'נושאים', defaultValue: ['עיצוב', 'תנועה'], description: undefined },
  play: async ({ canvas, canvasElement }) => {
    const root = canvasElement.querySelector('[data-ui="tag-input"]')!;
    await expect(root).toHaveAttribute('dir', 'rtl');
    await expect(getComputedStyle(inputOf(canvas)).direction).toBe('rtl');
  },
};

export const ForcedColors: Story = {
  args: { defaultValue: ['design', 'motion'] },
  parameters: { docs: { description: { story: 'Manual check: enable the forced-colors setting in the browser (see docs/qa-gates.md). Not automated here.' } } },
};

export const ReducedMotion: Story = {
  args: { defaultValue: ['design', 'motion'] },
  parameters: { docs: { description: { story: 'Manual check: enable prefers-reduced-motion: reduce in the browser (see docs/qa-gates.md). Not automated here.' } } },
};
