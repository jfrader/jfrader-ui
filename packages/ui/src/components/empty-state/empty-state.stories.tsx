import { Fragment, useState, type ComponentPropsWithRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { withLightTheme } from '../../testing/story-decorators';
import { Button } from '../button';
import { EmptyState, type EmptyStateProps, type EmptyStateVariant } from './index';

const VARIANTS = ['centered', 'inline'] as const satisfies readonly EmptyStateVariant[];

function SlotIcon(props: ComponentPropsWithRef<'div'>) {
  return <div {...props} data-slot="empty-state-icon" />;
}

export const IconReplacement: Story = {
  render: (args) => <EmptyState {...args} icon={<FolderIcon />} slots={{ icon: SlotIcon }} />,
  play: async ({ canvasElement }) => {
    const icon = canvasElement.querySelector('[data-slot="empty-state-icon"]');
    await expect(icon).toBeInTheDocument();
    await expect(icon).toHaveAttribute('data-ui', 'empty-state-icon');
    await expect(getComputedStyle(icon!).display).toBe('grid');
    await expect(icon).toHaveAttribute('aria-hidden', 'true');
    await expect(canvasElement.querySelector('[data-ui="empty-state-icon"]:not([data-slot])')).toBeNull();
  },
};

const frameStyle = css({
  display: 'grid',
  gap: vars.space[4],
  inlineSize: '360px',
});

const wideStyle = css({ inlineSize: '560px' });
const narrowStyle = css({ inlineSize: '240px' });

function FolderIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  );
}
FolderIcon.displayName = 'FolderIcon';

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="11" cy="11" r="6" />
      <path d="m20 20-4.5-4.5" />
    </svg>
  );
}
SearchIcon.displayName = 'SearchIcon';

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="m5 12 5 5 9-10" />
    </svg>
  );
}
CheckIcon.displayName = 'CheckIcon';

