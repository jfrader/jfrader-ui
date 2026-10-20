import {
  FieldReplacementRoot,
  FieldSugarRoot,
  FieldReplacementLabel,
  fieldRootStyles,
  expectFieldSlotCustomization,
} from '../../testing/field-slot-fixtures';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fireEvent, fn, spyOn, waitFor } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { withLightTheme } from '../../testing/story-decorators';
import { TagInput, type TagInputProps } from './index';
import { Button } from '../button';
// `styled` is the app-facing styling API; consumers import it from `@jfrader/ui`.
import { styled } from '../../index';

// Raw fixture buttons must pass the global target-size (WCAG 2.5.8) axe gate in every environment.
const FixtureButton = styled.button({ minHeight: vars.space[6], minWidth: vars.space[6], padding: `${vars.space[1]} calc(${vars.space[2]} + ${vars.space[1]} / 2)`, boxSizing: 'border-box' });

const sizes = ['sm', 'md', 'lg'] as const;
const heights = { sm: 32, md: 40, lg: 48 };
const StackFrame = styled.div({ display: 'grid', gap: vars.space[4], inlineSize: 'min(100%, 360px)' });

const meta = {
  title: 'Inputs/TagInput',
  component: TagInput,
  tags: ['autodocs'],
  args: { label: 'Topics', description: 'Press Enter or comma to add.', placeholder: 'Add a topic' },
  argTypes: { size: { control: 'radio', options: sizes } },
  decorators: [(Story) => <StackFrame><Story /></StackFrame>],
  parameters: {
    docs: {
      description: {
        component: 'Type tags or recipients, add them to a list and remove them.',
      },
      sections: [
        { title: 'Basic', stories: ['Default', 'Prefilled'] },
        { title: 'Suggestions', stories: ['SuggestedTopics'] },
        { title: 'Many and long tags', stories: ['Wrapping', 'LongToken'] },
        { title: 'Invalid and disabled', stories: ['InvalidToken', 'Error', 'Disabled'] },
        { title: 'Forms and controlled values', stories: ['FormSubmission', 'Controlled', 'DraftControlled'] },
        { title: 'Keyboard and removal', stories: ['Keyboard'] },
      ],
      usage: `### When to use
Collect free-form tags or recipients. TagInput has no suggestion list; use Combobox when readers must choose from suggested or fixed options.

### Values and constraints

- Supply unique, nonempty, normalized entries. Whitespace is trimmed by default; duplicate comparison ignores case but distinguishes accents under the chosen locale.
- Rejected additions keep the draft and announce the reason. Existing entries are not removed when a limit changes.
- Adding a tag requests the new list before clearing the draft; a controlled application must accept both changes to clear it.
- Forms submit committed tags in list order, not the draft. A required field needs at least one committed tag.
- Blur commits, when enabled, happen only when focus leaves the whole field, not when it moves to a remove button.

### Keyboard and accessibility

- Enter or comma adds the draft. With an empty draft, Enter submits the form and comma types.
- Backspace at caret 0 picks the last token. Backspace or Delete again removes it.
- ArrowLeft at caret 0 or with a token picked moves to the previous token, stopping at the first.
- ArrowRight with a token picked moves to the next token, then returns to the input after the last.
- Escape clears the pick. Typing or pasting edits the draft and clears the pick.
- Tab and Shift+Tab follow DOM order: remove buttons, input, then page.
- IME composition bypasses shortcuts and blur commits. Held keys do not remove tokens.

- Give the field a visible label and instructions for any nondefault separator. Additions, removals and rejected drafts are announced.`,
    },
  },
} satisfies Meta<typeof TagInput>;
export default meta;
type Story = StoryObj<typeof meta>;

const topicCollator = new Intl.Collator(undefined, { sensitivity: 'accent' });

function TopicSuggestions() {
  const [value, setValue] = useState<readonly string[]>([]);
  return (
    <>
      <TagInput label="Topics" description="Press Enter or comma to add." placeholder="Add a topic"
        value={value} onValueChange={setValue} />
      <Button disabled={value.some((topic) => topicCollator.compare(topic, 'accessibility') === 0)}
        onClick={() => setValue([...value, 'accessibility'])}>
        Add accessibility
      </Button>
    </>
  );
}

export const SuggestedTopics: Story = {
  name: 'Offer a suggested topic',
  parameters: { docs: {
    description: { story: 'Add an application-provided suggestion with a button; TagInput has no autocomplete popup.' },
    source: { language: 'tsx', code: `import { useState } from 'react';
import { Button, TagInput } from '@jfrader/ui';

const topicCollator = new Intl.Collator(undefined, { sensitivity: 'accent' });

function TopicSuggestions() {
  const [value, setValue] = useState<readonly string[]>([]);
  return (
    <>
      <TagInput label="Topics" description="Press Enter or comma to add." placeholder="Add a topic"
        value={value} onValueChange={setValue} />
      <Button disabled={value.some((topic) => topicCollator.compare(topic, 'accessibility') === 0)}
        onClick={() => setValue([...value, 'accessibility'])}>
        Add accessibility
      </Button>
    </>
  );
}` },
  } },
  render: () => <TopicSuggestions />,
  play: async ({ canvas, userEvent }) => {
    const suggestion = canvas.getByRole('button', { name: 'Add accessibility' });
    await userEvent.click(suggestion);
    await expect(suggestion).toBeDisabled();
    await userEvent.click(canvas.getByRole('button', { name: 'Remove accessibility' }));
    await userEvent.type(canvas.getByRole('textbox'), 'ACCESSIBILITY{Enter}');
    await expect(suggestion).toBeDisabled();
    await expect(canvas.getAllByRole('listitem')).toHaveLength(1);
  },
};

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

