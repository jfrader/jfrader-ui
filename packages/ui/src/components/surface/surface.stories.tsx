import { createElement, StrictMode, useCallback, useId, useRef, useState, type Ref } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, spyOn, waitFor, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { ClassNames, css } from '../../styling/css';
import { WithSx } from '../../styling/sx';
import { useThemeScope } from '../../styling/theme-scope';
import { withLightTheme } from '../../testing/story-decorators';
import { OverlayPortal } from '../../overlay/overlay-portal';
import { Button } from '../button';
import { Card } from '../card';
import { TextField } from '../text-field';
import { ThemeRoot } from '../theme-root';
import { Surface, type SurfacePartProps, type SurfaceProps } from './index';
// `styled` is the app-facing styling API; consumers import it from `@jfrader/ui`.
import { styled } from '../../index';

declare const process: { env: { NODE_ENV?: string } };

const Frame = styled.div({ display: 'grid', gap: vars.space[4], inlineSize: '32rem', maxInlineSize: `calc(100vw - ${vars.space[4]} * 2)` });
const PaddedSurface = styled(Surface)({ padding: vars.space[4] });
// These values exercise sx, registered classes and slot styling.
const padding = css({ padding: vars.space[4] });
const independentMaterial = css({
  backgroundColor: vars.color.bg, color: vars.color.textMuted, fontFamily: vars.font.sans,
  border: `1px dashed ${vars.color.border}`, borderRadius: vars.radius.sm, boxShadow: 'none',
});
const slotStyle = css({ borderRadius: vars.radius.sm, fontStyle: 'italic' });
const consumerStyle = css({ borderRadius: vars.radius.md, fontStyle: 'normal' });
const finalStyle = css({ borderRadius: vars.radius.full, fontStyle: 'italic' });
const MutedText = styled.span({ color: vars.color.textMuted });

function Paper({ className, ...props }: SurfacePartProps) {
  const id = useId();
  return <WithSx styles={independentMaterial} className={className}>
    {(classes) => <div {...props} className={classes} data-adapter-id={id} />}
  </WithSx>;
}

function ScopeProbe({ id }: { id: string }) {
  const scope = useThemeScope();
  return <span data-testid={id} data-scope-theme={scope?.theme} data-scope-appearance={scope?.appearance} />;
}

const meta = {
  title: 'Surfaces/Surface',
  component: Surface,
  args: { children: 'Panel contents' },
  argTypes: {
    appearance: { control: 'radio', options: ['default', 'contrast'] },
    variant: { control: 'radio', options: ['flat', 'raised', 'floating'] },
    component: { control: false }, slots: { control: false }, slotProps: { control: false },
  },
  decorators: [(Story) => <Frame><Story /></Frame>],
  parameters: {
    docs: {
      description: { component: 'Give a panel a background, border, rounded corners, and optional shadow.' },
      usage: `### Material and spacing
Surface has no padding or interactive behavior. Add spacing with sx, or use Card for headings, content and actions. Flat is the default; raised and floating change only the shadow. Surface adds no role, keyboard commands, focus movement, transitions, or landmarks.

### Appearance
Omitted appearance and default inherit the nearest appearance. Contrast uses fixed dark charcoal on either page theme. Use ThemeRoot to change the named theme; default does not reset a contrast parent. Descendant portals retain the resolved scope and portal container.

### Root replacement
component is exactly sugar for slots.root. Only root is replaceable. slots.root wins when both are supplied. Declare component types outside render: changing their identity remounts the root, losing focus and uncontrolled form state. Development warnings detect identity changes, not inline functions on their first render.

A replacement must render one div and forward ref, className, style, children, native handlers, data attributes and ARIA. It supplies material instead of the default material. Apply its styles before the supplied className. Do not use an intrinsic string, element, Fragment, portal, display: contents, or imperative ref handle. Runtime diagnostics check the registered div, not complete adapter conformance.

| Slot | Replacement | Props |
| --- | --- | --- |
| root | component or slots.root: ComponentType<SurfacePartProps> | slotProps.root: div props and css; no sx |

Extra div props flow into root. slotProps.root wins collisions, including children and event handlers; displaced handlers are not also called. className combines and style shallow-merges, slot values last. Styling order is adapter material → host structure → slot css/classes → consumer classes → sx. Inline style retains normal CSS precedence.

Composed roots keep both data-ui tokens. Select them with [data-ui~="surface"], not an exact-value selector. Surface uses data-surface-variant and preserves a host's data-variant.`,
    },
  },
} satisfies Meta<typeof Surface>;
export default meta;
type Story = StoryObj<typeof meta>;

