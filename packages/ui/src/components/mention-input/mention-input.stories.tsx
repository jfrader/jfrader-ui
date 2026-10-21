import {
  FieldReplacementRoot,
  FieldSugarRoot,
  FieldReplacementLabel,
  fieldRootStyles,
  expectFieldSlotCustomization,
} from '../../testing/field-slot-fixtures';
import { StrictMode, useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fireEvent, fn, waitFor, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { withLightTheme } from '../../testing/story-decorators';
import { ThemeRoot, type ThemeRootProps } from '../theme-root';
import {
  MentionInput,
  mentionText,
  serializeMentions,
  type MentionInputActions,
  type MentionInputProps,
  type MentionValue,
} from './index';
// `styled` is the app-facing styling API; consumers import it from `@jfrader/ui`.
import { styled } from '../../index';

const people = [
  { id: 'ada', name: 'Ada', role: 'Engineer' },
  { id: 'grace', name: 'Grace', role: 'Designer' },
  { id: 'rene', name: 'René', role: 'Researcher' },
];
const channels = [
  { id: 'general', name: 'general', description: 'Team updates', members: 1234 },
  { id: 'design', name: 'design', description: 'Design reviews' },
];
const mentionExampleData = `const people = [
  { id: 'ada', name: 'Ada', role: 'Engineer' },
  { id: 'grace', name: 'Grace', role: 'Designer' },
  { id: 'rene', name: 'René', role: 'Researcher' },
];
const channels = [
  { id: 'general', name: 'general', description: 'Team updates', members: 1234 },
  { id: 'design', name: 'design', description: 'Design reviews' },
];`;
const mentionExample = `import { MentionInput } from '@jfrader/ui';

${mentionExampleData}

<MentionInput label="Comment" placeholder="Write a comment" people={people} channels={channels} />`;
const TOKEN_VALUE: MentionValue = {
  text: '@Ada #general',
  mentions: [
    { kind: 'person', id: 'ada', label: 'Ada', start: 0, end: 4 },
    { kind: 'channel', id: 'general', label: 'general', start: 5, end: 13 },
  ],
};
const Frame = styled.div({ inlineSize: 'min(100%, 360px)', minInlineSize: 0 });
const Stack = styled.div({ display: 'grid', gap: vars.space[4] });
const Fixture = styled.button({
  minBlockSize: vars.space[8],
  padding: vars.space[2],
  color: vars.color.text,
  background: vars.color.surface,
  border: `1px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.sm,
});

const ScrollFrame = styled.div({ paddingBlockStart: '65vh' });
const ScrollContainmentFrame = styled.div({ paddingBlock: '50vh' });
function LightThemeScope(props: Omit<ThemeRootProps, 'theme'>) {
  return <ThemeRoot {...props} theme="light" />;
}
const LightThemeRoot = styled(LightThemeScope)({ background: vars.color.bg, padding: vars.space[4] });
const NarrowFrame = styled.div({ inlineSize: '160px', maxInlineSize: '100%' });
const meta = {
  title: 'Inputs/MentionInput',
  component: MentionInput,
  tags: ['autodocs'],
  args: {
    label: 'Comment',
    people,
    channels,
    placeholder: 'Write a comment',
    onValueChange: fn(),
    onMentionAdd: fn(),
    onOpenChange: fn(),
    onSubmit: fn(),
  },
  decorators: [
    (Story) => (
      <Frame>
        <Story />
      </Frame>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component: 'Write a message and mention people with @ or channels with #.',
      },
      sections: [
        { title: 'Basic', stories: ['Default', 'Controlled'] },
        { title: 'People and channels', stories: ['People', 'Channels'] },
        { title: 'Filtering and empty results', stories: ['SearchSuggestions'] },
        { title: 'Tokens', stories: ['AtomicTokens'] },
        { title: 'Long text', stories: ['MinMaxRows'] },
        { title: 'States', stories: ['MessageStates'] },
        { title: 'Keyboard and insertion', stories: ['Keyboard', 'Actions'] },
      ],
      usage: `### When to use
Write short messages that refer to people or channels. Use a document editor for long-form content.

### Keyboard and accessibility

- @ and # open suggestions at word boundaries.
- Up/Down moves through suggestions and wraps.
- Enter or unmodified Tab inserts the active result. Space and punctuation edit text.
- Shift+Tab leaves backward; Shift+Enter inserts a newline; Escape dismisses suggestions; Home/End move the caret.
- Without an active suggestion, Enter inserts a newline unless submission on Enter is enabled. Shift+Enter always inserts a newline.
- At a mention boundary, unmodified Left/Right jumps across the mention; Backspace/Delete removes it as a unit. Other text editing follows browser behavior.
- Suggestion and token shortcuts pause during IME composition.
- Give the textarea a visible label. Focus stays there while navigating suggestions.

### Saving messages

- Forms submit displayed text, not mention IDs. Save validated references separately when identity matters, and escape serialized output for your storage format.
- Treat text and mention ranges as one immutable value. Invalid ranges do not highlight or serialize as references; their plain text remains.

### Undo and limits

- Undo depends on the browser accepting the text insertion. If insertion uses the fallback, undo may not work.
- Edits, undo and redo drop mention ranges that were changed or no longer match. IDs are never inferred from labels; undo may not restore them.
- If you change text styles or padding, apply the same change to the input and mirror.
- Use for messages, not long documents.
- Undo across browsers and screen-reader support with NVDA/Firefox and VoiceOver/Safari still need manual checks.`,
    },
  },
} satisfies Meta<typeof MentionInput>;
export default meta;
type Story = StoryObj<typeof meta>;

function ControlledField(props: MentionInputProps) {
  const [value, setValue] = useState<MentionValue>(props.defaultValue ?? { text: '', mentions: [] });
  return (
    <MentionInput
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
function ActionField(props: MentionInputProps) {
  const actions = useRef<MentionInputActions | null>(null);
  const textarea = useRef<HTMLTextAreaElement | null>(null);
  return (
    <Stack>
      <MentionInput {...props} ref={textarea} actionsRef={actions} />
      <Fixture
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          textarea.current?.focus();
          actions.current?.insert('hello');
        }}
      >
        Insert text
      </Fixture>
      <Fixture
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => actions.current?.clear()}
      >
        Clear
      </Fixture>
      <Fixture
        onClick={() => {
          textarea.current?.focus();
          actions.current?.openSuggestions('person');
        }}
      >
        People
      </Fixture>
    </Stack>
  );
}
function RefFixture(props: MentionInputProps) {
  const [mounted, setMounted] = useState(true);
  return (
    <>
      {mounted && <MentionInput {...props} />}
      <Fixture onClick={() => setMounted(false)}>
        Unmount field
      </Fixture>
    </>
  );
}
const openPlay: Story['play'] = async ({ canvas, userEvent }) => {
  const input = canvas.getByRole('textbox', { name: 'Comment' });
  await userEvent.click(input);
  await userEvent.keyboard('{End}');
  await expect(input.closest('[role=combobox]')).toHaveAttribute('aria-expanded', 'true');
  const list = within(input.ownerDocument.body).getByRole('listbox');
  await waitFor(async () => {
    await expect(list).toBeVisible();
    await expect(getComputedStyle(list.parentElement!).opacity).toBe('1');
  });
};

function resolvedBorderColor(scope: Element, color: string): string {
  const probe = scope.ownerDocument.createElement('span');
  probe.style.borderColor = color;
  scope.append(probe);
  const resolved = getComputedStyle(probe).borderTopColor;
  probe.remove();
  return resolved;
}
const boundaryPlay: Story['play'] = async ({ canvas }) => {
  const input = canvas.getByRole('textbox', { name: 'Comment' });
  const shell = input.parentElement!;
  const mirror = shell.querySelector('[aria-hidden=true]')!;
  const inputStyles = getComputedStyle(input);
  const mirrorStyles = getComputedStyle(mirror);
  await expect(inputStyles.borderTopStyle).toBe('solid');
  await expect(inputStyles.borderTopColor).not.toBe('rgba(0, 0, 0, 0)');
  // The runner's real pointer can rest on the field; hover swaps the boundary to its hover token.
  await waitFor(async () => {
    const boundary = input.matches(':hover') ? vars.color.textSubtle : vars.color.borderControl;
    await expect(inputStyles.borderTopColor).toBe(resolvedBorderColor(shell, boundary));
  });
  await expect(mirrorStyles.borderTopWidth).toBe(inputStyles.borderTopWidth);
  await expect(mirrorStyles.borderTopLeftRadius).toBe(inputStyles.borderTopLeftRadius);
  await expect(getComputedStyle(shell).borderTopLeftRadius).toBe(inputStyles.borderTopLeftRadius);
};

export const Default: Story = {
  name: 'Write a comment',
  parameters: { docs: {
    description: { story: 'Type @ for people or # for channels, then choose a suggestion.' },
    source: { language: 'tsx', code: mentionExample },
  } },
  play: boundaryPlay,
};
export const People: Story = {
  name: 'Mention people',
  parameters: { docs: {
    description: { story: 'Type @ to find a teammate by name and see their role.' },
    source: { language: 'tsx', code: `import { MentionInput } from '@jfrader/ui';

<MentionInput label="Comment" placeholder="Write a comment" people={[
  { id: 'ada', name: 'Ada', role: 'Engineer' },
  { id: 'grace', name: 'Grace', role: 'Designer' },
  { id: 'rene', name: 'René', role: 'Researcher' },
]} />` },
  } },
  args: { channels: undefined },
};
export const Channels: Story = {
  name: 'Mention channels',
  parameters: { docs: {
    description: { story: 'Type # to find a channel with its description and member count.' },
    source: { language: 'tsx', code: `import { MentionInput } from '@jfrader/ui';

<MentionInput label="Comment" placeholder="Write a comment" channels={[
  { id: 'general', name: 'general', description: 'Team updates', members: 1234 },
  { id: 'design', name: 'design', description: 'Design reviews' },
]} />` },
  } },
  args: { people: undefined },
};
export const SearchSuggestions: Story = {
  name: 'Filter suggestions',
  parameters: { docs: {
    description: { story: 'Type @a to filter people, then @zzz to see an empty result list.' },
    source: { language: 'tsx', code: mentionExample },
  } },
};
export const MessageStates: Story = {
  name: 'Disabled and invalid messages',
  parameters: { docs: {
    description: { story: 'Show a disabled message beside an editable message with a validation error.' },
    source: { language: 'tsx', code: `import { MentionInput, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

${mentionExampleData}

const Fields = styled.div({ display: 'grid', gap: vars.space[4] });

<Fields>
  <MentionInput label="Archived comment" placeholder="Write a comment" people={people} channels={channels}
    disabled defaultValue={{ text: 'Thread closed.', mentions: [] }} />
  <MentionInput label="Comment" placeholder="Write a comment" people={people} channels={channels}
    description="Mention a teammate with @." error="Write a comment before posting." />
</Fields>` },
  } },
  render: () => (
    <Stack>
      <MentionInput label="Archived comment" placeholder="Write a comment" people={people} channels={channels}
        disabled defaultValue={{ text: 'Thread closed.', mentions: [] }} />
      <MentionInput label="Comment" placeholder="Write a comment" people={people} channels={channels}
        description="Mention a teammate with @." error="Write a comment before posting." />
    </Stack>
  ),
};
export const Both: Story = {};
export const Metadata: Story = {
  tags: ['!autodocs'],
  args: {
    defaultValue: { text: '@', mentions: [] },
    defaultOpen: true,
    channels: [...channels, { id: 'random', name: 'random', members: 42000 }],
  },
  play: async (context) => {
    await openPlay(context);
    const { canvas, userEvent } = context;
    const body = within(canvas.getByRole('textbox').ownerDocument.body);
    await expect(within(body.getByRole('option', { name: /Ada/ })).getByText('Engineer')).toBeVisible();
    await expect(within(body.getByRole('option', { name: /René/ })).getByText('Researcher')).toBeVisible();
    await userEvent.keyboard('{Backspace}#');
    const list = await body.findByRole('listbox', { name: 'Channels' });
    await expect(within(list).getAllByRole('option')).toHaveLength(3);
    await expect(within(list).getByRole('option', { name: /general/ })).toHaveTextContent('Team updates');
    await expect(within(list).getByRole('option', { name: /random/ })).toHaveTextContent(
      new Intl.NumberFormat().format(42000),
    );
  },
};
export const Controlled: Story = {
  name: 'Controlled comment',
  parameters: { docs: { description: { story: 'Keep the message text and mention ranges together in application state.' }, source: { language: 'tsx', code: `import { useState } from 'react';
import { MentionInput, type MentionValue } from '@jfrader/ui';

${mentionExampleData}

function CommentEditor() {
  const [value, setValue] = useState<MentionValue>({ text: '', mentions: [] });
  return (
    <MentionInput
      label="Comment"
      placeholder="Write a comment"
      people={people}
      channels={channels}
      value={value}
      onValueChange={setValue}
    />
  );
}` } } },
  render: (args) => <ControlledField {...args} />,
  play: async ({ canvas, userEvent, args }) => {
    const input = canvas.getByRole('textbox');
    await userEvent.click(input);
    await userEvent.type(input, '@a');
    await userEvent.keyboard('{Enter}');
    await expect(input).toHaveValue('@Ada ');
    await expect(args.onMentionAdd).toHaveBeenCalledTimes(1);
    await expect(args.onMentionAdd).toHaveBeenCalledWith({
      kind: 'person',
      id: 'ada',
      label: 'Ada',
      start: 0,
      end: 4,
    });
  },
};
export const Sizes: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `<>
  <MentionInput label="Small comment" size="sm" people={[{ id: 'ada', name: 'Ada' }]} />
  <MentionInput label="Medium comment" size="md" people={[{ id: 'ada', name: 'Ada' }]} />
  <MentionInput label="Large comment" size="lg" people={[{ id: 'ada', name: 'Ada' }]} />
</>` } } },
  render: (args) => (
    <Stack>
      {(['sm', 'md', 'lg'] as const).map((size) => (
        <MentionInput {...args} key={size} label={size} size={size} />
      ))}
    </Stack>
  ),
};
export const MinMaxRows: Story = {
  name: 'Scroll a longer message',
  parameters: { docs: {
    description: { story: 'Grow from two to three rows, then scroll the remaining message.' },
    source: { language: 'tsx', code: `import { MentionInput } from '@jfrader/ui';

${mentionExampleData}

<MentionInput label="Comment" placeholder="Write a comment" people={people} channels={channels}
  minRows={2} maxRows={3} defaultValue={{ text: 'One\\nTwo\\nThree\\nFour\\nFive\\nSix', mentions: [] }} />` },
  } },
  args: { minRows: 2, maxRows: 3, defaultValue: { text: 'One\nTwo\nThree\nFour\nFive\nSix', mentions: [] } },
  play: async ({ canvas }) => {
    const input = canvas.getByRole('textbox');
    const styles = getComputedStyle(input);
    await expect(input.clientHeight).toBeLessThanOrEqual(
      3 * parseFloat(styles.lineHeight) +
        parseFloat(styles.paddingTop) +
        parseFloat(styles.paddingBottom) +
        1,
    );
    await expect(input.scrollHeight).toBeGreaterThan(input.clientHeight);
  },
};
export const SubmitOnEnter: Story = {
  args: { submitOnEnter: true },
  parameters: { docs: { source: { language: 'tsx', code: `import { MentionInput, serializeMentions } from '@jfrader/ui';

<MentionInput
  label="Comment"
  people={[{ id: 'ada', name: 'Ada' }]}
  submitOnEnter
  onSubmit={async (value) => {
    await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: serializeMentions(value) }),
    });
  }}
