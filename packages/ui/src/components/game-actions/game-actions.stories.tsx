import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
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

const meta = {
  title: 'Games/GameActions',
  component: GameActions,
  tags: ['autodocs'],
  args: {
    actions: SAMPLE_ACTIONS,
    label: 'Turn actions',
  },
  parameters: {
    docs: {
      description: {
        component:
          'Trigger turn actions with an accessible game toolbar. Compose with GameTable.Floating for inline table overlays, or with Dialog for modal call prompts.',
      },
      source: {
        language: 'tsx',
        code: `import { GameActions } from '@jfrader/ui/game-actions';

const actions = [
  { key: 'fold', label: 'Fold', tone: 'danger', onSelect: handleFold },
  { key: 'check', label: 'Check', tone: 'neutral', onSelect: handleCheck },
  { key: 'call', label: 'Call 20', tone: 'neutral', onSelect: handleCall },
  { key: 'raise', label: 'Raise 50', tone: 'accent', onSelect: handleRaise },
];

<GameActions actions={actions} label="Turn actions" />`,
      },
      usage: `### Setup
- Import from \`@jfrader/ui/game-actions\`. GameActions is published as an opt-in subpath and is not re-exported from the package root.

### Keyboard and navigation
- Implements the WAI-ARIA APG Toolbar pattern (\`role="toolbar"\`).
- Tab enters the toolbar and moves focus to the active action.
- ArrowRight and ArrowLeft (swapped under RTL) or ArrowDown and ArrowUp (vertical) move roving focus between actions.
- Home and End jump to the first and last actions.
- Inactive actions receive honest \`aria-disabled="true"\`. They remain focusable and announced by screen readers, but cannot be activated.
- When an action becomes unavailable while focused, focus remains on the action without falling back to the document body.
- Space and Enter activate enabled actions.
- Command shortcuts belong to the consumer; include shortcut hints in each action label. GameActions does not bind them.

### Values and states
- Each action specifies a unique \`key\`, a \`label\` in your application language, and optional \`disabled\`, \`pending\`, and \`tone\` properties.
- State is conveyed by text labels, honest \`aria-disabled\` attributes, and animated spinner rings for \`pending\`, never by color alone.
- \`pending\` actions display a loading spinner ring, declare \`aria-busy="true"\`, and block activation.

### Call overlays
- Use CallOverlay from @jfrader/ui/call-overlay for animated scene announcements.
- For inline overlays inside a table, place \`GameActions\` inside \`GameTable.Floating\`.
- For modal call overlays, place \`GameActions\` inside \`Dialog.Content\` or \`Popover.Content\`.`,
    },
  },
} satisfies Meta<typeof GameActions>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { GameActions } from '@jfrader/ui/game-actions';

const actions = [
  { key: 'fold', label: 'Fold', tone: 'danger', onSelect: handleFold },
  { key: 'check', label: 'Check', tone: 'neutral', onSelect: handleCheck },
  { key: 'call', label: 'Call 20', tone: 'neutral', onSelect: handleCall },
  { key: 'raise', label: 'Raise 50', tone: 'accent', onSelect: handleRaise },
];

<GameActions actions={actions} label="Turn actions" />`,
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

export const InlineTableOverlay: Story = {
  name: 'Inline table overlay',
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { GameTable } from '@jfrader/ui/game-table';
import { GameActions } from '@jfrader/ui/game-actions';
import { Surface } from '@jfrader/ui';

<div style={{ position: 'relative', inlineSize: '100%', blockSize: '400px' }}>
  <GameTable
    players={4}
    seats={[
      { key: 's1', name: 'Alice', teamIdx: 0 },
      { key: 's2', name: 'Bob', teamIdx: 1 },
      { key: 's3', name: 'Charlie', teamIdx: 0 },
      { key: 's4', name: 'Dana', teamIdx: 1 },
    ]}
  >
    <GameTable.Center>Pot: 140</GameTable.Center>
    <GameTable.Floating>
      <div style={{ position: 'absolute', insetInline: 0, insetBlockEnd: '16px', display: 'flex', justifyContent: 'center' }}>
        <Surface appearance="contrast" sx={{ padding: '8px', borderRadius: '16px' }}>
          <GameActions actions={actions} label="Table actions" />
        </Surface>
      </div>
    </GameTable.Floating>
  </GameTable>
</div>`,
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
      <div style={{ position: 'relative', inlineSize: '100%', blockSize: '400px' }}>
        <GameTable players={4} seats={seats}>
          <GameTable.Center>Pot: 140</GameTable.Center>
          <GameTable.Floating>
            <div
              style={{
                position: 'absolute',
                insetInline: 0,
                insetBlockEnd: '16px',
                display: 'flex',
                justifyContent: 'center',
              }}
            >
              <Surface appearance="contrast" sx={{ padding: vars.space[2], borderRadius: vars.radius.xl }}>
                <GameActions actions={SAMPLE_ACTIONS} label="Table actions" />
              </Surface>
            </div>
          </GameTable.Floating>
        </GameTable>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toolbar = await canvas.findByRole('toolbar', { name: 'Table actions' });
    await expect(toolbar).toBeInTheDocument();
  },
};

export const ModalCallOverlay: Story = {
  name: 'Modal call overlay',
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { Dialog } from '@jfrader/ui';
import { GameActions } from '@jfrader/ui/game-actions';

<Dialog>
  <Dialog.Trigger>Open call prompt</Dialog.Trigger>
  <Dialog.Content>
    <Dialog.Title>Challenge proposal</Dialog.Title>
    <Dialog.Description>An opponent challenged with 50 points. Choose your response.</Dialog.Description>
    <GameActions
      actions={[
        { key: 'accept', label: 'Accept challenge', tone: 'accent', onSelect: handleAccept },
        { key: 'raise', label: 'Raise to 100', tone: 'neutral', onSelect: handleRaise },
        { key: 'decline', label: 'Decline', tone: 'danger', onSelect: handleDecline },
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

export const DisabledAndPending: Story = {
  name: 'Disabled and pending',
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { GameActions } from '@jfrader/ui/game-actions';

const actions = [
  { key: 'pass', label: 'Pass', disabled: true },
  { key: 'call', label: 'Call 20', pending: true },
  { key: 'fold', label: 'Fold', tone: 'danger' },
];

<GameActions actions={actions} label="Turn actions" />`,
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

export const Vertical: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { GameActions } from '@jfrader/ui/game-actions';

<GameActions actions={actions} orientation="vertical" label="Turn actions" />`,
      },
    },
  },
  args: {
    orientation: 'vertical',
  },
};

export const Light: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { GameActions } from '@jfrader/ui/game-actions';

<GameActions actions={actions} label="Turn actions" />`,
      },
    },
  },
  decorators: [withLightTheme],
  globals: { theme: 'light' },
};

export const KeyboardNavigation: Story = {
  name: 'Keyboard navigation',
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { GameActions } from '@jfrader/ui/game-actions';

<button type="button">Before</button>
<GameActions actions={actions} label="Turn actions" />
<button type="button">After</button>`,
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'flex-start' }}>
        <button type="button" data-testid="before-button">
          Before
        </button>
        <GameActions actions={actions} label="Turn actions" />
        <button type="button" data-testid="after-button">
          After
        </button>
      </div>
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

export const FocusPreservedOnUnavailable: Story = {
  name: 'Focus preserved on unavailable',
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `// When an action becomes unavailable while focused, focus remains on the action
<GameActions actions={actions} label="Turn actions" />`,
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
