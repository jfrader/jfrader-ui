import type { ReactNode } from 'react';
import { useId } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { MotionConfig } from 'motion/react';
import { vars } from '@jfrader/tokens/vars';
import { ClassNames, css } from '../../styling/css';
// `styled` is the app-facing styling API; consumers import it from `@jfrader/ui`.
import { styled } from '../../index';
import { WithSx } from '../../styling/sx';
import { useThemeScope } from '../../styling/theme-scope';
import { OverlayPortal } from '../../overlay/overlay-portal';
import { withLightTheme } from '../../testing/story-decorators';
import { expectContrastSurface, expectThemedSurface } from '../../testing/theme-assertions';
import { Button } from '../button';
import { Popover } from '../popover';
import { TextField } from '../text-field';
import { ThemeRoot } from '../theme-root';
import { Surface, type SurfacePartProps } from '../surface';
import { Card, type CardCompoundProps, type CardEasyProps, type CardTitleProps, type CardVariant } from './index';

const VARIANTS = ['flat', 'raised'] as const satisfies readonly CardVariant[];
// The slot API takes `css` values, so this story keeps the documented spelling.
const easyTitleStyle = css({ fontSize: vars.textSize.lg });

const Frame = styled.div({
  display: 'grid',
  gap: vars.space[4],
  inlineSize: '360px',
});

const PlanList = styled.ul({
  margin: 0,
  paddingInlineStart: vars.space[5],
});

const InviteForm = styled.form({
  display: 'grid',
  gap: vars.space[3],
});

const FixtureButton = styled.button({
  minHeight: vars.space[6],
  minWidth: vars.space[6],
  padding: `${vars.space[1]} 10px`,
  boxSizing: 'border-box',
});

const meta = {
  title: 'Data display/Card',
  component: Card,
  parameters: { docs: {
    description: { component: 'Group content with a heading, description, and actions.' },
    sections: [
      { title: 'Basic', stories: ['EasyMode', 'Variants', 'Glass', 'Holo'] },
      { title: 'Composition', stories: ['Basic', 'SingleAction'] },
      { title: 'Content', stories: ['WithForm'] },
      { title: 'Behaviour', stories: ['HoloTilt'] },
      { title: 'Accessibility', stories: ['HeadingLevel'] },
    ],
    usage: `### When to use
Group related information and actions in a page or grid. A card is not an interactive control; put actions in buttons or links inside it.

### Materials
Keep a similar-tone backdrop behind translucent cards so text stays readable. Reduced transparency uses an opaque fill. Mouse and pen tilt does not change keyboard behaviour and is disabled by reduced motion.

### Accessibility
Choose a heading level that fits the surrounding page. Cards add no landmark by default; give a card a named region only when it needs to be a navigation landmark. Tab moves between the controls inside, not the card itself.`,
  } },
  args: { variant: 'raised' },
  argTypes: {
    variant: { control: 'radio', options: VARIANTS },
  },
  decorators: [
    (Story) => (
      <Frame>
        <Story />
      </Frame>
    ),
  ],
} satisfies Meta<CardCompoundProps>;

export default meta;

type Story = StoryObj<(props: CardCompoundProps) => ReactNode>;

export const EasyMode: StoryObj<(props: CardEasyProps) => ReactNode> = {
  name: 'Project summary',
  parameters: { docs: {
    description: { story: 'Group a project summary with an action to open it.' },
    source: { language: 'tsx', code: `import { Button, Card } from '@jfrader/ui';

<Card
  title="Project"
  description="Quarterly roadmap"
  content="Three milestones remaining."
  footer={<Button>Open project</Button>}
/>` },
  } },
  args: {
    title: 'Project',
    description: 'Quarterly roadmap',
    content: 'Three milestones remaining.',
    footer: <Button>Open project</Button>,
  },
  render: (args) => <Card {...args} />,
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { name: 'Project' })).toBeVisible();
    await expect(canvas.getByText('Quarterly roadmap')).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Open project' })).toBeVisible();
  },
};

