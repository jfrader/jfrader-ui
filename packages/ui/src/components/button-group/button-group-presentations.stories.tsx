import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState, type MouseEventHandler } from 'react';
import { expect, fn, waitFor, within } from 'storybook/test';
import { withLightTheme } from '../../testing/story-decorators';
import { ButtonGroup, type ButtonGroupCompoundProps, type ButtonGroupEasyProps } from './index';
import { Button } from '../button';

function ActionIcon() {
  return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 8h10M8 3v10" /></svg>;
}

const floatingCode = `<ButtonGroup aria-label="Board actions" presentation="floating">
  <ButtonGroup.Item onClick={undo}>Undo</ButtonGroup.Item>
  <ButtonGroup.Item onClick={redo}>Redo</ButtonGroup.Item>
  <ButtonGroup.Separator orientation="vertical" />
  <ButtonGroup.Item onClick={share}>Share</ButtonGroup.Item>
</ButtonGroup>`;
const expandingCode = `<ButtonGroup aria-label="Message actions" presentation="expanding" restValue="reply">
  <ButtonGroup.Item id="reply" startIcon={<ReplyIcon />} onClick={reply}>Reply</ButtonGroup.Item>
  <ButtonGroup.Item id="forward" startIcon={<ForwardIcon />} onClick={forward}>Forward</ButtonGroup.Item>
  <ButtonGroup.Item id="archive" startIcon={<ArchiveIcon />} onClick={archive}>Archive</ButtonGroup.Item>
</ButtonGroup>`;

const meta = {
  title: 'Actions/ButtonGroup',
  component: ButtonGroup,
  tags: ['autodocs'],
  args: { 'aria-label': 'Message actions', presentation: 'expanding', restValue: 'reply' },
  parameters: { docs: {
    description: { component: 'Place related actions in a pill tray, or reveal one icon action’s label at a time.' },
    source: { language: 'tsx', code: expandingCode },
  } },
  render: (args) => (
    <ButtonGroup {...args}>
      <ButtonGroup.Item id="reply" startIcon={<ActionIcon />}>Reply</ButtonGroup.Item>
      <ButtonGroup.Item id="forward" startIcon={<ActionIcon />}>Forward</ButtonGroup.Item>
      <ButtonGroup.Item id="archive" startIcon={<ActionIcon />}>Archive</ButtonGroup.Item>
    </ButtonGroup>
  ),
} satisfies Meta<ButtonGroupCompoundProps>;
export default meta;
type Story = StoryObj<Omit<ButtonGroupCompoundProps, 'component' | 'onClick'> & { onClick?: MouseEventHandler<HTMLElement> }>;

/** Keep board commands in a pill tray. Position the tray in your layout or a Popover. */
export const Floating: Story = {
  args: { presentation: 'floating', 'aria-label': 'Board actions' },
  parameters: { docs: { source: { code: floatingCode } } },
  render: (args) => (
    <ButtonGroup {...args}>
      <ButtonGroup.Item>Undo</ButtonGroup.Item>
      <ButtonGroup.Item>Redo</ButtonGroup.Item>
      <ButtonGroup.Separator orientation="vertical" />
      <ButtonGroup.Item>Share</ButtonGroup.Item>
    </ButtonGroup>
  ),
  play: async ({ canvas }) => {
    const group = canvas.getByRole('group', { name: 'Board actions' });
    await expect(group).not.toHaveAttribute('aria-orientation');
    await expect(group).toHaveAttribute('data-presentation', 'floating');
    const separator = canvas.getByRole('separator');
    await expect(separator).toHaveAttribute('aria-orientation', 'vertical');
    await expect(separator).toBeVisible();
    const separatorRect = separator.getBoundingClientRect();
    await expect(separatorRect.width).toBeGreaterThan(0);
    await expect(separatorRect.height).toBeGreaterThan(separatorRect.width);
    const items = within(group).getAllByRole('button');
    for (const item of items) {
      await expect(parseFloat(getComputedStyle(item).borderStartStartRadius)).toBeGreaterThan(0);
      await expect(parseFloat(getComputedStyle(item).borderStartEndRadius)).toBeGreaterThan(0);
    }
    await expect(items[1]!.getBoundingClientRect().left).toBeGreaterThan(items[0]!.getBoundingClientRect().right);
  },
};

