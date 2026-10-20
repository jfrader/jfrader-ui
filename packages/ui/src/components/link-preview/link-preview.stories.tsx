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
const previewSource = (example: string) => `import { useState, type ComponentPropsWithRef } from 'react';
import { Button, LinkPreview, styled, type LinkPreviewData } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const cover = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 191 100"><circle cx="60" cy="50" r="24" opacity="0.5"/></svg>');
const favicon = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7"/></svg>');
const data: LinkPreviewData = {
  url: 'https://example.com/guide', site: 'Northwind Docs', title: 'Spacing and type guide',
  description: 'How we size, space and set type across product surfaces.',
  image: { src: cover, alt: 'Guide cover with a large dot' }, favicon,
};

${example}`;
const meta = {
  title: 'Data display/LinkPreview',
  component: LinkPreview,
  tags: ['autodocs'],
  args: { data: DATA },
  decorators: [(Story) => <Frame><Story /></Frame>],
  parameters: {
    docs: {
      description: { component: 'Show a link with its title, site, description and image.' },
      sections: [
        { title: 'Basic', stories: ['Default'] },
        { title: 'Metadata', stories: ['NoImage', 'DataUpdates'] },
        { title: 'Images', stories: ['DecorativeImage', 'BrokenImage'] },
        { title: 'Loading and errors', stories: ['Loading', 'Unavailable', 'Error'] },
        { title: 'Long URLs', stories: ['LongUrl', 'LongText'] },
        { title: 'Keyboard', stories: ['Keyboard'] },
        { title: 'Composition', stories: ['Customization'] },
      ],
      usage: `### When to use
Show metadata for a link already present in a page or message. Use LinkUnfurl for composing a draft with detected URLs and expandable previews.

### Limits
Fetch metadata in your application; the card makes no metadata requests. Use absolute HTTP(S) destinations. Titles occupy up to two lines and descriptions up to three, with complete text retained in the DOM. Keep descriptions noninteractive.

### Keyboard and accessibility
Tab focuses the title link and Enter follows it. The rest of the card is not clickable. Describe informative cover images and leave decorative images unnamed; favicons are decorative. Reduced motion stops decorative animation.`,
    },
  },
} satisfies Meta<typeof LinkPreview>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Link with metadata',
  parameters: { docs: { description: { story: 'Show a destination with its site name, title, description, and cover.' }, source: { language: 'tsx', code: previewSource('<LinkPreview data={data} />') } } },
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
  name: 'Loading metadata',
  parameters: { docs: { description: { story: 'Keep the destination link available while metadata loads.' }, source: { language: 'tsx', code: previewSource('<LinkPreview data={data} status="pending" />') } } },
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
  name: 'No metadata available',
  parameters: { docs: { description: { story: 'Show the destination when no preview metadata is available.' }, source: { language: 'tsx', code: previewSource('<LinkPreview data={data} status="none" />') } } },
  args: { status: 'none' },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('No preview')).toBeVisible();
    await expect(canvas.getByRole('link', { name: URL })).toBeVisible();
    await expect(canvas.queryByRole('img')).not.toBeInTheDocument();
  },
};

/** Display the error supplied by your app. */
export const Error: Story = {
  name: 'Metadata error',
  parameters: { docs: { description: { story: 'Show an application-supplied error beside the destination.' }, source: { language: 'tsx', code: previewSource('<LinkPreview data={{ ...data, error: "Site unreachable" }} status="error" />') } } },
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
  name: 'Text-only metadata',
  parameters: { docs: { description: { story: 'Show a title and description without reserving a cover frame.' }, source: { language: 'tsx', code: previewSource('<LinkPreview data={{ url: data.url, title: data.title, description: data.description }} />') } } },
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
  name: 'Unavailable cover',
  parameters: { docs: { description: { story: 'Retain the cover frame when an image cannot load.' }, source: { language: 'tsx', code: previewSource('<LinkPreview data={{ ...data, image: { src: "data:image/png;base64,broken", alt: "Cover" } }} />') } } },
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
  name: 'Decorative cover',
  parameters: { docs: { description: { story: 'Keep a decorative cover out of the accessible image list.' }, source: { language: 'tsx', code: previewSource('<LinkPreview data={{ ...data, image: { src: cover, alt: "" } }} />') } } },
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
  name: 'Long titles and descriptions',
  parameters: { docs: { description: { story: 'Clamp long metadata while keeping the full title as the link name.' }, source: { language: 'tsx', code: previewSource(`<LinkPreview data={{ url: data.url,
  title: 'A very long guide title with detailed notes on design systems and reusable interface patterns '.repeat(8).trim(),
  description: 'Read the complete guide for spacing, typography and component composition. '.repeat(16).trim(),
}} />`) } } },
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
  name: 'Focus the title link',
  parameters: { docs: { description: { story: 'Tab to the title and press Enter; navigation is prevented in this example.' }, source: { language: 'tsx', code: `import { LinkPreview } from '@jfrader/ui';

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
export const Customization: Story = {
  name: 'Custom title and spacing',
  parameters: { docs: { description: { story: 'Replace the title element and style the card border, title, and body.' }, source: { language: 'tsx', code: previewSource(`function Title(props: ComponentPropsWithRef<'a'>) {
  return <a {...props} />;
}

<LinkPreview data={data} slots={{ title: Title }} sx={{ borderStyle: 'dashed' }}
  slotProps={{ title: { sx: { textDecoration: 'underline' }, target: '_blank', rel: 'noreferrer' }, body: { sx: { padding: vars.space[4] } } }} />`) } } },
  render: (args) => <LinkPreview {...args} slots={{ title: ReplacementTitle }} />,
  args: { ref: fn(), sx: { borderStyle: 'dashed' }, slotProps: { title: { sx: { textDecoration: 'underline' }, target: '_blank', rel: 'noreferrer' }, body: { sx: { padding: vars.space[4] } }, image: { onLoad: fn() } } },
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
  name: 'Update metadata',
  render: () => <UpdateDemo />,
  parameters: { docs: { description: { story: 'Replace the loading state with metadata when you press Show metadata.' }, source: { language: 'tsx', code: previewSource(`const Stack = styled.div({ display: 'grid', gap: vars.space[3] });

function Preview() {
  const [metadata, setMetadata] = useState<LinkPreviewData>({ url: data.url });
  const [status, setStatus] = useState<'pending' | 'ready'>('pending');
  return <Stack>
    <LinkPreview data={metadata} status={status} />
    <Button onClick={() => { setMetadata(data); setStatus('ready'); }}>Show metadata</Button>
  </Stack>;
}`) } } },
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.getByText('Loading preview')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Show metadata' }));
    await waitFor(() => expect(canvas.getByRole('link', { name: DATA.title })).toBeVisible());
    await expect(canvas.queryByText('Loading preview')).not.toBeInTheDocument();
    await expect(canvas.getByRole('img', { name: DATA.image!.alt })).toBeInTheDocument();
  },
};

export const LongUrl: Story = {
  name: 'Long destination URL',
  args: { data: { url: 'https://example.com/guide/components/media/gallery?collection=september-traverse&view=all-photographs&sort=captured-at' } },
  parameters: { docs: { description: { story: 'Use the complete destination as the title when metadata is missing.' }, source: { language: 'tsx', code: `import { LinkPreview } from '@jfrader/ui';

<LinkPreview data={{ url: 'https://example.com/guide/components/media/gallery?collection=september-traverse&view=all-photographs&sort=captured-at' }} />` } } },
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
