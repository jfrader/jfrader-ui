import { useState, type ComponentPropsWithRef, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, waitFor, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { withLightTheme } from '../../testing/story-decorators';
import { Popover } from '../popover';
import { ExpandableCard, type ExpandableCardCompoundProps as ExpandableCardProps, type ExpandableCardEasyProps } from './index';
// `styled` is the app-facing styling API; consumers import it from `@jfrader/ui`.
import { styled } from '../../index';

const Frame = styled.div({
  inlineSize: 'min(100%, 640px)',
  maxInlineSize: `calc(100vw - ${vars.space[8]})`,
  minInlineSize: 0,
});
// Definite parent widths: the centered story frame is otherwise shrink-to-fit around the card.
const MorphParent = styled.div({ inlineSize: '640px', maxInlineSize: '100%' });
const NarrowParentFrame = styled.div({ inlineSize: '200px' });
const GEOMETRY_TOLERANCE = 1.5;
const Fixture = styled.input({
  minBlockSize: vars.space[8],
  padding: vars.space[2],
  color: vars.color.text,
  backgroundColor: vars.color.surface,
  border: `1px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.sm,
  font: 'inherit',
});
const FixtureButton = Fixture.withComponent('button');
const usage = `<ExpandableCard collapsedInlineSize={400} expandedInlineSize={600}>
  <ExpandableCard.Trigger>
    <ExpandableCard.Title>Studio plan</ExpandableCard.Title>
    <ExpandableCard.Description>Billing and team details</ExpandableCard.Description>
  </ExpandableCard.Trigger>
  <ExpandableCard.Content>Plan details</ExpandableCard.Content>
</ExpandableCard>`;
function Example({ children, ...args }: ExpandableCardProps) {
  return (
    <ExpandableCard {...args}>
      <ExpandableCard.Trigger>
        <ExpandableCard.Title>Studio plan</ExpandableCard.Title>
        <ExpandableCard.Description>Billing and team details</ExpandableCard.Description>
      </ExpandableCard.Trigger>
      <ExpandableCard.Content>
        {children ?? (
          <label>
            Team name <Fixture aria-label="Team name" defaultValue="Studio" />
          </label>
        )}
      </ExpandableCard.Content>
    </ExpandableCard>
  );
}
const meta = {
  title: 'Surfaces/ExpandableCard',
  component: ExpandableCard,
  tags: ['autodocs'],
  args: { onOpenChange: fn() },
  decorators: [
    (Story) => (
      <Frame>
        <Story />
      </Frame>
    ),
  ],
  render: (args) => <Example {...args} />,
  parameters: {
    docs: {
      source: { code: usage },
      description: {
        component:
          'Show or hide details inside a card.',
      },
      usage: '- Pass `title`, optional `description` and `content`, or compose the dotted parts with `children`.\n- Follows the APG disclosure pattern. Enter and Space toggle; Escape requests collapse. Tab and Shift+Tab follow document order.\n- Details remain mounted. Controlled requests take effect when `open` changes.\n- Choose `headingLevel` to match the page hierarchy.\n- Use `slotProps` to customize generated parts. `component` replaces the root, as does `slots.root`. Replacements receive the wired native element props; forward all props and ref to that element. Declare replacements outside render.',
    },
  },
} satisfies Meta<ExpandableCardProps>;
export default meta;
type Story = StoryObj<Omit<ExpandableCardProps, 'component'>>;
type CheckedEasyArgs<Args extends ExpandableCardEasyProps> = Args;
export type EasyModeTypeRegression = {
  // @ts-expect-error Presentation props cannot be combined with compound children.
  mixed: CheckedEasyArgs<{ title: string; content: string; children: string }>;
};
function ExpandableHost(props: ComponentPropsWithRef<'article'> & { 'data-ui'?: string }) {
  return <article {...props} data-ui={`${props['data-ui']} custom-root`} data-testid="expandable-host" />;
}
function DetailsPanel(props: ComponentPropsWithRef<'div'>) {
  return <div {...props} data-testid="details-panel" />;
}
async function settled(panel: HTMLElement, open: boolean) {
  await waitFor(
    async () => {
      await expect(panel.hidden).toBe(!open);
      if (open) {
        const inner = panel.firstElementChild as HTMLElement;
        await expect(
          Math.abs(panel.getBoundingClientRect().height - inner.getBoundingClientRect().height),
        ).toBeLessThan(1.5);
        await expect(Number(getComputedStyle(panel).opacity)).toBeGreaterThan(0.98);
      }
    },
    { timeout: 4000 },
  );
}
/** Waits until `measure()` is within tolerance of `expected()` and has stopped moving between samples. */
async function settledAt(measure: () => number, expected: () => number) {
  let previous = Number.NaN;
  await waitFor(
    async () => {
      const current = measure();
      const moving = Math.abs(current - previous);
      previous = current;
      await expect(Math.abs(current - expected())).toBeLessThan(GEOMETRY_TOLERANCE);
      await expect(moving).toBeLessThan(0.1);
    },
    { timeout: 4000, interval: 50 },
  );
}
export const Default: StoryObj<Omit<ExpandableCardEasyProps, 'component'>> = {
  args: { title: 'Studio plan', description: 'Billing and team details', content: 'Billed annually. 5 seats, renews on 12 Jan.', onOpenChange: fn() },
  render: (args) => <ExpandableCard {...args} />,
  parameters: { docs: { source: { code: `<ExpandableCard title="Studio plan" description="Billing and team details" content="Billed annually. 5 seats, renews on 12 Jan." />` } } },
  play: async ({ canvas, userEvent, args }) => {
    const trigger = canvas.getByRole('button', { name: /^Studio plan/ });
    const panel = trigger.ownerDocument.getElementById(trigger.getAttribute('aria-controls')!)!;
    trigger.focus();
    await userEvent.keyboard('{Enter}');
    await settled(panel, true);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(true);
    await userEvent.keyboard('{Escape}');
    await settled(panel, false);
  },
};

// This story tests native style and sx forwarding through the slot API.
export const GeneratedPartProps: StoryObj<Omit<ExpandableCardEasyProps, 'component'>> = {
  tags: ['!autodocs'],
  args: { title: 'Studio plan', content: 'Plan details', defaultOpen: true, slotProps: { title: { style: { fontStyle: 'italic' } }, content: { sx: { color: vars.color.accentText } } } },
  render: (args) => <ExpandableCard {...args} />,
  parameters: { docs: { source: { code: `<ExpandableCard title="Studio plan" content={details} slotProps={{ title: { sx: { fontStyle: 'italic' } } }} />` } } },
  play: async ({ canvas }) => { await expect(canvas.getByText('Studio plan')).toHaveStyle({ fontStyle: 'italic' }); },
};

export const Compound: Story = {
  play: async ({ canvas, userEvent, args }) => {
    const trigger = canvas.getByRole('button', { name: /^Studio plan/ });
    const panel = trigger.ownerDocument.getElementById(trigger.getAttribute('aria-controls')!)!;
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(panel.inert).toBe(true);
    await userEvent.click(trigger);
    await settled(panel, true);
    const input = canvas.getByRole('textbox');
    await userEvent.clear(input);
    await userEvent.type(input, 'Retained team');
    await userEvent.click(trigger);
    await settled(panel, false);
    await userEvent.click(trigger);
    await settled(panel, true);
    await expect(input).toHaveValue('Retained team');
    await expect(args.onOpenChange).toHaveBeenCalledTimes(3);
    await expect(args.onOpenChange).toHaveBeenNthCalledWith(1, true);
    await expect(args.onOpenChange).toHaveBeenNthCalledWith(2, false);
    await expect(args.onOpenChange).toHaveBeenNthCalledWith(3, true);
  },
};

export const EasyControlled: StoryObj<Omit<ExpandableCardEasyProps, 'component'>> = {
  args: { title: 'Studio plan', content: 0, open: false, onOpenChange: fn() },
  render: (args) => <ExpandableCard {...args} />,
  play: async ({ canvas, userEvent, args }) => {
    const trigger = canvas.getByRole('button', { name: 'Studio plan' });
    await userEvent.click(trigger);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(true);
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  },
};
export const EasyDisabled: StoryObj<Omit<ExpandableCardEasyProps, 'component'>> = {
  args: { title: 'Studio plan', content: 'Details', disabled: true, onOpenChange: fn() },
  render: (args) => <ExpandableCard {...args} />,
  play: async ({ canvas, userEvent, args }) => {
    const trigger = canvas.getByRole('button', { name: 'Studio plan' });
    await expect(trigger).toBeDisabled();
    await userEvent.click(trigger);
    await expect(args.onOpenChange).not.toHaveBeenCalled();
  },
};
export const ReplacedParts: StoryObj<Omit<ExpandableCardEasyProps, 'component'>> = {
  tags: ['!autodocs'],
  args: { title: 'Studio plan', content: 0, slots: { root: ExpandableHost, content: DetailsPanel }, defaultOpen: true, slotProps: { root: { 'aria-label': 'Plan details' } } },
  render: (args) => <ExpandableCard {...args} />,
  parameters: { docs: { source: { code: `<ExpandableCard title="Studio plan" content={details} component={ExpandableHost} slotProps={{ root: { 'aria-label': 'Plan details' } }} />` } } },
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.getByTestId('expandable-host')).toHaveAccessibleName('Plan details');
    await expect(canvas.getByText('0')).toBeVisible();
    const panel = canvas.getByTestId('details-panel');
    await settled(panel, true);
    canvas.getByRole('button', { name: 'Studio plan' }).focus();
    await userEvent.keyboard('{Escape}');
    await settled(panel, false);
    await expect(panel.inert).toBe(true);
  },
};
export const Small: Story = {
  args: { size: 'sm' },
  parameters: { docs: { source: { language: 'tsx', code: `import { ExpandableCard, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const TeamInput = styled.input({
  minBlockSize: vars.space[8],
  padding: vars.space[2],
  color: vars.color.text,
  backgroundColor: vars.color.surface,
  border: \`1px solid \${vars.color.borderControl}\`,
  borderRadius: vars.radius.sm,
  font: 'inherit',
});

export function SmallPlan() {
  return (
    <ExpandableCard size="sm">
      <ExpandableCard.Trigger>
        <ExpandableCard.Title>Studio plan</ExpandableCard.Title>
        <ExpandableCard.Description>Billing and team details</ExpandableCard.Description>
      </ExpandableCard.Trigger>
      <ExpandableCard.Content>
        <label>Team name <TeamInput aria-label="Team name" defaultValue="Studio" /></label>
      </ExpandableCard.Content>
    </ExpandableCard>
  );
}` } } },
};
export const Medium: Story = {
  args: { size: 'md' },
  parameters: { docs: { source: { language: 'tsx', code: `import { ExpandableCard, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const TeamInput = styled.input({
  minBlockSize: vars.space[8],
  padding: vars.space[2],
  color: vars.color.text,
  backgroundColor: vars.color.surface,
  border: \`1px solid \${vars.color.borderControl}\`,
  borderRadius: vars.radius.sm,
  font: 'inherit',
});

export function MediumPlan() {
  return (
    <ExpandableCard size="md">
      <ExpandableCard.Trigger>
        <ExpandableCard.Title>Studio plan</ExpandableCard.Title>
        <ExpandableCard.Description>Billing and team details</ExpandableCard.Description>
      </ExpandableCard.Trigger>
      <ExpandableCard.Content>
        <label>Team name <TeamInput aria-label="Team name" defaultValue="Studio" /></label>
      </ExpandableCard.Content>
    </ExpandableCard>
  );
}` } } },
};
export const PersistentOpen: Story = { tags: ['!autodocs'], args: { defaultOpen: true } };
export const LightTheme: Story = {
  decorators: [withLightTheme],
  globals: { theme: 'light' },
};
export const PersistentOpenLight: Story = {
  ...PersistentOpen,
  tags: ['!autodocs'],
  decorators: [withLightTheme],
  globals: { theme: 'light' },
};
export const Disabled: Story = {
  tags: ['!autodocs'],
  args: { disabled: true, defaultOpen: true },
  play: async ({ canvas, userEvent, args }) => {
    const trigger = canvas.getByRole('button');
    await expect(trigger).toBeDisabled();
    await userEvent.click(trigger);
    await expect(args.onOpenChange).not.toHaveBeenCalled();
    await expect(canvas.getByRole('textbox')).toBeEnabled();
  },
};
export const WidthMorph: Story = {
  args: { collapsedInlineSize: 320, expandedInlineSize: 600 },
  parameters: { docs: { source: { language: 'tsx', code: `import { ExpandableCard, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const PlanLane = styled.div({ inlineSize: '640px', maxInlineSize: '100%' });
const TeamInput = styled.input({
  minBlockSize: vars.space[8],
  padding: vars.space[2],
  color: vars.color.text,
  backgroundColor: vars.color.surface,
  border: \`1px solid \${vars.color.borderControl}\`,
  borderRadius: vars.radius.sm,
  font: 'inherit',
});

export function ResizingPlan() {
  return (
    <PlanLane>
      <ExpandableCard collapsedInlineSize={320} expandedInlineSize={600}>
        <ExpandableCard.Trigger>
          <ExpandableCard.Title>Studio plan</ExpandableCard.Title>
          <ExpandableCard.Description>Billing and team details</ExpandableCard.Description>
        </ExpandableCard.Trigger>
        <ExpandableCard.Content>
          <label>Team name <TeamInput aria-label="Team name" defaultValue="Studio" /></label>
        </ExpandableCard.Content>
      </ExpandableCard>
    </PlanLane>
  );
}` } } },
  decorators: [
    (Story) => (
      <MorphParent>
        <Story />
      </MorphParent>
    ),
  ],
  play: async ({ canvas, userEvent }) => {
    const trigger = canvas.getByRole('button');
    const article = trigger.closest('article')!;
    const room = () => article.parentElement!.getBoundingClientRect().width;
    const width = () => article.getBoundingClientRect().width;
    await settledAt(width, () => Math.min(320, room()));
    await userEvent.click(trigger);
    await settledAt(width, () => Math.min(600, room()));
    await expect(width()).toBeLessThanOrEqual(room() + GEOMETRY_TOLERANCE);
  },
};
export const NarrowParent: Story = {
  decorators: [
    (Story) => (
      <NarrowParentFrame>
        <Story />
      </NarrowParentFrame>
    ),
  ],
  play: async ({ canvas, userEvent }) => {
    const trigger = canvas.getByRole('button');
    await userEvent.click(trigger);
    const panel = canvas.getByRole('region');
    await settled(panel, true);
    const inner = panel.firstElementChild as HTMLElement;
    const bounds = panel.getBoundingClientRect();
    for (const element of [panel, inner])
      await expect(element.scrollWidth).toBeLessThanOrEqual(element.clientWidth + GEOMETRY_TOLERANCE);
    const input = canvas.getByRole('textbox').getBoundingClientRect();
    await expect(input.left).toBeGreaterThanOrEqual(bounds.left - GEOMETRY_TOLERANCE);
    await expect(input.right).toBeLessThanOrEqual(bounds.right + GEOMETRY_TOLERANCE);
  },
};
export const FillParent: Story = {
  play: async ({ canvas }) => {
    const article = canvas.getByRole('button').closest('article')!;
    await waitFor(async () => {
      await expect(
        Math.abs(
          article.getBoundingClientRect().width - article.parentElement!.getBoundingClientRect().width,
        ),
      ).toBeLessThan(1.5);
    });
  },
};
export const LongSummary: Story = {
  render: (args) => (
    <ExpandableCard {...args}>
      <ExpandableCard.Trigger>
        <ExpandableCard.Title>
          International creative production, billing, subscriptions and workspace administration
        </ExpandableCard.Title>
        <ExpandableCard.Description>
          Review the plan and members across teams and locations.
        </ExpandableCard.Description>
      </ExpandableCard.Trigger>
      <ExpandableCard.Content>Workspace details</ExpandableCard.Content>
    </ExpandableCard>
  ),
  play: async ({ canvas }) => {
    const trigger = canvas.getByRole('button');
    const title = trigger.querySelector('[data-ui="expandable-card-title"]')!;
    await expect(title.getBoundingClientRect().right).toBeLessThanOrEqual(
      trigger.getBoundingClientRect().right + 1.5,
    );
    await expect(trigger.scrollWidth).toBeLessThanOrEqual(trigger.clientWidth + 1.5);
  },
};
export const EmptyDetails: Story = {
  tags: ['!autodocs'],
  args: { children: '', defaultOpen: true },
};
export const KeyboardNavigation: Story = {
  play: async ({ canvas, userEvent, args }) => {
    const trigger = canvas.getByRole('button');
    await userEvent.tab();
    await expect(trigger.ownerDocument.activeElement).toBe(trigger);
    await expect(getComputedStyle(trigger).outlineStyle).not.toBe('none');
    await expect(Math.abs(parseFloat(getComputedStyle(trigger).outlineWidth) - 2)).toBeLessThan(1.1);
    await userEvent.keyboard('{Enter}');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await userEvent.keyboard(' ');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await userEvent.keyboard('{Enter}');
    const panel = canvas.getByRole('region');
    await settled(panel, true);
    await userEvent.tab();
    const input = canvas.getByRole('textbox');
    await expect(input.ownerDocument.activeElement).toBe(input);
    await userEvent.tab({ shift: true });
    await expect(trigger.ownerDocument.activeElement).toBe(trigger);
    await userEvent.tab();
    await userEvent.keyboard('{Escape}');
    await expect(trigger.ownerDocument.activeElement).toBe(trigger);
    await expect(getComputedStyle(trigger).outlineStyle).not.toBe('none');
    await expect(panel.inert).toBe(true);
    await settled(panel, false);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(4);
    for (const [index, value] of [true, false, true, false].entries())
      await expect(args.onOpenChange).toHaveBeenNthCalledWith(index + 1, value);
  },
};
function ControlledExample(args: ExpandableCardProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <FixtureButton onClick={() => setOpen(!open)}>
        External toggle
      </FixtureButton>
      <Example
        {...args}
        open={open}
        onOpenChange={(value) => {
          args.onOpenChange?.(value);
          setOpen(value);
        }}
      />
    </>
  );
}
export const Controlled: Story = {
  render: (args) => <ControlledExample {...args} />,
  play: async ({ canvas, userEvent, args }) => {
    const trigger = canvas.getByRole('button', { name: /^Studio plan/ });
    await userEvent.click(canvas.getByRole('button', { name: 'External toggle' }));
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(args.onOpenChange).not.toHaveBeenCalled();
    await userEvent.click(trigger);
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenCalledWith(false);
  },
};
export const ControlledReject: Story = {
  tags: ['!autodocs'],
  args: { open: true },
  play: async ({ canvas, userEvent, args }) => {
    const input = canvas.getByRole('textbox');
    const panel = canvas.getByRole('region');
    await settled(panel, true);
    const before = panel.getBoundingClientRect().height;
    await userEvent.click(input);
    await userEvent.keyboard('{Escape}');
    await expect(input.ownerDocument.activeElement).toBe(input);
    await expect(panel.inert).toBe(false);
    await expect(panel.hidden).toBe(false);
    await expect(Math.abs(panel.getBoundingClientRect().height - before)).toBeLessThan(1.5);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(1);
    await expect(args.onOpenChange).toHaveBeenCalledWith(false);
    await expect(canvas.getByRole('button')).toHaveAttribute('aria-expanded', 'true');
  },
};
export const RapidReversal: Story = {
  ...WidthMorph,
  parameters: { docs: { source: { language: 'tsx', code: `import { ExpandableCard, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const PlanLane = styled.div({ inlineSize: '640px', maxInlineSize: '100%' });
const TeamInput = styled.input({
  minBlockSize: vars.space[8],
  padding: vars.space[2],
  color: vars.color.text,
  backgroundColor: vars.color.surface,
  border: \`1px solid \${vars.color.borderControl}\`,
  borderRadius: vars.radius.sm,
  font: 'inherit',
});

export function ReversiblePlan() {
  return (
    <PlanLane>
      <ExpandableCard collapsedInlineSize={320} expandedInlineSize={600}>
        <ExpandableCard.Trigger>
          <ExpandableCard.Title>Studio plan</ExpandableCard.Title>
          <ExpandableCard.Description>Billing and team details</ExpandableCard.Description>
        </ExpandableCard.Trigger>
        <ExpandableCard.Content>
          <label>Team name <TeamInput aria-label="Team name" defaultValue="Studio" /></label>
        </ExpandableCard.Content>
      </ExpandableCard>
    </PlanLane>
  );
}` } } },
  play: async ({ canvas, userEvent, args }) => {
    const trigger = canvas.getByRole('button');
    await userEvent.click(trigger);
    await userEvent.click(trigger);
    await userEvent.click(trigger);
    const panel = canvas.getByRole('region');
    await settled(panel, true);
    await expect(panel.inert).toBe(false);
    await expect(args.onOpenChange).toHaveBeenCalledTimes(3);
  },
};
function DynamicExample(args: ExpandableCardProps) {
  const [more, setMore] = useState(false);
  return (
    <Example {...args} defaultOpen>
      <FixtureButton onClick={() => setMore(!more)}>
        Toggle details
      </FixtureButton>
      {more && (
        <p>
          Storage, collaboration, support and billing details for each member.
          Changes to detail content resize the retained panel.
        </p>
      )}
    </Example>
  );
}
export const DynamicDetails: Story = {
  tags: ['!autodocs'],
  render: (args) => <DynamicExample {...args} />,
  play: async ({ canvas, userEvent }) => {
    const panel = canvas.getByRole('region');
    await settled(panel, true);
    const before = panel.getBoundingClientRect().height;
    await userEvent.click(canvas.getByRole('button', { name: 'Toggle details' }));
    await waitFor(
      async () => {
        await expect(panel.getBoundingClientRect().height).toBeGreaterThan(before + 10);
      },
      { timeout: 4000 },
    );
    await settled(panel, true);
  },
};
export const NestedOverlay: Story = {
  tags: ['!autodocs'],
  args: { defaultOpen: true },
  render: (args) => (
    <Example {...args}>
      <Popover>
        <Popover.Trigger>More actions</Popover.Trigger>
        <Popover.Content aria-label="Plan actions">
          <FixtureButton>Archive plan</FixtureButton>
        </Popover.Content>
      </Popover>
    </Example>
  ),
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'More actions' }));
    const body = within(canvas.getByRole('button', { name: 'More actions' }).ownerDocument.body);
    const action = await body.findByRole('button', { name: 'Archive plan' });
    await userEvent.click(action);
    await userEvent.keyboard('{Escape}');
    await expect(canvas.getByRole('button', { name: /^Studio plan/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    await expect(args.onOpenChange).not.toHaveBeenCalled();
  },
};
export const ExternalARIA: Story = {
  tags: ['!autodocs'],
  render: (args) => (
    <>
      <span id="external-title">Organization</span>
      <span id="external-description">Annual billing</span>
      <ExpandableCard {...args} defaultOpen>
        <ExpandableCard.Trigger
          aria-label="Consumer label"
          aria-labelledby="external-title unresolved-reference"
          aria-describedby="external-description"
        >
          <ExpandableCard.Title>Studio</ExpandableCard.Title>
          <ExpandableCard.Description>0</ExpandableCard.Description>
        </ExpandableCard.Trigger>
        <ExpandableCard.Content
          aria-label="Consumer region"
          aria-labelledby="external-title unresolved-reference"
          aria-describedby="external-description"
        >
          Plan details
        </ExpandableCard.Content>
      </ExpandableCard>
    </>
  ),
  play: async ({ canvas }) => {
    const trigger = canvas.getByRole('button');
    const panel = canvas.getByRole('region');
    const title = trigger.querySelector('[data-ui="expandable-card-title"]')!;
    const description = trigger.querySelector('[data-ui="expandable-card-description"]')!;
    for (const element of [trigger, panel]) {
      await expect(element).toHaveAttribute(
        'aria-labelledby',
        `external-title unresolved-reference ${title.id}${element === trigger ? ` ${description.id}` : ''}`,
      );
      // The trigger's visible Description is part of its NAME (label-in-name); announcing it again
      // as a description would double it. The region keeps it as a description.
      await expect(element).toHaveAttribute(
        'aria-describedby',
        element === panel ? `external-description ${description.id}` : 'external-description',
      );
    }
    await expect(trigger).toHaveAttribute('aria-label', 'Consumer label');
    await expect(panel).toHaveAttribute('aria-label', 'Consumer region');
  },
};
const falsy: ReactNode[] = [false, null, 0, ''];
export const FalsyNodes: Story = {
  render: (args) => (
    <>
      {falsy.map((value, index) => (
        <ExpandableCard {...args} key={index} aria-label={`Card ${index}`}>
          <ExpandableCard.Trigger aria-label={`Details ${index}`}>
            <ExpandableCard.Title>{value}</ExpandableCard.Title>
            <ExpandableCard.Description>{value}</ExpandableCard.Description>
          </ExpandableCard.Trigger>
          <ExpandableCard.Content>{value}</ExpandableCard.Content>
        </ExpandableCard>
      ))}
    </>
  ),
  play: async ({ canvas }) => {
    for (const [index, trigger] of canvas.getAllByRole('button').entries()) {
      await expect(trigger.querySelectorAll('[data-ui="expandable-card-title"]')).toHaveLength(
        index < 2 ? 0 : 1,
      );
      await expect(trigger.querySelectorAll('[data-ui="expandable-card-description"]')).toHaveLength(
        index < 2 ? 0 : 1,
      );
      if (index < 2) await expect(trigger).not.toHaveAttribute('aria-describedby');
      if (index === 2) await expect(trigger.textContent).toBe('0 0');
    }
  },
};
export const RTL: Story = {
  tags: ['!autodocs'],
  args: { dir: 'rtl', defaultOpen: true },
  play: async ({ canvas }) => {
    await expect(getComputedStyle(canvas.getByRole('button')).direction).toBe('rtl');
  },
};
export const ForcedColors: Story = {
  tags: ['!autodocs'],
  args: { defaultOpen: true },
  parameters: {
    docs: {
      description: {
        story:
          'Structural fixture for a browser forced-colors check. This story does not emulate the media query.',
      },
    },
  },
  play: async ({ canvas }) => {
    const caret = getComputedStyle(canvas.getByRole('button'), '::after');
    await expect(caret.borderBlockStartColor).toBe('rgba(0, 0, 0, 0)');
    await expect(caret.borderBlockEndColor).toBe('rgba(0, 0, 0, 0)');
    await expect(parseFloat(caret.borderInlineStartWidth)).toBeGreaterThan(0);
    await expect(
      parseFloat(getComputedStyle(canvas.getByRole('button').closest('article')!).borderTopWidth),
    ).toBeGreaterThan(0);
  },
};
export const ReducedMotion: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Interactive fixture for prefers-reduced-motion browser QA. The play test asserts disclosure lifecycle, not media emulation.',
      },
    },
  },
  play: async ({ canvas, userEvent }) => {
    const trigger = canvas.getByRole('button');
    await userEvent.click(trigger);
    const panel = canvas.getByRole('region');
    await settled(panel, true);
    await userEvent.click(trigger);
    await settled(panel, false);
  },
};

