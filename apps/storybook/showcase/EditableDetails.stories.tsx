import { useState, type KeyboardEvent } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, waitFor, within } from 'storybook/test';
import { Controller, useForm } from 'react-hook-form';
import { vars } from '@jfrader/tokens/vars';
import {
  Button,
  Card,
  Checkbox,
  EditableDetails,
  Flex,
  NumberField,
  Popover,
  Stack,
  TextField,
  styled,
  type EditableDetailsEditorProps,
} from '@jfrader/ui';
import './showcase.css';

const LOCALE = 'en-US';
const SAVE_DELAY_MS = 300;
const INSTANCES = { min: 1, max: 64 } as const;
const REGIONS = ['eu-west-1', 'eu-central-1', 'us-east-1', 'ap-south-1'] as const;
const RESERVED_SERVICE = 'billing';
const COLLAPSE_SHORTCUT = 'Alt+Shift+C';
const summaryList = new Intl.ListFormat(LOCALE, { style: 'narrow', type: 'unit' });

type Region = (typeof REGIONS)[number];
interface Deployment {
  serviceName: string;
  instances: number;
  autoScaling: boolean;
}
interface Project {
  name: string;
  owner: string;
  region: Region;
  deployment: Deployment;
}
const PROJECT: Project = {
  name: 'Northwind',
  owner: 'Platform team',
  region: 'eu-west-1',
  deployment: { serviceName: 'api-gateway', instances: 3, autoScaling: true },
};

const summarize = ({ serviceName, instances, autoScaling }: Deployment) =>
  summaryList.format([serviceName, `Instances: ${instances}`, `Auto-scaling: ${autoScaling ? 'On' : 'Off'}`]);

// The application's API: saves take a moment, and the server rejects a reserved service name.
const persist = <T,>(next: T) => new Promise<T>((resolve) => { setTimeout(() => resolve(next), SAVE_DELAY_MS); });
async function persistDeployment(next: Deployment) {
  await persist(next);
  if (next.serviceName === RESERVED_SERVICE) throw new Error(`The name ${RESERVED_SERVICE} is reserved. Choose another.`);
  return next;
}

const isCollapseShortcut = (event: KeyboardEvent) => event.altKey && event.shiftKey && event.code === 'KeyC';

const MobileFrame = styled.div({ inlineSize: 'min(100%, 320px)', marginInline: 'auto' });
const RegionList = styled.div({ display: 'grid', gap: vars.space[1], padding: vars.space[2] });

function EditorActions({ pending, cancel, onSave }: Pick<EditableDetailsEditorProps, 'pending' | 'cancel'> & { onSave?: () => void }) {
  return (
    <Flex gap="sm" justify="end" wrap>
      <Button variant="ghost" aria-disabled={pending || undefined} onClick={cancel}>Cancel</Button>
      <Button type={onSave ? 'button' : 'submit'} tone="accent" loading={pending} onClick={onSave}>Save</Button>
    </Flex>
  );
}

interface ValueEditorProps<T> extends EditableDetailsEditorProps {
  value: T;
  onSave: (next: T) => Promise<unknown>;
}

