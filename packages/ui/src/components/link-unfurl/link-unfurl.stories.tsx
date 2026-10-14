import { useRef, useState, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fireEvent, fn, waitFor, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { withLightTheme } from '../../testing/story-decorators';
import { expectThemedSurface } from '../../testing/theme-assertions';
import {
  LinkUnfurl,
  type LinkUnfurlPreview,
  type LinkUnfurlPreviewRequestContext,
  type LinkUnfurlPreviewStatus,
  type LinkUnfurlProps,
} from './index';

const GUIDE = 'https://example.com/guide';
const CHANGELOG = 'https://example.org/changelog';
const COVER = new URL('/og-image.png', window.location.href).href;
const FAVICON = COVER;
const METADATA: Partial<LinkUnfurlPreview> = {
  site: 'example.com',
  title: 'Design guide',
  description: 'Spacing, color and type decisions for the product surfaces.',
  image: { src: COVER, alt: 'React components built from scratch' },
  favicon: FAVICON,
};
const SETTLE_MS = 240;
const settle = () => new Promise((resolve) => setTimeout(resolve, SETTLE_MS));

const frameStyle = css({ inlineSize: 'min(100vw - 32px, 36rem)', minInlineSize: 0 });
const narrowStyle = css({ inlineSize: '20rem' });
const stackStyle = css({ display: 'grid', gap: vars.space[4] });
const fixtureStyle = css({
  minBlockSize: vars.space[8],
  minInlineSize: vars.space[8],
  paddingInline: vars.space[2],
  color: vars.color.text,
  background: vars.color.surface,
  border: `1px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.sm,
});

type Outcome = LinkUnfurlPreviewStatus | 'manual';

interface Request extends LinkUnfurlPreviewRequestContext {
  url: string;
}

interface DemoProps extends LinkUnfurlProps {
  /** How the story's stand-in server answers each request. */
  outcome?: Outcome;
  /** Commit the ready record and its expanded id in one consumer update. */
  autoExpand?: boolean;
  /** Ready metadata for the nth request. */
  metadataFor?: (index: number) => Partial<LinkUnfurlPreview>;
}

const answer = (request: Request, status: LinkUnfurlPreviewStatus, metadata: Partial<LinkUnfurlPreview> = {}) => ({
  linkId: request.linkId,
  requestId: request.requestId,
  url: request.url,
  status,
  ...(status === 'ready' ? metadata : {}),
  ...(status === 'error' ? { error: 'Site unreachable' } : {}),
});

/** Story stand-in for the consumer's preview server: answers requests in memory, never over the network. */
function Demo({ outcome = 'ready', autoExpand = false, metadataFor = () => METADATA, ...props }: DemoProps) {
  const [previews, setPreviews] = useState<LinkUnfurlPreview[]>([]);
  const [expanded, setExpanded] = useState<string[]>([]);
  const requests = useRef<Request[]>([]);
  const settleRequest = (request: Request | undefined, status: LinkUnfurlPreviewStatus) => {
    if (request) setPreviews((current) => [...current, answer(request, status, METADATA)]);
  };
  return (
    <div css={stackStyle}>
      <LinkUnfurl
        {...props}
        previews={previews}
        expanded={autoExpand ? expanded : props.expanded}
        onExpandedChange={(ids) => {
          props.onExpandedChange?.(ids);
          if (autoExpand) setExpanded(ids);
        }}
        onPreviewRequest={(url, context) => {
          props.onPreviewRequest?.(url, context);
          const request = { url, ...context };
          const index = requests.current.push(request) - 1;
          if (outcome === 'manual') return;
          setPreviews((current) => [...current, answer(request, outcome, metadataFor(index))]);
          if (autoExpand && outcome === 'ready') setExpanded((current) => [...current, context.linkId]);
        }}
      />
      {outcome === 'manual' ? (
        <div>
          <button css={fixtureStyle} onClick={() => settleRequest(requests.current.at(-1), 'pending')}>
            Mark latest pending
          </button>
          <button css={fixtureStyle} onClick={() => settleRequest(requests.current[0], 'ready')}>
            Resolve first request
          </button>
          <button css={fixtureStyle} onClick={() => settleRequest(requests.current.at(-1), 'ready')}>
            Resolve latest request
          </button>
          <button css={fixtureStyle} onClick={() => settleRequest(requests.current.at(-1), 'error')}>
            Fail latest request
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Unmountable({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(true);
  return (
    <div css={stackStyle}>
      {mounted ? children : null}
      <button css={fixtureStyle} onClick={() => setMounted(false)}>
        Unmount composer
      </button>
    </div>
  );
}

const source = `function Composer() {
  const [previews, setPreviews] = useState<LinkUnfurlPreview[]>([]);
  const requestPreview = async (url: string, { linkId, requestId, signal }) => {
    setPreviews((all) => [...all, { linkId, requestId, url, status: 'pending' }]);
    const metadata = await fetchPreview(url, { signal }); // your server
    setPreviews((all) => [...all, { linkId, requestId, url, ...metadata }]);
  };
  return <LinkUnfurl label="Message" previews={previews} onPreviewRequest={requestPreview} onSend={post} />;
}`;

const meta = {
  title: 'Inputs/LinkUnfurl',
  component: LinkUnfurl,
  tags: ['autodocs'],
  args: {
    label: 'Message',
    onValueChange: fn(),
    onPreviewRequest: fn(),
    onExpandedChange: fn(),
  },
  render: (args) => <Demo {...args} />,
  decorators: [
    (Story) => (
      <div css={frameStyle}>
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      source: { code: source },
      description: {
        component: 'Write a plain-text message and preview the links in your draft.',
      },
      usage: `### Previews
- Fetch metadata in your app. LinkUnfurl never fetches.
- \`onPreviewRequest(url, { linkId, requestId, signal })\` runs only after user actions: paste, typing past an address, blur, suggestions, or Retry. Add \`previews\` records with matching \`linkId\` and \`requestId\`. Older request ids are ignored. Retry creates a new request id.
- The signal aborts when the address disappears through removal or editing, Retry replaces the request, a successful send clears the draft, or the composer unmounts.
- Preview images and favicons require absolute HTTP(S) URLs. Other schemes are not rendered. For multiple records answering the same request, the latest record wins.

### Values
- Control text with \`value\` and \`onValueChange\`, or start with \`defaultValue\` (empty by default).
- Control open link ids separately with \`expanded\` and \`onExpandedChange\`, or start with \`defaultExpanded\` (none by default). Rejected controlled requests keep the committed text and visibility.
- To open a preview as it resolves, commit its ready record and link id in the same update.

### Limits
- Addresses must be complete, whitespace-delimited absolute HTTP(S) URLs accepted by \`URL\`. Paste and blur scan all text. While typing, the address at the caret waits for following whitespace.
- Duplicate addresses have separate link ids. Remove deletes only that occurrence. Addresses supplied through \`value\` or \`defaultValue\` wait for Retry.
- The native textarea keeps paste, undo, IME, and mobile editing. Preview items appear beside the field, not as inline tokens.

### Keyboard
- Tab follows the field, preview actions, suggestions, and Send. Press Enter on a title link to navigate.
- With \`onSend\`, Enter sends once. It does not send during IME composition or a pending send. Shift+Enter adds a line.
- Alt+Enter toggles a ready preview when the caret is inside or at the end of its address. It never inserts a line, even without a preview at the caret. Escape is left to the page.

### Sending
- Provide \`onSend\` to enable Send for text containing more than whitespace. It receives the text and current matching preview records.
- A returned promise keeps sending pending until it settles. The field becomes read-only. Remove and suggestions become inactive but stay focusable.
- Success requests empty text, then no expanded ids. Failure keeps the draft and shows \`labels.error\` as an alert.`,
    },
  },
} satisfies Meta<typeof LinkUnfurl>;
export default meta;
type Story = StoryObj<typeof meta>;

