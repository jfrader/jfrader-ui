import type { CSSProperties } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, waitFor, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { withLightTheme } from '../../testing/story-decorators';
import { Avatar, type AvatarSize, type AvatarStatus } from './index';

const SIZES = ['sm', 'md', 'lg'] as const satisfies readonly AvatarSize[];
const SIZE_PX = { sm: 24, md: 32, lg: 40 } as const;
const STATUSES = ['online', 'away', 'busy', 'offline'] as const satisfies readonly AvatarStatus[];
const NAME = 'Ada Lovelace';

// Procedural noise portrait: the image draws its own pixels, so the fixture needs no color literals.
const PHOTO_SRC = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
    '<filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="7"/>' +
    '<feColorMatrix values="1.6 0 0 0 -0.2  0 1.1 0 0 -0.1  0 0 1.8 0 0  0 0 0 0 1"/></filter>' +
    '<rect width="64" height="64" filter="url(#n)"/></svg>',
)}`;
const BROKEN_SRC = 'data:image/png;base64,broken';

const rowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: vars.space[3],
} satisfies CSSProperties;

const meta = {
  title: 'Data display/Avatar',
  component: Avatar,
  parameters: {
    docs: {
      description: { component: 'Show a person’s photo or initials, with an optional status.' },
      usage: '### Presence\nSet `pulse` with `status="online"` for an expanding ring. The default is static; reduced motion and forced colors hide the ring.',
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
  play: async ({ canvasElement }) => {
    const avatar = within(canvasElement).getByRole('img', { name: NAME });
    await expect(avatar).toHaveTextContent('AL');
    await expect(avatar.querySelector('img')).toBeNull();
  },
};

export const InitialsEdgeCases: Story = {
  render: (args) => (
    <div style={rowStyle}>
      <Avatar {...args} name="cher" />
      <Avatar {...args} name="  grace   brewster murray hopper " />
      <Avatar {...args} name="Émile Zola" />
      <Avatar {...args} name="👩🏽💻 Smith" />
      <Avatar {...args} name="李 小龍" />
    </div>
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
  args: { src: BROKEN_SRC, status: 'online' },
  play: async ({ canvasElement }) => {
    const avatar = within(canvasElement).getByRole('img', { name: `${NAME}, online` });
    await waitFor(() => expect(avatar).toHaveTextContent('AL'));
    await expect(avatar.querySelector('img')).toBeNull();
  },
};

export const Sizes: Story = {
  render: (args) => (
    <div style={rowStyle}>
      {SIZES.map((size) => (
        <Avatar {...args} key={size} size={size} name={`Size ${size}`} />
      ))}
    </div>
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
  render: (args) => (
    <div style={rowStyle}>
      {STATUSES.map((status) => (
        <Avatar {...args} key={status} status={status} />
      ))}
      <Avatar {...args} src={PHOTO_SRC} size="lg" status="online" statusLabel="en línea" />
    </div>
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

export const LightTheme: Story = {
  decorators: [withLightTheme],
  render: (args) => (
    <div style={rowStyle}>
      <Avatar {...args} src={PHOTO_SRC} status="online" />
      <Avatar {...args} status="busy" />
      <Avatar {...args} status="offline" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('img', { name: `${NAME}, busy` })).toHaveTextContent('AL');
  },
};

export const ForcedColorsRule: Story = {
  ...Status,
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

type RingFrame = { scale: number; opacity: number };
const SAMPLE_WINDOW_MS = 2600;
const SAMPLE_TIMEOUT_MS = 4000;

async function samplePresenceRings(badges: HTMLElement[]): Promise<RingFrame[][]> {
  const view = badges[0]!.ownerDocument.defaultView!;
  const frames = badges.map(() => [] as RingFrame[]);
  await new Promise<void>((resolve, reject) => {
    const start = view.performance.now();
    let frameId = 0;
    const timeout = view.setTimeout(() => {
      view.cancelAnimationFrame(frameId);
      reject(new Error('Presence ring frame sampling timed out'));
    }, SAMPLE_TIMEOUT_MS);
    const sample = () => {
      badges.forEach((badge, index) => {
        const ring = view.getComputedStyle(badge, '::after');
        frames[index]!.push({ scale: new DOMMatrixReadOnly(ring.transform).a, opacity: Number(ring.opacity) });
      });
      if (view.performance.now() - start >= SAMPLE_WINDOW_MS) {
        view.clearTimeout(timeout);
        resolve();
      } else {
        frameId = view.requestAnimationFrame(sample);
      }
    };
    frameId = view.requestAnimationFrame(sample);
  });
  return frames;
}

export const OnlinePulse: Story = {
  args: { status: 'online', pulse: true },
  render: (args) => (
    <div style={rowStyle}>
      {SIZES.flatMap((size) => [
        <Avatar {...args} key={`${size}-photo`} size={size} src={PHOTO_SRC} name={`Photo ${size}`} />,
        <Avatar {...args} key={`${size}-initials`} size={size} name={`Initials ${size}`} />,
      ])}
    </div>
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
      if (index % 2 === 0) {
        const photo = avatar.querySelector('img')!;
        await waitFor(() => expect(photo.naturalWidth).toBeGreaterThan(0));
      } else {
        await expect(avatar).toHaveTextContent(`I${SIZES[Math.floor(index / 2)]!.charAt(0).toUpperCase()}`);
      }
      await expect(ring.animationDuration).toBe('1.2s');
      await expect(ring.animationTimingFunction).toBe('ease-in-out');
      await expect(ring.animationIterationCount).toBe('infinite');
      await expect(ring.borderTopWidth).toBe('1px');
      await expect(ring.borderTopColor).toBe(ring.color);
      await expect(getComputedStyle(badge, '::before').animationName).toBe('none');
      await expect(getComputedStyle(badge, '::before').transform).toBe('none');
      await expect(getComputedStyle(badge, '::before').opacity).toBe('1');
    }
    const samples = await samplePresenceRings(badges);
    for (const frames of samples) {
      await expect(frames.some(({ scale, opacity }) => scale > 1 && scale < 2 && opacity > 0.2 && opacity < 0.8)).toBe(true);
      await expect(Math.min(...frames.map(({ scale }) => scale))).toBeLessThan(0.9);
      await expect(Math.max(...frames.map(({ scale }) => scale))).toBeGreaterThan(2.3);
      const resets = frames.filter((frame, index) => index > 0 && frame.scale < frames[index - 1]!.scale - 1 && frame.opacity > frames[index - 1]!.opacity + 0.5);
      await expect(resets.length).toBeGreaterThanOrEqual(2);
    }
  },
};

export const OnlinePulseLight: Story = {
  ...OnlinePulse,
  decorators: [withLightTheme],
};

export const StaticPresence: Story = {
  render: (args) => (
    <div style={rowStyle}>
      <Avatar {...args} status="online" />
      <Avatar {...args} status="online" pulse={false} />
      {STATUSES.filter((status) => status !== 'online').map((status) => (
        <Avatar {...args} key={status} status={status} pulse />
      ))}
      <Avatar {...args} pulse />
    </div>
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
    .filter((rule): rule is CSSMediaRule => rule instanceof CSSMediaRule && rule.conditionText.includes(condition));
  const originalMedia = rules.map((rule) => rule.media.mediaText);
  await expect(rules.length).toBeGreaterThan(0);
  try {
    rules.forEach((rule) => { rule.media.mediaText = 'all'; });
    const ring = getComputedStyle(badge, '::after');
    await expect(ring.animationName).toBe('none');
    await expect(ring.display).toBe('none');
    await expect(ring.content).toBe('none');
    const dot = getComputedStyle(badge, '::before');
    await expect(dot.content).toBe('""');
    await expect(dot.display).not.toBe('none');
    await expect(dot.animationName).toBe('none');
    await expect(dot.opacity).toBe('1');
    await expect(badge).toHaveAttribute('data-status', 'online');
    await expect(badge.parentElement).toHaveAccessibleName(`${NAME}, online`);
  } finally {
    rules.forEach((rule, index) => { rule.media.mediaText = originalMedia[index]!; });
  }
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