/>` } } },
  play: async ({ canvas, userEvent, args }) => {
    const input = canvas.getByRole('textbox');
    await userEvent.click(input);
    await userEvent.keyboard('{Enter}');
    await expect(args.onSubmit).not.toHaveBeenCalled();
    await userEvent.type(input, 'Hello');
    await userEvent.keyboard('{Enter}');
    await expect(args.onSubmit).toHaveBeenCalledTimes(1);
    await expect(args.onSubmit).toHaveBeenCalledWith({ text: 'Hello', mentions: [] });
    fireEvent.keyDown(input, { key: 'Enter', repeat: true });
    await expect(args.onSubmit).toHaveBeenCalledTimes(1);
    await userEvent.keyboard('{Shift>}{Enter}{/Shift}');
    await expect(input).toHaveValue('Hello\n');
  },
};
export const PersistentOpen: Story = {
  tags: ['!autodocs'],
  args: { defaultValue: { text: '@', mentions: [] }, open: true },
  play: openPlay,
};
export const EmptyResults: Story = {
  tags: ['!autodocs'],
  args: { defaultValue: { text: '@zzz', mentions: [] }, open: true },
  play: async (context) => {
    await openPlay(context);
    const input = context.canvas.getByRole('textbox');
    await expect(input).not.toHaveAttribute('aria-activedescendant');
    await context.userEvent.keyboard('{ArrowDown}{ArrowUp}');
    await expect(input).not.toHaveAttribute('aria-activedescendant');
  },
};
export const TopPlacement: Story = {
  tags: ['!autodocs'],
  args: { placement: 'top', defaultValue: { text: '#', mentions: [] }, defaultOpen: true },
  play: openPlay,
};
export const BottomPlacement: Story = {
  tags: ['!autodocs'],
  args: { placement: 'bottom', defaultValue: { text: '@', mentions: [] }, defaultOpen: true },
  play: openPlay,
};
export const BottomViewportAutoFlip: Story = {
  tags: ['!autodocs'],
  args: { defaultValue: { text: '@', mentions: [] }, defaultOpen: true },
  decorators: [
    (Story) => (
      <ScrollFrame>
        <Story />
      </ScrollFrame>
    ),
  ],
  play: openPlay,
};
export const Disabled: Story = {
  tags: ['!autodocs'],
  args: { disabled: true, defaultValue: TOKEN_VALUE, open: true },
  play: async ({ canvas }) => {
    const input = canvas.getByRole('textbox');
    await expect(input).toBeDisabled();
    await expect(getComputedStyle(input.parentElement!).opacity).toBe('0.55');
    await expect(getComputedStyle(input).opacity).toBe('1');
    await expect(canvas.getByRole('combobox')).toHaveAttribute('aria-expanded', 'false');
  },
};
export const ReadOnly: Story = {
  args: { readOnly: true, defaultValue: TOKEN_VALUE },
  parameters: { docs: { source: { language: 'tsx', code: `<MentionInput
  label="Comment"
  readOnly
  defaultValue={{
    text: '@Ada #general',
    mentions: [
      { kind: 'person', id: 'ada', label: 'Ada', start: 0, end: 4 },
      { kind: 'channel', id: 'general', label: 'general', start: 5, end: 13 },
    ],
  }}
