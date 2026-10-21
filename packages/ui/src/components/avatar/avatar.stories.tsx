import { StrictMode, createRef, type ComponentPropsWithRef } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { renderToString } from 'react-dom/server';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, waitFor, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { withLightTheme } from '../../testing/story-decorators';
import { Avatar, type AvatarSize, type AvatarStatus } from './index';
import { PersonAvatar } from '../person-avatar';
import { AvatarGroup } from '../avatar-group';
import { Flex } from '../flex';
import { Button } from '../button';
import { sceneSource } from '../scene';
import { styled } from '../../styling/styled';

const SIZES = ['sm', 'md', 'lg'] as const satisfies readonly AvatarSize[];
const SIZE_PX = { sm: 24, md: 32, lg: 40 } as const;
const STATUSES = ['online', 'away', 'busy', 'offline'] as const satisfies readonly AvatarStatus[];
const NAME = 'Ada Lovelace';

const PHOTO_SRC = sceneSource('avatar-ada');
const BROKEN_SRC = 'data:image/png;base64,broken';

const meta = {
  title: 'Data display/Avatar',
  component: Avatar,
  parameters: {
    docs: {
      description: { component: 'Show a person’s portrait, photo or initials, with an optional status.' },
      sections: [
        { title: 'Basic', stories: ['Default'] },
        { title: 'Images and fallbacks', stories: ['SceneImage', 'PhotoWithArtworkFallback', 'Initials'] },
        { title: 'Sizes', stories: ['Sizes'] },
        { title: 'Status', stories: ['Status', 'OnlinePulse'] },
        { title: 'Group composition', stories: ['Team'] },
      ],
      usage: `### When to use
Identify a person beside a message, task or profile. Use AvatarGroup for a compact list of people and PersonAvatar for generated portrait artwork.

### Content and accessibility

Keep fallback artwork noninteractive and decorative so the identity is announced once. Use a durable member id for generated portraits. Provide a separate named button or link for profile actions; the avatar itself is not a keyboard target.

An external accessible label takes precedence over the generated name and status. Localize presence labels with the surrounding interface. Presence is not a live announcement; use a separate status message for changes that need attention.

Reduced motion and forced colors hide the pulsing ring. The image examples use generated Scene artwork; a photo URL uses the same image path.`,
    },
  },
  args: { name: NAME, size: 'md' },
  argTypes: {
    size: { control: 'radio', options: SIZES },
    status: { control: 'select', options: [undefined, ...STATUSES] },
  },
} satisfies Meta<typeof Avatar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Person portrait',
  parameters: { docs: { description: { story: 'Frame a generated portrait with one accessible person name.' }, source: { language: 'tsx', code: `import { Avatar, PersonAvatar } from '@jfrader/ui';

<Avatar name="Ada Lovelace">
  <PersonAvatar seed="member-ada" alt="" size="full" crop="circle" />
</Avatar>` } } },
  args: { children: <PersonAvatar seed="member-ada" alt="" size="full" crop="circle" /> },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByRole('img')).toHaveLength(1);
    const avatar = canvas.getByRole('img', { name: NAME });
    await expect(avatar.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    await expect(avatar.querySelector('svg')).toHaveAttribute('viewBox', '0 0 48 48');
  },
};

/** Procedural Scene artwork loaded through the native image path. */
export const SceneImage: Story = {
  name: 'Native image',
  parameters: { docs: { description: { story: 'Load an image URL through the native image path; this image is generated Scene artwork.' }, source: { language: 'tsx', code: `import { Avatar } from '@jfrader/ui';
import { sceneSource } from '@jfrader/ui/scene';

<Avatar name="Ada Lovelace" src={sceneSource('avatar-ada')} />` } } },
  args: { src: PHOTO_SRC },
  play: async ({ canvasElement }) => {
    const avatar = within(canvasElement).getByRole('img', { name: NAME });
    const photo = avatar.querySelector('img');
    await expect(photo).not.toBeNull();
    await expect(photo).toHaveAttribute('alt', '');
    await waitFor(async () => {
      await expect(photo?.complete).toBe(true);
      await expect(photo?.naturalWidth).toBeGreaterThan(0);
    });
    await expect(avatar).not.toHaveTextContent('AL');
  },
};