const meta = {
  title: 'Data display/EmptyState',
  component: EmptyState,
  parameters: { docs: {
    description: { component: 'Show a message and an action when there is no content to display.' },
    usage: '- Use Skeleton while content is loading and Alert for an error alongside existing content.\n- Supply copy, translations and result announcements. Keep the icon decorative and put controls in `action`.',
  } },
  args: {
    title: 'No projects yet',
    description: 'Create a project to start tracking work.',
    variant: 'centered',
    headingLevel: 3,
  },
  argTypes: {
    variant: { control: 'radio', options: VARIANTS },
    headingLevel: { control: 'select', options: [1, 2, 3, 4, 5, 6] },
    icon: { control: false },
    action: { control: false },
  },
  decorators: [
    (Story) => (
      <div css={frameStyle}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof EmptyState>;

export default meta;

type Story = StoryObj<typeof meta>;

function getRoot(canvasElement: HTMLElement, index = 0) {
  const root = canvasElement.querySelectorAll<HTMLElement>('[data-ui="empty-state"]')[index];
  if (!root) throw new Error('Expected an empty state');
  return root;
}

function getPart(root: HTMLElement, part: string) {
  return root.querySelector<HTMLElement>(`[data-ui="empty-state-${part}"]`);
}

function partsOf(element: Element) {
  return Array.from(element.children, (child) => child.getAttribute('data-ui'));
}

/** Moves focus to the start of the canvas so the next Tab lands on its first control. */
function focusCanvasStart(canvasElement: HTMLElement) {
  canvasElement.tabIndex = -1;
  canvasElement.focus();
  canvasElement.removeAttribute('tabindex');
}

export const Default: Story = {
  args: { icon: <FolderIcon /> },
  play: async ({ canvas, canvasElement }) => {
    const root = getRoot(canvasElement);
    await expect(root.tagName).toBe('SECTION');
    await expect(root).toHaveAttribute('data-variant', 'centered');
    await expect(partsOf(root)).toEqual(['empty-state-icon', 'empty-state-content']);

    const heading = canvas.getByRole('heading', { level: 3, name: 'No projects yet' });
    await expect(heading.tagName).toBe('H3');
    const description = canvas.getByText('Create a project to start tracking work.');
    await expect(description.tagName).toBe('P');
    await expect(getPart(root, 'icon')).toHaveAttribute('aria-hidden', 'true');

    // Unnamed: no landmark, no live region, and only the description is wired.
    await expect(root).not.toHaveAttribute('role');
    await expect(root).not.toHaveAttribute('aria-labelledby');
    await expect(canvas.queryByRole('region')).toBeNull();
    await expect(canvas.queryByRole('status')).toBeNull();
    await expect(root).toHaveAttribute('aria-describedby', description.id);
    // Appearing never takes focus.
    await expect(root.contains(canvasElement.ownerDocument.activeElement)).toBe(false);
  },
};

export const WithoutIcon: Story = {
  play: async ({ canvasElement }) => {
    const root = getRoot(canvasElement);
    await expect(getPart(root, 'icon')).toBeNull();
    await expect(partsOf(root)).toEqual(['empty-state-content']);
  },
};

export const Icon: Story = {
  args: { icon: <FolderIcon /> },
  play: async ({ canvasElement }) => {
    const icon = getPart(getRoot(canvasElement), 'icon');
    if (!icon) throw new Error('Expected an icon panel');
    const rect = icon.getBoundingClientRect();
    await expect(rect.width).toBe(48);
    await expect(rect.height).toBe(48);
    await expect(getComputedStyle(icon).borderTopStyle).toBe('solid');
    // Fractional devicePixelRatios compute authored 1px as e.g. 0.74419px; assert a real drawn border, not literal px.
    await expect(parseFloat(getComputedStyle(icon).borderTopWidth)).toBeGreaterThan(0);
    await expect(icon.querySelector('svg')?.getBoundingClientRect().width).toBe(24);
  },
};

export const WithAction: Story = {
  args: {
    icon: <FolderIcon />,
    action: (
      <Button tone="accent" onClick={fn()}>
        Create project
      </Button>
    ),
  },
  play: async ({ canvasElement }) => {
    const root = getRoot(canvasElement);
    const action = getPart(root, 'action');
    if (!action) throw new Error('Expected an action wrapper');
    await expect(partsOf(root)).toEqual(['empty-state-icon', 'empty-state-content', 'empty-state-action']);
    await expect(action).not.toHaveAttribute('aria-hidden');
    await expect(within(action).getByRole('button', { name: 'Create project' })).toBeVisible();
  },
};

export const MultipleActions: Story = {
  args: {
    icon: <FolderIcon />,
    action: (
      <>
        <Button tone="accent">Create project</Button>
        <Button variant="outline">Import</Button>
      </>
    ),
  },
  play: async ({ canvasElement }) => {
    const action = getPart(getRoot(canvasElement), 'action');
    if (!action) throw new Error('Expected an action wrapper');
    const buttons = within(action).getAllByRole('button');
    await expect(buttons.map((button) => button.textContent)).toEqual(['Create project', 'Import']);
    await expect(getComputedStyle(action).flexWrap).toBe('wrap');
    await expect(getComputedStyle(action).columnGap).toBe('12px');
  },
};

export const Inline: Story = {
  args: {
    variant: 'inline',
    title: 'No invoices',
    description: 'Invoices appear after the first payment.',
    icon: <FolderIcon />,
    action: <Button variant="outline">View plans</Button>,
  },
  render: (args) => (
    <>
      <div css={wideStyle}>
        <EmptyState {...args} />
      </div>
      <div css={narrowStyle}>
        <EmptyState {...args} />
      </div>
    </>
  ),
  play: async ({ canvasElement }) => {
    const [wide, narrow] = [getRoot(canvasElement, 0), getRoot(canvasElement, 1)];
    await expect(wide).toHaveAttribute('data-variant', 'inline');
    await expect(getComputedStyle(wide).flexDirection).toBe('row');
    await expect(getComputedStyle(wide).textAlign).toBe('start');

    // Wide: icon, copy and action share one row.
    const wideContent = getPart(wide, 'content')!.getBoundingClientRect();
    const wideAction = getPart(wide, 'action')!.getBoundingClientRect();
    await expect(wideAction.top).toBeLessThan(wideContent.bottom);

    // Narrow: the action wraps below the copy without a viewport breakpoint.
    const narrowContent = getPart(narrow, 'content')!.getBoundingClientRect();
    const narrowAction = getPart(narrow, 'action')!;
    await expect(narrowAction.getBoundingClientRect().top).toBeGreaterThanOrEqual(narrowContent.bottom);
    const button = within(narrowAction).getByRole('button');
    await expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(32);
    await expect(narrow.scrollWidth).toBeLessThanOrEqual(narrow.clientWidth);
  },
};

export const Centered: Story = {
  args: { icon: <FolderIcon />, action: <Button tone="accent">Create project</Button> },
  play: async ({ canvasElement }) => {
    const root = getRoot(canvasElement);
    const style = getComputedStyle(root);
    await expect(style.flexDirection).toBe('column');
    await expect(style.alignItems).toBe('center');
    await expect(style.textAlign).toBe('center');
    await expect(style.paddingBlockStart).toBe('32px');
    await expect(style.paddingInlineStart).toBe('20px');
    const rootRect = root.getBoundingClientRect();
    const iconRect = getPart(root, 'icon')!.getBoundingClientRect();
    const rootCenter = rootRect.left + rootRect.width / 2;
    await expect(iconRect.left + iconRect.width / 2).toBeCloseTo(rootCenter, 0);
  },
};

export const HeadingLevel: Story = {
  args: { headingLevel: 2 },
  play: async ({ canvas }) => {
    const heading = canvas.getByRole('heading', { level: 2, name: 'No projects yet' });
    await expect(heading.tagName).toBe('H2');
    await expect(canvas.queryByRole('heading', { level: 3 })).toBeNull();
  },
};

const NO_MATCHES_SOURCE = `<EmptyState
  title="No matches"
  description="Clear the filters or change the search."
  action={
    <Button variant="outline" onClick={clearFilters}>
      Clear filters
    </Button>
  }
/>`;

export const NoMatches: Story = {
  parameters: { docs: { source: { code: NO_MATCHES_SOURCE } } },
  args: {
    title: 'No matches',
    description: 'Clear the filters or change the search.',
    icon: <SearchIcon />,
    action: <Button variant="outline">Clear filters</Button>,
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { name: 'No matches' })).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Clear filters' })).toBeVisible();
  },
};

export const FirstRun: Story = {
  args: {
    title: 'Create your first board',
    description: 'Boards group tasks by stage.',
    icon: <FolderIcon />,
    action: (
      <>
        <Button tone="accent">New board</Button>
        <Button variant="ghost" render={(props) => <a {...props} href="#templates" />}>
          Browse templates
        </Button>
      </>
    ),
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: 'New board' })).toBeVisible();
    await expect(canvas.getByRole('link', { name: 'Browse templates' })).toHaveAttribute('href', '#templates');
  },
};

