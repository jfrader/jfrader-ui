import { Component, useState, type ComponentPropsWithRef, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fireEvent, fn, mocked, userEvent, waitFor } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
// `styled` is the app-facing styling API; consumers import it from `@jfrader/ui`.
import { styled } from '../../index';
import { withLightTheme } from '../../testing/story-decorators';
import {
  ResizablePanels,
  type ResizablePanelsCompoundProps,
  type ResizablePanelsEasyProps,
  type ResizablePanelsPanelItem,
  type ResizablePanelsProps,
} from './index';

const Frame = styled.div({
  inlineSize: '24rem',
  maxInlineSize: '100%',
  blockSize: '12rem',
});
const PaneContent = styled.div({
  display: 'grid',
  alignContent: 'start',
  gap: vars.space[2],
  padding: vars.space[3],
});
const List = styled.ul({ margin: 0, paddingInlineStart: vars.space[4] });
const Text = styled.p({ margin: 0 });
const SmallFrame = styled.div({ inlineSize: '12rem' });
const ControlStack = styled.div({ display: 'grid', gap: vars.space[2], blockSize: '100%' });
const LabelledFrame = styled.div({ display: 'grid', gridTemplateRows: 'auto auto 1fr', blockSize: '100%' });
const FixtureButton = styled.button({
  minBlockSize: vars.space[8],
  minInlineSize: vars.space[8],
  paddingInline: vars.space[2],
  font: 'inherit',
});

function Folders({ onHide }: { onHide?: () => void }) {
  return (
    <PaneContent>
      <List>
        <li>Inbox</li>
        <li>Archive</li>
      </List>
      {onHide && (
        <FixtureButton type="button" onClick={onHide}>
          Hide
        </FixtureButton>
      )}
    </PaneContent>
  );
}

function Messages() {
  return (
    <PaneContent>
      <Text>Select a conversation</Text>
    </PaneContent>
  );
}

const PANELS: readonly ResizablePanelsPanelItem[] = [
  { value: 'folders', label: 'Folders', minSize: 96, collapsible: true, content: <Folders /> },
  { value: 'messages', label: 'Messages', content: <Messages /> },
];

const snippet = `<ResizablePanels
  label="Mail"
  panels={[
    { value: 'folders', label: 'Folders', minSize: 96, collapsible: true, content: <Folders /> },
    { value: 'messages', label: 'Messages', content: <Messages /> },
  ]}
  defaultValue={[30, 70]}
/>`;

const meta: Meta<ResizablePanelsCompoundProps> = {
  title: 'Layout/ResizablePanels',
  component: ResizablePanels,
  tags: ['autodocs'],
  args: {
    'aria-label': 'Mail',
    defaultValue: [30, 70],
    locale: 'en-US',
    onValueChange: fn(),
    onValueCommit: fn(),
  },
  decorators: [
    (Story) => (
      <Frame>
        <Story />
      </Frame>
    ),
  ],
  render: (args) => (
    <ResizablePanels {...args}>
      <ResizablePanels.Panel value="folders" aria-label="Folders" minSize={96} collapsible>
        <Folders />
      </ResizablePanels.Panel>
      <ResizablePanels.Panel value="messages" aria-label="Messages">
        <Messages />
      </ResizablePanels.Panel>
    </ResizablePanels>
  ),
  parameters: {
    docs: {
      sections: [
        { title: 'Basic', stories: ['Default', 'Compound'] },
        { title: 'Sizes', stories: ['MinMax'] },
        { title: 'Controlled', stories: ['EasyModeControlled'] },
        { title: 'Collapse', stories: ['Collapsible'] },
        { title: 'Keyboard', stories: ['KeyboardNavigation'] },
        { title: 'Composition', stories: ['ThreePanels', 'NestedGroups'] },
      ],
      source: {
        code: snippet,
      },
      description: {
        component:
          'Resize or collapse side-by-side panels by dragging a separator or using the keyboard.',
      },
      usage: `### When to use
Let people divide horizontal workspace between adjacent panes. Give the group a definite height and each pane an accessible name.

### Values and constraints

When minimum widths do not fit, they shrink together. Space beyond all maximum widths stays empty. Collapsed content stays mounted but inert.

### Keyboard and accessibility

Focus a separator with Tab. Left/Right moves it 16px in screen direction; Shift moves it 64px. At a limit, another press collapses a collapsible pane, and pressing back restores it. Home/End reaches the smallest/largest open size; Enter collapses or restores. Ctrl/Meta+Home or double-click resets the initial layout. Escape cancels a drag without committing it.

### Localization

Percentages follow the selected locale. Translate any custom state wording used for the accessible value text.`,
    },
  },
};
export default meta;
type Story = StoryObj<(props: ResizablePanelsCompoundProps) => ReactNode>;
type EasyStory = StoryObj<(props: ResizablePanelsEasyProps) => ReactNode>;

type CheckedResizablePanels<Props extends ResizablePanelsProps> = Props;
export type ResizablePanelsTypeRegression = {
  // @ts-expect-error Panels and children are mutually exclusive.
  panelsWithChildren: CheckedResizablePanels<{ panels: typeof PANELS; children: ReactNode }>;
  // @ts-expect-error Compound mode rejects label.
  childrenWithLabel: CheckedResizablePanels<{ label: string; children: ReactNode }>;
  // @ts-expect-error Compound mode rejects slots.
  childrenWithSlots: CheckedResizablePanels<{ slots: { panel?: () => null }; children: ReactNode }>;
  // @ts-expect-error Compound mode rejects component.
  childrenWithComponent: CheckedResizablePanels<{ component: () => null; children: ReactNode }>;
};


function Pane({ children }: { children: ReactNode }) {
  return (
    <PaneContent>
      <Text>{children}</Text>
    </PaneContent>
  );
}

const panelsOf = (scope: ParentNode) =>
  Array.from(scope.querySelectorAll<HTMLElement>(':scope > [data-ui="resizable-panels-panel"]'));
const rootOf = (element: HTMLElement) => element.querySelector<HTMLElement>('[data-ui="resizable-panels"]')!;
const widthOf = (element: Element) => element.getBoundingClientRect().width;
/** Group width minus its borders and separators, the extent shares are measured against. */
function usableOf(root: HTMLElement) {
  const style = getComputedStyle(root);
  const separators = Array.from(
    root.querySelectorAll(':scope > [data-ui="resizable-panels-separator"]'),
    widthOf,
  ).reduce((total, width) => total + width, 0);
  return widthOf(root) - parseFloat(style.borderLeftWidth) - parseFloat(style.borderRightWidth) - separators;
}
const near = (actual: number, expected: number, tolerance = 1.5) =>
  expect(Math.abs(actual - expected), `${actual} is within ${tolerance} of ${expected}`).toBeLessThan(
    tolerance,
  );
const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const total = (shares: number[]) => shares.reduce((sum, share) => sum + share, 0);
const valueOf = (separator: HTMLElement) => Number(separator.getAttribute('aria-valuenow'));

// Synthetic pointer events have no active browser pointer to capture, so capture is recorded here.
function pointerOn(separator: HTMLElement) {
  const captured = new Set<number>();
  separator.setPointerCapture = (id) => {
    captured.add(id);
  };
  separator.hasPointerCapture = (id) => captured.has(id);
  separator.releasePointerCapture = (id) => {
    captured.delete(id);
  };
  const rect = separator.getBoundingClientRect();
  const originX = rect.left + rect.width / 2;
  return {
    captured: (id = 1) => captured.has(id),
    fire: (type: string, dx: number, init: PointerEventInit = {}) =>
      fireEvent(
        separator,
        new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          pointerId: 1,
          isPrimary: true,
          button: 0,
          pointerType: 'mouse',
          clientX: originX + dx,
          clientY: rect.top + rect.height / 2,
          ...init,
        }),
      ),
  };
}

