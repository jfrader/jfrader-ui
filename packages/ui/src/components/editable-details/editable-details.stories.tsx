import { StrictMode, useRef, useState } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, waitFor, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { withLightTheme } from '../../testing/story-decorators';
import { Button } from '../button';
import { TextField } from '../text-field';
import { EditableDetails, type EditableDetailsEditorProps, type EditableDetailsProps } from './index';

type StoryArgs = EditableDetailsProps & {
  onItemOpenChange: (open: boolean) => void;
  onSectionOpenChange: (open: boolean) => void;
  onRefCleanup: (part: string) => void;
  onHydrationError: (error: unknown) => void;
};

const frame = css({ maxInlineSize: '36rem', inlineSize: '100%' });
const editorStyle = css({ display: 'grid', gap: vars.space[3], minInlineSize: 0 });
const meta = {
  title: 'Data display/EditableDetails',
  component: EditableDetails,
  tags: ['autodocs'],
  args: { onItemOpenChange: fn(), onSectionOpenChange: fn(), onRefCleanup: fn(), onHydrationError: fn() },
  decorators: [(Story) => <div css={frame}><Story /></div>],
  parameters: { docs: { description: { component: 'Native description lists and disclosures with application-owned editors. Enter and Space toggle disclosure buttons; Tab follows native document order. Section collapse preserves editors. Editors own drafts, validation, persistence and overlays; complete/cancel only request closure. Use InlineEdit for one independently persisted string.' } } },
} satisfies Meta<StoryArgs>;
export default meta;
type Story = StoryObj<typeof meta>;

function DraftEditor({ initialFocusRef, cancel, complete, visible, onCapture }: EditableDetailsEditorProps & { onCapture?: (complete: () => void) => void }) {
  const [draft, setDraft] = useState('Apollo');
  return <div css={editorStyle}>
    <TextField label="Project name" ref={initialFocusRef} value={draft} onChange={(event) => setDraft(event.target.value)} />
    <span data-testid="visibility">{visible ? 'Visible' : 'Hidden'}</span>
    <Button onClick={complete}>Complete</Button><Button onClick={cancel}>Cancel</Button>
    {onCapture && <Button onClick={() => onCapture(complete)}>Capture completion</Button>}
  </div>;
}

function DetailsFixture() {
  return <EditableDetails>
    <EditableDetails.Section title="Settings" defaultOpen headingLevel={2}>
      <EditableDetails.Section title="Project" defaultOpen>
        <EditableDetails.List>
          <EditableDetails.Item label="Name" renderEditor={(props) => <DraftEditor {...props} />}>Apollo</EditableDetails.Item>
          <EditableDetails.Item label="Count">{0}</EditableDetails.Item>
          <EditableDetails.Item label="Boolean">{false}</EditableDetails.Item>
          <EditableDetails.Item label="Empty">{''}</EditableDetails.Item>
        </EditableDetails.List>
      </EditableDetails.Section>
    </EditableDetails.Section>
  </EditableDetails>;
}

export const Default: Story = { render: () => <DetailsFixture />, play: async ({ canvasElement, userEvent }) => {
  const canvas = within(canvasElement);
  const section = canvas.getByRole('button', { name: 'Settings' });
  await expect(section).toHaveAttribute('aria-expanded', 'true');
  await expect(canvas.getAllByRole('term')).toHaveLength(4);
  await expect(canvas.getAllByRole('definition')).toHaveLength(4);
  await expect(canvas.getByText('0')).toBeVisible();
  await expect(canvas.queryByRole('tree')).not.toBeInTheDocument();
  await userEvent.click(canvas.getByRole('button', { name: 'Edit Name' }));
  const input = canvas.getByRole('textbox', { name: 'Project name' });
  await expect(input).toHaveFocus();
  await userEvent.clear(input); await userEvent.type(input, 'Draft');
  await userEvent.click(section);
  await expect(input).not.toBeVisible();
  await userEvent.click(section);
  await expect(input).toHaveValue('Draft');
  await expect(section).toHaveFocus();
  await userEvent.click(canvas.getByRole('button', { name: 'Cancel' }));
  await expect(canvas.getByRole('button', { name: 'Edit Name' })).toHaveFocus();
  await userEvent.click(canvas.getByRole('button', { name: 'Edit Name' }));
  await expect(canvas.getByRole('textbox', { name: 'Project name' })).toHaveValue('Apollo');
} };
export const Light: Story = { render: () => <DetailsFixture />, decorators: [withLightTheme] };
export const Rtl: Story = { render: () => <div dir="rtl"><DetailsFixture /></div> };
export const Narrow: Story = { render: () => <div style={{ inlineSize: '220px' }}><DetailsFixture /></div> };