const items = (root: HTMLElement) => [...root.querySelectorAll<HTMLElement>('[data-ui="link-unfurl-item"]')];
const statusRegion = (root: HTMLElement) => root.querySelector<HTMLElement>('[data-ui="link-unfurl-status"]')!;
const field = (root: HTMLElement) => within(root).getByRole('textbox', { name: 'Message' });
const requestAt = (spy: unknown, index: number) =>
  (spy as ReturnType<typeof fn>).mock.calls[index] as [string, LinkUnfurlPreviewRequestContext];

async function pasteInto(
  textarea: HTMLElement,
  text: string,
  userEvent: { click: (el: Element) => Promise<void>; paste: (text: string) => Promise<void> },
) {
  await userEvent.click(textarea);
  await userEvent.paste(text);
}

async function expectFocusRing(element: Element) {
  await expect(element.ownerDocument.activeElement).toBe(element);
  await expect(getComputedStyle(element).outlineStyle).not.toBe('none');
  await expect(Math.abs(parseFloat(getComputedStyle(element).outlineWidth) - 2)).toBeLessThan(1.1);
}

export const Default: Story = {
  render: (args) => <Demo {...args} autoExpand />,
  play: async ({ canvasElement, canvas, args, userEvent }) => {
    await pasteInto(field(canvasElement), `Read ${GUIDE}`, userEvent);
    await expect(args.onPreviewRequest).toHaveBeenCalledTimes(1);
    await expect(requestAt(args.onPreviewRequest, 0)[0]).toBe(GUIDE);
    const title = await canvas.findByRole('link', { name: 'Design guide' });
    await expect(title).toHaveAttribute('href', GUIDE);
    const toggle = canvas.getByRole('button', { name: 'Collapse' });
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const card = canvasElement.ownerDocument.getElementById(toggle.getAttribute('aria-controls')!)!;
    await expect(card).toBeVisible();
    const image = within(card).getByRole('img', { name: METADATA.image!.alt });
    await waitFor(() => expect(image).toBeVisible());
    await expect(card).toHaveTextContent(METADATA.description as string);
    await settle();
    const item = items(canvasElement)[0]!;
    await expect(item.getBoundingClientRect().width).toBeLessThanOrEqual(27.5 * 16 + 1.1);
    await expect(statusRegion(canvasElement)).toHaveTextContent('Design guide');
    await expect(args.onExpandedChange).not.toHaveBeenCalled();
  },
};

