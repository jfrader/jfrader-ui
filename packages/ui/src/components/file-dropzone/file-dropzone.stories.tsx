import {
  FieldReplacementRoot,
  FieldSugarRoot,
  FieldReplacementLabel,
  fieldRootStyles,
  expectFieldSlotCustomization,
} from '../../testing/field-slot-fixtures';
import { act, useId, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, spyOn, waitFor, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { withLightTheme } from '../../testing/story-decorators';
import { Button, type ButtonProps } from '../button';
import { Progress, type ProgressProps } from '../progress';
import {
  FileDropzone,
  type FileDropzoneItem,
  type FileDropzoneMessages,
  type FileDropzoneProps,
  type FileDropzoneUpload,
} from './index';
// `styled` is the app-facing styling API; consumers import it from `@jfrader/ui`.
import { styled } from '../../index';

const NarrowFrame = styled.div({ inlineSize: '18rem', maxInlineSize: '100%' });

const messages: FileDropzoneMessages = {
  browse: 'Browse files',
  files: 'Files',
  remove: name => `Remove ${name}`,
  retry: name => `Retry ${name}`,
  rejection: code =>
    ({
      type: 'Choose an accepted file type.',
      size: 'File exceeds the size limit.',
      count: 'File count limit reached.',
    })[code],
  status: status =>
    ({
      idle: 'Ready',
      uploading: 'Uploading',
      uploaded: 'Uploaded',
      failed: 'Upload failed',
    })[status],
  added: count => `${new Intl.NumberFormat('en').format(count)} added`,
  removed: name => `${name} removed`,
  count: count => `${new Intl.NumberFormat('en').format(count)} selected`,
  uploadError: 'Upload failed. Retry the file.',
};
const Frame = styled.div({
  inlineSize: 'min(100%, 36rem)',
  display: 'grid',
  gap: vars.space[4],
});
// The keyboard focus probe uses sx to disable transitions during measurement.
const testMotion = css({ '&, & *': { transitionDuration: '0s' } });
const messagesSource = `import { FileDropzone, type FileDropzoneMessages } from '@jfrader/ui';

const messages: FileDropzoneMessages = {
  browse: 'Browse files',
  files: 'Files',
  remove: name => \`Remove \${name}\`,
  retry: name => \`Retry \${name}\`,
  rejection: code => ({
    type: 'Choose an accepted file type.',
    size: 'File exceeds the size limit.',
    count: 'File count limit reached.',
  })[code],
  status: status => ({
    idle: 'Ready', uploading: 'Uploading', uploaded: 'Uploaded', failed: 'Upload failed',
  })[status],
  added: count => \`\${new Intl.NumberFormat('en').format(count)} added\`,
  removed: name => \`\${name} removed\`,
  count: count => \`\${new Intl.NumberFormat('en').format(count)} selected\`,
  uploadError: 'Upload failed. Retry the file.',
};`;
const emptySource = `${messagesSource}

<FileDropzone label="Add receipts" description="Drop files or browse."
  note="PDF and image attachments" messages={messages} />`;
const selectedSource = `${messagesSource}

<FileDropzone label="Add receipts" description="Drop files or browse."
  note="PDF and image attachments" messages={messages}
  defaultValue={[{ id: 'remote', name: 'invoice.pdf', size: 12500, uploaded: true }]} />`;
const uploadSource = `${messagesSource}

import type { FileDropzoneUpload } from '@jfrader/ui';

export function ReceiptUpload({ upload }: { upload: FileDropzoneUpload }) {
  return <FileDropzone label="Add receipts" description="Drop files or browse."
    note="PDF and image attachments" messages={messages} onUpload={upload} />;
}`;
const progressSource = `${messagesSource}

import type { FileDropzoneUpload } from '@jfrader/ui';

export function ReceiptUpload({ uploadUrl }: { uploadUrl: string }) {
  const upload: FileDropzoneUpload = (item, { signal, onProgress }) =>
    new Promise<void>((resolve, reject) => {
      if (!item.file) return reject(new Error('Choose a local file.'));
      if (signal.aborted) return reject(signal.reason);
      const request = new XMLHttpRequest();
      const abort = () => request.abort();
      const finish = (error?: Error) => {
        signal.removeEventListener('abort', abort);
        if (error) reject(error);
        else resolve();
      };
      request.open('POST', uploadUrl);
      request.upload.onprogress = event => {
        if (event.lengthComputable) onProgress(event.loaded / event.total * 100);
      };
      request.onload = () => request.status >= 200 && request.status < 300
        ? finish() : finish(new Error('Upload failed. Retry the file.'));
      request.onerror = () => finish(new Error('Upload failed. Retry the file.'));
      request.onabort = () => finish(new DOMException('Cancelled', 'AbortError'));
      signal.addEventListener('abort', abort, { once: true });
      const body = new FormData();
      body.append('file', item.file);
      request.send(body);
    });
  return <FileDropzone label="Add receipts" description="Drop files or browse."
    note="PDF and image attachments" messages={messages} onUpload={upload} />;
}`;
const meta = {
  title: 'Inputs/FileDropzone',
  component: FileDropzone,
  tags: ['autodocs'],
  args: {
    label: 'Add receipts',
    description: 'Drop files or browse.',
    note: 'PDF and image attachments',
    messages,
    onValueChange: fn(),
    onReject: fn(),
  },
  decorators: [
    Story => (
      <Frame>
        <Story />
      </Frame>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          'Choose, drop or paste files, then manage the selection and upload progress.',
      },
      sections: [
        { title: 'Basic', stories: ['Default'] },
        { title: 'Drag and drop', stories: ['DropAndPaste', 'DragAnnouncement'] },
        { title: 'File types and size limits', stories: ['AcceptedTypes', 'SizeLimit'] },
        { title: 'Multiple files', stories: ['Multiple', 'CountLimit'] },
        { title: 'Upload progress', stories: ['UploadIndeterminate', 'UploadProgress'] },
        { title: 'Errors', stories: ['CustomValidation'] },
        { title: 'Disabled and read-only', stories: ['Disabled', 'ReadOnly'] },
        { title: 'Composition', stories: ['Controlled', 'ListInside', 'FormReset'] },
      ],
      usage: `### When to use
Collect attachments through the file picker, drag and drop, or focused paste. Use a regular file input when a selection list and upload feedback are not needed.

### Limits and uploads
Validate files on the server as well as in the browser. File sizes use decimal 1000 scaling. Uploads and image previews start only after a selection is committed; existing rows never auto-upload.

Submit the selected items, not input.files: dropped and accumulated files are absent from native FormData. Required validation checks the committed list. Paste accepts files only while focus is inside the dropzone, excluding editable controls.

### Keyboard and accessibility
Click the surface to open the native picker. Tab reaches the file input, with a focus ring around the surface, then the row actions. Enter/Space open the picker. ArrowUp/ArrowDown move between rows without wrapping and retain the action; Delete/Backspace remove a file. Escape passes through.

Provide localized action labels, validation messages and announcements. Check the OS picker, dragging, screen readers and mobile selection in your application.`,
    },
  },
} satisfies Meta<typeof FileDropzone>;
export default meta;
type Story = StoryObj<typeof meta>;
const file = (name = 'receipt.pdf', contents = 'pdf', type = 'application/pdf') =>
  new File([contents], name, { type, lastModified: 1 });
const inputOf = (element: HTMLElement) => element.querySelector<HTMLInputElement>('input[type="file"]')!;
const rootOf = (element: HTMLElement) => element.querySelector<HTMLElement>('[data-ui="file-dropzone"]')!;
const targetOf = (element: HTMLElement) => element.querySelector<HTMLElement>('[data-dragging]')!;
// Row actions keep 32px (vars.space[8]); fractional devicePixelRatio may round the measured box.
const MIN_ACTION_HEIGHT = 32;
const PX_TOLERANCE = 0.5;
const existing: FileDropzoneItem[] = [{ id: 'remote', name: 'invoice.pdf', size: 12500, uploaded: true }];
function ControlledExample(props: FileDropzoneProps) {
  const [value, setValue] = useState(props.defaultValue ?? []);
  return (
    <FileDropzone
      {...props}
      value={value}
      onValueChange={next => {
        props.onValueChange?.(next);
        setValue(next);
      }}
    />
  );
}
async function dispatchFiles(
  element: HTMLElement,
  type: 'drop' | 'paste' | 'dragenter' | 'dragover' | 'dragleave',
  files: File[],
) {
  const data = new DataTransfer();
  files.forEach(file => data.items.add(file));
  await act(async () => {
    element.dispatchEvent(
      type === 'paste'
        ? new ClipboardEvent(type, {
            clipboardData: data,
            bubbles: true,
            cancelable: true,
          })
        : new DragEvent(type, {
            dataTransfer: data,
            bubbles: true,
            cancelable: true,
          }),
    );
  });
}

