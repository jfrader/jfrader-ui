import { useState, type ComponentPropsWithRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { styled } from '../../styling/styled';
import { withLightTheme } from '../../testing/story-decorators';
import { Button } from '../button';
import { GameActions } from '../game-actions';
import { GameTable } from '../game-table';
import { CallOverlay } from './index';

const Frame = styled.div({
  position: 'relative',
  inlineSize: `calc(${vars.space[6]} * 35)`,
  maxInlineSize: '100%',
  blockSize: `calc(${vars.space[6]} * 17.5)`,
});
const Row = styled.div({ display: 'flex', gap: vars.space[4], padding: vars.space[6] });
const preference: { matches: boolean; media?: MediaQueryList } = { matches: false };
function mockPreference(reduced: boolean) {
  const original = window.matchMedia.bind(window);
  preference.matches = reduced;
  if (!preference.media) {
    preference.media = original('(prefers-reduced-motion)');
    Object.defineProperty(preference.media, 'matches', { get: () => preference.matches });
  }
  preference.media.dispatchEvent(new MediaQueryListEvent('change', { matches: reduced }));
  window.matchMedia = (query) => query.includes('prefers-reduced-motion') ? preference.media! : original(query);
  return () => { window.matchMedia = original; };
}
const meta = {
  title: 'Games/CallOverlay',
  component: CallOverlay,
  tags: ['autodocs'],
  args: { label: 'Round started', defaultOpen: true },
  beforeEach: () => mockPreference(false),
  afterEach: async ({ canvasElement }) => {
    for (const status of within(canvasElement).queryAllByRole('status')) {
      if (status.dataset.state !== 'open') continue;
      await waitFor(() => {
        const fade = status.querySelector('span');
        expect(fade && Number(getComputedStyle(fade).opacity)).toBe(1);
      });
    }
  },
  parameters: { docs: {
    description: { component: 'Announce a game event without moving focus or blocking play. Supply the call text from your game.' },
    usage: `Import from \`@jfrader/ui/call-overlay\`. The status region announces content politely; there is no modal or keyboard interaction. Focus stays on the active control.

Use \`defaultOpen\` for a single announcement, or \`open\` and \`onOpenChange\` for controlled visibility. After three seconds the component requests closure. Reopen or remount to replay; no state callback fires on mount. Reduced motion keeps only the fade and the same closure lifecycle.

Place it in \`GameTable.Floating\` to announce over a table, or render standalone. \`slots.root\` (or \`component\`) replaces the status div; forward its props and ref. \`slotProps.root\`, \`className\` and \`sx\` customize it.`,
    source: { code: `import { CallOverlay } from '@jfrader/ui/call-overlay';

<CallOverlay defaultOpen label="Round started" />`, language: 'tsx' },
  } },
} satisfies Meta<typeof CallOverlay>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A round-start announcement closes automatically. */
export const Default: Story = {
  name: 'Default',
  parameters: { docs: { source: { language: 'tsx', code: `import { CallOverlay } from '@jfrader/ui/call-overlay';

<CallOverlay defaultOpen label="Round started" onOpenChange={() => {}} />` } } },
  args: { onOpenChange: fn() },
  play: async ({ canvasElement, args }) => {
    const status = within(canvasElement).getByRole('status');
    await expect(status).toHaveAttribute('aria-live', 'polite');
    await expect(status).toHaveTextContent('Round started');
    await waitFor(() => expect(status).toHaveAttribute('data-state', 'closed'), { timeout: 5000 });
    await expect(args.onOpenChange).toHaveBeenCalledWith(false);
  },
};
/** A round-start announcement uses the light theme. */
export const Light: Story = {
  name: 'Light theme',
  decorators: [withLightTheme],
  parameters: { docs: { source: { language: 'tsx', code: `import { CallOverlay } from '@jfrader/ui/call-overlay';
import { ThemeRoot } from '@jfrader/ui/theme-root';

<ThemeRoot theme="light">
  <CallOverlay defaultOpen label="Round started" />
</ThemeRoot>` } } },
};
/** Accepted, Declined, and Your turn announcements use distinct tones. */
export const Tones: Story = {
  name: 'Tones',
  parameters: { docs: { source: { language: 'tsx', code: `import { CallOverlay } from '@jfrader/ui/call-overlay';
import { styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const Row = styled.div({ display: 'flex', gap: vars.space[4], padding: vars.space[6] });

<Row>
  <CallOverlay defaultOpen tone="success">Accepted</CallOverlay>
  <CallOverlay defaultOpen tone="danger">Declined</CallOverlay>
  <CallOverlay defaultOpen tone="neutral">Your turn</CallOverlay>
</Row>` } } },
  render: () => <Row>
  <CallOverlay defaultOpen tone="success">Accepted</CallOverlay>
  <CallOverlay defaultOpen tone="danger">Declined</CallOverlay>
  <CallOverlay defaultOpen tone="neutral">Your turn</CallOverlay>
</Row> };

function ControlledExample() {
  const [open, setOpen] = useState(false);
  return <>
    <Button onClick={() => setOpen(true)} aria-disabled={open}>Announce</Button>
    <CallOverlay open={open} onOpenChange={setOpen} label="Your turn" />
  </>;
}
/** Announce opens a Your turn message that can be replayed after it closes. */
export const ControlledReopen: Story = {
  name: 'Controlled reopen',
  parameters: { docs: { source: { language: 'tsx', code: `import { useState } from 'react';
import { Button } from '@jfrader/ui/button';
import { CallOverlay } from '@jfrader/ui/call-overlay';

export function ControlledExample() {
  const [open, setOpen] = useState(false);
  return <>
    <Button onClick={() => setOpen(true)} aria-disabled={open}>Announce</Button>
    <CallOverlay open={open} onOpenChange={setOpen} label="Your turn" />
  </>;
}` } } },
  render: () => <ControlledExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button', { name: 'Announce' });
    await userEvent.click(button);
    await expect(canvas.getByRole('status')).toHaveTextContent('Your turn');
    await waitFor(() => expect(button).toHaveAttribute('aria-disabled', 'false'), { timeout: 5000 });
    await userEvent.click(button);
    await expect(canvas.getByRole('status')).toHaveAttribute('data-state', 'open');
    await expect(button).toHaveFocus();
  },
};
/** The round-start announcement fades without movement under reduced motion. */
export const ReducedMotion: Story = {
  name: 'Reduced motion',
  parameters: { docs: { source: { language: 'tsx', code: `import { CallOverlay } from '@jfrader/ui/call-overlay';

// With the system's reduced-motion preference enabled.
<CallOverlay defaultOpen label="Round started" />` } } },
  beforeEach: () => mockPreference(true),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('status')).toHaveAttribute('data-reduced-motion', 'true');
    const content = within(canvasElement).getByText('Round started');
    await expect(getComputedStyle(content).transform).toBe('none');
  },
};