/>` } } },
  render: (args) => <ActionField {...args} />,
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Insert text' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Clear' }));
    await expect(canvas.getByRole('textbox')).toHaveValue(TOKEN_VALUE.text);
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};
export const Required: Story = {
  args: { required: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('textbox')).toBeRequired();
  },
};
export const Error: Story = {
  tags: ['!autodocs'],
  args: {
    error: 'Write a comment before posting.',
    description: 'Mention a teammate with @.',
    defaultValue: { text: '@', mentions: [] },
    open: true,
  },
  play: async (context) => {
    await openPlay(context);
    await expect(context.canvas.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
  },
};
export const ExternalAria: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import { useId } from 'react';
import { MentionInput } from '@jfrader/ui';

function ThreadComment() {
  const labelId = useId();
  const descriptionId = useId();
  return (
    <>
      <span id={labelId}>Thread</span>
      <span id={descriptionId}>External details</span>
      <MentionInput
        label="Comment"
        aria-labelledby={labelId}
        aria-describedby={descriptionId}
        description="Comment details"
        error="Required"
        people={[{ id: 'ada', name: 'Ada' }]}
      />
    </>
  );
}` } } },
  args: {
    'aria-label': 'Custom comment',
    'aria-labelledby': 'external-label',
    'aria-describedby': 'external-description unresolved',
    description: 'Comment details',
    error: 'Required',
  },
  render: (args) => (
    <>
      <span id="external-label">Thread</span>
      <span id="external-description">External details</span>
      <MentionInput {...args} />
    </>
  ),
  play: async ({ canvas }) => {
    const input = canvas.getByRole('textbox', { name: 'Thread Comment' });
    await expect(input).toHaveAttribute('aria-label', 'Custom comment');
    await expect(input.getAttribute('aria-describedby')).toContain('external-description unresolved');
    await expect(input).toHaveAccessibleDescription('External details Comment details Required');
  },
};
export const BooleanAndZeroNodes: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `<>
  <MentionInput aria-label="Comment 1" label={false} description={false} error={false} />
  <MentionInput aria-label="Comment 2" label={null} description={null} error={null} />
  <MentionInput aria-label="Comment 3" label={0} description={0} error={0} />
  <MentionInput aria-label="Comment 4" label="" description="" error="" />
</>` } } },
  render: (args) => (
    <Stack>
      {([false, null, 0, ''] as const).map((node, index) => (
        <MentionInput
          {...args}
          key={index}
          label={node}
          description={node}
          error={node}
          aria-label={`Comment ${index}`}
        />
      ))}
    </Stack>
  ),
  play: async ({ canvas }) => {
    const inputs = canvas.getAllByRole('textbox');
    for (const [index, input] of inputs.entries()) {
      if (index >= 2) await expect(input).toHaveAttribute('aria-invalid', 'true');
      else await expect(input).not.toHaveAttribute('aria-invalid');
    }
  },
};