/** External updates arrive while the input keeps focus, so no field exit clears the pick. */
function ExternalUpdateField(props: TagInputProps) {
  const [value, setValue] = useState<readonly string[]>(['design']);
  const keepFocus = (event: { preventDefault: () => void }) => event.preventDefault();
  return (
    <>
      <TagInput {...props} value={value} />
      <FixtureButton type="button" onMouseDown={keepFocus} onClick={() => setValue(['motion', 'type'])}>
        Replace topics
      </FixtureButton>
      <FixtureButton type="button" onMouseDown={keepFocus} onClick={() => setValue(['design', 'motion'])}>
        Restore topics
      </FixtureButton>
    </>
  );
}
ExternalUpdateField.displayName = 'ExternalUpdateTagInput';

/** Holds each requested list until the parent accepts or rejects it. */
function DelayedField(props: TagInputProps) {
  const [value, setValue] = useState<readonly string[]>(props.defaultValue ?? []);
  const [requested, setRequested] = useState<readonly string[] | null>(null);
  return (
    <>
      <TagInput
        {...props}
        defaultValue={undefined}
        value={value}
        onValueChange={(next) => {
          props.onValueChange?.(next);
          setRequested(next);
        }}
      />
      <FixtureButton type="button" onClick={() => requested && setValue(requested)}>
        Accept
      </FixtureButton>
      <FixtureButton type="button" onClick={() => setRequested(null)}>
        Reject
      </FixtureButton>
    </>
  );
}
DelayedField.displayName = 'DelayedTagInput';

const inputOf = (canvas: { getByRole: (role: 'textbox', options?: object) => HTMLElement }) =>
  canvas.getByRole('textbox') as HTMLInputElement;
const shellOf = (input: HTMLElement) => input.parentElement!;
const tokenTexts = (root: HTMLElement) => Array.from(root.querySelectorAll('li'), (li) => li.textContent);
const pickedTexts = (root: HTMLElement) =>
  Array.from(root.querySelectorAll('li[data-picked]'), (li) => li.textContent);
const settle = () => new Promise((resolve) => setTimeout(resolve, 50));

/** Computed value of `property` for a probe styled with `token` inside `parent`. */
function tokenProbe(parent: HTMLElement, property: 'color' | 'paddingInlineStart', token: string) {
  const probe = parent.ownerDocument.createElement('span');
  probe.style[property] = token;
  parent.append(probe);
  const computed = getComputedStyle(probe)[property];
  probe.remove();
  return computed;
}

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
  name: 'Add topics',
  parameters: { docs: {
    description: { story: 'Type a topic and press Enter or comma to add it.' },
    source: { language: 'tsx', code: `import { TagInput } from '@jfrader/ui';

<TagInput label="Topics" description="Press Enter or comma to add." placeholder="Add a topic" />` },
  } },
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
    const input = inputOf(canvas);
    await expect(canvas.queryByRole('list')).toBeNull();
    await expect(input).toHaveAttribute('placeholder', 'Add a topic');
    // Placeholder text uses the muted text role (≥ 4.5:1 on the raised surface in both themes).
    await expect(getComputedStyle(input, '::placeholder').color).toBe(tokenProbe(shellOf(input), 'color', vars.color.textMuted));
  },
};

export const Prefilled: Story = {
  name: 'Start with existing topics',
  parameters: { docs: {
    description: { story: 'Edit a list that already contains three topics.' },
    source: { language: 'tsx', code: `import { TagInput } from '@jfrader/ui';

<TagInput label="Topics" description="Press Enter or comma to add." placeholder="Add a topic"
  defaultValue={['design', 'motion', 'accessibility']} />` },
  } },
  args: { defaultValue: ['design', 'motion', 'accessibility'] },
};

