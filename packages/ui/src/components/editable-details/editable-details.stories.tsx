import { StrictMode, useRef, useState } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, mocked, waitFor, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { withLightTheme } from '../../testing/story-decorators';
import { Button } from '../button';
import { TextField } from '../text-field';
import {
  EditableDetails,
  type EditableDetailsCompoundProps,
  type EditableDetailsEasyProps,
  type EditableDetailsEditorProps,
  type EditableDetailsSectionRecord,
} from './index';

type StoryArgs = EditableDetailsCompoundProps & {
  onItemOpenChange: (open: boolean) => void;
  onSectionOpenChange: (open: boolean) => void;
  onRefCleanup: (part: string) => void;
  onHydrationError: (error: unknown) => void;
};

const frame = css({ maxInlineSize: '36rem', inlineSize: '100%', marginInline: 'auto' });
const editorStyle = css({ display: 'grid', gap: vars.space[3], minInlineSize: 0 });
const meta = {
  title: 'Data display/EditableDetails',
  component: EditableDetails,
  tags: ['autodocs'],
  args: { onItemOpenChange: fn(), onSectionOpenChange: fn(), onRefCleanup: fn(), onHydrationError: fn() },
  decorators: [(Story) => <div css={frame}><Story /></div>],
  parameters: {
    layout: 'padded',
    docs: {
      description: { component: 'Show grouped details and edit selected values in place with your own forms.' },
      usage: `### Composition
Pass \`sections\` to render grouped details from structured data. Each section record provides \`value\`, \`title\`, \`items\`, and optional \`headingLevel\`, \`open\`, \`defaultOpen\`, and \`onOpenChange\`. Each item record provides \`value\`, \`label\`, \`content\`, and optional \`renderEditor\`, \`open\`, \`defaultOpen\`, and \`onOpenChange\`.

Do not combine \`sections\` with \`children\`. Use \`slotProps.root\`, \`slotProps.section\`, \`slotProps.list\`, and \`slotProps.item\` for part props, or \`slots\` to replace generated parts. \`component\` is sugar for \`slots.root\`. For custom hierarchy, keep the compound parts (\`EditableDetails.Section\`, \`EditableDetails.List\`, \`EditableDetails.Item\`).

### Structure and editing
- Use Lists for labelled values and Sections for groups of lists or nested sections. Rows use native description-list semantics.
- Section disclosure and Item editing are independent. Each supports \`open\`, \`defaultOpen\` and \`onOpenChange\`.
- Supply an editor through \`renderEditor\`. Your editor owns its draft, validation, confirmation, saving and errors. \`complete\` and \`cancel\` only request closure.
- Collapsing a section keeps mounted editors and drafts. Use \`visible\` to suppress portaled pickers or dialogs, and coordinate their focus before collapse.
- Use InlineEdit when you only need to edit and save one string.

### Keyboard and forms
- Press Enter or Space to toggle a section. Tab and Shift+Tab follow the document order. Pickers and editors keep their own keyboard behavior.
- Attach \`initialFocusRef\` to the field that should receive focus after Edit. The labelled editor group is the fallback.
- Do not nest a native form editor inside another form. Use form-associated controls or a non-form editor there.
- Keep React Action drafts in controlled fields: React resets uncontrolled fields after an Action resolves, even when it returns a validation error.`,
      source: {
        language: 'tsx',
        code: `const sections = [
  {
    value: 'project',
    title: 'Project settings',
    items: [
      {
        value: 'name',
        label: 'Project name',
        content: 'Apollo',
        renderEditor: (editor) => <ProjectNameEditor {...editor} />,
      },
      {
        value: 'budget',
        label: 'Budget',
        content: '$50,000',
      },
    ],
  },
];

<EditableDetails sections={sections} />`,
      },
    },
  },
} satisfies Meta<StoryArgs>;
export default meta;
type Story = StoryObj<Meta<StoryArgs>>;
type EasyStory = StoryObj<Meta<EditableDetailsEasyProps>>;