function ControlledFixture({ onItemOpenChange }: Pick<StoryArgs, 'onItemOpenChange'>) {
  const [open, setOpen] = useState(false);
  const [requested, setRequested] = useState(false);
  return <>
    <EditableDetails><EditableDetails.List>
      <EditableDetails.Item label="Controlled" open={open} onOpenChange={(next) => { onItemOpenChange(next); setRequested(next); }} renderEditor={(props) => <DraftEditor {...props} />}>Apollo</EditableDetails.Item>
    </EditableDetails.List></EditableDetails>
    <Button onMouseDown={(event) => event.preventDefault()} onClick={() => setOpen(requested)}>Accept</Button>
    <Button onClick={() => setOpen(!open)}>External update</Button>
    <Button>Elsewhere</Button>
  </>;
}
export const ControlledRequests: Story = { render: (args) => <ControlledFixture {...args} />, play: async ({ canvasElement, userEvent, args }) => {
  const requests = args.onItemOpenChange;
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByRole('button', { name: 'Edit Controlled' }));
  await expect(requests).toHaveBeenCalledTimes(1);
  await expect(requests).toHaveBeenLastCalledWith(true);
  await expect(canvas.queryByRole('textbox')).not.toBeInTheDocument();
  await userEvent.click(canvas.getByRole('button', { name: 'Accept' }));
  await expect(canvas.getByRole('textbox')).toHaveFocus();
  await userEvent.type(canvas.getByRole('textbox'), ' retained');
  await userEvent.click(canvas.getByRole('button', { name: 'Cancel' }));
  await expect(requests).toHaveBeenCalledTimes(2);
  await expect(canvas.getByRole('textbox')).toHaveValue('Apollo retained');
  await userEvent.click(canvas.getByRole('button', { name: 'Accept' }));
  await expect(canvas.getByRole('button', { name: 'Edit Controlled' })).toHaveFocus();
  await userEvent.click(canvas.getByRole('button', { name: 'External update' }));
  await expect(canvas.getByRole('button', { name: 'External update' })).toHaveFocus();
  await expect(requests).toHaveBeenCalledTimes(2);
} };

export const NoFocusTheft: Story = { render: (args) => <ControlledFixture {...args} />, play: async ({ canvasElement, userEvent }) => {
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByRole('button', { name: 'Edit Controlled' }));
  const elsewhere = canvas.getByRole('button', { name: 'Elsewhere' });
  await userEvent.click(elsewhere);
  await userEvent.click(canvas.getByRole('button', { name: 'Accept' }));
  await expect(elsewhere).toHaveFocus();
  await expect(canvas.getByRole('textbox')).toBeVisible();
  await userEvent.click(canvas.getByRole('button', { name: 'Cancel' }));
  await userEvent.click(elsewhere);
  await userEvent.click(canvas.getByRole('button', { name: 'Accept' }));
  await expect(elsewhere).toHaveFocus();
  await expect(canvas.queryByRole('textbox')).not.toBeInTheDocument();
} };

export const DepartedCloseIntent: Story = { render: (args) => <ControlledFixture {...args} />, play: async ({ canvasElement, userEvent }) => {
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByRole('button', { name: 'Edit Controlled' }));
  await userEvent.click(canvas.getByRole('button', { name: 'Accept' }));
  await userEvent.click(canvas.getByRole('button', { name: 'Cancel' }));
  await userEvent.click(canvas.getByRole('button', { name: 'Elsewhere' }));
  await userEvent.click(canvas.getByRole('textbox'));
  await userEvent.click(canvas.getByRole('button', { name: 'Accept' }));
  await expect(canvas.getByRole('button', { name: 'Edit Controlled' })).not.toHaveFocus();
} };

