// `styled` is the app-facing styling API; consumers import it from `@jfrader/ui`.
import { styled } from '../../index';
import { StrictMode, useState, type ComponentPropsWithRef, type ComponentType } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, mocked, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { withLightTheme } from '../../testing/story-decorators';
import { expectInside } from '../../testing/geometry-assertions';
import { Button } from '../button';
import { Checkbox } from '../checkbox';
import { Flex } from '../flex';
import { InlineEdit, type InlineEditProps } from '../inline-edit';
import { NumberField } from '../number-field';
import { Stack } from '../stack';
import { TextField } from '../text-field';
import {
  EditableDetails,
  type EditableDetailsEditableRow,
  type EditableDetailsEditorProps,
  type EditableDetailsItemProps,
  type EditableDetailsRow,
  type EditableDetailsRowsProps,
} from './index';

// The consumer's domain: an agreement with editable and fixed terms, nested by part.
interface AgreementTerm {
  key: string;
  label: string;
  value: string;
  editable: boolean;
}
interface AgreementSection {
  label: string;
  terms: readonly AgreementTerm[];
  sections: readonly AgreementSection[];
}
/** What a save needs to persist a term. */
interface TermContext {
  termKey: string;
}

const AGREEMENT: readonly AgreementSection[] = [
  {
    label: 'Service agreement',
    terms: [
      { key: 'reference', label: 'Reference', value: 'CT-2026-0417', editable: false },
      { key: 'notice', label: 'Notice period', value: '30 days', editable: true },
      { key: 'renewal', label: 'Renewal', value: 'Automatic, every 12 months', editable: true },
      { key: 'discount', label: 'Discount', value: '', editable: false },
    ],
    sections: [
      {
        label: 'Parties',
        terms: [],
        sections: [
          {
            label: 'Provider',
            terms: [
              { key: 'provider-name', label: 'Legal name', value: 'Halcyon Systems S.L.', editable: false },
              { key: 'provider-contact', label: 'Support contact', value: 'support@halcyon.example', editable: true },
            ],
            sections: [],
          },
          {
            label: 'Client',
            terms: [
              { key: 'client-name', label: 'Legal name', value: 'Northwind Retail Group', editable: false },
              { key: 'client-billing', label: 'Billing contact', value: '', editable: true },
            ],
            sections: [],
          },
        ],
      },
    ],
  },
];

// The mapping seam: the domain becomes rows, and only editable terms receive `edit`.
function toRows(sections: readonly AgreementSection[], parent = ''): EditableDetailsRow<TermContext>[] {
  return sections.map((section, index) => {
    const id = `${parent}${index}`;
    return {
      id,
      label: section.label,
      children: [
        ...section.terms.map((term): EditableDetailsRow<TermContext> =>
          term.editable
            ? { id: `${id}-${term.key}`, label: term.label, value: term.value, edit: { termKey: term.key } }
            : { id: `${id}-${term.key}`, label: term.label, value: term.value },
        ),
        ...toRows(section.sections, `${id}.`),
      ],
    };
  });
}

function withTerm(sections: readonly AgreementSection[], key: string, value: string): AgreementSection[] {
  return sections.map((section) => ({
    ...section,
    terms: section.terms.map((term) => (term.key === key ? { ...term, value } : term)),
    sections: withTerm(section.sections, key, value),
  }));
}

// Accepts any row, so one spy serves rows with and without a context.
type SaveRow = (next: string, row: EditableDetailsEditableRow<{}>) => void | Promise<unknown>;

// Values that are not text, saved by editors the consumer renders.
const LOCALE = 'en-US';
const RETENTION_DAYS = { min: 1, max: 365 } as const;
const REPLICAS = { min: 1, max: 64 } as const;
const dayCount = new Intl.NumberFormat(LOCALE, { style: 'unit', unit: 'day', unitDisplay: 'long' });
const summaryList = new Intl.ListFormat(LOCALE, { style: 'narrow', type: 'unit' });

interface Deployment {
  region: string;
  replicas: number;
  autoScaling: boolean;
}
const DEPLOYMENT: Deployment = { region: 'eu-west-1', replicas: 3, autoScaling: true };
const deploymentSummary = ({ region, replicas, autoScaling }: Deployment) =>
  summaryList.format([region, `Replicas: ${replicas}`, `Auto-scaling: ${autoScaling ? 'On' : 'Off'}`]);

type StoryArgs = {
  onSave: SaveRow;
  onRetentionSave: (days: number) => void | Promise<unknown>;
  onDeploymentSave: (deployment: Deployment) => void | Promise<unknown>;
  onNameSave: (next: string) => void;
  onExpandedChange: (expanded: readonly string[]) => void;
  onSectionOpenChange: (open: boolean) => void;
  onRefCleanup: (part: string) => void;
  onHydrationError: (error: unknown) => void;
  onRootClick: () => void;
  onRootRef: (node: HTMLDivElement | null) => void;
  onSlotClick: () => void;
  onSlotRef: (node: HTMLDivElement | null) => void;
};

const Frame = styled.div({ maxInlineSize: '36rem', inlineSize: '100%', marginInline: 'auto' });
const NarrowFrame = styled.div({ inlineSize: '220px' });

const meta = {
  title: 'Data display/EditableDetails',
  component: EditableDetails as unknown as ComponentType<StoryArgs>,
  tags: ['autodocs'],
  args: {
    onSave: fn(), onRetentionSave: fn(), onDeploymentSave: fn(), onNameSave: fn(), onExpandedChange: fn(), onSectionOpenChange: fn(), onRefCleanup: fn(),
    onHydrationError: fn(), onRootClick: fn(), onRootRef: fn(), onSlotClick: fn(), onSlotRef: fn(),
  },
  decorators: [(Story) => <Frame><Story /></Frame>],
  parameters: {
    layout: 'padded',
    docs: {
      description: { component: 'Show grouped details and edit their values in place.' },
      sections: [
        { title: 'Rows from your data', stories: ['Default', 'FailedSave'] },
        { title: 'Your own editor', stories: ['CustomEditor', 'ObjectEditor', 'CustomEditorFailedSave'] },
        { title: 'Expansion', stories: ['ControlledExpansion'] },
        { title: 'Composition', stories: ['Composed', 'NestedDepth'] },
      ],
      usage: `### Rows
- Map your data into \`rows\`. A row with \`children\` is a section; any other row is a detail.
- A text detail is editable when it has \`edit\`. Set \`edit\` to what saving needs, such as a record id, or to \`true\`.
- \`onSave(next, row)\` persists one text change and receives the row with its \`edit\`. Update your data so the row's \`value\` shows the saved text.
- Each editable text value is an InlineEdit: Enter saves, Escape cancels, and leaving the value saves.
- While the returned promise is pending, that row is busy. A thrown or rejected save keeps its editor open with the error. Other rows stay editable.
- Set \`error\` on a row for an error from outside, such as a conflict.
- \`emptyValue\` fills blank values and empty editable values.

### Your own editor
- Give a row \`renderEditor\` instead of \`edit\` when its value is not text, such as a number, a date, or an object. Its \`value\` is the content shown while the editor is closed.
- The row shows an Edit button. Pressing it renders your editor in a group named by the row's \`label\` and focuses the element you attach \`initialFocusRef\` to, or the group without one.
- Your editor keeps its own draft and saves with your own typed function: call \`submit(() => save(draft))\`. \`onSave\` is not called for this row.
- While the returned promise is pending, \`pending\` is \`true\` and the group is busy. A resolved save closes the editor and returns focus to the Edit button.
- A thrown or rejected save keeps the editor open and shows \`messages.failed\` under it. Add \`errorId\` to the \`aria-describedby\` of the field it concerns.
- \`cancel\` closes without saving and returns focus to the Edit button. Your editor owns its keys, so call \`cancel\` from its Cancel button and its Escape handling.
- While an enclosing section is collapsed, the editor stays mounted with its draft and \`visible\` is \`false\`. Close its portaled pickers and dialogs then.

### Expansion
- Sections start expanded. Pass \`defaultExpanded\` with section ids to start with a subset, or \`expanded\` with \`onExpandedChange\` to control it.
- Collapsing a section with focus inside, including a picker its editor portals, moves focus to its title.
- \`headingLevel\` sets the top-level section heading; each nested level adds one.

### Composition
- Build the same anatomy with \`EditableDetails.Section\`, \`List\` and \`Item\`. Put an InlineEdit in an Item to edit its value.`,
    },
  },
} satisfies Meta<StoryArgs>;
export default meta;
type Story = StoryObj<Meta<StoryArgs>>;

