import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { styled } from '../../styling/styled';
import { withLightTheme } from '../../testing/story-decorators';
import { Dialog } from '../dialog';
import { GameTable } from '../game-table';
import { Surface } from '../surface';
import { GameActions, type GameActionItem, type GameActionsProps } from './index';

const SAMPLE_ACTIONS: readonly GameActionItem[] = [
  { key: 'fold', label: 'Fold', tone: 'danger', onSelect: fn() },
  { key: 'check', label: 'Check', tone: 'neutral', onSelect: fn() },
  { key: 'call', label: 'Call 20', tone: 'neutral', onSelect: fn() },
  { key: 'raise', label: 'Raise 50', tone: 'accent', onSelect: fn() },
];

const TableFrame = styled.div({
  position: 'relative',
  inlineSize: `calc(${vars.space[8]} * 26)`,
  maxInlineSize: '100%',
  blockSize: `calc(${vars.space[4]} * 25)`,
});
const FloatingActions = styled.div({
  position: 'absolute',
  insetInline: 0,
  insetBlockEnd: vars.space[4],
  display: 'flex',
  justifyContent: 'center',
});
const ActionSurface = styled(Surface)({ padding: vars.space[2], borderRadius: vars.radius.xl });
const TurnPanel = styled(Surface)({
  boxSizing: 'border-box',
  inlineSize: `calc(${vars.space[8]} * 20)`,
  maxInlineSize: '100%',
  padding: vars.space[6],
  display: 'grid',
  gap: vars.space[5],
  justifyItems: 'start',
});
const TurnLabel = styled.p({
  margin: 0,
  fontFamily: vars.font.sans,
  fontSize: vars.textSize.sm,
  color: vars.color.textMuted,
});
const KeyboardFrame = styled.div({
  display: 'flex',
  flexDirection: 'column',
  gap: vars.space[4],
  alignItems: 'flex-start',
});