const inviteRef = fn();

function InviteState(props: EmptyStateProps) {
  const [sent, setSent] = useState(false);
  return sent ? (
    <EmptyState
      {...props}
      icon={<CheckIcon />}
      title="Invite sent"
      description="ana@example.com can join the workspace now."
      action={<Button onClick={() => setSent(false)}>Invite another</Button>}
    />
  ) : (
    <EmptyState
      {...props}
      icon={<FolderIcon />}
      title="No teammates yet"
      description="Invite someone to share this workspace."
      action={<Button onClick={() => setSent(true)}>Send invite</Button>}
    />
  );
}
InviteState.displayName = 'InviteState';

export const SuccessUpdate: Story = {
  args: { ref: inviteRef },
  argTypes: { ref: { control: false } },
  render: (args) => <InviteState {...args} />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    const root = getRoot(canvasElement);
    // The ref received the rendered section itself, and nothing else.
    await expect(inviteRef.mock.calls[0]?.[0]).toBe(root);
    await expect(inviteRef.mock.lastCall?.[0]).toBe(root);
    await expect(inviteRef.mock.calls.every(([node]) => node === root || node === null)).toBe(true);
    const refCallsBeforeUpdate = inviteRef.mock.calls.length;

    const button = canvas.getByRole('button', { name: 'Send invite' });
    focusCanvasStart(canvasElement);
    await userEvent.tab();
    await expect(button).toHaveFocus();
    await userEvent.keyboard('{Enter}');

    // Same section and button nodes; the copy is replaced in place with no outgoing duplicate.
    await expect(canvas.getByRole('heading', { name: 'Invite sent' })).toBeVisible();
    await expect(getRoot(canvasElement)).toBe(root);
    // The ref was neither detached nor re-attached by the update.
    await expect(inviteRef).toHaveBeenCalledTimes(refCallsBeforeUpdate);
    await expect(inviteRef.mock.lastCall?.[0]).toBe(root);
    await expect(canvas.queryByText('No teammates yet')).toBeNull();
    await expect(canvas.queryByText('Invite someone to share this workspace.')).toBeNull();
    await expect(canvas.getAllByRole('heading')).toHaveLength(1);
    // Focus stays where the user left it; the component never moves it.
    await expect(canvasElement.ownerDocument.activeElement).toBe(button);
    await expect(button).toHaveTextContent('Invite another');
    await expect(root.getAttribute('aria-describedby')).toBe(canvas.getByText(/can join/).id);
  },
};