type CheckedSurface<Props extends SurfaceProps> = Props;
export type SurfaceTypeRegression = {
  // @ts-expect-error Surface has no overlay variant.
  variant: CheckedSurface<{ variant: 'overlay' }>;
  // @ts-expect-error There is no theme-reset appearance.
  appearance: CheckedSurface<{ appearance: 'light' }>;
  // @ts-expect-error Intrinsic tag polymorphism is not supported.
  intrinsic: CheckedSurface<{ component: 'section' }>;
  // @ts-expect-error Elements are not component types.
  element: CheckedSurface<{ component: ReturnType<typeof Surface> }>;
  // @ts-expect-error Surface adopts only root.
  interior: CheckedSurface<{ slots: { header: typeof Paper } }>;
  // @ts-expect-error The root ref is a div, not a button.
  ref: CheckedSurface<{ ref: Ref<HTMLButtonElement> }>;
};

export const Default: Story = {
  render: (args) => <Surface {...args} />,
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('[data-ui="surface"]')!;
    await expect(root).toHaveAttribute('data-surface-variant', 'flat');
    await expect(root).not.toHaveAttribute('role');
    await expect(root).not.toHaveAttribute('tabindex');
    await expect(getComputedStyle(root).padding).toBe('0px');
    await expect(getComputedStyle(root).boxShadow).toBe('none');
    await expect(getComputedStyle(root).borderTopStyle).toBe('solid');
  },
};

export const Variants: Story = {
  render: (args) => <>{(['flat', 'raised', 'floating'] as const).map((variant) =>
    <PaddedSurface {...args} key={variant} variant={variant}>{variant}</PaddedSurface>)}</>,
  play: async ({ canvasElement }) => {
    const roots = canvasElement.querySelectorAll('[data-ui="surface"]');
    await expect(roots).toHaveLength(3);
    await expect(getComputedStyle(roots[0]!).boxShadow).toBe('none');
    await expect(getComputedStyle(roots[1]!).boxShadow).not.toBe('none');
    await expect(getComputedStyle(roots[2]!).boxShadow).not.toBe(getComputedStyle(roots[1]!).boxShadow);
  },
};

export const Light: Story = { ...Variants, decorators: [withLightTheme], globals: { theme: 'light' } };

export const Contrast: Story = {
  args: { appearance: 'contrast', variant: 'raised', sx: padding },
  decorators: [withLightTheme], globals: { theme: 'light' },
  render: (args) => <Surface {...args} />,
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('[data-ui="surface"]')!;
    await expect(root).toHaveAttribute('data-theme', 'dark');
    await expect(root).toHaveAttribute('data-appearance', 'contrast');
    await expect(getComputedStyle(root).colorScheme).toBe('dark');
  },
};

export const DefaultInsideContrast: Story = {
  render: (args) => <ThemeRoot theme="light"><PaddedSurface appearance="contrast">
    <Surface {...args} appearance="default"><ScopeProbe id="inherited" />Inherited appearance</Surface>
  </PaddedSurface></ThemeRoot>,
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByTestId('inherited')).toHaveAttribute('data-scope-appearance', 'contrast');
    const roots = canvasElement.querySelectorAll('[data-ui="surface"]');
    await expect(getComputedStyle(roots[0]!).backgroundColor).toBe(getComputedStyle(roots[1]!).backgroundColor);
  },
};