export const Default: EasyStory = {
  name: 'Mail workspace',
  args: {
    label: 'Mail',
    panels: PANELS,
    defaultValue: [30, 70],
    locale: 'en-US',
    onValueChange: fn(),
    onValueCommit: fn(),
  },
  parameters: {
    docs: {
      description: {
        story: 'Resize the folder list beside the selected conversation.',
      },
      source: {
        language: 'tsx',
        code: `import { ResizablePanels, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const Workspace = styled.div({ inlineSize: '24rem', maxInlineSize: '100%', blockSize: '12rem' });

const PaneContent = styled.div({
  display: 'grid',
  alignContent: 'start',
  gap: vars.space[2],
  padding: vars.space[3],
});

const List = styled.ul({ margin: 0, paddingInlineStart: vars.space[4] });

function Folders() {
  return (
    <PaneContent>
      <List>
        <li>Inbox</li>
        <li>Archive</li>
      </List>
    </PaneContent>
  );
}

const Text = styled.p({ margin: 0 });

function Messages() {
  return (
    <PaneContent>
      <Text>Select a conversation</Text>
    </PaneContent>
  );
}

<Workspace>
  <ResizablePanels
    label="Mail"
    panels={[
      { value: 'folders', label: 'Folders', minSize: 96, collapsible: true, content: <Folders /> },
      { value: 'messages', label: 'Messages', content: <Messages /> },
    ]}
    defaultValue={[30, 70]}
  />
</Workspace>;`,
      },
    },
  },
  render: (args) => <ResizablePanels {...args} />,
  play: async ({ canvas, canvasElement, args }) => {
    const root = rootOf(canvasElement);
    await expect(root).toHaveAccessibleName('Mail');
    const separator = canvas.getByRole('separator', { name: 'Folders' });
    const folders = canvas.getByRole('group', { name: 'Folders' });
    await expect(separator).toHaveAttribute('aria-controls', folders.id);
    await expect(separator).toHaveAttribute('aria-orientation', 'vertical');
    await expect(separator).toHaveAttribute('tabindex', '0');
    await expect(separator).toHaveAttribute('aria-valuenow', '30');
    await expect(separator).toHaveAttribute('aria-valuetext', '30%');
    await expect(Number(separator.getAttribute('aria-valuemin'))).toBe(0);
    const usable = usableOf(root);
    await near(Number(separator.getAttribute('aria-valuemax')), ((usable - 80) / usable) * 100, 0.02);
    await expect(widthOf(separator)).toBeGreaterThanOrEqual(31);
    await near(separator.getBoundingClientRect().height, root.clientHeight);
    const [first, second] = panelsOf(root);
    await near(widthOf(first!), usable * 0.3);
    await near(widthOf(second!), usable * 0.7);
    await expect(root.scrollWidth - root.clientWidth).toBeLessThan(1.1);

    // Keyboard activation and navigation on separator
    separator.focus();
    await userEvent.keyboard('{ArrowRight}');
    await expect(args.onValueCommit).toHaveBeenCalled();

    // Toggle collapse with Enter
    await userEvent.keyboard('{Enter}');
    await expect(separator).toHaveAttribute('data-collapsed', 'start');
    await userEvent.keyboard('{Enter}');
    await expect(separator).not.toHaveAttribute('data-collapsed');
  },
};

export const EasyModeControlled: EasyStory = {
  parameters: {
    docs: {
      description: {
        story: 'Keep the panel shares in React state as the separator moves.',
      },
      source: {
        language: 'tsx',
        code: `import { useState } from 'react';
import { ResizablePanels, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const Workspace = styled.div({ inlineSize: '24rem', maxInlineSize: '100%', blockSize: '12rem' });

const PaneContent = styled.div({
  display: 'grid',
  alignContent: 'start',
  gap: vars.space[2],
  padding: vars.space[3],
});

const List = styled.ul({ margin: 0, paddingInlineStart: vars.space[4] });

function Folders() {
  return (
    <PaneContent>
      <List>
        <li>Inbox</li>
        <li>Archive</li>
      </List>
    </PaneContent>
  );
}

const Text = styled.p({ margin: 0 });

function Messages() {
  return (
    <PaneContent>
      <Text>Select a conversation</Text>
    </PaneContent>
  );
}

export function MailWorkspace() {
  const [value, setValue] = useState([40, 60]);
  return (
    <Workspace>
      <ResizablePanels
        label="Mail"
        panels={[
          {
            value: 'folders',
            label: 'Folders',
            minSize: 96,
            collapsible: true,
            content: <Folders />,
          },
          { value: 'messages', label: 'Messages', content: <Messages /> },
        ]}
        value={value}
        onValueChange={setValue}
      />
    </Workspace>
  );
}`,
      },
    },
  },
  name: 'Controlled layout',
  render: () => {
    function ControlledFixture() {
      const [value, setValue] = useState([40, 60]);
      return (
        <ResizablePanels
          label="Mail"
          panels={PANELS}
          value={value}
          onValueChange={setValue}
        />
      );
    }
    return <ControlledFixture />;
  },
  play: async ({ canvas, canvasElement }) => {
    const root = rootOf(canvasElement);
    const separator = canvas.getByRole('separator', { name: 'Folders' });
    await expect(separator).toHaveAttribute('aria-valuenow', '40');
    const usable = usableOf(root);
    const [first, second] = panelsOf(root);
    await near(widthOf(first!), usable * 0.4);
    await near(widthOf(second!), usable * 0.6);
  },
};

export const EasyModeSlots: EasyStory = {
  name: 'Easy mode slots',
  args: {
    label: 'Mail',
    panels: PANELS,
    defaultValue: [30, 70],
    slotProps: {
      root: { className: 'custom-panels-root' },
      separator: { className: 'custom-separator' },
    },
  },
  render: (args) => <ResizablePanels {...args} />,
  play: async ({ canvas, canvasElement }) => {
    const root = rootOf(canvasElement);
    await expect(root).toHaveClass('custom-panels-root');
    const separator = canvas.getByRole('separator', { name: 'Folders' });
    await expect(separator).toHaveClass('custom-separator');
  },
};

function CustomPanelsRootBox({ children, ...props }: ComponentPropsWithRef<'div'>) {
  return (
    <div {...props} data-custom-panels-root="true">
      {children}
    </div>
  );
}

function CustomPanelBox(props: ComponentPropsWithRef<'div'>) {
  return <div {...props} data-custom-panel="true" />;
}

// Inline root/slot styles here exercise the documented style-merge contract.
export const EasyModeOverrides: EasyStory = {
  name: 'Easy mode overrides',
  render: () => {
    return (
      <ResizablePanels
        label="Mail"
        panels={PANELS}
        defaultValue={[30, 70]}
        component={CustomPanelsRootBox}
        slots={{ panel: CustomPanelBox }}
        className="host-root-class"
        data-testid="host-root"
        style={{ opacity: 0.85, zIndex: 1 }}
        slotProps={{
          root: {
            className: 'slot-root-class',
            'data-testid': 'slot-root-wins',
            'aria-label': 'Overridden Mail',
            style: { zIndex: 2 },
          },
          panel: {
            className: 'slot-panel-class',
          },
          separator: {
            className: 'slot-separator-class',
            'data-testid': 'slot-separator',
          },
        }}
      />
    );
  },
  play: async ({ canvas, canvasElement }) => {
    const root = rootOf(canvasElement);
    await expect(root).toHaveAttribute('data-custom-panels-root', 'true');
    // slotProps.root wins on conflict except merged className and style
    await expect(root).toHaveAttribute('data-testid', 'slot-root-wins');
    await expect(root).toHaveAttribute('aria-label', 'Overridden Mail');
    await expect(root).toHaveClass('host-root-class');
    await expect(root).toHaveClass('slot-root-class');
    await expect(root.style.opacity).toBe('0.85');
    await expect(root.style.zIndex).toBe('2');

    const separator = canvas.getByTestId('slot-separator');
    await expect(separator).toHaveClass('slot-separator-class');

    const panels = panelsOf(root);
    for (const panel of panels) {
      await expect(panel).toHaveClass('slot-panel-class');
      await expect(panel).toHaveAttribute('data-custom-panel', 'true');
    }
    await expect(root).not.toHaveAttribute('panels');
    await expect(root).not.toHaveAttribute('slots');
    const before = Number(separator.getAttribute('aria-valuenow'));
    separator.focus();
    await userEvent.keyboard('{ArrowRight}');
    await waitFor(() => expect(Number(separator.getAttribute('aria-valuenow'))).toBeGreaterThan(before));
  },
};