export const Initials: Story = {
  name: 'Initials fallback',
  parameters: { docs: {
    description: { story: 'Show initials when no image or portrait is provided.' },
    source: { language: 'tsx', code: `import { Avatar } from '@jfrader/ui';

<Avatar name="Ada Lovelace" />` },
  } },
  play: async ({ canvasElement }) => {
    const avatar = within(canvasElement).getByRole('img', { name: NAME });
    await expect(avatar).toHaveTextContent('AL');
    await expect(avatar.querySelector('img')).toBeNull();
    // The fallback circle needs a visible boundary against bg/surfaceHover.
    await expect(getComputedStyle(avatar).boxShadow).toContain('inset');
  },
};

export const Artwork: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import { Avatar, PersonAvatar } from '@jfrader/ui';

<Avatar name="Ada Lovelace" status="online" pulse>
  <PersonAvatar seed="member-ada" alt="" size="full" crop="circle" />
</Avatar>` } } },
  render: (args) => (
    <Flex gap="md">
      {SIZES.map(size => <Avatar {...args} key={size} size={size} status="online" statusLabel="en línea" pulse dir="rtl">
        <PersonAvatar seed="member-ada" alt="" size="full" crop="circle" />
      </Avatar>)}
    </Flex>
  ),
  play: async ({ canvasElement }) => {
    const avatars = within(canvasElement).getAllByRole('img', { name: `${NAME}, en línea` });
    await expect(avatars).toHaveLength(3);
    for (const [index, avatar] of avatars.entries()) {
      const fallback = avatar.querySelector<HTMLElement>('[data-ui="avatar-fallback"]')!;
      const svg = fallback.querySelector('svg')!;
      const size = SIZE_PX[SIZES[index]!];
      for (const element of [avatar, fallback, svg]) {
        await expect(element.getBoundingClientRect().width).toBe(size);
        await expect(element.getBoundingClientRect().height).toBe(size);
      }
      await expect(svg).toHaveAttribute('viewBox', '0 0 48 48');
      await expect(svg).toHaveAttribute('preserveAspectRatio', 'xMidYMid meet');
      await expect(fallback).toHaveAttribute('aria-hidden', 'true');
      await expect(getComputedStyle(fallback).overflow).toBe('hidden');
      await expect(getComputedStyle(fallback).borderRadius).toBe(getComputedStyle(avatar).borderRadius);
      await expect(getComputedStyle(avatar).overflow).toBe('visible');
      const status = avatar.querySelector<HTMLElement>('[data-status]')!;
      await expect(status.parentElement).toBe(avatar);
      await expect(getComputedStyle(status).left).toBe('0px');
      await expect(avatar.querySelector('button, a, input, [tabindex="0"]')).toBeNull();
    }
  },
};

export const PhotoWithArtworkFallback: Story = {
  name: 'Image with portrait fallback',
  parameters: { docs: {
    description: { story: 'Show a loaded image with a generated portrait ready as its fallback.' },
    source: { language: 'tsx', code: `import { Avatar, PersonAvatar } from '@jfrader/ui';
import { sceneSource } from '@jfrader/ui/scene';

const imageSource = sceneSource('avatar-ada'); // Replace with your photo URL.

<Avatar name="Ada Lovelace" src={imageSource}>
  <PersonAvatar seed="member-ada" alt="" size="full" crop="circle" />