export const Default: Story = {
  name: 'Add receipt attachments',
  parameters: { docs: { description: { story: 'Browse for receipts or drop files onto the surface to build a selection.' }, source: { language: 'tsx', code: emptySource } } },
  play: async ({ canvasElement, userEvent, args }) => {
    const selected = file();
    await userEvent.upload(inputOf(canvasElement), selected);
    await expect(within(canvasElement).getByRole('list', { name: 'Files' })).toBeVisible();
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith([
      expect.objectContaining({ file: selected, name: 'receipt.pdf', size: 3 }),
    ]);
    await expect(inputOf(canvasElement).value).toBe('');
    await expect(args.onReject).not.toHaveBeenCalled();
  },
};

export const RequiredCommittedItems: Story = {
  tags: ['!autodocs'],
  args: { required: true, accept: '.pdf' },
  render: args => (
    <form aria-label="Receipts form">
      <FileDropzone {...args} />
      <Button type="reset">Reset</Button>
    </form>
  ),
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    const form = canvas.getByRole('form', { name: 'Receipts form' }) as HTMLFormElement;
    await expect(form.checkValidity()).toBe(false);
    await userEvent.upload(inputOf(canvasElement), file());
    await expect(inputOf(canvasElement).value).toBe('');
    await waitFor(() => expect(form.checkValidity()).toBe(true));
    await userEvent.click(canvas.getByRole('button', { name: 'Remove receipt.pdf' }));
    await expect(form.checkValidity()).toBe(false);
    await dispatchFiles(rootOf(canvasElement), 'drop', [file('bad.png', 'png', 'image/png')]);
    await expect(form.checkValidity()).toBe(false);
    await dispatchFiles(rootOf(canvasElement), 'drop', [file('dropped.pdf')]);
    await waitFor(() => expect(form.checkValidity()).toBe(true));
    await userEvent.click(canvas.getByRole('button', { name: 'Reset' }));
    await waitFor(() => expect(form.checkValidity()).toBe(false));
  },
};

function RequiredControlledDropzone(props: FileDropzoneProps) {
  const formId = useId();
  const [items, setItems] = useState<FileDropzoneItem[]>([]);
  const [disabled, setDisabled] = useState(false);
  return (
    <>
      <form id={formId} aria-label="Receipts form" />
      <FileDropzone {...props} required value={items} disabled={disabled} slotProps={{ input: { form: formId } }} />
      <Button onClick={() => setItems(existing)}>Commit</Button>
      <Button onClick={() => setItems([])}>Clear</Button>
      <Button onClick={() => setDisabled(true)}>Disable</Button>
    </>
  );
}

export const RequiredControlledCommit: Story = {
  tags: ['!autodocs'],
  render: args => <RequiredControlledDropzone {...args} />,
  play: async ({ args, canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    const form = canvas.getByRole('form', { name: 'Receipts form' }) as HTMLFormElement;
    await expect(form.reportValidity()).toBe(false);
    await expect(inputOf(canvasElement)).toHaveFocus();
    await userEvent.upload(inputOf(canvasElement), file());
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(form.checkValidity()).toBe(false);
    await userEvent.click(canvas.getByRole('button', { name: 'Commit' }));
    await expect(form.checkValidity()).toBe(true);
    await expect([...new FormData(form).keys()]).toEqual([]);
    await userEvent.click(canvas.getByRole('button', { name: 'Clear' }));
    await expect(form.checkValidity()).toBe(false);
    await userEvent.click(canvas.getByRole('button', { name: 'Disable' }));
    await expect(form.checkValidity()).toBe(true);
  },
};
export const Single: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `${messagesSource}

<FileDropzone label="Add receipts" messages={messages} multiple={false} accept=".pdf"
  defaultValue={[{ id: 'old', name: 'old.pdf', size: 3,
    file: new File(['pdf'], 'old.pdf', { type: 'application/pdf' }) }]} />` } } },
  args: {
    multiple: false,
    defaultValue: [{ id: 'old', name: 'old.pdf', size: 3, file: file('old.pdf') }],
    accept: '.pdf',
  },
  play: async ({ canvasElement, userEvent, args }) => {
    await dispatchFiles(rootOf(canvasElement), 'drop', [file('bad.png', 'a', 'image/png')]);
    await expect(within(canvasElement).getByText('old.pdf')).toBeVisible();
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await userEvent.upload(inputOf(canvasElement), file('new.pdf'));
    await expect(within(canvasElement).queryByText('old.pdf')).not.toBeInTheDocument();
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(within(canvasElement).getByText('new.pdf')).toBeVisible();
  },
};
export const Multiple: Story = {
  name: 'Select multiple files',
  parameters: { docs: { description: { story: 'Choose several receipts at once or add more files to the current selection.' }, source: { language: 'tsx', code: emptySource } } },
  play: async ({ canvasElement, userEvent, args }) => {
    await userEvent.upload(inputOf(canvasElement), [file('one.pdf'), file('two.pdf')]);
    await expect(within(canvasElement).getAllByRole('listitem')).toHaveLength(2);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
  },
};
export const AcceptedTypes: Story = {
  name: 'Accept images, PDFs and text',
  parameters: { docs: { description: { story: 'Choose an image, PDF or plain-text file; other types are rejected.' }, source: { language: 'tsx', code: `${messagesSource}

<FileDropzone label="Add receipts" description="Drop files or browse."
  note="PDF and image attachments" messages={messages} accept="IMAGE/*, .PDF, text/plain" />` } } },
  args: { accept: 'IMAGE/*, .PDF, text/plain' },
  play: async ({ canvasElement, userEvent, args }) => {
    const batch = [
      file('upper.PDF', '', ''),
      file('image.jpg', '', 'image/jpeg'),
      file('text.txt', '', 'text/plain'),
      file('unknown.jpg', '', ''),
      file('bad.exe', '', 'application/octet-stream'),
    ];
    await dispatchFiles(rootOf(canvasElement), 'drop', batch);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onReject).toHaveBeenCalledTimes(1);
    await expect(args.onReject).toHaveBeenLastCalledWith(
      batch.slice(3).map(file => ({
        file,
        code: 'type',
        message: messages.rejection('type', file),
      })),
    );
    await expect(within(canvasElement).getByRole('list', { name: 'Files' }).children).toHaveLength(3);
  },
};
export const SizeLimit: Story = {
  name: 'Reject oversized files',
  parameters: { docs: { description: { story: 'Try a file above the three-byte limit to see size rejection feedback.' }, source: { language: 'tsx', code: `${messagesSource}

<FileDropzone label="Add receipts" description="Drop files or browse."
  note="PDF and image attachments" messages={messages} maxSize={3} />` } } },
  args: { maxSize: 3 },
  play: async ({ canvasElement, userEvent, args }) => {
    const tooBig = file('large.pdf', 'four');
    await userEvent.upload(inputOf(canvasElement), [file('boundary.pdf'), file('empty.pdf', ''), tooBig]);
    await expect(args.onReject).toHaveBeenCalledTimes(1);
    await expect(args.onReject).toHaveBeenLastCalledWith([
      {
        file: tooBig,
        code: 'size',
        message: messages.rejection('size', tooBig),
      },
    ]);
    await expect(within(canvasElement).getByRole('list', { name: 'Files' }).children).toHaveLength(2);
  },
};
export const CountLimit: Story = {
  name: 'Limit the selection count',
  parameters: { docs: { description: { story: 'Add one file beside an existing receipt; additional files exceed the two-file limit.' }, source: { language: 'tsx', code: `${messagesSource}

<FileDropzone label="Add receipts" description="Drop files or browse."
  note="PDF and image attachments" messages={messages} maxFiles={2}
  defaultValue={[{ id: 'remote', name: 'invoice.pdf', size: 12500, uploaded: true }]} />` } } },
  args: { maxFiles: 2, defaultValue: existing },
  play: async ({ canvasElement, userEvent, args }) => {
    const overflow = file('third.pdf');
    await userEvent.upload(inputOf(canvasElement), [file('second.pdf'), overflow]);
    await expect(args.onReject).toHaveBeenCalledTimes(1);
    await expect(args.onReject).toHaveBeenLastCalledWith([
      {
        file: overflow,
        code: 'count',
        message: messages.rejection('count', overflow),
      },
    ]);
    await expect(within(canvasElement).getByRole('list', { name: 'Files' }).children).toHaveLength(2);
  },
};
export const CustomValidation: Story = {
  name: 'Reject files with an application rule',
  parameters: { docs: { description: { story: 'Choose a file whose name starts with private to see an application validation message.' }, source: { language: 'tsx', code: `${messagesSource}

<FileDropzone label="Add receipts" description="Drop files or browse."
  note="PDF and image attachments" messages={messages}
  validate={file => file.name.startsWith('private') ? 'Choose a public receipt.' : null} />` } } },
  args: {
    validate: file => (file.name.startsWith('private') ? 'Choose a public receipt.' : null),
  },
  play: async ({ canvasElement, userEvent, args }) => {
    const rejected = file('private.pdf');
    await userEvent.upload(inputOf(canvasElement), rejected);
    await expect(args.onReject).toHaveBeenCalledTimes(1);
    await expect(args.onReject).toHaveBeenLastCalledWith([
      { file: rejected, code: 'custom', message: 'Choose a public receipt.' },
    ]);
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};
export const Duplicates: Story = {
  parameters: { docs: { source: { language: 'tsx', code: emptySource } } },
  play: async ({ canvasElement, userEvent, args }) => {
    const same = file();
    await userEvent.upload(inputOf(canvasElement), [same, same]);
    await userEvent.upload(inputOf(canvasElement), same);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onReject).not.toHaveBeenCalled();
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Remove receipt.pdf' }));
    await userEvent.upload(inputOf(canvasElement), same);
    await expect(args.onValueChange).toHaveBeenCalledTimes(3);
  },
};
export const DropAndPaste: Story = {
  name: 'Drop or paste attachments',
  play: async ({ canvasElement, userEvent, args }) => {
    const root = rootOf(canvasElement);
    await dispatchFiles(root, 'dragenter', [file()]);
    await expect(root).toHaveAttribute('data-state', 'dragging');
    await dispatchFiles(root, 'dragover', [file()]);
    await dispatchFiles(root, 'drop', [file()]);
    await expect(root).toHaveAttribute('data-state', 'selected');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await dispatchFiles(root, 'paste', [file('ignored.pdf')]);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Remove receipt.pdf' }));
    await expect(root.ownerDocument.activeElement).toBe(inputOf(canvasElement));
    await dispatchFiles(root, 'paste', [file('pasted.pdf')]);
    await expect(args.onValueChange).toHaveBeenCalledTimes(3);
    await expect(within(canvasElement).getByText('pasted.pdf')).toBeVisible();
  },
  parameters: {
    docs: {
      source: { language: 'tsx', code: emptySource },
      description: {
        story:
          'Drop files onto the surface or focus the file input and paste copied files.',
      },
    },
  },
};
export const DragAnnouncement: Story = {
  name: 'Announce the drop target',
  parameters: { docs: { description: { story: 'Drag a file over the surface to hear and see the drop instruction.' }, source: { language: 'tsx', code: `${messagesSource}

<FileDropzone label="Add receipts" description="Drop files or browse."
  note="PDF and image attachments" messages={messages} dropLabel="Drop receipts here" />` } } },
  args: { dropLabel: 'Drop receipts here' },
  play: async ({ canvasElement, args }) => {
    const root = rootOf(canvasElement);
    const status = within(canvasElement).getByRole('status');
    const child = within(canvasElement).getByText('Browse files');
    await dispatchFiles(root, 'dragenter', [file()]);
    await expect(status).toHaveTextContent('Drop receipts here');
    await dispatchFiles(child, 'dragenter', [file()]);
    await dispatchFiles(child, 'dragleave', [file()]);
    await expect(root).toHaveAttribute('data-state', 'dragging');
    await expect(status).toHaveTextContent('Drop receipts here');
    await dispatchFiles(root, 'dragleave', [file()]);
    await expect(root).toHaveAttribute('data-state', 'empty');
    await expect(status).toBeEmptyDOMElement();
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};
export const SingleRemoteCapacity: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `${messagesSource}

<FileDropzone label="Add receipts" messages={messages} multiple={false} maxFiles={1}
  defaultValue={[{ id: 'remote', name: 'invoice.pdf', size: 12500, uploaded: true }]} />` } } },
  args: { multiple: false, maxFiles: 1, defaultValue: existing },
  play: async ({ canvasElement, userEvent, args }) => {
    const selected = file();
    await userEvent.upload(inputOf(canvasElement), selected);
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(args.onReject).toHaveBeenCalledTimes(1);
    await expect(args.onReject).toHaveBeenLastCalledWith([
      {
        file: selected,
        code: 'count',
        message: messages.rejection('count', selected),
      },
    ]);
    await expect(within(canvasElement).getByText('invoice.pdf')).toBeVisible();
  },
};