function deferred() {
  let resolve!: () => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function AgreementDetails({ onSave, ...props }: Omit<EditableDetailsRowsProps<TermContext>, 'rows'>) {
  const [agreement, setAgreement] = useState(AGREEMENT);
  return (
    <EditableDetails
      headingLevel={2}
      emptyValue="Not set"
      {...props}
      rows={toRows(agreement)}
      onSave={async (next, row) => {
        await onSave(next, row);
        setAgreement((current) => withTerm(current, row.edit.termKey, next));
      }}
    />
  );
}

const itemOf = (canvasElement: HTMLElement, label: string) =>
  within(
    Array.from(canvasElement.querySelectorAll<HTMLElement>('[data-ui="editable-details-item"]')).find(
      (item) => item.querySelector('dt')?.textContent === label,
    )!,
  );

const agreementSource = `import { useState } from 'react';
import { EditableDetails, type EditableDetailsRow } from '@jfrader/ui';

// Your domain, unchanged.
interface AgreementTerm { key: string; label: string; value: string; editable: boolean }
interface AgreementSection { label: string; terms: AgreementTerm[]; sections: AgreementSection[] }

// What a save needs to persist a term.
interface TermContext { termKey: string }

// The mapping seam: sections become section rows, terms become detail rows,
// and only editable terms get \`edit\`.
function toRows(sections: AgreementSection[], parent = ''): EditableDetailsRow<TermContext>[] {
  return sections.map((section, index) => {
    const id = \`\${parent}\${index}\`;
    return {
      id,
      label: section.label,
      children: [
        ...section.terms.map((term): EditableDetailsRow<TermContext> => term.editable
          ? { id: \`\${id}-\${term.key}\`, label: term.label, value: term.value, edit: { termKey: term.key } }
          : { id: \`\${id}-\${term.key}\`, label: term.label, value: term.value }),
        ...toRows(section.sections, \`\${id}.\`),
      ],
    };
  });
}

export function AgreementDetails({ agreement, saveTerm }: {
  agreement: AgreementSection[];
  saveTerm: (termKey: string, value: string) => Promise<void>;
}) {
  return <EditableDetails
    rows={toRows(agreement)}
    headingLevel={2}
    emptyValue="Not set"
    onSave={(next, row) => saveTerm(row.edit.termKey, next)}
  />;
}`;

export const Default: Story = {
  name: 'Map your data into rows',
  parameters: { docs: {
    description: { story: 'Map an agreement into rows; only editable terms get `edit`. Change the notice period and save it.' },
    source: { language: 'tsx', code: agreementSource },
  } },
  render: (args) => <AgreementDetails onSave={args.onSave} />,
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const save = deferred();
    mocked(args.onSave).mockImplementation(() => save.promise);

    // Section rows are headed disclosures, nested one heading level per depth, expanded by default.
    for (const [level, name] of [[2, 'Service agreement'], [3, 'Parties'], [4, 'Provider'], [4, 'Client']] as const) {
      const heading = canvas.getByRole('heading', { level, name });
      await expect(within(heading).getByRole('button', { name })).toHaveAttribute('aria-expanded', 'true');
    }
    await expect(canvas.getAllByRole('term')).toHaveLength(8);
    await expect(canvas.getAllByRole('definition')).toHaveLength(8);

    // Read-only rows have no edit affordance; a blank one shows the empty value.
    await expect(itemOf(canvasElement, 'Reference').queryByRole('button')).toBeNull();
    await expect(itemOf(canvasElement, 'Discount').getByRole('definition')).toHaveTextContent('Not set');
    await expect(itemOf(canvasElement, 'Discount').queryByRole('button')).toBeNull();
    // An empty editable row shows the empty value as its placeholder.
    await expect(canvas.getByRole('button', { name: 'Edit Billing contact Not set' })).toBeVisible();

    // The edit goes through InlineEdit and reaches onSave with the row and its context.
    await userEvent.click(canvas.getByRole('button', { name: 'Edit Notice period: 30 days' }));
    const editor = canvas.getByRole('textbox', { name: 'Notice period' });
    await expect(editor).toHaveFocus();
    await userEvent.clear(editor);
    await userEvent.type(editor, '60 days{Enter}');
    await expect(args.onSave).toHaveBeenCalledTimes(1);
    await expect(args.onSave).toHaveBeenLastCalledWith(
      '60 days',
      expect.objectContaining({ id: '0-notice', label: 'Notice period', value: '30 days', edit: { termKey: 'notice' } }),
    );

    // Pending is per row: this row is busy, the others stay editable.
    const notice = itemOf(canvasElement, 'Notice period');
    await expect(notice.getByRole('button', { name: 'Save' })).toHaveAttribute('aria-busy', 'true');
    await expect(notice.getByRole('status')).toHaveTextContent('Saving…');
    await expect(canvas.getByRole('button', { name: 'Edit Renewal: Automatic, every 12 months' })).not.toHaveAttribute('aria-disabled');

    // Settling shows the persisted value from the consumer's data and returns focus to it.
    save.resolve();
    await expect(await canvas.findByRole('button', { name: 'Edit Notice period: 60 days' })).toHaveFocus();
    await expect(notice.getByRole('status')).toHaveTextContent('Saved');

    // Escape cancels without saving.
    await userEvent.keyboard('{Enter}90 days{Escape}');
    await expect(canvas.getByRole('button', { name: 'Edit Notice period: 60 days' })).toHaveFocus();
    await expect(args.onSave).toHaveBeenCalledTimes(1);
  },
};

export const FailedSave: Story = {
  name: 'Failed save',
  parameters: { docs: {
    description: { story: 'Save the support contact while offline: the row keeps its editor open with the error.' },
    source: { language: 'tsx', code: `<EditableDetails
  rows={toRows(agreement)}
  onSave={(next, row) => saveTerm(row.edit.termKey, next)} // rejects while offline
/>` },
  } },
  render: (args) => <AgreementDetails onSave={args.onSave} />,
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    mocked(args.onSave).mockRejectedValue(new Error('Offline'));
    await userEvent.click(canvas.getByRole('button', { name: 'Edit Support contact: support@halcyon.example' }));
    await userEvent.keyboard('{End}.eu{Enter}');
    await expect(args.onSave).toHaveBeenCalledTimes(1);

    const contact = itemOf(canvasElement, 'Support contact');
    const alert = await contact.findByRole('alert');
    await expect(alert).toHaveTextContent('Could not save. Try again.');
    const editor = contact.getByRole('textbox', { name: 'Support contact' });
    await expect(editor).toHaveValue('support@halcyon.example.eu');
    await expect(editor).toHaveAttribute('aria-invalid', 'true');
    await expect(editor.getAttribute('aria-describedby')!.split(' ')).toContain(alert.id);
    await expect(editor).toHaveFocus();
    // The failure stays on its row.
    await expect(canvas.getAllByRole('alert')).toHaveLength(1);
    await expect(canvas.getByRole('button', { name: 'Edit Notice period: 30 days' })).toBeVisible();
  },
};