</Avatar>` },
  } },
  args: { src: PHOTO_SRC, children: <PersonAvatar seed="member-ada" alt="" size="full" crop="circle" /> },
  play: async ({ canvasElement }) => {
    const avatar = within(canvasElement).getByRole('img', { name: NAME });
    await waitFor(() => expect(avatar.querySelector('img')?.naturalWidth).toBeGreaterThan(0));
    await expect(avatar.querySelector('svg')).toBeNull();
  },
};

export const BrokenPhotoWithArtwork: Story = {
  ...PhotoWithArtworkFallback,
  name: 'Broken image with artwork',
  args: { ...PhotoWithArtworkFallback.args, src: BROKEN_SRC },
  play: async ({ canvasElement }) => {
    const avatar = within(canvasElement).getByRole('img', { name: NAME });
    await waitFor(() => expect(avatar.querySelector('svg')).not.toBeNull());
    await expect(avatar.querySelector('img')).toBeNull();
  },
};

export const FallbackValues: Story = {
  render: () => <Flex gap="md">
    <Avatar name="Zero">{0}</Avatar>
    <Avatar name="False">{false}</Avatar>
    <Avatar name="Null">{null}</Avatar>
    <Avatar name="Empty">{''}</Avatar>
    <Avatar name="Fragment"><></></Avatar>
    <Avatar name="Empty source" src="">art</Avatar>
  </Flex>,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const [name, text] of [['Zero', '0'], ['False', 'F'], ['Null', 'N'], ['Empty', ''], ['Fragment', ''], ['Empty source', 'art']]) {
      await expect(canvas.getByRole('img', { name })).toHaveTextContent(new RegExp(`^${text}$`));
    }
  },
};

export const ContentLifecycle: Story = {
  play: async ({ canvasElement }) => {
    const host = canvasElement.ownerDocument.createElement('div');
    canvasElement.append(host);
    const root = createRoot(host);
    const ref = createRef<HTMLImageElement>();
    const loaded = fn();
    const failed = fn((event: { preventDefault(): void }) => event.preventDefault());
    const attached = fn();
    const cleaned = fn();
    const fallbackRef = (node: HTMLSpanElement | null) => { attached(node); return () => cleaned(node); };
    const render = (src?: string) => flushSync(() => root.render(
      <StrictMode><Avatar name={NAME} src={src} status="online" statusLabel="en línea"
        slots={{ fallback: SlotFallback }} slotProps={{
          image: { ref, onLoad: loaded, onError: failed, title: 'Photo', src: BROKEN_SRC, alt: 'Ignored' },
          fallback: { ref: fallbackRef, title: 'Artwork', children: 'Ignored', 'aria-hidden': false },
          status: { title: 'Presence', children: 'Ignored' },
        }}><PersonAvatar seed="member-ada" size="full" alt="" /></Avatar></StrictMode>,
    ));
    try {
      render();
      await expect(host.querySelector('svg')).not.toBeNull();
      await expect(host.querySelector('[title="Artwork"]')).toHaveAttribute('aria-hidden', 'true');
      await expect(host).not.toHaveTextContent('Ignored');
      render(PHOTO_SRC);
      await waitFor(() => expect(loaded).toHaveBeenCalledTimes(1));
      await expect(ref.current).toBe(host.querySelector('img'));
      await expect(ref.current).toHaveAttribute('alt', '');
      await expect(host.querySelector('svg')).toBeNull();
      render(BROKEN_SRC);
      await waitFor(() => expect(failed).toHaveBeenCalledTimes(1));
      await expect(ref.current).toBeNull();
      await expect(host.querySelector('svg')).not.toBeNull();
      render(PHOTO_SRC);
      await waitFor(() => expect(loaded).toHaveBeenCalledTimes(2));
      render(BROKEN_SRC);
      await expect(host.querySelector('img')).toBeNull();
      await expect(failed).toHaveBeenCalledTimes(1);
      await expect(within(host).getByRole('img')).toHaveAccessibleName(`${NAME}, en línea`);
    } finally { flushSync(() => root.unmount()); host.remove(); }
    await expect(cleaned.mock.calls).toEqual(attached.mock.calls);
  },
};

export const CompositionHydration: Story = {
  play: async ({ canvasElement }) => {
    for (const src of [undefined, PHOTO_SRC]) {
      const host = canvasElement.ownerDocument.createElement('div');
      const element = <Avatar name={NAME} src={src}><PersonAvatar seed="member-ada" size="full" alt="" /></Avatar>;
      host.innerHTML = renderToString(element);
      await expect(Boolean(host.querySelector('svg'))).toBe(src === undefined);
      const before = host.querySelector('[data-ui="avatar"]');
      canvasElement.append(host);
      const ref = createRef<HTMLSpanElement>();
      const errors = fn();
      const root = hydrateRoot(host, <Avatar name={NAME} src={src} ref={ref}><PersonAvatar seed="member-ada" size="full" alt="" /></Avatar>, { onRecoverableError: errors });
      try {
        await waitFor(() => expect(ref.current).toBe(before));
        await expect(errors).not.toHaveBeenCalled();
      } finally { flushSync(() => root.unmount()); host.remove(); }
    }
  },
};

export const ExternalLabelWithStatus: Story = {
  render: () => <><span id="avatar-external-label">Profile</span><Avatar name={NAME} status="online" aria-labelledby="avatar-external-label">
    <PersonAvatar seed="member-ada" size="full" alt="" />
  </Avatar></>,
  play: async ({ canvasElement }) => {
    const avatar = within(canvasElement).getByRole('img', { name: 'Profile' });
    await expect(avatar).toHaveAttribute('aria-label', `${NAME}, online`);
    await expect(avatar).toHaveAttribute('aria-labelledby', 'avatar-external-label');
  },
};

export const InitialsEdgeCases: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import { Avatar } from '@jfrader/ui';

<>
  <Avatar name="cher" />
  <Avatar name="  grace   brewster murray hopper " />
  <Avatar name="Émile Zola" />
  <Avatar name="👩🏽💻 Smith" />
  <Avatar name="\u674e \u5c0f\u9f8d" />
</>` } } },
  render: (args) => (
    <Flex align="center" gap="sm" wrap>
      <Avatar {...args} name="cher" />
      <Avatar {...args} name="  grace   brewster murray hopper " />
      <Avatar {...args} name="Émile Zola" />
      <Avatar {...args} name="👩🏽💻 Smith" />
      <Avatar {...args} name="李 小龍" />
    </Flex>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('img', { name: 'cher' })).toHaveTextContent(/^C$/);
    await expect(canvas.getByRole('img', { name: /grace/ })).toHaveTextContent(/^GB$/);
    await expect(canvas.getByRole('img', { name: 'Émile Zola' })).toHaveTextContent(/^ÉZ$/);
    await expect(canvas.getByRole('img', { name: '👩🏽💻 Smith' }).textContent).toBe('👩🏽💻S');
    await expect(canvas.getByRole('img', { name: '李 小龍' }).textContent).toBe('李小');
  },
};