export const ExistingUploads: Story = {
  parameters: { docs: { source: { language: 'tsx', code: selectedSource } } },
  args: { defaultValue: existing, onUpload: fn(async () => {}) },
  play: async ({ args }) => {
    await expect(args.onUpload).not.toHaveBeenCalled();
  },
};
export const ListInside: Story = {
  name: 'Keep the selection inside the surface',
  parameters: { docs: { description: { story: 'Show an existing receipt and subsequent selections inside the drop surface.' }, source: { language: 'tsx', code: `${messagesSource}

<FileDropzone label="Add receipts" description="Drop files or browse."
  note="PDF and image attachments" messages={messages} listPlacement="inside"
  defaultValue={[{ id: 'remote', name: 'invoice.pdf', size: 12500, uploaded: true }]} />` } } },
  args: { defaultValue: existing, listPlacement: 'inside' },
};
export const ListBelow: Story = {
  args: { defaultValue: existing },
  parameters: { docs: { source: { language: 'tsx', code: selectedSource } } },
};
export const CompactThreshold: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `${messagesSource}

<FileDropzone label="Add receipts" messages={messages} compactAt={1}
  defaultValue={[{ id: 'remote', name: 'invoice.pdf', size: 12500, uploaded: true }]} />` } } },
  args: { defaultValue: existing, compactAt: 1 },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[data-compact]')).toHaveAttribute('data-compact', 'true');
  },
};
export const Sizes: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `${messagesSource}

<>
  <FileDropzone label="Add receipts" messages={messages} size="sm" />
  <FileDropzone label="Add receipts" messages={messages} size="md" />
  <FileDropzone label="Add receipts" messages={messages} size="lg" />
</>` } } },
  render: args => (
    <>
      {(['sm', 'md', 'lg'] as const).map(size => (
        <FileDropzone {...args} key={size} size={size} />
      ))}
    </>
  ),
};
export const ZeroByte: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `${messagesSource}

<FileDropzone label="Add receipts" messages={messages}
  defaultValue={[{ id: 'empty', name: 'empty.txt', size: 0 }]} />` } } },
  args: { defaultValue: [{ id: 'empty', name: 'empty.txt', size: 0 }] },
};
export const LongNames: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `${messagesSource}

<FileDropzone label="Add receipts" messages={messages} locale="de-DE"
  defaultValue={[{ id: 'long', size: 999999999999,
    name: 'receipt-from-the-international-conference-and-customer-meeting-in-october.pdf' }]} />` } } },
  args: {
    defaultValue: [
      {
        id: 'long',
        name: 'receipt-from-the-international-conference-and-customer-meeting-in-october.pdf',
        size: 999999999999,
      },
    ],
    locale: 'de-DE',
  },
};
export const Narrow: Story = {
  ...LongNames,
  parameters: { docs: { source: { language: 'tsx', code: `${messagesSource}

import { styled } from '@jfrader/ui';

const ReceiptLane = styled.div({ inlineSize: '18rem', maxInlineSize: '100%' });

<ReceiptLane>
  <FileDropzone label="Add receipts" messages={messages} locale="de-DE"
    defaultValue={[{ id: 'long', size: 999999999999,
      name: 'receipt-from-the-international-conference-and-customer-meeting-in-october.pdf' }]} />
</ReceiptLane>` } } },
  decorators: [
    Story => (
      <NarrowFrame>
        <Story />
      </NarrowFrame>
    ),
  ],
};
export const RTL: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `${messagesSource}

<FileDropzone label="Add receipts" messages={messages} dir="rtl"
  defaultValue={[{ id: 'remote', name: 'invoice.pdf', size: 12500, uploaded: true }]} />` } } },
  args: { dir: 'rtl', defaultValue: existing },
  play: async ({ canvasElement }) => {
    await expect(getComputedStyle(rootOf(canvasElement)).direction).toBe('rtl');
  },
};
export const PreviewBroken: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `${messagesSource}

<FileDropzone label="Add receipts" messages={messages} renderFileIcon={() => <span>▤</span>}
  defaultValue={[{ id: 'remote', name: 'invoice.pdf', size: 12500, uploaded: true,
    preview: 'data:image/png;base64,invalid' }]} />` } } },
  args: {
    defaultValue: [{ ...existing[0]!, preview: 'data:image/png;base64,invalid' }],
    renderFileIcon: () => <span>▤</span>,
  },
  play: async ({ canvasElement }) => {
    await waitFor(async () => {
      await expect(canvasElement.querySelector('img')).not.toBeInTheDocument();
    });
  },
};
export const LightTheme: Story = {
  parameters: { docs: { source: { language: 'tsx', code: selectedSource } } },
  args: { defaultValue: existing },
  decorators: [withLightTheme],
};

