import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn } from 'storybook/test';
import { AttachmentList, type Attachment } from './index';

const FILES: readonly Attachment[] = [
  { id: 'brief', name: 'Project brief.pdf', kind: 'file', size: 123_000, url: '/brief.pdf' },
  { id: 'notes', name: 'Meeting notes.txt', kind: 'file', size: 42, url: '/notes.txt' },
];

const meta = {
  title: 'Data display/AttachmentList',
  component: AttachmentList,
  tags: ['autodocs'],
  args: { attachments: FILES, locale: 'en-US' },
  parameters: {
    docs: {
      description: { component: 'Show files and image previews with names, sizes, and download links.' },
      source: { code: `<AttachmentList attachments={[
  { id: 'brief', name: 'Project brief.pdf', kind: 'file', size: 123000, url: '/brief.pdf' },
]} />` },
      usage: `### Files and links
- Supply a stable id, name, and kind for each attachment. Sizes are bytes; locale formats them with decimal kB and MB units.
- Images use url for their preview. Supply alt, width, and height when known.
- Files without a URL, or with an unsafe URL, appear as text. Relative URLs and http, https, and blob schemes are allowed; data and javascript schemes are not.
- Links download using the attachment name by default. Set download to false to navigate, and target to choose a browsing context. Your app owns fetching files and reporting upload failures.

### Expansion and keyboard
- The native list shows four files initially. Set previewCount to a different limit, or Infinity to show all. Expansion stays open for the lifetime of the list.
- Tab and Shift+Tab move through links and the expand button. Enter follows a link; Enter or Space expands the list. The component never moves focus after expansion.
- The ref reaches the list element. Native list attributes and sx apply to the list, not the expand button; use slotProps.expandButton for that button.
- Labels translate the list name and the expand button. The defaults are English.`,
    },
  },
} satisfies Meta<typeof AttachmentList>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Files: Story = {
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.getByRole('list', { name: 'Attachments' })).toHaveAttribute('data-ui', 'attachment-list');
    const first = canvas.getByRole('link', { name: 'Project brief.pdf · 123 kB' });
    await expect(first).toHaveAttribute('href', '/brief.pdf');
    await expect(first).toHaveAttribute('download', 'Project brief.pdf');
    await userEvent.tab();
    await expect(first.ownerDocument.activeElement).toBe(first);
    await expect(getComputedStyle(first).outlineStyle).not.toBe('none');
    await userEvent.tab();
    const second = canvas.getByRole('link', { name: 'Meeting notes.txt · 42 byte' });
    await expect(second.ownerDocument.activeElement).toBe(second);
    await userEvent.tab({ shift: true });
    await expect(first.ownerDocument.activeElement).toBe(first);
  },
};

export const ImagePreview: Story = {
  args: { attachments: [{ id: 'image', name: 'Project card.png', kind: 'image', url: '/og-image.png', alt: 'Project share card', width: 1200, height: 630 }] },
  play: async ({ canvas }) => {
    const image = canvas.getByRole('img', { name: 'Project share card' });
    await expect(image).toHaveAttribute('src', '/og-image.png');
    await expect(image).toHaveAttribute('width', '1200');
    await expect(image).toHaveAttribute('height', '630');
  },
};

export const MissingAndUnsafeURLs: Story = {
  args: { previewCount: Infinity, attachments: [
    { id: 'missing', name: 'Missing URL.txt', kind: 'file' },
    { id: 'script', name: 'Script link.txt', kind: 'file', url: 'javascript:alert(1)' },
    { id: 'data', name: 'Inline image.png', kind: 'image', url: 'data:image/png;base64,AA==' },
    { id: 'space', name: 'Whitespace URL.txt', kind: 'file', url: ' https://example.com/file' },
    { id: 'slash', name: 'Backslash URL.txt', kind: 'file', url: 'https:\\example.com/file' },
  ] },
  play: async ({ canvas }) => {
    await expect(canvas.getAllByRole('listitem')).toHaveLength(5);
    await expect(canvas.queryByRole('link')).not.toBeInTheDocument();
    await expect(canvas.queryByRole('img')).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button')).not.toBeInTheDocument();
  },
};

export const MoreFiles: Story = {
  args: {
    attachments: [...FILES, ...Array.from({ length: 4 }, (_, index): Attachment => ({ id: `file-${index}`, name: `Report ${index + 1}.pdf`, kind: 'file' }))],
    slotProps: { expandButton: { onClick: fn() } },
  },
  play: async ({ canvas, args, userEvent }) => {
    await expect(canvas.getAllByRole('listitem')).toHaveLength(4);
    const button = canvas.getByRole('button', { name: 'Show 2 more attachments' });
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.tab();
    await expect(button.ownerDocument.activeElement).toBe(button);
    await expect(getComputedStyle(button).outlineStyle).not.toBe('none');
    await userEvent.keyboard(' ');
    await expect(canvas.getAllByRole('listitem')).toHaveLength(6);
    await expect(canvas.queryByRole('button')).not.toBeInTheDocument();
    await expect(args.slotProps?.expandButton?.onClick).toHaveBeenCalledTimes(1);
  },
};

export const CustomLimit: Story = {
  args: { previewCount: 0 },
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.queryByRole('listitem')).not.toBeInTheDocument();
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    await expect(canvas.getAllByRole('listitem')).toHaveLength(2);
  },
};

export const CancelExpansion: Story = {
  args: { previewCount: 1, slotProps: { expandButton: { onClick: fn((event) => event.preventDefault()) } } },
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Show 1 more attachment' }));
    await expect(canvas.getAllByRole('listitem')).toHaveLength(1);
    await expect(args.slotProps?.expandButton?.onClick).toHaveBeenCalledTimes(1);
  },
};

export const LinkTarget: Story = {
  args: { attachments: [{ ...FILES[0]!, download: false, target: '_blank', url: 'https://example.com/brief.pdf' }] },
  play: async ({ canvas }) => {
    const link = canvas.getByRole('link');
    await expect(link).not.toHaveAttribute('download');
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  },
};

export const Localized: Story = {
  args: { locale: 'de-DE', labels: { attachments: 'Anhänge', showAttachments: (count) => `${count} weitere Anhänge` }, attachments: [{ ...FILES[0]!, size: 1234 }] },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('list', { name: 'Anhänge' })).toBeInTheDocument();
    await expect(canvas.getByText('Project brief.pdf · 1,2 kB')).toBeInTheDocument();
  },
};

export const Empty: Story = { args: { attachments: [] } };
export const RTL: Story = { args: { dir: 'rtl' } };
export const Light: Story = { globals: { theme: 'light' } };
