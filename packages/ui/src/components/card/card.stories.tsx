import type { CSSProperties } from 'react';
import { useId } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { withLightTheme } from '../../testing/story-decorators';
import { expectContrastSurface, expectThemedSurface } from '../../testing/theme-assertions';
import { Button } from '../button';
import { Popover } from '../popover';
import { TextField } from '../text-field';
import { ThemeRoot } from '../theme-root';
import { Card, type CardProps, type CardVariant } from './index';

const VARIANTS = ['flat', 'raised'] as const satisfies readonly CardVariant[];

const frameStyle = css({
  display: 'grid',
  gap: vars.space[4],
  inlineSize: '360px',
});

const listStyle = {
  margin: 0,
  paddingInlineStart: vars.space[5],
} satisfies CSSProperties;

const formStyle = {
  display: 'grid',
  gap: vars.space[3],
} satisfies CSSProperties;

const fixtureButtonStyle = {
  minHeight: '24px',
  minWidth: '24px',
  padding: '4px 10px',
  boxSizing: 'border-box',
} satisfies CSSProperties;

const meta = {
  title: 'Data display/Card',
  component: Card,
  args: { variant: 'raised' },
  argTypes: {
    variant: { control: 'radio', options: VARIANTS },
  },
  decorators: [
    (Story) => (
      <div css={frameStyle}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Card>;

export default meta;

type Story = StoryObj<typeof meta>;

function PlanCard(props: CardProps) {
  return (
    <Card {...props}>
      <Card.Header>
        <Card.Title>Pro plan</Card.Title>
        <Card.Description>Billed monthly, renews on 1 November.</Card.Description>
      </Card.Header>
      <Card.Content>
        <ul style={listStyle}>
          <li>Unlimited projects</li>
          <li>10 GB storage</li>
          <li>Priority support</li>
        </ul>
      </Card.Content>
      <Card.Footer>
        <Button variant="outline">Cancel plan</Button>
        <Button tone="accent">Upgrade</Button>
      </Card.Footer>
    </Card>
  );
}
PlanCard.displayName = 'PlanCard';

function partsOf(element: Element) {
  return Array.from(element.children, (child) => child.getAttribute('data-ui'));
}

function getCards(canvasElement: HTMLElement) {
  return Array.from(canvasElement.querySelectorAll<HTMLElement>('[data-ui="card"]'));
}

export const Basic: Story = {
  render: (args) => <PlanCard {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const card = getCards(canvasElement)[0]!;
    await expect(card).toHaveAttribute('data-variant', 'raised');
    await expect(partsOf(card)).toEqual(['card-header', 'card-content', 'card-footer']);

    const header = card.querySelector('[data-ui="card-header"]') as HTMLElement;
    await expect(partsOf(header)).toEqual(['card-title', 'card-description']);

    const title = canvas.getByRole('heading', { level: 3, name: 'Pro plan' });
    await expect(title.tagName).toBe('H3');
    await expect(canvas.getByText('Billed monthly, renews on 1 November.').tagName).toBe('P');
    // A plain card adds no landmark or other role of its own.
    await expect(card).not.toHaveAttribute('role');
    await expect(canvas.queryByRole('region')).toBeNull();

    const footer = card.querySelector('[data-ui="card-footer"]') as HTMLElement;
    const [leading, trailing] = within(footer).getAllByRole('button');
    await expect(within(footer).getAllByRole('button')).toHaveLength(2);
    await expect(getComputedStyle(footer).borderBlockStartStyle).toBe('solid');
    // Fractional devicePixelRatios device-snap border widths; assert a drawn border, not literal px.
    await expect(parseFloat(getComputedStyle(footer).borderBlockStartWidth)).toBeGreaterThan(0);
    // Leading content sits on the start edge, actions on the end edge.
    await expect(getComputedStyle(footer).justifyContent).toBe('space-between');
    const footerRect = footer.getBoundingClientRect();
    await expect(leading!.getBoundingClientRect().left).toBeCloseTo(footerRect.left, 0);
    await expect(trailing!.getBoundingClientRect().right).toBeCloseTo(footerRect.right, 0);
  },
};

export const SingleAction: Story = {
  render: (args) => (
    <Card {...args}>
      <Card.Header>
        <Card.Title>Account</Card.Title>
      </Card.Header>
      <Card.Footer>
        <Button tone="accent">Save</Button>
      </Card.Footer>
    </Card>
  ),
  play: async ({ canvasElement }) => {
    const footer = canvasElement.querySelector<HTMLElement>('[data-ui="card-footer"]');
    if (!footer) throw new Error('Expected a card footer');
    const action = within(footer).getByRole('button', { name: 'Save' });
    await expect(footer.children).toHaveLength(1);
    await expect(parseFloat(getComputedStyle(action).marginInlineStart)).toBeGreaterThan(0);
    const footerRect = footer.getBoundingClientRect();
    const actionRect = action.getBoundingClientRect();
    const isRtl = getComputedStyle(footer).direction === 'rtl';
    await expect(isRtl ? actionRect.left : actionRect.right).toBeCloseTo(
      isRtl ? footerRect.left : footerRect.right,
      0,
    );
  },
};

export const HeadingLevel: Story = {
  render: (args) => (
    <Card {...args}>
      <Card.Header>
        <Card.Title level={2}>Usage</Card.Title>
      </Card.Header>
      <Card.Content>4 of 10 projects used.</Card.Content>
    </Card>
  ),
  play: async ({ canvasElement }) => {
    const title = within(canvasElement).getByRole('heading', { level: 2, name: 'Usage' });
    await expect(title.tagName).toBe('H2');
  },
};

export const Variants: Story = {
  render: (args) => (
    <>
      {VARIANTS.map((variant) => (
        <PlanCard {...args} key={variant} variant={variant} />
      ))}
    </>
  ),
  play: async ({ canvasElement }) => {
    const [flat, raised] = getCards(canvasElement);
    if (!flat || !raised) throw new Error('Expected flat and raised cards');
    await expect(flat).toHaveAttribute('data-variant', 'flat');
    await expect(raised).toHaveAttribute('data-variant', 'raised');
    await expect(getComputedStyle(flat).boxShadow).toBe('none');
    await expect(getComputedStyle(raised).boxShadow).not.toBe('none');
    for (const card of [flat, raised]) {
      await expect(getComputedStyle(card).borderTopStyle).toBe('solid');
      await expect(parseFloat(getComputedStyle(card).borderTopWidth)).toBeGreaterThan(0);
    }
  },
};

function InviteCard(props: CardProps) {
  const titleId = useId();
  const formId = useId();
  return (
    <Card {...props} role="region" aria-labelledby={titleId}>
      <Card.Header>
        <Card.Title id={titleId}>Invite a teammate</Card.Title>
        <Card.Description>They get editor access to this workspace.</Card.Description>
      </Card.Header>
      <Card.Content>
        <form id={formId} style={formStyle} onSubmit={(event) => event.preventDefault()}>
          <TextField label="Email" type="email" name="email" placeholder="ana@example.com" />
        </form>
      </Card.Content>
      <Card.Footer>
        <Button variant="outline" type="reset" form={formId}>
          Clear
        </Button>
        <Button tone="accent" type="submit" form={formId}>
          Send invite
        </Button>
      </Card.Footer>
    </Card>
  );
}
InviteCard.displayName = 'InviteCard';

export const WithForm: Story = {
  render: (args) => <InviteCard {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const region = canvas.getByRole('region', { name: 'Invite a teammate' });
    await expect(region).toHaveAttribute('data-ui', 'card');
    await expect(within(region).getByRole('heading', { level: 3 })).toHaveTextContent('Invite a teammate');
    await expect(within(region).getByRole('textbox', { name: 'Email' })).toBeInTheDocument();
    await expect(within(region).getByRole('button', { name: 'Send invite' })).toHaveAttribute('type', 'submit');
  },
};

const slotTitleStyle = css({ fontSize: vars.textSize.lg });

export const SlotProps: Story = {
  render: (args) => (
    <>
      <PlanCard {...args} />
      <PlanCard {...args} slotProps={{ title: { css: slotTitleStyle, className: 'plan-title' } }} />
    </>
  ),
  play: async ({ canvasElement }) => {
    const [plain, slotted] = within(canvasElement).getAllByRole('heading', { level: 3 });
    if (!plain || !slotted) throw new Error('Expected plain and slotted headings');
    await expect(plain).not.toHaveClass('plan-title');
    await expect(slotted).toHaveClass('plan-title');
    await expect(parseFloat(getComputedStyle(slotted).fontSize)).toBeGreaterThan(
      parseFloat(getComputedStyle(plain).fontSize),
    );
  },
};

const slotRootOverrideStyle = css({ fontStyle: 'italic' });
const consumerRootOverrideStyle = css({ fontStyle: 'normal' });
const slotTitleOverrideStyle = css({ textTransform: 'uppercase' });
const consumerTitleOverrideStyle = css({ textTransform: 'lowercase' });

export const ConsumerStylePrecedence: Story = {
  parameters: {
    docs: {
      source: {
        code: `<Card
  variant="raised"
  className="consumer-card"
  css={css({ fontStyle: 'normal' })}
  slotProps={{
    root: { className: 'slot-card', css: css({ fontStyle: 'italic' }) },
    title: { className: 'slot-title', css: css({ textTransform: 'uppercase' }) },
  }}
>
  <Card.Title className="consumer-title" css={css({ textTransform: 'lowercase' })}>
    Consumer styles
  </Card.Title>
</Card>`,
      },
    },
  },
  render: (args) => (
    <Card
      {...args}
      className="consumer-card"
      css={consumerRootOverrideStyle}
      slotProps={{
        root: { className: 'slot-card', css: slotRootOverrideStyle },
        title: { className: 'slot-title', css: slotTitleOverrideStyle },
      }}
    >
      <Card.Title className="consumer-title" css={consumerTitleOverrideStyle}>
        Consumer styles
      </Card.Title>
    </Card>
  ),
  play: async ({ canvasElement }) => {
    const card = getCards(canvasElement)[0]!;
    const title = within(canvasElement).getByRole('heading', { name: 'Consumer styles' });
    await expect(card).toHaveClass('slot-card', 'consumer-card');
    await expect(title).toHaveClass('slot-title', 'consumer-title');
    await expect(getComputedStyle(card).fontStyle).toBe('normal');
    await expect(getComputedStyle(title).textTransform).toBe('lowercase');
  },
};

export const LightTheme: Story = {
  decorators: [withLightTheme],
  render: (args) => (
    <>
      {VARIANTS.map((variant) => (
        <PlanCard {...args} key={variant} variant={variant} />
      ))}
      <InviteCard {...args} />
    </>
  ),
  play: async ({ canvasElement }) => {
    await expect(getCards(canvasElement)).toHaveLength(VARIANTS.length + 1);
    await expect(within(canvasElement).getAllByRole('heading', { level: 3 })).toHaveLength(VARIANTS.length + 1);
  },
};

export const Contrast: Story = {
  args: { appearance: 'contrast' },
  decorators: [withLightTheme],
  globals: { theme: 'light' },
  render: (args) => (
    <>
      <PlanCard {...args} />
      <PlanCard />
    </>
  ),
  play: async ({ canvasElement }) => {
    const [contrastCard, defaultCard] = getCards(canvasElement);
    if (!contrastCard || !defaultCard) throw new Error('Expected both cards');

    // The requested card wears the dark theme plus the charcoal overrides on a light page; the one
    // beside it keeps the page palette by naming no appearance.
    await expect(contrastCard).toHaveAttribute('data-theme', 'dark');
    await expect(contrastCard).toHaveAttribute('data-appearance', 'contrast');
    await expectContrastSurface(contrastCard, 'light');
    await expect(getComputedStyle(contrastCard).backgroundColor).toBe('rgb(32, 34, 38)');
    await expect(getComputedStyle(contrastCard).colorScheme).toBe('dark');

    await expect(defaultCard).not.toHaveAttribute('data-theme');
    await expect(defaultCard).not.toHaveAttribute('data-appearance');
    await expectThemedSurface(defaultCard, 'light');
    await expect(getComputedStyle(defaultCard).colorScheme).toBe('light');
  },
};

export const ContrastNestedSurfaces: Story = {
  decorators: [withLightTheme],
  globals: { theme: 'light' },
  render: () => (
    <Card appearance="contrast">
      <Card.Header>
        <Card.Title>Contrast panel</Card.Title>
      </Card.Header>
      <Card.Content>
        <Card>
          <Card.Header>
            <Card.Title>Inherited surface</Card.Title>
          </Card.Header>
          <Card.Content>
            <Popover>
              <Popover.Trigger>Inner options</Popover.Trigger>
              <Popover.Content aria-label="Inner options">
                <button type="button" style={fixtureButtonStyle}>
                  Assign to me
                </button>
              </Popover.Content>
            </Popover>
          </Card.Content>
        </Card>
        <ThemeRoot theme="light">
          <Card>
            <Card.Header>
              <Card.Title>Theme surface</Card.Title>
            </Card.Header>
            <Card.Content>
              <Popover>
                <Popover.Trigger>Theme options</Popover.Trigger>
                <Popover.Content aria-label="Theme options">
                  <button type="button" style={fixtureButtonStyle}>
                    Assign to me
                  </button>
                </Popover.Content>
              </Popover>
            </Card.Content>
          </Card>
        </ThemeRoot>
      </Card.Content>
    </Card>
  ),
  play: async ({ canvasElement, userEvent: user }) => {
    const canvas = within(canvasElement);
    const [outer, inherited, themed] = getCards(canvasElement);
    if (!outer || !inherited || !themed) throw new Error('Expected the three nested cards');

    // A surface that names no appearance keeps the enclosing palette, in the DOM…
    await expect(outer).toHaveAttribute('data-appearance', 'contrast');
    await expect(inherited).not.toHaveAttribute('data-theme');
    await expect(getComputedStyle(inherited).backgroundColor).toBe(getComputedStyle(outer).backgroundColor);

    // …and through the portal: the overlay opened inside the nested surface stays the dark family.
    await user.click(canvas.getByRole('button', { name: 'Inner options' }));
    const innerPopover = await within(canvasElement.ownerDocument.body).findByRole('dialog', {
      name: 'Inner options',
    });
    await expect(innerPopover.closest('[data-ui="theme-boundary"]')).toHaveAttribute('data-appearance', 'contrast');
    await expectContrastSurface(innerPopover, 'light');

    // Returning to the page palette inside a contrast surface is a theme root's job: it names the
    // theme it wants, so neither the surface nor the portal has to guess.
    await expectThemedSurface(themed, 'light');
    await user.click(canvas.getByRole('button', { name: 'Theme options' }));
    const themePopover = await within(canvasElement.ownerDocument.body).findByRole('dialog', {
      name: 'Theme options',
    });
    await expect(themePopover.closest('[data-ui="theme-boundary"]')).toHaveAttribute('data-theme', 'light');
    await expectThemedSurface(themePopover, 'light');
  },
};

export const RTL: Story = {
  render: (args) => (
    <div dir="rtl">
      <PlanCard {...args} dir="rtl" />
      <Card {...args} dir="rtl">
        <Card.Header>
          <Card.Title>الحساب</Card.Title>
        </Card.Header>
        <Card.Footer>
          <Button tone="accent">حفظ</Button>
        </Card.Footer>
      </Card>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const [planCard, singleCard] = getCards(canvasElement);
    if (!planCard || !singleCard) throw new Error('Expected plan and single-action cards');

    await expect(planCard).toHaveAttribute('dir', 'rtl');
    await expect(getComputedStyle(planCard).direction).toBe('rtl');

    // Two-action footer: in RTL, the first button sits on the right (start) and the second on the left (end).
    const planFooter = planCard.querySelector('[data-ui="card-footer"]') as HTMLElement;
    const [cancelBtn, upgradeBtn] = within(planFooter).getAllByRole('button');
    const planFooterRect = planFooter.getBoundingClientRect();
    await expect(cancelBtn!.getBoundingClientRect().right).toBeCloseTo(planFooterRect.right, 0);
    await expect(upgradeBtn!.getBoundingClientRect().left).toBeCloseTo(planFooterRect.left, 0);

    // Single-action footer: marginInlineStart: 'auto' pins the lone button to the inline end (left in RTL).
    const singleFooter = singleCard.querySelector('[data-ui="card-footer"]') as HTMLElement;
    const saveBtn = within(singleFooter).getByRole('button', { name: 'حفظ' });
    const singleFooterRect = singleFooter.getBoundingClientRect();
    await expect(saveBtn.getBoundingClientRect().left).toBeCloseTo(singleFooterRect.left, 0);
  },
};

export const ForcedColors: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Structural fixture for a browser forced-colors check. This story does not emulate the media query.',
      },
    },
  },
  render: (args) => (
    <>
      {VARIANTS.map((variant) => (
        <PlanCard {...args} key={variant} variant={variant} />
      ))}
    </>
  ),
  play: async ({ canvasElement }) => {
    const cards = getCards(canvasElement);
    await expect(cards).toHaveLength(VARIANTS.length);
    for (const card of cards) {
      // Both flat and raised variants maintain physical borders (>0px) when shadows are suppressed.
      await expect(getComputedStyle(card).borderTopStyle).toBe('solid');
      await expect(parseFloat(getComputedStyle(card).borderTopWidth)).toBeGreaterThan(0);
      const footer = card.querySelector('[data-ui="card-footer"]') as HTMLElement;
      await expect(getComputedStyle(footer).borderBlockStartStyle).toBe('solid');
      await expect(parseFloat(getComputedStyle(footer).borderBlockStartWidth)).toBeGreaterThan(0);
    }
  },
};