const neverUpload: FileDropzoneUpload = () => new Promise(() => {});
export const UploadIndeterminate: Story = {
  name: 'Upload without a measured total',
  parameters: { docs: { description: { story: 'Choose a file to show indeterminate progress while an upload is pending.' }, source: { language: 'tsx', code: uploadSource } } },
  args: { onUpload: fn(neverUpload) },
  play: async ({ canvasElement, userEvent, args }) => {
    await userEvent.upload(inputOf(canvasElement), file());
    const progress = await within(canvasElement).findByRole('progressbar', {
      name: 'receipt.pdf',
    });
    await expect(progress).not.toHaveAttribute('aria-valuenow');
    await expect(args.onUpload).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
  },
};
export const UploadProgress: Story = {
  name: 'Report upload progress',
  parameters: { docs: { description: { story: 'Choose a file to see measured progress; the upload handler reports percentages through onProgress.' }, source: { language: 'tsx', code: progressSource } } },
  args: {
    onUpload: fn(async (_item, { onProgress }) => {
      onProgress(45);
      onProgress(20);
      onProgress(NaN);
      return neverUpload(_item, {
        onProgress,
        signal: new AbortController().signal,
      });
    }),
  },
  play: async ({ canvasElement, userEvent, args }) => {
    await userEvent.upload(inputOf(canvasElement), file());
    await waitFor(async () => {
      await expect(within(canvasElement).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '45');
    });
    await expect(args.onUpload).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
  },
};
export const UploadSuccess: Story = {
  parameters: { docs: { source: { language: 'tsx', code: uploadSource } } },
  args: {
    onUpload: fn(async (_item, { onProgress }) => {
      onProgress(200);
    }),
  },
  play: async ({ canvasElement, userEvent, args }) => {
    await userEvent.upload(inputOf(canvasElement), file());
    await waitFor(async () => {
      await expect(canvasElement.querySelector('[data-file-row]')).toHaveAttribute('data-state', 'uploaded');
    });
    await expect(args.onUpload).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
  },
};
export const UploadFailed: Story = {
  parameters: { docs: { source: { language: 'tsx', code: uploadSource } } },
  args: {
    onUpload: fn(async () => {
      throw new Error('<server> rejected the upload');
    }),
  },
  play: async ({ canvasElement, userEvent }) => {
    await userEvent.upload(inputOf(canvasElement), file());
    await expect(
      await within(canvasElement).findByRole('button', {
        name: 'Retry receipt.pdf',
      }),
    ).toBeVisible();
    await expect(within(canvasElement).getByText('<server> rejected the upload')).toBeVisible();
    for (const action of within(canvasElement).getAllByRole('button')) {
      await expect(action.getBoundingClientRect().height).toBeGreaterThanOrEqual(
        MIN_ACTION_HEIGHT - PX_TOLERANCE,
      );
    }
    await expect(canvasElement.querySelector('server')).not.toBeInTheDocument();
  },
};
const retriedFiles = new WeakSet<File>();
function RetryAction(props: ButtonProps) {
  return <Button {...props} data-slot="upload-retry" />;
}
export const UploadRetry: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `${messagesSource}

import { Button, type ButtonProps, type FileDropzoneUpload } from '@jfrader/ui';

function RetryAction(props: ButtonProps) {
  return <Button {...props} />;
}

export function ReceiptUpload({ upload }: { upload: FileDropzoneUpload }) {
  return <FileDropzone label="Add receipts" messages={messages} onUpload={upload}
    slots={{ retry: RetryAction }} slotProps={{ retry: { className: 'custom-retry' } }} />;
}` } } },
  args: {
    slots: { retry: RetryAction },
    slotProps: { retry: { ref: fn(), className: 'custom-retry' } },
    onUpload: fn(async (item, { onProgress }) => {
      if (item.file && !retriedFiles.has(item.file)) {
        retriedFiles.add(item.file);
        throw new Error('Try again');
      }
      onProgress(10);
      return new Promise<void>(() => {});
    }),
  },
  play: async ({ canvasElement, userEvent, args }) => {
    await userEvent.upload(inputOf(canvasElement), file());
    const retry = await within(canvasElement).findByRole('button', {
      name: 'Retry receipt.pdf',
    });
    await expect(retry).toHaveAttribute('data-slot', 'upload-retry');
    await expect(retry).toHaveClass('custom-retry');
    await expect(args.slotProps?.retry?.ref).toHaveBeenCalledWith(retry);
    await expect(within(canvasElement).getByRole('button', { name: 'Remove receipt.pdf' })).not.toHaveAttribute('data-slot', 'upload-retry');
    retry.focus();
    await userEvent.keyboard('{Enter}');
    await waitFor(async () => {
      await expect(within(canvasElement).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '10');
    });
    await expect(args.onUpload).toHaveBeenCalledTimes(2);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(retry.ownerDocument.activeElement).toBe(
      within(canvasElement).getByRole('button', { name: 'Remove receipt.pdf' }),
    );
  },
};
export const UploadAbort: Story = {
  parameters: { docs: { source: { language: 'tsx', code: uploadSource } } },
  args: { onUpload: fn(neverUpload) },
  play: async ({ canvasElement, userEvent, args }) => {
    await userEvent.upload(inputOf(canvasElement), file());
    await within(canvasElement).findByRole('progressbar');
    const context = (args.onUpload as ReturnType<typeof fn>).mock
      .calls[0]![1] as Parameters<FileDropzoneUpload>[1];
    const aborted = fn();
    context.signal.addEventListener('abort', aborted);
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Remove receipt.pdf' }));
    await expect(context.signal.aborted).toBe(true);
    await expect(aborted).toHaveBeenCalledTimes(1);
    await act(async () => {
      context.onProgress(90);
    });
    await expect(within(canvasElement).queryByRole('progressbar')).not.toBeInTheDocument();
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
  },
};
export const Controlled: Story = {
  name: 'Keep selected files in application state',
  parameters: { docs: { description: { story: 'Store the selected items in React state as files are added and removed.' }, source: { language: 'tsx', code: `${messagesSource}

import { useState } from 'react';
import type { FileDropzoneItem } from '@jfrader/ui';

export function Receipts() {
  const [items, setItems] = useState<FileDropzoneItem[]>([]);
  return <FileDropzone label="Add receipts" description="Drop files or browse."
    note="PDF and image attachments" messages={messages}
    value={items} onValueChange={setItems} />;
}` } } },
  render: args => <ControlledExample {...args} />,
  play: Default.play,
};
export const ControlledRejects: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `${messagesSource}

<FileDropzone label="Add receipts" messages={messages} value={[]} />` } } },
  args: { value: [], onUpload: fn(neverUpload) },
  play: async ({ canvasElement, userEvent, args }) => {
    await userEvent.upload(inputOf(canvasElement), file('image.png', 'image', 'image/png'));
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onUpload).not.toHaveBeenCalled();
    await expect(within(canvasElement).queryByRole('list')).not.toBeInTheDocument();
    await expect(canvasElement.querySelector('img')).not.toBeInTheDocument();
  },
};
export const ControlledRemoveRejects: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `${messagesSource}

<FileDropzone label="Add receipts" messages={messages}
  value={[{ id: 'remote', name: 'invoice.pdf', size: 12500, uploaded: true }]} />` } } },
  args: { value: existing },
  play: async ({ canvasElement, userEvent, args }) => {
    const remove = within(canvasElement).getByRole('button', {
      name: 'Remove invoice.pdf',
    });
    remove.focus();
    await userEvent.keyboard('{Delete}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith([]);
    await expect(remove.ownerDocument.activeElement).toBe(remove);
    await expect(remove).toBeVisible();
  },
};
export const Disabled: Story = {
  name: 'Disabled selection',
  parameters: { docs: { description: { story: 'Show an existing receipt while preventing file selection and removal.' }, source: { language: 'tsx', code: `${messagesSource}

<FileDropzone label="Add receipts" description="Drop files or browse."
  note="PDF and image attachments" messages={messages} disabled
  defaultValue={[{ id: 'remote', name: 'invoice.pdf', size: 12500, uploaded: true }]} />` } } },
  args: { disabled: true, defaultValue: existing },
  play: async ({ canvasElement, args }) => {
    await expect(inputOf(canvasElement)).toBeDisabled();
    await dispatchFiles(rootOf(canvasElement), 'drop', [file()]);
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};
export const ReadOnly: Story = {
  name: 'Read-only attachments',
  parameters: { docs: { description: { story: 'Keep attached receipts available for inspection without accepting selection changes.' }, source: { language: 'tsx', code: `${messagesSource}

<FileDropzone label="Add receipts" description="Drop files or browse."
  note="PDF and image attachments" messages={messages} readOnly
  defaultValue={[{ id: 'remote', name: 'invoice.pdf', size: 12500, uploaded: true }]} />` } } },
  args: { readOnly: true, defaultValue: existing },
  play: async ({ canvasElement, userEvent, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Remove invoice.pdf' }));
    await userEvent.upload(inputOf(canvasElement), file());
    await dispatchFiles(rootOf(canvasElement), 'drop', [file()]);
    await dispatchFiles(rootOf(canvasElement), 'paste', [file()]);
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};
export const Required: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `${messagesSource}

<FileDropzone label="Add receipts" messages={messages} required />` } } },
  args: { required: true },
  play: async ({ canvasElement }) => {
    await expect(inputOf(canvasElement)).toBeRequired();
  },
};
export const FormReset: Story = {
  name: 'Reset an attachment form',
  parameters: { docs: { description: { story: 'Add files, then reset the form to its original receipt selection.' }, source: { language: 'tsx', code: `${messagesSource}

import { Button } from '@jfrader/ui';

<form>
  <FileDropzone label="Add receipts" description="Drop files or browse."
    note="PDF and image attachments" messages={messages}
    defaultValue={[{ id: 'remote', name: 'invoice.pdf', size: 12500, uploaded: true }]} />
  <Button type="reset">Reset</Button>
</form>` } } },
  args: { defaultValue: existing },
  render: args => (
    <form>
      <FileDropzone {...args} />
      <Button type="reset">Reset</Button>
    </form>
  ),
  play: async ({ canvasElement, userEvent, args }) => {
    await userEvent.upload(inputOf(canvasElement), file());
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Reset' }));
    await expect(within(canvasElement).getByRole('list', { name: 'Files' }).children).toHaveLength(1);
    await expect(within(canvasElement).getByText('invoice.pdf')).toBeVisible();
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
  },
};
export const PersistentSelected: Story = {
  args: { defaultValue: existing },
  parameters: { docs: { source: { language: 'tsx', code: selectedSource } } },
};
export const PersistentUploading: Story = { ...UploadProgress, name: 'Persistent Uploading' };
export const PersistentFailed: Story = { ...UploadFailed };
export const PersistentRejections: Story = { ...SizeLimit, name: 'Persistent Rejections' };
export const Keyboard: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `${messagesSource}

<FileDropzone label="Add receipts" messages={messages}
  defaultValue={[
    { id: 'remote', name: 'invoice.pdf', size: 12500, uploaded: true },
    { id: 'two', name: 'two.pdf', size: 0 },
  ]} />` } } },
  args: {
    defaultValue: [...existing, { id: 'two', name: 'two.pdf', size: 0 }],
    sx: testMotion,
    slotProps: { input: { onClick: fn() } },
  },
  play: async ({ canvasElement, userEvent, args }) => {
    const canvas = within(canvasElement);
    const input = inputOf(canvasElement);
    await userEvent.tab();
    await expect(input.ownerDocument.activeElement).toBe(input);
    await expect(getComputedStyle(targetOf(canvasElement)).outlineStyle).not.toBe('none');
    await userEvent.keyboard('{Enter} ');
    await expect(args.slotProps?.input?.onClick).toHaveBeenCalledTimes(2);
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await userEvent.tab();
    const first = canvas.getByRole('button', { name: 'Remove invoice.pdf' });
    const second = canvas.getByRole('button', { name: 'Remove two.pdf' });
    await expect(first.ownerDocument.activeElement).toBe(first);
    await expect(getComputedStyle(targetOf(canvasElement)).outlineStyle).toBe('none');
    for (const action of [first, second]) {
      await expect(action.getBoundingClientRect().height).toBeGreaterThanOrEqual(
        MIN_ACTION_HEIGHT - PX_TOLERANCE,
      );
    }
    await userEvent.keyboard('{ArrowUp}');
    await expect(first.ownerDocument.activeElement).toBe(first);
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    await expect(second.ownerDocument.activeElement).toBe(second);
    await userEvent.keyboard('{ArrowUp}');
    await expect(first.ownerDocument.activeElement).toBe(first);
    await userEvent.tab({ shift: true });
    await expect(input.ownerDocument.activeElement).toBe(input);
    await userEvent.tab();
    await userEvent.keyboard('{Delete}');
    await expect(second.ownerDocument.activeElement).toBe(second);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await userEvent.keyboard('{Backspace}');
    await expect(input.ownerDocument.activeElement).toBe(input);
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await expect(args.slotProps?.input?.onClick).toHaveBeenCalledTimes(2);
  },
};
export const SurfaceOpensPicker: Story = {
  args: {
    defaultValue: existing,
    listPlacement: 'inside',
    slotProps: { input: { onClick: fn() } },
  },
  play: async ({ canvasElement, userEvent, args }) => {
    const canvas = within(canvasElement);
    const input = inputOf(canvasElement);
    const surface = input.closest('label')!;
    await expect(surface).toHaveAttribute('for', input.id);
    await expect(input).not.toHaveAttribute('tabindex');
    await expect(canvas.queryByRole('button', { name: 'Browse files' })).not.toBeInTheDocument();
    await userEvent.click(canvas.getByText('Drop files or browse.'));
    await expect(args.slotProps?.input?.onClick).toHaveBeenCalledTimes(1);
    await userEvent.click(canvas.getByText('Browse files'));
    await expect(args.slotProps?.input?.onClick).toHaveBeenCalledTimes(2);
    await userEvent.click(canvas.getByText('invoice.pdf'));
    await expect(args.slotProps?.input?.onClick).toHaveBeenCalledTimes(2);
    const list = canvas.getByRole('list', { name: 'Files' });
    const below = list.getBoundingClientRect();
    const lastRow = list.lastElementChild!.getBoundingClientRect();
    const blank = input.ownerDocument.elementFromPoint(
      below.left + below.width / 2,
      (lastRow.bottom + below.bottom) / 2,
    ) as HTMLElement;
    await expect(blank).toBe(list);
    await expect(input.closest('label')!.contains(blank)).toBe(false);
    await userEvent.click(blank);
    await expect(args.slotProps?.input?.onClick).toHaveBeenCalledTimes(3);
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await userEvent.click(canvas.getByRole('button', { name: 'Remove invoice.pdf' }));
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.slotProps?.input?.onClick).toHaveBeenCalledTimes(3);
  },
  parameters: {
    docs: {
      source: { language: 'tsx', code: `${messagesSource}

<FileDropzone label="Add receipts" messages={messages} listPlacement="inside"
  defaultValue={[{ id: 'remote', name: 'invoice.pdf', size: 12500, uploaded: true }]} />` },
      description: {
        story:
          'Click the surface or blank area around the list to open the picker once. File rows and their actions do not open it. Test the OS picker separately.',
      },
    },
  },
};
export const ExternalAria: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `${messagesSource}

<>
  <span id="receipt-name">External</span>
  <span id="receipt-description">External description</span>
  <FileDropzone label="Add receipts" messages={messages} error="Fix the receipt"
    slotProps={{ input: {
      'aria-label': 'Receipt input', 'aria-labelledby': 'receipt-name',
      'aria-describedby': 'receipt-description', 'aria-invalid': 'grammar',
    } }} />
</>` } } },
  args: {
    error: 'Fix the receipt',
    slotProps: {
      input: {
        'aria-label': 'Receipt input',
        'aria-labelledby': 'external-name unresolved',
        'aria-describedby': 'external-description unresolved-description',
        'aria-invalid': 'grammar',
      },
    },
  },
  render: args => (
    <>
      <span id="external-name">External</span>
      <span id="external-description">External description</span>
      <FileDropzone {...args} />
    </>
  ),
  play: async ({ canvasElement }) => {
    const input = inputOf(canvasElement);
    await expect(input).toHaveAttribute('aria-label', 'Receipt input');
    await expect(input.getAttribute('aria-labelledby')).toContain('external-name unresolved');
    await expect(input.getAttribute('aria-labelledby')).toContain('-label');
    await expect(input.getAttribute('aria-describedby')).toContain(
      'external-description unresolved-description',
    );
    await expect(input.getAttribute('aria-describedby')).toContain('-description');
    await expect(input).toHaveAttribute('aria-invalid', 'true');
  },
};
export const FalsyLabels: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `${messagesSource}

<>
  {[false, null, 0, ''].map((label, index) => (
    <FileDropzone key={index} messages={messages} label={label} description={label}
      note={label} error={label} dropLabel={label} renderFileIcon={() => label}
      defaultValue={[{ id: 'remote', name: 'invoice.pdf', size: 12500, uploaded: true }]} />
  ))}
</>` } } },
  render: args => (
    <>
      {[false, null, 0, ''].map((node, index) => (
        <FileDropzone
          {...args}
          key={index}
          label={node}
          description={node}
          note={node}
          error={node}
          dropLabel={node}
          renderFileIcon={() => node}
          defaultValue={existing}
        />
      ))}
    </>
  ),
  play: async ({ canvasElement }) => {
    const inputs = Array.from(canvasElement.querySelectorAll('input'));
    const [falseInput, nullInput, zeroInput, emptyInput] = inputs;
    for (const input of [falseInput!, nullInput!]) {
      await expect(input).not.toHaveAttribute('aria-labelledby');
      await expect(input).not.toHaveAttribute('aria-describedby');
      await expect(input).toHaveAccessibleName('Browse files');
    }
    await expect(zeroInput!.getAttribute('aria-labelledby')).toContain('-label');
    await expect(zeroInput).toHaveAccessibleName('0');
    await expect(emptyInput).not.toHaveAttribute('aria-labelledby');
    await expect(emptyInput).toHaveAccessibleName('Browse files');
    for (const input of [zeroInput!, emptyInput!]) {
      await expect(input.getAttribute('aria-describedby')).toContain('-description');
    }
    await expect(new Set(inputs.map(input => input.id)).size).toBe(4);
  },
};
export const ForcedColors: Story = {
  args: { defaultValue: existing },
  parameters: {
    docs: {
      source: { language: 'tsx', code: selectedSource },
      description: {
        story:
          'Structural fixture for manual forced-colors QA; the test runner does not emulate this media setting.',
      },
    },
  },
};
export const ReducedMotion: Story = {
  ...UploadIndeterminate,
  name: 'Reduced Motion',
  parameters: {
    docs: {
      source: { language: 'tsx', code: uploadSource },
      description: {
        story: 'Structural upload fixture for manual reduced-motion QA; no media emulation is claimed.',
      },
    },
  },
};