export const BrokenImage: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `<Avatar name="Ada Lovelace" src="/portraits/missing.jpg" status="online" />` } } },
  args: { src: BROKEN_SRC, status: 'online' },
  play: async ({ canvasElement }) => {
    const avatar = within(canvasElement).getByRole('img', { name: `${NAME}, online` });
    await waitFor(() => expect(avatar).toHaveTextContent('AL'));
    await expect(avatar.querySelector('img')).toBeNull();
  },
};

export const Sizes: Story = {
  name: 'Avatar sizes',
  parameters: { docs: { description: { story: 'Compare small, medium and large identity frames.' }, source: { language: 'tsx', code: `import { Avatar, Flex } from '@jfrader/ui';

<Flex align="center" gap="sm" wrap>
  <Avatar name="Size sm" size="sm" />
  <Avatar name="Size md" size="md" />
  <Avatar name="Size lg" size="lg" />
</Flex>` } } },
  render: (args) => (
    <Flex align="center" gap="sm" wrap>
      {SIZES.map((size) => (
        <Avatar {...args} key={size} size={size} name={`Size ${size}`} />
      ))}
    </Flex>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    SIZES.forEach((size) => {
      const rect = canvas.getByRole('img', { name: `Size ${size}` }).getBoundingClientRect();
      expect(Math.round(rect.width)).toBe(SIZE_PX[size]);
      expect(Math.round(rect.height)).toBe(SIZE_PX[size]);
    });
  },
};

export const Status: Story = {
  name: 'Presence labels',
  parameters: { docs: { description: { story: 'Compare presence indicators and a localized online label.' }, source: { language: 'tsx', code: `import { Avatar, Flex } from '@jfrader/ui';
import { sceneSource } from '@jfrader/ui/scene';

<Flex align="center" gap="sm" wrap>
  <Avatar name="Ada Lovelace" status="online" />
  <Avatar name="Ada Lovelace" status="away" />
  <Avatar name="Ada Lovelace" status="busy" />
  <Avatar name="Ada Lovelace" status="offline" />
  <Avatar name="Ada Lovelace" src={sceneSource('avatar-ada')} size="lg" status="online" statusLabel="en línea" />
</Flex>` } } },
  render: (args) => (
    <Flex align="center" gap="sm" wrap>
      {STATUSES.map((status) => (
        <Avatar {...args} key={status} status={status} />
      ))}
      <Avatar {...args} src={PHOTO_SRC} size="lg" status="online" statusLabel="en línea" />
    </Flex>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const status of STATUSES) {
      const avatar = canvas.getByRole('img', { name: `${NAME}, ${status}` });
      const dot = avatar.querySelector(`[data-status="${status}"]`) as HTMLElement;
      await expect(dot).toHaveAttribute('aria-hidden', 'true');
      await expect(Math.round(dot.getBoundingClientRect().width)).toBe(SIZE_PX.md / 4);
      await expect(getComputedStyle(dot, '::after').animationName).toBe('none');
    }
    await expect(canvas.getByRole('img', { name: `${NAME}, en línea` })).toBeInTheDocument();
  },
};

