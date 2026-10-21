import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, waitFor } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { styled } from '../../styling/styled';
import { withLightTheme } from '../../testing/story-decorators';
import { expectAligned, expectInside } from '../../testing/geometry-assertions';
import { LogoOrbit } from './index';
import { Surface } from '../surface';
import { Button } from '../button';

const Frame = styled(Surface)({
  boxSizing: 'border-box',
  inlineSize: `calc(${vars.space[8]} * 24)`,
  maxInlineSize: '100%',
  padding: vars.space[6],
});
const Orbit = styled(LogoOrbit)({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  alignItems: 'start',
  gap: vars.space[4],
  '& > [data-ui="logo-orbit-filters"]': { minInlineSize: 0 },
  '& > [data-ui="logo-orbit-stage"], & > [data-ui="logo-orbit-detail"], & > [data-ui="logo-orbit-status"]': { gridColumn: '1 / -1' },
});
const PauseControl = styled(Button)({ '&&': { borderRadius: vars.radius.md } });
const items = [
  {
    id: 'mail',
    name: 'Mail',
    logo: '◇',
    category: 'Messages',
    description: 'Send updates.',
  },
  {
    id: 'files',
    name: 'Files',
    logo: '▱',
    category: 'Storage',
    description: 'Store attachments.',
    connected: true,
  },
  {
    id: 'chat',
    name: 'Chat',
    logo: '○',
    category: 'Messages',
    description: 'Post a message.',
  },
  {
    id: 'calendar',
    name: 'Calendar',
    logo: '□',
    category: 'Planning',
    description: 'Schedule a meeting.',
  },
];
const meta = {
  title: 'Showcase/LogoOrbit',
  component: LogoOrbit,
  tags: ['autodocs'],
  args: {
    items,
    center: '✳',
    onValueChange: fn(),
    onPausedChange: fn(),
    onFilterChange: fn(),
  },
  render: (args) => (
    <Frame>
      <Orbit {...args} slots={{ pauseButton: PauseControl, ...args.slots }} />
    </Frame>
  ),
  parameters: {
    layout: 'padded',
    docs: {
      sections: [
        { title: 'Explore integrations', stories: ['Default', 'Detail'] },
        { title: 'Static browsing', stories: ['ListAlternative', 'Paused'] },
      ],
      description: {
        component:
          'Show supplied integration marks in an orbit and open their details.',
      },
      usage: `### Content
Supply stable ids, names and decorative logo nodes. No logos or remote assets are bundled. Use variant="list" for a static catalog. Filters retain a selected detail even when its logo is excluded. A missing selected id shows no detail.
### Keyboard and accessibility

Tab enters one logo. Arrows move focus without selecting; Home/End jump. Horizontal arrows follow RTL. Enter/Space toggle details. Escape closes details and returns to the selected logo after an accepted request. Details are a named region, not an overlay or focus trap.
### Motion

Pause stops the orbit. Hover and focus rest the targets immediately; details, hidden pages and offscreen stages also pause. Reduced motion and speed=0 keep positions static. The semantic list order does not rotate.
### Connections

Connection requests must return a real promise. Pending blocks duplicate calls and rejection exposes Retry. Promise completion never marks an item connected: update the supplied item when your application confirms it. Without a connection handler, no connection button appears.`,
    },
  },
} satisfies Meta<typeof LogoOrbit>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  name: 'Integration catalog',
  parameters: { docs: {
    description: { story: 'Filter integrations by category and select a logo to read its details.' },
    source: { language: 'tsx', code: `import { LogoOrbit, Surface, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const Frame = styled(Surface)({
  boxSizing: 'border-box', inlineSize: '48rem', maxInlineSize: '100%', padding: vars.space[6],
});
const Orbit = styled(LogoOrbit)({
  display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'start', gap: vars.space[4],
  '& > [data-ui="logo-orbit-filters"]': { minInlineSize: 0 },
  '& > [data-ui="logo-orbit-stage"], & > [data-ui="logo-orbit-detail"], & > [data-ui="logo-orbit-status"]': { gridColumn: '1 / -1' },
});
const integrations = [
  { id: 'mail', name: 'Mail', logo: '◇', category: 'Messages', description: 'Send updates.' },
  { id: 'files', name: 'Files', logo: '▱', category: 'Storage', description: 'Store attachments.', connected: true },
  { id: 'chat', name: 'Chat', logo: '○', category: 'Messages', description: 'Post a message.' },
  { id: 'calendar', name: 'Calendar', logo: '□', category: 'Planning', description: 'Schedule a meeting.' },
];

<Frame><Orbit items={integrations} center="✳"
  slotProps={{ pauseButton: { sx: { borderRadius: vars.radius.md } } }}
/></Frame>` },
  } },
};
export const Light: Story = {
  globals: { theme: 'light' },
  decorators: [withLightTheme],
};
export const RTL: Story = {
  args: { dir: 'rtl', defaultPaused: true },
  play: async ({ canvasElement }) => {
    const stage = canvasElement.querySelector<HTMLElement>('[data-ui="logo-orbit-stage"]')!;
    const center = canvasElement.querySelector<HTMLElement>('[data-ui="logo-orbit-center"]')!;
    await expectAligned([stage, center], 'center-x');
    await expectAligned([stage, center], 'center-y');
    for (const pseudo of ['::before', '::after']) {
      const style = getComputedStyle(stage, pseudo);
      const translation = new DOMMatrixReadOnly(style.transform).m41;
      await expect(Math.abs(parseFloat(style.left) + translation + parseFloat(style.width) / 2 - stage.clientWidth / 2)).toBeLessThan(1);
    }
  },
};