export const EasyCustomization: Story = {
  render: () => <Card title="Project" content={0} footer={0} slotProps={{ title: { css: easyTitleStyle }, content: { className: 'project-body' } }} />,
  parameters: { docs: { source: { code: '<Card title="Project" content={0} footer={0} slotProps={{ title: { css: css({ fontSize: vars.textSize.lg }) }, content: { className: "project-body" } }} />' } } },
  play: async ({ canvasElement }) => {
    const content = canvasElement.querySelector('[data-ui="card-content"]');
    await expect(content).toHaveClass('project-body');
    await expect(content).toHaveTextContent('0');
    await expect(canvasElement.querySelector('[data-ui="card-footer"]')).toHaveTextContent('0');
  },
};

function AppearanceProbe() {
  const scope = useThemeScope();
  return <span data-testid="appearance-probe">{scope?.appearance}</span>;
}

export const CardDefaultUnderContrast: Story = {
  render: (args) => (
    <Card appearance="contrast">
      <Card {...args} appearance="default"><AppearanceProbe />
        <OverlayPortal><div data-testid="card-contrast-portal">Portal content</div></OverlayPortal>
      </Card>
    </Card>
  ),
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByTestId('appearance-probe')).toHaveTextContent('contrast');
    const portal = await within(canvasElement.ownerDocument.body).findByTestId('card-contrast-portal');
    await expect(portal.closest('[data-ui="theme-boundary"]')).toHaveAttribute('data-appearance', 'contrast');
  },
};

