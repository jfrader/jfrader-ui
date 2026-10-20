import { useState, type ComponentPropsWithRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, waitFor } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { withLightTheme } from '../../testing/story-decorators';
import { expectThemedSurface } from '../../testing/theme-assertions';
import { Button } from '../button';
import { LinkPreview, type LinkPreviewData } from './index';
// `styled` is the app-facing styling API; consumers import it from `@jfrader/ui`.
import { styled } from '../../index';

const URL = 'https://example.com/guide';
const svg = (markup: string) => `data:image/svg+xml,${encodeURIComponent(markup)}`;
const COVER = svg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 191 100"><circle cx="60" cy="50" r="24" opacity="0.5"/></svg>');
const FAVICON = svg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7"/></svg>');
const DATA: LinkPreviewData = {
  url: URL,
  site: 'Northwind Docs',
  title: 'Spacing and type guide',
  description: 'How we size, space and set type across product surfaces.',
  image: { src: COVER, alt: 'Guide cover with a large dot' },
  favicon: FAVICON,
};
const Frame = styled.div({ inlineSize: 'min(100%, 27.5rem)', minInlineSize: 0 });
const Stack = styled.div({ display: 'grid', gap: vars.space[3] });
const meta = {
  title: 'Data display/LinkPreview',
  component: LinkPreview,
  tags: ['autodocs'],
  args: { data: DATA },
  decorators: [(Story) => <Frame><Story /></Frame>],
  parameters: {
    docs: {
      description: { component: 'Show a link with its title, site, description and image.' },
      usage: `### Data
- Pass metadata in \`data\` and set \`status\` to \`pending\`, \`ready\`, \`none\`, or \`error\`. The default is \`ready\`. Fetch metadata in your app; this component makes no metadata requests.
- Use an absolute HTTP(S) URL. Missing titles fall back to the URL; missing site names fall back to its domain. Only ready previews show metadata, images and descriptions.
- Omit \`image\` for a text-only preview. An empty or broken image source leaves the image frame in place. Describe informative images with \`image.alt\`; use an empty string for decorative images. Favicons always have empty alt text.
- Titles are clamped to two lines and descriptions to three; their complete text remains in the DOM. Descriptions can be React nodes; keep them noninteractive.
- Replace loading and unavailable text through \`labels\`, or provide \`data.error\` for an error message.

### Keyboard
- The title is a native link. Tab focuses it and Enter follows its destination. The rest of the card is not a link. There is no composite APG keyboard pattern.

### Styling
- The root accepts native div props, \`ref\`, \`className\`, \`css\`, \`sx\` and \`dir\`. Use \`slotProps\` for the title link, image and body.
- Reduced motion stops decorative animation. Set \`motion="none"\` to disable it explicitly.
- Use LinkUnfurl when you need a message composer with URL detection, preview requests, expansion and removal.`,
    },
  },
} satisfies Meta<typeof LinkPreview>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole('link', { name: DATA.title })).toHaveAttribute('href', URL);
    await expect(canvas.getByText(DATA.site!)).toBeVisible();
    await expect(canvas.getByText(DATA.description as string)).toBeVisible();
    const image = canvas.getByRole('img', { name: DATA.image!.alt });
    await waitFor(() => expect(image).toHaveAttribute('data-image-state', 'loaded'));
    await expect(canvas.getAllByRole('img')).toHaveLength(1);
    await expect(canvasElement.querySelector('img[src="' + FAVICON + '"]')).toHaveAttribute('alt', '');
    await expect(canvas.queryByRole('textbox')).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button')).not.toBeInTheDocument();
  },
};

/** Show the loading label and URL while metadata is pending. */
export const Loading: Story = {
  args: { status: 'pending' },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Loading preview')).toBeVisible();
    await expect(canvas.getByRole('link', { name: URL })).toHaveAttribute('href', URL);
    await expect(canvas.getByText('example.com')).toBeVisible();
    await expect(canvas.queryByText(DATA.description as string)).not.toBeInTheDocument();
    await expect(canvas.queryByRole('img')).not.toBeInTheDocument();
  },
};

/** Keep the address visible when metadata is unavailable. */
export const Unavailable: Story = {
  args: { status: 'none' },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('No preview')).toBeVisible();
    await expect(canvas.getByRole('link', { name: URL })).toBeVisible();
    await expect(canvas.queryByRole('img')).not.toBeInTheDocument();
  },
};

/** Display the error supplied by your app. */
export const Error: Story = {
  args: { status: 'error', data: { ...DATA, error: 'Site unreachable' } },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Site unreachable')).toBeVisible();
    await expect(canvas.getByRole('link', { name: URL })).toBeVisible();
  },
};