// An object value through React Hook Form: the form validates, and the row owns the save session.
function DeploymentEditor({ initialFocusRef, submit, cancel, pending, errorId, value, onSave }: ValueEditorProps<Deployment>) {
  const { register, control, handleSubmit, formState: { errors } } = useForm<Deployment>({ defaultValues: value });
  const { ref: serviceRef, ...service } = register('serviceName', { required: 'Enter a service name.' });
  return (
    <form noValidate onSubmit={handleSubmit((next) => submit(() => onSave(next)))}>
      <Stack gap="sm">
        <TextField
          {...service}
          ref={(node) => {
            serviceRef(node);
            initialFocusRef(node);
          }}
          label="Service name"
          error={errors.serviceName?.message}
          readOnly={pending}
          aria-describedby={errorId}
        />
        <Controller
          control={control}
          name="instances"
          rules={{ validate: (next) => Number.isInteger(next) || `Enter ${INSTANCES.min} to ${INSTANCES.max} instances.` }}
          render={({ field, fieldState }) => (
            <NumberField
              label="Instances"
              min={INSTANCES.min}
              max={INSTANCES.max}
              value={field.value}
              onValueChange={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
              readOnly={pending}
            />
          )}
        />
        <Controller
          control={control}
          name="autoScaling"
          render={({ field }) => (
            <Checkbox label="Auto-scaling" checked={field.value} onCheckedChange={field.onChange} disabled={pending} />
          )}
        />
        <EditorActions pending={pending} cancel={cancel} />
      </Stack>
    </form>
  );
}

// A portaled picker: the popover closes while its section is collapsed and reopens with the draft.
function RegionEditor({ initialFocusRef, submit, cancel, pending, errorId, visible, value, onSave }: ValueEditorProps<Region>) {
  const [draft, setDraft] = useState(value);
  const [pickerOpen, setPickerOpen] = useState(false);
  return (
    <Stack gap="sm">
      <Popover open={visible && pickerOpen} onOpenChange={setPickerOpen}>
        <Popover.Trigger ref={initialFocusRef} aria-describedby={errorId}>{draft}</Popover.Trigger>
        <Popover.Content aria-label="Regions">
          <RegionList>
            {REGIONS.map((region) => (
              <Button
                key={region}
                variant={region === draft ? 'soft' : 'ghost'}
                aria-pressed={region === draft}
                onClick={() => {
                  setDraft(region);
                  setPickerOpen(false);
                }}
              >
                {region}
              </Button>
            ))}
          </RegionList>
        </Popover.Content>
      </Popover>
      <EditorActions pending={pending} cancel={cancel} onSave={() => submit(() => onSave(draft))} />
    </Stack>
  );
}

function ProjectSettings() {
  const [project, setProject] = useState(PROJECT);
  const [expanded, setExpanded] = useState<readonly string[]>(['general', 'deployment']);
  const [deploymentError, setDeploymentError] = useState<string | null>(null);
  const saveDeployment = async (next: Deployment) => {
    setDeploymentError(null);
    try {
      const deployment = await persistDeployment(next);
      setProject((current) => ({ ...current, deployment }));
    } catch (failure) {
      if (failure instanceof Error) setDeploymentError(failure.message);
      throw failure;
    }
  };
  const collapseAll = () => setExpanded([]);
  return (
    <main className="showcase-page" onKeyDown={(event) => { if (isCollapseShortcut(event)) collapseAll(); }}>
      <h1 className="showcase-title">Project settings</h1>
      <Stack>
        <Flex justify="end">
          <Button variant="outline" aria-keyshortcuts={COLLAPSE_SHORTCUT} onClick={collapseAll}>Collapse all</Button>
        </Flex>
        <Card>
          <Card.Content>
            <EditableDetails
              headingLevel={2}
              expanded={expanded}
              onExpandedChange={setExpanded}
              onSave={async (name) => {
                await persist(name);
                setProject((current) => ({ ...current, name }));
              }}
              rows={[
                {
                  id: 'general',
                  label: 'General',
                  children: [
                    { id: 'name', label: 'Project name', value: project.name, edit: true },
                    { id: 'owner', label: 'Owner', value: project.owner },
                  ],
                },
                {
                  id: 'deployment',
                  label: 'Deployment',
                  children: [
                    {
                      id: 'region',
                      label: 'Primary region',
                      value: project.region,
                      renderEditor: (editor) => (
                        <RegionEditor {...editor} value={project.region} onSave={async (region) => {
                          await persist(region);
                          setProject((current) => ({ ...current, region }));
                        }} />
                      ),
                    },
                    {
                      id: 'configuration',
                      label: 'Configuration',
                      value: summarize(project.deployment),
                      error: deploymentError,
                      renderEditor: (editor) => (
                        <DeploymentEditor {...editor} value={project.deployment} onSave={saveDeployment} />
                      ),
                    },
                  ],
                },
              ]}
            />
          </Card.Content>
        </Card>
      </Stack>
    </main>
  );
}

const itemOf = (canvasElement: HTMLElement, label: string) =>
  within(
    Array.from(canvasElement.querySelectorAll<HTMLElement>('[data-ui="editable-details-item"]')).find(
      (item) => item.querySelector('dt')?.textContent === label,
    )!,
  );

const meta = {
  title: 'Showcase/EditableDetails',
  component: ProjectSettings,
  tags: ['!autodocs', 'dev'],
  parameters: {
    layout: 'fullscreen',
    controls: { disable: true },
    docs: {
      description: { component: 'Edit project settings with a React Hook Form editor and a region picker.' },
      usage: `- Press ${COLLAPSE_SHORTCUT} or Collapse all to collapse every section.
- The server rejects the service name "${RESERVED_SERVICE}".`,
    },
  },
} satisfies Meta<typeof ProjectSettings>;
export default meta;
type Story = StoryObj<typeof meta>;

export const ObjectValueForm: Story = {
  name: 'Object value through React Hook Form',
  play: async ({ canvasElement, userEvent }) => {
    const configuration = itemOf(canvasElement, 'Configuration');
    await userEvent.click(configuration.getByRole('button', { name: 'Edit Configuration' }));
    const service = configuration.getByRole('textbox', { name: 'Service name' });
    await expect(service).toHaveFocus();

    // The form's own validation blocks the save before the row starts one.
    await userEvent.clear(service);
    await userEvent.click(configuration.getByRole('button', { name: 'Save' }));
    await expect(await configuration.findByText('Enter a service name.')).toBeVisible();
    await expect(configuration.getByRole('group', { name: 'Configuration' })).not.toHaveAttribute('aria-busy');

    await userEvent.type(service, 'edge-proxy');
    const instances = configuration.getByRole('spinbutton', { name: 'Instances' });
    await userEvent.clear(instances);
    await userEvent.type(instances, '5');
    await userEvent.click(configuration.getByRole('checkbox', { name: 'Auto-scaling' }));
    await userEvent.click(configuration.getByRole('button', { name: 'Save' }));
    await expect(configuration.getByRole('group', { name: 'Configuration' })).toHaveAttribute('aria-busy', 'true');

    const saved = summarize({ serviceName: 'edge-proxy', instances: 5, autoScaling: false });
    await expect(await configuration.findByText(saved)).toBeVisible();
    await expect(configuration.getByRole('button', { name: 'Edit Configuration' })).toHaveFocus();
  },
};

export const PortaledPicker: Story = {
  name: 'Portaled picker',
  play: async ({ canvas, canvasElement, userEvent }) => {
    const page = within(canvasElement.ownerDocument.body);
    const region = itemOf(canvasElement, 'Primary region');
    await userEvent.click(region.getByRole('button', { name: 'Edit Primary region' }));
    const trigger = region.getByRole('button', { name: 'eu-west-1' });
    await expect(trigger).toHaveFocus();

    // The picker renders outside the details and still belongs to the row's editor.
    await userEvent.click(trigger);
    const picker = await page.findByRole('dialog', { name: 'Regions' });
    await expect(canvasElement.contains(picker)).toBe(false);
    await userEvent.click(within(picker).getByRole('button', { name: 'us-east-1' }));
    await waitFor(() => expect(page.queryByRole('dialog', { name: 'Regions' })).toBeNull());
    await expect(region.getByRole('button', { name: 'us-east-1' })).toBeVisible();

    // Collapsing while focus is in the portaled picker closes it and moves focus to the section title.
    await userEvent.click(region.getByRole('button', { name: 'us-east-1' }));
    const reopened = await page.findByRole('dialog', { name: 'Regions' });
    within(reopened).getByRole('button', { name: 'ap-south-1' }).focus();
    await userEvent.keyboard('{Alt>}{Shift>}C{/Shift}{/Alt}');
    const section = canvas.getByRole('button', { name: 'Deployment' });
    await expect(section).toHaveAttribute('aria-expanded', 'false');
    await waitFor(() => expect(page.queryByRole('dialog', { name: 'Regions' })).toBeNull());
    await expect(section).toHaveFocus();

    // Expanding again shows the editor with its draft; saving persists the picked region.
    await userEvent.keyboard('{Enter}');
    await userEvent.click(region.getByRole('button', { name: 'Save' }));
    await expect(await region.findByRole('button', { name: 'Edit Primary region' })).toHaveFocus();
    await expect(region.getByText('us-east-1')).toBeVisible();
  },
};

export const ServerRejection: Story = {
  name: 'Server rejection keeps the editor open',
  play: async ({ canvasElement, userEvent }) => {
    const configuration = itemOf(canvasElement, 'Configuration');
    await userEvent.click(configuration.getByRole('button', { name: 'Edit Configuration' }));
    const service = configuration.getByRole('textbox', { name: 'Service name' });
    await userEvent.clear(service);
    await userEvent.type(service, `${RESERVED_SERVICE}{Enter}`);

    // The server's message is the row's error; the editor keeps the draft and the focus.
    const alert = await configuration.findByRole('alert');
    await expect(alert).toHaveTextContent(`The name ${RESERVED_SERVICE} is reserved. Choose another.`);
    await expect(configuration.getByRole('group', { name: 'Configuration' })).toHaveAttribute('aria-describedby', alert.id);
    await expect(service.getAttribute('aria-describedby')!.split(' ')).toContain(alert.id);
    await expect(service).toHaveValue(RESERVED_SERVICE);
    await expect(service).toHaveFocus();
    await expect(configuration.queryByText(summarize(PROJECT.deployment))).toBeNull();
  },
};

export const Mobile: Story = {
  name: 'Narrow layout',
  render: () => <MobileFrame><ProjectSettings /></MobileFrame>,
  play: async ({ canvasElement, userEvent }) => {
    const configuration = itemOf(canvasElement, 'Configuration');
    await userEvent.click(configuration.getByRole('button', { name: 'Edit Configuration' }));
    await userEvent.clear(configuration.getByRole('textbox', { name: 'Service name' }));
    await userEvent.click(configuration.getByRole('button', { name: 'Save' }));
    await expect(await configuration.findByText('Enter a service name.')).toBeVisible();

    // The open editor, its error, and its actions fit the column without scrolling sideways.
    const page = canvasElement.querySelector<HTMLElement>('main')!;
    await expect(page.getBoundingClientRect().width).toBeLessThanOrEqual(320);
    await expect(page.scrollWidth).toBeLessThanOrEqual(page.clientWidth);
    const value = configuration.getByRole('definition').getBoundingClientRect();
    for (const element of [configuration.getByRole('group'), configuration.getByRole('button', { name: 'Save' })]) {
      const box = element.getBoundingClientRect();
      await expect(box.left).toBeGreaterThanOrEqual(value.left);
      await expect(box.right).toBeLessThanOrEqual(value.right);
    }
  },
};