/** Move the pointer or focus an action to reveal its label. */
export const Expanding: Story = {
  play: async ({ canvas, userEvent }) => {
    const surface = getComputedStyle(canvas.getByRole('group'));
    await expect(surface.backgroundColor).toBe('rgba(0, 0, 0, 0)');
    await expect(surface.boxShadow).toBe('none');
    const reply = canvas.getByRole('button', { name: 'Reply' });
    const forward = canvas.getByRole('button', { name: 'Forward' });
    await expect(reply).toHaveAttribute('data-expanded', 'true');
    await expect(forward).toHaveAttribute('data-expanded', 'false');
    await userEvent.hover(forward);
    await waitFor(async () => { await expect(forward).toHaveAttribute('data-expanded', 'true'); });
    await waitFor(async () => { await expect(forward.getBoundingClientRect().width).toBeGreaterThan(reply.getBoundingClientRect().width); });
    await userEvent.unhover(forward);
    await waitFor(async () => { await expect(reply).toHaveAttribute('data-expanded', 'true'); });
  },
};

export const FloatingLight: Story = { ...Floating, globals: { theme: 'light' }, decorators: [withLightTheme] };
export const ExpandingLight: Story = { ...Expanding, globals: { theme: 'light' }, decorators: [withLightTheme] };

/** Tab visits every enabled action; Enter and Space activate without a reveal-only tap. */
export const ExpandingKeyboard: Story = {
  args: { onClick: fn() },
  render: ({ onClick, ...args }) => (
    <ButtonGroup {...args}>
      <ButtonGroup.Item id="reply" startIcon={<ActionIcon />} onClick={onClick}>Reply</ButtonGroup.Item>
      <ButtonGroup.Item id="forward" startIcon={<ActionIcon />} onClick={onClick}>Forward</ButtonGroup.Item>
      <ButtonGroup.Item id="unavailable" startIcon={<ActionIcon />} disabled>Unavailable</ButtonGroup.Item>
      <ButtonGroup.Item id="archive" startIcon={<ActionIcon />} onClick={onClick}>Archive</ButtonGroup.Item>
    </ButtonGroup>
  ),
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const reply = canvas.getByRole('button', { name: 'Reply' });
    const forward = canvas.getByRole('button', { name: 'Forward' });
    const archive = canvas.getByRole('button', { name: 'Archive' });
    canvasElement.tabIndex = -1;
    canvasElement.focus();
    await userEvent.tab();
    canvasElement.removeAttribute('tabindex');
    await expect(canvasElement.ownerDocument.activeElement).toBe(reply);
    await expect(getComputedStyle(reply).outlineStyle).not.toBe('none');
    await userEvent.tab();
    await expect(forward).toHaveFocus();
    await expect(forward).toHaveAttribute('data-expanded', 'true');
    await userEvent.tab();
    await expect(archive).toHaveFocus();
    await userEvent.tab({ shift: true });
    await expect(forward).toHaveFocus();
    await userEvent.keyboard('{End}{ArrowRight}{Home}');
    await expect(reply).toHaveFocus();
    await expect(args.onClick).not.toHaveBeenCalled();
    await userEvent.keyboard('{Enter}[Space]');
    await expect(args.onClick).toHaveBeenCalledTimes(2);
    await expect(reply).not.toHaveAttribute('aria-expanded');
    await expect(reply).not.toHaveAttribute('aria-pressed');
    await userEvent.tab();
    await userEvent.click(canvas.getByRole('group'));
  },
};