export const LongCopy: Story = {
  args: {
    icon: <FolderIcon />,
    title: 'Nothing has been shared with this workspace during the selected reporting period',
    description:
      'Shared files, folders and links from every teammate land here once someone posts them, including attachments forwarded from https://files.example.com/workspaces/archive/2026/october.',
    action: <Button variant="outline">Change period</Button>,
  },
  render: (args) => (
    <div css={narrowStyle}>
      <EmptyState {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const root = getRoot(canvasElement);
    const heading = within(root).getByRole('heading');
    const description = root.querySelector('p')!;
    for (const element of [root, heading, description]) {
      await expect(element.scrollWidth).toBeLessThanOrEqual(element.clientWidth);
      await expect(getComputedStyle(element).textOverflow).not.toBe('ellipsis');
    }
    // Wrapped, not clipped: the heading spans more than one line.
    await expect(heading.getBoundingClientRect().height).toBeGreaterThan(
      parseFloat(getComputedStyle(heading).lineHeight),
    );
  },
};

export const EmptyDescription: Story = {
  render: (args) => (
    <>
      <EmptyState {...args} description={null} icon={false} action={null} />
      <EmptyState {...args} description={false} aria-describedby="empty-external" />
      <p id="empty-external">Archived projects are listed under Settings.</p>
    </>
  ),
  play: async ({ canvasElement }) => {
    const [first, second] = [getRoot(canvasElement, 0), getRoot(canvasElement, 1)];
    for (const root of [first, second]) {
      await expect(partsOf(root)).toEqual(['empty-state-content']);
      await expect(root.querySelector('p')).toBeNull();
    }
    await expect(first).not.toHaveAttribute('aria-describedby');
    await expect(second).toHaveAttribute('aria-describedby', 'empty-external');
  },
};

const FALSY_NODES = [false, null] as const;
const FALSY_LABELS = ['Archived projects', 'Shared projects'] as const;

/** Every id referenced by the root's ARIA relationships resolves to an element in the document. */
async function expectResolvedIdRefs(root: HTMLElement) {
  for (const attribute of ['aria-labelledby', 'aria-describedby']) {
    for (const id of root.getAttribute(attribute)?.split(' ') ?? []) {
      await expect(root.ownerDocument.getElementById(id)).not.toBeNull();
    }
  }
}

export const FalsySlots: Story = {
  args: { icon: <FolderIcon />, action: <Button variant="outline">Create project</Button> },
  render: (args) => (
    <>
      {FALSY_NODES.map((value, index) => (
        <Fragment key={String(value)}>
          <h2 id={`falsy-${value}-label`}>{FALSY_LABELS[index]}</h2>
          <EmptyState {...args} title={value} aria-labelledby={`falsy-${value}-label`} />
          <EmptyState {...args} icon={value} description={value} action={value} />
        </Fragment>
      ))}
    </>
  ),
  play: async ({ canvasElement }) => {
    for (const [index, value] of FALSY_NODES.entries()) {
      const [untitled, bare] = [getRoot(canvasElement, index * 2), getRoot(canvasElement, index * 2 + 1)];

      // title={value}: no heading, and the named region references only the consumer label.
      await expect(within(untitled).queryByRole('heading')).toBeNull();
      await expect(untitled).toHaveAttribute('aria-labelledby', `falsy-${value}-label`);
      await expect(untitled).toHaveAccessibleName(FALSY_LABELS[index]);
      await expect(untitled).toHaveAttribute('aria-describedby', untitled.querySelector('p')!.id);
      await expectResolvedIdRefs(untitled);

      // icon/description/action={value}: no wrappers and no description relationship.
      await expect(partsOf(bare)).toEqual(['empty-state-content']);
      await expect(getPart(bare, 'icon')).toBeNull();
      await expect(getPart(bare, 'action')).toBeNull();
      await expect(bare.querySelector('p')).toBeNull();
      await expect(bare).not.toHaveAttribute('aria-describedby');
      await expect(bare).not.toHaveAttribute('aria-labelledby');
      await expect(within(bare).getByRole('heading', { level: 3 })).toHaveTextContent('No projects yet');
      await expectResolvedIdRefs(bare);
    }
  },
};

export const ZeroContent: Story = {
  args: { title: 0, description: 0, icon: 0, action: 0 },
  play: async ({ canvasElement }) => {
    const root = getRoot(canvasElement);
    await expect(partsOf(root)).toEqual(['empty-state-icon', 'empty-state-content', 'empty-state-action']);
    await expect(within(root).getByRole('heading', { level: 3 })).toHaveTextContent('0');
    await expect(root.querySelector('p')).toHaveTextContent('0');
    await expect(getPart(root, 'icon')).toHaveTextContent('0');
    await expect(getPart(root, 'action')).toHaveTextContent('0');
  },
};

export const ExternalAria: Story = {
  render: (args) => (
    <>
      <EmptyState {...args} aria-describedby="quota-hint" />
      <p id="quota-hint">Free workspaces hold up to 3 projects.</p>
      <EmptyState {...args} title="No archived projects" aria-describedby="quota-hint" />
    </>
  ),
  play: async ({ canvasElement }) => {
    const [first, second] = [getRoot(canvasElement, 0), getRoot(canvasElement, 1)];
    const [firstDescription, secondDescription] = [first.querySelector('p')!, second.querySelector('p')!];
    await expect(first.getAttribute('aria-describedby')?.split(' ')).toEqual(['quota-hint', firstDescription.id]);
    await expect(first).toHaveAccessibleDescription(
      'Free workspaces hold up to 3 projects. Create a project to start tracking work.',
    );
    // Each instance wires its own ids.
    await expect(firstDescription.id).not.toBe(secondDescription.id);
    await expect(within(first).getByRole('heading').id).not.toBe(within(second).getByRole('heading').id);
    await expect(second.getAttribute('aria-describedby')?.split(' ')).toEqual(['quota-hint', secondDescription.id]);
  },
};

export const NamedRegion: Story = {
  render: (args) => (
    <>
      <h2 id="projects-heading">Projects</h2>
      <EmptyState {...args} aria-labelledby="projects-heading" />
      <EmptyState
        {...args}
        aria-label="Search results"
        title="No matches"
        description="Clear the filters or change the search."
        action={<Button variant="outline">Clear filters</Button>}
      />
    </>
  ),
  play: async ({ canvas }) => {
    const projects = canvas.getByRole('region', { name: 'Projects No projects yet' });
    const title = within(projects).getByRole('heading', { level: 3 });
    await expect(projects.getAttribute('aria-labelledby')?.split(' ')).toEqual(['projects-heading', title.id]);
    const search = canvas.getByRole('region', { name: 'Search results' });
    await expect(search).not.toHaveAttribute('aria-labelledby');
    await expect(canvas.queryByRole('status')).toBeNull();
    await expect(canvas.queryByRole('alert')).toBeNull();
  },
};

const consumerRootStyle = css({ paddingBlock: vars.space[2] });
const sxRootStyle = css({ paddingBlock: vars.space[3] });
const slotTitleStyle = css({ textTransform: 'uppercase' });
const slotDescriptionStyle = css({ fontStyle: 'italic' });

export const ConsumerStylePrecedence: Story = {
  parameters: {
    docs: {
      source: {
        code: `<EmptyState
  title="Consumer styles"
  className="consumer-empty"
  css={css({ paddingBlock: vars.space[2] })}
  sx={css({ paddingBlock: vars.space[3] })}
  slotProps={{
    title: { className: 'slot-title', css: css({ textTransform: 'uppercase' }) },
    description: { className: 'slot-description', css: css({ fontStyle: 'italic' }) },
  }}
/>`,
      },
    },
  },
  render: (args) => (
    <>
      <EmptyState {...args} />
      <EmptyState
        {...args}
        title="Consumer styles"
        className="consumer-empty"
        css={consumerRootStyle}
        slotProps={{
          title: { className: 'slot-title', css: slotTitleStyle },
          description: { className: 'slot-description', css: slotDescriptionStyle },
        }}
      />
      <EmptyState {...args} title="Sx styles" css={consumerRootStyle} sx={sxRootStyle} />
    </>
  ),
  play: async ({ canvasElement }) => {
    const [plain, consumer, withSx] = [0, 1, 2].map((index) => getRoot(canvasElement, index));
    await expect(getComputedStyle(plain!).paddingBlockStart).toBe('32px');
    await expect(consumer).toHaveClass('consumer-empty');
    await expect(getComputedStyle(consumer!).paddingBlockStart).toBe('8px');
    await expect(getComputedStyle(withSx!).paddingBlockStart).toBe('12px');

    const title = within(consumer!).getByRole('heading');
    await expect(title).toHaveClass('slot-title');
    await expect(getComputedStyle(title).textTransform).toBe('uppercase');
    await expect(getComputedStyle(title).fontWeight).toBe('500');
    const description = consumer!.querySelector('p')!;
    await expect(description).toHaveClass('slot-description');
    await expect(getComputedStyle(description).fontStyle).toBe('italic');
  },
};

export const LightTheme: Story = {
  decorators: [withLightTheme],
  args: { icon: <FolderIcon />, action: <Button tone="accent">Create project</Button> },
  render: (args) => (
    <>
      {VARIANTS.map((variant) => (
        <EmptyState {...args} key={variant} variant={variant} />
      ))}
    </>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getAllByRole('heading', { level: 3 })).toHaveLength(VARIANTS.length);
  },
};