export const ScopeMatrix: Story = {
  render: (args) => <>{(['dark', 'light'] as const).flatMap((theme) =>
    ([undefined, 'default', 'contrast'] as const).map((appearance) => {
      const id = `${theme}-${appearance ?? 'omitted'}`;
      return <ThemeRoot key={id} theme={theme}><Surface {...args} appearance={appearance} data-testid={id}>
        {id}<ScopeProbe id={`${id}-scope`} />
        <OverlayPortal><Surface data-testid={`${id}-portal`}>{id} portal</Surface></OverlayPortal>
      </Surface></ThemeRoot>;
    }))}</>,
  play: async ({ canvas, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    for (const theme of ['dark', 'light']) for (const appearance of ['omitted', 'default', 'contrast']) {
      const id = `${theme}-${appearance}`;
      const expectedTheme = appearance === 'contrast' ? 'dark' : theme;
      const expectedAppearance = appearance === 'contrast' ? 'contrast' : 'default';
      const portal = await body.findByTestId(`${id}-portal`);
      await expect(canvas.getByTestId(`${id}-scope`)).toHaveAttribute('data-scope-theme', expectedTheme);
      await expect(canvas.getByTestId(`${id}-scope`)).toHaveAttribute('data-scope-appearance', expectedAppearance);
      await expect(portal.closest('[data-ui="theme-boundary"]')).toHaveAttribute('data-theme', expectedTheme);
      await expect(portal.closest('[data-ui="theme-boundary"]')).toHaveAttribute('data-appearance', expectedAppearance);
      await expect(getComputedStyle(portal).backgroundColor).toBe(getComputedStyle(canvas.getByTestId(id)).backgroundColor);
    }
  },
};

const customTokens = { radius: { lg: '3rem' } };
export const ScopedTokens: Story = {
  render: (args) => <>{(['dark', 'light'] as const).map((theme) =>
    <ThemeRoot key={theme} theme={theme} tokens={customTokens}>
      <Surface {...args} appearance="contrast" data-testid={`tokens-${theme}`}>
        {theme} origin<OverlayPortal><Surface data-testid={`tokens-${theme}-portal`}>Scoped portal</Surface></OverlayPortal>
      </Surface>
    </ThemeRoot>)}</>,
  play: async ({ canvas, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    for (const theme of ['dark', 'light']) {
      const root = canvas.getByTestId(`tokens-${theme}`);
      const portal = await body.findByTestId(`tokens-${theme}-portal`);
      await expect(root.style.getPropertyValue('--ui-radius-lg')).toBe(theme === 'dark' ? '3rem' : '');
      await expect(getComputedStyle(portal).borderRadius).toBe(getComputedStyle(root).borderRadius);
    }
    await expect(getComputedStyle(canvas.getByTestId('tokens-dark')).borderRadius).not.toBe(getComputedStyle(canvas.getByTestId('tokens-light')).borderRadius);
  },
};

// This story tests the documented css/slot API and native style merging.
export const StylingPrecedence: Story = {
  parameters: { docs: { source: { code: "<Surface slotProps={{ root: { sx: slotStyle } }} sx={finalStyle}>Panel contents</Surface>" } } },
  render: (args) => <>{[undefined, Paper, Card].map((component, index) => <div key={index}>
    <Surface {...args} component={component} data-testid={`slot-${index}`} slotProps={{ root: { sx: slotStyle } }} />
    <Surface {...args} component={component} data-testid={`consumer-${index}`} slotProps={{ root: { sx: slotStyle } }} sx={consumerStyle} />
    {createElement(Surface, { ...args, component, 'data-testid': `explicit-${index}`, slotProps: { root: { sx: slotStyle } }, sx: consumerStyle })}
    <Surface {...args} component={component} data-testid={`sx-${index}`} slotProps={{ root: { sx: slotStyle } }} sx={[consumerStyle, finalStyle]} />
  </div>)}</>,
  play: async ({ canvas, canvasElement }) => {
    for (const index of [0, 1, 2]) {
      await expect(canvasElement.querySelector('[sx]')).toBeNull();
      await expect(getComputedStyle(canvas.getByTestId(`slot-${index}`)).fontStyle).toBe('italic');
      await expect(getComputedStyle(canvas.getByTestId(`consumer-${index}`)).fontStyle).toBe('normal');
      await expect(getComputedStyle(canvas.getByTestId(`explicit-${index}`)).fontStyle).toBe('normal');
      await expect(getComputedStyle(canvas.getByTestId(`sx-${index}`)).fontStyle).toBe('italic');
      await expect(getComputedStyle(canvas.getByTestId(`explicit-${index}`)).borderRadius).toBe(getComputedStyle(canvas.getByTestId(`consumer-${index}`)).borderRadius);
      await expect(getComputedStyle(canvas.getByTestId(`slot-${index}`)).borderRadius).not.toBe(getComputedStyle(canvas.getByTestId(`consumer-${index}`)).borderRadius);
      await expect(getComputedStyle(canvas.getByTestId(`sx-${index}`)).borderRadius).not.toBe(getComputedStyle(canvas.getByTestId(`consumer-${index}`)).borderRadius);
    }
  },
};

// This story tests the documented css/slot API and native style merging.
export const RegisteredClassPrecedence: Story = {
  render: (args) => <ClassNames>{({ css: register }) => <>{[undefined, Paper].map((component, index) => <div key={index}>
    <Surface {...args} component={component} data-testid={`class-slot-${index}`}
      slotProps={{ root: { sx: consumerStyle, className: register(slotStyle) } }} />
    {createElement(Surface, { ...args, component, 'data-testid': `class-consumer-${index}`,
      slotProps: { root: { sx: consumerStyle, className: register(slotStyle) } }, sx: consumerStyle })}
    <Surface {...args} component={component} data-testid={`class-sx-${index}`}
      slotProps={{ root: { className: register(slotStyle) } }} className={register(consumerStyle)} sx={finalStyle} />
  </div>)}</>}</ClassNames>,
  play: async ({ canvas }) => {
    for (const index of [0, 1]) {
      await expect(getComputedStyle(canvas.getByTestId(`class-slot-${index}`)).fontStyle).toBe('italic');
      await expect(getComputedStyle(canvas.getByTestId(`class-consumer-${index}`)).fontStyle).toBe('normal');
      await expect(getComputedStyle(canvas.getByTestId(`class-sx-${index}`)).fontStyle).toBe('italic');
    }
  },
};

// This story tests the documented css/slot API and native style merging.
export const RootPropMerge: Story = {
  args: { onClick: fn(), ref: fn(), slotProps: { root: { onClick: fn(), ref: fn() } } },
  render: (args) => <>{[undefined, Paper].map((component, index) =>
    <Surface {...args} key={index} component={component} id={`host-${index}`} dir="ltr" data-origin="host"
      className="host-class" style={{ paddingBlock: vars.space[4], fontWeight: 400 }}
      slotProps={{ root: { ...args.slotProps?.root, id: `slot-${index}`, dir: 'rtl', 'data-origin': 'slot',
        className: 'slot-class', style: { paddingInline: vars.space[5], fontWeight: 600 }, children: <Button>Selected {index}</Button> } }}>
      Displaced children
    </Surface>)}</>,
  play: async ({ canvas, args, userEvent }) => {
    for (const index of [0, 1]) {
      const child = canvas.getByRole('button', { name: `Selected ${index}` });
      const root = child.parentElement!;
      await expect(root).toHaveAttribute('id', `slot-${index}`);
      await expect(root).toHaveAttribute('dir', 'rtl');
      await expect(root).toHaveAttribute('data-origin', 'slot');
      await expect(root).toHaveClass('host-class', 'slot-class');
      await expect(root.style.paddingBlock).toBe(vars.space[4]);
      await expect(root.style.paddingInline).toBe(vars.space[5]);
      await expect(root.style.fontWeight).toBe('600');
      await expect(args.slotProps!.root!.ref).toHaveBeenCalledWith(root);
      await userEvent.click(child);
    }
    await expect(canvas.queryByText('Displaced children')).toBeNull();
    await expect(args.onClick).not.toHaveBeenCalled();
    await expect(args.ref).not.toHaveBeenCalled();
    await expect(args.slotProps!.root!.onClick).toHaveBeenCalledTimes(2);
  },
};

export const ComponentSlotsEquivalence: Story = {
  args: { onClick: fn(), ref: fn() },
  render: (args) => <>
    <PaddedSurface {...args} component={Paper} data-testid="component" appearance="contrast"><Button>Action</Button></PaddedSurface>
    <PaddedSurface {...args} slots={{ root: Paper }} data-testid="slots" appearance="contrast"><Button>Action</Button></PaddedSurface>
  </>,
  play: async ({ canvas, args, userEvent }) => {
    const a = canvas.getByTestId('component');
    const b = canvas.getByTestId('slots');
    await expect(a.tagName).toBe('DIV');
    await expect(a.childElementCount).toBe(1);
    for (const attribute of ['class', 'data-ui', 'data-theme', 'data-appearance', 'data-surface-variant']) {
      await expect(a.getAttribute(attribute)).toBe(b.getAttribute(attribute));
    }
    for (const property of ['backgroundColor', 'borderRadius', 'boxShadow', 'padding'] as const) {
      await expect(getComputedStyle(a)[property]).toBe(getComputedStyle(b)[property]);
    }
    await expect(args.ref).toHaveBeenCalledWith(a);
    await expect(args.ref).toHaveBeenCalledWith(b);
    for (const button of canvas.getAllByRole('button', { name: 'Action' })) await userEvent.click(button);
    await expect(args.onClick).toHaveBeenCalledTimes(2);
  },
};

function StableFixture(props: SurfaceProps) {
  const [changed, setChanged] = useState(false);
  return <ThemeRoot theme={changed ? 'light' : 'dark'}>
    <Surface {...props} appearance={changed ? 'contrast' : 'default'}
      sx={changed ? [consumerStyle, padding] : undefined} slotProps={changed ? { root: { sx: slotStyle } } : undefined}>
      <TextField label="Draft" defaultValue="Keep me" />
    </Surface>
    <Button onMouseDown={(event) => event.preventDefault()} onClick={() => setChanged(!changed)}>Update styles</Button>
  </ThemeRoot>;
}
export const StableIdentity: Story = {
  args: { component: Paper },
  render: (args) => <StableFixture {...args} />,
  play: async ({ canvas, userEvent }) => {
    const input = canvas.getByRole('textbox', { name: 'Draft' });
    await userEvent.click(input);
    await userEvent.type(input, ' edited');
    for (const _ of [0, 1]) {
      await userEvent.click(canvas.getByRole('button', { name: 'Update styles' }));
      await expect(canvas.getByRole('textbox', { name: 'Draft' })).toBe(input);
      await expect(input).toHaveValue('Keep me edited');
      await expect(input).toHaveFocus();
    }
  },
};

export const StableDefaultIdentity: Story = { ...StableIdentity, args: { component: undefined } };
export const StableCardIdentity: Story = { ...StableIdentity, args: { component: Card } };

function RefFixture(props: SurfaceProps) {
  const [visible, setVisible] = useState(true);
  const counts = useRef({ attaches: 0, cleanups: 0 });
  const [result, setResult] = useState('');
  const ref = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    counts.current.attaches++;
    return () => { counts.current.cleanups++; };
  }, []);
  return <>
    <StrictMode>{visible && <Surface {...props} component={Paper} ref={ref}>Strict refs</Surface>}</StrictMode>
    <Button onClick={() => setVisible(false)}>Unmount root</Button>
    <Button onClick={() => setVisible(true)}>Mount root</Button>
    <Button onClick={() => setResult(JSON.stringify(counts.current))}>Read refs</Button>
    <output data-testid="ref-result">{result}</output>
  </>;
}
export const StrictModeRefs: Story = {
  render: (args) => <RefFixture {...args} />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Unmount root' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Mount root' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Unmount root' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Read refs' }));
    const result = JSON.parse(canvas.getByTestId('ref-result').textContent!);
    await expect(result.attaches).toBeGreaterThan(1);
    await expect(result.cleanups).toBe(result.attaches);
  },
};