function ReorderFixture() {
  const [reverse, setReverse] = useState(false);
  const [label, setLabel] = useState('Duplicate');
  const keys = reverse ? ['second', 'first'] : ['first', 'second'];
  return <><EditableDetails><EditableDetails.List>{keys.map((key) =>
    <EditableDetails.Item key={key} data-testid={key} label={label} renderEditor={(props) => <DraftEditor {...props} />}>{key}</EditableDetails.Item>
  )}</EditableDetails.List></EditableDetails>
    <Button onClick={() => { setReverse(!reverse); setLabel('Relabelled'); }}>Reorder and relabel</Button>
  </>;
}
export const IndependentKeyedSessions: Story = { render: () => <ReorderFixture />, play: async ({ canvasElement, userEvent }) => {
  const canvas = within(canvasElement);
  const first = within(canvas.getByTestId('first'));
  const second = within(canvas.getByTestId('second'));
  await userEvent.click(first.getByRole('button', { name: 'Edit Duplicate' }));
  const firstInput = first.getByRole('textbox');
  await userEvent.clear(firstInput); await userEvent.type(firstInput, 'First draft');
  await userEvent.click(second.getByRole('button', { name: 'Edit Duplicate' }));
  await userEvent.type(second.getByRole('textbox'), ' second');
  await userEvent.click(canvas.getByRole('button', { name: 'Reorder and relabel' }));
  await expect(first.getByRole('textbox')).toBe(firstInput);
  await expect(firstInput).toHaveValue('First draft');
  await expect(second.getByRole('textbox')).toHaveValue('Apollo second');
  await expect(first.getByRole('group')).toHaveAccessibleName('Relabelled');
  await userEvent.click(first.getByRole('button', { name: 'Complete' }));
  await expect(second.getByRole('textbox')).toBeVisible();
} };

function ControlledSectionFixture({ onSectionOpenChange }: Pick<StoryArgs, 'onSectionOpenChange'>) {
  const [open, setOpen] = useState(false);
  const [requested, setRequested] = useState(false);
  return <EditableDetails>
    <EditableDetails.Section title="Controlled section" open={open} onOpenChange={(next) => { onSectionOpenChange(next); setRequested(next); }}>
      <EditableDetails.List><EditableDetails.Item label="Default editor" defaultOpen renderEditor={(props) => <DraftEditor {...props} />}>Apollo</EditableDetails.Item></EditableDetails.List>
    </EditableDetails.Section>
    <Button onMouseDown={(event) => event.preventDefault()} onClick={() => setOpen(requested)}>Accept section</Button>
    <Button onMouseDown={(event) => event.preventDefault()} onClick={() => setOpen(!open)}>External section update</Button>
  </EditableDetails>;
}
export const IndependentDisclosureAxis: Story = { render: (args) => <ControlledSectionFixture {...args} />, play: async ({ canvasElement, userEvent, args }) => {
  const sectionRequests = args.onSectionOpenChange;
  const canvas = within(canvasElement);
  const trigger = canvas.getByRole('button', { name: 'Controlled section' });
  const input = canvas.getByRole('textbox', { hidden: true });
  await userEvent.click(trigger);
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(input).not.toBeVisible();
  await expect(sectionRequests).toHaveBeenCalledTimes(1);
  await userEvent.click(canvas.getByRole('button', { name: 'Accept section' }));
  await expect(input).toBeVisible();
  await expect(trigger).toHaveFocus();
  await userEvent.click(input); await userEvent.type(input, ' draft');
  await userEvent.click(canvas.getByRole('button', { name: 'External section update' }));
  await expect(trigger).toHaveFocus();
  await expect(input).not.toBeVisible();
  await expect(sectionRequests).toHaveBeenCalledTimes(1);
  await userEvent.click(canvas.getByRole('button', { name: 'External section update' }));
  await expect(input).toHaveValue('Apollo draft');
  await expect(trigger).toHaveFocus();
} };

export const KeyboardAndSurroundingForm: Story = { render: () => <form onSubmit={(event) => { event.preventDefault(); throw new Error('Disclosure/Edit must not submit'); }}><DetailsFixture /></form>, play: async ({ canvasElement, userEvent }) => {
  const canvas = within(canvasElement);
  const outer = canvas.getByRole('button', { name: 'Settings' });
  outer.focus();
  await userEvent.keyboard(' ');
  await expect(outer).toHaveAttribute('aria-expanded', 'false');
  await userEvent.keyboard('{Enter}');
  await expect(outer).toHaveAttribute('aria-expanded', 'true');
  await userEvent.tab();
  await expect(canvas.getByRole('button', { name: 'Project' })).toHaveFocus();
  await userEvent.tab();
  await expect(canvas.getByRole('button', { name: 'Edit Name' })).toHaveFocus();
  await userEvent.keyboard('{Enter}');
  await expect(canvas.getByRole('textbox')).toHaveFocus();
  await userEvent.keyboard('{ArrowDown}{Escape}');
  await expect(canvas.getByRole('textbox')).toHaveFocus();
  await userEvent.tab();
  await expect(canvas.getByRole('button', { name: 'Complete' })).toHaveFocus();
  await userEvent.tab({ shift: true });
  await expect(canvas.getByRole('textbox')).toHaveFocus();
} };