/** Use translated labels when no error message is available. */
export const Localized: Story = {
  args: { status: 'error', labels: { pending: 'Cargando vista previa', unavailable: 'Vista previa no disponible' } },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Vista previa no disponible')).toBeVisible();
  },
};

/** Omit the image for a text-only preview. */
export const NoImage: Story = {
  args: { data: { url: URL, title: DATA.title, description: DATA.description } },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.queryByRole('img')).not.toBeInTheDocument();
    await expect(canvasElement.querySelector('[data-ui="link-preview-image-frame"]')).toBeNull();
    await expect(canvas.getByText('example.com')).toBeVisible();
    await expect(canvas.getByText(DATA.description as string)).toBeVisible();
  },
};

/** A broken image keeps its frame without showing broken-image text. */
export const BrokenImage: Story = {
  args: { data: { ...DATA, image: { src: 'data:image/png;base64,broken', alt: 'Cover' } } },
  play: async ({ canvasElement, canvas }) => {
    const frame = canvasElement.querySelector<HTMLElement>('[data-ui="link-preview-image-frame"]')!;
    await waitFor(() => expect(frame.querySelector('img')).toBeNull());
    const rect = frame.getBoundingClientRect();
    await expect(Math.abs(rect.width / rect.height - 1.91)).toBeLessThan(0.05);
    await waitFor(() => expect(canvas.getByRole('link', { name: DATA.title })).toBeVisible());
  },
};

/** Leave decorative images out of the accessible name. */
export const DecorativeImage: Story = {
  args: { data: { ...DATA, image: { src: COVER, alt: '' } } },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.queryByRole('img')).not.toBeInTheDocument();
    await expect(canvas.getByRole('link')).toHaveAccessibleName(DATA.title!);
    const images = canvasElement.querySelectorAll('img');
    await expect(images).toHaveLength(2);
    for (const image of images) await expect(image).toHaveAttribute('alt', '');
  },
};

/** Long titles and descriptions keep the card within its available width. */
export const LongText: Story = {
  args: { data: { url: URL, title: 'A very long guide title with detailed notes on design systems and reusable interface patterns '.repeat(8).trim(), description: 'Read the complete guide for spacing, typography and component composition. '.repeat(16).trim() } },
  play: async ({ canvas, canvasElement, args }) => {
    const title = canvas.getByRole('link', { name: args.data.title });
    const description = canvas.getByText(args.data.description as string);
    await expect(getComputedStyle(title).webkitLineClamp).toBe('2');
    await expect(getComputedStyle(description).webkitLineClamp).toBe('3');
    await expect(title.scrollHeight).toBeGreaterThan(title.clientHeight);
    await expect(description.scrollHeight).toBeGreaterThan(description.clientHeight);
    const root = canvasElement.querySelector<HTMLElement>('[data-ui="link-preview"]')!;
    await expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth + 1);
    await expect(title).toHaveAccessibleName(args.data.title!);
  },
};

/** Read the preview in a right-to-left layout. */
export const RTL: Story = {
  args: { dir: 'rtl', data: { ...DATA, title: 'دليل التصميم', description: 'قرارات المسافات والألوان والخطوط.' } },
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector<HTMLElement>('[data-ui="link-preview"]')!;
    await expect(getComputedStyle(root).direction).toBe('rtl');
    const icon = root.querySelector('img')!.getBoundingClientRect();
    const title = root.querySelector('a')!.getBoundingClientRect();
    await expect(icon.left).toBeGreaterThan(title.right);
  },
};

export const Light: Story = {
  decorators: [withLightTheme],
  play: async ({ canvasElement }) => {
    await expectThemedSurface(canvasElement.querySelector<HTMLElement>('[data-ui="link-preview"]')!, 'light');
  },
};

/** Disable the loading sweep and decorative transitions. */
export const ReducedMotion: Story = {
  args: { status: 'pending', motion: 'none' },
  play: async ({ canvas }) => {
    await expect(getComputedStyle(canvas.getByText('Loading preview')).animationName).toBe('none');
  },
};

/** Tab to the title and press Enter to follow the link. */
export const Keyboard: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import { LinkPreview } from '@jfrader/ui';

const cover = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 191 100"><circle cx="60" cy="50" r="24" opacity="0.5"/></svg>');
const favicon = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7"/></svg>');