export const Keyboard: Story = {
  name: 'Insert suggestions with the keyboard',
  args: { submitOnEnter: true },
  parameters: { docs: { description: { story: 'Type @, move with the arrow keys and insert with Enter or Tab without leaving the message.' }, source: { language: 'tsx', code: `import { Button, MentionInput } from '@jfrader/ui';

${mentionExampleData}

<>
  <Button>Before</Button>
  <MentionInput
    label="Comment"
    placeholder="Write a comment"
    people={people}
    channels={channels}
    submitOnEnter
    onSubmit={async (value) => {
      await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(value),
      });
    }}
  />
  <Button>After</Button>
</>` } } },
  render: (args) => (
    <>
      <Fixture>Before</Fixture>
      <MentionInput {...args} />
      <Fixture>After</Fixture>
    </>
  ),
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.tab();
    await userEvent.tab();
    const input = canvas.getByRole('textbox');
    await expect(input.ownerDocument.activeElement).toBe(input);
    await expect(getComputedStyle(input).outlineStyle).not.toBe('none');
    await userEvent.type(input, '@');
    const body = within(input.ownerDocument.body);
    await waitFor(async () => {
      await expect(body.getByRole('listbox', { name: 'People' })).toBeVisible();
    });
    await userEvent.keyboard('{ArrowUp}');
    await expect(input.getAttribute('aria-activedescendant')).toBe(
      body.getByRole('option', { name: /^René/ }).id,
    );
    await userEvent.keyboard('{ArrowDown}{Enter}');
    await expect(input).toHaveValue('@Ada ');
    await expect(args.onMentionAdd).toHaveBeenCalledTimes(1);
    await expect(args.onSubmit).not.toHaveBeenCalled();
    await expect(input.ownerDocument.activeElement).toBe(input);
    // Resync the synthetic keyboard's value tracker after a native insertion. Real
    // browser keys are checked separately; this unchanged input must not notify twice.
    (input as HTMLTextAreaElement).value = (input as HTMLTextAreaElement).value;
    await userEvent.keyboard('#{Tab}');
    await expect(input).toHaveValue('@Ada #design ');
    await expect(args.onMentionAdd).toHaveBeenCalledTimes(2);
    (input as HTMLTextAreaElement).value = (input as HTMLTextAreaElement).value;
    await userEvent.keyboard('@ ');
    await expect(input).toHaveValue('@Ada #design @ ');
    await expect(args.onMentionAdd).toHaveBeenCalledTimes(2);
    await userEvent.keyboard('@{Escape}');
    await expect(input.closest('[role=combobox]')).toHaveAttribute('aria-expanded', 'false');
    await userEvent.keyboard('a');
    await expect(input.closest('[role=combobox]')).toHaveAttribute('aria-expanded', 'true');
    await userEvent.tab({ shift: true });
    await expect(input.ownerDocument.activeElement).toBe(canvas.getByRole('button', { name: 'Before' }));
    await expect(args.onMentionAdd).toHaveBeenCalledTimes(2);
  },
};
export const TriggerBoundaries: Story = {
  play: async ({ canvas, userEvent, args }) => {
    const input = canvas.getByRole('textbox');
    await userEvent.click(input);
    for (const text of ['me@ada', 'https://site/@ada', 'word#general']) {
      await userEvent.clear(input);
      await userEvent.type(input, text);
      await expect(input.closest('[role=combobox]')).toHaveAttribute('aria-expanded', 'false');
    }
    for (const text of ['(@a', '"@a', '\n#d']) {
      await userEvent.clear(input);
      await userEvent.type(input, text);
      await expect(input.closest('[role=combobox]')).toHaveAttribute('aria-expanded', 'true');
    }
    await expect(args.onMentionAdd).not.toHaveBeenCalled();
  },
};
export const AtomicTokens: Story = {
  name: 'Edit mention tokens',
  parameters: { docs: {
    description: { story: 'Place the caret after @Ada and press Backspace to remove the whole mention.' },
    source: { language: 'tsx', code: `import { MentionInput } from '@jfrader/ui';

${mentionExampleData}

<MentionInput label="Comment" placeholder="Write a comment" people={people} channels={channels}
  defaultValue={{
    text: '@Ada #general',
    mentions: [
      { kind: 'person', id: 'ada', label: 'Ada', start: 0, end: 4 },
      { kind: 'channel', id: 'general', label: 'general', start: 5, end: 13 },
    ],
  }} />` },
  } },
  args: { defaultValue: TOKEN_VALUE },
  play: async ({ canvas, userEvent, args }) => {
    const input = canvas.getByRole('textbox') as HTMLTextAreaElement;
    await userEvent.click(input);
    input.setSelectionRange(4, 4);
    fireEvent.select(input);
    await userEvent.keyboard('{Backspace}');
    await expect(input).toHaveValue(' #general');
    await expect(args.onValueChange).toHaveBeenLastCalledWith({
      text: ' #general',
      mentions: [{ kind: 'channel', id: 'general', label: 'general', start: 1, end: 9 }],
    });
    input.setSelectionRange(1, 1);
    fireEvent.select(input);
    await userEvent.keyboard('{ArrowRight}');
    await expect(input.selectionStart).toBe(9);
    await userEvent.keyboard('{ArrowLeft}');
    await expect(input.selectionStart).toBe(1);
    input.setSelectionRange(3, 3);
    fireEvent.select(input);
    await expect(input.selectionStart).toBe(1);
    input.setSelectionRange(2, 5, 'backward');
    fireEvent.select(input);
    await expect(input.selectionStart).toBe(1);
    await expect(input.selectionEnd).toBe(9);
    await expect(input.selectionDirection).toBe('backward');
    input.setSelectionRange(1, 1);
    fireEvent.select(input);
    await userEvent.keyboard('{Delete}');
    await expect(input).toHaveValue(' ');
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
  },
};
export const UnicodeOffsets: Story = {
  args: { defaultValue: { text: '😀 é @', mentions: [] } },
  play: async ({ canvas, userEvent, args }) => {
    const input = canvas.getByRole('textbox');
    await userEvent.click(input);
    await userEvent.keyboard('{End}a{Enter}');
    await expect(args.onMentionAdd).toHaveBeenCalledTimes(1);
    await expect(args.onMentionAdd).toHaveBeenCalledWith({
      kind: 'person',
      id: 'ada',
      label: 'Ada',
      start: 6,
      end: 10,
    });
    await expect(input).toHaveValue('😀 é @Ada ');
    await expect(
      serializeMentions({
        text: '😀 é @Ada',
        mentions: [{ kind: 'person', id: 'ada', label: 'Ada', start: 6, end: 10 }],
      }),
    ).toBe('😀 é <@ada>');
  },
};
export const UndoRedo: Story = {
  play: async ({ canvas, userEvent, args }) => {
    const input = canvas.getByRole('textbox');
    await userEvent.click(input);
    await userEvent.type(input, '@a');
    await userEvent.keyboard('{Enter}');
    await expect(input).toHaveValue('@Ada ');
    await userEvent.keyboard('{Control>}z{/Control}');
    // Storybook's synthetic keyboard cannot execute browser history shortcuts. Exercise
    // Chromium's native history explicitly; trusted Ctrl+Z is checked in browser QA.
    input.ownerDocument.execCommand('undo');
    await waitFor(async () => {
      await expect(input).toHaveValue('@a');
    });
    await expect(args.onValueChange).toHaveBeenLastCalledWith({ text: '@a', mentions: [] });
    await userEvent.keyboard('{Control>}{Shift>}z{/Shift}{/Control}');
    input.ownerDocument.execCommand('redo');
    await waitFor(async () => {
      await expect(input).toHaveValue('@Ada ');
    });
    await expect(args.onValueChange).toHaveBeenLastCalledWith({ text: '@Ada ', mentions: [] });
  },
};
export const ControlledReject: Story = {
  tags: ['!autodocs'],
  args: { value: { text: '@a', mentions: [] }, open: true },
  render: (args) => <ActionField {...args} />,
  play: async ({ canvas, userEvent, args }) => {
    const input = canvas.getByRole('textbox') as HTMLTextAreaElement;
    await userEvent.click(input);
    await userEvent.keyboard('{End}{Enter}');
    await expect(input).toHaveValue('@a');
    await expect(input.selectionStart).toBe(2);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onMentionAdd).toHaveBeenCalledTimes(1);
    await userEvent.click(canvas.getByRole('button', { name: 'Clear' }));
    await expect(input).toHaveValue('@a');
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
  },
};
export const ControlledOpenReject: Story = {
  tags: ['!autodocs'],
  args: { value: { text: '@', mentions: [] }, open: true },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('textbox'));
    await userEvent.keyboard('{End}{Escape}');
    await expect(canvas.getByRole('combobox')).toHaveAttribute('aria-expanded', 'true');
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenCalledWith(false);
  },
};
export const FormReset: Story = {
  args: { defaultValue: TOKEN_VALUE, name: 'comment' },
  parameters: { docs: { source: { language: 'tsx', code: `import { Button, MentionInput } from '@jfrader/ui';

<form aria-label="Comment form">
  <MentionInput
    label="Comment"
    name="comment"
    people={[{ id: 'ada', name: 'Ada' }]}
    defaultValue={{
      text: '@Ada',
      mentions: [{ kind: 'person', id: 'ada', label: 'Ada', start: 0, end: 4 }],
    }}
  />
  <Button type="reset">Reset</Button>
</form>` } } },
  render: (args) => (
    <form aria-label="Comment form">
      <MentionInput {...args} />
      <Fixture type="reset">
        Reset
      </Fixture>
    </form>
  ),
  play: async ({ canvas, userEvent, args }) => {
    const input = canvas.getByRole('textbox');
    await userEvent.click(input);
    await userEvent.keyboard('{End}!');
    await expect(new FormData(canvas.getByRole('form') as HTMLFormElement).get('comment')).toBe(
      '@Ada #general!',
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Reset' }));
    await waitFor(async () => {
      await expect(input).toHaveValue(TOKEN_VALUE.text);
    });
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
  },
};
export const Composition: Story = {
  args: { submitOnEnter: true },
  play: async ({ canvas, userEvent, args }) => {
    const input = canvas.getByRole('textbox');
    await userEvent.click(input);
    await userEvent.type(input, '@a');
    fireEvent.compositionStart(input);
    for (const key of [
      'Enter',
      'Tab',
      'ArrowUp',
      'ArrowDown',
      'ArrowLeft',
      'ArrowRight',
      'Escape',
      'Backspace',
      'Delete',
    ]) {
      const event = new KeyboardEvent('keydown', { key, code: key, bubbles: true, cancelable: true });
      fireEvent(input, event);
      await expect(event.defaultPrevented).toBe(false);
    }
    fireEvent.keyDown(input, { key: 'z', ctrlKey: true, isComposing: true });
    await expect(input).toHaveValue('@a');
    await expect(input).not.toHaveAttribute('aria-activedescendant');
    await expect(args.onMentionAdd).not.toHaveBeenCalled();
    await expect(args.onSubmit).not.toHaveBeenCalled();
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    fireEvent.compositionEnd(input);
    await expect(input).toHaveValue('@a');
    await expect(input).toHaveAttribute('aria-activedescendant');
  },
};
export const Helpers: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import { mentionText, serializeMentions, type MentionValue } from '@jfrader/ui';

const label = 'Ada';
const text = mentionText('person', label);
const value: MentionValue = {
  text,
  mentions: [{ kind: 'person', id: 'ada', label, start: 0, end: text.length }],
};

const referenceText = serializeMentions(value);
const customReferenceText = serializeMentions(value, (mention) =>
  '[' + mention.kind + ':' + mention.id + ']',
);` } } },
  play: async () => {
    await expect(mentionText('person', 'Ada')).toBe('@Ada');
    await expect(serializeMentions(TOKEN_VALUE)).toBe('<@ada> <#general>');
    await expect(serializeMentions(TOKEN_VALUE, (mention) => `[${mention.kind}:${mention.id}]`)).toBe(
      '[person:ada] [channel:general]',
    );
    await expect(
      serializeMentions({ text: '@Ada', mentions: [{ ...TOKEN_VALUE.mentions[0]!, end: 40 }] }),
    ).toBe('@Ada');
  },
};
export const Actions: Story = {
  name: 'Insert text from an action',
  parameters: { docs: { description: { story: 'Insert text at the caret, clear the message or open people suggestions from a button.' }, source: { language: 'tsx', code: `import { useRef } from 'react';
import { Button, MentionInput, type MentionInputActions } from '@jfrader/ui';

${mentionExampleData}

function CommentEditor() {
  const actions = useRef<MentionInputActions | null>(null);
  const textarea = useRef<HTMLTextAreaElement | null>(null);
  return (
    <>
      <MentionInput
        label="Comment"
        placeholder="Write a comment"
        people={people}
        channels={channels}
        ref={textarea}
        actionsRef={actions}
      />
      <Button onMouseDown={(event) => event.preventDefault()} onClick={() => {
        textarea.current?.focus();
        actions.current?.insert('hello');
      }}>Insert text</Button>
      <Button onMouseDown={(event) => event.preventDefault()} onClick={() => actions.current?.clear()}>Clear</Button>
      <Button onClick={() => {
        textarea.current?.focus();
        actions.current?.openSuggestions('person');
      }}>People</Button>
    </>
  );
}` } } },
  render: (args) => <ActionField {...args} />,
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Insert text' }));
    await expect(canvas.getByRole('textbox')).toHaveValue('hello');
    await userEvent.click(canvas.getByRole('button', { name: 'Clear' }));
    await expect(canvas.getByRole('textbox')).toHaveValue('');
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
  },
};
export const LightTheme: Story = {
  args: { defaultValue: TOKEN_VALUE },
  parameters: { docs: { source: { language: 'tsx', code: `import { MentionInput, ThemeRoot } from '@jfrader/ui';

<ThemeRoot theme="light">
  <MentionInput
    label="Comment"
    people={[{ id: 'ada', name: 'Ada' }]}
    channels={[{ id: 'general', name: 'general' }]}
    defaultValue={{
      text: '@Ada #general',
      mentions: [
        { kind: 'person', id: 'ada', label: 'Ada', start: 0, end: 4 },
        { kind: 'channel', id: 'general', label: 'general', start: 5, end: 13 },
      ],
    }}
  />
</ThemeRoot>` } } },
  globals: { theme: 'light' },
  decorators: [withLightTheme],
  play: boundaryPlay,
};
export const ScopedThemePortal: Story = {
  tags: ['!autodocs'],
  args: { defaultValue: { text: '@', mentions: [] }, open: true },
  render: (args) => (
    <LightThemeRoot>
      <MentionInput {...args} />
    </LightThemeRoot>
  ),
  play: async (context) => {
    await openPlay(context);
    const list = within(context.canvas.getByRole('textbox').ownerDocument.body).getByRole('listbox');
    await expect(list.closest('[data-theme]')).toHaveAttribute('data-theme', 'light');
  },
};
export const RTL: Story = {
  args: { dir: 'rtl', people: [{ id: 'noa', name: 'נועה' }], defaultValue: { text: 'שלום @', mentions: [] } },
  play: async ({ canvas, userEvent, args }) => {
    const input = canvas.getByRole('textbox');
    await userEvent.click(input);
    await userEvent.keyboard('{End}{Enter}');
    await expect(input).toHaveValue('שלום @נועה ');
    await expect(args.onMentionAdd).toHaveBeenCalledTimes(1);
    await expect(args.onMentionAdd).toHaveBeenCalledWith({
      kind: 'person',
      id: 'noa',
      label: 'נועה',
      start: 5,
      end: 10,
    });
  },
};
export const ForcedColors: Story = {
  args: { defaultValue: TOKEN_VALUE },
  parameters: {
    docs: {
      description: {
        story:
          'With forced colors, textarea text replaces the tint mirror. Check this in a browser; this test does not emulate forced colors.',
      },
    },
  },
};
export const ReducedMotion: Story = {
  tags: ['!autodocs'],
  args: { defaultValue: { text: '@', mentions: [] }, open: true },
  play: openPlay,
  parameters: {
    docs: {
      description: {
        story:
          'With prefers-reduced-motion, the popup changes without a transition. Check this in a browser; this test does not emulate the preference.',
      },
    },
  },
};
export const NarrowPanel: Story = {
  tags: ['!autodocs'],
  args: { defaultValue: { text: '@', mentions: [] }, open: true },
  decorators: [
    (Story) => (
      <NarrowFrame>
        <Story />
      </NarrowFrame>
    ),
  ],
  play: async (context) => {
    await openPlay(context);
    const input = context.canvas.getByRole('textbox');
    const list = within(input.ownerDocument.body).getByRole('listbox');
    await waitFor(async () => {
      await expect(list.getBoundingClientRect().width).toBeLessThanOrEqual(
        input.getBoundingClientRect().width + 1,
      );
    });
    await expect(input.ownerDocument.documentElement.scrollWidth).toBeLessThanOrEqual(
      input.ownerDocument.documentElement.clientWidth,
    );
  },
};

export const ScrolledSuggestions: Story = {
  args: {
    maxRows: 3,
    defaultValue: { text: `${'Earlier message line\n'.repeat(24)}@`, mentions: [] },
    open: true,
  },
  play: async (context) => {
    await openPlay(context);
    const input = context.canvas.getByRole('textbox') as HTMLTextAreaElement;
    const body = within(input.ownerDocument.body);
    const panel = body.getByRole('listbox').parentElement!;
    input.scrollTop = 0;
    fireEvent.scroll(input);
    await new Promise<void>((resolve) => {
      input.ownerDocument.defaultView!.requestAnimationFrame(() => {
        input.ownerDocument.defaultView!.requestAnimationFrame(() => resolve());
      });
    });
    await expect(input.scrollTop).toBe(0);
    await waitFor(async () => {
      const field = input.getBoundingClientRect();
      const popup = panel.getBoundingClientRect();
      await expect(popup.top - field.bottom).toBeLessThanOrEqual(9);
      await expect(field.top - popup.bottom).toBeLessThanOrEqual(9);
      await expect(popup.left).toBeGreaterThanOrEqual(7);
      await expect(popup.right).toBeLessThanOrEqual(input.ownerDocument.documentElement.clientWidth - 7);
    });
    for (const option of body.getAllByRole('option')) {
      await expect(option.getBoundingClientRect().height).toBeGreaterThanOrEqual(32);
    }
    await context.userEvent.click(body.getByRole('option', { name: /Ada/ }));
    await expect(input).toHaveValue(`${'Earlier message line\n'.repeat(24)}@Ada `);
    await expect(input).toHaveFocus();
  },
};

export const ScrollableSuggestions: Story = {
  tags: ['!autodocs'],
  args: {
    defaultValue: { text: '@', mentions: [] },
    open: true,
    maxSuggestions: 12,
    people: Array.from({ length: 12 }, (_, index) => ({
      id: `person-${index}`,
      name: `Teammate ${index.toString().padStart(2, '0')}`,
      role: 'International research and accessibility',
    })),
    slotProps: { panel: { sx: { blockSize: '160px' } } },
  },
  decorators: [(Story) => <ScrollContainmentFrame><Story /></ScrollContainmentFrame>],
  play: async (context) => {
    await openPlay(context);
    const input = context.canvas.getByRole('textbox');
    const body = within(input.ownerDocument.body);
    const panel = body.getByRole('listbox').parentElement!;
    await expect(panel.scrollHeight).toBeGreaterThan(panel.clientHeight);
    await expect(getComputedStyle(panel).overscrollBehaviorY).toBe('contain');
    for (let index = 0; index < 11; index++) await context.userEvent.keyboard('{ArrowDown}');
    await waitFor(async () => {
      const active = input.ownerDocument.getElementById(input.getAttribute('aria-activedescendant')!)!;
      const option = active.getBoundingClientRect();
      const popup = panel.getBoundingClientRect();
      await expect(option.top).toBeGreaterThanOrEqual(popup.top);
      await expect(option.bottom).toBeLessThanOrEqual(popup.bottom);
    });
    await expect(input).toHaveFocus();
  },
};

export const EditReconciliation: Story = {
  args: { defaultValue: TOKEN_VALUE },
  play: async ({ canvas, userEvent, args }) => {
    const input = canvas.getByRole('textbox') as HTMLTextAreaElement;
    await userEvent.click(input);
    input.setSelectionRange(0, 0);
    await userEvent.keyboard('😀 ');
    await expect(args.onValueChange).toHaveBeenLastCalledWith({
      text: '😀 @Ada #general',
      mentions: [
        { kind: 'person', id: 'ada', label: 'Ada', start: 3, end: 7 },
        { kind: 'channel', id: 'general', label: 'general', start: 8, end: 16 },
      ],
    });
    fireEvent.input(input, { target: { value: '😀 @Axa #general', selectionStart: 6, selectionEnd: 6 } });
    await expect(args.onValueChange).toHaveBeenLastCalledWith({
      text: '😀 @Axa #general',
      mentions: [{ kind: 'channel', id: 'general', label: 'general', start: 8, end: 16 }],
    });
    fireEvent.input(input, { target: { value: '😀 @Ada #general', selectionStart: 6, selectionEnd: 6 } });
    await expect(args.onValueChange).toHaveBeenLastCalledWith({
      text: '😀 @Ada #general',
      mentions: [{ kind: 'channel', id: 'general', label: 'general', start: 8, end: 16 }],
    });
    await expect(args.onMentionAdd).not.toHaveBeenCalled();
  },
};
export const DuplicateOccurrences: Story = {
  args: {
    defaultValue: {
      text: '@Ada @Ada',
      mentions: [
        { kind: 'person', id: 'ada', label: 'Ada', start: 0, end: 4 },
        { kind: 'person', id: 'ada', label: 'Ada', start: 5, end: 9 },
      ],
    },
  },
  play: async ({ canvas, userEvent, args }) => {
    const input = canvas.getByRole('textbox') as HTMLTextAreaElement;
    await userEvent.click(input);
    input.setSelectionRange(0, 0);
    await userEvent.keyboard('{Delete}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith({
      text: ' @Ada',
      mentions: [{ kind: 'person', id: 'ada', label: 'Ada', start: 1, end: 5 }],
    });
  },
};
export const PlainPaste: Story = {
  play: async ({ canvas, userEvent, args }) => {
    const input = canvas.getByRole('textbox');
    await userEvent.click(input);
    await userEvent.paste('@Ada #general');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith({ text: '@Ada #general', mentions: [] });
    await expect(args.onMentionAdd).not.toHaveBeenCalled();
  },
};
export const CallbackOrder: Story = {
  tags: ['!autodocs'],
  args: { defaultValue: { text: '@', mentions: [] }, defaultOpen: true },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('textbox'));
    await userEvent.keyboard('{End}{Enter}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onMentionAdd).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenCalledWith(false);
    await expect(args.onValueChange!.mock.invocationCallOrder[0]).toBeLessThan(
      args.onMentionAdd!.mock.invocationCallOrder[0]!,
    );
    await expect(args.onMentionAdd!.mock.invocationCallOrder[0]).toBeLessThan(
      args.onOpenChange!.mock.invocationCallOrder[0]!,
    );
  },
};
export const NativeRef: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import { useRef, useState } from 'react';
import { Button, MentionInput } from '@jfrader/ui';

function CommentEditor() {
  const textarea = useRef<HTMLTextAreaElement | null>(null);
  const [mounted, setMounted] = useState(true);
  return (
    <>
      {mounted && <MentionInput label="Comment" ref={textarea} />}
      <Button onClick={() => textarea.current?.focus()}>Focus comment</Button>
      <Button onClick={() => setMounted(false)}>Remove comment</Button>
    </>
  );
}` } } },
  args: { ref: fn((element: HTMLTextAreaElement | null) => (element ? fn() : undefined)), actionsRef: fn() },
  render: (args) => (
    <StrictMode>
      <RefFixture {...args} />
    </StrictMode>
  ),
  play: async ({ canvas, args, userEvent }) => {
    const input = canvas.getByRole('textbox');
    await expect(args.ref).toHaveBeenCalledWith(input);
    const refSpy = args.ref as ReturnType<typeof fn>;
    const cleanups = refSpy.mock.results.filter(
      (result) => result.type === 'return' && typeof result.value === 'function',
    );
    await expect(cleanups.length).toBeGreaterThanOrEqual(1);
    for (const cleanup of cleanups.slice(0, -1)) await expect(cleanup.value).toHaveBeenCalledTimes(1);
    await expect(cleanups.at(-1)!.value).not.toHaveBeenCalled();
    await expect(args.actionsRef).toHaveBeenCalled();
    const calls = (args.actionsRef as ReturnType<typeof fn>).mock.calls;
    const actions = calls.find(([value]) => value !== null)?.[0] as MentionInputActions;
    await expect(typeof actions.insert).toBe('function');
    await expect(typeof actions.clear).toBe('function');
    await expect(typeof actions.openSuggestions).toBe('function');
    await userEvent.click(canvas.getByRole('button', { name: 'Unmount field' }));
    for (const cleanup of cleanups) await expect(cleanup.value).toHaveBeenCalledTimes(1);
    await expect(canvas.queryByRole('textbox')).toBeNull();
  },
};
// This story tests sx and the documented slot css API.
export const SlotStyles: Story = {
  tags: ['!autodocs'],
  args: {
    defaultValue: { text: '@', mentions: [] },
    open: true,
    slotProps: {
      input: { sx: css({ paddingInline: vars.space[3] }) },
      mirror: { sx: css({ paddingInline: vars.space[3] }) },
      option: { sx: css({ fontWeight: vars.fontWeight.semibold }) },
    },
    sx: css({ gap: vars.space[3] }),
  },
  play: async (context) => {
    await openPlay(context);
    const input = context.canvas.getByRole('textbox');
    const root = input.closest('[data-ui=mention-input]')!;
    await expect(parseFloat(getComputedStyle(root).rowGap)).toBeCloseTo(12, 0);
    await expect(getComputedStyle(input).paddingInlineStart).toBe(
      getComputedStyle(root.querySelector('[aria-hidden=true]')!).paddingInlineStart,
    );
    await expect(
      getComputedStyle(within(input.ownerDocument.body).getAllByRole('option')[0]!).fontWeight,
    ).toBe('600');
  },
};
export const ControlledFormReset: Story = {
  args: { value: TOKEN_VALUE, name: 'comment' },
  parameters: { docs: { source: { language: 'tsx', code: `import { Button, MentionInput } from '@jfrader/ui';

<form aria-label="Accepted comment">
  <MentionInput
    label="Comment"
    name="comment"
    value={{
      text: '@Ada',
      mentions: [{ kind: 'person', id: 'ada', label: 'Ada', start: 0, end: 4 }],
    }}
  />
  <Button type="reset">Reset</Button>
</form>` } } },
  render: (args) => (
    <form aria-label="Accepted comment">
      <MentionInput {...args} />
      <Fixture type="reset">
        Reset
      </Fixture>
    </form>
  ),
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Reset' }));
    await waitFor(async () => {
      await expect(canvas.getByRole('textbox')).toHaveValue(TOKEN_VALUE.text);
    });
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};
export const NativeCaretKeys: Story = {
  tags: ['!autodocs'],
  args: { defaultValue: { text: '@a', mentions: [] }, defaultOpen: true },
  play: async ({ canvas, userEvent, args }) => {
    const input = canvas.getByRole('textbox') as HTMLTextAreaElement;
    await userEvent.click(input);
    await userEvent.keyboard('{End}{Home}');
    await expect(input.selectionStart).toBe(0);
    await userEvent.keyboard('{End}');
    await expect(input.selectionStart).toBe(2);
    await userEvent.keyboard('{Shift>}{Enter}{/Shift}');
    await expect(input).toHaveValue('@a\n');
    await expect(args.onMentionAdd).not.toHaveBeenCalled();
  },
};

