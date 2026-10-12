import { useActionState, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { css } from '@emotion/react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, waitFor, within } from 'storybook/test';
import { useForm } from 'react-hook-form';
import { vars } from '@jfrader/tokens/vars';
import { Button, Card, Checkbox, EditableDetails, type EditableDetailsEditorProps, InlineEdit, TextField } from '@jfrader/ui';
import './showcase.css';

interface DeploymentConfig { serviceName: string; region: string; replicas: number; autoScaling: boolean }
interface DeploymentDraft extends Omit<DeploymentConfig, 'replicas'> { replicas: string }
interface ContactData { contactEmail: string; maxConcurrency: number }
type EditorProps<T> = EditableDetailsEditorProps & { value: T; onSave: (value: T) => void };
const INITIAL_DEPLOYMENT: DeploymentConfig = { serviceName: 'api-gateway', region: 'us-east-1', replicas: 3, autoScaling: true };
const INITIAL_CONTACT: ContactData = { contactEmail: 'ops@example.com', maxConcurrency: 16 };
const RETENTION_LIMIT = 365;
const CONCURRENCY_LIMIT = 64;
const DEMO_LOCALE = 'en';
const days = new Intl.NumberFormat(DEMO_LOCALE, { style: 'unit', unit: 'day', unitDisplay: 'long' });
const numbers = new Intl.NumberFormat(DEMO_LOCALE);
const editorStyle = css({ display: 'grid', gap: vars.space[3], minInlineSize: 0 });
const actionsStyle = css({ display: 'flex', flexWrap: 'wrap', justifyContent: 'end', gap: vars.space[2] });
const responseStyle = css({ display: 'flex', flexWrap: 'wrap', gap: vars.space[2], paddingBlock: vars.space[3] });
const confirmationStyle = css({ display: 'grid', gap: vars.space[3], padding: vars.space[3], border: `1px solid ${vars.color.borderControl}`, borderRadius: vars.radius.sm });
const mobileStyle = css({ inlineSize: 'min(100%, 320px)', marginInline: 'auto' });

function Scene({ children, title = 'Project settings' }: { children: ReactNode; title?: string }) {
  return <main className="showcase-page">
    <h1 className="showcase-title">{title}</h1>
    <Card><Card.Content><EditableDetails>{children}</EditableDetails></Card.Content></Card>
  </main>;
}

function EditorActions({ cancel, submit, pending = false }: { cancel: () => void; submit: string; pending?: boolean }) {
  return <div css={actionsStyle}>
    <Button variant="outline" type="button" onClick={cancel} disabled={pending}>Cancel</Button>
    <Button tone="accent" type="submit" disabled={pending}>{submit}</Button>
  </div>;
}

function RetentionEditor({ initialFocusRef, complete, cancel, value, onSave }: EditorProps<number>) {
  const [draft, setDraft] = useState(String(value));
  const [error, setError] = useState<string>();
  return <form noValidate css={editorStyle} onSubmit={(event) => {
    event.preventDefault();
    const next = Number(draft);
    if (!Number.isInteger(next) || next < 1 || next > RETENTION_LIMIT) {
      setError(`Enter a whole number from 1 to ${RETENTION_LIMIT}.`);
      return;
    }
    onSave(next);
    complete();
  }}>
    <TextField ref={initialFocusRef} name="retentionDays" label="Retention period (days)" type="number" min={1} max={RETENTION_LIMIT} step={1}
      value={draft} error={error} onValueChange={(next) => { setDraft(next); setError(undefined); }} />
    <EditorActions cancel={cancel} submit="Save retention" />
  </form>;
}

function DeploymentEditor({ initialFocusRef, complete, cancel, value, onSave }: EditorProps<DeploymentConfig>) {
  const [draft, setDraft] = useState<DeploymentDraft>({ ...value, replicas: String(value.replicas) });
  const [errors, setErrors] = useState<Partial<Record<'serviceName' | 'region' | 'replicas', string>>>({});
  return <form noValidate css={editorStyle} onSubmit={(event) => {
    event.preventDefault();
    const replicas = Number(draft.replicas);
    const nextErrors = {
      serviceName: draft.serviceName.trim() ? undefined : 'Enter a service name.',
      region: draft.region.trim() ? undefined : 'Enter a region.',
      replicas: Number.isInteger(replicas) && replicas >= 1 && replicas <= CONCURRENCY_LIMIT
        ? undefined : `Enter a whole instance count from 1 to ${CONCURRENCY_LIMIT}.`,
    };
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;
    onSave({ ...draft, serviceName: draft.serviceName.trim(), region: draft.region.trim(), replicas });
    complete();
  }}>
    <TextField ref={initialFocusRef} name="serviceName" label="Service name" value={draft.serviceName} error={errors.serviceName}
      onValueChange={(serviceName) => setDraft((current) => ({ ...current, serviceName }))} />
    <TextField name="region" label="Region" value={draft.region} error={errors.region}
      onValueChange={(region) => setDraft((current) => ({ ...current, region }))} />
    <TextField name="replicas" label="Instance count" type="number" min={1} max={CONCURRENCY_LIMIT} step={1} value={draft.replicas} error={errors.replicas}
      onValueChange={(replicas) => setDraft((current) => ({ ...current, replicas }))} />
    <Checkbox label="Enable auto-scaling" checked={draft.autoScaling}
      onCheckedChange={(autoScaling) => setDraft((current) => ({ ...current, autoScaling }))} />
    <EditorActions cancel={cancel} submit="Save configuration" />
  </form>;
}

function RoutingEditor({ initialFocusRef, complete, cancel, value, onSave }: EditableDetailsEditorProps & {
  value: string;
  onSave: (value: string, signal: AbortSignal) => Promise<void>;
}) {
  const [draft, setDraft] = useState(value);
  const [phase, setPhase] = useState<'editing' | 'confirming' | 'saving'>('editing');
  const [error, setError] = useState<string>();
  const [confirmed, setConfirmed] = useState(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const persist = async () => {
    const controller = new AbortController();
    request.current = controller;
    setError(undefined);
    setPhase('saving');
    try {
      await onSave(draft, controller.signal);
      if (!controller.signal.aborted) complete();
    } catch (failure) {
      if (controller.signal.aborted) return;
      setError(failure instanceof Error ? failure.message : 'Could not save the routing slug. Try again.');
      setPhase('confirming');
    }
  };
  return <form noValidate css={editorStyle} onSubmit={(event) => {
    event.preventDefault();
    if (phase !== 'editing') return;
    if (draft.length < 3 || !/^[a-z0-9-]+$/.test(draft)) {
      setError('Use at least 3 lowercase letters, digits or hyphens.');
      return;
    }
    setError(undefined);
    setConfirmed(false);
    setPhase('confirming');
  }}>
    <TextField ref={initialFocusRef} name="slug" label="Routing slug" value={draft} error={error} readOnly={phase !== 'editing'}
      onValueChange={(next) => { setDraft(next); setError(undefined); }} />
    {phase === 'editing' && <EditorActions cancel={cancel} submit="Apply slug" />}
    {phase !== 'editing' && <div css={confirmationStyle}>
      <p>Change the routing slug to &quot;{draft}&quot;?</p>
      <Checkbox label="Update existing links" checked={confirmed} onCheckedChange={setConfirmed} disabled={phase === 'saving'} />
      {phase === 'saving' && <span role="status">Saving routing slug…</span>}
      <div css={actionsStyle}>
        <Button variant="outline" type="button" disabled={phase === 'saving'} onClick={() => { setPhase('editing'); setError(undefined); }}>Back to edit</Button>
        <Button tone="accent" type="button" disabled={!confirmed || phase === 'saving'} onClick={() => void persist()}>{error ? 'Retry save' : 'Confirm and apply'}</Button>
      </div>
    </div>}
  </form>;
}

function ContactEditor({ initialFocusRef, complete, cancel, value, onSave }: EditableDetailsEditorProps & {
  value: ContactData;
  onSave: (value: ContactData) => Promise<void>;
}) {
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<ContactData>({ defaultValues: value });
  const { ref: emailRef, ...emailProps } = useMemo(() => register('contactEmail', {
    required: 'Enter a contact email.',
    pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email address.' },
  }), [register]);
  const mergedEmailRef = useCallback((node: HTMLInputElement | null) => {
    emailRef(node);
    const cleanup = initialFocusRef(node);
    return () => {
      if (typeof cleanup === 'function') cleanup();
      else initialFocusRef(null);
      emailRef(null);
    };
  }, [emailRef, initialFocusRef]);
  return <form noValidate css={editorStyle} onSubmit={handleSubmit(async (data) => {
    try {
      await onSave(data);
      complete();
    } catch (failure) {
      setError('contactEmail', { type: 'server', message: failure instanceof Error ? failure.message : 'Could not save contact details.' }, { shouldFocus: true });
    }
  })}>
    <TextField {...emailProps} ref={mergedEmailRef} label="Contact email" type="email" error={errors.contactEmail?.message} />
    <TextField {...register('maxConcurrency', {
      valueAsNumber: true,
      validate: (next) => Number.isInteger(next) && next >= 1 && next <= CONCURRENCY_LIMIT || `Enter a whole concurrency limit from 1 to ${CONCURRENCY_LIMIT}.`,
    })} label="Max concurrency" type="number" error={errors.maxConcurrency?.message} />
    <EditorActions cancel={cancel} submit="Save contact" pending={isSubmitting} />
  </form>;
}

interface ActionResult { error: string | null; saved: boolean }
function ClusterEditor({ initialFocusRef, complete, cancel, value, onSave }: EditableDetailsEditorProps & {
  value: string;
  onSave: (value: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState(value);
  const [result, action, pending] = useActionState(async (_previous: ActionResult, data: FormData): Promise<ActionResult> => {
    const raw = data.get('clusterName');
    const next = typeof raw === 'string' ? raw.trim() : '';
    if (!next) return { error: 'Enter a cluster name.', saved: false };
    if (next === 'reserved-cluster') return { error: 'That cluster name is reserved.', saved: false };
    await onSave(next);
    complete();
    return { error: null, saved: true };
  }, { error: null, saved: false });
  return <form action={action} css={editorStyle}>
    <TextField ref={initialFocusRef} name="clusterName" label="Cluster name" value={draft} onValueChange={setDraft} error={result.error} />
    {result.saved && <span role="status">Saved</span>}
    <EditorActions cancel={cancel} submit="Save cluster" pending={pending} />
  </form>;
}

function RetentionRow({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [value, setValue] = useState(30);
  return <EditableDetails.Item label="Retention period" defaultOpen={defaultOpen} renderEditor={(props) => <RetentionEditor {...props} value={value} onSave={setValue} />}>
    {days.format(value)}
  </EditableDetails.Item>;
}
function DeploymentRow() {
  const [value, setValue] = useState(INITIAL_DEPLOYMENT);
  return <EditableDetails.Item label="Deployment configuration" renderEditor={(props) => <DeploymentEditor {...props} value={value} onSave={setValue} />}>
    {value.serviceName} · {value.region} · Instances: {numbers.format(value.replicas)} · {value.autoScaling ? 'Auto-scaling' : 'Static'}
  </EditableDetails.Item>;
}
function ContactRow() {
  const [value, setValue] = useState(INITIAL_CONTACT);
  const save = async (next: ContactData) => {
    if (next.contactEmail === 'restricted@example.com') throw new Error('This contact is restricted. Use another email address.');
    setValue(next);
  };
  return <EditableDetails.Item label="Team contact" renderEditor={(props) => <ContactEditor {...props} value={value} onSave={save} />}>
    {value.contactEmail}
  </EditableDetails.Item>;
}
function InlineTitleRow() {
  const [value, setValue] = useState('Northwind Core');
  return <EditableDetails.Item label="Display title"><InlineEdit label="Display title" value={value} onValueChange={setValue} onSave={() => {}} /></EditableDetails.Item>;
}

interface PendingResponse { resolve: () => void; reject: () => void }
function RoutingDetails() {
  const [value, setValue] = useState('northwind-core');
  const [saving, setSaving] = useState(false);
  const pending = useRef<PendingResponse | null>(null);
  const save = (next: string, signal: AbortSignal) => new Promise<void>((resolve, reject) => {
    setSaving(true);
    const settle = (failure?: Error) => {
      signal.removeEventListener('abort', abort);
      pending.current = null;
      setSaving(false);
      if (failure) reject(failure);
      else { setValue(next); resolve(); }
    };
    const abort = () => settle(new Error('Request cancelled.'));
    signal.addEventListener('abort', abort, { once: true });
    pending.current = {
      resolve: () => settle(),
      reject: () => settle(new Error('That routing slug is unavailable. Try again.')),
    };
  });
  return <>
    <EditableDetails.Section title="Routing" defaultOpen headingLevel={2}>
      <EditableDetails.List><EditableDetails.Item label="Routing slug" renderEditor={(props) => <RoutingEditor {...props} value={value} onSave={save} />}>{value}</EditableDetails.Item></EditableDetails.List>
    </EditableDetails.Section>
    <div css={responseStyle}>
      <Button type="button" variant="outline" disabled={!saving} onClick={() => pending.current?.reject()}>Reject response</Button>
      <Button type="button" variant="outline" disabled={!saving} onClick={() => pending.current?.resolve()}>Resolve response</Button>
    </div>
  </>;
}

interface ActionFixtureProps { onActionOpenChange?: (open: boolean) => void }
function ClusterDetails({ onActionOpenChange }: ActionFixtureProps) {
  const [value, setValue] = useState('prod-cluster-alpha');
  const [open, setOpen] = useState(false);
  return <>
    <EditableDetails.Section title="Cluster" defaultOpen headingLevel={2}>
      <EditableDetails.List><EditableDetails.Item label="Cluster name" open={open} onOpenChange={(next) => {
        onActionOpenChange?.(next);
        if (next) setOpen(true);
      }} renderEditor={(props) => <ClusterEditor {...props} value={value} onSave={async (next) => setValue(next)} />}>{value}</EditableDetails.Item></EditableDetails.List>
    </EditableDetails.Section>
    {open && <Button type="button" variant="outline" onClick={() => setOpen(false)}>Accept close</Button>}
  </>;
}

function ProjectSettingsScene(props: ActionFixtureProps) {
  return <Scene>
    <EditableDetails.Section title="General & limits" defaultOpen headingLevel={2}>
      <EditableDetails.List>
        <EditableDetails.Item label="Project">Northwind</EditableDetails.Item>
        <EditableDetails.Item label="Active incidents">{0}</EditableDetails.Item>
        <EditableDetails.Item label="Maintenance mode">Off</EditableDetails.Item>
        <EditableDetails.Item label="Custom vanity domain">Not set</EditableDetails.Item>
        <RetentionRow /><InlineTitleRow />
      </EditableDetails.List>
    </EditableDetails.Section>
    <EditableDetails.Section title="Deployment" defaultOpen headingLevel={2}>
      <EditableDetails.List><DeploymentRow /><ContactRow /></EditableDetails.List>
    </EditableDetails.Section>
    <RoutingDetails /><ClusterDetails {...props} />
  </Scene>;
}
function ScalarScene({ defaultOpen = false }: { defaultOpen?: boolean }) {
  return <Scene title="Storage"><EditableDetails.List><RetentionRow defaultOpen={defaultOpen} /></EditableDetails.List></Scene>;
}
function GroupedScene() {
  return <Scene title="Deployment"><EditableDetails.List><DeploymentRow /></EditableDetails.List></Scene>;
}
function RoutingScene() { return <Scene title="Routing settings"><RoutingDetails /></Scene>; }
function ContactScene() { return <Scene title="Team contact"><EditableDetails.List><ContactRow /></EditableDetails.List></Scene>; }
function ActionScene(props: ActionFixtureProps) { return <Scene title="Cluster settings"><ClusterDetails {...props} /></Scene>; }
function ComparisonScene() { return <Scene title="Project title"><EditableDetails.List><InlineTitleRow /></EditableDetails.List></Scene>; }

const meta = {
  title: 'Showcase/EditableDetails',
  tags: ['!autodocs', 'dev'],
  args: { onActionOpenChange: fn() },
  parameters: {
    layout: 'fullscreen', controls: { disable: true },
    docs: { description: { component: 'Application-owned native, grouped, React Hook Form and React Action editors. Routing response controls hold a real promise until Resolve or Reject is pressed. Cluster closure is controlled and requires Accept close. Native forms must not be nested inside another form; use form-associated controls there. Controlled Action fields preserve drafts across React form resets.' } },
  },
} satisfies Meta<ActionFixtureProps>;
export default meta;
type Story = StoryObj<ActionFixtureProps>;

export const Default: Story = {
  render: () => <ProjectSettingsScene />,
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'General & limits' })).toHaveAttribute('aria-expanded', 'true');
    await expect(canvas.getByText('0')).toBeVisible();
    await expect(canvas.getByText('Maintenance mode')).toBeVisible();
    await expect(canvas.getByText('Custom vanity domain')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Edit Retention period' }));
    const input = canvas.getByRole('spinbutton', { name: 'Retention period (days)' });
    await expect(input).toHaveFocus();
    await userEvent.clear(input); await userEvent.type(input, '60');
    await userEvent.click(canvas.getByRole('button', { name: 'Save retention' }));
    await expect(canvas.getByText('60 days')).toBeVisible();
  },
};

export const NativeScalarForm: Story = {
  render: () => <ScalarScene />,
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Edit Retention period' }));
    const input = canvas.getByRole('spinbutton', { name: 'Retention period (days)' });
    await expect(input).toHaveFocus();
    for (const invalid of ['500', '1.5', '0']) {
      await userEvent.clear(input); await userEvent.type(input, invalid);
      await userEvent.click(canvas.getByRole('button', { name: 'Save retention' }));
      await expect(input).toHaveValue(Number(invalid));
      await expect(canvas.getByText(`Enter a whole number from 1 to ${RETENTION_LIMIT}.`)).toBeVisible();
    }
    await userEvent.clear(input); await userEvent.type(input, '90');
    await userEvent.keyboard('{Enter}');
    await expect(canvas.getByText('90 days')).toBeVisible();
    await expect(canvas.queryByRole('spinbutton')).not.toBeInTheDocument();
  },
};

export const GroupedFields: Story = {
  render: () => <GroupedScene />,
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Edit Deployment configuration' }));
    const name = canvas.getByRole('textbox', { name: 'Service name' });
    const region = canvas.getByRole('textbox', { name: 'Region' });
    const replicas = canvas.getByRole('spinbutton', { name: 'Instance count' });
    await expect(name).toHaveFocus();
    await userEvent.clear(name); await userEvent.clear(region); await userEvent.clear(replicas); await userEvent.type(replicas, '2.5');
    await userEvent.click(canvas.getByRole('button', { name: 'Save configuration' }));
    for (const message of ['Enter a service name.', 'Enter a region.', `Enter a whole instance count from 1 to ${CONCURRENCY_LIMIT}.`]) await expect(canvas.getByText(message)).toBeVisible();
    await expect(replicas).toHaveValue(2.5);
    await userEvent.type(name, 'edge-proxy'); await userEvent.type(region, 'eu-west-1');
    await userEvent.clear(replicas); await userEvent.type(replicas, '5');
    await userEvent.click(canvas.getByRole('checkbox', { name: 'Enable auto-scaling' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Save configuration' }));
    await expect(canvas.getByText('edge-proxy · eu-west-1 · Instances: 5 · Static')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Edit Deployment configuration' }));
    await expect(canvas.getByRole('textbox', { name: 'Service name' })).toHaveValue('edge-proxy');
  },
};

export const AsyncValidationAndConfirmation: Story = {
  render: () => <RoutingScene />,
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Edit Routing slug' }));
    const input = canvas.getByRole('textbox', { name: 'Routing slug' });
    await expect(input).toHaveFocus();
    await userEvent.clear(input); await userEvent.type(input, 'XX');
    await userEvent.click(canvas.getByRole('button', { name: 'Apply slug' }));
    await expect(canvas.getByText('Use at least 3 lowercase letters, digits or hyphens.')).toBeVisible();
    await userEvent.clear(input); await userEvent.type(input, 'northwind-v2');
    await userEvent.click(canvas.getByRole('button', { name: 'Apply slug' }));
    const confirm = canvas.getByRole('button', { name: 'Confirm and apply' });
    await expect(confirm).toBeDisabled();
    await expect(canvas.getByRole('button', { name: 'Resolve response' })).toBeDisabled();
    await userEvent.click(canvas.getByRole('checkbox', { name: 'Update existing links' }));
    await userEvent.click(confirm);
    await expect(canvas.getByRole('status')).toHaveTextContent('Saving routing slug…');
    await expect(input).toHaveValue('northwind-v2');
    await expect(confirm).toBeDisabled();
    await expect(canvas.getByRole('button', { name: 'Resolve response' })).toBeEnabled();
    const section = canvas.getByRole('button', { name: 'Routing' });
    await userEvent.click(section);
    await expect(input).not.toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Resolve response' })).toBeEnabled();
    await userEvent.click(canvas.getByRole('button', { name: 'Reject response' }));
    await userEvent.click(section);
    await expect(canvas.getByRole('textbox', { name: 'Routing slug' })).toBe(input);
    await expect(input).toHaveValue('northwind-v2');
    await expect(canvas.getByText('That routing slug is unavailable. Try again.')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Retry save' }));
    await expect(canvas.getByRole('status')).toHaveTextContent('Saving routing slug…');
    await userEvent.click(canvas.getByRole('button', { name: 'Resolve response' }));
    await waitFor(() => expect(canvas.queryByRole('textbox')).not.toBeInTheDocument());
    await expect(canvas.getByText('northwind-v2')).toBeVisible();
  },
};

export const ReactHookForm: Story = {
  render: () => <ContactScene />,
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Edit Team contact' }));
    const input = canvas.getByRole('textbox', { name: 'Contact email' });
    await expect(input).toHaveFocus();
    await userEvent.clear(input);
    await userEvent.click(canvas.getByRole('button', { name: 'Save contact' }));
    await expect(canvas.getByText('Enter a contact email.')).toBeVisible();
    await expect(input).toHaveFocus();
    await userEvent.type(input, 'restricted@example.com');
    await userEvent.click(canvas.getByRole('button', { name: 'Save contact' }));
    await expect(canvas.getByText('This contact is restricted. Use another email address.')).toBeVisible();
    await expect(input).toHaveValue('restricted@example.com');
    await userEvent.clear(input); await userEvent.type(input, 'sre@example.com');
    const concurrency = canvas.getByRole('spinbutton', { name: 'Max concurrency' });
    await userEvent.clear(concurrency); await userEvent.type(concurrency, '1.5');
    await userEvent.click(canvas.getByRole('button', { name: 'Save contact' }));
    await expect(canvas.getByText(`Enter a whole concurrency limit from 1 to ${CONCURRENCY_LIMIT}.`)).toBeVisible();
    await expect(concurrency).toHaveFocus();
    await userEvent.clear(concurrency); await userEvent.type(concurrency, '8');
    await userEvent.click(canvas.getByRole('button', { name: 'Save contact' }));
    await waitFor(() => expect(canvas.getByText('sre@example.com')).toBeVisible());
    await expect(canvas.queryByRole('textbox')).not.toBeInTheDocument();
  },
};

export const ActionStateForm: Story = {
  render: (args) => <ActionScene {...args} />,
  play: async ({ canvasElement, userEvent, args }) => {
    const actionRequests = args.onActionOpenChange;
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Edit Cluster name' }));
    const input = canvas.getByRole('textbox', { name: 'Cluster name' });
    await userEvent.clear(input);
    await userEvent.click(canvas.getByRole('button', { name: 'Save cluster' }));
    await expect(canvas.getByText('Enter a cluster name.')).toBeVisible();
    await expect(input).toHaveValue('');
    await userEvent.type(input, 'reserved-cluster');
    await userEvent.click(canvas.getByRole('button', { name: 'Save cluster' }));
    await expect(canvas.getByText('That cluster name is reserved.')).toBeVisible();
    await expect(input).toHaveValue('reserved-cluster');
    await expect(actionRequests).toHaveBeenCalledTimes(1);
    for (const [index, next] of ['prod-cluster-beta', 'prod-cluster-gamma'].entries()) {
      await userEvent.clear(input); await userEvent.type(input, next);
      await userEvent.click(canvas.getByRole('button', { name: 'Save cluster' }));
      await waitFor(() => expect(actionRequests).toHaveBeenCalledTimes(index + 2));
      await expect(actionRequests).toHaveBeenLastCalledWith(false);
      await expect(input).toHaveValue(next);
      await expect(input).toBeVisible();
    }
    await userEvent.type(input, '-draft');
    await expect(actionRequests).toHaveBeenCalledTimes(3);
    await userEvent.click(canvas.getByRole('button', { name: 'Accept close' }));
    await expect(canvas.getByText('prod-cluster-gamma')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Edit Cluster name' }));
    await expect(canvas.getByRole('textbox', { name: 'Cluster name' })).toHaveValue('prod-cluster-gamma');
  },
};

export const InlineEditComparison: Story = {
  render: () => <ComparisonScene />,
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /Edit Display title/ }));
    const input = canvas.getByRole('textbox', { name: 'Display title' });
    await expect(input).toHaveFocus();
    await expect(canvas.queryByRole('group')).not.toBeInTheDocument();
    await userEvent.clear(input); await userEvent.type(input, 'Northwind Next');
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }));
    await expect(canvas.getByText('Northwind Next')).toBeVisible();
  },
};