export const RTL: Story = {
  args: {
    dir: 'rtl',
    lang: 'ar',
    variant: 'inline',
    title: 'لا توجد مشاريع',
    description: 'أنشئ مشروعًا لبدء تتبع العمل.',
    icon: <FolderIcon />,
    action: (
      <>
        <Button tone="accent">مشروع جديد</Button>
        <Button variant="outline">استيراد</Button>
      </>
    ),
  },
  render: (args) => (
    <div css={wideStyle}>
      <EmptyState {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const root = getRoot(canvasElement);
    await expect(root).toHaveAttribute('dir', 'rtl');
    const rootRect = root.getBoundingClientRect();
    const iconRect = getPart(root, 'icon')!.getBoundingClientRect();
    // The icon sits on the inline-start (right) edge, inside the 20px inline padding.
    await expect(rootRect.right - iconRect.right).toBeCloseTo(20, 0);
    // DOM order is kept; the first action renders to the right of the second.
    const [first, second] = within(root).getAllByRole('button');
    await expect(first!.getBoundingClientRect().left).toBeGreaterThan(second!.getBoundingClientRect().left);
  },
};

export const PanelEdgeAndFocusRing: Story = {
  args: { icon: <FolderIcon />, action: <Button variant="outline">Create project</Button> },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const root = getRoot(canvasElement);
    // The icon panel edge is a real border and the action focus ring a real outline, not shadows.
    const icon = getComputedStyle(getPart(root, 'icon')!);
    await expect(icon.borderTopStyle).toBe('solid');
    await expect(parseFloat(icon.borderTopWidth)).toBeGreaterThan(0);
    const button = canvas.getByRole('button', { name: 'Create project' });
    focusCanvasStart(canvasElement);
    await userEvent.tab();
    await expect(button).toHaveFocus();
    await expect(getComputedStyle(button).outlineStyle).toBe('solid');
  },
};