export const SameLabelPasteDropsIdentity: Story = {
  args: { defaultValue: TOKEN_VALUE },
  play: async ({ canvas, userEvent, args }) => {
    const input = canvas.getByRole('textbox') as HTMLTextAreaElement;
    await userEvent.click(input);
    input.setSelectionRange(0, 4);
    fireEvent(
      input,
      new InputEvent('beforeinput', { bubbles: true, inputType: 'insertFromPaste', data: '@Ada' }),
    );
    fireEvent.input(input, { target: { value: TOKEN_VALUE.text } });
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith({
      text: TOKEN_VALUE.text,
      mentions: [{ kind: 'channel', id: 'general', label: 'general', start: 5, end: 13 }],
    });
    await expect(args.onMentionAdd).not.toHaveBeenCalled();
  },
};

export const CanceledFormReset: Story = {
  args: { defaultValue: TOKEN_VALUE },
  parameters: { docs: { source: { language: 'tsx', code: `import { Button, MentionInput } from '@jfrader/ui';

<form onReset={(event) => event.preventDefault()}>
  <MentionInput
    label="Comment"
    people={[{ id: 'ada', name: 'Ada' }]}
    defaultValue={{
      text: '@Ada',
      mentions: [{ kind: 'person', id: 'ada', label: 'Ada', start: 0, end: 4 }],
    }}
  />
  <Button type="reset">Reset</Button>
</form>` } } },
  render: (args) => (
    <form onReset={(event) => event.preventDefault()}>
      <MentionInput {...args} />
      <Fixture type="reset">
        Reset
      </Fixture>
    </form>
  ),
  play: async ({ canvas, userEvent, args }) => {
    const input = canvas.getByRole('textbox');
    await userEvent.click(input);
    await userEvent.keyboard('{End}!');
    await userEvent.click(canvas.getByRole('button', { name: 'Reset' }));
    await expect(input).toHaveValue('@Ada #general!');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
  },
};