export const EasyModeKeyboard: EasyStory = {
  name: 'Easy mode keyboard',
  args: {
    label: 'Mail',
    panels: PANELS,
    defaultValue: [30, 70],
    onValueChange: fn(),
    onValueCommit: fn(),
  },
  render: (args) => <ResizablePanels {...args} />,
  play: async ({ canvas, canvasElement, args }) => {
    const separator = canvas.getByRole('separator', { name: 'Folders' });
    separator.focus();
    await expect(separator).toHaveFocus();
    await expect(separator).toHaveAttribute('aria-valuenow', '30');

    // Right arrow expands primary panel
    await userEvent.keyboard('{ArrowRight}');
    await expect(args.onValueCommit).toHaveBeenCalled();

    // Home jumps to smallest open size (minSize: 96px)
    await userEvent.keyboard('{Home}');
    const valAfterHome = Number(separator.getAttribute('aria-valuenow'));
    await expect(valAfterHome).toBeLessThanOrEqual(30);

    // Enter collapses collapsible panel
    await userEvent.keyboard('{Enter}');
    await expect(separator).toHaveAttribute('data-collapsed', 'start');
    await expect(separator).toHaveAttribute('aria-valuenow', '0');

    // Enter restores it
    await userEvent.keyboard('{Enter}');
    await expect(separator).not.toHaveAttribute('data-collapsed');
    await expect(Number(separator.getAttribute('aria-valuenow'))).toBeGreaterThan(0);
  },
};

export const Compound: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Compose named panes directly and let the group insert separators.',
      },
      source: {
        language: 'tsx',
        code: `import { ResizablePanels, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const Workspace = styled.div({ inlineSize: '24rem', maxInlineSize: '100%', blockSize: '12rem' });

const PaneContent = styled.div({
  display: 'grid',
  alignContent: 'start',
  gap: vars.space[2],
  padding: vars.space[3],
});

const List = styled.ul({ margin: 0, paddingInlineStart: vars.space[4] });

function Folders() {
  return (
    <PaneContent>
      <List>
        <li>Inbox</li>
        <li>Archive</li>
      </List>
    </PaneContent>
  );
}

const Text = styled.p({ margin: 0 });

function Messages() {
  return (
    <PaneContent>
      <Text>Select a conversation</Text>
    </PaneContent>
  );
}

<Workspace>
  <ResizablePanels aria-label="Mail" defaultValue={[30, 70]}>
    <ResizablePanels.Panel value="folders" aria-label="Folders" minSize={96} collapsible>
      <Folders />
    </ResizablePanels.Panel>
    <ResizablePanels.Panel value="messages" aria-label="Messages">
      <Messages />
    </ResizablePanels.Panel>
  </ResizablePanels>
</Workspace>;`,
      },
    },
  },
  name: 'Compound panels',
  play: async ({ canvas, canvasElement }) => {
    const root = rootOf(canvasElement);
    await expect(root).toHaveAccessibleName('Mail');
    const separator = canvas.getByRole('separator', { name: 'Folders' });
    const folders = canvas.getByRole('group', { name: 'Folders' });
    await expect(separator).toHaveAttribute('aria-controls', folders.id);
    await expect(separator).toHaveAttribute('aria-orientation', 'vertical');
    await expect(separator).toHaveAttribute('tabindex', '0');
    await expect(separator).toHaveAttribute('aria-valuenow', '30');
    await expect(separator).toHaveAttribute('aria-valuetext', '30%');
    await expect(Number(separator.getAttribute('aria-valuemin'))).toBe(0);
    const usable = usableOf(root);
    await near(Number(separator.getAttribute('aria-valuemax')), ((usable - 80) / usable) * 100, 0.02);
    await expect(widthOf(separator)).toBeGreaterThanOrEqual(31);
    await near(separator.getBoundingClientRect().height, root.clientHeight);
    const [first, second] = panelsOf(root);
    await near(widthOf(first!), usable * 0.3);
    await near(widthOf(second!), usable * 0.7);
    await expect(root.scrollWidth - root.clientWidth).toBeLessThan(1.1);
  },
};

export const ThreePanels: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Resize neighboring file, source and preview panes.',
      },
      source: {
        language: 'tsx',
        code: `import type { ReactNode } from 'react';
import { ResizablePanels, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const Workspace = styled.div({ inlineSize: '24rem', maxInlineSize: '100%', blockSize: '12rem' });

const PaneContent = styled.div({
  display: 'grid',
  alignContent: 'start',
  gap: vars.space[2],
  padding: vars.space[3],
});

const Text = styled.p({ margin: 0 });

function Pane({ children }: { children: ReactNode }) {
  return (
    <PaneContent>
      <Text>{children}</Text>
    </PaneContent>
  );
}

<Workspace>
  <ResizablePanels aria-label="Editor" defaultValue={[30, 40, 30]}>
    <ResizablePanels.Panel value="files" aria-label="Files">
      <Pane>Files</Pane>
    </ResizablePanels.Panel>
    <ResizablePanels.Panel value="source" aria-label="Source">
      <Pane>Source</Pane>
    </ResizablePanels.Panel>
    <ResizablePanels.Panel value="preview" aria-label="Preview">
      <Pane>Preview</Pane>
    </ResizablePanels.Panel>
  </ResizablePanels>
</Workspace>;`,
      },
    },
  },
  name: 'Three-pane editor',
  args: { 'aria-label': 'Editor', defaultValue: [30, 40, 30] },
  render: (args) => (
    <ResizablePanels {...args}>
      <ResizablePanels.Panel value="files" aria-label="Files">
        <Pane>Files</Pane>
      </ResizablePanels.Panel>
      <ResizablePanels.Panel value="source" aria-label="Source">
        <Pane>Source</Pane>
      </ResizablePanels.Panel>
      <ResizablePanels.Panel value="preview" aria-label="Preview">
        <Pane>Preview</Pane>
      </ResizablePanels.Panel>
    </ResizablePanels>
  ),
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const root = rootOf(canvasElement);
    const separators = canvas.getAllByRole('separator');
    await expect(separators.map((separator) => separator.getAttribute('aria-label'))).toEqual([
      'Files',
      'Source',
    ]);
    const before = panelsOf(root).map(widthOf);
    await userEvent.tab();
    await userEvent.tab();
    await expect(separators[1]!.ownerDocument.activeElement).toBe(separators[1]);
    await userEvent.keyboard('{ArrowRight}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueCommit).toHaveBeenCalledTimes(1);
    const shares = mocked(args.onValueChange!).mock.calls[0]![0] as number[];
    await near(total(shares), 100, 0.01);
    await near(shares[0]!, 30, 0.001);
    const after = panelsOf(root).map(widthOf);
    await near(after[0]!, before[0]!);
    await near(after[1]!, before[1]! + 16);
    await near(after[2]!, before[2]! - 16);
  },
};