export const ManualExpansion: Story = {
  play: async ({ canvasElement, canvas, args, userEvent }) => {
    await pasteInto(field(canvasElement), GUIDE, userEvent);
    const expand = await canvas.findByRole('button', { name: 'Expand' });
    const card = canvasElement.ownerDocument.getElementById(expand.getAttribute('aria-controls')!)!;
    await expect(expand).toHaveAttribute('aria-expanded', 'false');
    await expect(card).not.toBeVisible();
    await expect(card.inert).toBe(true);
    await userEvent.click(expand);
    const linkId = requestAt(args.onPreviewRequest, 0)[1].linkId;
    await expect(args.onExpandedChange).toHaveBeenCalledTimes(1);
    await expect(args.onExpandedChange).toHaveBeenLastCalledWith([linkId]);
    await expect(expand).toHaveAttribute('aria-expanded', 'true');
    await expect(card).toBeVisible();
    await expect(statusRegion(canvasElement)).toHaveTextContent('Expand, Design guide');
    await userEvent.click(canvas.getByRole('button', { name: 'Collapse' }));
    await expect(args.onExpandedChange).toHaveBeenCalledTimes(2);
    await expect(args.onExpandedChange).toHaveBeenLastCalledWith([]);
    await expect(card).not.toBeVisible();
    await expect(statusRegion(canvasElement)).toHaveTextContent('Collapse, Design guide');
  },
};

export const DragToFold: Story = {
  render: (args) => <Demo {...args} autoExpand />,
  play: async ({ canvasElement, canvas, args, userEvent }) => {
    await pasteInto(field(canvasElement), GUIDE, userEvent);
    const toggle = await canvas.findByRole('button', { name: 'Collapse' });
    const card = canvasElement.ownerDocument.getElementById(toggle.getAttribute('aria-controls')!)!;
    const header = toggle.closest('[data-ui="link-unfurl-controls"]')!.parentElement!;
    const height = card.getBoundingClientRect().height;
    const top = header.getBoundingClientRect().top + 4;
    // A short drag and a cancelled drag both restore the card.
    await fireEvent.pointerDown(header, { pointerId: 1, button: 0, clientY: top });
    await fireEvent.pointerMove(header, { pointerId: 1, clientY: top - height * 0.2 });
    await fireEvent.pointerUp(header, { pointerId: 1, clientY: top - height * 0.2 });
    await fireEvent.pointerDown(header, { pointerId: 2, button: 0, clientY: top });
    await fireEvent.pointerMove(header, { pointerId: 2, clientY: top - height * 0.8 });
    await expect(card.style.getPropertyValue('--link-unfurl-fold')).not.toBe('0');
    await fireEvent.pointerCancel(header, { pointerId: 2 });
    await expect(card.style.getPropertyValue('--link-unfurl-fold')).toBe('0');
    await expect(args.onExpandedChange).not.toHaveBeenCalled();
    await fireEvent.pointerDown(header, { pointerId: 3, button: 0, clientY: top });
    await fireEvent.pointerMove(header, { pointerId: 3, clientY: top - height * 0.5 });
    await fireEvent.pointerUp(header, { pointerId: 3, clientY: top - height * 0.5 });
    await expect(args.onExpandedChange).toHaveBeenCalledTimes(1);
    await expect(args.onExpandedChange).toHaveBeenLastCalledWith([]);
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  },
};

export const Suggestions: Story = {
  args: {
    suggestions: [
      { url: GUIDE, label: 'Design guide' },
      { url: CHANGELOG, label: 'Changelog' },
    ],
  },
  play: async ({ canvasElement, canvas, args, userEvent }) => {
    await userEvent.type(field(canvasElement), 'See');
    await userEvent.click(canvas.getByRole('button', { name: 'Changelog' }));
    await expect(field(canvasElement)).toHaveValue(`See ${CHANGELOG} `);
    await expect(args.onValueChange).toHaveBeenLastCalledWith(`See ${CHANGELOG} `);
    await expect(args.onPreviewRequest).toHaveBeenCalledTimes(1);
    await expect(requestAt(args.onPreviewRequest, 0)[0]).toBe(CHANGELOG);
    await expect(items(canvasElement)).toHaveLength(1);
  },
};

export const DuplicateUrls: Story = {
  play: async ({ canvasElement, canvas, args, userEvent }) => {
    const textarea = field(canvasElement);
    await pasteInto(textarea, `${GUIDE} and ${GUIDE} again`, userEvent);
    await expect(args.onPreviewRequest).toHaveBeenCalledTimes(2);
    const [, first] = requestAt(args.onPreviewRequest, 0);
    const [, second] = requestAt(args.onPreviewRequest, 1);
    await expect(first.linkId).not.toBe(second.linkId);
    await expect(items(canvasElement)).toHaveLength(2);
    const removeSecond = within(items(canvasElement)[1]!).getByRole('button', { name: 'Remove' });
    removeSecond.focus();
    await userEvent.keyboard('{Enter}');
    await expect(textarea).toHaveValue(`${GUIDE} and again`);
    await expect(args.onValueChange).toHaveBeenLastCalledWith(`${GUIDE} and again`);
    await expect(second.signal.aborted).toBe(true);
    await expect(first.signal.aborted).toBe(false);
    await expect(items(canvasElement)).toHaveLength(1);
    await expect(items(canvasElement)[0]).toHaveAttribute('data-link-id', first.linkId);
    const survivor = within(items(canvasElement)[0]!).getByRole('link', { name: 'Design guide' });
    await waitFor(() => expectFocusRing(survivor));
    await expect(statusRegion(canvasElement)).toHaveTextContent('Remove, Design guide');
    await expect(canvas.getAllByRole('link')).toHaveLength(1);
  },
};

