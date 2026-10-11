import { act, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, spyOn, waitFor, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { withLightTheme } from '../../testing/story-decorators';
import { Button } from '../button';
import {
  FileDropzone,
  type FileDropzoneItem,
  type FileDropzoneMessages,
  type FileDropzoneProps,
  type FileDropzoneUpload,
} from './index';

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
const frame = css({
  inlineSize: 'min(100%, 36rem)',
  display: 'grid',
  gap: vars.space[4],
});
const testMotion = css({ '&, & *': { transitionDuration: '0s' } });
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
      <div css={frame}>
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          'Native file input, Browse button and file list; no custom dropzone role. Tab reaches Browse then row actions; Enter/Space activate once. ArrowUp/Down preserve the row action without wrapping; Delete/Backspace remove. Paste accepts files only while focus is inside, excluding editable controls. Escape is not intercepted. Upload intents and image previews start only for committed selections; existing rows never auto-upload. Submit value items, not input.files: dropped and accumulated files are not native FormData, and native required does not validate that list. Sizes use Intl decimal 1000 scaling. Validate uploaded content independently on the server. Real OS picker, screen reader, mobile and actual media-environment checks remain browser/manual QA gates.',
      },
      source: {
        code: `<FileDropzone label="Add receipts" accept="image/*,.pdf" maxFiles={3}
  value={items} onValueChange={setItems} messages={fileMessages}
  onUpload={(item, { signal, onProgress }) => uploadReceipt(item.file, { signal, onProgress })} />`,
      },
    },
  },
} satisfies Meta<typeof FileDropzone>;
export default meta;
type Story = StoryObj<typeof meta>;
const file = (name = 'receipt.pdf', contents = 'pdf', type = 'application/pdf') =>
  new File([contents], name, { type, lastModified: 1 });
const inputOf = (element: HTMLElement) => element.querySelector<HTMLInputElement>('input[type="file"]')!;
const rootOf = (element: HTMLElement) => element.querySelector<HTMLElement>('[data-ui="file-dropzone"]')!;
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
  type: 'drop' | 'paste' | 'dragenter' | 'dragover',
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
export const Single: Story = {
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
  play: async ({ canvasElement, userEvent, args }) => {
    await userEvent.upload(inputOf(canvasElement), [file('one.pdf'), file('two.pdf')]);
    await expect(within(canvasElement).getAllByRole('listitem')).toHaveLength(2);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
  },
};
export const AcceptedTypes: Story = {
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
    await userEvent.tab();
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Browse files' }));
    await dispatchFiles(root, 'paste', [file('pasted.pdf')]);
    await expect(args.onValueChange).toHaveBeenCalledTimes(3);
    await expect(within(canvasElement).getByText('pasted.pdf')).toBeVisible();
  },
  parameters: {
    docs: {
      description: {
        story:
          'Dispatched DataTransfer events prove React drag/drop and focused paste handlers. Real OS dragging and picker dialogs are separate browser QA gates.',
      },
    },
  },
};
export const SingleRemoteCapacity: Story = {
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
  args: { defaultValue: existing, onUpload: fn(async () => {}) },
  play: async ({ args }) => {
    await expect(args.onUpload).not.toHaveBeenCalled();
  },
};
export const ListInside: Story = {
  args: { defaultValue: existing, listPlacement: 'inside' },
};
export const ListBelow: Story = { args: { defaultValue: existing } };
export const CompactThreshold: Story = {
  args: { defaultValue: existing, compactAt: 1 },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[data-compact]')).toHaveAttribute('data-compact', 'true');
  },
};
export const Sizes: Story = {
  render: args => (
    <>
      {(['sm', 'md', 'lg'] as const).map(size => (
        <FileDropzone {...args} key={size} size={size} />
      ))}
    </>
  ),
};
export const ZeroByte: Story = {
  args: { defaultValue: [{ id: 'empty', name: 'empty.txt', size: 0 }] },
};
export const LongNames: Story = {
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
  decorators: [
    Story => (
      <div style={{ inlineSize: '18rem', maxInlineSize: '100%' }}>
        <Story />
      </div>
    ),
  ],
};
export const RTL: Story = {
  args: { dir: 'rtl', defaultValue: existing },
  play: async ({ canvasElement }) => {
    await expect(getComputedStyle(rootOf(canvasElement)).direction).toBe('rtl');
  },
};
export const PreviewBroken: Story = {
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
  args: { defaultValue: existing },
  decorators: [withLightTheme],
};

