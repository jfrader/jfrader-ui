import type { ComponentPropsWithRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';
import { AttachmentList, type Attachment } from './index';

const FILES: readonly Attachment[] = [
  { id: 'launch-brief', name: 'Launch brief.pdf', kind: 'file', size: 2_400_000, url: '/launch-brief.pdf' },
  { id: 'notes', name: 'Pricing notes.txt', kind: 'file', size: 4_200, url: '/pricing-notes.txt' },
];
function ReplacementRoot(props: ComponentPropsWithRef<'ul'>) {
  return <ul {...props} data-testid="replacement-root" />;
}
function SugarRoot(props: ComponentPropsWithRef<'ul'>) {
  return <ul {...props} data-testid="sugar-root" />;
}
export const RootComponent: StoryObj<typeof AttachmentList> = {
  tags: ['!autodocs'], args: { attachments: FILES, component: SugarRoot },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByTestId('sugar-root')).toHaveAttribute('data-ui', 'attachment-list');
  },
};
export const RootReplacement: StoryObj<typeof AttachmentList> = {
  tags: ['!autodocs'],
  args: { attachments: FILES, component: SugarRoot, slots: { root: ReplacementRoot }, ref: fn(), className: 'consumer-root', title: 'consumer', slotProps: { root: { ref: fn(), title: 'slot', className: 'slot-root', 'data-ui': 'custom' } } },
  play: async ({ canvasElement, args }) => {
    const root = within(canvasElement).getByTestId('replacement-root');
    await expect(root.tagName).toBe('UL');
    await expect(root).toHaveClass('consumer-root', 'slot-root');
    await expect(root).toHaveAttribute('title', 'slot');
    await expect(root).toHaveAttribute('data-ui', 'attachment-list custom');
    await expect(args.ref).toHaveBeenCalledWith(root);
    await expect(args.slotProps?.root?.ref).toHaveBeenCalledWith(root);
    await expect(within(root).getAllByRole('listitem')).toHaveLength(2);
  },
};

const meta = {
  title: 'Data display/AttachmentList',
  component: AttachmentList,
  tags: ['autodocs'],
  args: { attachments: FILES, locale: 'en-US' },
  parameters: {
    docs: {
      description: { component: 'Show files and image previews with names, sizes, and download links.' },
      sections: [
        { title: 'Basic', stories: ['Files'] },
        { title: 'Images and files', stories: ['ImagePreview'] },
        { title: 'Limits and more', stories: ['MoreFiles', 'CustomLimit'] },
        { title: 'Links', stories: ['LinkTarget'] },
        { title: 'States', stories: ['MissingAndUnsafeURLs', 'Empty'] },
        { title: 'Slots', stories: ['LinkReplacement'] },
      ],
      usage: `### When to use
Show attachments on a message or record, with image previews or file download links. Your app owns fetching files and reporting upload failures.

### Constraints
Sizes are bytes, displayed in decimal kB and MB. Give images meaningful alternative text. Missing or unsafe URLs render as text; relative URLs and http, https and blob schemes are allowed, but data and javascript schemes are not. Expansion stays open for the lifetime of the list. An empty list adds no empty-state message.

### Keyboard and accessibility
Tab and Shift+Tab move through links and the expand button. Enter follows a link; Enter or Space expands the list. Expansion does not move focus. Translate the list name and expansion action for your audience.`,
    },
  },
} satisfies Meta<typeof AttachmentList>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Files: Story = {
  name: 'Download files',
  parameters: { docs: {
    description: { story: 'Show two downloadable files with their names and formatted sizes.' },
    source: { language: 'tsx', code: `import { AttachmentList } from '@jfrader/ui';

<AttachmentList locale="en-US" attachments={[
  { id: 'launch-brief', name: 'Launch brief.pdf', kind: 'file', size: 2400000, url: '/launch-brief.pdf' },
  { id: 'notes', name: 'Pricing notes.txt', kind: 'file', size: 4200, url: '/pricing-notes.txt' },
]} />` },
  } },
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.getByRole('list', { name: 'Attachments' })).toHaveAttribute('data-ui', 'attachment-list');
    const first = canvas.getByRole('link', { name: 'Launch brief.pdf · 2.4 MB' });
    await expect(first).toHaveAttribute('href', '/launch-brief.pdf');
    await expect(first).toHaveAttribute('download', 'Launch brief.pdf');
    await userEvent.tab();
    await expect(first.ownerDocument.activeElement).toBe(first);
    await expect(getComputedStyle(first).outlineStyle).not.toBe('none');
    await userEvent.tab();
    const second = canvas.getByRole('link', { name: 'Pricing notes.txt · 4.2 kB' });
    await expect(second.ownerDocument.activeElement).toBe(second);
    await userEvent.tab({ shift: true });
    await expect(first.ownerDocument.activeElement).toBe(first);
  },
};