// Editors the consumer owns: each keeps a typed draft and saves through `submit`.
interface ValueEditorProps<T> extends EditableDetailsEditorProps {
  value: T;
  onSave: (next: T) => void | Promise<unknown>;
}

function EditorActions({ pending, cancel }: Pick<EditableDetailsEditorProps, 'pending' | 'cancel'>) {
  return (
    <Flex gap="sm" justify="end" wrap>
      <Button variant="ghost" aria-disabled={pending || undefined} onClick={cancel}>Cancel</Button>
      <Button type="submit" tone="accent" loading={pending}>Save</Button>
    </Flex>
  );
}

function RetentionEditor({ initialFocusRef, submit, cancel, pending, errorId, value, onSave }: ValueEditorProps<number>) {
  const [draft, setDraft] = useState<number | null>(value);
  return (
    <form onSubmit={(event) => {
      event.preventDefault();
      if (draft !== null) submit(() => onSave(draft));
    }}>
      <Stack gap="sm">
        <NumberField
          ref={initialFocusRef}
          label="Days"
          min={RETENTION_DAYS.min}
          max={RETENTION_DAYS.max}
          value={draft}
          onValueChange={setDraft}
          readOnly={pending}
          aria-describedby={errorId}
        />
        <EditorActions pending={pending} cancel={cancel} />
      </Stack>
    </form>
  );
}

interface DeploymentDraft extends Omit<Deployment, 'replicas'> {
  replicas: number | null;
}

function DeploymentEditor({ initialFocusRef, submit, cancel, pending, errorId, value, onSave }: ValueEditorProps<Deployment>) {
  const [draft, setDraft] = useState<DeploymentDraft>(value);
  return (
    <form onSubmit={(event) => {
      event.preventDefault();
      const { replicas } = draft;
      if (replicas !== null) submit(() => onSave({ ...draft, replicas }));
    }}>
      <Stack gap="sm">
        <TextField
          ref={initialFocusRef}
          label="Region"
          value={draft.region}
          onValueChange={(region) => setDraft((current) => ({ ...current, region }))}
          readOnly={pending}
          aria-describedby={errorId}
        />
        <NumberField
          label="Replicas"
          min={REPLICAS.min}
          max={REPLICAS.max}
          value={draft.replicas}
          onValueChange={(replicas) => setDraft((current) => ({ ...current, replicas }))}
          readOnly={pending}
        />
        <Checkbox
          label="Auto-scaling"
          checked={draft.autoScaling}
          onCheckedChange={(autoScaling) => setDraft((current) => ({ ...current, autoScaling }))}
          disabled={pending}
        />
        <EditorActions pending={pending} cancel={cancel} />
      </Stack>
    </form>
  );
}

type ServiceDetailsProps = Pick<StoryArgs, 'onSave' | 'onRetentionSave' | 'onDeploymentSave'> &
  Pick<EditableDetailsRowsProps, 'expanded' | 'onExpandedChange'>;

function ServiceDetails({ onSave, onRetentionSave, onDeploymentSave, ...props }: ServiceDetailsProps) {
  const [name, setName] = useState('Ingest API');
  const [retention, setRetention] = useState(30);
  const [deployment, setDeployment] = useState(DEPLOYMENT);
  return (
    <EditableDetails
      headingLevel={2}
      {...props}
      onSave={async (next, row) => {
        await onSave(next, row);
        setName(next);
      }}
      rows={[{
        id: 'service',
        label: 'Service',
        children: [
          { id: 'name', label: 'Display name', value: name, edit: true },
          {
            id: 'retention',
            label: 'Retention period',
            value: dayCount.format(retention),
            renderEditor: (editor) => (
              <RetentionEditor {...editor} value={retention} onSave={async (next) => {
                await onRetentionSave(next);
                setRetention(next);
              }} />
            ),
          },
          {
            id: 'deployment',
            label: 'Deployment',
            value: deploymentSummary(deployment),
            renderEditor: (editor) => (
              <DeploymentEditor {...editor} value={deployment} onSave={async (next) => {
                await onDeploymentSave(next);
                setDeployment(next);
              }} />
            ),
          },
        ],
      }]}
    />
  );
}

const editorSource = `import { useState } from 'react';
import { Button, EditableDetails, Flex, NumberField, Stack, type EditableDetailsEditorProps } from '@jfrader/ui';

interface RetentionEditorProps extends EditableDetailsEditorProps {
  value: number;
  onSave: (days: number) => Promise<void>;
}

function RetentionEditor({ initialFocusRef, submit, cancel, pending, errorId, value, onSave }: RetentionEditorProps) {
  const [draft, setDraft] = useState<number | null>(value);
  return (
    <form onSubmit={(event) => {
      event.preventDefault();
      if (draft !== null) submit(() => onSave(draft));
    }}>
      <Stack gap="sm">
        <NumberField ref={initialFocusRef} label="Days" min={1} max={365} value={draft}
          onValueChange={setDraft} readOnly={pending} aria-describedby={errorId} />
        <Flex gap="sm" justify="end" wrap>
          <Button variant="ghost" aria-disabled={pending || undefined} onClick={cancel}>Cancel</Button>
          <Button type="submit" tone="accent" loading={pending}>Save</Button>
        </Flex>
      </Stack>
    </form>
  );
}

const days = new Intl.NumberFormat('en-US', { style: 'unit', unit: 'day', unitDisplay: 'long' });

export function ServiceDetails({ service, saveName, saveRetention }: Props) {
  return <EditableDetails
    headingLevel={2}
    onSave={(next) => saveName(next)}
    rows={[{ id: 'service', label: 'Service', children: [
      { id: 'name', label: 'Display name', value: service.name, edit: true },
      {
        id: 'retention',
        label: 'Retention period',
        value: days.format(service.retentionDays),
        renderEditor: (editor) => (
          <RetentionEditor {...editor} value={service.retentionDays} onSave={saveRetention} />
        ),
      },
    ] }]}
  />;
}`;

const serviceArgs = (args: StoryArgs) => ({
  onSave: args.onSave, onRetentionSave: args.onRetentionSave, onDeploymentSave: args.onDeploymentSave,
});

