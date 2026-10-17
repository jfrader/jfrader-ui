import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, waitFor } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { styled } from '../../styling/styled';
import { Button } from '../button';
import { Skeleton, type SkeletonMorphProps, type SkeletonMorphValue } from './index';

const Frame = styled.div({ display: 'grid', gap: vars.space[4], inlineSize: '20rem', maxInlineSize: '100%' });
const Profile = styled(Skeleton.Morph)({ display: 'grid', gap: vars.space[3], padding: vars.space[4], border: `1px solid ${vars.color.border}`, borderRadius: vars.radius.md });
const Text = styled.p({ margin: 0, color: vars.color.text, fontFamily: vars.font.sans, lineHeight: vars.lineHeight.base });
const snippet = `<Skeleton.Morph value={profile ? 'ready' : 'loading'} loadingLabel="Loading profile">
  <Skeleton.Block circle width={48} height={48}>{avatar}</Skeleton.Block>
  <Skeleton.Block lines={2}><p>{profile?.name}</p></Skeleton.Block>
</Skeleton.Morph>`;

function Demo(args: SkeletonMorphProps) {
  const [value, setValue] = useState<SkeletonMorphValue>(args.value ?? args.defaultValue ?? 'loading');
  return <Frame>
    <Profile {...args} value={value}>
      <Skeleton.Block circle width={48} height={48}><Text>ML</Text></Skeleton.Block>
      <Skeleton.Block lines={2}><Text>Morgan Lee</Text><Text>Product designer</Text></Skeleton.Block>
      <Skeleton.Block width="70%" height={40}><Button onClick={() => setValue('loading')}>Reload profile</Button></Skeleton.Block>
    </Profile>
    <Button onClick={() => setValue('ready')}>Load profile</Button>
  </Frame>;
}

const meta = {
  title: 'Feedback/Skeleton',
  component: Skeleton.Morph,
  tags: ['!autodocs'],
  args: { loadingLabel: 'Loading profile', readyLabel: 'Profile loaded' },
  render: (args) => <Demo {...args} />,
  parameters: { docs: { source: { code: snippet, language: 'tsx' }, description: {
    component: 'Replace reserved loading blocks with content in place.',
  }, usage: 'Use Skeleton.Morph with Skeleton.Block for a known layout. Loading content is unmounted; ready content is immediately accessible. Tab follows consumer controls. Reload parks focus on the shell only when a focused control is removed. value controls the passive presentation; defaultValue seeds a static state. Errors and empty states are consumer content. Reduced motion swaps immediately.' } },
} satisfies Meta<typeof Skeleton.Morph>;
export default meta;
type Story = StoryObj<typeof meta>;

export const MorphProfile: Story = {
  play: async ({ canvas, canvasElement, userEvent }) => {
    const root = canvasElement.querySelector('[data-ui="skeleton-morph"]')!;
    await expect(root).toHaveAttribute('aria-busy', 'true');
    await expect(canvas.queryByRole('button', { name: 'Reload profile' })).toBeNull();
    const placeholders = canvasElement.querySelectorAll('[data-ui="skeleton"]');
    await expect(placeholders.length).toBe(4);
    await expect(placeholders[0]!.getBoundingClientRect().width).toBe(48);
    await userEvent.tab();
    const load = canvas.getByRole('button', { name: 'Load profile' });
    await expect(load.ownerDocument.activeElement).toBe(load);
    await userEvent.keyboard('{Enter}');
    await expect(root).toHaveAttribute('aria-busy', 'false');
    await expect(canvas.getByRole('button', { name: 'Reload profile' })).toBeVisible();
    await expect(root.ownerDocument.activeElement).toBe(load);
    await expect(canvas.getByRole('status')).toHaveTextContent('Profile loaded');
  },
};
export const MorphReady: Story = { args: { defaultValue: 'ready' } };
export const MorphLight: Story = { ...MorphProfile, globals: { theme: 'light' } };
export const MorphReloadFocus: Story = {
  args: { defaultValue: 'ready' },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const root = canvasElement.querySelector<HTMLElement>('[data-ui="skeleton-morph"]')!;
    await userEvent.tab();
    const reload = canvas.getByRole('button', { name: 'Reload profile' });
    await expect(root.ownerDocument.activeElement).toBe(reload);
    await userEvent.keyboard(' ');
    await expect(root).toHaveAttribute('aria-busy', 'true');
    await expect(root.ownerDocument.activeElement).toBe(root);
    await expect(getComputedStyle(root).outlineStyle).not.toBe('none');
    await userEvent.tab();
    await expect(root.ownerDocument.activeElement).toBe(canvas.getByRole('button', { name: 'Load profile' }));
  },
};
export const MorphReducedMotion: Story = {
  ...MorphProfile,
  play: async (context) => {
    await expect(window.matchMedia('(prefers-reduced-motion: reduce)').matches).toBe(true);
    for (const placeholder of context.canvasElement.querySelectorAll('[data-ui="skeleton"]')) {
      await expect(getComputedStyle(placeholder).animationName).toBe('none');
    }
    await MorphProfile.play!(context);
    const root = context.canvasElement.querySelector<HTMLElement>('[data-ui="skeleton-morph"]')!;
    await expect(root.style.transform).toBe('');
  },
};
export const MorphZero: Story = {
  render: (args) => <Skeleton.Morph {...args} defaultValue="ready"><Skeleton.Block>{0}</Skeleton.Block></Skeleton.Morph>,
  play: async ({ canvas }) => { await expect(canvas.getByText('0')).toBeVisible(); },
};
export const MorphAria: Story = {
  render: (args) => <Frame><Text id="profile-description">Public profile</Text><Skeleton.Morph {...args} aria-describedby="profile-description"><Skeleton.Block lines={2}>Morgan Lee</Skeleton.Block></Skeleton.Morph></Frame>,
  play: async ({ canvasElement, canvas }) => {
    const root = canvasElement.querySelector('[data-ui="skeleton-morph"]')!;
    await waitFor(async () => { await expect(root).toHaveAccessibleDescription('Public profile Loading profile'); });
    await expect(root.contains(canvas.getByRole('status'))).toBe(false);
  },
};

export const MorphTextDimensions: Story = {
  render: (args) => (
    <Frame>
      <Skeleton.Morph {...args} animateLayout={false}>
        <Skeleton.Block lines={3} width="80%" lineHeight={16} lastLineWidth="50%">Profile text</Skeleton.Block>
      </Skeleton.Morph>
    </Frame>
  ),
  play: async ({ canvasElement }) => {
    const lines = canvasElement.querySelectorAll<HTMLElement>('[data-ui="skeleton"]');
    await expect(lines).toHaveLength(3);
    const first = lines[0]!.getBoundingClientRect();
    const last = lines[2]!.getBoundingClientRect();
    await expect(first.height).toBe(16);
    await expect(last.width).toBeCloseTo(first.width / 2);
  },
};

export const MorphInvalidLines: Story = {
  render: (args) => <Skeleton.Morph {...args}><Skeleton.Block lines={0}>Profile text</Skeleton.Block></Skeleton.Morph>,
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelectorAll('[data-ui="skeleton"]')).toHaveLength(1);
  },
};

export const MorphRTL: Story = {
  args: { dir: 'rtl' },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[data-ui="skeleton-morph"]')!.matches(':dir(rtl)')).toBe(true);
  },
};
