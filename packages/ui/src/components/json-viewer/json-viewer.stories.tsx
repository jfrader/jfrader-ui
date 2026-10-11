import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { vars } from '@jfrader/tokens/vars';
import { expect, fn, waitFor, within } from 'storybook/test';
import { css } from '../../styling/css';
import { withLightTheme } from '../../testing/story-decorators';
import { Button } from '../button';
import { JsonViewer, type JsonValue, type JsonViewerProps } from './index';

const payload: JsonValue = {
  active: false,
  count: 0,
  empty: '',
  missing: null,
  user: { name: 'Ada', roles: ['reader', 'writer'] },
  'a.b': { 'quoted"key': 'value' },
};
const array = Array.from({ length: 12 }, (_, index) => `record ${index}`);
const object = Object.fromEntries(array.map((value, index) => [`key${index}`, value]));
const snippet =
  '<JsonViewer data={{ active: false, count: 0 }} defaultExpandDepth={2} aria-label="Webhook payload" />';
const meta = {
  title: 'Components/JsonViewer',
  component: JsonViewer,
  tags: ['autodocs'],
  args: { data: payload, 'aria-label': 'Webhook payload' },
  parameters: {
    layout: 'padded',
    docs: {
      source: { code: snippet },
      description: {
        component:
          'Read-only strict JSON inspector. Cycles, accessors, unsupported values and nonfinite numbers are rejected. Value copy uses pretty JSON, including quoted strings; paths use dot identifiers and JSON-escaped brackets. Expansion, search query and current path each support controlled/default/callback props. Search overlays ancestor expansion and pages; clearing restores base state. Arrays and objects are paged, not virtualized, and are not intended for arbitrary multi-megabyte input. Each expanded treeitem owns its child group via aria-owns (flattened DOM sibling; names stay scoped to labels); roving DOM focus uses the TreeView contract: Up/Down clamp, Right opens/enters, Left closes/parents (also in RTL), Home/End, Enter/Space, 500ms typeahead. / opens search; Ctrl/Cmd+C copies value, +Shift copies path. Environment stories are structural fixtures; actual media emulation and screen-reader checks are separate QA gates.',
      },
    },
    a11y: { test: 'error' },
  },
} satisfies Meta<typeof JsonViewer>;
export default meta;
type Story = StoryObj<typeof meta>;

const item = (canvasElement: HTMLElement, name: RegExp) =>
  within(canvasElement).getByRole('treeitem', { name });
const expectFocus = async (canvasElement: HTMLElement, target: HTMLElement) => {
  await expect(canvasElement.ownerDocument.activeElement).toBe(target);
};
async function withClipboard(
  canvasElement: HTMLElement,
  writeText: ((text: string) => Promise<void>) | null,
  run: () => Promise<void>,
) {
  const navigator = canvasElement.ownerDocument.defaultView!.navigator;
  const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: writeText ? { writeText } : undefined,
  });
  try {
    await run();
  } finally {
    if (original) Object.defineProperty(navigator, 'clipboard', original);
    else Reflect.deleteProperty(navigator, 'clipboard');
  }
}

const expectOwnedGroups = async (canvasElement: HTMLElement) => {
  // Flattened structure: each expanded treeitem OWNS a DOM-sibling role=group via aria-owns, and
  // every treeitem's accessible name is scoped to its label span (no subtree bleed).
  for (const group of within(canvasElement).getAllByRole('group')) {
    if (group.getAttribute('data-ui') === 'json-viewer-invalid') continue;
    const owner = canvasElement.querySelector(`[role="treeitem"][aria-owns="${group.id}"]`);
    await expect(owner).not.toBeNull();
    await expect(Number(owner!.getAttribute('aria-level')) + 1).toBe(
      Number(group.querySelector('[role="treeitem"]')!.getAttribute('aria-level')),
    );
  }
  await expect(canvasElement.querySelectorAll('[role="treeitem"] [role="group"]')).toHaveLength(0);
  for (const row of within(canvasElement).getAllByRole('treeitem')) {
    await expect(row).toHaveAttribute('aria-labelledby');
  }
};