function RefFixture({ onRefCleanup }: Pick<StoryArgs, 'onRefCleanup'>) {
  const [mounted, setMounted] = useState(true);
  return <StrictMode>{mounted && <EditableDetails ref={() => () => onRefCleanup('root')}>
    <EditableDetails.Section title="Refs" defaultOpen ref={() => () => onRefCleanup('section')} triggerRef={() => () => onRefCleanup('trigger')}>
      <EditableDetails.List ref={() => () => onRefCleanup('list')}><EditableDetails.Item ref={() => () => onRefCleanup('item')} label="Ref">Value</EditableDetails.Item></EditableDetails.List>
    </EditableDetails.Section>
  </EditableDetails>}<Button onClick={() => setMounted(false)}>Unmount refs</Button></StrictMode>;
}
export const StrictModeRefCleanup: Story = { render: (args) => <RefFixture {...args} />, play: async ({ canvasElement, userEvent, args }) => {
  const before = args.onRefCleanup.mock.calls.length;
  await userEvent.click(within(canvasElement).getByRole('button', { name: 'Unmount refs' }));
  await expect(args.onRefCleanup).toHaveBeenCalledTimes(before + 5);
  await expect(args.onRefCleanup.mock.calls.slice(before)).toEqual(expect.arrayContaining(['root', 'section', 'trigger', 'list', 'item'].map((part) => [part])));
} };

export const HydrationRelationships: Story = { render: () => <DetailsFixture />, play: async ({ canvasElement, userEvent, args }) => {
  const host = canvasElement.ownerDocument.createElement('div');
  host.innerHTML = renderToString(<DetailsFixture />, { identifierPrefix: 'editable-ssr-' });
  canvasElement.append(host);
  const before = Array.from(host.querySelectorAll('[id]'), (element) => element.id);
  const errors = args.onHydrationError;
  const root = hydrateRoot(host, <DetailsFixture />, { identifierPrefix: 'editable-ssr-', onRecoverableError: errors });
  try {
    const canvas = within(host);
    await userEvent.click(canvas.getByRole('button', { name: 'Edit Name' }));
    await expect(canvas.getByRole('textbox')).toHaveFocus();
    await expect(errors).not.toHaveBeenCalled();
    const trigger = canvas.getByRole('button', { name: 'Settings' });
    await expect(host.querySelector(`[id="${trigger.getAttribute('aria-controls')}"]`)).not.toBeNull();
    await expect(before).toContain(trigger.id);
    const ids = Array.from(canvasElement.querySelectorAll('[id]'), (element) => element.id);
    await expect(new Set(ids).size).toBe(ids.length);
  } finally { root.unmount(); host.remove(); }
} };

const blueprints = { consumer: css({ paddingInline: vars.space[2] }), sx: css({ paddingInline: vars.space[3] }) };
export const StylingPrecedence: Story = { render: () => <EditableDetails css={blueprints.consumer} sx={blueprints.sx}>
  <EditableDetails.Section title="Styled section" defaultOpen css={blueprints.consumer} sx={blueprints.sx}>
    <EditableDetails.List css={blueprints.consumer} sx={blueprints.sx}>
      <EditableDetails.Item label="Styled item" css={blueprints.consumer} sx={blueprints.sx}>Value</EditableDetails.Item>
    </EditableDetails.List>
  </EditableDetails.Section>
</EditableDetails>, play: async ({ canvasElement }) => {
  for (const name of ['editable-details', 'editable-details-section', 'editable-details-list', 'editable-details-item']) {
    const root = canvasElement.querySelector<HTMLElement>(`[data-ui="${name}"]`)!;
    await expect(getComputedStyle(root).paddingInlineStart).toBe('12px');
  }
} };