export const SingleBatch: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `${messagesSource}

<FileDropzone label="Add receipts" messages={messages} multiple={false} />` } } },
  args: { multiple: false },
  play: async ({ canvasElement, args }) => {
    const first = file('first.pdf');
    const second = file('second.pdf');
    await dispatchFiles(rootOf(canvasElement), 'drop', [first, second]);
    await expect(args.onReject).toHaveBeenCalledTimes(1);
    await expect(args.onReject).toHaveBeenLastCalledWith([
      {
        file: second,
        code: 'count',
        message: messages.rejection('count', second),
      },
    ]);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith([expect.objectContaining({ file: first })]);
  },
};
export const LocalizedRejections: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `${messagesSource}

<FileDropzone label="Add receipts" locale="es" maxSize={0}
  messages={{ ...messages, browse: 'Elegir archivos',
    rejection: () => 'El archivo supera el tamaño permitido.' }} />` } } },
  args: {
    maxSize: 0,
    locale: 'es',
    messages: {
      ...messages,
      browse: 'Elegir archivos',
      rejection: () => 'El archivo supera el tamaño permitido.',
    },
  },
  play: async ({ canvasElement, userEvent, args }) => {
    const selected = file();
    await userEvent.upload(inputOf(canvasElement), selected);
    await expect(args.onReject).toHaveBeenCalledTimes(1);
    await expect(args.onReject).toHaveBeenLastCalledWith([
      {
        file: selected,
        code: 'size',
        message: 'El archivo supera el tamaño permitido.',
      },
    ]);
    await expect(within(canvasElement).getByRole('alert')).toHaveTextContent(
      'El archivo supera el tamaño permitido.',
    );
  },
};
export const MixedRejectionOrder: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `${messagesSource}

<FileDropzone label="Add receipts" messages={messages} accept=".pdf" maxSize={3} maxFiles={1}
  validate={file => file.name === 'private.pdf' ? 'Private receipt' : null} />` } } },
  args: {
    accept: '.pdf',
    maxSize: 3,
    maxFiles: 1,
    validate: selected => (selected.name === 'private.pdf' ? 'Private receipt' : null),
  },
  play: async ({ canvasElement, args }) => {
    const batch = [
      file('bad.exe'),
      file('large.pdf', 'four'),
      file('private.pdf'),
      file('accepted.pdf'),
      file('excess.pdf'),
    ];
    await dispatchFiles(rootOf(canvasElement), 'drop', batch);
    await expect(args.onReject).toHaveBeenCalledTimes(1);
    await expect(args.onReject).toHaveBeenLastCalledWith([
      {
        file: batch[0],
        code: 'type',
        message: messages.rejection('type', batch[0]!),
      },
      {
        file: batch[1],
        code: 'size',
        message: messages.rejection('size', batch[1]!),
      },
      { file: batch[2], code: 'custom', message: 'Private receipt' },
      {
        file: batch[4],
        code: 'count',
        message: messages.rejection('count', batch[4]!),
      },
    ]);
    await expect(args.onValueChange).toHaveBeenLastCalledWith([expect.objectContaining({ file: batch[3] })]);
  },
};
function RejectRemoval(props: FileDropzoneProps) {
  const [value, setValue] = useState<FileDropzoneItem[]>([]);
  return (
    <>
      <FileDropzone
        {...props}
        value={value}
        onValueChange={next => {
          props.onValueChange?.(next);
          if (next.length > value.length) setValue(next);
        }}
      />
      <Button onClick={() => setValue([])}>Clear externally</Button>
    </>
  );
}
export const ControlledUploadRemoval: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `${messagesSource}

import { useState } from 'react';
import { Button, type FileDropzoneItem, type FileDropzoneUpload } from '@jfrader/ui';

export function Receipts({ upload }: { upload: FileDropzoneUpload }) {
  const [items, setItems] = useState<FileDropzoneItem[]>([]);
  return <>
    <FileDropzone label="Add receipts" messages={messages} value={items} onUpload={upload}
      onValueChange={next => { if (next.length > items.length) setItems(next); }} />
    <Button onClick={() => setItems([])}>Clear externally</Button>
  </>;
}` } } },
  args: { onUpload: fn(neverUpload) },
  render: args => <RejectRemoval {...args} />,
  play: async ({ canvasElement, userEvent, args }) => {
    await userEvent.upload(inputOf(canvasElement), file());
    await within(canvasElement).findByRole('progressbar');
    const context = (args.onUpload as ReturnType<typeof fn>).mock
      .calls[0]![1] as Parameters<FileDropzoneUpload>[1];
    const remove = within(canvasElement).getByRole('button', {
      name: 'Remove receipt.pdf',
    });
    remove.focus();
    await userEvent.keyboard('{Delete}');
    await expect(context.signal.aborted).toBe(false);
    await expect(remove.ownerDocument.activeElement).toBe(remove);
    await act(async () => context.onProgress(60));
    await expect(within(canvasElement).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '60');
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Clear externally' }));
    await expect(context.signal.aborted).toBe(true);
    await expect(within(canvasElement).queryByRole('list')).not.toBeInTheDocument();
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await expect(args.onUpload).toHaveBeenCalledTimes(1);
  },
};
export const PreviewOwnership: Story = {
  parameters: { docs: { source: { language: 'tsx', code: emptySource } } },
  play: async ({ canvasElement, userEvent }) => {
    const create = spyOn(URL, 'createObjectURL');
    const revoke = spyOn(URL, 'revokeObjectURL');
    try {
      const image = file('preview.png', 'not-an-image', 'image/png');
      await userEvent.upload(inputOf(canvasElement), image);
      await expect(create).toHaveBeenCalledTimes(1);
      await expect(create).toHaveBeenLastCalledWith(image);
      const url = create.mock.results[0]!.value;
      await userEvent.click(
        within(canvasElement).getByRole('button', {
          name: 'Remove preview.png',
        }),
      );
      await expect(revoke).toHaveBeenCalledTimes(1);
      await expect(revoke).toHaveBeenLastCalledWith(url);
    } finally {
      create.mockRestore();
      revoke.mockRestore();
    }
  },
};
export const RejectedPreviewOwnership: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `${messagesSource}

<FileDropzone label="Add receipts" messages={messages} value={[]} />` } } },
  args: { value: [], onUpload: fn(neverUpload) },
  play: async ({ canvasElement, userEvent, args }) => {
    const create = spyOn(URL, 'createObjectURL');
    try {
      await userEvent.upload(inputOf(canvasElement), file('preview.png', 'image', 'image/png'));
      await expect(create).not.toHaveBeenCalled();
      await expect(args.onUpload).not.toHaveBeenCalled();
    } finally {
      create.mockRestore();
    }
  },
};
export const SuppliedPreviewOwnership: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `${messagesSource}

<FileDropzone label="Add receipts" messages={messages}
  defaultValue={[{ id: 'supplied', name: 'supplied.png', size: 1,
    preview: 'data:image/png;base64,invalid' }]} />` } } },
  args: {
    defaultValue: [
      {
        id: 'supplied',
        name: 'supplied.png',
        size: 1,
        preview: 'data:image/png;base64,invalid',
      },
    ],
  },
  play: async ({ canvasElement, userEvent }) => {
    const revoke = spyOn(URL, 'revokeObjectURL');
    try {
      await userEvent.click(
        within(canvasElement).getByRole('button', {
          name: 'Remove supplied.png',
        }),
      );
      await expect(revoke).not.toHaveBeenCalled();
    } finally {
      revoke.mockRestore();
    }
  },
};
export const ProgressBounds: Story = {
  parameters: { docs: { source: { language: 'tsx', code: uploadSource } } },
  args: { onUpload: fn(neverUpload) },
  play: async ({ canvasElement, userEvent, args }) => {
    await userEvent.upload(inputOf(canvasElement), file());
    await within(canvasElement).findByRole('progressbar');
    const context = (args.onUpload as ReturnType<typeof fn>).mock
      .calls[0]![1] as Parameters<FileDropzoneUpload>[1];
    await act(async () => context.onProgress(-10));
    await expect(within(canvasElement).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
    await act(async () => {
      context.onProgress(120);
      context.onProgress(40);
      context.onProgress(Infinity);
    });
    await expect(within(canvasElement).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
    await expect(within(canvasElement).getByRole('progressbar')).toHaveAttribute('aria-valuetext', '100%');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
  },
};
export const FailureFallback: Story = {
  parameters: { docs: { source: { language: 'tsx', code: uploadSource } } },
  args: {
    onUpload: fn(async () => {
      throw new Error('');
    }),
  },
  play: async ({ canvasElement, userEvent }) => {
    await userEvent.upload(inputOf(canvasElement), file());
    await within(canvasElement).findByRole('button', {
      name: 'Retry receipt.pdf',
    });
    await expect(within(canvasElement).getByText(messages.uploadError)).toBeVisible();
  },
};
// This story tests refs and styles forwarded through the slot API.
export const RefAndSlots: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `${messagesSource}

import { styled, theme } from '@jfrader/ui';

const ReceiptPicker = styled(FileDropzone)({ padding: theme.space[4] });

<ReceiptPicker label="Add receipts" messages={messages}
  slotProps={{
    target: { sx: { borderRadius: 0 } },
    label: { sx: { fontWeight: 700 } },
    action: { sx: { borderRadius: 0 } },
    browse: { sx: { borderStyle: 'dotted' } },
  }} />` } } },
  args: {
    ref: fn(),
    inputRef: fn(),
    sx: { padding: vars.space[4] },
    slotProps: {
      target: { sx: { borderRadius: 0 } },
      label: { sx: { fontWeight: 700 } },
      action: { sx: { borderRadius: 0 } },
      browse: { sx: { borderStyle: 'dotted' } },
    },
  },
  play: async ({ canvasElement, args }) => {
    await expect(args.ref).toHaveBeenCalledWith(rootOf(canvasElement));
    await expect(args.inputRef).toHaveBeenCalledWith(inputOf(canvasElement));
    await expect(getComputedStyle(canvasElement.querySelector('[data-dragging]')!).borderRadius).toBe('0px');
    const browse = within(canvasElement).getByText('Browse files');
    await expect(getComputedStyle(browse).borderStyle).toBe('dotted');
    await expect(getComputedStyle(browse).borderRadius).not.toBe('0px');
    await expect(getComputedStyle(inputOf(canvasElement).closest('label')!).fontWeight).toBe('700');
    await expect(getComputedStyle(rootOf(canvasElement)).paddingInlineStart).toBe('16px');
  },
};
export const ExplicitInvalid: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `${messagesSource}

<FileDropzone label="Add receipts" messages={messages} error={false}
  slotProps={{ input: { 'aria-invalid': 'grammar' } }} />` } } },
  args: { error: false, slotProps: { input: { 'aria-invalid': 'grammar' } } },
  play: async ({ canvasElement }) => {
    await expect(inputOf(canvasElement)).toHaveAttribute('aria-invalid', 'grammar');
  },
};
export const ControlledFormReset: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `${messagesSource}

import { Button } from '@jfrader/ui';

<form>
  <FileDropzone label="Add receipts" messages={messages} defaultValue={[]}
    value={[{ id: 'remote', name: 'invoice.pdf', size: 12500, uploaded: true }]} />
  <Button type="reset">Reset</Button>
</form>` } } },
  args: { value: existing, defaultValue: [] },
  render: args => (
    <form>
      <FileDropzone {...args} />
      <Button type="reset">Reset</Button>
    </form>
  ),
  play: async ({ canvasElement, userEvent, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Reset' }));
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith([]);
    await expect(within(canvasElement).getByText('invoice.pdf')).toBeVisible();
  },
};