const neverUpload: FileDropzoneUpload = () => new Promise(() => {});
export const UploadIndeterminate: Story = {
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
    await expect(canvasElement.querySelector('server')).not.toBeInTheDocument();
  },
};
const retriedFiles = new WeakSet<File>();
export const UploadRetry: Story = {
  args: {
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
  render: args => <ControlledExample {...args} />,
  play: Default.play,
};
export const ControlledRejects: Story = {
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
  args: { disabled: true, defaultValue: existing },
  play: async ({ canvasElement, args }) => {
    await expect(inputOf(canvasElement)).toBeDisabled();
    await dispatchFiles(rootOf(canvasElement), 'drop', [file()]);
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};
export const ReadOnly: Story = {
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
  args: { required: true },
  play: async ({ canvasElement }) => {
    await expect(inputOf(canvasElement)).toBeRequired();
  },
};
export const FormReset: Story = {
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
export const PersistentSelected: Story = { args: { defaultValue: existing } };
export const PersistentUploading: Story = { ...UploadProgress };
export const PersistentFailed: Story = { ...UploadFailed };
export const PersistentRejections: Story = { ...SizeLimit };
export const Keyboard: Story = {
  args: {
    defaultValue: [...existing, { id: 'two', name: 'two.pdf', size: 0 }],
    sx: testMotion,
    slotProps: { input: { onClick: fn() } },
  },
  play: async ({ canvasElement, userEvent, args }) => {
    const canvas = within(canvasElement);
    const browse = canvas.getByRole('button', { name: 'Browse files' });
    await userEvent.tab();
    await expect(browse.ownerDocument.activeElement).toBe(browse);
    await expect(getComputedStyle(browse).outlineStyle).not.toBe('none');
    await userEvent.keyboard('{Enter} ');
    await expect(args.slotProps?.input?.onClick).toHaveBeenCalledTimes(2);
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await userEvent.tab();
    const first = canvas.getByRole('button', { name: 'Remove invoice.pdf' });
    const second = canvas.getByRole('button', { name: 'Remove two.pdf' });
    await expect(first.ownerDocument.activeElement).toBe(first);
    await userEvent.keyboard('{ArrowUp}');
    await expect(first.ownerDocument.activeElement).toBe(first);
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    await expect(second.ownerDocument.activeElement).toBe(second);
    await userEvent.keyboard('{ArrowUp}');
    await expect(first.ownerDocument.activeElement).toBe(first);
    await userEvent.tab({ shift: true });
    await expect(browse.ownerDocument.activeElement).toBe(browse);
    await userEvent.tab();
    await userEvent.keyboard('{Delete}');
    await expect(second.ownerDocument.activeElement).toBe(second);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await userEvent.keyboard('{Backspace}');
    await expect(browse.ownerDocument.activeElement).toBe(browse);
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await expect(browse.getBoundingClientRect().height).toBeGreaterThanOrEqual(31);
  },
};
export const ExternalAria: Story = {
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
    for (const input of inputs.slice(0, 2)) {
      await expect(input).not.toHaveAttribute('aria-labelledby');
      await expect(input).not.toHaveAttribute('aria-describedby');
    }
    for (const input of inputs.slice(2)) {
      await expect(input.getAttribute('aria-labelledby')).toContain('-label');
      await expect(input.getAttribute('aria-describedby')).toContain('-description');
    }
    await expect(new Set(inputs.map(input => input.id)).size).toBe(4);
  },
};
export const ForcedColors: Story = {
  args: { defaultValue: existing },
  parameters: {
    docs: {
      description: {
        story:
          'Structural fixture for manual forced-colors QA; the test runner does not emulate this media setting.',
      },
    },
  },
};
export const ReducedMotion: Story = {
  ...UploadIndeterminate,
  parameters: {
    docs: {
      description: {
        story: 'Structural upload fixture for manual reduced-motion QA; no media emulation is claimed.',
      },
    },
  },
};

export const SingleBatch: Story = {
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
export const RefAndSlots: Story = {
  args: {
    ref: fn(),
    inputRef: fn(),
    sx: { padding: vars.space[4] },
    slotProps: {
      target: { css: { borderRadius: 0 } },
      label: { css: { fontWeight: 700 } },
      action: { css: { borderRadius: 0 } },
    },
  },
  play: async ({ canvasElement, args }) => {
    await expect(args.ref).toHaveBeenCalledWith(rootOf(canvasElement));
    await expect(args.inputRef).toHaveBeenCalledWith(inputOf(canvasElement));
    await expect(getComputedStyle(canvasElement.querySelector('[data-dragging]')!).borderRadius).toBe('0px');
    await expect(
      getComputedStyle(within(canvasElement).getByRole('button', { name: 'Browse files' })).borderRadius,
    ).toBe('0px');
    await expect(getComputedStyle(rootOf(canvasElement)).paddingInlineStart).toBe('16px');
  },
};
export const ExplicitInvalid: Story = {
  args: { error: false, slotProps: { input: { 'aria-invalid': 'grammar' } } },
  play: async ({ canvasElement }) => {
    await expect(inputOf(canvasElement)).toHaveAttribute('aria-invalid', 'grammar');
  },
};
export const ControlledFormReset: Story = {
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
  args: { description: <input aria-label="Attachment comment" /> },
  play: async ({ canvasElement, userEvent, args }) => {
    const comment = within(canvasElement).getByRole('textbox', { name: 'Attachment comment' });
    await userEvent.click(comment);
    await dispatchFiles(comment, 'paste', [file()]);
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Browse files' }));
    await dispatchFiles(rootOf(canvasElement), 'paste', [file()]);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
  },
};
export const PasteDisabled: Story = {
  args: { paste: false },
  play: async ({ canvasElement, userEvent, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Browse files' }));
    await dispatchFiles(rootOf(canvasElement), 'paste', [file()]);
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};
export const ConsumerEventVeto: Story = {
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
  args: {
    defaultValue: existing,
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
      <span id="action-name">Browse files Remove invoice.pdf</span>
      <span id="action-description">Action help</span>
      <FileDropzone {...args} />
    </>
  ),
  play: async ({ canvasElement }) => {
    for (const button of within(canvasElement).getAllByRole('button')) {
      await expect(button).toHaveAttribute('aria-label', 'Attachment action');
      await expect(button).toHaveAttribute('aria-labelledby', 'action-name unresolved-action');
      await expect(button.getAttribute('aria-describedby')).toContain('action-description unresolved-help');
    }
  },
};