export const IndependentMaterialAdapter: Story = {
  args: { component: Paper, variant: 'floating', appearance: 'contrast' },
  render: (args) => <Surface {...args}><MutedText>Panel contents</MutedText></Surface>,
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('[data-ui~="surface"]')!;
    await expect(root).toHaveAttribute('data-adapter-id');
    await expect(getComputedStyle(root).borderTopStyle).toBe('dashed');
    await expect(getComputedStyle(root).boxShadow).toBe('none');
    await expect(getComputedStyle(root).color).toBe(getComputedStyle(root.firstElementChild!).color);
    for (const prop of ['component', 'slots', 'slotProps', 'sx', 'css', 'appearance', 'variant']) {
      await expect(root).not.toHaveAttribute(prop);
    }
    await expect(canvasElement.querySelectorAll('[data-ui~="surface"]')).toHaveLength(1);
  },
};

/** Card adds its usual spacing; the composed root keeps both markers. */
export const CardAdapter: Story = {
  args: { component: Card, variant: 'floating' },
  render: (args) => <Surface {...args}><Card.Title>Account</Card.Title><Card.Content>Three projects</Card.Content></Surface>,
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('[data-ui~="surface"]')!;
    await expect(root.getAttribute('data-ui')?.split(' ').sort()).toEqual(['card', 'surface']);
    await expect(root).toHaveAttribute('data-variant', 'raised');
    await expect(root).toHaveAttribute('data-surface-variant', 'floating');
    await expect(parseFloat(getComputedStyle(root).paddingInlineStart)).toBeGreaterThan(0);
    await expect(root.querySelector('[data-ui~="surface"]')).toBeNull();
  },
};

