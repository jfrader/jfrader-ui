import { StrictMode, useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, waitFor, within } from 'storybook/test';
import { css } from '../../styling/css';
import { withLightTheme } from '../../testing/story-decorators';
import { Button } from '../button';
import { TreeView, type TreeNode, type TreeViewProps } from './index';

const nodes: readonly TreeNode[] = [
  {
    id: 'app',
    label: 'Application',
    children: [
      { id: 'alpha', label: 'Alpha' },
      { id: 'disabled', label: 'Archived', disabled: true },
      {
        id: 'assets',
        label: 'Assets',
        children: [{ id: 'image', label: 'Image' }],
      },
    ],
  },
  { id: 'beta', label: 'Beta' },
  { id: 'écho', label: 'Écho' },
];
const lazyNode: readonly TreeNode[] = [{ id: 'remote', label: 'Remote', hasChildren: true }];
const usage =
  '<TreeView label="Files" nodes={[{ id: "app", label: "Application", children: [{ id: "page", label: "Page" }] }]} defaultOpen={["app"]} />';
const meta = {
  title: 'Components/TreeView',
  component: TreeView,
  tags: ['autodocs'],
  args: { nodes, label: 'Files', onValueChange: fn(), onOpenChange: fn() },
  parameters: {
    layout: 'padded',
    a11y: { test: 'error' },
    docs: {
      source: { code: usage },
      description: {
        component:
          'Browse a tree, expand branches and select one item.',
      },
      usage: `- Selection and expansion can be controlled independently.
- Each parent links to its sibling child group with \`aria-owns\`. Its accessible name contains only its own label.
- Lazy loading starts after expansion is accepted. Collapse or unmount aborts loading. Successful results are cached per instance; remount with a new key to replace the cache.
- Environment stories check structure. Check media preferences and screen readers separately.

### Keyboard
- Up and Down move focus and stop at the ends. Home and End jump to the first and last item.
- Right expands or enters a branch. Left collapses or moves to its parent. These keys stay the same in RTL.
- Enter or Space selects without expanding. Typing searches using the locale, with a 500ms buffer.`,
    },
  },
} satisfies Meta<typeof TreeView>;
export default meta;
type Story = StoryObj<typeof meta>;
const focus = async (element: HTMLElement) => {
  await expect(element.ownerDocument.activeElement).toBe(element);
};
const disclosure = (element: HTMLElement) =>
  element.parentElement!.querySelector<HTMLElement>(':scope > [data-ui="tree-view-disclosure"]')!;