function PlanCard(props: CardCompoundProps) {
  return (
    <Card {...props}>
      <Card.Header>
        <Card.Title>Pro plan</Card.Title>
        <Card.Description>Billed monthly, renews on 1 November.</Card.Description>
      </Card.Header>
      <Card.Content>
        <PlanList>
          <li>Unlimited projects</li>
          <li>10 GB storage</li>
          <li>Priority support</li>
        </PlanList>
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
  name: 'Compound anatomy',
  parameters: { docs: {
    description: { story: 'Compose a plan with its benefits and separate cancel and upgrade actions.' },
    source: { language: 'tsx', code: `import { Button, Card, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const PlanList = styled.ul({ margin: 0, paddingInlineStart: vars.space[5] });

<Card>
  <Card.Header>
    <Card.Title>Pro plan</Card.Title>
    <Card.Description>Billed monthly, renews on 1 November.</Card.Description>
  </Card.Header>
  <Card.Content>
    <PlanList>
      <li>Unlimited projects</li>
      <li>10 GB storage</li>
      <li>Priority support</li>
    </PlanList>
  </Card.Content>
  <Card.Footer>
    <Button variant="outline">Cancel plan</Button>
    <Button tone="accent">Upgrade</Button>
  </Card.Footer>
</Card>` } } },
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
  name: 'Single footer action',
  parameters: { docs: {
    description: { story: 'Place a lone save action at the end of the footer.' },
    source: { language: 'tsx', code: `import { Button, Card } from '@jfrader/ui';

<Card>
  <Card.Header><Card.Title>Account</Card.Title></Card.Header>
  <Card.Footer><Button tone="accent">Save</Button></Card.Footer>
</Card>` },
  } },
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
  name: 'Heading level',
  parameters: { docs: {
    description: { story: 'Use a level-two heading for a card directly beneath the page heading.' },
    source: { language: 'tsx', code: `import { Card } from '@jfrader/ui';

<Card>
  <Card.Header><Card.Title level={2}>Usage</Card.Title></Card.Header>
  <Card.Content>4 of 10 projects used.</Card.Content>
</Card>` },
  } },
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
  name: 'Flat and raised',
  parameters: { docs: {
    description: { story: 'Compare the same plan on flat and raised surfaces.' },
    source: { language: 'tsx', code: `import { Button, Card, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const PlanList = styled.ul({ margin: 0, paddingInlineStart: vars.space[5] });

<>
  {(['flat', 'raised'] as const).map((variant) => (
    <Card key={variant} variant={variant}>
      <Card.Header>
        <Card.Title>Pro plan</Card.Title>
        <Card.Description>Billed monthly, renews on 1 November.</Card.Description>
      </Card.Header>
      <Card.Content>
        <PlanList>
          <li>Unlimited projects</li>
          <li>10 GB storage</li>
          <li>Priority support</li>
        </PlanList>
      </Card.Content>
      <Card.Footer>
        <Button variant="outline">Cancel plan</Button>
        <Button tone="accent">Upgrade</Button>
      </Card.Footer>
    </Card>
  ))}
</>` },
  } },
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

function InviteCard(props: CardCompoundProps) {
  const titleId = useId();
  const formId = useId();
  return (
    <Card {...props} role="region" aria-labelledby={titleId}>
      <Card.Header>
        <Card.Title id={titleId}>Invite a teammate</Card.Title>
        <Card.Description>They get editor access to this workspace.</Card.Description>
      </Card.Header>
      <Card.Content>
        <InviteForm id={formId} onSubmit={(event) => event.preventDefault()}>
          <TextField label="Email" type="email" name="email" placeholder="ana@example.com" />
        </InviteForm>
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
  name: 'Invite form',
  parameters: { docs: {
    description: { story: 'Submit or clear an invite form from actions in a named card region.' },
    source: { language: 'tsx', code: `import { useId } from 'react';
import { Button, Card, TextField, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const InviteForm = styled.form({ display: 'grid', gap: vars.space[3] });

export function InviteTeammate() {
  const titleId = useId();
  const formId = useId();
  return (
    <Card role="region" aria-labelledby={titleId}>
      <Card.Header>
        <Card.Title id={titleId}>Invite a teammate</Card.Title>
        <Card.Description>They get editor access to this workspace.</Card.Description>
      </Card.Header>
      <Card.Content>
        <InviteForm id={formId} onSubmit={(event) => event.preventDefault()}>
          <TextField label="Email" type="email" name="email" placeholder="ana@example.com" />
        </InviteForm>
      </Card.Content>
      <Card.Footer>
        <Button variant="outline" type="reset" form={formId}>Clear</Button>
        <Button tone="accent" type="submit" form={formId}>Send invite</Button>
      </Card.Footer>
    </Card>
  );
}` },
  } },
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

// The slot API takes `css` values, so this story keeps the documented spelling.
const slotTitleStyle = css({ fontSize: vars.textSize.lg });

function SlotCardTitle({ level = 3, ...props }: CardTitleProps) {
  const Heading = `h${level}` as const;
  return <Heading {...props} data-slot="card-title" />;
}

export const SlotProps: Story = {
  parameters: {
    docs: {
      source: {
        code: `import { Card } from '@jfrader/ui';

<Card slotProps={{ title: { className: 'plan-title' } }}>
  <Card.Title>Pro plan</Card.Title>
</Card>`,
      },
    },
  },
  render: (args) => (
    <>
      <PlanCard {...args} />
      <PlanCard {...args} slots={{ title: SlotCardTitle }} slotProps={{ title: { css: slotTitleStyle, className: 'plan-title' } }} />
    </>
  ),
  play: async ({ canvasElement }) => {
    const [plain, slotted] = within(canvasElement).getAllByRole('heading', { level: 3 });
    if (!plain || !slotted) throw new Error('Expected plain and slotted headings');
    await expect(plain).not.toHaveClass('plan-title');
    await expect(slotted).toHaveClass('plan-title');
    await expect(slotted).toHaveAttribute('data-slot', 'card-title');
    await expect(slotted.closest('[data-ui="card"]')?.querySelector('[data-ui="card-title"]:not([data-slot])')).toBeNull();
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
  sx={{ fontStyle: 'normal' }}
  slotProps={{
    root: { className: 'slot-card', css: css({ fontStyle: 'italic' }) },
    title: { className: 'slot-title', css: css({ textTransform: 'uppercase' }) },
  }}
>
  <Card.Title className="consumer-title" sx={{ textTransform: 'lowercase' }}>
    Consumer styles
  </Card.Title>
</Card>`,
      },
    },
  },
  render: (args) => (
    <ClassNames>
      {({ css: className }) => (
        <Card
          {...args}
          className={`consumer-card ${className({ fontStyle: 'oblique', letterSpacing: '0.05em' })}`}
          sx={consumerRootOverrideStyle}
          slotProps={{
            root: { className: 'slot-card', css: slotRootOverrideStyle },
            title: { className: 'slot-title', css: slotTitleOverrideStyle },
          }}
        >
          <Card.Title className="consumer-title" sx={consumerTitleOverrideStyle}>
            Consumer styles
          </Card.Title>
        </Card>
      )}
    </ClassNames>
  ),
  play: async ({ canvasElement }) => {
    const card = getCards(canvasElement)[0]!;
    const title = within(canvasElement).getByRole('heading', { name: 'Consumer styles' });
    await expect(card).toHaveClass('slot-card', 'consumer-card');
    await expect(title).toHaveClass('slot-title', 'consumer-title');
    await expect(getComputedStyle(card).fontStyle).toBe('normal');
    await expect(getComputedStyle(card).letterSpacing).not.toBe('normal');
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
                <FixtureButton type="button">
                  Assign to me
                </FixtureButton>
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
                  <FixtureButton type="button">
                    Assign to me
                  </FixtureButton>
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
          'Enable forced colors in the browser to check this example. The story does not set the preference.',
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

const paperMaterial = css({ backgroundColor: vars.color.bg, border: `1px dashed ${vars.color.border}`, boxShadow: 'none' });
function IndependentCardPaper({ className, ...props }: SurfacePartProps) {
  return <WithSx styles={paperMaterial} className={className}>{(classes) => <div {...props} className={classes} />}</WithSx>;
}

/** Root adapters retain Card spacing and its anatomy slot styles. */
export const RootAdapters: Story = {
  render: (args) => <>{[undefined, Surface, Card, IndependentCardPaper].map((component, index) =>
    <Card {...args} key={index} component={component} data-testid={`card-adapter-${index}`}
      slotProps={{ title: { css: slotTitleOverrideStyle }, root: { className: 'root-slot' } }}>
      <Card.Title>Adapter {index}</Card.Title><Card.Content>Panel contents</Card.Content>
    </Card>)}</>,
  play: async ({ canvas }) => {
    const reference = canvas.getByTestId('card-adapter-0');
    for (const index of [0, 1, 2, 3]) {
      const root = canvas.getByTestId(`card-adapter-${index}`);
      await expect(root.tagName).toBe('DIV');
      await expect(root).toHaveClass('root-slot');
      await expect(root).toHaveAttribute('data-variant', 'raised');
      await expect(getComputedStyle(root).padding).toBe(getComputedStyle(reference).padding);
      await expect(getComputedStyle(within(root).getByRole('heading')).textTransform).toBe('uppercase');
      await expect(root.querySelector('[data-ui~="card"]')).toBeNull();
    }
    await expect(canvas.getByTestId('card-adapter-1')).toHaveAttribute('data-ui', 'surface card');
    await expect(getComputedStyle(canvas.getByTestId('card-adapter-3')).borderTopStyle).toBe('dashed');
    await expect(getComputedStyle(canvas.getByTestId('card-adapter-3')).boxShadow).toBe('none');
  },
};

export const RootAdaptersLight: Story = { ...RootAdapters, decorators: [withLightTheme], globals: { theme: 'light' } };

export const Glass: Story = {
  args: { appearance: 'glass' },
  parameters: { docs: {
    description: { story: 'Show workspace notes on a translucent glass surface.' },
    source: { language: 'tsx', code: `import { Card } from '@jfrader/ui';

<Card appearance="glass" title="Studio" description="Design workspace" content="Project notes and assets." />` },
  } },
  render: ({ children: _children, ...args }) => <Card {...args} title="Studio" description="Design workspace" content="Project notes and assets." />,
  play: async ({ canvasElement }) => {
    const card = getCards(canvasElement)[0]!;
    await expect(card).toHaveAttribute('data-card-appearance', 'glass');
    await expect(card).not.toHaveAttribute('tabindex');
    await expect(card).not.toHaveAttribute('role');
    await expect(getComputedStyle(card).backdropFilter).not.toBe('none');
    await expect(getComputedStyle(card).backgroundImage).toContain('linear-gradient');
    await expect(card).not.toHaveAttribute('data-holo-tilt');
  },
};

export const GlassLight: Story = { ...Glass, decorators: [withLightTheme], globals: { theme: 'light' } };

export const TranslucentShadows: Story = {
  tags: ['!autodocs'],
  render: () => <>{(['glass', 'holo'] as const).map((appearance) => VARIANTS.map((variant) => (
    <Card key={`${appearance}-${variant}`} appearance={appearance} variant={variant} title={`${appearance} ${variant}`} content="Project notes and assets." />
  )))}</>,
  play: async ({ canvasElement }) => {
    for (const card of getCards(canvasElement)) {
      const reference = card.ownerDocument.createElement('div');
      reference.style.boxShadow = `inset 0 1px 0 ${vars.color.surfaceHighlight}${card.dataset.variant === 'raised' ? `, ${vars.shadow.raised}` : ''}`;
      card.append(reference);
      try {
        await expect(getComputedStyle(card).boxShadow).toBe(getComputedStyle(reference).boxShadow);
      } finally {
        reference.remove();
      }
    }
  },
};

export const ReducedTransparency: Story = {
  name: 'Reduced Transparency',
  tags: ['!autodocs'],
  args: { appearance: 'glass' },
  render: ({ children: _children, ...args }) => <Card {...args} title="Studio" content="Project notes and assets." />,
  play: async ({ canvasElement }) => {
    // The Vitest setup emulates this media preference in Chromium, including CSS evaluation.
    await expect(window.matchMedia('(prefers-reduced-transparency: reduce)').matches).toBe(true);
    const card = getCards(canvasElement)[0]!;
    const style = getComputedStyle(card);
    const reference = document.createElement('div');
    reference.style.backgroundColor = vars.color.surfaceRaised;
    card.append(reference);
    try {
      await expect(style.backgroundColor).toBe(getComputedStyle(reference).backgroundColor);
      await expect(style.backgroundImage).toBe('none');
      await expect(style.backdropFilter).toBe('none');
    } finally {
      reference.remove();
    }
  },
};

export const Holo: Story = {
  args: { appearance: 'holo' },
  name: 'Holographic material',
  parameters: { docs: {
    description: { story: 'Show a membership card with a tinted gradient sheen.' },
    source: { language: 'tsx', code: `import { Card } from '@jfrader/ui';

<Card appearance="holo" title="Founding member" description="Studio membership" content="Member since 2026" />` },
  } },
  render: ({ children: _children, ...args }) => <Card {...args} title="Founding member" description="Studio membership" content="Member since 2026" />,
  play: async ({ canvasElement }) => {
    const card = getCards(canvasElement)[0]!;
    await expect(card).toHaveAttribute('data-card-appearance', 'holo');
    await expect(getComputedStyle(card).backgroundImage).toContain('radial-gradient');
    await expect(getComputedStyle(card).transform).toBe('none');
    await expect(card).not.toHaveAttribute('data-holo-tilt');
  },
};

export const HoloLight: Story = { ...Holo, name: 'Holographic material — light theme', decorators: [withLightTheme], globals: { theme: 'light' } };

export const HoloTilt: Story = {
  args: { appearance: 'holo', holoTilt: true },
  name: 'Pointer tilt',
  parameters: { docs: {
    description: { story: 'Move a mouse or pen over the membership card to tilt its surface and light.' },
    source: { language: 'tsx', code: `import { Button, Card } from '@jfrader/ui';

<Card
  appearance="holo"
  holoTilt
  title="Founding member"
  content="Member since 2026"
  footer={<Button>View membership</Button>}
/>` },
  } },
  render: ({ children: _children, ...args }) => <Card {...args} title="Founding member" content="Member since 2026" footer={<Button>View membership</Button>} />,
  play: async ({ canvasElement, canvas, userEvent: user }) => {
    const card = getCards(canvasElement)[0]!;
    await expect(card).not.toHaveAttribute('role');
    await expect(card).not.toHaveAttribute('tabindex');
    const rect = card.getBoundingClientRect();
    card.dispatchEvent(new PointerEvent('pointermove', { pointerType: 'touch', clientX: rect.right, clientY: rect.top }));
    await expect(card.style.getPropertyValue('--card-light-x')).toBe('');
    card.dispatchEvent(new PointerEvent('pointermove', { pointerType: 'mouse', clientX: rect.right, clientY: rect.top }));
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      await waitFor(() => expect(Number(card.style.getPropertyValue('--card-light-x'))).toBeGreaterThan(0.5));
      card.dispatchEvent(new PointerEvent('pointerleave'));
      await waitFor(() => expect(Math.abs(Number(card.style.getPropertyValue('--card-light-x')))).toBeLessThan(0.01));
    } else {
      await expect(card).not.toHaveAttribute('data-holo-tilt');
      await expect(getComputedStyle(card).transform).toBe('none');
      await expect(card.style.getPropertyValue('--card-light-x')).toBe('');
    }
    await user.tab();
    await expect(canvas.getByRole('button', { name: 'View membership' })).toHaveFocus();
  },
};

export const ReducedMotion: Story = {
  ...HoloTilt,
  name: 'Reduced motion',
  decorators: [(Story) => <MotionConfig reducedMotion="always"><Story /></MotionConfig>],
  play: async ({ canvasElement }) => {
    const card = getCards(canvasElement)[0]!;
    await expect(card).not.toHaveAttribute('data-holo-tilt');
    const rect = card.getBoundingClientRect();
    card.dispatchEvent(new PointerEvent('pointermove', { pointerType: 'mouse', clientX: rect.right, clientY: rect.top }));
    await expect(getComputedStyle(card).transform).toBe('none');
    await expect(card.style.getPropertyValue('--card-light-x')).toBe('');
  },
};

export const MaterialScope: Story = {
  parameters: { docs: { source: { code: '<Card appearance="contrast"><Card appearance="glass" title="Glass" content={<Surface>Inherited charcoal</Surface>} /><Card appearance="holo" title="Holo" content={<Surface>Inherited charcoal</Surface>} /></Card>' } } },
  render: () => <Card appearance="contrast"><Card appearance="glass" title="Glass" content={<Surface data-testid="glass-child">Inherited charcoal</Surface>} /><Card appearance="holo" title="Holo" content={<Surface data-testid="holo-child">Inherited charcoal</Surface>} /></Card>,
  play: async ({ canvas }) => {
    for (const id of ['glass-child', 'holo-child']) {
      const surface = canvas.getByTestId(id);
      await expectContrastSurface(surface, 'dark');
      await expect(getComputedStyle(surface).backgroundImage).toBe('none');
      await expect(getComputedStyle(surface).backdropFilter).toBe('none');
    }
  },
};

export const MaterialRootReplacement: Story = {
  tags: ['!autodocs'],
  render: () => <Card appearance="holo" component={IndependentCardPaper} title="Membership" content="Member details" />,
  play: async ({ canvasElement }) => {
    const card = getCards(canvasElement)[0]!;
    await expect(getComputedStyle(card).borderTopStyle).toBe('dashed');
    await expect(getComputedStyle(card).boxShadow).toBe('none');
    await expect(getComputedStyle(card).backgroundImage).toBe('none');
    await expect(getComputedStyle(card).backdropFilter).toBe('none');
  },
};