export const SurfaceAdapter: Story = {
  args: { component: Surface, appearance: 'contrast', sx: padding },
  render: (args) => <Surface {...args} />,
  play: async ({ canvasElement }) => {
    const roots = canvasElement.querySelectorAll('[data-ui~="surface"]');
    await expect(roots).toHaveLength(1);
    await expect(roots[0]).toHaveAttribute('data-ui', 'surface');
    await expect(roots[0]).toHaveAttribute('data-theme', 'dark');
  },
};

function PortalRoutingFixture(props: SurfaceProps) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);
  return <>
    <ThemeRoot theme="light" portalContainer={container}>
      <Surface {...props} appearance="contrast" component={Paper}>
        <Button onClick={() => setReady(true)}>Create portal target</Button>
        <OverlayPortal><Surface data-testid="routed-portal"><ScopeProbe id="routed-scope" />Portal content</Surface></OverlayPortal>
      </Surface>
    </ThemeRoot>
    {ready && <div ref={setContainer} data-testid="portal-target" />}
  </>;
}
export const PortalRouting: Story = {
  render: (args) => <PortalRoutingFixture {...args} />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    await expect(within(canvasElement.ownerDocument.body).queryByTestId('routed-portal')).toBeNull();
    await userEvent.click(canvas.getByRole('button', { name: 'Create portal target' }));
    const portal = await within(canvas.getByTestId('portal-target')).findByTestId('routed-portal');
    await expect(portal.closest('[data-ui="theme-boundary"]')).toHaveAttribute('data-appearance', 'contrast');
    await expect(canvas.getByTestId('routed-scope')).toHaveAttribute('data-scope-theme', 'dark');
  },
};