export const Controlled: Story = {
  name: 'Controlled topics',
  parameters: { docs: { description: { story: 'Store the committed topics in application state.' }, source: { language: 'tsx', code: `import { useState } from 'react';
import { TagInput } from '@jfrader/ui';

function Topics() {
  const [value, setValue] = useState<readonly string[]>(['design']);
  return <TagInput label="Topics" description="Press Enter or comma to add." placeholder="Add a topic"
    value={value} onValueChange={setValue} />;
}` } } },
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
  name: 'Controlled draft',
  parameters: { docs: { description: { story: 'Show the current draft separately from committed topics.' }, source: { language: 'tsx', code: `import { useState } from 'react';
import { TagInput } from '@jfrader/ui';

function Topics() {
  const [draft, setDraft] = useState('');
  return (
    <>
      <TagInput label="Topics" description="Press Enter or comma to add." placeholder="Add a topic"
        inputValue={draft} onInputChange={setDraft} />
      <output>{draft}</output>
    </>
  );
}` } } },
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

export const DelayedControlledAnnouncements: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import { useState } from 'react';
import { Button, TagInput } from '@jfrader/ui';

function ReviewedTopics() {
  const [value, setValue] = useState<readonly string[]>(['design']);
  const [requested, setRequested] = useState<readonly string[] | null>(null);
  return (
    <>
      <TagInput label="Topics" value={value} onValueChange={setRequested} />
      <Button onClick={() => {
        if (requested) setValue(requested);
        setRequested(null);
      }}>Accept</Button>
      <Button onClick={() => setRequested(null)}>Reject</Button>
    </>
  );
}` } } },
  args: { defaultValue: ['design'], onValueChange: fn() },
  render: (args) => <DelayedField {...args} />,
  play: async ({ canvas, userEvent, args }) => {
    const input = inputOf(canvas);
    const status = canvas.getByRole('status');
    const valueCalls = args.onValueChange as Spy;

    // Delayed acceptance: nothing is announced until the parent shows the new list.
    await userEvent.type(input, 'motion{Enter}');
    await expect(valueCalls).toHaveBeenCalledTimes(1);
    await expect(valueCalls).toHaveBeenLastCalledWith(['design', 'motion']);
    await settle();
    await expect(tokenTexts(canvas.getByRole('list'))).toEqual(['design']);
    await expect(status).toHaveTextContent('');
    await userEvent.click(canvas.getByRole('button', { name: 'Accept' }));
    await expect(tokenTexts(canvas.getByRole('list'))).toEqual(['design', 'motion']);
    await waitFor(() => expect(status).toHaveTextContent('Added motion'));
    await expect(valueCalls).toHaveBeenCalledTimes(1);

    // Rejection: the request never turns into a success message.
    await userEvent.type(input, 'type{Enter}');
    await expect(valueCalls).toHaveBeenCalledTimes(2);
    await expect(valueCalls).toHaveBeenLastCalledWith(['design', 'motion', 'type']);
    await userEvent.click(canvas.getByRole('button', { name: 'Reject' }));
    await settle();
    await expect(tokenTexts(canvas.getByRole('list'))).toEqual(['design', 'motion']);
    await expect(status).toHaveTextContent('Added motion');
    await expect(status).not.toHaveTextContent('Added type');

    // A delayed removal is announced on acceptance as well.
    await userEvent.click(canvas.getByRole('button', { name: 'Remove design' }));
    await expect(valueCalls).toHaveBeenCalledTimes(3);
    await expect(valueCalls).toHaveBeenLastCalledWith(['motion']);
    await settle();
    await expect(status).not.toHaveTextContent('Removed design');
    await userEvent.click(canvas.getByRole('button', { name: 'Accept' }));
    await expect(tokenTexts(canvas.getByRole('list'))).toEqual(['motion']);
    await waitFor(() => expect(status).toHaveTextContent('Removed design'));
    await expect(valueCalls).toHaveBeenCalledTimes(3);
  },
};

export const ControlledEmpty: Story = {
  args: {
    value: [],
    defaultValue: ['seed'],
    inputValue: '',
    defaultInputValue: 'seed',
    onValueChange: fn(),
    onInputChange: fn(),
  },
  play: async ({ canvas, userEvent, args }) => {
    const input = inputOf(canvas);
    // `[]` and `''` are controlled values, not fallbacks to the defaults.
    await expect(canvas.queryByRole('list')).toBeNull();
    await expect(input).toHaveValue('');
    await userEvent.type(input, 'x');
    await expect(args.onInputChange).toHaveBeenCalledTimes(1);
    await expect(args.onInputChange).toHaveBeenLastCalledWith('x');
    await expect(input).toHaveValue('');
    await userEvent.keyboard('{Backspace}{ArrowLeft}{Enter}');
    await expect(canvas.queryByRole('list')).toBeNull();
    await expect(args.onValueChange).toHaveBeenCalledTimes(0);
    await expect(args.onInputChange).toHaveBeenCalledTimes(1);
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
  parameters: { docs: { source: { language: 'tsx', code: `import { useState } from 'react';
import { Button, TagInput } from '@jfrader/ui';

function Topics() {
  const [value, setValue] = useState<readonly string[]>(['design']);
  return (
    <>
      <TagInput label="Topics" value={value} onValueChange={setValue} />
      <Button
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setValue(['motion', 'type'])}
      >Replace topics</Button>
      <Button
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setValue(['design', 'motion'])}
      >Restore topics</Button>
    </>
  );
}` } } },
  args: { onValueChange: fn(), onInputChange: fn() },
  render: (args) => <ExternalUpdateField {...args} />,
  play: async ({ canvas, userEvent, args }) => {
    const input = inputOf(canvas);
    await userEvent.type(input, 'dr{Home}{Backspace}');
    await expect(pickedTexts(canvas.getByRole('list'))).toEqual(['design']);
    await expect(input).toHaveAccessibleDescription(expect.stringContaining('design'));
    await userEvent.click(canvas.getByRole('button', { name: 'Replace topics' }));
    await expect(tokenTexts(canvas.getByRole('list'))).toEqual(['motion', 'type']);
    await expect(pickedTexts(canvas.getByRole('list'))).toEqual([]);
    await expect(input).not.toHaveAccessibleDescription(expect.stringContaining('design'));
    // The same string coming back later is a fresh, unpicked token; the draft is untouched.
    await userEvent.click(canvas.getByRole('button', { name: 'Restore topics' }));
    await expect(tokenTexts(canvas.getByRole('list'))).toEqual(['design', 'motion']);
    await expect(pickedTexts(canvas.getByRole('list'))).toEqual([]);
    await expect(input).toHaveAccessibleDescription('Press Enter or comma to add.');
    await expectInputFocus(input);
    await expect(input).toHaveValue('dr');
    await expect(args.onInputChange).toHaveBeenCalledTimes(2);
    await expect(args.onValueChange).toHaveBeenCalledTimes(0);
  },
};

export const Sizes: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `<>
  <TagInput label="Small topics" size="sm" defaultValue={['design']} />
  <TagInput label="Medium topics" size="md" defaultValue={['design']} />
  <TagInput label="Large topics" size="lg" defaultValue={['design']} />