export const Loading: Story = {
  render: (args) => <Demo {...args} outcome="pending" />,
  play: async ({ canvasElement, userEvent }) => {
    await pasteInto(field(canvasElement), GUIDE, userEvent);
    const item = items(canvasElement)[0]!;
    await expect(item).toHaveAttribute('data-status', 'pending');
    await expect(within(item).getByText('Loading preview')).toBeVisible();
    await expect(within(item).queryByRole('button', { name: 'Expand' })).not.toBeInTheDocument();
    await expect(within(item).getByRole('link', { name: GUIDE })).toHaveAttribute('href', GUIDE);
    await expect(statusRegion(canvasElement)).toHaveTextContent('Loading preview, example.com');
  },
};

export const NoPreview: Story = {
  render: (args) => <Demo {...args} outcome="none" />,
  play: async ({ canvasElement, userEvent }) => {
    await pasteInto(field(canvasElement), GUIDE, userEvent);
    const item = items(canvasElement)[0]!;
    await expect(within(item).getByText('No preview')).toBeVisible();
    await expect(within(item).getByRole('link', { name: GUIDE })).toBeVisible();
    await expect(within(item).getByRole('button', { name: 'Remove' })).toBeVisible();
    await expect(within(item).queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  },
};

export const FailedPreview: Story = {
  render: (args) => <Demo {...args} outcome="error" />,
  play: async ({ canvasElement, args, userEvent }) => {
    await pasteInto(field(canvasElement), GUIDE, userEvent);
    const item = items(canvasElement)[0]!;
    await expect(within(item).getByText('Site unreachable')).toBeVisible();
    await userEvent.click(within(item).getByRole('button', { name: 'Retry' }));
    await expect(args.onPreviewRequest).toHaveBeenCalledTimes(2);
    const [, first] = requestAt(args.onPreviewRequest, 0);
    const [url, second] = requestAt(args.onPreviewRequest, 1);
    await expect(url).toBe(GUIDE);
    await expect(second.linkId).toBe(first.linkId);
    await expect(second.requestId).not.toBe(first.requestId);
    await expect(first.signal.aborted).toBe(true);
    await expect(second.signal.aborted).toBe(false);
    await expect(within(item).getByText('Site unreachable')).toBeVisible();
  },
};

export const StaleRequests: Story = {
  render: (args) => <Demo {...args} outcome="manual" />,
  play: async ({ canvasElement, canvas, args, userEvent }) => {
    await pasteInto(field(canvasElement), GUIDE, userEvent);
    await userEvent.click(canvas.getByRole('button', { name: 'Fail latest request' }));
    await userEvent.click(await canvas.findByRole('button', { name: 'Retry' }));
    await expect(args.onPreviewRequest).toHaveBeenCalledTimes(2);
    await expect(requestAt(args.onPreviewRequest, 0)[1].signal.aborted).toBe(true);
    // The first request completes late: its record carries a stale request id.
    await userEvent.click(canvas.getByRole('button', { name: 'Resolve first request' }));
    await expect(items(canvasElement)[0]).toHaveAttribute('data-status', 'pending');
    await expect(canvas.queryByRole('button', { name: 'Expand' })).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: 'Resolve latest request' }));
    await expect(items(canvasElement)[0]).toHaveAttribute('data-status', 'ready');
    await expect(canvas.getByRole('button', { name: 'Expand' })).toBeVisible();
  },
};

export const AbortOnUnmount: Story = {
  render: (args) => (
    <Unmountable>
      <Demo {...args} outcome="manual" />
    </Unmountable>
  ),
  play: async ({ canvasElement, canvas, args, userEvent }) => {
    await pasteInto(field(canvasElement), GUIDE, userEvent);
    const [, request] = requestAt(args.onPreviewRequest, 0);
    await expect(request.signal.aborted).toBe(false);
    await userEvent.click(canvas.getByRole('button', { name: 'Unmount composer' }));
    await expect(request.signal.aborted).toBe(true);
  },
};