function DiagnosticFixture(props: SurfaceProps) {
  const [changed, setChanged] = useState(false);
  const Inline = (rootProps: SurfacePartProps) => <div {...rootProps} />;
  return <>
    <Surface {...props} component={changed ? Inline : Paper} slots={changed ? { root: Card } : undefined} />
    <Button onClick={() => setChanged(true)}>Change root</Button>
  </>;
}
export const IdentityDiagnostic: Story = {
  render: (args) => <DiagnosticFixture {...args} />,
  play: async ({ canvas, userEvent }) => {
    const warning = spyOn(console, 'warn').mockImplementation(() => {});
    try {
      await userEvent.click(canvas.getByRole('button', { name: 'Change root' }));
      if (process.env.NODE_ENV !== 'production') {
        await expect(warning).toHaveBeenCalledWith(expect.stringContaining('root component identity changed'));
        await expect(warning).toHaveBeenCalledWith(expect.stringContaining('slots.root wins'));
      }
      await expect(canvas.getByText('Panel contents')).toHaveAttribute('data-ui', 'card surface');
    } finally { warning.mockRestore(); }
  },
};

function MissingRefPaper({ ref: _ref, ...props }: SurfacePartProps) { return <div {...props} />; }
function NullPaper() { return null; }
function InvalidFixture(props: SurfaceProps) {
  const [invalid, setInvalid] = useState(false);
  const invalidProps = { appearance: 'invalid', variant: 'invalid' } as unknown as SurfaceProps;
  return <>
    {invalid && <>
      <Surface {...props} {...invalidProps} data-testid="invalid-enums" />
      <Surface {...props} component={MissingRefPaper} />
      <Surface {...props} component={NullPaper} />
    </>}
    <Button onClick={() => setInvalid(true)}>Mount invalid roots</Button>
  </>;
}
export const InvalidRootDiagnostics: Story = {
  render: (args) => <InvalidFixture {...args} />,
  play: async ({ canvas, userEvent }) => {
    const warning = spyOn(console, 'warn').mockImplementation(() => {});
    try {
      await userEvent.click(canvas.getByRole('button', { name: 'Mount invalid roots' }));
      if (process.env.NODE_ENV !== 'production') {
        await expect(warning).toHaveBeenCalledWith(expect.stringContaining('invalid appearance'));
        await expect(warning).toHaveBeenCalledWith(expect.stringContaining('invalid variant'));
        await expect(warning).toHaveBeenCalledWith(expect.stringContaining('Missing or non-div root registration'));
      }
      await expect(canvas.getByTestId('invalid-enums')).toHaveAttribute('data-surface-variant', 'flat');
      await expect(canvas.getByTestId('invalid-enums')).not.toHaveAttribute('appearance');
      await expect(canvas.getByTestId('invalid-enums')).not.toHaveAttribute('variant');
    } finally { warning.mockRestore(); }
  },
};