</>` } } },
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
      await expect(target.width).toBeGreaterThanOrEqual(32);
      await expect(target.height).toBeGreaterThanOrEqual(24);
    }
  },
};

export const Wrapping: Story = {
  name: 'Wrap many topics',
  parameters: { docs: {
    description: { story: 'Let a long list wrap within a narrow field.' },
    source: { language: 'tsx', code: `import { TagInput } from '@jfrader/ui';

<TagInput label="Topics" description="Press Enter or comma to add." placeholder="Add a topic"
  defaultValue={['design', 'motion', 'accessibility', 'typography', 'color', 'layout', 'research']}
  sx={{ inlineSize: '220px' }} />` },
  } },
  args: {
    defaultValue: ['design', 'motion', 'accessibility', 'typography', 'color', 'layout', 'research'],
    sx: { inlineSize: '220px' },
  },
  play: async ({ canvas }) => {
    const input = inputOf(canvas);
    const shell = shellOf(input);
    await expect(shell.scrollWidth).toBeLessThanOrEqual(shell.clientWidth);
    await expect(shell.getBoundingClientRect().height).toBeGreaterThan(heights.md);
    const bounds = shell.getBoundingClientRect();
    for (const item of [...canvas.getAllByRole('listitem'), input]) {
      const rect = item.getBoundingClientRect();
      await expect(rect.left).toBeGreaterThanOrEqual(bounds.left);
      await expect(rect.right).toBeLessThanOrEqual(bounds.right);
      await expect(rect.bottom).toBeLessThanOrEqual(bounds.bottom);
    }
  },
};

const LONG_TOKEN = 'interaction-design-for-multilingual-onboarding-flows-across-regions';
export const NarrowControl: Story = {
  tags: ['!autodocs'],
  args: { defaultValue: ['accessibility', 'design'], sx: { inlineSize: '80px' } },
  play: async ({ canvas, userEvent }) => {
    const input = inputOf(canvas);
    const shell = shellOf(input);
    await expect(shell.scrollWidth).toBeLessThanOrEqual(shell.clientWidth);
    const bounds = shell.getBoundingClientRect();
    for (const element of [input, ...canvas.getAllByRole('button')]) {
      const rect = element.getBoundingClientRect();
      await expect(rect.left).toBeGreaterThanOrEqual(bounds.left);
      await expect(rect.right).toBeLessThanOrEqual(bounds.right);
    }
    await userEvent.type(input, 'ux{Enter}');
    await waitFor(() => expect(canvas.getByRole('button', { name: 'Remove ux' })).toBeVisible());
    await expect(shell.scrollWidth).toBeLessThanOrEqual(shell.clientWidth);
  },
};

export const LongToken: Story = {
  name: 'Long topic names',
  parameters: { docs: {
    description: { story: 'Keep a long topic and its remove button inside a narrow field.' },
    source: { language: 'tsx', code: `import { TagInput } from '@jfrader/ui';

<TagInput label="Topics" description="Press Enter or comma to add." placeholder="Add a topic"
  defaultValue={['interaction-design-for-multilingual-onboarding-flows-across-regions', 'ux']}
  sx={{ inlineSize: '240px' }} />` },
  } },
  args: { defaultValue: [LONG_TOKEN, 'ux'], sx: { inlineSize: '240px' } },
  play: async ({ canvas, userEvent }) => {
    const shell = shellOf(inputOf(canvas));
    const [long] = canvas.getAllByRole('listitem');
    await expect(long!.getBoundingClientRect().width).toBeLessThanOrEqual(shell.clientWidth);
    await expect(long).toHaveTextContent(LONG_TOKEN);
    const remove = canvas.getByRole('button', { name: `Remove ${LONG_TOKEN}` });
    await expect(remove.getBoundingClientRect().width).toBeGreaterThanOrEqual(32);
    await expect(remove.getBoundingClientRect().height).toBeGreaterThanOrEqual(24);
    await expect(remove.getBoundingClientRect().right).toBeLessThanOrEqual(shell.getBoundingClientRect().right);
    await userEvent.click(inputOf(canvas));
    await userEvent.tab({ shift: true });
    await userEvent.tab({ shift: true });
    await expectFocus(remove);
    await userEvent.keyboard('{Enter}');
    await expect(canvas.queryByRole('button', { name: `Remove ${LONG_TOKEN}` })).toBeNull();
    await expect(tokenTexts(canvas.getByRole('list'))).toEqual(['ux']);
    await expectInputFocus(inputOf(canvas));
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
  name: 'Reject an invalid recipient',
  parameters: { docs: { description: { story: 'Try “ada” to hear a rejection, then add “@example.com” and retry.' }, source: { language: 'tsx', code: `import { TagInput } from '@jfrader/ui';