export const LongContent: Story = {
  args: {
    variant: 'list',
    defaultValue: 'long',
    items: [{
      id: 'long',
      name: 'InternationalIntegrationWithoutWordSeparators',
      logo: '◇',
      category: 'InternationalMessagingAndCollaboration',
      description: 'HardwareKeySynchronizationAndMutualVerification'.repeat(3),
    }],
    labels: {
      previous: 'PreviousIntegrationWithoutWordSeparators',
      next: 'NextIntegrationWithoutWordSeparators',
    },
    sx: { inlineSize: '16rem', maxInlineSize: '100%' },
  },
  play: async ({ canvasElement, canvas, userEvent }) => {
    const root = canvasElement.querySelector<HTMLElement>('[data-ui="logo-orbit"]')!;
    await expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth);
    for (const button of root.querySelectorAll('button')) {
      await expectInside(button, root);
      await expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(32);
    }
    const logo = canvas.getByRole('button', { name: 'InternationalIntegrationWithoutWordSeparators' });
    logo.focus();
    await userEvent.keyboard('{Escape}');
    await expect(canvas.queryByRole('region')).toBeNull();
    await expect(logo).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await expect(canvas.getByRole('region')).toBeVisible();
  },
};
export const ListAlternative: Story = {
  name: 'Static list',
  args: { variant: 'list' },
  parameters: {
    docs: {
      description: { story: 'Browse the same catalog without an orbit.' },
      source: {
        language: 'tsx',
        code: `import { LogoOrbit } from '@jfrader/ui';

<LogoOrbit variant="list" center="✳" items={[
  { id: 'mail', name: 'Mail', logo: '◇', category: 'Messages', description: 'Send updates.' },
  { id: 'files', name: 'Files', logo: '▱', category: 'Storage', description: 'Store attachments.', connected: true },
  { id: 'chat', name: 'Chat', logo: '○', category: 'Messages', description: 'Post a message.' },
  { id: 'calendar', name: 'Calendar', logo: '□', category: 'Planning', description: 'Schedule a meeting.' },
]} />`,
      },
    },
  },
};
export const Paused: Story = {
  name: 'Paused orbit',
  args: { defaultPaused: true },
  parameters: { docs: {
    description: { story: 'Start with stationary logos and use Resume to begin rotation.' },
    source: { language: 'tsx', code: `import { LogoOrbit } from '@jfrader/ui';

<LogoOrbit defaultPaused center="✳" items={[
  { id: 'mail', name: 'Mail', logo: '◇', category: 'Messages', description: 'Send updates.' },
  { id: 'files', name: 'Files', logo: '▱', category: 'Storage', description: 'Store attachments.', connected: true },
  { id: 'chat', name: 'Chat', logo: '○', category: 'Messages', description: 'Post a message.' },
  { id: 'calendar', name: 'Calendar', logo: '□', category: 'Planning', description: 'Schedule a meeting.' },
]} />` },
  } },
};
export const ReducedMotion: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Enable reduced motion in your browser to keep the orbit static.',
      },
    },
  },
};
export const ForcedColors: Story = {
  args: { defaultValue: 'mail', defaultPaused: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
    await expect(canvas.getByRole('button', { name: 'Mail' })).toHaveAttribute('aria-pressed', 'true');
    await expect(canvas.getByRole('region', { name: 'Mail' })).toBeVisible();
  },
};
export const Detail: Story = {
  name: 'Selected integration',
  args: { defaultValue: 'mail' },
  parameters: { docs: {
    description: { story: 'Read Mail details while the selected logo rests.' },
    source: { language: 'tsx', code: `import { LogoOrbit } from '@jfrader/ui';

<LogoOrbit defaultValue="mail" center="✳" items={[
  { id: 'mail', name: 'Mail', logo: '◇', category: 'Messages', description: 'Send updates.' },
  { id: 'files', name: 'Files', logo: '▱', category: 'Storage', description: 'Store attachments.', connected: true },
  { id: 'chat', name: 'Chat', logo: '○', category: 'Messages', description: 'Post a message.' },
  { id: 'calendar', name: 'Calendar', logo: '□', category: 'Planning', description: 'Schedule a meeting.' },
]} />` },
  } },
};
export const Empty: Story = {
  args: { items: [] },
  play: async ({ canvasElement, canvas }) => {
    const stage = canvasElement.querySelector<HTMLElement>('[data-ui="logo-orbit-stage"]')!;
    const pause = canvas.getByRole('button', { name: 'Pause' });
    await expect(stage.getBoundingClientRect().top).toBeGreaterThanOrEqual(pause.getBoundingClientRect().bottom);
    await expect(stage).toHaveTextContent('No integrations');
  },
};
export const NoMatches: Story = { args: { defaultFilter: 'Unknown' } };
export const Keyboard: Story = {
  tags: ['!autodocs'],
  args: { defaultPaused: true },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    await expect(canvas.queryByRole('status')).toBeNull();
    const mail = canvas.getByRole('button', { name: 'Mail' });
    mail.focus();
    await expect(
      canvas.getByRole('list', { name: 'Integrations' }),
    ).toBeVisible();
    await userEvent.keyboard('{ArrowRight}');
    await expect(canvas.getByRole('button', { name: 'Files' })).toHaveFocus();
    await userEvent.keyboard('{End}');
    await expect(
      canvas.getByRole('button', { name: 'Calendar' }),
    ).toHaveFocus();
    await userEvent.keyboard('{Home}{Enter}');
    await expect(
      await canvas.findByRole('region', { name: 'Mail' }),
    ).toBeVisible();
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(canvas.queryByRole('heading')).toBeNull();
    await expect(args.onValueChange).toHaveBeenCalledWith('mail');
    await expect(canvasElement.ownerDocument.activeElement).toBe(mail);
    await expect(getComputedStyle(mail).outlineStyle).not.toBe('none');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(canvas.queryByRole('region')).toBeNull());
    await expect(mail).toHaveFocus();
  },
};
export const RejectedSelection: Story = {
  tags: ['!autodocs'],
  args: { value: null, defaultPaused: true },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Mail' }));
    await expect(args.onValueChange).toHaveBeenCalledWith('mail');
    await expect(canvas.queryByRole('region')).toBeNull();
  },
};
export const FailedRetry: Story = {
  tags: ['!autodocs'],
  args: {
    defaultValue: 'mail',
    onConnect: fn(async () => {
      throw new Error('Unavailable');
    }),
  },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Connect' }));
    await expect(
      await canvas.findByRole('button', { name: 'Retry' }),
    ).toBeVisible();
    await expect(canvas.getByRole('status')).toHaveTextContent(
      'Mail: connection failed',
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Retry' }));
    await expect(args.onConnect).toHaveBeenCalledTimes(2);
  },
};
export const ConsumerConfirmation: Story = {
  tags: ['!autodocs'],
  args: { defaultValue: 'mail', onConnect: fn(async () => {}) },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Connect' }));
    await expect(args.onConnect).toHaveBeenCalledTimes(1);
    await expect(args.onConnect).toHaveBeenCalledWith('mail');
    await expect(canvas.getByText('Not connected')).toBeVisible();
  },
};