export const StaticContent: Story = {
  args: { icon: <FolderIcon />, action: <Button tone="accent">Create project</Button> },
  play: async ({ canvas, canvasElement }) => {
    const root = getRoot(canvasElement);
    // The component declares no animations or transitions of its own.
    await expect(root.getAnimations({ subtree: true })).toHaveLength(0);
    for (const part of [root, ...root.querySelectorAll<HTMLElement>('[data-ui^="empty-state-"]')]) {
      await expect(getComputedStyle(part).transitionDuration).toBe('0s');
      await expect(getComputedStyle(part).animationName).toBe('none');
    }
    await expect(canvas.getByRole('button', { name: 'Create project' })).toBeVisible();
  },
};

const createProject = fn();
const importProject = fn();

export const KeyboardActions: Story = {
  args: {
    icon: <FolderIcon />,
    action: (
      <>
        <Button tone="accent" onClick={createProject}>
          Create project
        </Button>
        <Button variant="outline" onClick={importProject}>
          Import
        </Button>
      </>
    ),
  },
  play: async ({ canvasElement, userEvent }) => {
    createProject.mockClear();
    importProject.mockClear();
    const document = canvasElement.ownerDocument;
    const [create, importButton] = within(getRoot(canvasElement)).getAllByRole('button');
    if (!create || !importButton) throw new Error('Expected two actions');

    focusCanvasStart(canvasElement);
    await userEvent.tab();
    await expect(document.activeElement).toBe(create);
    await expect(getComputedStyle(create).outlineStyle).not.toBe('none');
    await userEvent.tab();
    await expect(document.activeElement).toBe(importButton);
    await expect(getComputedStyle(importButton).outlineStyle).not.toBe('none');
    await userEvent.tab({ shift: true });
    await expect(document.activeElement).toBe(create);

    await userEvent.keyboard('{Enter}');
    await expect(createProject).toHaveBeenCalledTimes(1);
    await userEvent.keyboard('[Space]');
    await expect(createProject).toHaveBeenCalledTimes(2);
    await expect(importProject).not.toHaveBeenCalled();

    // Arrows and Escape pass through untouched.
    const prevented = fn((event: KeyboardEvent) => event.defaultPrevented);
    document.addEventListener('keydown', prevented);
    try {
      await userEvent.keyboard('{ArrowDown}{ArrowRight}{Escape}');
    } finally {
      document.removeEventListener('keydown', prevented);
    }
    await expect(prevented).toHaveBeenCalledTimes(3);
    await expect(prevented.mock.results.every((result) => result.value === false)).toBe(true);
    await expect(document.activeElement).toBe(create);
    await expect(createProject).toHaveBeenCalledTimes(2);
  },
};