export const CustomEditor: Story = {
  name: 'Edit a number with your own editor',
  parameters: { docs: {
    description: { story: 'Edit the retention period: the row renders your number editor and saves the number it returns.' },
    source: { language: 'tsx', code: editorSource },
  } },
  render: (args) => <ServiceDetails {...serviceArgs(args)} />,
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    const save = deferred();
    mocked(args.onRetentionSave).mockImplementation(() => save.promise);
    const retention = itemOf(canvasElement, 'Retention period');
    await expect(retention.getByText('30 days')).toBeVisible();

    // The Edit button is a keyboard target with a visible ring; Enter opens the editor on its field.
    const edit = retention.getByRole('button', { name: 'Edit Retention period' });
    edit.focus();
    await expect(getComputedStyle(edit).outlineStyle).not.toBe('none');
    await userEvent.keyboard('{Enter}');
    const group = retention.getByRole('group', { name: 'Retention period' });
    const field = within(group).getByRole('spinbutton', { name: 'Days' });
    await expect(field).toHaveFocus();

    // The editor saves a number through its own function, never through onSave.
    await userEvent.clear(field);
    await userEvent.type(field, '90');
    await userEvent.click(within(group).getByRole('button', { name: 'Save' }));
    await expect(args.onRetentionSave).toHaveBeenCalledTimes(1);
    await expect(args.onRetentionSave).toHaveBeenLastCalledWith(90);
    await expect(args.onSave).not.toHaveBeenCalled();

    // Pending is the row's: the group is busy until the save settles, and other rows stay editable.
    await expect(group).toHaveAttribute('aria-busy', 'true');
    await expect(canvas.getByRole('button', { name: 'Edit Display name: Ingest API' })).not.toHaveAttribute('aria-disabled');
    save.resolve();
    const reopened = await retention.findByRole('button', { name: 'Edit Retention period' });
    await expect(reopened).toHaveFocus();
    await expect(retention.getByText('90 days')).toBeVisible();

    // Cancel closes without saving and returns focus to the Edit button.
    await userEvent.keyboard('{Enter}');
    await userEvent.click(retention.getByRole('button', { name: 'Cancel' }));
    await expect(retention.queryByRole('group')).toBeNull();
    await expect(retention.getByRole('button', { name: 'Edit Retention period' })).toHaveFocus();
    await expect(args.onRetentionSave).toHaveBeenCalledTimes(1);
  },
};

export const ObjectEditor: Story = {
  name: 'Edit an object with your own editor',
  parameters: { docs: {
    description: { story: 'Change the region, replicas, and auto-scaling of the deployment, then save them together.' },
    source: { language: 'tsx', code: `interface Deployment { region: string; replicas: number; autoScaling: boolean }

{
  id: 'deployment',
  label: 'Deployment',
  value: summarize(deployment),
  renderEditor: (editor) => (
    <DeploymentEditor {...editor} value={deployment} onSave={(next: Deployment) => saveDeployment(next)} />
  ),
}` },
  } },
  render: (args) => <ServiceDetails {...serviceArgs(args)} />,
  play: async ({ canvasElement, userEvent, args }) => {
    const deployment = itemOf(canvasElement, 'Deployment');
    await expect(deployment.getByText(deploymentSummary(DEPLOYMENT))).toBeVisible();
    await userEvent.click(deployment.getByRole('button', { name: 'Edit Deployment' }));
    const region = deployment.getByRole('textbox', { name: 'Region' });
    await expect(region).toHaveFocus();
    await userEvent.clear(region);
    await userEvent.type(region, 'us-east-2');
    const replicas = deployment.getByRole('spinbutton', { name: 'Replicas' });
    await userEvent.clear(replicas);
    await userEvent.type(replicas, '5');
    await userEvent.click(deployment.getByRole('checkbox', { name: 'Auto-scaling' }));
    await userEvent.click(deployment.getByRole('button', { name: 'Save' }));

    // The whole object reaches the consumer's save with its field types intact.
    const saved: Deployment = { region: 'us-east-2', replicas: 5, autoScaling: false };
    await expect(args.onDeploymentSave).toHaveBeenCalledTimes(1);
    await expect(args.onDeploymentSave).toHaveBeenLastCalledWith(saved);
    await expect(await deployment.findByText(deploymentSummary(saved))).toBeVisible();
    await expect(deployment.getByRole('button', { name: 'Edit Deployment' })).toHaveFocus();
  },
};

export const CustomEditorFailedSave: Story = {
  name: 'Failed save in your own editor',
  parameters: { docs: {
    description: { story: 'Save the deployment while offline: the editor stays open with your draft and the error.' },
    source: { language: 'tsx', code: `renderEditor: (editor) => (
  <DeploymentEditor {...editor} value={deployment} onSave={saveDeployment} /> // rejects while offline
)` },
  } },
  render: (args) => <ServiceDetails {...serviceArgs(args)} />,
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    mocked(args.onDeploymentSave).mockRejectedValue(new Error('Offline'));
    const deployment = itemOf(canvasElement, 'Deployment');
    await userEvent.click(deployment.getByRole('button', { name: 'Edit Deployment' }));
    const region = deployment.getByRole('textbox', { name: 'Region' });
    await userEvent.clear(region);
    await userEvent.type(region, 'ap-south-1{Enter}');
    await expect(args.onDeploymentSave).toHaveBeenCalledTimes(1);

    const alert = await deployment.findByRole('alert');
    await expect(alert).toHaveTextContent('Could not save. Try again.');
    const group = deployment.getByRole('group', { name: 'Deployment' });
    await expect(group).not.toHaveAttribute('aria-busy');
    await expect(group).toHaveAttribute('aria-describedby', alert.id);
    // The editor hands the error id to the field it concerns.
    await expect(region.getAttribute('aria-describedby')!.split(' ')).toContain(alert.id);
    await expect(region).toHaveValue('ap-south-1');
    await expect(region).toHaveFocus();
    // The failure stays on its row.
    await expect(canvas.getAllByRole('alert')).toHaveLength(1);
    await expect(deployment.queryByText(deploymentSummary(DEPLOYMENT))).toBeNull();
  },
};

function EditorCollapseFixture(args: Pick<StoryArgs, 'onSave' | 'onRetentionSave' | 'onDeploymentSave'>) {
  const [expanded, setExpanded] = useState<readonly string[]>(['service']);
  return (
    <>
      <ServiceDetails {...args} expanded={expanded} onExpandedChange={setExpanded} />
      <Button onMouseDown={(event) => event.preventDefault()} onClick={() => setExpanded([])}>Collapse all</Button>
    </>
  );
}

export const EditorCollapse: Story = {
  tags: ['!autodocs'],
  render: (args) => <EditorCollapseFixture {...serviceArgs(args)} />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    const deployment = itemOf(canvasElement, 'Deployment');
    await userEvent.click(deployment.getByRole('button', { name: 'Edit Deployment' }));
    const region = deployment.getByRole('textbox', { name: 'Region' });
    await userEvent.type(region, '-b');

    // Collapsing from outside while the editor holds focus moves focus to the section title.
    await userEvent.click(canvas.getByRole('button', { name: 'Collapse all' }));
    const section = canvas.getByRole('button', { name: 'Service' });
    await expect(section).toHaveAttribute('aria-expanded', 'false');
    await expect(section).toHaveFocus();

    // The editor stays mounted with its draft while hidden.
    await userEvent.keyboard('{Enter}');
    await expect(section).toHaveAttribute('aria-expanded', 'true');
    await expect(deployment.getByRole('textbox', { name: 'Region' })).toBe(region);
    await expect(region).toHaveValue(`${DEPLOYMENT.region}-b`);
  },
};