function SlotFallback(props: ComponentPropsWithRef<'span'>) {
  return <span {...props} data-slot="avatar-fallback" />;
}

export const FallbackReplacement: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import type { ComponentPropsWithRef } from 'react';
import { Avatar } from '@jfrader/ui';

function ProfileInitials(props: ComponentPropsWithRef<'span'>) {
  return <span {...props} data-profile-initials />;
}

<Avatar name="Ada Lovelace" slots={{ fallback: ProfileInitials }} />` } } },
  render: (args) => <Avatar {...args} src={undefined} slots={{ fallback: SlotFallback }} />,
  play: async ({ canvasElement }) => {
    const fallback = canvasElement.querySelector('[data-slot="avatar-fallback"]');
    await expect(fallback).toBeInTheDocument();
    await expect(fallback).toHaveAttribute('data-ui', 'avatar-fallback');
    await expect(fallback).toHaveAttribute('aria-hidden', 'true');
    await expect(fallback).toHaveTextContent('AL');
    await expect(canvasElement.querySelector('[data-ui="avatar-fallback"]:not([data-slot])')).toBeNull();
  },
};

export const LightTheme: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import { Avatar, ThemeRoot, sceneSource } from '@jfrader/ui';

<ThemeRoot theme="light">
  <Avatar name="Ada Lovelace" src={sceneSource('avatar-ada')} status="online" />
  <Avatar name="Ada Lovelace" status="busy" />
  <Avatar name="Ada Lovelace" status="offline" />
</ThemeRoot>` } } },
  decorators: [withLightTheme],
  render: (args) => (
    <Flex align="center" gap="sm" wrap>
      <Avatar {...args} src={PHOTO_SRC} status="online" />
      <Avatar {...args} status="busy" />
      <Avatar {...args} status="offline" />
    </Flex>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('img', { name: `${NAME}, busy` })).toHaveTextContent('AL');
  },
};

export const ForcedColorsRule: Story = {
  ...Status,
  name: 'Forced colors rule',
  play: async ({ canvasElement }) => {
    const avatars = canvasElement.querySelectorAll<HTMLElement>('[data-ui="avatar"]');
    await expect(avatars).toHaveLength(5);
    const rules = Array.from(canvasElement.ownerDocument.styleSheets)
      .flatMap((sheet) => Array.from(sheet.cssRules))
      .filter((rule): rule is CSSMediaRule => rule instanceof CSSMediaRule && rule.conditionText.includes('forced-colors: active'))
      .flatMap((rule) => Array.from(rule.cssRules))
      .filter((rule): rule is CSSStyleRule => rule instanceof CSSStyleRule);
    for (const avatar of avatars) {
      const selectors = Array.from(avatar.classList, (name) => `.${name}`);
      await expect(rules.some((rule) => selectors.includes(rule.selectorText) && rule.style.outlineColor.toLowerCase() === 'canvastext')).toBe(true);
      const status = avatar.querySelector<HTMLElement>('[data-status]')!;
      const statusSelectors = Array.from(status.classList, (name) => `.${name}::before`);
      const statusRule = rules.find((rule) => statusSelectors.includes(rule.selectorText) && rule.style.forcedColorAdjust === 'none');
      await expect(statusRule?.style.backgroundColor).toBe('canvastext');
      await expect(statusRule?.style.outlineColor.toLowerCase()).toBe('canvas');
      await expect(statusRule?.style.outlineWidth).toBe('2px');
      if (status.dataset.status === 'away') {
        const awaySelectors = Array.from(status.classList, (name) => `.${name}[data-status="away"]::before`);
        const awayRule = rules.find((rule) => awaySelectors.includes(rule.selectorText));
        await expect(awayRule?.style.backgroundColor).toBe('canvas');
        await expect(awayRule?.style.borderColor).toBe('canvastext');
      }
    }
  },
};