function DraftEditor({ initialFocusRef, cancel, complete, visible, onCapture }: EditableDetailsEditorProps & { onCapture?: (complete: () => void) => void }) {
  const [draft, setDraft] = useState('Apollo');
  return <div css={editorStyle}>
    <TextField label="Project name" ref={initialFocusRef} value={draft} onChange={(event) => setDraft(event.target.value)} />
    <span data-testid="visibility">{visible ? 'Visible' : 'Hidden'}</span>
    <Button onClick={complete}>Complete</Button><Button onClick={cancel}>Cancel</Button>
    {onCapture && <Button onClick={() => onCapture(complete)}>Capture completion</Button>}
  </div>;
}

const EASY_SECTIONS: readonly EditableDetailsSectionRecord[] = [
  {
    value: 'settings',
    title: 'Settings',
    defaultOpen: true,
    headingLevel: 2,
    items: [
      {
        value: 'name',
        label: 'Name',
        content: 'Apollo',
        renderEditor: (props) => <DraftEditor {...props} />,
      },
      {
        value: 'count',
        label: 'Active projects',
        content: 0,
      },
      {
        value: 'visibility',
        label: 'Visibility',
        content: 'Private',
      },
      {
        value: 'region',
        label: 'Region',
        content: 'Europe',
      },
    ],
  },
];

export const Default: EasyStory = {
  name: 'Easy mode',
  args: {
    sections: EASY_SECTIONS,
  },
  render: (args) => <EditableDetails {...args} />,
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    const section = canvas.getByRole('button', { name: 'Settings' });
    await expect(section).toHaveAttribute('aria-expanded', 'true');
    await expect(canvas.getAllByRole('term')).toHaveLength(4);
    await expect(canvas.getAllByRole('definition')).toHaveLength(4);
    await expect(canvas.getByText('0')).toBeVisible();
    await expect(canvas.queryByRole('tree')).not.toBeInTheDocument();

    // Toggle section with keyboard
    await section.focus();
    await userEvent.keyboard('{Enter}');
    await expect(section).toHaveAttribute('aria-expanded', 'false');
    await userEvent.keyboard(' ');
    await expect(section).toHaveAttribute('aria-expanded', 'true');

    // Activate item edit
    await userEvent.click(canvas.getByRole('button', { name: 'Edit Name' }));
    const input = canvas.getByRole('textbox', { name: 'Project name' });
    await expect(input).toHaveFocus();
    await userEvent.clear(input);
    await userEvent.type(input, 'Draft');

    // Toggle section while editing keeps draft
    await userEvent.click(section);
    await expect(input).not.toBeVisible();
    await userEvent.click(section);
    await expect(input).toHaveValue('Draft');
    await expect(section).toHaveFocus();

    // Cancel dismisses editor and returns focus to Edit button
    await userEvent.click(canvas.getByRole('button', { name: 'Cancel' }));
    await expect(canvas.getByRole('button', { name: 'Edit Name' })).toHaveFocus();

    // Reopen and complete
    await userEvent.click(canvas.getByRole('button', { name: 'Edit Name' }));
    await expect(canvas.getByRole('textbox', { name: 'Project name' })).toHaveFocus();
    await userEvent.click(canvas.getByRole('button', { name: 'Complete' }));
    await expect(canvas.getByRole('button', { name: 'Edit Name' })).toHaveFocus();
  },
};

export const EasyFalsyContent: EasyStory = {
  tags: ['!autodocs'],
  args: { sections: [{ value: 'values', title: 'Values', defaultOpen: true, items: [
    { value: 'zero', label: 'Zero', content: 0 },
    { value: 'false', label: 'False', content: false },
    { value: 'empty', label: 'Empty', content: '' },
  ] }] },
  render: (args) => <EditableDetails {...args} />,
  play: async ({ canvas }) => {
    const values = canvas.getAllByRole('definition');
    await expect(values).toHaveLength(3);
    await expect(values.map((value) => value.textContent)).toEqual(['0', '', '']);
  },
};

function ControlledEasyFixture() {
  const [sectionOpen, setSectionOpen] = useState(true);
  const [itemOpen, setItemOpen] = useState(false);
  const controlledSections: readonly EditableDetailsSectionRecord[] = [
    {
      value: 'profile',
      title: 'Profile',
      open: sectionOpen,
      onOpenChange: setSectionOpen,
      items: [
        {
          value: 'handle',
          label: 'Handle',
          content: '@apollo',
          open: itemOpen,
          onOpenChange: setItemOpen,
          renderEditor: (props) => <DraftEditor {...props} />,
        },
      ],
    },
  ];
  return <EditableDetails sections={controlledSections} />;
}