export const Collapsible: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Press Enter on the separator to hide or restore the folder list.',
      },
      source: {
        language: 'tsx',
        code: `import { ResizablePanels, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const Workspace = styled.div({ inlineSize: '24rem', maxInlineSize: '100%', blockSize: '12rem' });

const PaneContent = styled.div({
  display: 'grid',
  alignContent: 'start',
  gap: vars.space[2],
  padding: vars.space[3],
});

const List = styled.ul({ margin: 0, paddingInlineStart: vars.space[4] });

function Folders() {
  return (
    <PaneContent>
      <List>
        <li>Inbox</li>
        <li>Archive</li>
      </List>
    </PaneContent>
  );
}

const Text = styled.p({ margin: 0 });

function Messages() {
  return (
    <PaneContent>
      <Text>Select a conversation</Text>
    </PaneContent>
  );
}

<Workspace>
  <ResizablePanels aria-label="Mail" defaultValue={[30, 70]}>
    <ResizablePanels.Panel value="folders" aria-label="Folders" minSize={96} collapsible>
      <Folders />
    </ResizablePanels.Panel>
    <ResizablePanels.Panel value="messages" aria-label="Messages">
      <Messages />
    </ResizablePanels.Panel>
  </ResizablePanels>
</Workspace>;`,
      },
    },
  },
  name: 'Collapsible folders',
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const root = rootOf(canvasElement);
    const separator = canvas.getByRole('separator', { name: 'Folders' });
    const folders = panelsOf(root)[0]!;
    const content = folders.querySelector<HTMLElement>('[data-ui="resizable-panels-content"]')!;
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    await expect(args.onValueChange).toHaveBeenLastCalledWith([0, 100]);
    await expect(args.onValueCommit).toHaveBeenLastCalledWith([0, 100]);
    await expect(folders).toHaveAttribute('data-state', 'collapsed');
    await expect(content).toHaveAttribute('inert');
    await expect(content).toHaveAttribute('aria-hidden', 'true');
    await expect(separator).toHaveAttribute('aria-valuenow', '0');
    await expect(separator).toHaveAttribute('aria-valuetext', '0%');
    await expect(separator.ownerDocument.activeElement).toBe(separator);
    await expect(separator.querySelector('[data-ui="resizable-panels-restore"]')).not.toBeNull();
    await waitFor(() => near(widthOf(folders), 0));
    await userEvent.keyboard('{Enter}');
    await expect(separator).toHaveAttribute('aria-valuenow', '30');
    await expect(content).not.toHaveAttribute('inert');
    await userEvent.keyboard('{Home}');
    const minimum = (96 / usableOf(root)) * 100;
    await near(valueOf(separator), minimum, 0.02);
    await userEvent.keyboard('{ArrowLeft}');
    await expect(separator).toHaveAttribute('aria-valuenow', '0');
    await userEvent.keyboard('{ArrowLeft}');
    await userEvent.keyboard('{ArrowRight}');
    await near(valueOf(separator), minimum, 0.02);
    await expect(args.onValueChange).toHaveBeenCalledTimes(5);
    await expect(args.onValueCommit).toHaveBeenCalledTimes(5);
    for (const [shares] of mocked(args.onValueChange!).mock.calls)
      await near(total(shares as number[]), 100, 0.01);
    await waitFor(() => near(widthOf(folders), 96));
  },
};

export const InitiallyCollapsed: Story = {
  args: { defaultValue: [0, 100] },
  render: (args) => (
    <ResizablePanels {...args}>
      <ResizablePanels.Panel value="folders" aria-label="Folders" minSize={96} collapsible>
        <Folders onHide={() => {}} />
      </ResizablePanels.Panel>
      <ResizablePanels.Panel value="messages" aria-label="Messages">
        <Messages />
      </ResizablePanels.Panel>
    </ResizablePanels>
  ),
  play: async ({ canvas, canvasElement, userEvent }) => {
    const root = rootOf(canvasElement);
    const [folders, messages] = panelsOf(root);
    const separator = canvas.getByRole('separator', { name: 'Folders' });
    await expect(folders).toHaveAttribute('data-state', 'collapsed');
    await near(widthOf(folders!), 0);
    await near(widthOf(messages!), usableOf(root));
    await expect(separator).toHaveAttribute('aria-valuenow', '0');
    await expect(separator).toHaveAttribute('aria-valuemin', '0');
    await expect(separator.querySelector('[data-ui="resizable-panels-restore"]')).toHaveAttribute(
      'data-side',
      'start',
    );
    const restore = separator.querySelector<HTMLElement>('[data-ui="resizable-panels-restore"]')!;
    await expect(getComputedStyle(restore, '::before').forcedColorAdjust).toBe('none');
    await expect(canvas.queryByRole('button', { name: 'Hide' })).toBeNull();
    const hide = folders!.querySelector('button')!;
    hide.focus();
    await expect(hide.ownerDocument.activeElement).not.toBe(hide);
    pointerOn(separator);
    await userEvent.click(separator);
    await expect(separator.ownerDocument.activeElement).toBe(separator);
  },
};

export const CollapsedSecondary: Story = {
  args: { 'aria-label': 'Reader', defaultValue: [100, 0] },
  render: (args) => (
    <ResizablePanels {...args}>
      <ResizablePanels.Panel value="article" aria-label="Article">
        <Pane>Article</Pane>
      </ResizablePanels.Panel>
      <ResizablePanels.Panel value="notes" aria-label="Notes" minSize={120} collapsible>
        <Pane>Notes</Pane>
      </ResizablePanels.Panel>
    </ResizablePanels>
  ),
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const root = rootOf(canvasElement);
    const notes = panelsOf(root)[1]!;
    const separator = canvas.getByRole('separator', { name: 'Article' });
    await expect(notes).toHaveAttribute('data-state', 'collapsed');
    await expect(separator).toHaveAttribute('aria-valuenow', '100');
    await expect(separator).toHaveAttribute('aria-valuemax', '100');
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    await expect(notes).toHaveAttribute('data-state', 'open');
    await waitFor(() => near(widthOf(notes), 120));
    await userEvent.keyboard('{Enter}');
    await expect(notes).toHaveAttribute('data-state', 'collapsed');
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await expect(args.onValueCommit).toHaveBeenLastCalledWith([100, 0]);
    await waitFor(() => near(widthOf(notes), 0));
  },
};

export const MinMax: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Resize the outline between its minimum and maximum widths.',
      },
      source: {
        language: 'tsx',
        code: `import type { ReactNode } from 'react';
import { ResizablePanels, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const Workspace = styled.div({ inlineSize: '24rem', maxInlineSize: '100%', blockSize: '12rem' });

const PaneContent = styled.div({
  display: 'grid',
  alignContent: 'start',
  gap: vars.space[2],
  padding: vars.space[3],
});

const Text = styled.p({ margin: 0 });

function Pane({ children }: { children: ReactNode }) {
  return (
    <PaneContent>
      <Text>{children}</Text>
    </PaneContent>
  );
}

<Workspace>
  <ResizablePanels aria-label="Workspace" defaultValue={[40, 60]}>
    <ResizablePanels.Panel value="outline" aria-label="Outline" minSize={120} maxSize={200}>
      <Pane>Outline</Pane>
    </ResizablePanels.Panel>
    <ResizablePanels.Panel value="canvas" aria-label="Canvas">
      <Pane>Canvas</Pane>
    </ResizablePanels.Panel>
  </ResizablePanels>
</Workspace>;`,
      },
    },
  },
  name: 'Width limits',
  args: { 'aria-label': 'Workspace', defaultValue: [40, 60] },
  render: (args) => (
    <ResizablePanels {...args}>
      <ResizablePanels.Panel value="outline" aria-label="Outline" minSize={120} maxSize={200}>
        <Pane>Outline</Pane>
      </ResizablePanels.Panel>
      <ResizablePanels.Panel value="canvas" aria-label="Canvas">
        <Pane>Canvas</Pane>
      </ResizablePanels.Panel>
    </ResizablePanels>
  ),
  play: async ({ canvas, canvasElement, userEvent }) => {
    const root = rootOf(canvasElement);
    const outline = panelsOf(root)[0]!;
    const separator = canvas.getByRole('separator', { name: 'Outline' });
    const usable = usableOf(root);
    await near(Number(separator.getAttribute('aria-valuemin')), (120 / usable) * 100, 0.02);
    await near(Number(separator.getAttribute('aria-valuemax')), (200 / usable) * 100, 0.02);
    await userEvent.tab();
    await userEvent.keyboard('{Home}');
    await near(widthOf(outline), 120);
    await userEvent.keyboard('{End}');
    await near(widthOf(outline), 200);
    await userEvent.keyboard('{Shift>}{ArrowRight}{/Shift}');
    await near(widthOf(outline), 200);
  },
};

export const LightTheme: Story = { decorators: [withLightTheme] };

export const OnePanel: Story = {
  args: { 'aria-label': 'Document', defaultValue: undefined },
  render: (args) => (
    <ResizablePanels {...args}>
      <ResizablePanels.Panel value="document" aria-label="Document body">
        <Pane>Document</Pane>
      </ResizablePanels.Panel>
    </ResizablePanels>
  ),
  play: async ({ canvas, canvasElement }) => {
    const root = rootOf(canvasElement);
    await expect(canvas.queryByRole('separator')).toBeNull();
    await near(widthOf(panelsOf(root)[0]!), usableOf(root));
  },
};