export const RTL: Story = {
  args: { dir: 'rtl', status: 'online', pulse: true },
  play: async ({ canvasElement }) => {
    const avatar = within(canvasElement).getByRole('img', { name: `${NAME}, online` });
    await expect(avatar).toHaveAttribute('dir', 'rtl');
    const status = avatar.querySelector<HTMLElement>('[data-status]')!;
    await expect(getComputedStyle(status).left).toBe('0px');
    await expect(getComputedStyle(status).right).not.toBe('0px');
  },
};

async function expectPresenceCycle(badge: HTMLElement) {
  const view = badge.ownerDocument.defaultView!;
  const animation = badge.getAnimations({ subtree: true }).find((animation) =>
    animation.effect instanceof KeyframeEffect && animation.effect.pseudoElement === '::after',
  );
  await expect(animation).toBeDefined();
  if (!animation) throw new Error('Missing presence ring animation');
  const previousTime = animation.currentTime;
  animation.pause();
  await animation.ready;
  try {
    const frames = [[0, 0.8, 1], [600, 1.6, 0.5], [1199, 2.4, 0], [1200, 0.8, 1], [1800, 1.6, 0.5]] as const;
    for (const [time, scale, opacity] of frames) {
      animation.currentTime = time;
      await new Promise<void>((resolve) => view.requestAnimationFrame(() => resolve()));
      const ring = view.getComputedStyle(badge, '::after');
      await expect(new DOMMatrixReadOnly(ring.transform).a).toBeCloseTo(scale, 2);
      await expect(Number(ring.opacity)).toBeCloseTo(opacity, 2);
    }
  } finally {
    animation.currentTime = previousTime;
    animation.play();
  }
}

export const OnlinePulse: Story = {
  name: 'Pulsing online presence',
  parameters: { docs: { description: { story: 'Add an online ring to image and initials avatars at each size.' }, source: { language: 'tsx', code: `import { Fragment } from 'react';
import { Avatar, Flex } from '@jfrader/ui';
import { sceneSource } from '@jfrader/ui/scene';

<Flex align="center" gap="sm" wrap>
  {(['sm', 'md', 'lg'] as const).map((size) => (
    <Fragment key={size}>
      <Avatar name={\`Photo \${size}\`} src={sceneSource('avatar-ada')} size={size} status="online" pulse />
      <Avatar name={\`Initials \${size}\`} size={size} status="online" pulse />
    </Fragment>
  ))}
</Flex>` } } },
  args: { status: 'online', pulse: true },
  render: (args) => (
    <Flex align="center" gap="sm" wrap>
      {SIZES.flatMap((size) => [
        <Avatar {...args} key={`${size}-photo`} size={size} src={PHOTO_SRC} name={`Photo ${size}`} />,
        <Avatar {...args} key={`${size}-initials`} size={size} name={`Initials ${size}`} />,
      ])}
    </Flex>
  ),
  play: async ({ canvasElement }) => {
    const avatars = Array.from(canvasElement.querySelectorAll<HTMLElement>('[data-ui="avatar"]'));
    const badges = avatars.map((avatar) => avatar.querySelector<HTMLElement>('[data-status]')!);
    await expect(badges).toHaveLength(SIZES.length * 2);
    for (const [index, badge] of badges.entries()) {
      const avatar = avatars[index]!;
      const ring = getComputedStyle(badge, '::after');
      await expect(badge).toHaveAttribute('data-status', 'online');
      await expect(badge).toHaveAttribute('aria-hidden', 'true');
      await expect(avatar).toHaveAccessibleName(`${index % 2 === 0 ? 'Photo' : 'Initials'} ${SIZES[Math.floor(index / 2)]}, online`);
      await expect(avatar.tabIndex).toBe(-1);
      await expect(avatar.querySelector('[aria-live]')).toBeNull();
      await expect(getComputedStyle(avatar).overflow).not.toBe('hidden');
      await expect(badge.getBoundingClientRect().width).toBe(avatar.getBoundingClientRect().width / 4);
      await expect(badge.getBoundingClientRect().height).toBe(avatar.getBoundingClientRect().height / 4);
      await expect(Number.parseFloat(ring.width)).toBe(badge.getBoundingClientRect().width);
      await expect(Number.parseFloat(ring.height)).toBe(badge.getBoundingClientRect().height);
      const borderBoxWidth = Number.parseFloat(ring.width) + (ring.boxSizing === 'border-box' ? 0 :
        Number.parseFloat(ring.borderLeftWidth) + Number.parseFloat(ring.borderRightWidth));
      const borderBoxHeight = Number.parseFloat(ring.height) + (ring.boxSizing === 'border-box' ? 0 :
        Number.parseFloat(ring.borderTopWidth) + Number.parseFloat(ring.borderBottomWidth));
      await expect(borderBoxWidth).toBe(badge.getBoundingClientRect().width);
      await expect(borderBoxHeight).toBe(badge.getBoundingClientRect().height);
      if (index % 2 === 0) {
        const photo = avatar.querySelector('img')!;
        await waitFor(() => expect(photo.naturalWidth).toBeGreaterThan(0));
      } else {
        await expect(avatar).toHaveTextContent(`I${SIZES[Math.floor(index / 2)]!.charAt(0).toUpperCase()}`);
      }
      await expect(ring.animationDuration).toBe('1.2s');
      await expect(ring.animationName).not.toBe('none');
      await expect(ring.animationTimingFunction).toBe('ease-in-out');
      await expect(ring.animationIterationCount).toBe('infinite');
      await expect(ring.borderTopWidth).toBe('1px');
      await expect(ring.borderTopColor).toBe(ring.color);
      await expect(getComputedStyle(badge, '::before').animationName).toBe('none');
      await expect(getComputedStyle(badge, '::before').transform).toBe('none');
      await expect(getComputedStyle(badge, '::before').opacity).toBe('1');
      await expect(getComputedStyle(badge, '::before').boxShadow).toContain('0px 0px 0px 2px');
    }
    for (const badge of badges) await expectPresenceCycle(badge);
  },
};