export const RowError: Story = {
  tags: ['!autodocs'],
  render: (args) => (
    <EditableDetails
      onSave={args.onSave}
      rows={[{ id: 'slug', label: 'Routing slug', value: 'apollo', edit: true, error: 'That slug is taken.' }]}
    />
  ),
  play: async ({ canvas, userEvent, args }) => {
    const trigger = canvas.getByRole('button', { name: 'Edit Routing slug: apollo' });
    await expect(trigger).toHaveAccessibleDescription('That slug is taken.');
    await userEvent.click(trigger);
    await userEvent.keyboard('-2{Enter}');
    // An error from outside blocks the save until the consumer clears it.
    await expect(args.onSave).not.toHaveBeenCalled();
    await expect(canvas.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
  },
};

export const ReadOnlyValues: Story = {
  tags: ['!autodocs'],
  render: (args) => (
    <EditableDetails
      onSave={args.onSave}
      emptyValue="Not set"
      rows={[
        { id: 'zero', label: 'Open incidents', value: 0 },
        { id: 'false', label: 'Flag', value: false },
        { id: 'blank', label: 'Blank', value: '' },
        { id: 'missing', label: 'Missing' },
        { id: 'node', label: 'Owner', value: <strong>Flight operations</strong> },
      ]}
    />
  ),
  play: async ({ canvas }) => {
    const values = canvas.getAllByRole('definition').map((value) => value.textContent);
    await expect(values).toEqual(['0', 'Not set', 'Not set', 'Not set', 'Flight operations']);
    await expect(canvas.queryAllByRole('button')).toHaveLength(0);
    // Value rows outside any section render as one list with no disclosure.
    await expect(canvas.getAllByRole('term')).toHaveLength(5);
    await expect(canvas.queryByRole('heading')).toBeNull();
  },
};

export const RowAlignment: Story = {
  tags: ['!autodocs'],
  render: (args) => <AgreementDetails onSave={args.onSave} />,
  play: async ({ canvasElement }) => {
    const reference = itemOf(canvasElement, 'Reference');
    const notice = itemOf(canvasElement, 'Notice period');
    // Read-only and editable rows share one height and start their text at the same inline offset.
    const referenceRow = reference.getByRole('term').parentElement!.getBoundingClientRect();
    const noticeRow = notice.getByRole('term').parentElement!.getBoundingClientRect();
    await expect(noticeRow.height).toBe(referenceRow.height);
    // Text starts at an element's content edge, inside its border and padding.
    const textStart = (element: HTMLElement) => {
      const style = getComputedStyle(element);
      return element.getBoundingClientRect().left + parseFloat(style.borderInlineStartWidth) + parseFloat(style.paddingInlineStart);
    };
    const readOnlyValue = reference.getByText('CT-2026-0417');
    const editableValue = notice.getByText('30 days');
    await expect(textStart(editableValue)).toBe(textStart(readOnlyValue));
    // Both lines center on their own row's value line; their leading differs, so compare each
    // text's center offset from the top of its row.
    const centerIn = (text: HTMLElement, row: DOMRect) => {
      const box = text.getBoundingClientRect();
      return box.top + box.height / 2 - row.top;
    };
    await expect(centerIn(editableValue, noticeRow)).toBeCloseTo(centerIn(readOnlyValue, referenceRow), 0);
  },
};

function ControlledExpansionFixture({ onSave, onExpandedChange }: Pick<StoryArgs, 'onSave' | 'onExpandedChange'>) {
  const [expanded, setExpanded] = useState<readonly string[]>(['0']);
  const [requested, setRequested] = useState<readonly string[] | null>(null);
  const keepFocus = (event: { preventDefault: () => void }) => event.preventDefault();
  return (
    <>
      <AgreementDetails
        onSave={onSave}
        expanded={expanded}
        onExpandedChange={(next) => {
          onExpandedChange(next);
          setRequested(next);
        }}
      />
      <Button onMouseDown={keepFocus} onClick={() => requested && setExpanded(requested)}>Apply request</Button>
      <Button onMouseDown={keepFocus} onClick={() => setExpanded([])}>Collapse all</Button>
    </>
  );
}

export const ControlledExpansion: Story = {
  name: 'Controlled expansion',
  parameters: { docs: {
    description: { story: 'The parent owns which sections are open; Parties opens only after the parent applies the request.' },
    source: { language: 'tsx', code: `import { useState } from 'react';
import { EditableDetails } from '@jfrader/ui';

export function AgreementDetails({ agreement, saveTerm }: Props) {
  const [expanded, setExpanded] = useState<readonly string[]>(['0']);
  return <EditableDetails
    rows={toRows(agreement)}
    expanded={expanded}
    onExpandedChange={setExpanded}
    onSave={(next, row) => saveTerm(row.edit.termKey, next)}
  />;
}` },
  } },
  render: (args) => <ControlledExpansionFixture onSave={args.onSave} onExpandedChange={args.onExpandedChange} />,
  play: async ({ canvas, userEvent, args }) => {
    const agreement = canvas.getByRole('button', { name: 'Service agreement' });
    const parties = canvas.getByRole('button', { name: 'Parties' });
    await expect(agreement).toHaveAttribute('aria-expanded', 'true');
    await expect(parties).toHaveAttribute('aria-expanded', 'false');

    // A request is not a commit.
    await userEvent.click(parties);
    await expect(args.onExpandedChange).toHaveBeenCalledTimes(1);
    await expect(args.onExpandedChange).toHaveBeenLastCalledWith(['0', '0.0']);
    await expect(parties).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(canvas.getByRole('button', { name: 'Apply request' }));
    await expect(parties).toHaveAttribute('aria-expanded', 'true');

    // A collapse from outside while editing moves focus to the section title.
    await userEvent.click(canvas.getByRole('button', { name: 'Edit Notice period: 30 days' }));
    await expect(canvas.getByRole('textbox', { name: 'Notice period' })).toHaveFocus();
    await userEvent.click(canvas.getByRole('button', { name: 'Collapse all' }));
    await expect(agreement).toHaveAttribute('aria-expanded', 'false');
    await expect(agreement).toHaveFocus();
    await expect(args.onExpandedChange).toHaveBeenCalledTimes(1);
  },
};

export const DefaultExpanded: Story = {
  tags: ['!autodocs'],
  render: (args) => <AgreementDetails onSave={args.onSave} defaultExpanded={['0']} onExpandedChange={args.onExpandedChange} />,
  play: async ({ canvas, userEvent, args }) => {
    await expect(canvas.getByRole('button', { name: 'Service agreement' })).toHaveAttribute('aria-expanded', 'true');
    const parties = canvas.getByRole('button', { name: 'Parties' });
    await expect(parties).toHaveAttribute('aria-expanded', 'false');
    parties.focus();
    await userEvent.keyboard('{Enter}');
    await expect(parties).toHaveAttribute('aria-expanded', 'true');
    await expect(args.onExpandedChange).toHaveBeenLastCalledWith(['0', '0.0']);
    await userEvent.keyboard(' ');
    await expect(parties).toHaveAttribute('aria-expanded', 'false');
  },
};

function SlotEdit(props: InlineEditProps) {
  return <InlineEdit {...props} data-slot="edit" />;
}
function SlotItem(props: EditableDetailsItemProps) {
  return <EditableDetails.Item {...props} data-slot="item" />;
}

export const RowSlots: Story = {
  tags: ['!autodocs'],
  render: (args) => (
    <AgreementDetails
      onSave={args.onSave}
      slots={{ edit: SlotEdit, item: SlotItem }}
      slotProps={{
        root: { className: 'custom-root-slot', 'data-testid': 'custom-root' },
        section: { className: 'custom-section-slot' },
        list: { className: 'custom-list-slot' },
        item: { className: 'custom-item-slot' },
        edit: { size: 'md', className: 'custom-edit-slot' },
      }}
    />
  ),
  play: async ({ canvas, canvasElement }) => {
    await expect(canvasElement.querySelector('[data-ui~="editable-details"]')).toHaveClass('custom-root-slot');
    await expect(canvasElement.querySelector('[data-ui="editable-details-section"]')).toHaveClass('custom-section-slot');
    await expect(canvasElement.querySelector('[data-ui="editable-details-list"]')).toHaveClass('custom-list-slot');
    const item = canvasElement.querySelector('[data-ui="editable-details-item"]');
    await expect(item).toHaveClass('custom-item-slot');
    await expect(item).toHaveAttribute('data-slot', 'item');
    const edit = canvasElement.querySelector('[data-ui="inline-edit"]');
    await expect(edit).toHaveAttribute('data-slot', 'edit');
    await expect(edit).toHaveClass('custom-edit-slot');
    // slotProps.edit reaches every editor: md is the 40px block.
    await expect(canvas.getByRole('button', { name: 'Edit Notice period: 30 days' }).getBoundingClientRect().height).toBe(40);
  },
};

export const RootPropMerge: Story = {
  tags: ['!autodocs'],
  render: (args) => (
    <EditableDetails
      onSave={args.onSave}
      rows={[{ id: 'name', label: 'Name', value: 'Apollo' }]}
      id="host-id"
      data-origin="host"
      className="host-class"
      // Inline styles exercise the documented root/slot style-merging API.
      style={{ paddingBlock: vars.space[4], fontWeight: 400 }}
      onClick={args.onRootClick}
      ref={args.onRootRef}
      slotProps={{
        root: {
          id: 'slot-id',
          'data-origin': 'slot',
          className: 'slot-class',
          style: { paddingInline: vars.space[5], fontWeight: 600 },
          onClick: args.onSlotClick,
          ref: args.onSlotRef,
        },
      }}
    />
  ),
  play: async ({ canvasElement, args, userEvent }) => {
    const root = canvasElement.querySelector<HTMLElement>('[data-ui~="editable-details"]')!;
    await expect(root).toHaveAttribute('id', 'slot-id');
    await expect(root).toHaveAttribute('data-origin', 'slot');
    await expect(root).toHaveClass('host-class');
    await expect(root).toHaveClass('slot-class');
    await expect(root.style.paddingBlock).toBe(vars.space[4]);
    await expect(root.style.paddingInline).toBe(vars.space[5]);
    await expect(root.style.fontWeight).toBe('600');
    await expect(args.onSlotRef).toHaveBeenCalledWith(root);
    await userEvent.click(root);
    await expect(args.onRootClick).not.toHaveBeenCalled();
    await expect(args.onSlotClick).toHaveBeenCalled();
  },
};

function rowsTypeContracts(save: (next: string, row: EditableDetailsEditableRow<TermContext>) => Promise<void>) {
  const rows = toRows(AGREEMENT);
  // The row's context type flows from `rows` into `onSave`.
  <EditableDetails rows={rows} onSave={(next, row) => save(next, row)} />;
  <EditableDetails rows={rows} onSave={(_next, row) => void row.edit.termKey.toUpperCase()} />;
  // Rows without context mark editability with `true`.
  <EditableDetails rows={[{ id: 'a', label: 'A', value: 'x', edit: true }]} onSave={() => {}} />;
  // @ts-expect-error Rows mode needs onSave.
  <EditableDetails rows={rows} />;
  // @ts-expect-error Rows and composed children are exclusive.
  <EditableDetails rows={rows} onSave={() => {}}>Composed</EditableDetails>;
  // @ts-expect-error An editable row edits text, not arbitrary content.
  <EditableDetails rows={[{ id: 'a', label: 'A', value: <b>x</b>, edit: true }]} onSave={() => {}} />;
  // @ts-expect-error A section row has no value.
  <EditableDetails rows={[{ id: 'a', label: 'A', value: 'x', children: [] }]} onSave={() => {}} />;
  // A row with its own editor shows any content and sits beside text rows that keep their context.
  const editorRows: EditableDetailsRow<TermContext>[] = [
    ...rows,
    { id: 'n', label: 'N', value: <b>3</b>, renderEditor: ({ submit }) => <Button onClick={() => submit(() => saveCount(4))}>Save</Button> },
  ];
  <EditableDetails rows={editorRows} onSave={(next, row) => save(next, row)} />;
  // @ts-expect-error A row edits through InlineEdit or through its own editor, not both.
  <EditableDetails rows={[{ id: 'a', label: 'A', value: 'x', edit: true, renderEditor: () => null }]} onSave={() => {}} />;
  // @ts-expect-error Text options belong to InlineEdit rows.
  <EditableDetails rows={[{ id: 'a', label: 'A', renderEditor: () => null, multiline: true }]} onSave={() => {}} />;
  // @ts-expect-error `persist` takes no value: the editor closes over its own typed draft.
  <EditableDetails rows={[{ id: 'a', label: 'A', renderEditor: ({ submit }) => submit((next: number) => saveCount(next)) }]} onSave={() => {}} />;
  <EditableDetails />;
}
declare function saveCount(count: number): Promise<void>;
void rowsTypeContracts;

function DetailsFixture({ onNameSave }: Pick<StoryArgs, 'onNameSave'>) {
  return <EditableDetails>
    <EditableDetails.Section title="Settings" defaultOpen headingLevel={2}>
      <EditableDetails.Section title="Project" defaultOpen>
        <EditableDetails.List>
          <EditableDetails.Item label="Name">
            <InlineEdit label="Name" variant="body" size="sm" defaultValue="Apollo" onSave={onNameSave} />
          </EditableDetails.Item>
          <EditableDetails.Item label="Count">{0}</EditableDetails.Item>
          <EditableDetails.Item label="Boolean">{false}</EditableDetails.Item>
          <EditableDetails.Item label="Empty">{''}</EditableDetails.Item>
        </EditableDetails.List>
      </EditableDetails.Section>
    </EditableDetails.Section>
  </EditableDetails>;
}

export const Composed: Story = {
  name: 'Compose nested details',
  parameters: { docs: {
    description: { story: 'Compose sections and items by hand and put an InlineEdit in the item you edit.' },
    source: { language: 'tsx', code: `import { EditableDetails, InlineEdit } from '@jfrader/ui';

<EditableDetails>
  <EditableDetails.Section title="Settings" defaultOpen headingLevel={2}>
    <EditableDetails.Section title="Project" defaultOpen>
      <EditableDetails.List>
        <EditableDetails.Item label="Name">
          <InlineEdit label="Name" variant="body" size="sm" defaultValue="Apollo" onSave={saveName} />
        </EditableDetails.Item>
        <EditableDetails.Item label="Count">{0}</EditableDetails.Item>
        <EditableDetails.Item label="Boolean">{false}</EditableDetails.Item>
        <EditableDetails.Item label="Empty">{''}</EditableDetails.Item>
      </EditableDetails.List>
    </EditableDetails.Section>
  </EditableDetails.Section>
</EditableDetails>` },
  } },
  render: (args) => <DetailsFixture onNameSave={args.onNameSave} />,
  play: async ({ canvas, userEvent, args }) => {
    const section = canvas.getByRole('button', { name: 'Settings' });
    await expect(section).toHaveAttribute('aria-expanded', 'true');
    await expect(canvas.getAllByRole('term')).toHaveLength(4);
    await expect(canvas.getAllByRole('definition').map((value) => value.textContent)).toEqual(['Apollo', '0', '', '']);
    await expect(canvas.queryByRole('tree')).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: 'Edit Name: Apollo' }));
    await userEvent.keyboard(' 2{Enter}');
    await expect(args.onNameSave).toHaveBeenLastCalledWith('Apollo 2');
    await expect(canvas.getByRole('button', { name: 'Edit Name: Apollo 2' })).toHaveFocus();
  },
};