export const SmallContainer: Story = {
  args: { 'aria-label': 'Tools', defaultValue: [20, 60, 20] },
  render: (args) => (
    <SmallFrame>
      <ResizablePanels {...args}>
        {['A', 'B', 'C'].map((name) => (
          <ResizablePanels.Panel key={name} value={name} aria-label={`Tool ${name}`} minSize={120}>
            {name}
          </ResizablePanels.Panel>
        ))}
      </ResizablePanels>
    </SmallFrame>
  ),
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const root = rootOf(canvasElement);
    const usable = usableOf(root);
    const widths = panelsOf(root).map(widthOf);
    for (const width of widths) await near(width, usable / 3);
    await expect(root.scrollWidth - root.clientWidth).toBeLessThan(1.1);
    for (const separator of canvas.getAllByRole('separator')) {
      await expect(Number.isFinite(valueOf(separator))).toBe(true);
      await expect(separator).toHaveAttribute('aria-valuemin', separator.getAttribute('aria-valuenow'));
    }
    await userEvent.tab();
    await userEvent.keyboard('{ArrowRight}{ArrowLeft}');
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};

export const MaximaBlankSpace: Story = {
  args: { 'aria-label': 'Palettes', defaultValue: [50, 50] },
  render: (args) => (
    <ResizablePanels {...args}>
      <ResizablePanels.Panel value="colors" aria-label="Colors" maxSize={100}>
        <Pane>Colors</Pane>
      </ResizablePanels.Panel>
      <ResizablePanels.Panel value="layers" aria-label="Layers" maxSize={120}>
        <Pane>Layers</Pane>
      </ResizablePanels.Panel>
    </ResizablePanels>
  ),
  play: async ({ canvasElement }) => {
    const root = rootOf(canvasElement);
    const [colors, layers] = panelsOf(root);
    await near(widthOf(colors!), 100);
    await near(widthOf(layers!), 120);
    await expect(root.scrollWidth - root.clientWidth).toBeLessThan(1.1);
  },
};

export const Controlled: Story = {
  args: { defaultValue: undefined },
  render: function Render(args) {
    const [value, setValue] = useState<number[]>([30, 70]);
    return (
      <ControlStack>
        <FixtureButton type="button" onClick={() => setValue([50, 50])}>
          Split evenly
        </FixtureButton>
        <ResizablePanels
          {...args}
          value={value}
          onValueChange={(next) => {
            args.onValueChange?.(next);
            setValue(next);
          }}
        >
          <ResizablePanels.Panel value="folders" aria-label="Folders" minSize={96} collapsible>
            <Folders />
          </ResizablePanels.Panel>
          <ResizablePanels.Panel value="messages" aria-label="Messages">
            <Messages />
          </ResizablePanels.Panel>
        </ResizablePanels>
      </ControlStack>
    );
  },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const root = rootOf(canvasElement);
    const separator = canvas.getByRole('separator', { name: 'Folders' });
    const folders = panelsOf(root)[0]!;
    const before = widthOf(folders);
    await userEvent.click(canvas.getByRole('button', { name: 'Split evenly' }));
    await expect(separator).toHaveAttribute('aria-valuenow', '50');
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(args.onValueCommit).not.toHaveBeenCalled();
    await near(widthOf(folders), (before / 30) * 50);
    await userEvent.tab();
    await expect(separator.ownerDocument.activeElement).toBe(separator);
    await userEvent.keyboard('{ArrowRight}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await expect(args.onValueCommit).toHaveBeenCalledTimes(1);
    await expect(args.onValueCommit).toHaveBeenCalledWith(mocked(args.onValueChange!).mock.calls[0]![0]);
    await near(widthOf(folders), (before / 30) * 50 + 16);
  },
};

export const ControlledReject: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import { ResizablePanels, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const Frame = styled.div({ inlineSize: '24rem', maxInlineSize: '100%', blockSize: '12rem' });
const PaneContent = styled.div({ display: 'grid', alignContent: 'start', gap: vars.space[2], padding: vars.space[3] });
const List = styled.ul({ margin: 0, paddingInlineStart: vars.space[4] });
const Text = styled.p({ margin: 0 });

export function Mail() {
  return (
    <Frame>
      <ResizablePanels aria-label="Mail" locale="en-US" value={[30, 70]}>
        <ResizablePanels.Panel value="folders" aria-label="Folders" minSize={96} collapsible>
          <PaneContent><List><li>Inbox</li><li>Archive</li></List></PaneContent>
        </ResizablePanels.Panel>
        <ResizablePanels.Panel value="messages" aria-label="Messages">
          <PaneContent><Text>Select a conversation</Text></PaneContent>
        </ResizablePanels.Panel>
      </ResizablePanels>
    </Frame>
  );
}` } } },
  args: { value: [30, 70], defaultValue: undefined },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const root = rootOf(canvasElement);
    const separator = canvas.getByRole('separator', { name: 'Folders' });
    const folders = panelsOf(root)[0]!;
    const content = folders.querySelector('[data-ui="resizable-panels-content"]')!;
    const width = widthOf(folders);
    await userEvent.tab();
    await userEvent.keyboard('{ArrowRight}');
    await userEvent.keyboard('{Enter}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await expect(args.onValueChange).toHaveBeenLastCalledWith([0, 100]);
    await expect(separator).toHaveAttribute('aria-valuenow', '30');
    await expect(content).not.toHaveAttribute('inert');
    await expect(folders).toHaveAttribute('data-state', 'open');
    await expect(separator.ownerDocument.activeElement).toBe(separator);
    const pointer = pointerOn(separator);
    pointer.fire('pointerdown', 0);
    pointer.fire('pointermove', 40);
    await nextFrame();
    await expect(args.onValueChange).toHaveBeenCalledTimes(3);
    await near(widthOf(folders), width, 0.5);
    pointer.fire('pointerup', 40);
    await expect(args.onValueCommit).toHaveBeenCalledTimes(3);
    await near(widthOf(folders), width, 0.5);
    await expect(separator).toHaveAttribute('aria-valuenow', '30');
  },
};

export const KeyboardNavigation: Story = {
  parameters: {
    docs: {
      description: { story: 'Focus the separator and try arrows, Shift+arrows, Home and End.' },
      source: {
        language: 'tsx',
        code: `import { ResizablePanels, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const Workspace = styled.div({ inlineSize: '24rem', maxInlineSize: '100%', blockSize: '12rem' });
const Pane = styled.div({
  display: 'grid',
  alignContent: 'start',
  gap: vars.space[2],
  padding: vars.space[3],
});

<Workspace>
  <ResizablePanels aria-label="Split view" defaultValue={[50, 50]}>
    <ResizablePanels.Panel value="left" aria-label="Left">
      <Pane>Left</Pane>
    </ResizablePanels.Panel>
    <ResizablePanels.Panel value="right" aria-label="Right">
      <Pane>Right</Pane>
    </ResizablePanels.Panel>
  </ResizablePanels>
</Workspace>;`,
      },
    },
  },
  name: 'Keyboard resizing',
  args: { 'aria-label': 'Split view', defaultValue: [50, 50] },
  render: (args) => (
    <ResizablePanels {...args}>
      <ResizablePanels.Panel value="left" aria-label="Left">
        <Pane>Left</Pane>
      </ResizablePanels.Panel>
      <ResizablePanels.Panel value="right" aria-label="Right">
        <Pane>Right</Pane>
      </ResizablePanels.Panel>
    </ResizablePanels>
  ),
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const root = rootOf(canvasElement);
    const left = panelsOf(root)[0]!;
    const separator = canvas.getByRole('separator', { name: 'Left' });
    const usable = usableOf(root);
    const half = usable / 2;
    await userEvent.tab();
    await expect(separator.ownerDocument.activeElement).toBe(separator);
    await expect(getComputedStyle(separator).outlineStyle).not.toBe('none');
    await expect(Math.abs(parseFloat(getComputedStyle(separator).outlineWidth) - 2)).toBeLessThan(1.1);
    await userEvent.keyboard('{ArrowRight}');
    await near(widthOf(left), half + 16);
    await userEvent.keyboard('{Shift>}{ArrowRight}{/Shift}');
    await near(widthOf(left), half + 80);
    await userEvent.keyboard('{End}');
    await near(widthOf(left), usable - 80);
    await userEvent.keyboard('{ArrowRight}');
    await userEvent.keyboard('{Home}');
    await near(widthOf(left), 80);
    await userEvent.keyboard('{ArrowLeft}');
    await userEvent.keyboard('{ArrowUp}{ArrowDown}{Escape}');
    await userEvent.keyboard(' ');
    await expect(args.onValueChange).toHaveBeenCalledTimes(4);
    await userEvent.keyboard('{Control>}{Home}{/Control}');
    await waitFor(() => near(widthOf(left), half));
    await userEvent.keyboard('{Meta>}{Home}{/Meta}');
    await expect(args.onValueChange).toHaveBeenCalledTimes(5);
    await expect(args.onValueCommit).toHaveBeenCalledTimes(5);
    await expect(args.onValueCommit).toHaveBeenLastCalledWith([50, 50]);
    await expect(separator.ownerDocument.activeElement).toBe(separator);
  },
};

export const RTL: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import { ResizablePanels, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const Frame = styled.div({ inlineSize: '24rem', maxInlineSize: '100%', blockSize: '12rem' });
const PaneContent = styled.div({ display: 'grid', alignContent: 'start', gap: vars.space[2], padding: vars.space[3] });
const List = styled.ul({ margin: 0, paddingInlineStart: vars.space[4] });
const Text = styled.p({ margin: 0 });

export function Mail() {
  return (
    <Frame>
      <ResizablePanels aria-label="Mail" locale="en-US" dir="rtl" defaultValue={[50, 50]}>
        <ResizablePanels.Panel value="folders" aria-label="Folders" minSize={96} collapsible>
          <PaneContent><List><li>Inbox</li><li>Archive</li></List></PaneContent>
        </ResizablePanels.Panel>
        <ResizablePanels.Panel value="messages" aria-label="Messages">
          <PaneContent><Text>Select a conversation</Text></PaneContent>
        </ResizablePanels.Panel>
      </ResizablePanels>
    </Frame>
  );
}` } } },
  args: { dir: 'rtl', defaultValue: [50, 50] },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const root = rootOf(canvasElement);
    const folders = panelsOf(root)[0]!;
    const separator = canvas.getByRole('separator', { name: 'Folders' });
    const rootRect = root.getBoundingClientRect();
    await expect(folders.getBoundingClientRect().right).toBeGreaterThan(rootRect.right - 2);
    const width = widthOf(folders);
    await userEvent.tab();
    await userEvent.keyboard('{ArrowLeft}');
    await near(widthOf(folders), width + 16);
    await userEvent.keyboard('{ArrowRight}');
    await near(widthOf(folders), width);
    const pointer = pointerOn(separator);
    pointer.fire('pointerdown', 0);
    pointer.fire('pointermove', -30);
    await nextFrame();
    await pause(120);
    pointer.fire('pointerup', -30);
    await waitFor(() => near(widthOf(folders), width + 30));
  },
};