interface DeferredUpload {
  resolve: () => void;
  reject: (reason: unknown) => void;
  context: Parameters<FileDropzoneUpload>[1];
}
const deferredUploads = new WeakMap<File, DeferredUpload[]>();
const deferredUpload: FileDropzoneUpload = (item, context) =>
  new Promise<void>((resolve, reject) => {
    if (!item.file) return resolve();
    const attempts = deferredUploads.get(item.file) ?? [];
    attempts.push({ resolve, reject, context });
    deferredUploads.set(item.file, attempts);
  });
export const LateAttemptEvents: Story = {
  parameters: { docs: { source: { language: 'tsx', code: uploadSource } } },
  args: { onUpload: fn(deferredUpload) },
  play: async ({ canvasElement, userEvent, args }) => {
    const selected = file();
    await userEvent.upload(inputOf(canvasElement), selected);
    await within(canvasElement).findByRole('progressbar');
    const first = deferredUploads.get(selected)![0]!;
    await act(async () => {
      first.context.onProgress(75);
      first.reject(new Error('Retry this upload'));
    });
    const retry = await within(canvasElement).findByRole('button', { name: 'Retry receipt.pdf' });
    retry.focus();
    await userEvent.keyboard(' ');
    const second = deferredUploads.get(selected)![1]!;
    await act(async () => {
      second.context.onProgress(15);
      first.context.onProgress(99);
      first.resolve();
    });
    await expect(within(canvasElement).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '15');
    await expect(first.context.signal.aborted).toBe(true);
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Remove receipt.pdf' }));
    await act(async () => {
      second.context.onProgress(90);
      second.resolve();
    });
    await expect(within(canvasElement).queryByRole('list')).not.toBeInTheDocument();
    await expect(args.onUpload).toHaveBeenCalledTimes(2);
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
  },
};
export const AbortErrorIsQuiet: Story = {
  parameters: { docs: { source: { language: 'tsx', code: uploadSource } } },
  args: {
    onUpload: fn(async () => {
      throw new DOMException('Canceled', 'AbortError');
    }),
  },
  play: async ({ canvasElement, userEvent }) => {
    await userEvent.upload(inputOf(canvasElement), file());
    await waitFor(async () => {
      await expect(canvasElement.querySelector('[data-file-row]')).toHaveAttribute('data-state', 'idle');
    });
    await expect(
      within(canvasElement).queryByRole('button', { name: 'Retry receipt.pdf' }),
    ).not.toBeInTheDocument();
    await expect(within(canvasElement).queryByText('Canceled')).not.toBeInTheDocument();
  },
};
function UnmountFixture(props: FileDropzoneProps) {
  const [mounted, setMounted] = useState(true);
  return (
    <>
      {mounted && <FileDropzone {...props} />}
      <Button onClick={() => setMounted(false)}>Unmount</Button>
    </>
  );
}
export const UnmountCleanup: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `${messagesSource}

import { useState } from 'react';
import { Button, type FileDropzoneUpload } from '@jfrader/ui';

export function ReceiptUpload({ upload }: { upload: FileDropzoneUpload }) {
  const [mounted, setMounted] = useState(true);
  return <>
    {mounted && <FileDropzone label="Add receipts" messages={messages} onUpload={upload} />}
    <Button onClick={() => setMounted(false)}>Unmount</Button>
  </>;
}` } } },
  args: { onUpload: fn(deferredUpload) },
  render: args => <UnmountFixture {...args} />,
  play: async ({ canvasElement, userEvent, args }) => {
    const create = spyOn(URL, 'createObjectURL');
    const revoke = spyOn(URL, 'revokeObjectURL');
    try {
      const image = file('preview.png', 'image', 'image/png');
      await userEvent.upload(inputOf(canvasElement), image);
      await within(canvasElement).findByRole('progressbar');
      const attempt = deferredUploads.get(image)![0]!;
      const aborted = fn();
      attempt.context.signal.addEventListener('abort', aborted);
      await expect(create).toHaveBeenCalledTimes(1);
      const url = create.mock.results[0]!.value;
      await userEvent.click(within(canvasElement).getByRole('button', { name: 'Unmount' }));
      await expect(revoke).toHaveBeenCalledTimes(1);
      await expect(revoke).toHaveBeenLastCalledWith(url);
      await expect(aborted).toHaveBeenCalledTimes(1);
      await act(async () => {
        attempt.context.onProgress(100);
        attempt.reject(new Error('Late rejection'));
      });
      await expect(within(canvasElement).queryByRole('list')).not.toBeInTheDocument();
      await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    } finally {
      create.mockRestore();
      revoke.mockRestore();
    }
  },
};
export const SingleReplacementCleanup: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `${messagesSource}

import type { FileDropzoneUpload } from '@jfrader/ui';

export function ReceiptUpload({ upload }: { upload: FileDropzoneUpload }) {
  return <FileDropzone label="Add receipts" messages={messages} multiple={false} onUpload={upload} />;
}` } } },
  args: { multiple: false, onUpload: fn(deferredUpload) },
  play: async ({ canvasElement, userEvent, args }) => {
    const firstFile = file('first.pdf');
    await userEvent.upload(inputOf(canvasElement), firstFile);
    await within(canvasElement).findByRole('progressbar');
    const first = deferredUploads.get(firstFile)![0]!;
    await userEvent.upload(inputOf(canvasElement), file('second.pdf'));
    await expect(first.context.signal.aborted).toBe(true);
    await act(async () => {
      first.context.onProgress(100);
      first.resolve();
    });
    await expect(within(canvasElement).queryByText('first.pdf')).not.toBeInTheDocument();
    await expect(within(canvasElement).getByRole('progressbar', { name: 'second.pdf' })).not.toHaveAttribute(
      'aria-valuenow',
    );
    await expect(args.onUpload).toHaveBeenCalledTimes(2);
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
  },
};
export const PasteExcludesEditing: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `${messagesSource}

<FileDropzone label="Add receipts" messages={messages}
  description={<input aria-label="Attachment comment" />} />` } } },
  args: { description: <input aria-label="Attachment comment" /> },
  play: async ({ canvasElement, userEvent, args }) => {
    const comment = within(canvasElement).getByRole('textbox', { name: 'Attachment comment' });
    await userEvent.click(comment);
    await dispatchFiles(comment, 'paste', [file()]);
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await userEvent.tab({ shift: true });
    await expect(comment.ownerDocument.activeElement).toBe(inputOf(canvasElement));
    await dispatchFiles(rootOf(canvasElement), 'paste', [file()]);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
  },
};
export const PasteDisabled: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `${messagesSource}

<FileDropzone label="Add receipts" messages={messages} paste={false} />` } } },
  args: { paste: false },
  play: async ({ canvasElement, userEvent, args }) => {
    await userEvent.tab();
    await expect(canvasElement.ownerDocument.activeElement).toBe(inputOf(canvasElement));
    await dispatchFiles(rootOf(canvasElement), 'paste', [file()]);
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};
export const ConsumerEventVeto: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `${messagesSource}

<FileDropzone label="Add receipts" messages={messages}
  onDrop={event => event.preventDefault()}
  slotProps={{ input: { onChange: event => event.preventDefault() } }} />` } } },
  args: {
    onDrop: fn(event => event.preventDefault()),
    slotProps: { input: { onChange: fn(event => event.preventDefault()) } },
  },
  play: async ({ canvasElement, userEvent, args }) => {
    await userEvent.upload(inputOf(canvasElement), file());
    await dispatchFiles(rootOf(canvasElement), 'drop', [file()]);
    await expect(args.onDrop).toHaveBeenCalledTimes(1);
    await expect(args.slotProps?.input?.onChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};
export const ActionAriaPreserved: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `${messagesSource}

<>
  <span id="receipt-actions">Remove invoice.pdf Remove two.pdf</span>
  <span id="receipt-action-help">Action help</span>
  <FileDropzone label="Add receipts" messages={messages}
    defaultValue={[
      { id: 'remote', name: 'invoice.pdf', size: 12500, uploaded: true },
      { id: 'two', name: 'two.pdf', size: 0 },
    ]}
    slotProps={{ action: { 'aria-label': 'Attachment action',
      'aria-labelledby': 'receipt-actions', 'aria-describedby': 'receipt-action-help' } }} />
</>` } } },
  args: {
    defaultValue: [...existing, { id: 'two', name: 'two.pdf', size: 0 }],
    slotProps: {
      action: {
        'aria-label': 'Attachment action',
        'aria-labelledby': 'action-name unresolved-action',
        'aria-describedby': 'action-description unresolved-help',
      },
    },
  },
  render: args => (
    <>
      <span id="action-name">Remove invoice.pdf Remove two.pdf</span>
      <span id="action-description">Action help</span>
      <FileDropzone {...args} />
    </>
  ),
  play: async ({ canvasElement }) => {
    const actions = within(canvasElement).getAllByRole('button');
    await expect(actions).toHaveLength(2);
    for (const button of actions) {
      await expect(button).toHaveAttribute('data-action', 'remove');
      await expect(button).toHaveAttribute('aria-label', 'Attachment action');
      await expect(button).toHaveAttribute('aria-labelledby', 'action-name unresolved-action');
      await expect(button.getAttribute('aria-describedby')).toContain('action-description unresolved-help');
    }
    const browse = within(canvasElement).getByText('Browse files');
    await expect(browse).not.toHaveAttribute('aria-label');
    await expect(browse).not.toHaveAttribute('aria-labelledby');
    await expect(inputOf(canvasElement)).not.toHaveAttribute('aria-label');
  },
};