export const ImagePreview: Story = {
  name: 'Image preview',
  parameters: { docs: {
    description: { story: 'Preview an image with alternative text and its intrinsic dimensions.' },
    source: { language: 'tsx', code: `import { AttachmentList } from '@jfrader/ui';

<AttachmentList locale="en-US" attachments={[
  { id: 'image', name: 'Share card.png', kind: 'image', url: '/og-image.png', alt: 'Share card preview', width: 1200, height: 630 },
]} />` },
  } },
  args: { attachments: [{ id: 'image', name: 'Share card.png', kind: 'image', url: '/og-image.png', alt: 'Share card preview', width: 1200, height: 630 }] },
  play: async ({ canvas }) => {
    const image = canvas.getByRole('img', { name: 'Share card preview' });
    await expect(image).toHaveAttribute('src', '/og-image.png');
    await expect(image).toHaveAttribute('width', '1200');
    await expect(image).toHaveAttribute('height', '630');
  },
};

export const MissingAndUnsafeURLs: Story = {
  name: 'Unavailable links',
  parameters: {
    docs: {
      description: { story: 'Read file names as text when a URL is missing or unsafe.' },
      source: {
        language: 'tsx',
        code: `import { AttachmentList } from '@jfrader/ui';

export function Example() {
  return (
    <AttachmentList
      attachments={[
        { id: 'missing', name: 'Missing URL.txt', kind: 'file' },
        { id: 'script', name: 'Script link.txt', kind: 'file', url: 'javascript:alert(1)' },
        { id: 'data', name: 'Inline image.png', kind: 'image', url: 'data:image/png;base64,AA==' },
        { id: 'space', name: 'Whitespace URL.txt', kind: 'file', url: ' https://example.com/file' },
        { id: 'slash', name: 'Backslash URL.txt', kind: 'file', url: 'https:\\\\example.com/file' },
      ]}
      locale="en-US"
      previewCount={Infinity}
    />
  );
}`,
      },
    },
  },
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
  name: 'Expand the attachment list',
  parameters: {
    docs: {
      description: { story: 'Show four attachments initially, then reveal the remaining two.' },
      source: {
        language: 'tsx',
        code: `import { AttachmentList } from '@jfrader/ui';

<AttachmentList locale="en-US" attachments={[
  { id: 'launch-brief', name: 'Launch brief.pdf', kind: 'file', size: 2400000, url: '/launch-brief.pdf' },
  { id: 'notes', name: 'Pricing notes.txt', kind: 'file', size: 4200, url: '/pricing-notes.txt' },
  { id: 'invoice-1', name: 'Invoice 2026-01.pdf', kind: 'file' },
  { id: 'invoice-2', name: 'Invoice 2026-02.pdf', kind: 'file' },
  { id: 'invoice-3', name: 'Invoice 2026-03.pdf', kind: 'file' },
  { id: 'invoice-4', name: 'Invoice 2026-04.pdf', kind: 'file' },
]} />`,
      },
    },
  },
  args: {
    attachments: [...FILES, ...Array.from({ length: 4 }, (_, index): Attachment => ({ id: `file-${index}`, name: `Invoice 2026-0${index + 1}.pdf`, kind: 'file' }))],
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
  name: 'Start with files collapsed',
  parameters: { docs: {
    description: { story: 'Reveal the whole list from a single expansion action.' },
    source: { language: 'tsx', code: `import { AttachmentList } from '@jfrader/ui';

<AttachmentList locale="en-US" previewCount={0} attachments={[
  { id: 'launch-brief', name: 'Launch brief.pdf', kind: 'file', size: 2400000, url: '/launch-brief.pdf' },
  { id: 'notes', name: 'Pricing notes.txt', kind: 'file', size: 4200, url: '/pricing-notes.txt' },
]} />` },
  } },
  args: { previewCount: 0 },
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.queryByRole('listitem')).not.toBeInTheDocument();
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    await expect(canvas.getAllByRole('listitem')).toHaveLength(2);
  },
};

export const CancelExpansion: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { AttachmentList, type Attachment } from '@jfrader/ui';

const FILES: readonly Attachment[] = [
  {
    id: 'launch-brief',
    name: 'Launch brief.pdf',
    kind: 'file',
    size: 2400000,
    url: '/launch-brief.pdf',
  },
  { id: 'notes', name: 'Pricing notes.txt', kind: 'file', size: 4200, url: '/pricing-notes.txt' },
];