export const PersistentOpenAndError: Story = {
  render: () => <ScalarScene defaultOpen />,
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole('spinbutton', { name: 'Retention period (days)' });
    await userEvent.clear(input); await userEvent.type(input, '0');
    await userEvent.click(canvas.getByRole('button', { name: 'Save retention' }));
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    await expect(canvas.getByRole('alert')).toHaveTextContent(`Enter a whole number from 1 to ${RETENTION_LIMIT}.`);
  },
};
export const Light: Story = {
  globals: { theme: 'light' },
  render: () => <ProjectSettingsScene />,
  play: async ({ canvasElement }) => {
    await expect(canvasElement.ownerDocument.documentElement).toHaveAttribute('data-theme', 'light');
  },
};
export const Mobile: Story = {
  render: () => <div css={mobileStyle}><ProjectSettingsScene /></div>,
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Edit Deployment configuration' }));
    await userEvent.clear(canvas.getByRole('textbox', { name: 'Service name' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Save configuration' }));
    const page = canvasElement.querySelector<HTMLElement>('main')!;
    await expect(page.getBoundingClientRect().width).toBeLessThanOrEqual(320);
    await expect(page.scrollWidth).toBeLessThanOrEqual(page.clientWidth);
    await expect(canvas.getByText('Enter a service name.')).toBeVisible();
  },
};
export const Rtl: Story = {
  render: () => <div dir="rtl" css={mobileStyle}><ProjectSettingsScene /></div>,
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Edit Retention period' }));
    const input = canvas.getByRole('spinbutton', { name: 'Retention period (days)' });
    await expect(input).toHaveFocus();
    await expect(getComputedStyle(input).direction).toBe('rtl');
    const page = canvasElement.querySelector<HTMLElement>('main')!;
    await expect(page.scrollWidth).toBeLessThanOrEqual(page.clientWidth);
  },
};