function DeepSection({ depth }: { depth: number }) {
  return <EditableDetails.Section title={`Level ${depth}`} defaultOpen>{depth > 0 ? <DeepSection depth={depth - 1} /> : <EditableDetails.List>
    <EditableDetails.Item label="A very long label with many words describing a narrow configuration value">averylongunbrokenvaluethatmustwrapandnotoverflowitscontainer</EditableDetails.Item>
  </EditableDetails.List>}</EditableDetails.Section>;
}
export const DeepNarrow: Story = { render: () => <div style={{ inlineSize: '220px' }}><EditableDetails><DeepSection depth={8} /></EditableDetails></div>, play: async ({ canvasElement }) => {
  const root = canvasElement.querySelector<HTMLElement>('[data-ui="editable-details"]')!;
  await expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth);
} };

function LifetimeFixture({ onItemOpenChange }: Pick<StoryArgs, 'onItemOpenChange'>) {
  const obsolete = useRef<(() => void) | null>(null);
  const [capable, setCapable] = useState(true);
  const [mounted, setMounted] = useState(true);
  const [sectionOpen, setSectionOpen] = useState(true);
  return <StrictMode><EditableDetails>
    <EditableDetails.Section title="Lifetime" open={sectionOpen} onOpenChange={setSectionOpen}>
      <EditableDetails.List>{mounted && <EditableDetails.Item label="Session" onOpenChange={onItemOpenChange} renderEditor={capable ? (props) => {
        return <DraftEditor {...props} onCapture={(callback) => { obsolete.current = callback; }} />;
      } : undefined}>Summary</EditableDetails.Item>}</EditableDetails.List>
    </EditableDetails.Section>
    <Button onMouseDown={(event) => event.preventDefault()} onClick={() => setSectionOpen(false)}>Collapse externally</Button>
    <Button onMouseDown={(event) => event.preventDefault()} onClick={() => setCapable(!capable)}>Toggle capability</Button>
    <Button onMouseDown={(event) => event.preventDefault()} onClick={() => setMounted(!mounted)}>Toggle row</Button>
    <Button onMouseDown={(event) => event.preventDefault()} onClick={() => obsolete.current?.()}>Obsolete callback</Button>
    <Button>Elsewhere</Button>
  </EditableDetails></StrictMode>;
}
export const LifetimeAndFocus: Story = { render: (args) => <LifetimeFixture {...args} />, play: async ({ canvasElement, userEvent, args }) => {
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByRole('button', { name: 'Edit Session' }));
  await userEvent.click(canvas.getByRole('button', { name: 'Capture completion' }));
  await userEvent.click(canvas.getByRole('button', { name: 'Complete' }));
  await userEvent.click(canvas.getByRole('button', { name: 'Edit Session' }));
  await userEvent.click(canvas.getByRole('button', { name: 'Obsolete callback' }));
  await expect(canvas.getByRole('textbox')).toBeVisible();
  await expect(args.onItemOpenChange).toHaveBeenCalledTimes(3);
  await userEvent.click(canvas.getByRole('button', { name: 'Capture completion' }));
  await userEvent.click(canvas.getByRole('button', { name: 'Collapse externally' }));
  await expect(canvas.getByRole('button', { name: 'Lifetime' })).toHaveFocus();
  await userEvent.click(canvas.getByRole('button', { name: 'Lifetime' }));
  await userEvent.click(canvas.getByRole('textbox'));
  await userEvent.click(canvas.getByRole('button', { name: 'Toggle capability' }));
  await waitFor(() => expect(canvas.queryByRole('textbox')).not.toBeInTheDocument());
  await expect(canvas.getByRole('button', { name: 'Lifetime' })).toHaveFocus();
  await userEvent.click(canvas.getByRole('button', { name: 'Toggle capability' }));
  await expect(canvas.queryByRole('textbox')).not.toBeInTheDocument();
  await expect(args.onItemOpenChange).toHaveBeenCalledTimes(3);
  await userEvent.click(canvas.getByRole('button', { name: 'Edit Session' }));
  await userEvent.click(canvas.getByRole('button', { name: 'Obsolete callback' }));
  await expect(canvas.getByRole('textbox')).toBeVisible();
  await userEvent.click(canvas.getByRole('button', { name: 'Capture completion' }));
  await userEvent.click(canvas.getByRole('button', { name: 'Toggle row' }));
  await expect(canvas.getByRole('button', { name: 'Lifetime' })).toHaveFocus();
  await userEvent.click(canvas.getByRole('button', { name: 'Toggle row' }));
  await userEvent.click(canvas.getByRole('button', { name: 'Edit Session' }));
  await userEvent.click(canvas.getByRole('button', { name: 'Obsolete callback' }));
  await expect(canvas.getByRole('textbox')).toBeVisible();
  await expect(args.onItemOpenChange).toHaveBeenCalledTimes(5);
} };