export const Sending: Story = {
  args: {
    onSend: fn(() => new Promise<void>(() => {})),
    suggestions: [{ url: CHANGELOG, label: 'Changelog' }],
  },
  play: async ({ canvasElement, canvas, args, userEvent }) => {
    const textarea = field(canvasElement);
    await pasteInto(textarea, `Hello ${GUIDE}`, userEvent);
    await userEvent.keyboard('{Enter}');
    await expect(args.onSend).toHaveBeenCalledTimes(1);
    await expect(args.onSend).toHaveBeenCalledWith({
      text: `Hello ${GUIDE}`,
      previews: [expect.objectContaining({ url: GUIDE, status: 'ready' })],
    });
    const send = canvas.getByRole('button', { name: 'Send' });
    await expect(send).toHaveAttribute('aria-busy', 'true');
    await expect(textarea).toHaveAttribute('readonly');
    await expect(textarea.ownerDocument.activeElement).toBe(textarea);
    await userEvent.keyboard('{Enter}');
    await userEvent.click(send);
    await expect(args.onSend).toHaveBeenCalledTimes(1);
    const remove = canvas.getByRole('button', { name: 'Remove' });
    const suggestion = canvas.getByRole('button', { name: 'Changelog' });
    await expect(remove).toHaveAttribute('aria-disabled', 'true');
    await expect(suggestion).toHaveAttribute('aria-disabled', 'true');
    const edits = (args.onValueChange as ReturnType<typeof fn>).mock.calls.length;
    await userEvent.click(remove);
    await userEvent.click(suggestion);
    await expect(textarea).toHaveValue(`Hello ${GUIDE}`);
    await expect(args.onValueChange).toHaveBeenCalledTimes(edits);
    await expect(items(canvasElement)).toHaveLength(1);
  },
};

export const SendSuccess: Story = {
  args: { onSend: fn(() => Promise.resolve()) },
  render: (args) => <Demo {...args} autoExpand />,
  play: async ({ canvasElement, canvas, args, userEvent }) => {
    const textarea = field(canvasElement);
    await pasteInto(textarea, `Read ${GUIDE}`, userEvent);
    const [, request] = requestAt(args.onPreviewRequest, 0);
    await userEvent.click(canvas.getByRole('button', { name: 'Send' }));
    await expect(args.onSend).toHaveBeenCalledTimes(1);
    await expect(args.onSend).toHaveBeenCalledWith({
      text: `Read ${GUIDE}`,
      previews: [expect.objectContaining({ linkId: request.linkId, requestId: request.requestId, status: 'ready' })],
    });
    await waitFor(() => expect(textarea).toHaveValue(''));
    await expect(args.onValueChange).toHaveBeenLastCalledWith('');
    await expect(args.onExpandedChange).toHaveBeenLastCalledWith([]);
    await expect(request.signal.aborted).toBe(true);
    await expect(items(canvasElement)).toHaveLength(0);
    await expect(statusRegion(canvasElement)).toHaveTextContent('Message sent');
  },
};

export const SendError: Story = {
  args: { onSend: fn(() => Promise.reject(new Error('offline'))) },
  play: async ({ canvasElement, canvas, args, userEvent }) => {
    const textarea = field(canvasElement);
    await userEvent.type(textarea, 'Hello');
    await userEvent.click(canvas.getByRole('button', { name: 'Send' }));
    const alert = await canvas.findByRole('alert');
    await expect(alert).toHaveTextContent('Message not sent');
    await expect(args.onSend).toHaveBeenCalledTimes(1);
    await expect(textarea).toHaveValue('Hello');
    await expect(textarea).not.toHaveAttribute('readonly');
    await expect(textarea.getAttribute('aria-describedby')).toContain(alert.id);
  },
};

export const Light: Story = {
  render: (args) => <Demo {...args} autoExpand />,
  decorators: [withLightTheme],
  play: async ({ canvasElement, userEvent }) => {
    await pasteInto(field(canvasElement), GUIDE, userEvent);
    await expectThemedSurface(items(canvasElement)[0]!, 'light');
  },
};

async function expectTargets(root: HTMLElement) {
  for (const button of within(root).getAllByRole('button')) {
    const rect = button.getBoundingClientRect();
    await expect(rect.height).toBeGreaterThanOrEqual(32 - 1.1);
    await expect(rect.width).toBeGreaterThanOrEqual(24 - 1.1);
  }
  for (const link of within(root).getAllByRole('link')) {
    const rect = link.getBoundingClientRect();
    await expect(rect.height).toBeGreaterThanOrEqual(24 - 1.1);
    await expect(rect.width).toBeGreaterThanOrEqual(24 - 1.1);
  }
}

export const Narrow: Story = {
  args: { onSend: fn() },
  render: (args) => <Demo {...args} autoExpand />,
  decorators: [
    (Story) => (
      <div css={narrowStyle}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement, canvas, userEvent }) => {
    await pasteInto(
      field(canvasElement),
      `${GUIDE}/a-very-long-path-that-has-to-wrap-inside-a-narrow-composer`,
      userEvent,
    );
    await canvas.findByRole('link', { name: 'Design guide' });
    await settle();
    const root = canvasElement.querySelector<HTMLElement>('[data-ui="link-unfurl"]')!;
    await expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth + 1);
    const controls = root.querySelector('[data-ui="link-unfurl-controls"]')!.getBoundingClientRect();
    const title = canvas.getByRole('link', { name: 'Design guide' }).getBoundingClientRect();
    await expect(controls.top).toBeGreaterThan(title.bottom - 1.1);
    await expectTargets(root);
  },
};

export const RTL: Story = {
  args: { dir: 'rtl', onSend: fn() },
  render: (args) => <Demo {...args} />,
  play: async ({ canvasElement, canvas, userEvent }) => {
    await pasteInto(field(canvasElement), GUIDE, userEvent);
    const root = canvasElement.querySelector<HTMLElement>('[data-ui="link-unfurl"]')!;
    await expect(getComputedStyle(root).direction).toBe('rtl');
    await settle();
    const title = (await canvas.findByRole('link', { name: 'Design guide' })).getBoundingClientRect();
    const remove = canvas.getByRole('button', { name: 'Remove' }).getBoundingClientRect();
    await expect(remove.right).toBeLessThanOrEqual(title.left + 1.1);
    await expectTargets(root);
  },
};