export const OnlinePulseLight: Story = {
  ...OnlinePulse,
  name: 'Online pulse in light theme',
  parameters: { docs: { source: { language: 'tsx', code: `import { Fragment } from 'react';
import { Avatar, ThemeRoot, sceneSource } from '@jfrader/ui';

<ThemeRoot theme="light">
  {(['sm', 'md', 'lg'] as const).map((size) => (
    <Fragment key={size}>
      <Avatar name={\`Photo \${size}\`} src={sceneSource('avatar-ada')} size={size} status="online" pulse />
      <Avatar name={\`Initials \${size}\`} size={size} status="online" pulse />
    </Fragment>
  ))}
</ThemeRoot>` } } },
  decorators: [withLightTheme],
};

export const StaticPresence: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import { Avatar } from '@jfrader/ui';

<>
  <Avatar name="Ada Lovelace" status="online" />
  <Avatar name="Ada Lovelace" status="online" pulse={false} />
  <Avatar name="Ada Lovelace" status="away" pulse />
  <Avatar name="Ada Lovelace" status="busy" pulse />
  <Avatar name="Ada Lovelace" status="offline" pulse />
  <Avatar name="Ada Lovelace" pulse />
</>` } } },
  render: (args) => (
    <Flex align="center" gap="sm" wrap>
      <Avatar {...args} status="online" />
      <Avatar {...args} status="online" pulse={false} />
      {STATUSES.filter((status) => status !== 'online').map((status) => (
        <Avatar {...args} key={status} status={status} pulse />
      ))}
      <Avatar {...args} pulse />
    </Flex>
  ),
  play: async ({ canvasElement }) => {
    const avatars = canvasElement.querySelectorAll<HTMLElement>('[data-ui="avatar"]');
    await expect(avatars).toHaveLength(6);
    await expect(canvasElement.querySelectorAll('[data-status]')).toHaveLength(5);
    await expect(avatars[5]!.querySelector('[data-status]')).toBeNull();
    for (const avatar of avatars) {
      await expect(avatar).not.toHaveAttribute('pulse');
      const badge = avatar.querySelector<HTMLElement>('[data-status]');
      if (badge) {
        await expect(badge).not.toHaveAttribute('data-pulse');
        await expect(getComputedStyle(badge, '::after').animationName).toBe('none');
        await expect(getComputedStyle(badge, '::after').content).toBe('none');
      } else {
        await expect(avatar).toHaveAccessibleName(NAME);
      }
    }
  },
};

async function expectHiddenRingForMedia(canvasElement: HTMLElement, condition: string) {
  const badge = canvasElement.querySelector<HTMLElement>('[data-status]')!;
  const rules = Array.from(canvasElement.ownerDocument.styleSheets)
    .flatMap((sheet) => Array.from(sheet.cssRules))
    .filter((rule): rule is CSSMediaRule => rule instanceof CSSMediaRule && rule.conditionText === `(${condition})`)
    .flatMap((rule) => Array.from(rule.cssRules))
    .filter((rule): rule is CSSStyleRule => rule instanceof CSSStyleRule);
  const selectors = Array.from(badge.classList, (name) => `.${name}[data-status="online"][data-pulse]::after`);
  const ringRule = rules.find((rule) => selectors.includes(rule.selectorText));
  await expect(ringRule).toBeDefined();
  await expect(ringRule?.style.content).toBe('none');
  await expect(ringRule?.style.display).toBe('none');
  await expect(ringRule?.style.animationName).toBe('none');
  const disabledAnimation = canvasElement.ownerDocument.createElement('span').style;
  disabledAnimation.animation = 'none';
  await expect(ringRule?.style.animation).toBe(disabledAnimation.animation);
}

export const ReducedMotionRule: Story = {
  args: { status: 'online', pulse: true },
  play: async ({ canvasElement }) => {
    await expectHiddenRingForMedia(canvasElement, 'prefers-reduced-motion: reduce');
  },
};

export const PulseForcedColorsRule: Story = {
  args: { status: 'online', pulse: true },
  play: async ({ canvasElement }) => {
    await expectHiddenRingForMedia(canvasElement, 'forced-colors: active');
  },
};

const ProfileButton = styled(Button)({ padding: vars.space[6] });

export const Team: Story = {
  name: 'Team portraits',
  parameters: { docs: {
    description: { story: 'Combine portrait artwork and initials in a named team group.' },
    source: { language: 'tsx', code: `import { AvatarGroup, PersonAvatar } from '@jfrader/ui';