export const FallbackFocus: Story = { render: () => <EditableDetails><EditableDetails.List>
  <EditableDetails.Item label="Fallback" renderEditor={({ initialFocusRef, cancel }) => <><span ref={initialFocusRef}>Not focusable</span><Button onClick={cancel}>Cancel</Button></>}>Summary</EditableDetails.Item>
</EditableDetails.List></EditableDetails>, play: async ({ canvasElement, userEvent }) => {
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByRole('button', { name: 'Edit Fallback' }));
  const host = canvas.getByRole('group', { name: 'Fallback' });
  await expect(host).toHaveFocus();
  await expect(host).toHaveAttribute('tabindex', '-1');
  await expect(getComputedStyle(host).outlineStyle).not.toBe('none');
  await userEvent.keyboard('{Escape}');
  await expect(host).toBeVisible();
} };

export const MissingFocusTarget: Story = {
  ...FallbackFocus,
  render: () => <EditableDetails><EditableDetails.List>
    <EditableDetails.Item label="Fallback" renderEditor={({ cancel }) => <Button onClick={cancel}>Cancel</Button>}>Summary</EditableDetails.Item>
  </EditableDetails.List></EditableDetails>,
};

function InitiallyOpenFixture({ onItemOpenChange }: Pick<StoryArgs, 'onItemOpenChange'>) {
  const [capable, setCapable] = useState(true);
  return <>
    <Button autoFocus onClick={() => setCapable(!capable)}>Toggle editor permission</Button>
    <EditableDetails><EditableDetails.List>
      <EditableDetails.Item label="Seeded session" defaultOpen onOpenChange={onItemOpenChange}
        renderEditor={capable ? (props) => <DraftEditor {...props} /> : undefined}>Apollo</EditableDetails.Item>
    </EditableDetails.List></EditableDetails>
  </>;
}

export const InitialOpenAndCapabilityReset: Story = {
  render: (args) => <InitiallyOpenFixture {...args} />,
  play: async ({ canvas, userEvent, args }) => {
    const permission = canvas.getByRole('button', { name: 'Toggle editor permission' });
    await expect(permission).toHaveFocus();
    await expect(canvas.getByRole('textbox')).toBeVisible();
    await userEvent.type(canvas.getByRole('textbox'), ' draft');
    await userEvent.click(permission);
    await expect(canvas.queryByRole('textbox')).not.toBeInTheDocument();
    await userEvent.click(permission);
    await expect(canvas.queryByRole('textbox')).not.toBeInTheDocument();
    await expect(args.onItemOpenChange).not.toHaveBeenCalled();
    await userEvent.click(canvas.getByRole('button', { name: 'Edit Seeded session' }));
    await expect(canvas.getByRole('textbox')).toHaveValue('Apollo');
    await expect(args.onItemOpenChange).toHaveBeenCalledTimes(1);
  },
};

export const RemovedRowWithoutFocusTheft: Story = {
  render: (args) => <LifetimeFixture {...args} />,
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Edit Session' }));
    const elsewhere = canvas.getByRole('button', { name: 'Elsewhere' });
    await userEvent.click(elsewhere);
    await userEvent.click(canvas.getByRole('button', { name: 'Toggle row' }));
    await expect(canvas.queryByRole('textbox')).not.toBeInTheDocument();
    await expect(elsewhere).toHaveFocus();
    await expect(args.onItemOpenChange).toHaveBeenCalledTimes(1);
  },
};

function RemovedSubsectionFixture() {
  const [mounted, setMounted] = useState(true);
  return <EditableDetails>
    <EditableDetails.Section title="Surviving section" headingLevel={2} defaultOpen>
      {mounted && <EditableDetails.Section title="Removed subsection" defaultOpen>
        <EditableDetails.List><EditableDetails.Item label="Name" renderEditor={(props) => <DraftEditor {...props} />}>Apollo</EditableDetails.Item></EditableDetails.List>
      </EditableDetails.Section>}
    </EditableDetails.Section>
    <Button onMouseDown={(event) => event.preventDefault()} onClick={() => setMounted(false)}>Remove subsection</Button>
  </EditableDetails>;
}

export const SurvivingAncestorFocus: Story = {
  render: () => <RemovedSubsectionFixture />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Edit Name' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Remove subsection' }));
    await expect(canvas.queryByRole('textbox')).not.toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Surviving section' })).toHaveFocus();
  },
};