export const Default: Story = {
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole('tree', { name: 'Webhook payload' })).toBeInTheDocument();
    for (const name of [/^active: false/, /^count: 0/, /^empty: ""/, /^missing: null/]) {
      await expect(canvas.getByRole('treeitem', { name })).not.toHaveAttribute('aria-expanded');
    }
    await expect(canvasElement.querySelectorAll('[role="treeitem"][tabindex="0"]')).toHaveLength(1);
    await expect(canvas.getAllByRole('group')).toHaveLength(1);
    await expectOwnedGroups(canvasElement);
    for (const row of canvas.getAllByRole('treeitem')) {
      // The accessible name is scoped to the label; without aria-labelledby the nested group's
      // content bleeds into the name (role=group is not name-from-content, treeitem is).
      await expect(row).toHaveAttribute('aria-labelledby');
      await expect(
        row.querySelector('[data-ui="json-viewer-row"]')!.getBoundingClientRect().height,
      ).toBeGreaterThanOrEqual(32);
    }
    const branch = canvasElement.querySelector('[role="treeitem"][aria-expanded="true"]') as HTMLElement;
    const branchLabel = branch.querySelector('[data-ui="json-viewer-label"]')!.textContent!.trim();
    await expect(canvas.getByRole('treeitem', { name: branchLabel })).toBe(branch);
    await expect(canvasElement.querySelector('[data-ui="json-viewer-status"]')).toBeEmptyDOMElement();
  },
};
export const PrimitiveRoots: Story = {
  render: (args) => (
    <div>
      {[false, null, 0, ''].map((data, index) => (
        <JsonViewer {...args} key={index} data={data} aria-label={`Primitive ${index}`} />
      ))}
    </div>
  ),
  play: async ({ canvas }) => {
    for (const name of [/^root: false/, /^root: null/, /^root: 0/, /^root: ""/])
      await expect(canvas.getByRole('treeitem', { name })).toBeInTheDocument();
    await expect(canvas.getAllByRole('tree')).toHaveLength(4);
  },
};
export const Sizes: Story = {
  render: (args) => (
    <div>
      <JsonViewer {...args} size="sm" />
      <JsonViewer {...args} size="md" />
    </div>
  ),
};
export const Nested: Story = {
  args: { defaultExpandDepth: 3 },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getAllByRole('group')).toHaveLength(4);
    await expectOwnedGroups(canvasElement);
  },
};
export const SearchExpanded: Story = { args: { defaultQuery: 'writer' } };
export const AllExpanded: Story = { args: { defaultExpandDepth: 10 } };
export const Search: Story = {
  args: {
    data: { alpha: { needle: 'Needle value' }, beta: ['ordinary', 'needle two'], 'a.b': 'needle three' },
    defaultExpandedValue: [],
    onQueryChange: fn(),
    onExpandedValueChange: fn(),
    onValueChange: fn(),
  },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const search = canvas.getByRole('textbox', { name: 'Search JSON' });
    await userEvent.type(search, 'needle');
    await expect(canvas.getAllByRole('treeitem')).toHaveLength(7);
    await expect(canvasElement.querySelectorAll('mark')).toHaveLength(4);
    await expect(canvasElement.querySelector('[data-ui="json-viewer-match-status"]')).toHaveTextContent(
      '0 / 3',
    );
    await userEvent.keyboard('{Enter}');
    await expectFocus(canvasElement, search);
    await expect(canvasElement.querySelector('[data-ui="json-viewer-path"]')).toHaveTextContent(
      'root.alpha.needle',
    );
    await userEvent.keyboard('{Shift>}{Enter}{/Shift}');
    await expect(canvasElement.querySelector('[data-ui="json-viewer-path"]')).toHaveTextContent(
      'root["a.b"]',
    );
    await userEvent.keyboard('{Enter}');
    await expect(canvasElement.querySelector('[data-ui="json-viewer-path"]')).toHaveTextContent(
      'root.alpha.needle',
    );
    await expect(args.onValueChange).toHaveBeenCalledTimes(3);
    await userEvent.keyboard('{Escape}');
    await expect(search).toHaveValue('');
    await expect(canvas.getAllByRole('treeitem')).toHaveLength(1);
    await expect(args.onExpandedValueChange).not.toHaveBeenCalled();
  },
};
export const SearchTruncated: Story = {
  args: { data: array, defaultQuery: 'record', maxMatches: 3, pageSize: 2 },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[data-ui="json-viewer-match-status"]')).toHaveTextContent(
      '0 / 3+',
    );
  },
};
export const PagingArray: Story = {
  args: { data: array, pageSize: 3, onValueChange: fn() },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const more = canvas.getByRole('treeitem', { name: 'Show more (9 remaining)' });
    await expect(more).toHaveAttribute('aria-setsize', '4');
    await expect(more).not.toHaveAttribute('aria-selected');
    await expect(more).not.toHaveAttribute('aria-expanded');
    await userEvent.click(more);
    await expectFocus(canvasElement, item(canvasElement, /^3:/));
    await expect(canvas.getByRole('treeitem', { name: 'Show more (6 remaining)' })).toBeInTheDocument();
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith('root[3]');
    await userEvent.keyboard('{End}{Enter}');
    await expectFocus(canvasElement, item(canvasElement, /^6:/));
    await userEvent.keyboard('{End} ');
    await expectFocus(canvasElement, item(canvasElement, /^9:/));
    await expect(canvas.queryByRole('treeitem', { name: /Show more/ })).not.toBeInTheDocument();
  },
};
export const PagingObject: Story = { args: { data: object, pageSize: 3 } };
export const NoSearch: Story = { args: { searchable: false } };
export const NoCopy: Story = {
  args: { copyable: false },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const write = fn(async () => {});
    await withClipboard(canvasElement, write, async () => {
      await userEvent.click(canvas.getByRole('treeitem', { name: /^count:/ }));
      await userEvent.keyboard('{Control>}c{/Control}');
      await expect(write).not.toHaveBeenCalled();
      await expect(canvas.queryByRole('button', { name: 'Copy value' })).not.toBeInTheDocument();
    });
  },
};
export const NoPath: Story = { args: { showPath: false } };
function ControlledViewer(args: JsonViewerProps) {
  const [expanded, setExpanded] = useState<readonly string[]>(['root']);
  const [query, setQuery] = useState('');
  const [value, setValue] = useState('root');
  return (
    <JsonViewer
      {...args}
      expandedValue={expanded}
      query={query}
      value={value}
      onExpandedValueChange={(next) => {
        args.onExpandedValueChange?.(next);
        setExpanded(next);
      }}
      onQueryChange={(next) => {
        args.onQueryChange?.(next);
        setQuery(next);
      }}
      onValueChange={(next) => {
        args.onValueChange?.(next);
        setValue(next);
      }}
    />
  );
}
export const Controlled: Story = {
  render: (args) => <ControlledViewer {...args} />,
  args: { onExpandedValueChange: fn(), onQueryChange: fn(), onValueChange: fn() },
  play: async ({ canvas, userEvent, args }) => {
    await expect(args.onExpandedValueChange).not.toHaveBeenCalled();
    await expect(args.onQueryChange).not.toHaveBeenCalled();
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await userEvent.click(canvas.getByRole('treeitem', { name: /^user:/ }));
    await expect(args.onExpandedValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onExpandedValueChange).toHaveBeenCalledWith(['root', 'root.user']);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith('root.user');
    await expect(canvas.getByRole('treeitem', { name: /^user:/ })).toHaveAttribute('aria-expanded', 'true');
    await userEvent.type(canvas.getByRole('textbox'), 'Ada');
    await expect(args.onQueryChange).toHaveBeenCalledTimes(3);
    await expect(canvas.getByRole('textbox')).toHaveValue('Ada');
  },
};
export const RejectedControlled: Story = {
  args: {
    expandedValue: ['root'],
    query: '',
    value: 'root',
    onExpandedValueChange: fn(),
    onQueryChange: fn(),
    onValueChange: fn(),
  },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const user = canvas.getByRole('treeitem', { name: /^user:/ });
    await userEvent.click(user);
    await userEvent.keyboard('{ArrowRight}{ArrowRight}');
    await expect(user).toHaveAttribute('aria-expanded', 'false');
    await expect(user).toHaveAttribute('aria-selected', 'false');
    await expectFocus(canvasElement, user);
    await expect(args.onExpandedValueChange).toHaveBeenCalledTimes(3);
    for (const call of [1, 2, 3])
      await expect(args.onExpandedValueChange).toHaveBeenNthCalledWith(call, ['root', 'root.user']);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith('root.user');
    await userEvent.type(canvas.getByRole('textbox'), 'xx');
    await expect(args.onQueryChange).toHaveBeenCalledTimes(2);
    await expect(args.onQueryChange).toHaveBeenNthCalledWith(1, 'x');
    await expect(args.onQueryChange).toHaveBeenNthCalledWith(2, 'x');
    await expect(canvas.getByRole('textbox')).toHaveValue('');
  },
};
const cycle: Record<string, unknown> = {};
cycle.self = cycle;
const getter = fn(() => 'do not execute');
const accessor = Object.defineProperty({}, 'secret', { enumerable: true, get: getter });
const invalidValues = [cycle, accessor, undefined, BigInt(1), NaN, Infinity, { nested: undefined }, [, 1]];
export const InvalidData: Story = {
  render: (args) => (
    <div>
      {invalidValues.map((data, index) => (
        <JsonViewer {...args} key={index} data={data as JsonValue} />
      ))}
    </div>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getAllByText('Invalid JSON data')).toHaveLength(invalidValues.length);
    await expect(getter).not.toHaveBeenCalled();
    await expect(canvas.queryByRole('tree')).not.toBeInTheDocument();
  },
};
export const LongKeys: Story = {
  args: {
    data: { ['longKey'.repeat(20)]: 'Long value '.repeat(30), 'arbitrary["key"]': { value: 0 } },
    defaultExpandDepth: 3,
  },
  render: (args) => (
    <div style={{ maxInlineSize: '28rem' }}>
      <JsonViewer {...args} />
    </div>
  ),
};
export const EmptyContainers: Story = { args: { data: { object: {}, array: [] } } };
const typedPayload: JsonValue = {
  text: 'Ada',
  total: 1234.5,
  enabled: true,
  missing: null,
  tags: ['a'],
  meta: { id: 1 },
};
const tokenColor = (anchor: HTMLElement, color: string) => {
  const probe = anchor.ownerDocument.createElement('span');
  probe.style.color = color;
  anchor.append(probe);
  const value = anchor.ownerDocument.defaultView!.getComputedStyle(probe).color;
  probe.remove();
  return value;
};
const typeColorsPlay: Story['play'] = async ({ canvas, canvasElement }) => {
  const root = canvasElement.querySelector<HTMLElement>('[data-ui="json-viewer"]')!;
  const view = canvasElement.ownerDocument.defaultView!;
  const expected = {
    string: vars.color.accentText,
    number: vars.color.textMuted,
    boolean: vars.color.warning,
    null: vars.color.textMuted,
  };
  for (const [type, color] of Object.entries(expected)) {
    const value = root.querySelector<HTMLElement>(`[data-ui="json-viewer-value"][data-type="${type}"]`)!;
    await expect(view.getComputedStyle(value).color).toBe(tokenColor(root, color));
  }
  await expect(view.getComputedStyle(root.querySelector('[data-type="null"]')!).fontStyle).toBe('italic');
  await expect(view.getComputedStyle(root.querySelector('[data-type="number"]')!).fontVariantNumeric).toBe(
    'tabular-nums',
  );
  const key = root.querySelector<HTMLElement>('[data-ui="json-viewer-key"]')!;
  await expect(view.getComputedStyle(key).color).toBe(tokenColor(root, vars.color.text));
  await expect(canvas.getByRole('treeitem', { name: 'root: 6 keys' })).toBeInTheDocument();
  await expect(canvas.getByRole('treeitem', { name: 'tags: 1 item' })).toBeInTheDocument();
  await expect(canvas.getByRole('treeitem', { name: 'meta: 1 key' })).toBeInTheDocument();
};
export const TypeColors: Story = {
  args: { data: typedPayload, defaultExpandDepth: 1 },
  play: typeColorsPlay,
};
export const TypeColorsLight: Story = {
  decorators: [withLightTheme],
  globals: { theme: 'light' },
  args: { data: typedPayload, defaultExpandDepth: 1 },
  play: typeColorsPlay,
};
export const CountLabels: Story = {
  args: {
    data: { list: [1, 2], map: {} },
    labels: { count: (count, type) => `${type}:${count}` },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('treeitem', { name: 'list: array:2' })).toBeInTheDocument();
    await expect(canvas.getByRole('treeitem', { name: 'map: object:0' })).toBeInTheDocument();
  },
};
export const LightTheme: Story = {
  decorators: [withLightTheme],
  globals: { theme: 'light' },
  args: { defaultExpandDepth: 3 },
};
export const RTL: Story = {
  args: { dir: 'rtl', data: { branch: { leaf: false } } },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const branch = canvas.getByRole('treeitem', { name: /^branch:/ });
    await userEvent.click(branch);
    await userEvent.keyboard('{ArrowLeft}');
    await expect(branch).toHaveAttribute('aria-expanded', 'false');
    await userEvent.keyboard('{ArrowRight}{ArrowRight}');
    await expectFocus(canvasElement, canvas.getByRole('treeitem', { name: /^leaf:/ }));
    await userEvent.keyboard('{ArrowLeft}');
    await expectFocus(canvasElement, branch);
    await expect(canvasElement.querySelector('[data-ui="json-viewer-details"]')).toHaveAttribute('dir', 'ltr');
    const chip = canvasElement.querySelector('[data-ui="json-viewer-type"]')!;
    await expect(canvasElement.ownerDocument.defaultView!.getComputedStyle(chip).unicodeBidi).toBe('plaintext');
  },
};
export const ForcedColors: Story = {
  args: { defaultExpandDepth: 3 },
  parameters: {
    docs: {
      description: {
        story:
          'Structural fixture for browser QA with forced-colors enabled; this story does not emulate the media query.',
      },
    },
  },
};
export const ReducedMotion: Story = {
  args: { defaultExpandDepth: 3 },
  parameters: {
    docs: {
      description: {
        story:
          'Structural fixture for browser QA with prefers-reduced-motion enabled; this story does not emulate the media query.',
      },
    },
  },
};
export const KeyboardNavigation: Story = {
  args: {
    data: { alpha: { leaf: 0 }, beta: false, bravo: '' },
    onExpandedValueChange: fn(),
    onValueChange: fn(),
    onNodeActivate: fn(),
    onCopy: fn(),
  },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    canvasElement.tabIndex = -1;
    canvasElement.focus();
    await userEvent.tab();
    await expectFocus(canvasElement, canvas.getByRole('textbox'));
    await userEvent.keyboard('{ArrowDown}');
    const root = canvas.getByRole('treeitem', { name: /^root:/ });
    const alpha = canvas.getByRole('treeitem', { name: /^alpha:/ });
    await expectFocus(canvasElement, root);
    await userEvent.keyboard('{ArrowUp}{Home}');
    await expectFocus(canvasElement, root);
    await userEvent.keyboard('{ArrowRight}');
    await expectFocus(canvasElement, alpha);
    await userEvent.keyboard('{ArrowRight}');
    await expect(alpha).toHaveAttribute('aria-expanded', 'true');
    await expect(args.onExpandedValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onExpandedValueChange).toHaveBeenCalledWith(['root', 'root.alpha']);
    await userEvent.keyboard('{ArrowRight}');
    const leaf = canvas.getByRole('treeitem', { name: /^leaf:/ });
    await expectFocus(canvasElement, leaf);
    await userEvent.keyboard('{ArrowRight}{Enter} ');
    await expect(args.onNodeActivate).toHaveBeenCalledTimes(2);
    await expect(args.onNodeActivate).toHaveBeenNthCalledWith(1, {
      path: 'root.alpha.leaf',
      value: 0,
      type: 'number',
    });
    await expect(args.onNodeActivate).toHaveBeenNthCalledWith(2, {
      path: 'root.alpha.leaf',
      value: 0,
      type: 'number',
    });
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}');
    await expect(alpha).toHaveAttribute('aria-expanded', 'false');
    await userEvent.keyboard('{ArrowLeft}');
    await expectFocus(canvasElement, root);
    await userEvent.keyboard('{End}{ArrowDown}');
    await expectFocus(canvasElement, canvas.getByRole('treeitem', { name: /^bravo:/ }));
    await userEvent.keyboard('{Home}b');
    await expectFocus(canvasElement, canvas.getByRole('treeitem', { name: /^beta:/ }));
    await userEvent.keyboard('b');
    await expectFocus(canvasElement, canvas.getByRole('treeitem', { name: /^bravo:/ }));
    const write = fn(async () => {});
    await withClipboard(canvasElement, write, async () => {
      await userEvent.keyboard('{Control>}c{/Control}');
      await expect(write).toHaveBeenNthCalledWith(1, '""');
      await userEvent.keyboard('{Control>}{Shift>}c{/Shift}{/Control}');
      await expect(write).toHaveBeenNthCalledWith(2, 'root.bravo');
      await expect(args.onCopy).toHaveBeenCalledTimes(2);
    });
    await userEvent.keyboard('/');
    await expectFocus(canvasElement, canvas.getByRole('textbox'));
    await userEvent.keyboard('{ArrowDown}');
    await expectFocus(canvasElement, canvas.getByRole('treeitem', { name: /^bravo:/ }));
    const row = canvas
      .getByRole('treeitem', { name: /^bravo:/ })
      .querySelector('[data-ui="json-viewer-row"]')!;
    await expect(canvasElement.ownerDocument.defaultView!.getComputedStyle(row).outlineStyle).not.toBe(
      'none',
    );
    await userEvent.tab({ shift: true });
    await expectFocus(canvasElement, canvas.getByRole('button', { name: 'Copy path' }));
    await userEvent.tab();
    await expectFocus(canvasElement, canvas.getByRole('treeitem', { name: /^bravo:/ }));
    await userEvent.tab();
    await expectFocus(
      canvasElement,
      canvasElement.querySelector('[data-ui="json-viewer-details"]') as HTMLElement,
    );
    canvasElement.removeAttribute('tabindex');
  },
};
export const CopyValueAndPath: Story = {
  args: {
    data: { 'a.b': { 'quoted"key': 'hello' }, number: 1234.5 },
    defaultExpandDepth: 3,
    onCopy: fn(),
    onCopyError: fn(),
  },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const write = fn(async () => {});
    await withClipboard(canvasElement, write, async () => {
      await userEvent.click(canvas.getByRole('treeitem', { name: /^quoted/ }));
      await userEvent.click(canvas.getByRole('button', { name: 'Copy value' }));
      await userEvent.click(canvas.getByRole('button', { name: 'Copy path' }));
      await expect(write).toHaveBeenNthCalledWith(1, '"hello"');
      await expect(write).toHaveBeenNthCalledWith(2, 'root["a.b"]["quoted\\"key"]');
      await expect(args.onCopy).toHaveBeenNthCalledWith(1, {
        kind: 'value',
        path: 'root["a.b"]["quoted\\"key"]',
        text: '"hello"',
      });
      await expect(args.onCopy).toHaveBeenNthCalledWith(2, {
        kind: 'path',
        path: 'root["a.b"]["quoted\\"key"]',
        text: 'root["a.b"]["quoted\\"key"]',
      });
      await userEvent.click(canvas.getByRole('treeitem', { name: /^number:/ }));
      await userEvent.click(canvas.getByRole('button', { name: 'Copy value' }));
      await expect(write).toHaveBeenNthCalledWith(3, '1234.5');
      await expect(args.onCopy).toHaveBeenCalledTimes(3);
      await expect(args.onCopyError).not.toHaveBeenCalled();
      canvas.getByRole('treeitem', { name: /^number:/ }).focus();
      const selection = canvasElement.ownerDocument.getSelection()!;
      const range = canvasElement.ownerDocument.createRange();
      range.selectNodeContents(
        canvas.getByRole('treeitem', { name: /^number:/ }).querySelector('[data-ui="json-viewer-label"]')!,
      );
      selection.removeAllRanges();
      selection.addRange(range);
      await userEvent.keyboard('{Control>}c{/Control}');
      await expect(write).toHaveBeenCalledTimes(3);
      selection.removeAllRanges();
    });
  },
};
export const CopyFailure: Story = {
  args: { onCopy: fn(), onCopyError: fn() },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    await withClipboard(canvasElement, null, async () => {
      await userEvent.click(canvas.getByRole('button', { name: 'Copy value' }));
      await expect(canvasElement.querySelector('[data-ui="json-viewer-status"]')).toHaveTextContent(
        'Copy failed',
      );
      await expect(args.onCopyError).toHaveBeenCalledTimes(1);
    });
    const error = new Error('Permission denied');
    await withClipboard(
      canvasElement,
      fn(async () => {
        throw error;
      }),
      async () => {
        await userEvent.click(canvas.getByRole('button', { name: 'Copy path' }));
        await expect(args.onCopyError).toHaveBeenNthCalledWith(2, { kind: 'path', path: 'root', error });
        await expect(args.onCopy).not.toHaveBeenCalled();
      },
    );
  },
};
export const ExternalAria: Story = {
  args: {
    'aria-label': 'Explicit label',
    'aria-labelledby': 'json-title',
    'aria-describedby': 'json-description unresolved-id',
  },
  render: (args) => (
    <div>
      <h2 id="json-title">Response body</h2>
      <p id="json-description">Webhook response</p>
      <JsonViewer {...args} />
    </div>
  ),
  play: async ({ canvas }) => {
    const tree = canvas.getByRole('tree', { name: 'Response body' });
    await expect(tree).toHaveAttribute('aria-label', 'Explicit label');
    await expect(tree).toHaveAttribute('aria-labelledby', 'json-title');
    await expect(tree).toHaveAttribute('aria-describedby', 'json-description unresolved-id');
  },
};
function ReplacingViewer(args: JsonViewerProps) {
  const [data, setData] = useState<JsonValue>({ branch: { leaf: false }, array: [0, 1, 2, 3] });
  return (
    <div>
      <Button onClick={() => setData({ branch: {}, array: [] })}>Replace data</Button>
      <JsonViewer {...args} data={data} />
    </div>
  );
}
export const Replacement: Story = {
  args: {
    defaultExpandDepth: 3,
    pageSize: 2,
    onExpandedValueChange: fn(),
    onQueryChange: fn(),
    onValueChange: fn(),
  },
  render: (args) => <ReplacingViewer {...args} />,
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('treeitem', { name: /^leaf:/ }));
    const replace = canvas.getByRole('button', { name: 'Replace data' });
    await userEvent.click(replace);
    await expectFocus(canvasElement, replace);
    await expect(canvas.queryByRole('treeitem', { name: /^leaf:/ })).not.toBeInTheDocument();
    await expect(canvasElement.querySelectorAll('[role="treeitem"][tabindex="0"]')).toHaveLength(1);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith('root.branch.leaf');
    const path = canvasElement.querySelector('[data-ui="json-viewer-path"]');
    await expect(path).toHaveTextContent(/^root\.branch$/);
    await userEvent.click(replace);
    await expect(path).toHaveTextContent(/^root\.branch$/);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onExpandedValueChange).not.toHaveBeenCalled();
    await expect(args.onQueryChange).not.toHaveBeenCalled();
  },
};
const submitSpy = fn();
export const InsideForm: Story = {
  args: { defaultQuery: 'writer' },
  render: (args) => (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submitSpy();
      }}
    >
      <JsonViewer {...args} />
    </form>
  ),
  play: async ({ canvas, canvasElement, userEvent }) => {
    submitSpy.mockClear();
    const writeText = fn(async () => {});
    const buttons = canvas.getAllByRole('button');
    await expect(buttons).toHaveLength(6);
    await withClipboard(canvasElement, writeText, async () => {
      for (const button of buttons) {
        await expect(button).toHaveAttribute('type', 'button');
        await userEvent.click(button);
      }
    });
    await expect(writeText).toHaveBeenCalledTimes(2);
    await expect(submitSpy).not.toHaveBeenCalled();
  },
};
const slotRow = css({ minBlockSize: '48px' });
const slotValue = css({ fontWeight: 600 });
const consumer = css({ borderRadius: '20px' });
const override = css({ borderRadius: '24px' });
export const SlotStyles: Story = {
  args: { slotProps: { row: { css: slotRow }, value: { css: slotValue } }, sx: override },
  render: (args) => <JsonViewer {...args} css={consumer} />,
  play: async ({ canvasElement }) => {
    const view = canvasElement.ownerDocument.defaultView!;
    await waitFor(async () => {
      await expect(
        view.getComputedStyle(canvasElement.querySelector('[data-ui="json-viewer"]')!).borderRadius,
      ).toBe('24px');
      await expect(
        view.getComputedStyle(canvasElement.querySelector('[data-ui="json-viewer-row"]')!).minBlockSize,
      ).toBe('48px');
      await expect(
        view.getComputedStyle(canvasElement.querySelector('[data-ui="json-viewer-value"]')!).fontWeight,
      ).toBe('600');
    });
  },
};