function TableExample() {
  const [call, setCall] = useState(0);
  return <Frame><GameTable players={2} seats={[{ key: 'north' }, { key: 'south', isMe: true }]}>
    <GameTable.Center>Round 2</GameTable.Center>
    <GameTable.Floating sx={{ display: 'grid', placeItems: 'center', '& > *': { pointerEvents: 'none' } }}>
      <CallOverlay key={call} defaultOpen={call > 0} label="Raise" />
    </GameTable.Floating>
    <GameTable.Dock><GameActions label="Turn actions" actions={[{ key: 'raise', label: 'Raise', onSelect: () => setCall((value) => value + 1) }]} /></GameTable.Dock>
  </GameTable></Frame>;
}
/** Raise announces over a two-player table while turn actions remain available. */
export const DuringPlay: Story = {
  name: 'Over a table during play',
  render: () => <TableExample />,
  parameters: { docs: { source: { language: 'tsx', code: `import { useState } from 'react';
import { CallOverlay } from '@jfrader/ui/call-overlay';
import { GameActions } from '@jfrader/ui/game-actions';
import { GameTable } from '@jfrader/ui/game-table';
import { styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const Frame = styled.div({ position: 'relative', inlineSize: \`calc(\${vars.space[6]} * 35)\`, maxInlineSize: '100%', blockSize: \`calc(\${vars.space[6]} * 17.5)\` });

export function TableExample() {
  const [call, setCall] = useState(0);
  return <Frame>
    <GameTable players={2} seats={[{ key: 'north' }, { key: 'south', isMe: true }]}>
      <GameTable.Center>Round 2</GameTable.Center>
      <GameTable.Floating sx={{ display: 'grid', placeItems: 'center', '& > *': { pointerEvents: 'none' } }}>
        <CallOverlay key={call} defaultOpen={call > 0} label="Raise" />
      </GameTable.Floating>
      <GameTable.Dock>
        <GameActions label="Turn actions" actions={[
          { key: 'raise', label: 'Raise', onSelect: () => setCall((value) => value + 1) },
        ]} />
      </GameTable.Dock>
    </GameTable>
  </Frame>;
}` } } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Raise' }));
    await expect(canvas.getByRole('status')).toHaveTextContent('Raise');
    await expect(canvas.getByRole('button', { name: 'Raise' })).toHaveFocus();
  },
};

function ReplacementRoot(props: ComponentPropsWithRef<'div'>) { return <div {...props} data-replacement="root" />; }
/** A replacement root shows an italic announcement in right-to-left direction. */
export const CustomRoot: Story = {
  name: 'Custom root',
  parameters: { docs: { source: { language: 'tsx', code: `import type { ComponentPropsWithRef } from 'react';
import { CallOverlay } from '@jfrader/ui/call-overlay';

function ReplacementRoot(props: ComponentPropsWithRef<'div'>) {
  return <div {...props} data-replacement="root" />;
}

<CallOverlay
  defaultOpen
  label="Round started"
  component={ReplacementRoot}
  dir="rtl"
  slotProps={{ root: { title: 'Announcement' } }}
  sx={{ fontStyle: 'italic' }}
/>` } } },
  args: { component: ReplacementRoot, dir: 'rtl', slotProps: { root: { title: 'Announcement' } }, sx: { fontStyle: 'italic' } },
  play: async ({ canvasElement }) => {
    const status = within(canvasElement).getByRole('status');
    await expect(status).toHaveAttribute('data-replacement', 'root');
    await expect(status).toHaveAttribute('dir', 'rtl');
    await expect(status).toHaveAttribute('title', 'Announcement');
  },
};