export const EasyModeControlled: StoryObj = {
  name: 'Easy mode controlled',
  render: () => <ControlledEasyFixture />,
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    const section = canvas.getByRole('button', { name: 'Profile' });
    await expect(section).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(canvas.getByRole('button', { name: 'Edit Handle' }));
    await expect(canvas.getByRole('textbox', { name: 'Project name' })).toHaveFocus();
    await userEvent.click(canvas.getByRole('button', { name: 'Cancel' }));
    await expect(canvas.getByRole('button', { name: 'Edit Handle' })).toHaveFocus();
  },
};

export const EasyModeSlotPropsOverrides: EasyStory = {
  name: 'Easy mode slotProps overrides',
  args: {
    sections: EASY_SECTIONS,
    slotProps: {
      root: { className: 'custom-root-slot', 'data-testid': 'custom-root' },
      section: { className: 'custom-section-slot' },
      list: { className: 'custom-list-slot' },
      item: { className: 'custom-item-slot' },
    },
  },
  render: (args) => <EditableDetails {...args} />,
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('[data-ui~="editable-details"]');
    await expect(root).toHaveClass('custom-root-slot');
    const section = canvasElement.querySelector('[data-ui="editable-details-section"]');
    await expect(section).toHaveClass('custom-section-slot');
    const list = canvasElement.querySelector('[data-ui="editable-details-list"]');
    await expect(list).toHaveClass('custom-list-slot');
    const item = canvasElement.querySelector('[data-ui="editable-details-item"]');
    await expect(item).toHaveClass('custom-item-slot');
  },
};

export const RootPropMerge: EasyStory = {
  name: 'Root prop merge',
  args: {
    sections: EASY_SECTIONS,
    id: 'host-id',
    'data-origin': 'host',
    className: 'host-class',
    style: { paddingBlock: vars.space[4], fontWeight: 400 },
    onClick: fn(),
    ref: fn(),
    slotProps: {
      root: {
        id: 'slot-id',
        'data-origin': 'slot',
        className: 'slot-class',
        style: { paddingInline: vars.space[5], fontWeight: 600 },
        onClick: fn(),
        ref: fn(),
      },
    },
  },
  render: (args) => <EditableDetails {...args} />,
  play: async ({ canvasElement, args, userEvent }) => {
    const root = canvasElement.querySelector<HTMLElement>('[data-ui~="editable-details"]');
    if (!root) throw new Error('Missing EditableDetails root.');
    await expect(root).toHaveAttribute('id', 'slot-id');
    await expect(root).toHaveAttribute('data-origin', 'slot');
    await expect(root).toHaveClass('host-class');
    await expect(root).toHaveClass('slot-class');
    await expect(root.style.paddingBlock).toBe(vars.space[4]);
    await expect(root.style.paddingInline).toBe(vars.space[5]);
    await expect(root.style.fontWeight).toBe('600');
    await expect(args.slotProps!.root!.ref).toHaveBeenCalledWith(root);
    await userEvent.click(root);
    await expect(args.onClick).not.toHaveBeenCalled();
    await expect(args.slotProps!.root!.onClick).toHaveBeenCalled();
  },
};

function easyModeTypeContracts() {
  // @ts-expect-error Presentation mode rejects compound children.
  <EditableDetails sections={EASY_SECTIONS}>Compound</EditableDetails>;
  <EditableDetails />;
  // @ts-expect-error Section record requires value, title, and items.
  <EditableDetails sections={[{ title: 'Settings' }]} />;
  // @ts-expect-error Item record requires value, label, and content.
  <EditableDetails sections={[{ value: 's', title: 'Settings', items: [{ label: 'L' }] }]} />;
}
void easyModeTypeContracts;

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

export const Compound: Story = {
  name: 'Compound anatomy',
  render: () => <DetailsFixture />,
  play: async ({ canvasElement, userEvent }) => {
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
  },
};
export const Light: Story = { render: () => <DetailsFixture />, decorators: [withLightTheme] };
export const Rtl: Story = { render: () => <div dir="rtl"><DetailsFixture /></div> };
export const Narrow: Story = { render: () => <div style={{ inlineSize: '220px' }}><DetailsFixture /></div> };