export const ExternalFormReset: Story = {
  args: { defaultValue: TOKEN_VALUE, name: 'comment', form: 'external-comment-form' },
  parameters: { docs: { source: { language: 'tsx', code: `import { useId } from 'react';
import { Button, MentionInput } from '@jfrader/ui';

function CommentForm() {
  const formId = useId();
  return (
    <>
      <MentionInput
        label="Comment"
        name="comment"
        form={formId}
        people={[{ id: 'ada', name: 'Ada' }]}
        defaultValue={{
          text: '@Ada',
          mentions: [{ kind: 'person', id: 'ada', label: 'Ada', start: 0, end: 4 }],
        }}
      />
      <form id={formId} aria-label="Comment form">
        <Button type="reset">Reset</Button>
      </form>
    </>
  );
}` } } },
  render: (args) => (
    <>
      <MentionInput {...args} />
      <form id="external-comment-form" aria-label="External comment form">
        <Fixture type="reset">
          Reset
        </Fixture>
      </form>
    </>
  ),
  play: async ({ canvas, userEvent, args }) => {
    const input = canvas.getByRole('textbox') as HTMLTextAreaElement;
    const form = canvas.getByRole('form') as HTMLFormElement;
    await expect(input.form).toBe(form);
    await userEvent.click(input);
    await userEvent.keyboard('{End}!');
    await expect(new FormData(form).get('comment')).toBe('@Ada #general!');
    await userEvent.click(canvas.getByRole('button', { name: 'Reset' }));
    await waitFor(async () => {
      await expect(input).toHaveValue(TOKEN_VALUE.text);
    });
    await expect(new FormData(form).get('comment')).toBe(TOKEN_VALUE.text);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
  },
};