<TagInput
  label="Recipients"
  description="Press Enter to add an email address."
  placeholder="Add a topic"
  validateToken={(token) => token.includes('@') ? null : 'Enter an email address.'}
/>` } } },
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
  name: 'Field error',
  parameters: { docs: {
    description: { story: 'Associate a form validation error with the topic field.' },
    source: { language: 'tsx', code: `import { TagInput } from '@jfrader/ui';

<TagInput label="Topics" description="Press Enter or comma to add." placeholder="Add a topic"
  defaultValue={['design']} error="Add a topic from the style guide." />` },
  } },
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
  name: 'Disabled topics',
  parameters: { docs: { description: { story: 'Disable editing and removal and omit the topics from form submission.' }, source: { language: 'tsx', code: `import { TagInput } from '@jfrader/ui';

<form>
  <TagInput label="Topics" description="Press Enter or comma to add." placeholder="Add a topic"
    name="topics" disabled defaultValue={['design']} />
</form>` } } },
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
  parameters: { docs: { source: { language: 'tsx', code: `import { Button, TagInput } from '@jfrader/ui';

<>
  <TagInput label="Topics" commitOnBlur={false} />
  <Button type="button">After</Button>
</>` } } },
  args: { commitOnBlur: false, onValueChange: fn() },
  render: (args) => <><TagInput {...args} /><FixtureButton type="button">After</FixtureButton></>,
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
  parameters: { docs: { source: { language: 'tsx', code: `import { Button, TagInput } from '@jfrader/ui';

<>
  <TagInput label="Topics" commitOnBlur />
  <Button type="button">After</Button>
</>` } } },
  args: { onValueChange: fn() },
  render: (args) => <><TagInput {...args} /><FixtureButton type="button">After</FixtureButton></>,
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
  parameters: { docs: { source: { language: 'tsx', code: `import { Button, TagInput } from '@jfrader/ui';

<>
  <TagInput label="Topics" defaultValue={['design', 'motion']} commitOnBlur />
  <Button type="button">After</Button>
</>` } } },
  args: { defaultValue: ['design', 'motion'], onValueChange: fn() },
  render: (args) => <><TagInput {...args} /><FixtureButton type="button">After</FixtureButton></>,
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

export const ShiftTabExit: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import { Button, TagInput } from '@jfrader/ui';

<>
  <Button type="button">Before</Button>
  <TagInput label="Topics" defaultValue={['design']} commitOnBlur />
</>` } } },
  args: { defaultValue: ['design'], onValueChange: fn() },
  render: (args) => (
    <>
      <FixtureButton type="button">Before</FixtureButton>
      <TagInput {...args} />
    </>
  ),
  play: async ({ canvas, userEvent, args }) => {
    const input = inputOf(canvas);
    const before = canvas.getByRole('button', { name: 'Before' });
    await userEvent.type(input, 'motion');
    await userEvent.tab({ shift: true });
    await expectFocus(canvas.getByRole('button', { name: 'Remove design' }));
    await expect(args.onValueChange).toHaveBeenCalledTimes(0);
    // Shift+Tab out of the first remove button leaves the field: one commit, focus stays outside.
    await userEvent.tab({ shift: true });
    await expect(input.ownerDocument.activeElement).toBe(before);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith(['design', 'motion']);
    await expect(input).toHaveValue('');
    await settle();
    await expect(input.ownerDocument.activeElement).toBe(before);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
  },
};