export const ReducedMotion: Story = {
  args: { motion: 'none' },
  render: (args) => <Demo {...args} outcome="pending" />,
  parameters: {
    docs: {
      description: {
        story:
          'Use `motion="none"` to stop the loading sweep and layout animation. To try the operating-system setting, emulate reduced motion in the browser.',
      },
    },
  },
  play: async ({ canvasElement, userEvent }) => {
    await pasteInto(field(canvasElement), GUIDE, userEvent);
    const pending = canvasElement.querySelector<HTMLElement>('[data-ui="link-unfurl-pending"]')!;
    await expect(pending).toHaveTextContent('Loading preview');
    await expect(getComputedStyle(pending).animationName).toBe('none');
    await expect(canvasElement.querySelector('[data-ui="link-unfurl"]')).toHaveAttribute('data-motion', 'none');
  },
};

export const BrokenImage: Story = {
  render: (args) => (
    <Demo
      {...args}
      autoExpand
      metadataFor={() => ({
        ...METADATA,
        image: { src: new URL('/missing-link-unfurl.png', window.location.href).href, alt: 'Cover' },
      })}
    />
  ),
  play: async ({ canvasElement, canvas, userEvent }) => {
    await pasteInto(field(canvasElement), GUIDE, userEvent);
    await canvas.findByRole('link', { name: 'Design guide' });
    const frame = canvasElement.querySelector<HTMLElement>('[data-ui="link-unfurl-image-frame"]')!;
    await waitFor(() => expect(frame.querySelector('img')).toBeNull());
    await settle();
    const rect = frame.getBoundingClientRect();
    await expect(Math.abs(rect.width / rect.height - 1.91)).toBeLessThan(0.05);
    await expect(canvas.getByRole('link', { name: 'Design guide' })).toBeVisible();
  },
};