export const SeparatorRhythm: Story = {
  render: () => <EditableDetails>
    <EditableDetails.Section title="Identity" defaultOpen headingLevel={2}>
      <EditableDetails.List>
        <EditableDetails.Item label="Project">Apollo</EditableDetails.Item>
        <EditableDetails.Item label="Owner">Flight operations</EditableDetails.Item>
      </EditableDetails.List>
    </EditableDetails.Section>
    <EditableDetails.Section title="Delivery" defaultOpen headingLevel={2}>
      <EditableDetails.Section title="Notifications" defaultOpen>
        <EditableDetails.List><EditableDetails.Item label="Email">Enabled</EditableDetails.Item></EditableDetails.List>
      </EditableDetails.Section>
      <EditableDetails.Section title="Empty section" defaultOpen />
    </EditableDetails.Section>
    <EditableDetails.List>
      <EditableDetails.Item label="Revision">3</EditableDetails.Item>
      <EditableDetails.Item label="Archived">No</EditableDetails.Item>
    </EditableDetails.List>
  </EditableDetails>,
  play: async ({ canvas, canvasElement, userEvent }) => {
    for (const list of canvasElement.querySelectorAll('dl')) {
      const rows = Array.from(list.children);
      for (const [index, row] of rows.entries()) {
        const style = getComputedStyle(row);
        await expect(style.borderBlockStartWidth).toBe('0px');
        await expect(style.borderBlockEndWidth).toBe(index === rows.length - 1 ? '0px' : '1px');
      }
    }
    for (const section of canvasElement.querySelectorAll('section')) {
      await expect(getComputedStyle(section).borderBlockEndWidth).toBe('0px');
    }
    const heading = canvas.getByRole('button', { name: 'Identity' });
    const label = canvas.getByText('Project');
    await expect(getComputedStyle(heading).paddingInlineStart).toBe('0px');
    await expect(heading.getBoundingClientRect().left).toBe(label.getBoundingClientRect().left);
    await expect(Number(getComputedStyle(heading).fontWeight)).toBeGreaterThan(Number(getComputedStyle(label).fontWeight));
    await userEvent.click(canvas.getByRole('button', { name: 'Delivery' }));
    await expect(canvas.getByRole('button', { name: 'Delivery' })).toHaveAttribute('aria-expanded', 'false');
    await expect(canvas.queryByRole('button', { name: 'Notifications' })).not.toBeInTheDocument();
  },
};

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
  const before = mocked(args.onRefCleanup).mock.calls.length;
  await userEvent.click(within(canvasElement).getByRole('button', { name: 'Unmount refs' }));
  await expect(args.onRefCleanup).toHaveBeenCalledTimes(before + 5);
  await expect(mocked(args.onRefCleanup).mock.calls.slice(before)).toEqual(expect.arrayContaining(['root', 'section', 'trigger', 'list', 'item'].map((part) => [part])));
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

function RevokedRequestFixture({ onItemOpenChange }: Pick<StoryArgs, 'onItemOpenChange'>) {
  const [capable, setCapable] = useState(true);
  const [open, setOpen] = useState(false);
  return <>
    <EditableDetails><EditableDetails.List>
      <EditableDetails.Item label="Permission" open={open} onOpenChange={onItemOpenChange}
        renderEditor={capable ? (props) => <DraftEditor {...props} /> : undefined}>Apollo</EditableDetails.Item>
    </EditableDetails.List></EditableDetails>
    <Button onMouseDown={(event) => event.preventDefault()} onClick={() => setCapable(!capable)}>Change permission</Button>
    <Button onMouseDown={(event) => event.preventDefault()} onClick={() => setOpen(true)}>Open externally</Button>
  </>;
}

export const RevokedRequestDropsFocusIntent: Story = {
  render: (args) => <RevokedRequestFixture {...args} />,
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Edit Permission' }));
    await expect(canvas.queryByRole('textbox')).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: 'Change permission' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Change permission' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Open externally' }));
    await expect(canvas.getByRole('textbox')).toBeVisible();
    await expect(canvas.getByRole('textbox')).not.toHaveFocus();
    await expect(canvas.getByRole('group')).not.toHaveFocus();
    await expect(args.onItemOpenChange).toHaveBeenCalledTimes(1);
  },
};