export const ExpansionActions: Story = {
  args: { defaultExpandedValue: ['root', 'root'], onExpandedValueChange: fn() },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Collapse all' }));
    await expect(args.onExpandedValueChange).not.toHaveBeenCalled();
    await userEvent.click(canvas.getByRole('button', { name: 'Expand all' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Expand all' }));
    await expect(args.onExpandedValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onExpandedValueChange).toHaveBeenCalledWith([
      'root',
      'root.user',
      'root.user.roles',
      'root["a.b"]',
    ]);
    await userEvent.click(canvas.getByRole('button', { name: 'Collapse all' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Collapse all' }));
    await expect(args.onExpandedValueChange).toHaveBeenCalledTimes(2);
    await expect(args.onExpandedValueChange).toHaveBeenLastCalledWith(['root']);
    await expect(canvas.getAllByRole('group')).toHaveLength(1);
  },
};
export const SearchPagingRestore: Story = {
  args: { data: array, pageSize: 2, onExpandedValueChange: fn() },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('treeitem', { name: 'Show more (10 remaining)' }));
    await userEvent.type(canvas.getByRole('textbox'), 'record 11');
    await expect(canvas.getByRole('treeitem', { name: /^11:/ })).toBeInTheDocument();
    await expect(canvasElement.querySelector('mark')).toHaveTextContent('record 11');
    await userEvent.keyboard('{Escape}');
    await expect(canvas.queryByRole('treeitem', { name: /^11:/ })).not.toBeInTheDocument();
    await expect(canvas.getByRole('treeitem', { name: 'Show more (8 remaining)' })).toBeInTheDocument();
    await expect(args.onExpandedValueChange).not.toHaveBeenCalled();
  },
};
function RemovedFocusViewer(args: JsonViewerProps) {
  const [data, setData] = useState<JsonValue>({ branch: { leaf: false } });
  return (
    <JsonViewer
      {...args}
      data={data}
      onNodeActivate={(detail) => {
        args.onNodeActivate?.(detail);
        setData({ branch: {} });
      }}
    />
  );
}
export const RemovedFocus: Story = {
  render: (args) => <RemovedFocusViewer {...args} />,
  args: { defaultExpandDepth: 3, onValueChange: fn(), onNodeActivate: fn() },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const root = canvas.getByRole('treeitem', { name: /^root:/ });
    root.focus();
    await userEvent.keyboard('{ArrowRight}{ArrowRight}{Enter}');
    await expectFocus(canvasElement, canvas.getByRole('treeitem', { name: /^branch:/ }));
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await expect(args.onValueChange).toHaveBeenNthCalledWith(1, 'root.branch');
    await expect(args.onValueChange).toHaveBeenNthCalledWith(2, 'root.branch.leaf');
    await expect(args.onNodeActivate).toHaveBeenCalledTimes(1);
    await expect(canvasElement.querySelectorAll('[role="treeitem"][tabindex="0"]')).toHaveLength(1);
  },
};
export const ConsumerVeto: Story = {
  args: {
    onKeyDown: fn((event) => event.preventDefault()),
    onClick: fn((event) => event.preventDefault()),
    onExpandedValueChange: fn(),
    onNodeActivate: fn(),
  },
  play: async ({ canvas, userEvent, args }) => {
    const branch = canvas.getByRole('treeitem', { name: /^user:/ });
    await userEvent.click(branch);
    branch.focus();
    await userEvent.keyboard('{ArrowRight}{Enter}');
    await expect(branch).toHaveAttribute('aria-expanded', 'false');
    await expect(args.onExpandedValueChange).not.toHaveBeenCalled();
    await expect(args.onNodeActivate).not.toHaveBeenCalled();
    await expect(args.onKeyDown).toHaveBeenCalledTimes(2);
    await expect(args.onClick).toHaveBeenCalledTimes(1);
  },
};
export const RootRef: Story = {
  args: { ref: fn() },
  play: async ({ canvasElement, args }) => {
    const root = canvasElement.querySelector('[data-ui="json-viewer"]');
    await expect(args.ref).toHaveBeenCalledWith(root);
  },
};

export const SearchManualCollapse: Story = {
  args: {
    data: { branch: { leaf: 'needle' } },
    defaultExpandedValue: [],
    defaultQuery: 'needle',
    onExpandedValueChange: fn(),
  },
  play: async ({ canvas, userEvent, args }) => {
    const branch = canvas.getByRole('treeitem', { name: /^branch:/ });
    await userEvent.click(branch);
    await expect(canvas.queryByRole('treeitem', { name: /^leaf:/ })).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: 'Next match' }));
    await expect(canvas.getByRole('treeitem', { name: /^leaf:/ })).toBeInTheDocument();
    await userEvent.click(canvas.getByRole('textbox'));
    await userEvent.keyboard('{Escape}');
    await expect(canvas.getAllByRole('treeitem')).toHaveLength(1);
    await expect(args.onExpandedValueChange).not.toHaveBeenCalled();
  },
};
export const RawStringSearch: Story = {
  args: { data: { escaped: 'line\n"two"' }, defaultQuery: '"two"' },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('mark')).toHaveTextContent('\\"two\\"');
  },
};
export const UnresolvedLabel: Story = {
  args: { 'aria-label': 'Fallback name', 'aria-labelledby': 'unresolved-json-name' },
  play: async ({ canvas }) => {
    const tree = canvas.getByRole('tree', { name: 'Fallback name' });
    await expect(tree).toHaveAttribute('aria-labelledby', 'unresolved-json-name');
    await expect(tree).toHaveAttribute('aria-label', 'Fallback name');
  },
};

export const EmptyRootName: Story = {
  args: {
    rootName: '',
    data: { leaf: 'needle' },
    defaultExpandedValue: [],
    defaultQuery: 'needle',
    onCopy: fn(),
  },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    await expect(canvas.getByRole('treeitem', { name: /^leaf:/ })).toBeInTheDocument();
    const write = fn(async () => {});
    await withClipboard(canvasElement, write, async () => {
      await userEvent.click(canvas.getByRole('button', { name: 'Copy path' }));
      await expect(write).toHaveBeenCalledTimes(1);
      await expect(write).toHaveBeenCalledWith('');
      await expect(args.onCopy).toHaveBeenCalledWith({ kind: 'path', path: '', text: '' });
    });
  },
};