const meta = {
  title: 'Games/GameActions',
  component: GameActions,
  tags: ['autodocs'],
  render: (args) => (
    <TurnPanel>
      <TurnLabel>Your turn · Pot 140 · To call 20</TurnLabel>
      <GameActions {...args} />
    </TurnPanel>
  ),
  args: {
    actions: SAMPLE_ACTIONS,
    label: 'Turn actions',
  },
  parameters: {
    docs: {
      description: {
        component:
          'Choose a turn action from a game toolbar.',
      },
      sections: [
        { title: 'Turn actions', stories: ['Default', 'DisabledAndPending', 'Vertical'] },
        { title: 'Prompts', stories: ['InlineTableOverlay', 'ModalCallOverlay'] },
      ],
      source: {
        language: 'tsx',
        code: `import { GameActions, type GameActionItem } from '@jfrader/ui/game-actions';

const actions = [
  { key: 'fold', label: 'Fold', tone: 'danger', onSelect: () => {} },
  { key: 'check', label: 'Check', tone: 'neutral', onSelect: () => {} },
  { key: 'call', label: 'Call 20', tone: 'neutral', onSelect: () => {} },
  { key: 'raise', label: 'Raise 50', tone: 'accent', onSelect: () => {} },
] satisfies readonly GameActionItem[];

<GameActions actions={actions} label="Turn actions" />`,
      },
      usage: `### Keyboard
Tab enters the toolbar at the active action. Left and Right move between horizontal actions, reversed in RTL; Up and Down move between vertical actions. Home and End reach the first and last actions. Enter or Space activates an enabled action.

Unavailable and pending actions remain focusable but cannot be activated. An action that becomes unavailable keeps focus. Pending actions announce their busy state. Bind any game shortcuts in your application and include their hints in the labels.

### Prompts
Keep turn actions in the table for non-blocking choices. Use a dialog when the player must answer before continuing.`,
    },
  },
} satisfies Meta<typeof GameActions>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Fold, check, call, or raise from a turn toolbar. */
export const Default: Story = {
  name: 'Turn toolbar',
  parameters: {
    docs: {
      description: { story: 'Fold, check, call or raise from the current turn.' },
      source: {
        language: 'tsx',
        code: `import { styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';
import { Surface } from '@jfrader/ui/surface';
import { GameActions, type GameActionItem } from '@jfrader/ui/game-actions';

const TurnPanel = styled(Surface)({
  boxSizing: 'border-box', inlineSize: \`calc(\${vars.space[8]} * 20)\`, maxInlineSize: '100%',
  padding: vars.space[6], display: 'grid', gap: vars.space[5], justifyItems: 'start',
});
const TurnLabel = styled.p({ margin: 0, fontFamily: vars.font.sans, fontSize: vars.textSize.sm, color: vars.color.textMuted });

const actions = [
  { key: 'fold', label: 'Fold', tone: 'danger', onSelect: () => {} },
  { key: 'check', label: 'Check', tone: 'neutral', onSelect: () => {} },
  { key: 'call', label: 'Call 20', tone: 'neutral', onSelect: () => {} },
  { key: 'raise', label: 'Raise 50', tone: 'accent', onSelect: () => {} },
] satisfies readonly GameActionItem[];

<TurnPanel>
  <TurnLabel>Your turn · Pot 140 · To call 20</TurnLabel>
  <GameActions actions={actions} label="Turn actions" />
</TurnPanel>`,
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toolbar = canvas.getByRole('toolbar', { name: 'Turn actions' });
    await expect(toolbar).toBeInTheDocument();
    const callButton = canvas.getByRole('button', { name: 'Call 20' });
    await userEvent.click(callButton);
  },
};

/** Turn actions sit over a four-player table with a pot of 140. */
export const InlineTableOverlay: Story = {
  name: 'Inline table overlay',
  parameters: {
    docs: {
      description: { story: 'Place turn actions above a four-player table.' },
      source: {
        language: 'tsx',
        code: `import { GameTable } from '@jfrader/ui/game-table';
import { GameActions, type GameActionItem } from '@jfrader/ui/game-actions';
import { Surface } from '@jfrader/ui/surface';
import { styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const TableFrame = styled.div({ position: 'relative', inlineSize: '100%', blockSize: \`calc(\${vars.space[4]} * 25)\` });
const FloatingActions = styled.div({ position: 'absolute', insetInline: 0, insetBlockEnd: vars.space[4], display: 'flex', justifyContent: 'center' });
const ActionSurface = styled(Surface)({ padding: vars.space[2], borderRadius: vars.radius.xl });
const actions = [
  { key: 'fold', label: 'Fold', tone: 'danger', onSelect: () => {} },
  { key: 'check', label: 'Check', tone: 'neutral', onSelect: () => {} },
  { key: 'call', label: 'Call 20', tone: 'neutral', onSelect: () => {} },
  { key: 'raise', label: 'Raise 50', tone: 'accent', onSelect: () => {} },
] satisfies readonly GameActionItem[];
const seats = [
  { key: 's1', name: 'Alice', teamIdx: 0 },
  { key: 's2', name: 'Bob', teamIdx: 1 },
  { key: 's3', name: 'Charlie', teamIdx: 0 },
  { key: 's4', name: 'Dana', teamIdx: 1 },
];

<TableFrame>
  <GameTable players={4} seats={seats}>
    <GameTable.Center>Pot: 140</GameTable.Center>
    <GameTable.Floating>
      <FloatingActions>
        <ActionSurface appearance="contrast">
          <GameActions actions={actions} label="Table actions" />
        </ActionSurface>
      </FloatingActions>
    </GameTable.Floating>
  </GameTable>
</TableFrame>`,
      },
    },
  },
  render: () => {
    const seats = [
      { key: 's1', name: 'Alice', teamIdx: 0 },
      { key: 's2', name: 'Bob', teamIdx: 1 },
      { key: 's3', name: 'Charlie', teamIdx: 0 },
      { key: 's4', name: 'Dana', teamIdx: 1 },
    ];
    return (
      <TableFrame>
        <GameTable players={4} seats={seats}>
          <GameTable.Center>Pot: 140</GameTable.Center>
          <GameTable.Floating>
            <FloatingActions>
              <ActionSurface appearance="contrast">
                <GameActions actions={SAMPLE_ACTIONS} label="Table actions" />
              </ActionSurface>
            </FloatingActions>
          </GameTable.Floating>
        </GameTable>
      </TableFrame>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toolbar = await canvas.findByRole('toolbar', { name: 'Table actions' });
    await expect(toolbar).toBeInTheDocument();
  },
};

/** Open a challenge prompt to accept, raise, or decline. */
export const ModalCallOverlay: Story = {
  name: 'Modal call overlay',
  parameters: {
    docs: {
      description: { story: 'Open a challenge prompt to accept, raise or decline.' },
      source: {
        language: 'tsx',
        code: `import { Dialog } from '@jfrader/ui/dialog';
import { GameActions } from '@jfrader/ui/game-actions';

<Dialog>
  <Dialog.Trigger>Open call prompt</Dialog.Trigger>
  <Dialog.Content>
    <Dialog.Title>Challenge proposal</Dialog.Title>
    <Dialog.Description>An opponent challenged with 50 points. Choose your response.</Dialog.Description>
    <GameActions
      actions={[
        { key: 'accept', label: 'Accept challenge', tone: 'accent', onSelect: () => {} },
        { key: 'raise', label: 'Raise to 100', tone: 'neutral', onSelect: () => {} },
        { key: 'decline', label: 'Decline', tone: 'danger', onSelect: () => {} },
      ]}
      label="Challenge response"
    />
  </Dialog.Content>
</Dialog>`,
      },
    },
  },
  render: () => {
    const modalActions: readonly GameActionItem[] = [
      { key: 'accept', label: 'Accept challenge', tone: 'accent', onSelect: fn() },
      { key: 'raise', label: 'Raise to 100', tone: 'neutral', onSelect: fn() },
      { key: 'decline', label: 'Decline', tone: 'danger', onSelect: fn() },
    ];
    return (
      <Dialog>
        <Dialog.Trigger>Open call prompt</Dialog.Trigger>
        <Dialog.Content>
          <Dialog.Title>Challenge proposal</Dialog.Title>
          <Dialog.Description>
            An opponent challenged with 50 points. Choose your response.
          </Dialog.Description>
          <GameActions actions={modalActions} label="Challenge response" />
        </Dialog.Content>
      </Dialog>
    );
  },
};

/** Pass is unavailable and Call 20 is pending while Fold remains enabled. */
export const DisabledAndPending: Story = {
  name: 'Disabled and pending',
  parameters: {
    docs: {
      description: { story: 'Keep unavailable and pending actions visible beside an enabled Fold action.' },
      source: {
        language: 'tsx',
        code: `import { styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';
import { Surface } from '@jfrader/ui/surface';
import { GameActions, type GameActionItem } from '@jfrader/ui/game-actions';

const TurnPanel = styled(Surface)({
  boxSizing: 'border-box', inlineSize: \`calc(\${vars.space[8]} * 20)\`, maxInlineSize: '100%',
  padding: vars.space[6], display: 'grid', gap: vars.space[5], justifyItems: 'start',
});
const TurnLabel = styled.p({ margin: 0, fontFamily: vars.font.sans, fontSize: vars.textSize.sm, color: vars.color.textMuted });

const actions = [
  { key: 'pass', label: 'Pass', disabled: true, onSelect: () => {} },
  { key: 'call', label: 'Call 20', pending: true, onSelect: () => {} },
  { key: 'fold', label: 'Fold', tone: 'danger', onSelect: () => {} },
] satisfies readonly GameActionItem[];

<TurnPanel>
  <TurnLabel>Your turn · Pot 140 · To call 20</TurnLabel>
  <GameActions actions={actions} label="Turn actions" />
</TurnPanel>`,
      },
    },
  },
  args: {
    actions: [
      { key: 'pass', label: 'Pass', disabled: true, onSelect: fn() },
      { key: 'call', label: 'Call 20', pending: true, onSelect: fn() },
      { key: 'fold', label: 'Fold', tone: 'danger', onSelect: fn() },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const passButton = canvas.getByRole('button', { name: 'Pass' });
    const callButton = canvas.getByRole('button', { name: 'Call 20' });
    await expect(passButton).toHaveAttribute('aria-disabled', 'true');
    await expect(callButton).toHaveAttribute('aria-busy', 'true');
    await expect(callButton).toHaveAttribute('aria-disabled', 'true');
  },
};

/** Turn actions are arranged in a vertical toolbar. */
export const Vertical: Story = {
  name: 'Vertical',
  parameters: {
    docs: {
      description: { story: 'Arrange actions vertically and move focus with Up and Down.' },
      source: {
        language: 'tsx',
        code: `import { styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';
import { Surface } from '@jfrader/ui/surface';
import { GameActions, type GameActionItem } from '@jfrader/ui/game-actions';

const TurnPanel = styled(Surface)({
  boxSizing: 'border-box', inlineSize: \`calc(\${vars.space[8]} * 20)\`, maxInlineSize: '100%',
  padding: vars.space[6], display: 'grid', gap: vars.space[5], justifyItems: 'start',
});
const TurnLabel = styled.p({ margin: 0, fontFamily: vars.font.sans, fontSize: vars.textSize.sm, color: vars.color.textMuted });

const actions = [
  { key: 'fold', label: 'Fold', tone: 'danger', onSelect: () => {} },
  { key: 'check', label: 'Check', tone: 'neutral', onSelect: () => {} },
  { key: 'call', label: 'Call 20', tone: 'neutral', onSelect: () => {} },
  { key: 'raise', label: 'Raise 50', tone: 'accent', onSelect: () => {} },
] satisfies readonly GameActionItem[];

<TurnPanel>
  <TurnLabel>Your turn · Pot 140 · To call 20</TurnLabel>
  <GameActions actions={actions} orientation="vertical" label="Turn actions" />
</TurnPanel>`,
      },
    },
  },
  args: {
    orientation: 'vertical',
  },
};

/** Turn actions use the light theme. */
export const Light: Story = {
  name: 'Light theme',
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { GameActions, type GameActionItem } from '@jfrader/ui/game-actions';
import { ThemeRoot } from '@jfrader/ui/theme-root';

const actions = [
  { key: 'fold', label: 'Fold', tone: 'danger', onSelect: () => {} },
  { key: 'check', label: 'Check', tone: 'neutral', onSelect: () => {} },
  { key: 'call', label: 'Call 20', tone: 'neutral', onSelect: () => {} },
  { key: 'raise', label: 'Raise 50', tone: 'accent', onSelect: () => {} },
] satisfies readonly GameActionItem[];

<ThemeRoot theme="light">
  <GameActions actions={actions} label="Turn actions" />
</ThemeRoot>`,
      },
    },
  },
  decorators: [withLightTheme],
  globals: { theme: 'light' },
};

/** Before and After buttons surround a toolbar with an unavailable Check action. */
export const KeyboardNavigation: Story = {
  name: 'Keyboard navigation',
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { GameActions, type GameActionItem } from '@jfrader/ui/game-actions';
import { styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const KeyboardFrame = styled.div({ display: 'flex', flexDirection: 'column', gap: vars.space[4], alignItems: 'flex-start' });
const actions = [
  { key: 'fold', label: 'Fold', tone: 'danger', onSelect: () => {} },
  { key: 'check', label: 'Check', disabled: true, onSelect: () => {} },
  { key: 'call', label: 'Call', onSelect: () => {} },
  { key: 'raise', label: 'Raise', tone: 'accent', onSelect: () => {} },
] satisfies readonly GameActionItem[];

<KeyboardFrame>
  <button type="button" data-testid="before-button">Before</button>
  <GameActions actions={actions} label="Turn actions" />
  <button type="button" data-testid="after-button">After</button>
</KeyboardFrame>`,
      },
    },
  },
  render: () => {
    const onFold = fn();
    const onCheck = fn();
    const onCall = fn();
    const onRaise = fn();

    const actions: readonly GameActionItem[] = [
      { key: 'fold', label: 'Fold', tone: 'danger', onSelect: onFold },
      { key: 'check', label: 'Check', disabled: true, onSelect: onCheck },
      { key: 'call', label: 'Call', onSelect: onCall },
      { key: 'raise', label: 'Raise', tone: 'accent', onSelect: onRaise },
    ];

    return (
      <KeyboardFrame>
        <button type="button" data-testid="before-button">
          Before
        </button>
        <GameActions actions={actions} label="Turn actions" />
        <button type="button" data-testid="after-button">
          After
        </button>
      </KeyboardFrame>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const beforeBtn = canvas.getByTestId('before-button');
    const afterBtn = canvas.getByTestId('after-button');
    const foldBtn = canvas.getByRole('button', { name: 'Fold' });
    const checkBtn = canvas.getByRole('button', { name: 'Check' });
    const callBtn = canvas.getByRole('button', { name: 'Call' });
    const raiseBtn = canvas.getByRole('button', { name: 'Raise' });

    // Focus initial element before toolbar
    beforeBtn.focus();
    await expect(canvasElement.ownerDocument.activeElement).toBe(beforeBtn);

    // Tab into toolbar: lands on first active tab stop (Fold)
    await userEvent.tab();
    await expect(canvasElement.ownerDocument.activeElement).toBe(foldBtn);
    await expect(getComputedStyle(foldBtn).outlineStyle).not.toBe('none');

    // ArrowRight moves to next item (Check, which is disabled with honest aria-disabled)
    await userEvent.keyboard('{ArrowRight}');
    await expect(canvasElement.ownerDocument.activeElement).toBe(checkBtn);
    await expect(checkBtn).toHaveAttribute('aria-disabled', 'true');

    // Attempting activation on inactive action (Enter and Space) does not trigger action
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    // Move to Call
    await userEvent.keyboard('{ArrowRight}');
    await expect(canvasElement.ownerDocument.activeElement).toBe(callBtn);

    // Move to Raise
    await userEvent.keyboard('{ArrowRight}');
    await expect(canvasElement.ownerDocument.activeElement).toBe(raiseBtn);

    // Wrapping ArrowRight returns to Fold
    await userEvent.keyboard('{ArrowRight}');
    await expect(canvasElement.ownerDocument.activeElement).toBe(foldBtn);

    // Wrapping ArrowLeft goes back to Raise
    await userEvent.keyboard('{ArrowLeft}');
    await expect(canvasElement.ownerDocument.activeElement).toBe(raiseBtn);

    // Home jumps to first action (Fold)
    await userEvent.keyboard('{Home}');
    await expect(canvasElement.ownerDocument.activeElement).toBe(foldBtn);

    // End jumps to last action (Raise)
    await userEvent.keyboard('{End}');
    await expect(canvasElement.ownerDocument.activeElement).toBe(raiseBtn);

    // Enter activates enabled action
    await userEvent.keyboard('{Enter}');

    // Tab exits toolbar to the next focusable element on page (After)
    await userEvent.tab();
    await expect(canvasElement.ownerDocument.activeElement).toBe(afterBtn);

    // Shift+Tab returns to the toolbar, restoring focus to the last active item (Raise)
    await userEvent.tab({ shift: true });
    await expect(canvasElement.ownerDocument.activeElement).toBe(raiseBtn);
  },
};

function FocusPreservationFixture() {
  const [disabled, setDisabled] = useState(false);

  const actions: readonly GameActionItem[] = [
    {
      key: 'action-toggle',
      label: 'Submit action',
      disabled,
      onSelect: () => setDisabled(true),
    },
    {
      key: 'action-secondary',
      label: 'Secondary action',
    },
  ];

  return <GameActions actions={actions} label="Turn actions" />;
}

/** Submit action becomes unavailable after activation without losing focus. */
export const FocusPreservedOnUnavailable: Story = {
  name: 'Focus preserved on unavailable',
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { useState } from 'react';
import { GameActions, type GameActionItem } from '@jfrader/ui/game-actions';

export function FocusPreservationExample() {
  const [disabled, setDisabled] = useState(false);
  const actions: readonly GameActionItem[] = [
    {
      key: 'action-toggle',
      label: 'Submit action',
      disabled,
      onSelect: () => setDisabled(true),
    },
    { key: 'action-secondary', label: 'Secondary action' },
  ];

  return <GameActions actions={actions} label="Turn actions" />;
}`,
      },
    },
  },
  render: () => <FocusPreservationFixture />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const actionBtn = canvas.getByRole('button', { name: 'Submit action' });

    // Focus action button
    actionBtn.focus();
    await expect(canvasElement.ownerDocument.activeElement).toBe(actionBtn);

    // Activate: triggers onSelect which sets disabled=true
    await userEvent.keyboard('{Enter}');

    // Verify button is now disabled via aria-disabled
    await expect(actionBtn).toHaveAttribute('aria-disabled', 'true');

    // Crucial check: focus is CONSERVED on the button, not lost to document.body!
    await expect(canvasElement.ownerDocument.activeElement).toBe(actionBtn);
  },
};