const articleRefSpy = fn();
const triggerRefSpy = fn();
const panelRefSpy = fn();
export const RefsAndStyling: Story = {
  tags: ['!autodocs'],
  args: { ref: articleRefSpy, defaultOpen: true },
  render: (args) => (
    <ExpandableCard {...args} sx={{ borderRadius: vars.radius.sm }}>
      <ExpandableCard.Trigger ref={triggerRefSpy} sx={{ paddingInline: vars.space[6] }}>
        <ExpandableCard.Title sx={{ fontWeight: vars.fontWeight.semibold }}>Plan</ExpandableCard.Title>
        <ExpandableCard.Description sx={{ fontSize: vars.textSize.md }}>Annual</ExpandableCard.Description>
      </ExpandableCard.Trigger>
      <ExpandableCard.Content ref={panelRefSpy} sx={{ backgroundColor: vars.color.surfaceInset }}>
        Details
      </ExpandableCard.Content>
    </ExpandableCard>
  ),
  play: async ({ canvas }) => {
    const trigger = canvas.getByRole('button');
    const article = trigger.closest('article')!;
    const panel = canvas.getByRole('region');
    await expect(articleRefSpy).toHaveBeenCalledWith(article);
    await expect(triggerRefSpy).toHaveBeenCalledWith(trigger);
    await expect(panelRefSpy).toHaveBeenCalledWith(panel);
    await expect(Math.abs(parseFloat(getComputedStyle(article).borderRadius) - 8)).toBeLessThan(1.1);
    await expect(Math.abs(parseFloat(getComputedStyle(trigger).paddingInlineStart) - 24)).toBeLessThan(1.1);
    await expect(
      getComputedStyle(trigger.querySelector('[data-ui="expandable-card-title"]')!).fontWeight,
    ).toBe('600');
    await expect(getComputedStyle(panel).backgroundColor).not.toBe(getComputedStyle(article).backgroundColor);
  },
};
export const PreventedInteractions: Story = {
  tags: ['!autodocs'],
  render: (args) => (
    <ExpandableCard {...args} defaultOpen onKeyDown={(event) => event.preventDefault()}>
      <ExpandableCard.Trigger onClick={(event) => event.preventDefault()}>
        <ExpandableCard.Title>Plan</ExpandableCard.Title>
      </ExpandableCard.Trigger>
      <ExpandableCard.Content>
        <FixtureButton>Edit details</FixtureButton>
      </ExpandableCard.Content>
    </ExpandableCard>
  ),
  play: async ({ canvas, userEvent, args }) => {
    const trigger = canvas.getByRole('button', { name: 'Plan' });
    await userEvent.click(trigger);
    await userEvent.click(canvas.getByRole('button', { name: 'Edit details' }));
    await userEvent.keyboard('{Escape}');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(args.onOpenChange).not.toHaveBeenCalled();
  },
};

function ExternalFocusExample(args: ExpandableCardProps) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <FixtureButton onClick={() => setOpen((value) => !value)}>
        Toggle externally
      </FixtureButton>
      <Example {...args} open={open}>
        <FixtureButton onClick={() => setOpen(false)}>
          Apply and close
        </FixtureButton>
      </Example>
    </>
  );
}
export const ExternalFocusRepair: Story = {
  tags: ['!autodocs'],
  render: (args) => <ExternalFocusExample {...args} />,
  play: async ({ canvas, userEvent, args }) => {
    const action = canvas.getByRole('button', { name: 'Apply and close' });
    await userEvent.click(action);
    const trigger = canvas.getByRole('button', { name: /^Studio plan/ });
    await expect(trigger.ownerDocument.activeElement).toBe(trigger);
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    const external = canvas.getByRole('button', { name: 'Toggle externally' });
    await userEvent.click(external);
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(external);
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(external.ownerDocument.activeElement).toBe(external);
    await expect(args.onOpenChange).not.toHaveBeenCalled();
  },
};
