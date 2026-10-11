import { useState, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, waitFor, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { withLightTheme } from '../../testing/story-decorators';
import { Popover } from '../popover';
import { ExpandableCard, type ExpandableCardProps } from './index';

const frameStyle = css({ inlineSize: 'min(100%, 640px)', minInlineSize: 0 });
const fixtureStyle = css({
  minBlockSize: vars.space[8],
  padding: vars.space[2],
  color: vars.color.text,
  backgroundColor: vars.color.surface,
  border: `1px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.sm,
  font: 'inherit',
});
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
            Team name <input aria-label="Team name" defaultValue="Studio" css={fixtureStyle} />
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
      <div css={frameStyle}>
        <Story />
      </div>
    ),
  ],
  render: (args) => <Example {...args} />,
  parameters: {
    docs: {
      source: { code: usage },
      description: {
        component:
          'Standalone APG disclosure. Enter and Space toggle; Tab and Shift+Tab follow document order; Escape requests collapse. Details remain mounted. Controlled requests do not commit until open changes. Choose headingLevel to match the page hierarchy.',
      },
    },
  },
} satisfies Meta<typeof ExpandableCard>;
export default meta;
type Story = StoryObj<typeof meta>;
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
export const Default: Story = {
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
export const Small: Story = { args: { size: 'sm' } };
export const Medium: Story = { args: { size: 'md' } };
export const PersistentOpen: Story = { args: { defaultOpen: true } };
export const LightTheme: Story = {
  decorators: [withLightTheme],
  globals: { theme: 'light' },
};
export const PersistentOpenLight: Story = {
  ...PersistentOpen,
  decorators: [withLightTheme],
  globals: { theme: 'light' },
};
export const Disabled: Story = {
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
  play: async ({ canvas, userEvent }) => {
    const trigger = canvas.getByRole('button');
    const article = trigger.closest('article')!;
    await waitFor(async () => {
      await expect(Math.abs(article.getBoundingClientRect().width - 320)).toBeLessThan(1.5);
    });
    await userEvent.click(trigger);
    await waitFor(
      async () => {
        await expect(
          Math.abs(
            article.getBoundingClientRect().width -
              Math.min(600, article.parentElement!.getBoundingClientRect().width),
          ),
        ).toBeLessThan(1.5);
      },
      { timeout: 4000 },
    );
    await expect(article.getBoundingClientRect().width).toBeLessThanOrEqual(
      article.parentElement!.getBoundingClientRect().width + 1.5,
    );
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
          Review the organization’s current plan and all members across several teams and locations.
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
      <button css={fixtureStyle} onClick={() => setOpen(!open)}>
        External toggle
      </button>
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
      <button css={fixtureStyle} onClick={() => setMore(!more)}>
        Toggle details
      </button>
      {more && (
        <p>
          Additional storage, collaboration, support and billing details for every member in the workspace.
          Changes to detail content resize the retained panel.
        </p>
      )}
    </Example>
  );
}
export const DynamicDetails: Story = {
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
  args: { defaultOpen: true },
  render: (args) => (
    <Example {...args}>
      <Popover>
        <Popover.Trigger>More actions</Popover.Trigger>
        <Popover.Content aria-label="Plan actions">
          <button css={fixtureStyle}>Archive plan</button>
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
  args: { dir: 'rtl', defaultOpen: true },
  play: async ({ canvas }) => {
    await expect(getComputedStyle(canvas.getByRole('button')).direction).toBe('rtl');
  },
};
export const ForcedColors: Story = {
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
  render: (args) => (
    <ExpandableCard {...args} defaultOpen onKeyDown={(event) => event.preventDefault()}>
      <ExpandableCard.Trigger onClick={(event) => event.preventDefault()}>
        <ExpandableCard.Title>Plan</ExpandableCard.Title>
      </ExpandableCard.Trigger>
      <ExpandableCard.Content>
        <button css={fixtureStyle}>Edit details</button>
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
      <button css={fixtureStyle} onClick={() => setOpen((value) => !value)}>
        Toggle externally
      </button>
      <Example {...args} open={open}>
        <button css={fixtureStyle} onClick={() => setOpen(false)}>
          Apply and close
        </button>
      </Example>
    </>
  );
}
export const ExternalFocusRepair: Story = {
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