export const Default: Story = {
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole('tree', { name: 'Files' })).toBeInTheDocument();
    await expect(canvasElement.querySelectorAll('[role="treeitem"][tabindex="0"]')).toHaveLength(1);
    await expect(canvas.getByRole('treeitem', { name: 'Beta' })).not.toHaveAttribute(
      'aria-expanded',
    );
  },
};
export const Expanded: Story = {
  args: { defaultOpen: ['app', 'assets'], defaultValue: 'image' },
  play: async ({ canvas, canvasElement }) => {
    const parent = canvas.getByRole('treeitem', { name: 'Application' });
    const group = parent.ownerDocument.getElementById(parent.getAttribute('aria-owns')!)!;
    await expect(group).not.toBeNull();
    await expect(
      within(group as HTMLElement).getByRole('treeitem', { name: 'Alpha' }),
    ).toHaveAttribute('aria-level', '2');
    const image = canvas.getByRole('treeitem', { name: 'Image' });
    await expect(image).toHaveAttribute('aria-level', '3');
    await expect(image).toHaveAttribute('aria-posinset', '1');
    await expect(image).toHaveAttribute('aria-setsize', '1');
    await expect(canvas.getByRole('treeitem', { name: 'Assets' })).toHaveAttribute(
      'aria-posinset',
      '3',
    );
    await expect(canvas.getByRole('treeitem', { name: 'Alpha' })).toHaveAttribute(
      'aria-setsize',
      '3',
    );
    await expect(canvasElement.querySelectorAll('[role="treeitem"][tabindex="0"]')).toHaveLength(1);
  },
};
export const KeyboardFullTree: Story = {
  render: (args) => (
    <>
      <Button>Before tree</Button>
      <TreeView {...args} />
      <Button>After tree</Button>
    </>
  ),
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Before tree' }));
    await userEvent.tab();
    const app = canvas.getByRole('treeitem', { name: 'Application' });
    await focus(app);
    await expect(getComputedStyle(app.parentElement!).outlineStyle).not.toBe('none');
    await userEvent.keyboard('{ArrowUp}{ArrowLeft}');
    await focus(app);
    await userEvent.keyboard('{ArrowRight}');
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenCalledWith(['app']);
    await userEvent.keyboard('{ArrowRight}');
    await focus(canvas.getByRole('treeitem', { name: 'Alpha' }));
    await userEvent.keyboard('{ArrowDown}');
    const assets = canvas.getByRole('treeitem', { name: 'Assets' });
    await focus(assets);
    await userEvent.keyboard('{ArrowRight}{ArrowRight}');
    await focus(canvas.getByRole('treeitem', { name: 'Image' }));
    await userEvent.keyboard('{ArrowLeft}');
    await focus(assets);
    await userEvent.keyboard('{ArrowLeft}');
    await expect(assets).toHaveAttribute('aria-expanded', 'false');
    await userEvent.keyboard('{ArrowLeft}');
    await focus(app);
    await userEvent.keyboard('{End}{ArrowDown}');
    await focus(canvas.getByRole('treeitem', { name: 'Écho' }));
    await userEvent.keyboard('{Home}aa');
    await focus(assets);
    await userEvent.keyboard('b');
    await userEvent.keyboard('{Home}');
    await userEvent.keyboard('{Enter} ');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith('app');
    await expect(app).toHaveAttribute('aria-expanded', 'true');
    await userEvent.tab();
    await focus(canvas.getByRole('button', { name: 'After tree' }));
    await userEvent.tab({ shift: true });
    await focus(app);
    await userEvent.tab({ shift: true });
    await focus(canvas.getByRole('button', { name: 'Before tree' }));
    await expect(canvasElement.querySelectorAll('[role="treeitem"][tabindex="0"]')).toHaveLength(1);
  },
};
function Controlled({ axis, ...args }: TreeViewProps & { axis: 'selection' | 'expansion' }) {
  const [value, setValue] = useState<string | null>(null);
  const [open, setOpen] = useState<readonly string[]>([]);
  return (
    <TreeView
      {...args}
      value={axis === 'selection' ? value : undefined}
      open={axis === 'expansion' ? open : undefined}
      onValueChange={(id) => {
        args.onValueChange?.(id);
        setValue(id);
      }}
      onOpenChange={(ids) => {
        args.onOpenChange?.(ids);
        setOpen(ids);
      }}
    />
  );
}
export const ControlledSelection: Story = {
  render: (args) => <Controlled {...args} axis="selection" />,
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByText('Beta'));
    await expect(canvas.getByRole('treeitem', { name: 'Beta' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await userEvent.keyboard('{Enter}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith('beta');
  },
};
export const ControlledExpansion: Story = {
  render: (args) => <Controlled {...args} axis="expansion" />,
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(disclosure(canvas.getByRole('treeitem', { name: 'Application' })));
    await expect(canvas.getByRole('group')).toBeInTheDocument();
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenCalledWith(['app']);
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};
export const RejectedSelection: Story = {
  args: { value: null },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByText('Beta'));
    await expect(canvas.getByRole('treeitem', { name: 'Beta' })).toHaveAttribute(
      'aria-selected',
      'false',
    );
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith('beta');
  },
};
export const RejectedExpansion: Story = {
  args: { nodes: lazyNode, open: [], loadChildren: fn(async () => []) },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(disclosure(canvas.getByRole('treeitem', { name: 'Remote' })));
    await expect(canvas.queryByRole('group')).not.toBeInTheDocument();
    await expect(args.loadChildren).not.toHaveBeenCalled();
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenCalledWith(['remote']);
  },
};
export const LazyLoading: Story = {
  args: {
    nodes: lazyNode,
    defaultOpen: ['remote'],
    loadChildren: fn(() => new Promise<readonly TreeNode[]>(() => {})),
  },
  play: async ({ canvas }) => {
    await waitFor(async () => {
      await expect(canvas.getByRole('treeitem')).toHaveAttribute('aria-busy', 'true');
    });
  },
};
const failure = new Error('Unavailable');
export const LazyError: Story = {
  args: {
    nodes: lazyNode,
    defaultOpen: ['remote'],
    loadChildren: fn(async () => {
      throw failure;
    }),
    onLoadError: fn(),
  },
  play: async ({ canvas, args }) => {
    await waitFor(async () => {
      await expect(canvas.getByRole('treeitem')).toHaveAttribute('aria-describedby');
    });
    await expect(args.onLoadError).toHaveBeenCalledTimes(1);
    await expect(args.onLoadError).toHaveBeenCalledWith(failure, lazyNode[0]);
    await expect(canvas.getByRole('status')).toHaveTextContent('Could not load Remote');
  },
};
function RetryFixture(args: TreeViewProps) {
  const attempts = useRef(0);
  return (
    <TreeView
      {...args}
      loadChildren={(node, options) => {
        args.loadChildren?.(node, options);
        attempts.current += 1;
        return attempts.current === 1
          ? Promise.reject(failure)
          : Promise.resolve([{ id: 'loaded', label: 'Loaded' }]);
      }}
    />
  );
}
export const Retry: Story = {
  args: {
    nodes: lazyNode,
    defaultOpen: ['remote'],
    loadChildren: fn(async () => []),
    onLoadError: fn(),
  },
  render: (args) => <RetryFixture {...args} />,
  play: async ({ canvas, userEvent, args }) => {
    const remote = canvas.getByRole('treeitem');
    await waitFor(async () => {
      await expect(remote).toHaveAttribute('aria-describedby');
    });
    await userEvent.click(canvas.getByText('Remote'));
    await userEvent.keyboard('{Enter}');
    await canvas.findByRole('treeitem', { name: 'Loaded' });
    await focus(remote);
    await expect(args.loadChildren).toHaveBeenCalledTimes(2);
    await expect(args.onLoadError).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith('remote');
    await userEvent.keyboard('{ArrowRight}');
    await focus(canvas.getByRole('treeitem', { name: 'Loaded' }));
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}{ArrowRight}');
    await expect(args.loadChildren).toHaveBeenCalledTimes(2);
  },
};
function AbortFixture(args: TreeViewProps) {
  const [resolve, setResolve] = useState<(() => void) | null>(null);
  return (
    <>
      <Button onClick={() => resolve?.()}>Complete request</Button>
      <TreeView
        {...args}
        loadChildren={(node, options) => {
          args.loadChildren?.(node, options);
          return new Promise((done) =>
            setResolve(() => () => done([{ id: 'stale', label: 'Stale' }])),
          );
        }}
      />
    </>
  );
}
export const AbortOnCollapse: Story = {
  args: { nodes: lazyNode, loadChildren: fn(async () => []) },
  render: (args) => <AbortFixture {...args} />,
  play: async ({ canvas, userEvent, args }) => {
    const remote = canvas.getByRole('treeitem');
    await userEvent.click(disclosure(remote));
    await waitFor(async () => {
      await expect(args.loadChildren).toHaveBeenCalledTimes(1);
    });
    const signal = (args.loadChildren as ReturnType<typeof fn>).mock.calls[0]![1]
      .signal as AbortSignal;
    await userEvent.keyboard('{ArrowRight}{ArrowRight}');
    await expect(args.loadChildren).toHaveBeenCalledTimes(1);
    await userEvent.keyboard('{ArrowLeft}');
    await waitFor(async () => {
      await expect(signal.aborted).toBe(true);
    });
    await userEvent.click(canvas.getByRole('button'));
    await expect(canvas.queryByRole('treeitem', { name: 'Stale' })).not.toBeInTheDocument();
    await userEvent.click(disclosure(remote));
    await waitFor(async () => {
      await expect(args.loadChildren).toHaveBeenCalledTimes(2);
    });
    await userEvent.click(canvas.getByRole('button'));
    await canvas.findByRole('treeitem', { name: 'Stale' });
  },
};
export const Empty: Story = {
  args: { nodes: [] },
  play: async ({ canvas, userEvent }) => {
    await userEvent.tab();
    await focus(canvas.getByRole('tree'));
  },
};
export const AllDisabled: Story = {
  args: { nodes: [{ id: 'disabled', label: 'Unavailable', disabled: true }] },
  play: async ({ canvas, userEvent }) => {
    await userEvent.tab();
    await focus(canvas.getByRole('tree'));
    await expect(canvas.getByRole('treeitem')).toHaveAttribute('aria-disabled', 'true');
  },
};
export const DisabledNode: Story = {
  args: { defaultOpen: ['app'] },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByText('Archived'));
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await userEvent.click(canvas.getByText('Alpha'));
    await userEvent.keyboard('{ArrowDown}');
    await focus(canvas.getByRole('treeitem', { name: 'Assets' }));
  },
};
export const DeepAndLongLabels: Story = {
  args: {
    nodes: [
      {
        id: 'a',
        label: 'Projects',
        children: [
          {
            id: 'b',
            label: 'Translations',
            children: [
              {
                id: 'c',
                label:
                  'A very long translated category label that wraps without cropping essential text or descenders',
              },
            ],
          },
        ],
      },
    ],
    defaultOpen: ['a', 'b'],
    sx: { maxInlineSize: '20rem' },
  },
};
export const ExternalAria: Story = {
  args: {
    'aria-label': 'Explicit',
    'aria-labelledby': 'tree-heading missing-heading',
    'aria-describedby': 'tree-description missing-description',
  },
  render: (args) => (
    <>
      <h2 id="tree-heading">Categories</h2>
      <p id="tree-description">Choose a category</p>
      <TreeView {...args} />
    </>
  ),
  play: async ({ canvas }) => {
    const tree = canvas.getByRole('tree', { name: 'Categories' });
    await expect(tree).toHaveAttribute('aria-label', 'Explicit');
    await expect(tree).toHaveAttribute('aria-labelledby', 'tree-heading missing-heading');
    await expect(tree).toHaveAttribute('aria-describedby', 'tree-description missing-description');
  },
};
export const DuplicateLabelsUniqueIds: Story = {
  args: {
    nodes: [
      { id: 'a[]"', label: 'Same' },
      { id: 'b.#', label: 'Same' },
    ],
  },
  play: async ({ canvas }) => {
    const items = canvas.getAllByRole('treeitem', { name: 'Same' });
    await expect(items[0]!.getAttribute('aria-labelledby')).not.toBe(
      items[1]!.getAttribute('aria-labelledby'),
    );
  },
};
function Removal(args: TreeViewProps) {
  const [show, setShow] = useState(true);
  return (
    <>
      <Button onClick={() => setShow(false)}>Remove children</Button>
      <TreeView
        {...args}
        nodes={show ? nodes : [{ ...nodes[0]!, children: [] }, ...nodes.slice(1)]}
      />
    </>
  );
}
export const PropRemovalFocus: Story = {
  args: { defaultOpen: ['app'] },
  render: (args) => <Removal {...args} />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByText('Alpha'));
    const button = canvas.getByRole('button');
    await userEvent.click(button);
    await focus(button);
    await expect(canvas.queryByRole('treeitem', { name: 'Alpha' })).not.toBeInTheDocument();
  },
};
export const ZeroIcon: Story = {
  args: {
    nodes: [false, null, 0, ''].map((icon, index) => ({
      id: String(index),
      label: `Item ${index}`,
      icon,
    })),
  },
  play: async ({ canvasElement }) => {
    const icons = canvasElement.querySelectorAll('[data-ui="tree-view-icon"]');
    await expect(icons).toHaveLength(2);
    await expect(icons[0]).toHaveTextContent('0');
  },
};
export const FalsyEmpty: Story = {
  render: (args) => (
    <>
      {[false, null, 0, ''].map((empty, index) => (
        <TreeView {...args} key={index} nodes={[]} empty={empty} />
      ))}
    </>
  ),
  play: async ({ canvasElement }) => {
    await expect(canvasElement).toHaveTextContent('0');
  },
};
export const ConsumerStylePrecedence: Story = {
  args: {
    sx: { padding: '16px' },
    slotProps: {
      row: { css: css({ minBlockSize: '48px' }) },
      label: { css: css({ fontWeight: 700 }) },
    },
  },
  render: (args) => <TreeView {...args} css={css({ padding: '12px' })} />,
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('[data-ui="tree-view"]')!;
    await expect(Math.abs(parseFloat(getComputedStyle(root).paddingTop) - 16)).toBeLessThan(1.1);
    const row = canvasElement.querySelector('[data-ui="tree-view-row"]')!;
    await expect(row.getBoundingClientRect().height).toBeGreaterThanOrEqual(47);
    await expect(
      getComputedStyle(canvasElement.querySelector('[data-ui="tree-view-label"]')!).fontWeight,
    ).toBe('700');
  },
};
export const LightTheme: Story = {
  ...Expanded,
  decorators: [withLightTheme],
  globals: { theme: 'light' },
};
export const RTL: Story = {
  args: { dir: 'rtl' },
  play: async ({ canvas, userEvent }) => {
    await userEvent.tab();
    await userEvent.keyboard('{ArrowRight}{ArrowRight}');
    await focus(canvas.getByRole('treeitem', { name: 'Alpha' }));
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}');
    await expect(canvas.getByRole('treeitem', { name: 'Application' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  },
};
export const ForcedColors: Story = {
  args: { defaultOpen: ['app'], defaultValue: 'alpha' },
  play: async ({ canvas, canvasElement }) => {
    const parent = canvas.getByRole('treeitem', { name: 'Application' });
    const caret = getComputedStyle(disclosure(parent), '::after');
    const forced = canvasElement.ownerDocument.defaultView!.matchMedia(
      '(forced-colors: active)',
    ).matches;
    await expect(caret.borderTopColor).toBe('rgba(0, 0, 0, 0)');
    await expect(caret.borderBottomColor).toBe('rgba(0, 0, 0, 0)');
    if (forced) await expect(caret.forcedColorAdjust).toBe('none');
    await expect(canvas.getByRole('treeitem', { name: 'Alpha' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  },
};
export const ReducedMotion: Story = { args: { defaultOpen: ['app'] } };
export const EmptyLoadedChildren: Story = {
  args: {
    nodes: lazyNode,
    defaultOpen: ['remote'],
    loadChildren: fn(async () => []),
  },
  play: async ({ canvas, args }) => {
    await waitFor(async () => {
      await expect(canvas.getByRole('treeitem')).not.toHaveAttribute('aria-expanded');
    });
    await expect(args.loadChildren).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).not.toHaveBeenCalled();
  },
};

export const TypeaheadLocale: Story = {
  args: { locale: 'fr' },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.tab();
    await userEvent.keyboard('e');
    await focus(canvas.getByRole('treeitem', { name: 'Écho' }));
    await userEvent.keyboard('e');
    await focus(canvas.getByRole('treeitem', { name: 'Écho' }));
    await userEvent.keyboard('{Control>}a{/Control}');
    await focus(canvas.getByRole('treeitem', { name: 'Écho' }));
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};
export const TypeaheadBuffer: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.tab();
    await userEvent.keyboard('bet');
    await focus(canvas.getByRole('treeitem', { name: 'Beta' }));
  },
};
export const SpaceActivation: Story = {
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.tab();
    await userEvent.keyboard(' ');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenCalledWith('app');
    await expect(canvas.getByRole('treeitem', { name: 'Application' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  },
};
export const HiddenSelection: Story = {
  args: { defaultValue: 'alpha' },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.tab();
    const app = canvas.getByRole('treeitem', { name: 'Application' });
    await focus(app);
    await expect(canvasElement.querySelector('[aria-selected="true"]')).toBeNull();
    await userEvent.keyboard('{ArrowRight}{ArrowRight}');
    const alpha = canvas.getByRole('treeitem', { name: 'Alpha' });
    await focus(alpha);
    await expect(alpha).toHaveAttribute('aria-selected', 'true');
  },
};
export const RefTargets: Story = {
  args: { ref: fn(), treeRef: fn() },
  play: async ({ canvas, canvasElement, args }) => {
    const wrapper = canvasElement.querySelector('[data-ui="tree-view"]');
    await expect(args.ref).toHaveBeenCalledWith(wrapper);
    await expect(args.treeRef).toHaveBeenCalledWith(canvas.getByRole('tree'));
  },
};
export const TargetsAndGuides: Story = {
  args: { defaultOpen: ['app'] },
  play: async ({ canvasElement }) => {
    for (const row of canvasElement.querySelectorAll('[data-ui="tree-view-row"]')) {
      await expect(row.getBoundingClientRect().height).toBeGreaterThanOrEqual(31);
    }
    for (const caret of canvasElement.querySelectorAll('[data-ui="tree-view-disclosure"]')) {
      await expect(caret.getBoundingClientRect().width).toBeGreaterThanOrEqual(31);
      await expect(caret.getBoundingClientRect().height).toBeGreaterThanOrEqual(31);
    }
    const group = canvasElement.querySelector('[data-ui="tree-view-group"]')!;
    await expect(getComputedStyle(group, '::before').borderInlineStartStyle).toBe('solid');
  },
};
export const PreventedEvents: Story = {
  args: {
    onKeyDown: (event) => event.preventDefault(),
    onClick: (event) => event.preventDefault(),
  },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.tab();
    await userEvent.keyboard('{ArrowRight}{Enter} ');
    await userEvent.click(canvas.getByText('Beta'));
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(args.onOpenChange).not.toHaveBeenCalled();
  },
};
function UnmountFixture(args: TreeViewProps) {
  const [mounted, setMounted] = useState(true);
  return (
    <>
      <Button onClick={() => setMounted(false)}>Unmount tree</Button>
      {mounted && <TreeView {...args} />}
    </>
  );
}
export const AbortOnUnmount: Story = {
  args: {
    nodes: lazyNode,
    defaultOpen: ['remote'],
    loadChildren: fn(() => new Promise<readonly TreeNode[]>(() => {})),
  },
  render: (args) => <UnmountFixture {...args} />,
  play: async ({ canvas, userEvent, args }) => {
    await waitFor(async () => {
      await expect(args.loadChildren).toHaveBeenCalledTimes(1);
    });
    const signal = (args.loadChildren as ReturnType<typeof fn>).mock.calls[0]![1]
      .signal as AbortSignal;
    await userEvent.click(canvas.getByRole('button'));
    await expect(signal.aborted).toBe(true);
  },
};
function FocusRemovalFixture(args: TreeViewProps) {
  const [currentNodes, setCurrentNodes] = useState(nodes);
  return (
    <TreeView
      {...args}
      nodes={currentNodes}
      onKeyDown={(event) => {
        if (event.key === 'Delete')
          setCurrentNodes([{ ...nodes[0]!, children: [] }, ...nodes.slice(1)]);
      }}
    />
  );
}
export const RemovedSubtreeFocus: Story = {
  args: { defaultOpen: ['app'] },
  render: (args) => <FocusRemovalFixture {...args} />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.tab();
    await userEvent.keyboard('{ArrowRight}');
    await focus(canvas.getByRole('treeitem', { name: 'Alpha' }));
    await userEvent.keyboard('{Delete}');
    await focus(canvas.getByRole('treeitem', { name: 'Application' }));
    await expect(canvasElement.querySelectorAll('[role="treeitem"][tabindex="0"]')).toHaveLength(1);
  },
};

export const StrictRefCleanup: Story = {
  args: { ref: fn(() => fn()), treeRef: fn(() => fn()) },
  render: (args) => (
    <StrictMode>
      <UnmountFixture {...args} />
    </StrictMode>
  ),
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const rootRef = args.ref as ReturnType<typeof fn>;
    const treeRef = args.treeRef as ReturnType<typeof fn>;
    await expect(rootRef.mock.calls.at(-1)?.[0]).toBe(
      canvasElement.querySelector('[data-ui="tree-view"]'),
    );
    await expect(treeRef.mock.calls.at(-1)?.[0]).toBe(canvas.getByRole('tree'));
    const rootCleanup = rootRef.mock.results.at(-1)!.value;
    const treeCleanup = treeRef.mock.results.at(-1)!.value;
    await userEvent.click(canvas.getByRole('button'));
    await expect(rootCleanup).toHaveBeenCalledTimes(1);
    await expect(treeCleanup).toHaveBeenCalledTimes(1);
  },
};