function HydrationPanel(props: SurfaceProps) {
  const id = useId();
  return <ThemeRoot theme="light"><Surface {...props} appearance="contrast" component={Paper} aria-labelledby={id}>
    <span id={id}>Server panel</span><TextField label="Server draft" defaultValue="Preserved" />
  </Surface></ThemeRoot>;
}
export const SsrHydration: Story = {
  render: (args) => <HydrationPanel {...args} />,
  play: async ({ canvasElement, args }) => {
    const container = canvasElement.ownerDocument.createElement('div');
    canvasElement.append(container);
    const prefix = 'surface-hydration-';
    const attached = fn();
    const element = <HydrationPanel {...args} ref={attached} />;
    container.innerHTML = renderToString(element, { identifierPrefix: prefix });
    const before = container.querySelector('[data-ui~="surface"]')!;
    const label = before.getAttribute('aria-labelledby');
    const error = fn();
    const root = hydrateRoot(container, element, { identifierPrefix: prefix, onRecoverableError: error });
    try {
      await waitFor(() => expect(attached).toHaveBeenCalled());
      await expect(container.querySelector('input')?.value).toBe('Preserved');
      await expect(container.querySelector('[data-ui~="surface"]')).toBe(before);
      await expect(before).toHaveAttribute('aria-labelledby', label!);
      await expect(before).toHaveAttribute('data-theme', 'dark');
      await expect(before).toHaveAttribute('data-appearance', 'contrast');
      await expect(error).not.toHaveBeenCalled();
    } finally { root.unmount(); container.remove(); }
  },
};

/** Enable forced colors in the browser; all variants retain a visible border. */
export const ForcedColors: Story = {
  ...Variants,
  play: async ({ canvasElement }) => {
    for (const root of canvasElement.querySelectorAll('[data-ui="surface"]')) {
      await expect(getComputedStyle(root).borderTopStyle).toBe('solid');
      await expect(parseFloat(getComputedStyle(root).borderTopWidth)).toBeGreaterThan(0);
    }
  },
};