export const Keyboard: Story = {
  name: 'Pick and remove with the keyboard',
  parameters: { docs: { description: { story: 'Focus the empty input, press Backspace to pick the last topic, then Backspace again to remove it.' }, source: { language: 'tsx', code: `import { Button, TagInput } from '@jfrader/ui';

<>
  <Button type="button">Before</Button>
  <TagInput
    label="Topics"
    placeholder="Add a topic"
    defaultValue={['design', 'motion']}
    description="Press Enter or comma to add."
  />
  <Button type="button">After</Button>
</>` } } },
  args: { defaultValue: ['design', 'motion'], onValueChange: fn(), onKeyDown: fn() },
  render: (args) => (
    <>
      <FixtureButton type="button">Before</FixtureButton>
      <TagInput {...args} />
      <FixtureButton type="button">After</FixtureButton>
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
    const composingComma = new KeyboardEvent('keydown', { key: ',', isComposing: true, bubbles: true, cancelable: true });
    fireEvent(input, composingComma);
    await expect(composingComma.defaultPrevented).toBe(false);
    await expect(args.onValueChange).toHaveBeenCalledTimes(0);
    await userEvent.keyboard('{Enter}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith(['design', 'motion', 'デザイン']);

    // An empty draft leaves every separator to the page: Enter submits, comma types.
    const emptyEnter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    fireEvent(input, emptyEnter);
    await expect(emptyEnter.defaultPrevented).toBe(false);
    const emptyComma = new KeyboardEvent('keydown', { key: ',', bubbles: true, cancelable: true });
    fireEvent(input, emptyComma);
    await expect(emptyComma.defaultPrevented).toBe(false);
    await userEvent.keyboard(',');
    await expect(input).toHaveValue(',');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
  },
};

export const CompositionFieldExit: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import { Button, TagInput } from '@jfrader/ui';

<>
  <TagInput label="Topics" commitOnBlur />
  <Button type="button">After</Button>
</>` } } },
  args: { onValueChange: fn(), onCompositionStart: fn(), onCompositionEnd: fn() },
  render: (args) => <><TagInput {...args} /><FixtureButton type="button">After</FixtureButton></>,
  play: async ({ canvas, userEvent, args }) => {
    const input = inputOf(canvas);
    const after = canvas.getByRole('button', { name: 'After' });
    await userEvent.click(input);
    fireEvent.compositionStart(input);
    // Separators typed during composition are text.
    await userEvent.keyboard('でざ,');
    await expect(input).toHaveValue('でざ,');
    await expect(args.onValueChange).toHaveBeenCalledTimes(0);
    // Leaving the field mid-composition keeps the provisional text as the draft.
    await userEvent.tab();
    await expect(input.ownerDocument.activeElement).toBe(after);
    await expect(args.onValueChange).toHaveBeenCalledTimes(0);
    await expect(input).toHaveValue('でざ,');
    fireEvent.compositionEnd(input);
    await expect(args.onCompositionStart).toHaveBeenCalledTimes(1);
    await expect(args.onCompositionEnd).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledTimes(0);
    // Once composition finishes, a field exit commits once.
    await userEvent.click(input);
    await userEvent.tab();
    await expect(input.ownerDocument.activeElement).toBe(after);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith(['でざ,']);
  },
};

export const PasteWhilePicked: Story = {
  args: { defaultValue: ['design', 'motion'], onValueChange: fn(), onInputChange: fn() },
  play: async ({ canvas, userEvent, args }) => {
    const input = inputOf(canvas);
    await userEvent.click(input);
    await userEvent.keyboard('{Backspace}');
    await expect(pickedTexts(canvas.getByRole('list'))).toEqual(['motion']);
    // Paste is literal draft text: it drops the pick and never splits on commas.
    await userEvent.paste('ux, research');
    await expect(pickedTexts(canvas.getByRole('list'))).toEqual([]);
    await expect(input).toHaveValue('ux, research');
    await expect(args.onInputChange).toHaveBeenCalledTimes(1);
    await expect(args.onInputChange).toHaveBeenLastCalledWith('ux, research');
    await expect(tokenTexts(canvas.getByRole('list'))).toEqual(['design', 'motion']);
    await expect(args.onValueChange).toHaveBeenCalledTimes(0);
  },
};

export const SelectedTextEditing: Story = {
  args: { defaultValue: ['design'], onValueChange: fn() },
  play: async ({ canvas, userEvent, args }) => {
    const input = inputOf(canvas);
    const list = canvas.getByRole('list');
    await userEvent.type(input, 'abc');
    // A selection starting at 0 is native editing, never a token pick or removal.
    input.setSelectionRange(0, 3);
    await userEvent.keyboard('{Backspace}');
    await expect(input).toHaveValue('');
    await expect(pickedTexts(list)).toEqual([]);
    await userEvent.type(input, 'abc');
    input.setSelectionRange(0, 2);
    await userEvent.keyboard('{Delete}');
    await expect(input).toHaveValue('c');
    await expect(pickedTexts(list)).toEqual([]);
    input.setSelectionRange(0, 1);
    await userEvent.keyboard('{ArrowLeft}');
    await expect(pickedTexts(list)).toEqual([]);
    await expect(input.selectionStart).toBe(0);
    await expect(input.selectionEnd).toBe(0);
    await expect(input).toHaveValue('c');
    await expect(tokenTexts(list)).toEqual(['design']);
    await expect(args.onValueChange).toHaveBeenCalledTimes(0);
  },
};

export const FormSubmission: Story = {
  name: 'Submit committed topics',
  parameters: { docs: { description: { story: 'Add topics before saving; the unfinished draft is not a form value.' }, source: { language: 'tsx', code: `import { Button, TagInput } from '@jfrader/ui';

<form action={async (data) => {
  await fetch('/api/topics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topics: data.getAll('topics') }),
  });
}}>
  <TagInput label="Topics" description="Press Enter or comma to add." placeholder="Add a topic"
    name="topics" defaultValue={['design']} />
  <Button type="submit">Save</Button>