export const TouchPen: Story = {
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const root = rootOf(canvasElement);
    const folders = panelsOf(root)[0]!;
    const separator = canvas.getByRole('separator', { name: 'Folders' });
    const width = widthOf(folders);
    const pointer = pointerOn(separator);

    pointer.fire('pointerdown', 0, { pointerType: 'touch', pointerId: 5 });
    await expect(pointer.captured(5)).toBe(true);
    await expect(separator.ownerDocument.activeElement).toBe(separator);
    pointer.fire('pointermove', 60, { pointerType: 'touch', pointerId: 9 });
    await nextFrame();
    await expect(args.onValueChange).not.toHaveBeenCalled();
    pointer.fire('pointermove', 30, { pointerType: 'touch', pointerId: 5 });
    pointer.fire('pointermove', 32, { pointerType: 'touch', pointerId: 5 });
    await nextFrame();
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    await pause(120);
    pointer.fire('pointerup', 32, { pointerType: 'touch', pointerId: 5 });
    await expect(pointer.captured(5)).toBe(false);
    await expect(args.onValueCommit).toHaveBeenCalledTimes(1);
    await near(widthOf(folders), width + 32);

    pointer.fire('pointerdown', 0, { pointerType: 'pen', pointerId: 7 });
    pointer.fire('pointermove', 20, { pointerType: 'pen', pointerId: 7 });
    await waitFor(() => near(widthOf(folders), width + 52));
    pointer.fire('pointercancel', 20, { pointerType: 'pen', pointerId: 7 });
    await expect(pointer.captured(7)).toBe(false);
    await waitFor(() => near(widthOf(folders), width + 32));

    pointer.fire('pointerdown', 0);
    pointer.fire('pointermove', 20);
    await nextFrame();
    pointer.fire('lostpointercapture', 20);
    await waitFor(() => near(widthOf(folders), width + 32));

    pointer.fire('pointerdown', 0);
    pointer.fire('pointermove', 20);
    await nextFrame();
    await userEvent.keyboard('{Escape}');
    await expect(pointer.captured()).toBe(false);
    await waitFor(() => near(widthOf(folders), width + 32));
    await expect(args.onValueCommit).toHaveBeenCalledTimes(1);
    await expect(args.onValueChange).toHaveBeenLastCalledWith(mocked(args.onValueCommit!).mock.calls[0]![0]);
  },
};

export const PointerDrag: Story = {
  args: { 'aria-label': 'Split view', defaultValue: [50, 50] },
  render: KeyboardNavigation.render,
  play: async ({ canvas, canvasElement, args }) => {
    const root = rootOf(canvasElement);
    const left = panelsOf(root)[0]!;
    const separator = canvas.getByRole('separator', { name: 'Left' });
    const usable = usableOf(root);
    const pointer = pointerOn(separator);
    pointer.fire('pointerdown', 0);
    pointer.fire('pointermove', 40);
    await nextFrame();
    await expect(args.onValueChange).toHaveBeenCalledTimes(1);
    pointer.fire('pointermove', 50);
    pointer.fire('pointermove', 60);
    await nextFrame();
    await expect(args.onValueChange).toHaveBeenCalledTimes(2);
    await waitFor(() => near(widthOf(left), usable / 2 + 60));
    pointer.fire('pointermove', 400);
    await expect(widthOf(left)).toBeGreaterThan(usable - 80 + 8);
    await expect(widthOf(left)).toBeLessThan(usable - 80 + 44);
    await nextFrame();
    await pause(120);
    pointer.fire('pointerup', 400);
    await expect(args.onValueChange).toHaveBeenCalledTimes(3);
    await expect(args.onValueCommit).toHaveBeenCalledTimes(1);
    await expect(args.onValueCommit).toHaveBeenCalledWith(mocked(args.onValueChange!).mock.calls[2]![0]);
    await waitFor(() => near(widthOf(left), usable - 80));
  },
};

export const FlickCollapse: Story = {
  parameters: { docs: { source: { language: 'tsx', code: `import { ResizablePanels, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const Frame = styled.div({ inlineSize: '24rem', maxInlineSize: '100%', blockSize: '12rem' });
const PaneContent = styled.div({ display: 'grid', alignContent: 'start', gap: vars.space[2], padding: vars.space[3] });
const List = styled.ul({ margin: 0, paddingInlineStart: vars.space[4] });
const Text = styled.p({ margin: 0 });

export function Mail() {
  return (
    <Frame>
      <ResizablePanels aria-label="Mail" locale="en-US" defaultValue={[40, 60]}>
        <ResizablePanels.Panel value="folders" aria-label="Folders" minSize={96} collapsible>
          <PaneContent><List><li>Inbox</li><li>Archive</li></List></PaneContent>
        </ResizablePanels.Panel>
        <ResizablePanels.Panel value="messages" aria-label="Messages">
          <PaneContent><Text>Select a conversation</Text></PaneContent>
        </ResizablePanels.Panel>
      </ResizablePanels>
    </Frame>
  );
}` } } },
  args: { defaultValue: [40, 60] },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const root = rootOf(canvasElement);
    const folders = panelsOf(root)[0]!;
    const separator = canvas.getByRole('separator', { name: 'Folders' });
    const pointer = pointerOn(separator);
    pointer.fire('pointerdown', 0);
    pointer.fire('pointermove', -20);
    await pause(16);
    pointer.fire('pointerup', -20);
    await expect(separator).toHaveAttribute('aria-valuenow', '0');
    await expect(args.onValueCommit).toHaveBeenLastCalledWith([0, 100]);
    await userEvent.keyboard('{Enter}');
    await expect(separator).toHaveAttribute('aria-valuenow', '40');
    pointer.fire('pointerdown', 0);
    pointer.fire('pointermove', -20);
    await pause(16);
    pointer.fire('pointercancel', -20);
    await expect(separator).toHaveAttribute('aria-valuenow', '40');
    await expect(args.onValueCommit).toHaveBeenCalledTimes(2);
    await waitFor(() => near(widthOf(folders), usableOf(root) * 0.4));
  },
};