export const Light: Story = { render: (args) => <DetailsFixture onNameSave={args.onNameSave} />, decorators: [withLightTheme] };
export const Rtl: Story = { render: (args) => <div dir="rtl"><DetailsFixture onNameSave={args.onNameSave} /></div> };
export const Narrow: Story = { render: (args) => <NarrowFrame><DetailsFixture onNameSave={args.onNameSave} /></NarrowFrame> };

export const LongContent: Story = {
  render: (args) => <NarrowFrame>
    <EditableDetails onSave={args.onSave} headingLevel={2} rows={[{
      id: 'delivery', label: 'Delivery configuration and notification preferences', children: [
        { id: 'config', label: 'Deployment configuration for the production environment', value: 'production-europe-west-primary-notification-delivery-configuration', edit: true },
        { id: 'recipients', label: 'Notification recipients', value: 'operations-and-delivery@example.com' },
      ],
    }]} />
  </NarrowFrame>,
  play: async ({ canvas, canvasElement, userEvent }) => {
    const root = canvasElement.querySelector<HTMLElement>('[data-ui="editable-details"]')!;
    const trigger = canvas.getByRole('button', { name: 'Delivery configuration and notification preferences' });
    const edit = canvas.getByRole('button', { name: /^Edit Deployment configuration/ });
    for (const element of [trigger, ...canvas.getAllByRole('term'), ...canvas.getAllByRole('definition'), edit]) {
      await expectInside(element, root);
    }
    for (const button of [trigger, edit]) await expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(32);
    await expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth);
    edit.focus();
    await expect(getComputedStyle(edit).outlineStyle).not.toBe('none');
    await userEvent.keyboard('{Enter}');
    const input = canvas.getByRole('textbox');
    await expect(input).toHaveFocus();
    await expectInside(input, canvas.getAllByRole('definition')[0]!);
    await userEvent.keyboard('{Escape}');
    await expect(canvas.getByRole('button', { name: /^Edit Deployment configuration/ })).toHaveFocus();
  },
};