</form>` } } },
  args: { name: 'topics', defaultValue: ['design'], onValueChange: fn() },
  render: (args) => (
    <form onSubmit={(event) => event.preventDefault()}>
      <TagInput {...args} />
      <FixtureButton type="submit">Save</FixtureButton>
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

export const ExternalForm: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import { useId } from 'react';
import { Button, TagInput } from '@jfrader/ui';

function TopicsForm() {
  const formId = useId();
  return (
    <>
      <form id={formId} aria-label="Topics form">
        <Button type="reset">Reset topics</Button>
      </form>
      <TagInput label="Topics" form={formId} name="topics" defaultValue={['design']} />
    </>
  );
}` } } },
  args: { form: 'external-topics', name: 'topics', defaultValue: ['design'], onValueChange: fn() },
  render: (args) => (
    <>
      <form id="external-topics" aria-label="Topics form" />
      <TagInput {...args} />
    </>
  ),
  play: async ({ canvas, userEvent, args }) => {
    const form = canvas.getByRole('form', { name: 'Topics form' }) as HTMLFormElement;
    const input = inputOf(canvas);
    await expect(input.form).toBe(form);
    await userEvent.type(input, 'motion{Enter}');
    await expect(new FormData(form).getAll('topics')).toEqual(['design', 'motion']);
    form.reset();
    await waitFor(() => expect(new FormData(form).getAll('topics')).toEqual(['design']));
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
  },
};

export const FormReset: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import { Button, TagInput } from '@jfrader/ui';

<form>
  <TagInput label="Topics" name="topics" defaultValue={['design', 'motion']} />
  <Button type="reset">Reset topics</Button>
</form>` } } },
  args: { name: 'topics', defaultValue: ['design', 'motion'], onValueChange: fn(), onInputChange: fn() },
  render: (args) => (
    <form onSubmit={(event) => event.preventDefault()}>
      <TagInput {...args} />
      <FixtureButton type="reset">Reset topics</FixtureButton>
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
  parameters: { docs: { source: { language: 'tsx', code: `import { useState } from 'react';
import { Button, TagInput } from '@jfrader/ui';

function TopicsForm() {
  const [value, setValue] = useState<readonly string[]>(['design']);
  return (
    <form>
      <TagInput
        label="Topics"
        name="topics"
        value={value}
        onValueChange={setValue}
        commitOnBlur={false}
      />
      <Button type="reset">Reset topics</Button>
    </form>
  );
}` } } },
  args: { name: 'topics', defaultValue: ['design'], commitOnBlur: false, onValueChange: fn(), onInputChange: fn() },
  render: (args) => (
    <form onSubmit={(event) => event.preventDefault()}>
      <ControlledField {...args} />
      <FixtureButton type="reset">Reset topics</FixtureButton>
    </form>
  ),
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const form = canvasElement.querySelector('form')!;
    const input = inputOf(canvas);
    await userEvent.type(input, 'motion{Enter}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith(['design', 'motion']);
    await userEvent.type(input, 'draft');
    await expect(args.onInputChange).toHaveBeenCalledTimes(12);
    await userEvent.click(canvas.getByRole('button', { name: 'Reset topics' }));
    // The controlled list keeps the accepted props; the uncontrolled draft returns to its seed.
    await waitFor(() => expect(input).toHaveValue(''));
    await expect(tokenTexts(canvas.getByRole('list'))).toEqual(['design', 'motion']);
    await expect(new FormData(form).getAll('topics')).toEqual(['design', 'motion']);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onInputChange).toHaveBeenCalledTimes(12);
  },
};

const INVALID_LIST = Object.freeze(['Design', 'design', ' padded', '']);
export const InvalidConsumerList: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `<>
  <TagInput label="Topics" defaultValue={['Design', 'design', ' padded', '']} />
  <TagInput label="Valid topics" defaultValue={['design']} />
</>` } } },
  args: { defaultValue: INVALID_LIST },
  beforeEach: () => {
    const warn = spyOn(console, 'warn').mockImplementation(() => {});
    return () => warn.mockRestore();
  },
  render: (args) => (
    <>
      <TagInput {...args} />
      <TagInput {...args} label="Valid topics" defaultValue={['design']} />
    </>
  ),
  play: async ({ canvas }) => {
    // The supplied (frozen) list renders as given; only the invalid instance warns, once.
    const [invalid] = canvas.getAllByRole('list');
    await expect(tokenTexts(invalid!)).toEqual([...INVALID_LIST]);
    await expect(console.warn).toHaveBeenCalledTimes(1);
    await expect(console.warn).toHaveBeenLastCalledWith(expect.stringContaining(JSON.stringify(['design', ' padded', ''])));
  },
};

export const BooleanAndZeroNodes: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `<>
  <TagInput label={0} description={0} error={0} />
  <TagInput label="False slots" description={false} error={false} aria-invalid="grammar" />
  <TagInput label="Null slots" description={null} error={null} />
  <TagInput label="Empty slots" description="" error="" />
</>` } } },
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
  parameters: { docs: { source: { language: 'tsx', code: `import { useId } from 'react';
import { TagInput } from '@jfrader/ui';