const StyledFileDropzone = styled(FileDropzone)({ borderRadius: '9px' });
/** Replace the wrapper and generated label; pass native props through slotProps. */
export const SlotCustomization: Story = {
  args: {
    ref: fn(),
    onClick: fn(),
    className: 'consumer-root',
    title: 'consumer title',
    style: fieldRootStyles.consumer,
    sx: { borderRadius: '11px' },
    component: FieldSugarRoot,
    slots: { root: FieldReplacementRoot, label: FieldReplacementLabel },
    slotProps: {
      root: {
        onClick: fn(),
        ref: fn(),
        className: 'slot-root',
        title: 'slot title',
        style: fieldRootStyles.slot,
        sx: { borderRadius: '8px' },
      },
      label: { ref: fn(), title: 'generated part' },
    },
  },
  render: (args) => <StyledFileDropzone {...args} />,
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `${messagesSource}

import type { ComponentPropsWithRef } from 'react';
import { styled } from '@jfrader/ui';

function ReceiptRoot(props: ComponentPropsWithRef<'div'>) { return <div {...props} />; }
function ReceiptLabel(props: ComponentPropsWithRef<'label'>) { return <label {...props} />; }
const ReceiptPicker = styled(FileDropzone)({ borderRadius: '9px' });

<ReceiptPicker label="Add receipts" messages={messages} className="consumer-root" title="consumer title"
  component={ReceiptRoot} slots={{ root: ReceiptRoot, label: ReceiptLabel }}
  slotProps={{ root: { className: 'slot-root', title: 'slot title', sx: { borderRadius: '8px' } },
    label: { title: 'generated part' } }} sx={{ borderRadius: '11px' }} />`,
      },
    },
  },
  play: async ({ canvasElement, args }) => {
    await expectFieldSlotCustomization(
      canvasElement,
      {
        rootEvent: args.slotProps?.root?.onClick,
        consumerEvent: args.onClick,
        root: args.slotProps?.root?.ref,
        part: args.slotProps?.label?.ref,
        consumer: args.ref,
      },
      'root',
    );
  },
};