<AvatarGroup label="Project team" members={[
  { id: 'ada', name: 'Ada Lovelace', status: 'online', avatarProps: {
    children: <PersonAvatar seed="ada" alt="" size="full" crop="circle" />,
  } },
  { id: 'grace', name: 'Grace Hopper' },
]} />` },
  } },
  render: () => <AvatarGroup label="Project team" members={[
    { id: 'ada', name: 'Ada Lovelace', status: 'online', avatarProps: {
      children: <PersonAvatar seed="ada" alt="" size="full" crop="circle" />,
    } },
    { id: 'grace', name: 'Grace Hopper' },
  ]} />,
};

export const PulsePointerPassthrough: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import { Avatar, Button, sceneSource, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const ProfileButton = styled(Button)({ padding: vars.space[6] });

<ProfileButton type="button" aria-label="Open profile">
  <Avatar name="Ada Lovelace" src={sceneSource('avatar-ada')} status="online" pulse />
</ProfileButton>` } } },
  args: { src: PHOTO_SRC, status: 'online', pulse: true, onClick: fn() },
  render: (args) => (
    <ProfileButton type="button" aria-label="Open profile" onClick={args.onClick}>
      <Avatar {...args} onClick={undefined} />
    </ProfileButton>
  ),
  play: async ({ canvasElement, userEvent, args }) => {
    const button = within(canvasElement).getByRole('button', { name: 'Open profile' });
    const badge = button.querySelector<HTMLElement>('[data-status]')!;
    const { left, top, width, height } = badge.getBoundingClientRect();
    await expect(getComputedStyle(badge).pointerEvents).toBe('none');
    await expect(getComputedStyle(badge, '::after').pointerEvents).toBe('none');
    const hit = canvasElement.ownerDocument.elementFromPoint(left + width / 2, top + height / 2);
    await expect(hit).not.toBe(badge);
    await expect(hit?.closest('button')).toBe(button);
    if (!hit) throw new Error('Missing click target beneath presence badge');
    await userEvent.click(hit);
    await expect(args.onClick).toHaveBeenCalledTimes(1);
  },
};