const StyledMentionInput = styled(MentionInput)({ borderRadius: '9px' });
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
        sx: { borderRadius: '8px' },
      },
      label: { ref: fn(), title: 'generated part' },
    },
  },
  render: (args) => <StyledMentionInput {...args} />,
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { MentionInput, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const CommentRoot = styled.div({ borderRadius: vars.radius.md });
const CommentLabel = styled.label({ fontWeight: vars.fontWeight.semibold });

<MentionInput
  label="Comment"
  people={[{ id: 'ada', name: 'Ada' }]}
  slots={{ root: CommentRoot, label: CommentLabel }}
  slotProps={{ label: { title: 'Mention a teammate with @' } }}
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
      'textarea',
    );
  },
};

/** Use component as shorthand for the wrapper's root slot. */
export const ComponentRoot: Story = {
  args: { component: FieldSugarRoot },
  parameters: { docs: { source: { language: 'tsx', code: `import { MentionInput, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const CommentRoot = styled.div({ gap: vars.space[3] });

<MentionInput
  label="Comment"
  people={[{ id: 'ada', name: 'Ada' }]}
  component={CommentRoot}
/>` } } },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[data-slot-root="component"]')).not.toBeNull();
  },
};

export type MentionInputSlotTypeRegression = {
  // @ts-expect-error Unknown structural keys are rejected.
  unknownSlot: NonNullable<import('./index').MentionInputProps['slots']>['notASlot'];
  // @ts-expect-error Unknown prop keys are rejected.
  unknownSlotProps: NonNullable<import('./index').MentionInputProps['slotProps']>['notASlot'];
};