export const NestedDepth: Story = {
  name: 'Group nested settings',
  parameters: { docs: { description: { story: 'Nest sections to group project, delivery and notification details.' }, source: { language: 'tsx', code: `import { EditableDetails } from '@jfrader/ui';

<EditableDetails>
  <EditableDetails.Section title="Project" defaultOpen headingLevel={2}>
    <EditableDetails.List>
      <EditableDetails.Item label="Name">Apollo</EditableDetails.Item>
      <EditableDetails.Item label="Owner">Flight operations</EditableDetails.Item>
    </EditableDetails.List>
    <EditableDetails.Section title="Delivery" defaultOpen>
      <EditableDetails.List>
        <EditableDetails.Item label="Region">Europe</EditableDetails.Item>
        <EditableDetails.Item label="Schedule">Weekly</EditableDetails.Item>
      </EditableDetails.List>
      <EditableDetails.Section title="Notifications" defaultOpen headingLevel={4}>
        <EditableDetails.List>
          <EditableDetails.Item label="Email">Enabled</EditableDetails.Item>
          <EditableDetails.Item label="Digest">Monday</EditableDetails.Item>
        </EditableDetails.List>
      </EditableDetails.Section>
    </EditableDetails.Section>
  </EditableDetails.Section>
</EditableDetails>` } } },
  render: () => <EditableDetails>
    <EditableDetails.Section title="Project" defaultOpen headingLevel={2}>
      <EditableDetails.List>
        <EditableDetails.Item label="Name">Apollo</EditableDetails.Item>
        <EditableDetails.Item label="Owner">Flight operations</EditableDetails.Item>
      </EditableDetails.List>
      <EditableDetails.Section title="Delivery" defaultOpen>
        <EditableDetails.List>
          <EditableDetails.Item label="Region">Europe</EditableDetails.Item>
          <EditableDetails.Item label="Schedule">Weekly</EditableDetails.Item>
        </EditableDetails.List>
        <EditableDetails.Section title="Notifications" defaultOpen headingLevel={4}>
          <EditableDetails.List>
            <EditableDetails.Item label="Email">Enabled</EditableDetails.Item>
            <EditableDetails.Item label="Digest">Monday</EditableDetails.Item>
          </EditableDetails.List>
        </EditableDetails.Section>
      </EditableDetails.Section>
    </EditableDetails.Section>
  </EditableDetails>,
  play: async ({ canvas, canvasElement }) => {
    const triggers = ['Project', 'Delivery', 'Notifications'].map((name) => canvas.getByRole('button', { name }));
    for (const [depth, section] of canvasElement.querySelectorAll('section').entries()) {
      await expect(section).toHaveAttribute('data-depth', String(depth));
    }
    for (const panel of canvasElement.querySelectorAll('[data-ui="editable-details-section-panel"]')) {
      // A hairline can compute to a fraction under page zoom or fractional display scaling, so
      // assert that the rail is drawn rather than the string a 1px border reports.
      await expect(parseFloat(getComputedStyle(panel, '::before').borderInlineStartWidth)).toBeGreaterThan(0);
    }
    for (const [depth, trigger] of triggers.entries()) {
      const parent = triggers[depth - 1];
      if (parent) await expect(trigger.getBoundingClientRect().left).toBeGreaterThan(parent.getBoundingClientRect().left);
    }
  },
};

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
        const last = index === rows.length - 1;
        await expect(parseFloat(style.borderBlockStartWidth)).toBe(0);
        // Separators only between rows; their width is read with a tolerance (see the rail note).
        const separator = parseFloat(style.borderBlockEndWidth);
        if (last) await expect(separator).toBe(0);
        else await expect(separator).toBeGreaterThan(0);
      }
    }
    for (const section of canvasElement.querySelectorAll('section')) {
      await expect(parseFloat(getComputedStyle(section).borderBlockEndWidth)).toBe(0);
    }
    const heading = canvas.getByRole('button', { name: 'Identity' });
    const label = canvas.getByText('Project');
    const panel = canvasElement.querySelector('[data-ui="editable-details-section-panel"]')!;
    const triggerStyle = getComputedStyle(heading);
    const caretStyle = getComputedStyle(heading, '::before');
    const titleInset = parseFloat(triggerStyle.paddingInlineStart) + parseFloat(caretStyle.borderInlineStartWidth) + parseFloat(triggerStyle.columnGap);
    await expect(parseFloat(getComputedStyle(panel, '::before').borderInlineStartWidth)).toBeGreaterThan(0);
    await expect(parseFloat(getComputedStyle(panel).paddingInlineStart)).toBe(titleInset);
    await expect(label.getBoundingClientRect().left).toBe(heading.getBoundingClientRect().left + titleInset);
    await expect(Number(getComputedStyle(heading).fontWeight)).toBeGreaterThan(Number(getComputedStyle(label).fontWeight));
    await userEvent.click(canvas.getByRole('button', { name: 'Delivery' }));
    await expect(canvas.getByRole('button', { name: 'Delivery' })).toHaveAttribute('aria-expanded', 'false');
    await expect(canvas.queryByRole('button', { name: 'Notifications' })).not.toBeInTheDocument();
  },
};

function ControlledSectionFixture({ onSectionOpenChange }: Pick<StoryArgs, 'onSectionOpenChange'>) {
  const [open, setOpen] = useState(false);
  const [requested, setRequested] = useState(false);
  return <EditableDetails>
    <EditableDetails.Section title="Controlled section" open={open} onOpenChange={(next) => { onSectionOpenChange(next); setRequested(next); }}>
      <EditableDetails.List><EditableDetails.Item label="Name">Apollo</EditableDetails.Item></EditableDetails.List>
    </EditableDetails.Section>
    <Button onMouseDown={(event) => event.preventDefault()} onClick={() => setOpen(requested)}>Accept section</Button>
    <Button onMouseDown={(event) => event.preventDefault()} onClick={() => setOpen(!open)}>External section update</Button>
  </EditableDetails>;
}
export const ControlledSection: Story = { tags: ['!autodocs'], render: (args) => <ControlledSectionFixture {...args} />, play: async ({ canvasElement, userEvent, args }) => {
  const canvas = within(canvasElement);
  const trigger = canvas.getByRole('button', { name: 'Controlled section' });
  const value = canvas.getByText('Apollo');
  await userEvent.click(trigger);
  await expect(args.onSectionOpenChange).toHaveBeenCalledTimes(1);
  await expect(args.onSectionOpenChange).toHaveBeenLastCalledWith(true);
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(value).not.toBeVisible();
  await userEvent.click(canvas.getByRole('button', { name: 'Accept section' }));
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect(value).toBeVisible();
  await expect(trigger).toHaveFocus();
  await userEvent.click(canvas.getByRole('button', { name: 'External section update' }));
  await expect(value).not.toBeVisible();
  await expect(args.onSectionOpenChange).toHaveBeenCalledTimes(1);
} };