export function Example() {
  return (
    <AttachmentList
      attachments={FILES}
      locale="en-US"
      previewCount={1}
      slotProps={{ expandButton: { onClick: (event) => event.preventDefault() } }}
    />
  );
}`,
      },
    },
  },
  args: { previewCount: 1, slotProps: { expandButton: { onClick: fn((event) => event.preventDefault()) } } },
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Show 1 more attachment' }));
    await expect(canvas.getAllByRole('listitem')).toHaveLength(1);
    await expect(args.slotProps?.expandButton?.onClick).toHaveBeenCalledTimes(1);
  },
};

function SlotLink(props: ComponentPropsWithRef<'a'>) {
  return <a {...props} data-slot="attachment-link" />;
}

export const LinkReplacement: Story = {
  name: 'Replace file links',
  parameters: { docs: {
    description: { story: 'Wrap each file link in an app-owned component while preserving its native attributes.' },
    source: { language: 'tsx', code: `import type { ComponentPropsWithRef } from 'react';
import { AttachmentList } from '@jfrader/ui';

function AttachmentLink(props: ComponentPropsWithRef<'a'>) {
  return <a {...props} data-slot="attachment-link" />;
}

<AttachmentList locale="en-US" slots={{ link: AttachmentLink }} attachments={[
  { id: 'launch-brief', name: 'Launch brief.pdf', kind: 'file', size: 2400000, url: '/launch-brief.pdf' },
  { id: 'notes', name: 'Pricing notes.txt', kind: 'file', size: 4200, url: '/pricing-notes.txt' },
]} />` },
  } },
  render: (args) => <AttachmentList {...args} slots={{ link: SlotLink }} />,
  play: async ({ canvas, canvasElement }) => {
    const [link] = canvas.getAllByRole('link');
    await expect(link).toHaveAttribute('data-slot', 'attachment-link');
    await expect(link).toHaveAttribute('data-ui', 'attachment-list-link');
    await expect(link).toHaveAttribute('href', '/launch-brief.pdf');
    await expect(link).toHaveTextContent('Launch brief.pdf');
    await expect(canvasElement.querySelector('[data-ui="attachment-list-link"]:not([data-slot])')).toBeNull();
  },
};

export const LinkTarget: Story = {
  name: 'Open a file in a new tab',
  parameters: { docs: {
    description: { story: 'Navigate to an external file instead of requesting a download.' },
    source: { language: 'tsx', code: `import { AttachmentList } from '@jfrader/ui';

<AttachmentList locale="en-US" attachments={[
  { id: 'launch-brief', name: 'Launch brief.pdf', kind: 'file', size: 2400000,
    url: 'https://example.com/launch-brief.pdf', download: false, target: '_blank' },
]} />` },
  } },
  args: { attachments: [{ ...FILES[0]!, download: false, target: '_blank', url: 'https://example.com/launch-brief.pdf' }] },
  play: async ({ canvas }) => {
    const link = canvas.getByRole('link');
    await expect(link).not.toHaveAttribute('download');
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  },
};

export const Localized: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `import { AttachmentList, type Attachment } from '@jfrader/ui';

const FILES: readonly Attachment[] = [
  {
    id: 'launch-brief',
    name: 'Launch brief.pdf',
    kind: 'file',
    size: 2400000,
    url: '/launch-brief.pdf',
  },
  { id: 'notes', name: 'Pricing notes.txt', kind: 'file', size: 4200, url: '/pricing-notes.txt' },
];

export function Example() {
  return (
    <AttachmentList
      attachments={[{ ...FILES[0]!, size: 1234 }]}
      locale="de-DE"
      labels={{ attachments: 'Anhänge', showAttachments: (count) => \`\${count} weitere Anhänge\` }}
    />
  );
}`,
      },
    },
  },
  args: { locale: 'de-DE', labels: { attachments: 'Anhänge', showAttachments: (count) => `${count} weitere Anhänge` }, attachments: [{ ...FILES[0]!, size: 1234 }] },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('list', { name: 'Anhänge' })).toBeInTheDocument();
    await expect(canvas.getByText('Launch brief.pdf · 1,2 kB')).toBeInTheDocument();
  },
};

export const Empty: Story = {
  name: 'No attachments',
  parameters: { docs: {
    description: { story: 'An empty attachment list leaves the empty-state message to the surrounding page.' },
    source: { language: 'tsx', code: `import { AttachmentList } from '@jfrader/ui';

<AttachmentList locale="en-US" attachments={[]} />` },
  } },
  args: { attachments: [] },
};
export const RTL: Story = { args: { dir: 'rtl' } };
export const Light: Story = { globals: { theme: 'light' } };