export const ExpandingControlledReject: Story = {
  args: { value: 'reply', onValueChange: fn() },
  play: async ({ canvas, userEvent, args }) => {
    const forward = canvas.getByRole('button', { name: 'Forward' });
    canvas.getByRole('button', { name: 'Reply' }).focus();
    await userEvent.keyboard('{ArrowRight}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith('forward');
    await expect(forward).toHaveAttribute('data-expanded', 'false');
    await expect(canvas.getByRole('button', { name: 'Reply' })).toHaveAttribute('data-expanded', 'true');
  },
};

export const ExpandingDefaultValue: Story = {
  args: { defaultValue: 'archive' },
  play: async ({ canvas, userEvent }) => {
    const archive = canvas.getByRole('button', { name: 'Archive' });
    await expect(archive).toHaveAttribute('data-expanded', 'true');
    await userEvent.hover(archive);
    await userEvent.unhover(archive);
    await expect(canvas.getByRole('button', { name: 'Reply' })).toHaveAttribute('data-expanded', 'true');
  },
};

export const ExpandingInvalidValue: Story = {
  args: { value: 'missing', restValue: 'missing', onValueChange: fn() },
  play: async ({ canvas, args }) => {
    await expect(canvas.getByRole('button', { name: 'Reply' })).toHaveAttribute('data-expanded', 'true');
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};

export const ExpandingRTL: Story = {
  args: { dir: 'rtl' },
  play: async ({ canvas, userEvent }) => {
    const reply = canvas.getByRole('button', { name: 'Reply' });
    reply.focus();
    await userEvent.keyboard('{ArrowLeft}');
    const forward = canvas.getByRole('button', { name: 'Forward' });
    await expect(forward).toHaveFocus();
    await expect(forward).toHaveAttribute('data-expanded', 'true');
    await expect(reply.getBoundingClientRect().right).toBeGreaterThan(forward.getBoundingClientRect().right);
  },
};
export const FloatingRTL: Story = {
  ...Floating,
  args: { ...Floating.args, dir: 'rtl' },
  play: undefined,
  parameters: { docs: { source: { code: `<ButtonGroup aria-label="Board actions" presentation="floating" dir="rtl">
  <ButtonGroup.Item>Undo</ButtonGroup.Item>
  <ButtonGroup.Item>Redo</ButtonGroup.Item>
  <ButtonGroup.Separator orientation="vertical" />
  <ButtonGroup.Item>Share</ButtonGroup.Item>
</ButtonGroup>` } } },
};
export const FloatingVertical: Story = {
  ...Floating,
  args: { ...Floating.args, orientation: 'vertical' },
  render: (args) => (
    <ButtonGroup {...args}>
      <ButtonGroup.Item>Undo</ButtonGroup.Item>
      <ButtonGroup.Item>Redo</ButtonGroup.Item>
      <ButtonGroup.Separator />
      <ButtonGroup.Item>Share</ButtonGroup.Item>
    </ButtonGroup>
  ),
  play: async ({ canvas }) => {
    const separator = canvas.getByRole('separator');
    await expect(separator).toBeVisible();
    await expect(separator).toHaveAttribute('aria-orientation', 'horizontal');
    const rect = separator.getBoundingClientRect();
    await expect(rect.width).toBeGreaterThan(0);
    await expect(rect.height).toBeGreaterThan(0);
    await expect(rect.width).toBeGreaterThan(rect.height);
  },
  parameters: { docs: { source: { code: `<ButtonGroup aria-label="Board actions" presentation="floating" orientation="vertical">
  <ButtonGroup.Item>Undo</ButtonGroup.Item>
  <ButtonGroup.Item>Redo</ButtonGroup.Item>
  <ButtonGroup.Separator />
  <ButtonGroup.Item>Share</ButtonGroup.Item>
</ButtonGroup>` } } },
};

/** Enable reduced motion in your browser; labels change without a width spring. */
export const ExpandingReducedMotion: Story = {};
/** Enable reduced motion in your browser; the shared highlight moves immediately. */
export const FloatingReducedMotion: Story = { ...Floating };

export const ExpandingEasyMode: StoryObj<Omit<ButtonGroupEasyProps, 'component'>> = {
  args: {
    presentation: 'expanding', label: 'Message actions',
    items: [
      { id: 'reply', label: 'Reply', startIcon: <ActionIcon /> },
      { id: 'archive', label: 'Archive', startIcon: <ActionIcon /> },
    ],
  },
  render: (args) => <ButtonGroup {...args} />,
  parameters: { docs: { source: { code: `<ButtonGroup label="Message actions" presentation="expanding" items={[
  { id: 'reply', label: 'Reply', startIcon: <ReplyIcon />, onClick: reply },
  { id: 'archive', label: 'Archive', startIcon: <ArchiveIcon />, onClick: archive },
]} />` } } },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Archive' }));
    await expect(canvas.getByRole('button', { name: 'Archive' })).toHaveAttribute('data-expanded', 'true');
  },
};

/** Items without an id or icon, and links, keep their full label. */
export const ExpandingLabelledFallback: Story = {
  render: (args) => (
    <ButtonGroup {...args}>
      <ButtonGroup.Item startIcon={<ActionIcon />}>Reply</ButtonGroup.Item>
      <ButtonGroup.Item id="archive">Archive</ButtonGroup.Item>
      <ButtonGroup.Link href="#guide">Guide</ButtonGroup.Link>
    </ButtonGroup>
  ),
  parameters: { docs: { source: { code: `<ButtonGroup aria-label="Message actions" presentation="expanding">
  <ButtonGroup.Item startIcon={<ReplyIcon />}>Reply</ButtonGroup.Item>
  <ButtonGroup.Item id="archive">Archive</ButtonGroup.Item>
  <ButtonGroup.Link href="/guide">Guide</ButtonGroup.Link>
</ButtonGroup>` } } },
  play: async ({ canvas }) => {
    for (const button of canvas.getAllByRole('button')) await expect(button).not.toHaveAttribute('data-expanded');
    await expect(canvas.getByRole('link', { name: 'Guide' })).toBeVisible();
  },
};

function AvailabilityExample({ onValueChange }: Pick<ButtonGroupCompoundProps, 'onValueChange'>) {
  const [available, setAvailable] = useState(true);
  const [removed, setRemoved] = useState(false);
  return <>
    <ButtonGroup aria-label="Available actions" presentation="expanding" value="reply" restValue="reply" onValueChange={onValueChange}>
      {!removed && <ButtonGroup.Item id="reply" disabled={!available} startIcon={<ActionIcon />} onKeyDown={(event) => {
        if (event.key === 'Delete') setRemoved(true);
        if (event.key === 'Backspace') setAvailable(false);
      }}>Reply</ButtonGroup.Item>}
      <ButtonGroup.Item id="forward" startIcon={<ActionIcon />}>Forward</ButtonGroup.Item>
    </ButtonGroup>
    <Button onClick={() => setAvailable(!available)}>Change availability</Button>
    <Button onClick={() => setRemoved(true)}>Remove reply</Button>
  </>;
}

/** A disabled or removed resting action falls back to the next enabled action. */
export const ExpandingAvailability: Story = {
  args: { onValueChange: fn() },
  render: ({ onValueChange }) => <AvailabilityExample onValueChange={onValueChange} />,
  parameters: { docs: { source: { code: `<ButtonGroup aria-label="Available actions" presentation="expanding" restValue="reply">
  <ButtonGroup.Item id="reply" disabled={!canReply} startIcon={<ReplyIcon />}>Reply</ButtonGroup.Item>
  <ButtonGroup.Item id="forward" startIcon={<ForwardIcon />}>Forward</ButtonGroup.Item>
</ButtonGroup>` } } },
  play: async ({ canvas, userEvent, args }) => {
    const reply = canvas.getByRole('button', { name: 'Reply' });
    const forward = canvas.getByRole('button', { name: 'Forward' });
    await expect(reply).toHaveAttribute('data-expanded', 'true');
    await userEvent.click(canvas.getByRole('button', { name: 'Change availability' }));
    await waitFor(async () => { await expect(forward).toHaveAttribute('data-expanded', 'true'); });
    await expect(reply).toBeDisabled();
    await userEvent.click(canvas.getByRole('button', { name: 'Change availability' }));
    await waitFor(async () => { await expect(reply).toHaveAttribute('data-expanded', 'true'); });
    await userEvent.click(canvas.getByRole('button', { name: 'Remove reply' }));
    await waitFor(async () => { await expect(forward).toHaveAttribute('data-expanded', 'true'); });
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(canvas.getByRole('button', { name: 'Remove reply' })).toHaveFocus();
  },
};

export const ExpandingFocusRecovery: Story = {
  ...ExpandingAvailability,
  tags: ['!autodocs'],
  play: async ({ canvas, canvasElement, userEvent }) => {
    const reply = canvas.getByRole('button', { name: 'Reply' });
    const forward = canvas.getByRole('button', { name: 'Forward' });
    reply.focus();
    await expect(reply).toHaveAttribute('data-expanded', 'true');
    await userEvent.keyboard('{Backspace}');
    await waitFor(async () => { await expect(forward).toHaveFocus(); });
    await expect(canvasElement.ownerDocument.activeElement).not.toBe(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole('button', { name: 'Change availability' }));
    reply.focus();
    await expect(reply).toHaveAttribute('data-expanded', 'true');
    await userEvent.keyboard('{Delete}');
    await waitFor(async () => { await expect(forward).toHaveFocus(); });
    await expect(reply).not.toBeInTheDocument();
    await expect(canvasElement.ownerDocument.activeElement).not.toBe(canvasElement.ownerDocument.body);
  },
};

function ControlledExample({ onValueChange }: Pick<ButtonGroupCompoundProps, 'onValueChange'>) {
  const [value, setValue] = useState('reply');
  return <ButtonGroup aria-label="Controlled actions" presentation="expanding" value={value} onValueChange={(next) => {
    onValueChange?.(next);
    setValue(next);
  }}>
    <ButtonGroup.Item id="reply" startIcon={<ActionIcon />}>Reply</ButtonGroup.Item>
    <ButtonGroup.Item id="forward" startIcon={<ActionIcon />}>Forward</ButtonGroup.Item>
  </ButtonGroup>;
}

export const ExpandingControlled: Story = {
  args: { onValueChange: fn() },
  render: ({ onValueChange }) => <ControlledExample onValueChange={onValueChange} />,
  parameters: { docs: { source: { code: `const [value, setValue] = useState('reply');

<ButtonGroup aria-label="Controlled actions" presentation="expanding" value={value} onValueChange={setValue}>
  <ButtonGroup.Item id="reply" startIcon={<ReplyIcon />}>Reply</ButtonGroup.Item>
  <ButtonGroup.Item id="forward" startIcon={<ForwardIcon />}>Forward</ButtonGroup.Item>
</ButtonGroup>` } } },
  play: async ({ canvas, userEvent, args }) => {
    const reply = canvas.getByRole('button', { name: 'Reply' });
    const forward = canvas.getByRole('button', { name: 'Forward' });
    reply.focus();
    await userEvent.keyboard('{ArrowRight}');
    await expect(forward).toHaveAttribute('data-expanded', 'true');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith('forward');
    await userEvent.hover(reply);
    await userEvent.unhover(reply);
    await expect(forward).toHaveFocus();
    await expect(forward).toHaveAttribute('data-expanded', 'true');
  },
};