/** Use component as shorthand for the wrapper's root slot. */
export const ComponentRoot: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `${messagesSource}

import type { ComponentPropsWithRef } from 'react';

function ReceiptRoot(props: ComponentPropsWithRef<'div'>) { return <div {...props} />; }

<FileDropzone label="Add receipts" messages={messages} component={ReceiptRoot} />` } } },
  args: { component: FieldSugarRoot },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[data-slot-root="component"]')).not.toBeNull();
  },
};

export type FileDropzoneSlotTypeRegression = {
  // @ts-expect-error Unknown structural keys are rejected.
  unknownSlot: NonNullable<import('./index').FileDropzoneProps['slots']>['notASlot'];
  // @ts-expect-error Unknown prop keys are rejected.
  unknownSlotProps: NonNullable<import('./index').FileDropzoneProps['slotProps']>['notASlot'];
};

function UploadAction(props: ButtonProps) {
  return <Button {...props} data-slot-action data-slot-variant={props.variant} />;
}

function UploadMeter(props: ProgressProps) {
  return <Progress {...props} data-slot-progress />;
}

/** Disabled upload controls keep their state when root props conflict. */
export const SlotDisabledState: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `${messagesSource}

import type { ComponentPropsWithRef } from 'react';

function ReceiptRoot(props: ComponentPropsWithRef<'div'>) { return <div {...props} />; }

<FileDropzone label="Add receipts" messages={messages} disabled
  slots={{ root: ReceiptRoot }} slotProps={{ root: { 'aria-disabled': false } }} />` } } },
  args: { disabled: true, slots: { root: FieldReplacementRoot }, slotProps: { root: { 'aria-disabled': false } } },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[data-slot-root]')).toHaveAttribute('aria-disabled', 'true');
    await expect(canvasElement.querySelector('input[type="file"]')).toBeDisabled();
  },
};

/** Replace the upload meter and file actions with adapters for Progress and Button. */
export const UploadPartSlots: Story = {
  parameters: {
    docs: {
      source: {
        language: 'tsx',
        code: `${messagesSource}

import { Button, Progress, type ButtonProps, type ProgressProps, type FileDropzoneUpload } from '@jfrader/ui';

function UploadAction(props: ButtonProps) { return <Button {...props} />; }
function UploadMeter(props: ProgressProps) { return <Progress {...props} />; }

export function ReceiptUpload({ upload }: { upload: FileDropzoneUpload }) {
  return <FileDropzone label="Add receipts" messages={messages} onUpload={upload}
    slots={{ action: UploadAction, progress: UploadMeter }}
    slotProps={{ action: { variant: 'ghost' } }} />;
}`,
      },
    },
  },
  args: {
    slots: { action: UploadAction, progress: UploadMeter },
    slotProps: { action: { variant: 'ghost', ref: fn() }, progress: { ref: fn() } },
    onUpload: async (_item, { onProgress, signal }) => {
      onProgress(40);
      await new Promise<void>((resolve) => signal.addEventListener('abort', () => resolve(), { once: true }));
    },
  },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    await userEvent.upload(
      canvasElement.querySelector<HTMLInputElement>('input[type="file"]')!,
      new File(['receipt'], 'receipt.txt', { type: 'text/plain' }),
    );
    const progress = await canvas.findByRole('progressbar', { name: 'receipt.txt' });
    const action = canvas.getByRole('button', { name: 'Remove receipt.txt' });
    await expect(progress).toHaveAttribute('data-slot-progress');
    await expect(progress).toHaveAttribute('aria-valuenow', '40');
    await expect(progress).toHaveAttribute('aria-valuemax', '100');
    await expect(action).toHaveAttribute('data-slot-action');
    await expect(action).toHaveAttribute('data-slot-variant', 'ghost');
    await expect(args.slotProps?.progress?.ref).toHaveBeenCalledWith(progress);
    await expect(args.slotProps?.action?.ref).toHaveBeenCalledWith(action);
    await userEvent.click(action);
    await expect(args.onValueChange).toHaveBeenLastCalledWith([]);
  },
};