export const KeyboardAndSurroundingForm: Story = {
  tags: ['!autodocs'],
  render: (args) => <form onSubmit={(event) => { event.preventDefault(); throw new Error('Disclosure/Edit must not submit'); }}><DetailsFixture onNameSave={args.onNameSave} /></form>, play: async ({ canvasElement, userEvent }) => {
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
  const name = canvas.getByRole('button', { name: 'Edit Name: Apollo' });
  await expect(name).toHaveFocus();
  await expect(getComputedStyle(name).outlineStyle).not.toBe('none');
  await userEvent.keyboard('{Enter}');
  await expect(canvas.getByRole('textbox', { name: 'Name' })).toHaveFocus();
  await userEvent.keyboard('{Escape}');
  await expect(canvas.getByRole('button', { name: 'Edit Name: Apollo' })).toHaveFocus();
  // Enter in the editor saves instead of submitting the surrounding form.
  await userEvent.keyboard('{Enter}{End} 2{Enter}');
  await expect(canvas.getByRole('button', { name: 'Edit Name: Apollo 2' })).toHaveFocus();
} };

function RefFixture({ onRefCleanup }: Pick<StoryArgs, 'onRefCleanup'>) {
  const [mounted, setMounted] = useState(true);
  return <StrictMode>{mounted && <EditableDetails ref={() => () => onRefCleanup('root')}>
    <EditableDetails.Section title="Refs" defaultOpen ref={() => () => onRefCleanup('section')} triggerRef={() => () => onRefCleanup('trigger')}>
      <EditableDetails.List ref={() => () => onRefCleanup('list')}><EditableDetails.Item ref={() => () => onRefCleanup('item')} label="Ref">Value</EditableDetails.Item></EditableDetails.List>
    </EditableDetails.Section>
  </EditableDetails>}<Button onClick={() => setMounted(false)}>Unmount refs</Button></StrictMode>;
}
export const StrictModeRefCleanup: Story = { tags: ['!autodocs'], render: (args) => <RefFixture {...args} />, play: async ({ canvasElement, userEvent, args }) => {
  const before = mocked(args.onRefCleanup).mock.calls.length;
  await userEvent.click(within(canvasElement).getByRole('button', { name: 'Unmount refs' }));
  await expect(args.onRefCleanup).toHaveBeenCalledTimes(before + 5);
  await expect(mocked(args.onRefCleanup).mock.calls.slice(before)).toEqual(expect.arrayContaining(['root', 'section', 'trigger', 'list', 'item'].map((part) => [part])));
} };

export const HydrationRelationships: Story = { tags: ['!autodocs'], render: (args) => <DetailsFixture onNameSave={args.onNameSave} />, play: async ({ canvasElement, userEvent, args }) => {
  const host = canvasElement.ownerDocument.createElement('div');
  const fixture = <DetailsFixture onNameSave={args.onNameSave} />;
  host.innerHTML = renderToString(fixture, { identifierPrefix: 'editable-ssr-' });
  canvasElement.append(host);
  const before = Array.from(host.querySelectorAll('[id]'), (element) => element.id);
  const errors = args.onHydrationError;
  const root = hydrateRoot(host, fixture, { identifierPrefix: 'editable-ssr-', onRecoverableError: errors });
  try {
    const canvas = within(host);
    await userEvent.click(canvas.getByRole('button', { name: 'Edit Name: Apollo' }));
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
const StyledDetails = styled(EditableDetails)(blueprints.consumer);
const StyledDetailsSection = styled(EditableDetails.Section)(blueprints.consumer);
const StyledDetailsList = styled(EditableDetails.List)(blueprints.consumer);
const StyledDetailsItem = styled(EditableDetails.Item)(blueprints.consumer);
export const StylingPrecedence: Story = {
  tags: ['!autodocs'],
  parameters: { docs: { source: { language: 'tsx', code: `<EditableDetails sx={{ paddingInline: theme.space[3] }} slotProps={{ root: { sx: { paddingInline: theme.space[2] } } }}>
  <EditableDetails.Section title="Styled section" defaultOpen sx={{ paddingInline: theme.space[3] }}>
    <EditableDetails.List sx={{ paddingInline: theme.space[3] }}>
      <EditableDetails.Item label="Styled item" sx={{ paddingInline: theme.space[3] }}>Value</EditableDetails.Item>
    </EditableDetails.List>
  </EditableDetails.Section>
</EditableDetails>` } } },
  render: () => <StyledDetails sx={blueprints.sx} slotProps={{ root: { sx: blueprints.consumer } }}>
  <StyledDetailsSection title="Styled section" defaultOpen sx={blueprints.sx}>
    <StyledDetailsList sx={blueprints.sx}>
      <StyledDetailsItem label="Styled item" sx={blueprints.sx}>Value</StyledDetailsItem>
    </StyledDetailsList>
  </StyledDetailsSection>
</StyledDetails>, play: async ({ canvasElement }) => {
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
export const DeepNarrow: Story = { tags: ['!autodocs'], render: () => <NarrowFrame><EditableDetails><DeepSection depth={8} /></EditableDetails></NarrowFrame>, play: async ({ canvasElement }) => {
  const root = canvasElement.querySelector<HTMLElement>('[data-ui="editable-details"]')!;
  await expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth);
} };

function DetailHeading(props: ComponentPropsWithRef<'h3'>) {
  return <h3 {...props} data-slot="detail-heading" />;
}
function DetailTrigger(props: ComponentPropsWithRef<'button'>) {
  return <button {...props} data-slot="detail-trigger" />;
}
function DetailPanel(props: ComponentPropsWithRef<'div'>) {
  return <div {...props} data-slot="detail-panel" />;
}
function DetailLabel(props: ComponentPropsWithRef<'dt'>) {
  return <dt {...props} data-slot="detail-label" />;
}
function DetailDescription(props: ComponentPropsWithRef<'dd'>) {
  return <dd {...props} data-slot="detail-description" />;
}

export const InteriorSlots: Story = {
  tags: ['!autodocs'],
  render: () => (
    <EditableDetails>
      <EditableDetails.Section title="Project" slots={{ heading: DetailHeading, trigger: DetailTrigger, panel: DetailPanel }}>
        <EditableDetails.List>
          <EditableDetails.Item label="Name" slots={{ label: DetailLabel, description: DetailDescription }}>Apollo</EditableDetails.Item>
        </EditableDetails.List>
      </EditableDetails.Section>
    </EditableDetails>
  ),
  play: async ({ canvas, canvasElement, userEvent }) => {
    const trigger = canvas.getByRole('button', { name: 'Project' });
    await expect(trigger).toHaveAttribute('data-slot', 'detail-trigger');
    const panel = canvasElement.querySelector('[data-slot="detail-panel"]');
    await expect(panel).toHaveAttribute('hidden');
    await expect(trigger).toHaveAttribute('aria-controls', panel!.id);
    await userEvent.click(trigger);
    for (const part of ['heading', 'label', 'description']) {
      await expect(canvasElement.querySelector(`[data-slot="detail-${part}"]`)).toBeVisible();
    }
  },
};