function ArticleTopics() {
  const labelId = useId();
  const helpId = useId();
  return (
    <>
      <span id={labelId}>for the article</span>
      <span id={helpId}>Shown on the card.</span>
      <TagInput
        label="Topics"
        aria-labelledby={labelId}
        aria-describedby={helpId}
        description="Press Enter to add."
        error="Add one more topic."
      />
    </>
  );
}` } } },
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

// This story tests the documented css/slot API and native style merging.
export const RefAndStyles: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import { useRef } from 'react';
import { Button, TagInput, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const ArticleTopics = styled(TagInput)({ paddingInline: vars.space[3] });

function TopicEditor() {
  const input = useRef<HTMLInputElement | null>(null);
  return (
    <>
      <ArticleTopics
        ref={input}
        label="Topics"
        defaultValue={['design']}
        slotProps={{ list: { className: 'article-topics' } }}
        messages={{ listLabel: 'Article topics', remove: (token) => 'Delete ' + token }}
      />
      <Button onClick={() => input.current?.focus()}>Add topic</Button>
    </>
  );
}` } } },
  args: {
    defaultValue: ['design'],
    className: 'consumer-root',
    slotProps: {
      root: { sx: { paddingInline: vars.space[1] } },
      token: { sx: { paddingInlineStart: vars.space[3] } },
      remove: { sx: { color: vars.color.dangerText } },
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
    const sxPadding = tokenProbe(root, 'paddingInlineStart', vars.space[3]);
    await expect(getComputedStyle(root).paddingInlineStart).toBe(sxPadding);
    await expect(root.getBoundingClientRect().width).toBeLessThanOrEqual(
      root.parentElement!.getBoundingClientRect().width,
    );
    await expect(getComputedStyle(canvas.getByRole('listitem')).paddingInlineStart).toBe(sxPadding);
    await expect(getComputedStyle(canvas.getByRole('button', { name: 'Delete design' })).color).toBe(
      tokenProbe(root, 'color', vars.color.dangerText),
    );
    await expect(canvas.getByRole('list', { name: 'Article topics' })).toHaveClass('consumer-list');
  },
};

export const LightTheme: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import { TagInput, ThemeRoot } from '@jfrader/ui';

<ThemeRoot theme="light">
  <TagInput
    label="Topics"
    defaultValue={['design', 'motion']}
    error="Add a topic from the style guide."
  />
</ThemeRoot>` } } },
  decorators: [withLightTheme],
  globals: { theme: 'light' },
  args: { defaultValue: ['design', 'motion'], error: 'Add a topic from the style guide.' },
};

export const RTL: Story = {
  args: { dir: 'rtl', label: 'נושאים', defaultValue: ['עיצוב', 'תנועה'], description: undefined, onValueChange: fn() },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const root = canvasElement.querySelector('[data-ui="tag-input"]')!;
    const input = inputOf(canvas);
    const list = canvas.getByRole('list');
    await expect(root).toHaveAttribute('dir', 'rtl');
    await expect(getComputedStyle(input).direction).toBe('rtl');
    // Tokens lay out from the inline start, which is the right edge in RTL.
    const [first, second] = canvas.getAllByRole('listitem');
    await expect(first!.getBoundingClientRect().right).toBeGreaterThan(second!.getBoundingClientRect().right);

    // Token traversal follows list order with the same keys as LTR.
    await userEvent.click(input);
    await userEvent.keyboard('{Backspace}');
    await expect(pickedTexts(list)).toEqual(['תנועה']);
    await userEvent.keyboard('{ArrowLeft}');
    await expect(pickedTexts(list)).toEqual(['עיצוב']);
    await userEvent.keyboard('{ArrowRight}');
    await expect(pickedTexts(list)).toEqual(['תנועה']);
    await userEvent.keyboard('{ArrowRight}');
    await expect(pickedTexts(list)).toEqual([]);
    await expectInputFocus(input);
    await userEvent.tab({ shift: true });
    await expectFocus(canvas.getByRole('button', { name: 'Remove תנועה' }));
    await expect(args.onValueChange).toHaveBeenCalledTimes(0);
  },
};

export const ForcedColors: Story = {
  args: { defaultValue: ['design', 'motion'] },
  parameters: { docs: { description: { story: 'Enable forced colors in the browser to check rendering (see docs/qa-gates.md). This check is manual.' } } },
};

export const ReducedMotion: Story = {
  args: { defaultValue: ['design', 'motion'] },
  parameters: { docs: { description: { story: 'Enable prefers-reduced-motion: reduce in the browser (see docs/qa-gates.md). This check is manual.' } } },
};

/** Replace the wrapper and generated label; pass native props through slotProps. */
// This story tests the documented css/slot API and native style merging.
const StyledTagInput = styled(TagInput)({ borderRadius: '9px' });
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
        sx: { borderRadius: '8px' },
      },
      label: { ref: fn(), title: 'generated part' },
    },
  },
  render: (args) => <StyledTagInput {...args} />,
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { TagInput, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const TopicsRoot = styled.div({ gap: vars.space[3] });
const TopicsLabel = styled.label({ fontWeight: vars.fontWeight.semibold });

<TagInput
  label="Topics"
  slots={{ root: TopicsRoot, label: TopicsLabel }}
  slotProps={{ root: { className: 'article-topics' }, label: { title: 'Article topics' } }}
/>`,
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
  parameters: { docs: { source: { language: 'tsx', code: `import { TagInput, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const TopicsRoot = styled.div({ gap: vars.space[3] });

<TagInput label="Topics" component={TopicsRoot} />` } } },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[data-slot-root="component"]')).not.toBeNull();
  },
};

export type TagInputSlotTypeRegression = {
  // @ts-expect-error Unknown structural keys are rejected.
  unknownSlot: NonNullable<import('./index').TagInputProps['slots']>['notASlot'];
  // @ts-expect-error Unknown prop keys are rejected.
  unknownSlotProps: NonNullable<import('./index').TagInputProps['slotProps']>['notASlot'];
};
