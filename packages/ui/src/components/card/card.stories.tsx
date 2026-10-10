import { useId } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { Button } from '../button';
import { TextField } from '../text-field';
import { Card, type CardProps, type CardVariant } from './index';

const VARIANTS = ['flat', 'raised'] as const satisfies readonly CardVariant[];

const frameStyle = css({
  display: 'grid',
  gap: vars.space[4],
  inlineSize: '360px',
});

const listStyle = css({
  margin: 0,
  paddingInlineStart: vars.space[5],
});

const formStyle = css({
  display: 'grid',
  gap: vars.space[3],
});

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
        <ul css={listStyle}>
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
    await expect(within(footer).getAllByRole('button')).toHaveLength(2);
    await expect(getComputedStyle(footer).borderBlockStartWidth).toBe('1px');
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
      await expect(getComputedStyle(card).borderTopWidth).toBe('1px');
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
        <form id={formId} css={formStyle} onSubmit={(event) => event.preventDefault()}>
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
  globals: { theme: 'light' },
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