export const Reset: Story = {
  play: async ({ canvas, userEvent, args }) => {
    const separator = canvas.getByRole('separator', { name: 'Folders' });
    pointerOn(separator);
    await userEvent.tab();
    await userEvent.keyboard('{ArrowRight}{ArrowRight}');
    await expect(Number(separator.getAttribute('aria-valuenow'))).toBeGreaterThan(30);
    await userEvent.dblClick(separator);
    await expect(separator).toHaveAttribute('aria-valuenow', '30');
    await expect(args.onValueCommit).toHaveBeenCalledTimes(3);
    await expect(args.onValueCommit).toHaveBeenLastCalledWith([30, 70]);
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard('{Meta>}{Home}{/Meta}');
    await expect(separator).toHaveAttribute('aria-valuenow', '30');
    await expect(args.onValueChange).toHaveBeenCalledTimes(5);
    await expect(args.onValueCommit).toHaveBeenCalledTimes(5);
  },
};

export const ExternalARIA: Story = {
  args: {
    'aria-label': undefined,
    'aria-labelledby': 'mail-heading',
    slotProps: {
      separator: {
        'aria-labelledby': 'resize-label missing-reference',
        'aria-describedby': 'resize-help',
        'aria-controls': 'mail-heading',
      },
    },
  },
  render: (args) => (
    <LabelledFrame>
      <Text id="mail-heading">
        Mailbox
      </Text>
      <Text id="resize-help">
        <span id="resize-label">Resize</span> with arrow keys
      </Text>
      <ResizablePanels {...args}>
        <ResizablePanels.Panel value="folders" aria-labelledby="folders-title" minSize={96}>
          <PaneContent>
            <Text id="folders-title">
              Folders
            </Text>
          </PaneContent>
        </ResizablePanels.Panel>
        <ResizablePanels.Panel value="messages" aria-label="Messages">
          <Messages />
        </ResizablePanels.Panel>
      </ResizablePanels>
    </LabelledFrame>
  ),
  play: async ({ canvas, canvasElement }) => {
    const root = rootOf(canvasElement);
    const separator = canvas.getByRole('separator');
    await expect(root).toHaveAccessibleName('Mailbox');
    await expect(separator).toHaveAttribute(
      'aria-labelledby',
      'resize-label missing-reference folders-title',
    );
    await expect(separator).not.toHaveAttribute('aria-label');
    await expect(separator).toHaveAccessibleName('Resize Folders');
    await expect(separator).toHaveAttribute('aria-describedby', 'resize-help');
    await expect(separator.getAttribute('aria-controls')?.split(' ')).toEqual([
      'mail-heading',
      canvas.getByRole('group', { name: 'Folders' }).id,
    ]);
    await expect(separator).toHaveAccessibleDescription('Resize with arrow keys');
    await expect(canvas.getByRole('group', { name: 'Folders' })).toBeInTheDocument();
  },
};

const falsyNodes: ReactNode[] = [false, null, 0, ''];
export const FalsyContent: Story = {
  args: { 'aria-label': 'Falsy', defaultValue: undefined },
  render: (args) => (
    <ResizablePanels {...args}>
      {false}
      {null}
      {falsyNodes.map((node, index) => (
        <ResizablePanels.Panel key={index} value={`pane-${index}`} aria-label={`Pane ${index}`} minSize={0}>
          {node}
        </ResizablePanels.Panel>
      ))}
    </ResizablePanels>
  ),
  play: async ({ canvas, canvasElement }) => {
    const root = rootOf(canvasElement);
    const contents = panelsOf(root).map((panel) =>
      panel.querySelector<HTMLElement>('[data-ui="resizable-panels-content"]')!,
    );
    await expect(contents).toHaveLength(4);
    await expect(contents.map((content) => content.textContent)).toEqual(['', '', '0', '']);
    await expect(contents[0]!.childNodes).toHaveLength(0);
    await expect(contents[1]!.childNodes).toHaveLength(0);
    await expect(canvas.getAllByRole('separator')).toHaveLength(3);
    for (const separator of canvas.getAllByRole('separator')) {
      await expect(separator).toHaveAttribute('aria-valuenow', '25');
      await expect(separator).toHaveAccessibleName(/^Pane \d$/);
    }
  },
};

export const Disabled: Story = {
  args: { disabled: true },
  render: (args) => (
    <ResizablePanels {...args}>
      <ResizablePanels.Panel value="folders" aria-label="Folders" minSize={96} collapsible>
        <Folders onHide={args.onValueCommit as () => void} />
      </ResizablePanels.Panel>
      <ResizablePanels.Panel value="messages" aria-label="Messages">
        <Messages />
      </ResizablePanels.Panel>
    </ResizablePanels>
  ),
  play: async ({ canvas, userEvent, args }) => {
    const separator = canvas.getByRole('separator', { name: 'Folders' });
    await expect(separator).toHaveAttribute('aria-disabled', 'true');
    await expect(separator).toHaveAttribute('tabindex', '-1');
    await userEvent.tab();
    const hide = canvas.getByRole('button', { name: 'Hide' });
    await expect(hide.ownerDocument.activeElement).toBe(hide);
    await userEvent.tab();
    await expect(separator.ownerDocument.activeElement).not.toBe(separator);
    const pointer = pointerOn(separator);
    pointer.fire('pointerdown', 0);
    await expect(pointer.captured()).toBe(false);
    pointer.fire('pointermove', 40);
    await nextFrame();
    pointer.fire('pointerup', 40);
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await userEvent.click(hide);
    await expect(args.onValueCommit).toHaveBeenCalledTimes(1);
    await expect(separator).toHaveAttribute('aria-valuenow', '30');
  },
};

export const FocusRepair: Story = {
  args: { defaultValue: undefined },
  render: function Render(args) {
    const [value, setValue] = useState<number[]>([30, 70]);
    return (
      <ResizablePanels {...args} value={value}>
        <ResizablePanels.Panel value="folders" aria-label="Folders" minSize={96} collapsible>
          <Folders onHide={() => setValue([0, 100])} />
        </ResizablePanels.Panel>
        <ResizablePanels.Panel value="messages" aria-label="Messages">
          <Messages />
        </ResizablePanels.Panel>
      </ResizablePanels>
    );
  },
  play: async ({ canvas, userEvent, args }) => {
    const separator = canvas.getByRole('separator', { name: 'Folders' });
    await userEvent.tab();
    const hide = canvas.getByRole('button', { name: 'Hide' });
    await expect(hide.ownerDocument.activeElement).toBe(hide);
    await userEvent.keyboard('{Enter}');
    await expect(separator.ownerDocument.activeElement).toBe(separator);
    await expect(separator).toHaveAttribute('aria-valuenow', '0');
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};

export const ReducedMotion: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Enable reduced motion in the browser. Check that releases, collapses and resets finish without a spring, and dragging past a limit stops without rubber-banding.',
      },
    },
  },
};