export const Empty: Story = {
  render: (args) => <LinkUnfurl {...args} />,
  play: async ({ canvasElement, canvas, userEvent }) => {
    const textarea = field(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Send' })).toBeDisabled();
    await expect(canvasElement.querySelector('[data-ui="link-unfurl-lane"]')).toBeNull();
    await userEvent.type(textarea, 'One{Enter}Two');
    await expect(textarea).toHaveValue('One\nTwo');
  },
};

export const ControlledRejected: Story = {
  args: { value: `See ${GUIDE} `, expanded: [] },
  play: async ({ canvasElement, canvas, args, userEvent }) => {
    const textarea = field(canvasElement);
    // Text that arrives from outside waits for Retry instead of requesting on render.
    await expect(args.onPreviewRequest).not.toHaveBeenCalled();
    await userEvent.click(canvas.getByRole('button', { name: 'Retry' }));
    await expect(args.onPreviewRequest).toHaveBeenCalledTimes(1);
    const expand = await canvas.findByRole('button', { name: 'Expand' });
    await userEvent.click(expand);
    await expect(args.onExpandedChange).toHaveBeenCalledTimes(1);
    await expect(args.onExpandedChange).toHaveBeenLastCalledWith([requestAt(args.onPreviewRequest, 0)[1].linkId]);
    await expect(expand).toHaveAttribute('aria-expanded', 'false');
    await userEvent.type(textarea, 'x');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith(`See ${GUIDE} x`);
    await expect(textarea).toHaveValue(`See ${GUIDE} `);
    const remove = canvas.getByRole('button', { name: 'Remove' });
    await userEvent.click(remove);
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await expect(args.onValueChange).toHaveBeenLastCalledWith('See ');
    await expect(items(canvasElement)).toHaveLength(1);
    await expect(remove.ownerDocument.activeElement).toBe(remove);
    await expect(requestAt(args.onPreviewRequest, 0)[1].signal.aborted).toBe(false);
  },
};

export const FalsyDescription: Story = {
  render: (args) => (
    <Demo
      {...args}
      autoExpand
      metadataFor={(index) => ({ title: `Page ${index}`, description: [false, null, 0, ''][index] })}
    />
  ),
  play: async ({ canvasElement, canvas, userEvent }) => {
    await pasteInto(field(canvasElement), [0, 1, 2, 3].map((n) => `${GUIDE}/${n}`).join(' '), userEvent);
    await canvas.findByRole('link', { name: 'Page 3' });
    const cards = [...canvasElement.querySelectorAll<HTMLElement>('[data-ui="link-unfurl-card"]')];
    await expect(cards).toHaveLength(4);
    const paragraphs = cards.map((card) => card.querySelector('p'));
    await expect(paragraphs[0]).toBeNull();
    await expect(paragraphs[1]).toBeNull();
    await expect(paragraphs[2]).toHaveTextContent('0');
    await expect(paragraphs[3]).toBeNull();
  },
};

export const TypingDetection: Story = {
  play: async ({ canvasElement, args, userEvent }) => {
    const textarea = field(canvasElement);
    await userEvent.type(textarea, `Read ${GUIDE}`);
    await expect(args.onPreviewRequest).not.toHaveBeenCalled();
    await userEvent.type(textarea, ' and ftp://example.com and https://');
    await expect(args.onPreviewRequest).toHaveBeenCalledTimes(1);
    await expect(requestAt(args.onPreviewRequest, 0)[0]).toBe(GUIDE);
    await userEvent.type(textarea, `${CHANGELOG.slice('https://'.length)}`);
    await userEvent.tab();
    await expect(args.onPreviewRequest).toHaveBeenCalledTimes(2);
    await expect(requestAt(args.onPreviewRequest, 1)[0]).toBe(CHANGELOG);
    await expect(items(canvasElement)).toHaveLength(2);
    await userEvent.click(textarea);
    await userEvent.paste(' plain words');
    await expect(textarea).toHaveValue(`Read ${GUIDE} and ftp://example.com and ${CHANGELOG} plain words`);
    await expect(args.onPreviewRequest).toHaveBeenCalledTimes(2);
  },
};

export const KeyboardPlay: Story = {
  args: { onSend: fn() },
  render: (args) => (
    <>
      <button css={fixtureStyle}>Before</button>
      <Demo {...args} />
    </>
  ),
  play: async ({ canvasElement, canvas, args, userEvent }) => {
    const textarea = field(canvasElement);
    await userEvent.tab();
    await userEvent.tab();
    await expectFocusRing(textarea);
    await userEvent.paste(GUIDE);
    await expect(args.onPreviewRequest).toHaveBeenCalledTimes(1);
    await userEvent.keyboard('{Shift>}{Enter}{/Shift}');
    await expect(textarea).toHaveValue(`${GUIDE}\n`);
    await userEvent.type(textarea, 'Notes');
    await userEvent.keyboard('{Alt>}{Enter}{/Alt}');
    await expect(args.onExpandedChange).not.toHaveBeenCalled();
    await expect(textarea).toHaveValue(`${GUIDE}\nNotes`);
    (textarea as HTMLTextAreaElement).setSelectionRange(GUIDE.length, GUIDE.length);
    await userEvent.keyboard('{Alt>}{Enter}{/Alt}');
    const linkId = requestAt(args.onPreviewRequest, 0)[1].linkId;
    await expect(args.onExpandedChange).toHaveBeenCalledTimes(1);
    await expect(args.onExpandedChange).toHaveBeenLastCalledWith([linkId]);
    await expect(textarea.ownerDocument.activeElement).toBe(textarea);
    await expect(textarea).toHaveValue(`${GUIDE}\nNotes`);
    fireEvent.keyDown(textarea, { key: 'Enter', isComposing: true, keyCode: 229 });
    await expect(args.onSend).not.toHaveBeenCalled();
    await userEvent.keyboard('{Escape}');
    await expect(textarea).toHaveValue(`${GUIDE}\nNotes`);
    await userEvent.tab();
    await expectFocusRing(canvas.getByRole('link', { name: 'Design guide' }));
    await userEvent.tab();
    const toggle = canvas.getByRole('button', { name: 'Collapse' });
    await expectFocusRing(toggle);
    await userEvent.keyboard(' ');
    await expect(args.onExpandedChange).toHaveBeenCalledTimes(2);
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await userEvent.tab();
    await expectFocusRing(canvas.getByRole('button', { name: 'Remove' }));
    await userEvent.tab();
    const send = canvas.getByRole('button', { name: 'Send' });
    await expectFocusRing(send);
    await userEvent.keyboard('{Enter}');
    await expect(args.onSend).toHaveBeenCalledTimes(1);
    await expect(args.onSend).toHaveBeenCalledWith({
      text: `${GUIDE}\nNotes`,
      previews: [expect.objectContaining({ linkId, status: 'ready' })],
    });
  },
};

export const ExternalAria: Story = {
  args: {
    slotProps: { field: { 'aria-labelledby': 'thread-heading', 'aria-describedby': 'thread-rules missing-node' } },
  },
  render: (args) => (
    <>
      <h2 id="thread-heading">Thread</h2>
      <p id="thread-rules">Be kind.</p>
      <Demo {...args} />
    </>
  ),
  play: async ({ canvas }) => {
    const textarea = canvas.getByRole('textbox', { name: 'Thread Message' });
    await expect(textarea.getAttribute('aria-describedby')).toContain('thread-rules missing-node');
    await expect(textarea).toHaveAccessibleDescription(
      'Be kind. Enter sends, Shift+Enter adds a line, Alt+Enter opens or closes the preview at the cursor.',
    );
  },
};

export const UniqueIds: Story = {
  render: (args) => (
    <>
      <Demo {...args} />
      <Demo {...args} label="Reply" />
    </>
  ),
  play: async ({ canvas, args, userEvent }) => {
    const message = canvas.getByRole('textbox', { name: 'Message' });
    const reply = canvas.getByRole('textbox', { name: 'Reply' });
    await expect(message.id).not.toBe(reply.id);
    await expect(message.getAttribute('aria-describedby')).not.toBe(reply.getAttribute('aria-describedby'));
    await userEvent.click(message);
    await userEvent.paste(GUIDE);
    await userEvent.click(reply);
    await userEvent.paste(GUIDE);
    const [, first] = requestAt(args.onPreviewRequest, 0);
    const [, second] = requestAt(args.onPreviewRequest, 1);
    await expect(first.linkId).not.toBe(second.linkId);
    const toggles = canvas.getAllByRole('button', { name: 'Expand' });
    await expect(toggles[0]!.getAttribute('aria-controls')).not.toBe(toggles[1]!.getAttribute('aria-controls'));
  },
};

export const SlotStyling: Story = {
  args: {
    sx: { rowGap: vars.space[8] },
    slotProps: {
      chip: { css: { borderStyle: 'dashed' } },
      title: { css: { textDecoration: 'underline' } },
    },
  },
  play: async ({ canvasElement, canvas, userEvent }) => {
    const root = canvasElement.querySelector<HTMLElement>('[data-ui="link-unfurl"]')!;
    await expect(getComputedStyle(root).rowGap).toBe('32px');
    await pasteInto(field(canvasElement), GUIDE, userEvent);
    await expect(getComputedStyle(items(canvasElement)[0]!).borderTopStyle).toBe('dashed');
    const title = await canvas.findByRole('link', { name: 'Design guide' });
    await expect(getComputedStyle(title).textDecorationLine).toBe('underline');
  },
};

export const RefTarget: Story = {
  args: { ref: fn() },
  render: (args) => <LinkUnfurl {...args} />,
  play: async ({ args, canvasElement }) => {
    const root = canvasElement.querySelector('[data-ui="link-unfurl"]');
    await expect(root).toBeInstanceOf(HTMLDivElement);
    await expect(args.ref).toHaveBeenCalledWith(root);
  },
};

export const ResolveWhileFocused: Story = {
  render: (args) => <Demo {...args} outcome="manual" />,
  play: async ({ canvasElement, canvas, userEvent }) => {
    await pasteInto(field(canvasElement), GUIDE, userEvent);
    await userEvent.click(canvas.getByRole('button', { name: 'Mark latest pending' }));
    const title = canvas.getByRole('link', { name: GUIDE });
    title.focus();
    await fireEvent.click(canvas.getByRole('button', { name: 'Resolve latest request' }));
    await expect(await canvas.findByRole('link', { name: 'Design guide' })).toBe(title);
    await expect(title.ownerDocument.activeElement).toBe(title);
    await expect(items(canvasElement)[0]).toHaveAttribute('data-status', 'ready');
  },
};

export const UnsafeMetadata: Story = {
  args: { slotProps: { title: { target: '_BLANK', rel: 'nofollow' } } },
  render: (args) => (
    <Demo
      {...args}
      autoExpand
      metadataFor={() => ({
        title: '<script>alert(1)</script>',
        description: '<img src=x onerror=alert(1)>',
        url: 'javascript:alert(1)',
        image: { src: 'data:image/svg+xml,<svg/>', alt: 'Unsafe image' },
        favicon: 'javascript:alert(1)',
      })}
    />
  ),
  play: async ({ canvasElement, canvas, userEvent }) => {
    await pasteInto(field(canvasElement), GUIDE, userEvent);
    const title = await canvas.findByRole('link', { name: '<script>alert(1)</script>' });
    await expect(title).toHaveAttribute('href', GUIDE);
    await expect(title.getAttribute('rel')).toContain('noopener noreferrer');
    await expect(title.getAttribute('rel')).toContain('nofollow');
    await expect(canvasElement.querySelector('[data-ui="link-unfurl-item"] img')).toBeNull();
    await expect(canvasElement.querySelector('[data-ui="link-unfurl-card"]')).toHaveTextContent(
      '<img src=x onerror=alert(1)>',
    );
  },
};

export const InternationalUrls: Story = {
  args: { dir: 'rtl' },
  render: (args) => <Demo {...args} autoExpand metadataFor={() => ({ title: 'International page' })} />,
  play: async ({ canvasElement, canvas, args, userEvent }) => {
    const urls = ['https://münich.example/guide_(test)', 'https://example.org/mañana'];
    await pasteInto(field(canvasElement), urls.join(' '), userEvent);
    await expect(args.onPreviewRequest).toHaveBeenCalledTimes(2);
    const links = await canvas.findAllByRole('link', { name: 'International page' });
    for (const [index, link] of links.entries()) {
      await expect(link).toHaveAttribute('href', new URL(urls[index]!).href);
    }
    await expect(canvasElement.querySelector('[data-ui="link-unfurl-item"] bdi[dir="ltr"]')).toHaveTextContent(
      'xn--mnich-kva.example',
    );
  },
};

export const LongCopy: Story = {
  render: (args) => (
    <Demo
      {...args}
      autoExpand
      metadataFor={() => ({
        title: 'A long title with enough words to wrap without hiding content '.repeat(4),
        description: 'A detailed description with an unbroken address: ' + GUIDE + '/long-path'.repeat(30),
      })}
    />
  ),
  play: async ({ canvasElement, userEvent }) => {
    await pasteInto(field(canvasElement), GUIDE, userEvent);
    await settle();
    const root = canvasElement.querySelector<HTMLElement>('[data-ui="link-unfurl"]')!;
    await expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth + 1);
  },
};