<LinkPreview
  data={{
    url: 'https://example.com/guide',
    site: 'Northwind Docs',
    title: 'Spacing and type guide',
    description: 'How we size, space and set type across product surfaces.',
    image: { src: cover, alt: 'Guide cover with a large dot' },
    favicon,
  }}
  slotProps={{ title: { onClick: (event) => event.preventDefault() } }}
/>` } } },
  args: { slotProps: { title: { onClick: fn((event) => event.preventDefault()) } } },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.tab();
    const title = canvas.getByRole('link', { name: DATA.title });
    await expect(title.ownerDocument.activeElement).toBe(title);
    await expect(getComputedStyle(title).outlineStyle).not.toBe('none');
    await expect(getComputedStyle(title).outlineWidth).toBe('2px');
    await userEvent.keyboard('{Enter}');
    await expect(args.slotProps!.title!.onClick).toHaveBeenCalledTimes(1);
    await userEvent.keyboard(' ');
    await expect(args.slotProps!.title!.onClick).toHaveBeenCalledTimes(1);
    await userEvent.tab();
    await expect(title.ownerDocument.activeElement).not.toBe(title);
    await userEvent.tab({ shift: true });
    await expect(title.ownerDocument.activeElement).toBe(title);
  },
};

function ReplacementTitle(props: ComponentPropsWithRef<'a'>) {
  return <a {...props} data-slot="link-preview-title" />;
}

/** Apply root and part styles and take a ref to the root div. */
// This story tests sx and the documented slot css API.
export const Customization: Story = {
  render: (args) => <LinkPreview {...args} slots={{ title: ReplacementTitle }} />,
  args: { ref: fn(), sx: { borderStyle: 'dashed' }, slotProps: { title: { css: { textDecoration: 'underline' }, target: '_blank', rel: 'noreferrer' }, body: { css: { padding: vars.space[4] } }, image: { onLoad: fn() } } },
  play: async ({ canvas, canvasElement, args }) => {
    const root = canvasElement.querySelector('[data-ui="link-preview"]')!;
    await expect(args.ref).toHaveBeenCalledWith(root);
    await expect(getComputedStyle(root).borderTopStyle).toBe('dashed');
    const title = canvas.getByRole('link');
    await expect(title).toHaveAttribute('data-slot', 'link-preview-title');
    await expect(title).toHaveAttribute('data-ui', 'link-preview-title');
    await expect(title).toHaveAttribute('href', URL);
    await expect(getComputedStyle(title).overflowWrap).toBe('anywhere');
    await expect(canvasElement.querySelector('[data-ui="link-preview-title"]:not([data-slot])')).toBeNull();
    await expect(getComputedStyle(title).textDecorationLine).toBe('underline');
    await expect(title).toHaveAttribute('target', '_blank');
    await expect(getComputedStyle(canvasElement.querySelector('[data-ui="link-preview-card"]')!).paddingTop).toBe('16px');
    await waitFor(() => expect(args.slotProps!.image!.onLoad).toHaveBeenCalledTimes(1));
  },
};

function UpdateDemo() {
  const [data, setData] = useState<LinkPreviewData>({ url: URL });
  const [status, setStatus] = useState<'pending' | 'ready'>('pending');
  return <Stack>
    <LinkPreview data={data} status={status} />
    <Button onClick={() => { setData(DATA); setStatus('ready'); }}>Show metadata</Button>
  </Stack>;
}

/** Update the supplied metadata when your app receives it. */
export const DataUpdates: Story = {
  render: () => <UpdateDemo />,
  parameters: { docs: { source: { code: '<LinkPreview data={metadata} status={loading ? "pending" : "ready"} />' } } },
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.getByText('Loading preview')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Show metadata' }));
    await waitFor(() => expect(canvas.getByRole('link', { name: DATA.title })).toBeVisible());
    await expect(canvas.queryByText('Loading preview')).not.toBeInTheDocument();
    await expect(canvas.getByRole('img', { name: DATA.image!.alt })).toBeInTheDocument();
  },
};

/** Render numeric zero descriptions and omit empty descriptions. */
export const FalsyDescription: Story = {
  render: () => <Stack>
    <LinkPreview data={{ url: URL, title: 'Zero', description: 0 }} />
    <LinkPreview data={{ url: URL, title: 'Empty', description: '' }} />
    <LinkPreview data={{ url: URL, title: 'Hidden', description: false }} />
  </Stack>,
  parameters: { docs: { source: { code: '<LinkPreview data={{ url: "https://example.com/guide", description: 0 }} />' } } },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByText('0')).toBeVisible();
    await expect(canvasElement.querySelectorAll('p')).toHaveLength(1);
  },
};