export const NestedGroups: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Resize the outer sidebar and the inner code and output split independently.',
      },
      source: {
        language: 'tsx',
        code: `import type { ReactNode } from 'react';
import { ResizablePanels, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const Workspace = styled.div({ inlineSize: '24rem', maxInlineSize: '100%', blockSize: '12rem' });

const PaneContent = styled.div({
  display: 'grid',
  alignContent: 'start',
  gap: vars.space[2],
  padding: vars.space[3],
});

const Text = styled.p({ margin: 0 });

function Pane({ children }: { children: ReactNode }) {
  return (
    <PaneContent>
      <Text>{children}</Text>
    </PaneContent>
  );
}

<Workspace>
  <ResizablePanels aria-label="Outer" defaultValue={[40, 60]}>
    <ResizablePanels.Panel value="sidebar" aria-label="Sidebar">
      <Pane>Sidebar</Pane>
    </ResizablePanels.Panel>
    <ResizablePanels.Panel value="main" aria-label="Main">
      <ResizablePanels
        aria-label="Inner"
        defaultValue={[50, 50]}
        sx={{ border: 'none', borderRadius: 0 }}
      >
        <ResizablePanels.Panel value="code" aria-label="Code">
          <Pane>Code</Pane>
        </ResizablePanels.Panel>
        <ResizablePanels.Panel value="output" aria-label="Output">
          <Pane>Output</Pane>
        </ResizablePanels.Panel>
      </ResizablePanels>
    </ResizablePanels.Panel>
  </ResizablePanels>
</Workspace>;`,
      },
    },
  },
  name: 'Nested workspaces',
  args: { 'aria-label': 'Outer', defaultValue: [40, 60] },
  render: (args) => (
    <ResizablePanels {...args}>
      <ResizablePanels.Panel value="sidebar" aria-label="Sidebar">
        <Pane>Sidebar</Pane>
      </ResizablePanels.Panel>
      <ResizablePanels.Panel value="main" aria-label="Main">
        <ResizablePanels aria-label="Inner" defaultValue={[50, 50]} sx={{ border: 'none', borderRadius: 0 }}>
          <ResizablePanels.Panel value="code" aria-label="Code">
            <Pane>Code</Pane>
          </ResizablePanels.Panel>
          <ResizablePanels.Panel value="output" aria-label="Output">
            <Pane>Output</Pane>
          </ResizablePanels.Panel>
        </ResizablePanels>
      </ResizablePanels.Panel>
    </ResizablePanels>
  ),
  play: async ({ canvas, userEvent, args }) => {
    const outer = canvas.getByRole('separator', { name: 'Sidebar' });
    const inner = canvas.getByRole('separator', { name: 'Code' });
    await userEvent.tab();
    await userEvent.tab();
    await expect(inner.ownerDocument.activeElement).toBe(inner);
    await userEvent.keyboard('{ArrowRight}{Enter}{Home}');
    await expect(outer).toHaveAttribute('aria-valuenow', '40');
    await expect(Number(inner.getAttribute('aria-valuenow'))).toBeLessThan(50);
    await expect(args.onValueChange).not.toHaveBeenCalled();
  },
};

export const GroupResize: Story = {
  render: function Render(args) {
    const [narrow, setNarrow] = useState(false);
    return (
      <ControlStack>
        <FixtureButton type="button" onClick={() => setNarrow((current) => !current)}>
          Toggle width
        </FixtureButton>
        <div style={{ inlineSize: narrow ? '14rem' : '100%' }}>
          <ResizablePanels {...args}>
            <ResizablePanels.Panel value="folders" aria-label="Folders" minSize={96} collapsible>
              <Folders />
            </ResizablePanels.Panel>
            <ResizablePanels.Panel value="messages" aria-label="Messages">
              <Messages />
            </ResizablePanels.Panel>
          </ResizablePanels>
        </div>
      </ControlStack>
    );
  },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const root = rootOf(canvasElement);
    const separator = canvas.getByRole('separator', { name: 'Folders' });
    const toggle = canvas.getByRole('button', { name: 'Toggle width' });
    await userEvent.click(toggle);
    await waitFor(() => near(widthOf(panelsOf(root)[0]!), 96));
    const now = valueOf(separator);
    await expect(Number.isFinite(now)).toBe(true);
    await near(now, (96 / usableOf(root)) * 100, 0.02);
    await near(
      panelsOf(root)
        .map(widthOf)
        .reduce((sum, width) => sum + width, 0),
      usableOf(root),
    );
    await userEvent.click(toggle);
    await waitFor(() => expect(separator).toHaveAttribute('aria-valuenow', '30'));
    await expect(args.onValueChange).not.toHaveBeenCalled();
    await expect(args.onValueCommit).not.toHaveBeenCalled();
  },
};

const panelRef = fn();
// This story exercises the documented separator slot `css` API.
const separatorStyle = css({ inlineSize: vars.space[10] });
export const SlotStylingAndRefs: Story = {
  args: {
    ref: fn(),
    sx: { borderRadius: 0 },
    slotProps: { separator: { ref: fn(), className: 'mail-separator', sx: separatorStyle } },
  },
  render: (args) => (
    <ResizablePanels {...args}>
      <ResizablePanels.Panel
        ref={panelRef}
        value="folders"
        aria-label="Folders"
        minSize={96}
        sx={{ backgroundColor: vars.color.surfaceInset }}
      >
        <Folders />
      </ResizablePanels.Panel>
      <ResizablePanels.Panel value="messages" aria-label="Messages">
        <Messages />
      </ResizablePanels.Panel>
    </ResizablePanels>
  ),
  play: async ({ canvas, canvasElement, args }) => {
    const root = rootOf(canvasElement);
    const separator = canvas.getByRole('separator', { name: 'Folders' });
    const [folders, messages] = panelsOf(root);
    await expect(args.ref).toHaveBeenCalledWith(root);
    await expect(args.slotProps?.separator?.ref).toHaveBeenCalledWith(separator);
    await expect(panelRef).toHaveBeenCalledWith(folders);
    await expect(separator).toHaveClass('mail-separator');
    await near(widthOf(separator), 40);
    await near(widthOf(folders!) + widthOf(messages!), usableOf(root));
    await expect(getComputedStyle(root).borderTopLeftRadius).toBe('0px');
    await expect(getComputedStyle(folders!).backgroundColor).not.toBe(
      getComputedStyle(messages!).backgroundColor,
    );
  },
};

class ConfigurationBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state: { error: string | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }
  render() {
    return this.state.error ? <div role="alert">{this.state.error}</div> : this.props.children;
  }
}

const twoPanels = [
  <ResizablePanels.Panel key="a" value="a" aria-label="A" />,
  <ResizablePanels.Panel key="b" value="b" aria-label="B" />,
];
const invalidConfigurations: { props?: Partial<ResizablePanelsCompoundProps>; children: ReactNode }[] = [
  { children: [twoPanels[0], <div key="x">Stray</div>] },
  { children: [] },
  {
    children: [
      <ResizablePanels.Panel key="a" value="a" aria-label="A" />,
      <ResizablePanels.Panel key="b" value="a" aria-label="B" />,
    ],
  },
  { children: [<ResizablePanels.Panel key="a" value="a" />, twoPanels[1]] },
  { children: [<ResizablePanels.Panel key="a" value="a" aria-label="A" minSize={-1} />, twoPanels[1]] },
  {
    children: [
      <ResizablePanels.Panel key="a" value="a" aria-label="A" minSize={100} maxSize={50} />,
      twoPanels[1],
    ],
  },
  { props: { defaultValue: [100] }, children: twoPanels },
  { props: { defaultValue: [-1, 2] }, children: twoPanels },
  { props: { value: [0, 0] }, children: twoPanels },
  { props: { value: [Number.NaN, 1] }, children: twoPanels },
];
export const ConfigurationErrors: Story = {
  render: () => (
    <>
      {invalidConfigurations.map(({ props, children }, index) => (
        <ConfigurationBoundary key={index}>
          <ResizablePanels aria-label={`Invalid ${index}`} {...props}>
            {children}
          </ResizablePanels>
        </ConfigurationBoundary>
      ))}
      <ConfigurationBoundary>
        <ResizablePanels.Panel value="orphan" aria-label="Orphan" />
      </ConfigurationBoundary>
    </>
  ),
  play: async ({ canvas }) => {
    const errors = canvas.getAllByRole('alert').map((alert) => alert.textContent);
    await expect(errors).toEqual([
      'ResizablePanels accepts only ResizablePanels.Panel children.',
      'ResizablePanels needs at least one ResizablePanels.Panel.',
      'ResizablePanels.Panel values must be unique: "a".',
      'ResizablePanels.Panel "a" needs aria-label or aria-labelledby.',
      'ResizablePanels.Panel "a" minSize must be finite and nonnegative.',
      'ResizablePanels.Panel "a" maxSize must be finite and at least minSize.',
      'ResizablePanels value needs 2 finite nonnegative weights, one per panel.',
      'ResizablePanels value needs 2 finite nonnegative weights, one per panel.',
      'ResizablePanels value needs at least one positive weight.',
      'ResizablePanels value needs 2 finite nonnegative weights, one per panel.',
      'ResizablePanels.Panel must be rendered inside ResizablePanels.',
    ]);
  },
};
