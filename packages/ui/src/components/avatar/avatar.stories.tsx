import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, waitFor, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
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

const rowStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: vars.space[3],
});

const meta = {
  title: 'Data display/Avatar',
  component: Avatar,
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
    <div css={rowStyle}>
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
    <div css={rowStyle}>
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
    <div css={rowStyle}>
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
    }
    await expect(canvas.getByRole('img', { name: `${NAME}, en línea` })).toBeInTheDocument();
  },
};

export const LightTheme: Story = {
  decorators: [withLightTheme],
  render: (args) => (
    <div css={rowStyle}>
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
