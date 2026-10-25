import { StrictMode, createRef, useState, type ComponentPropsWithRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { styled } from '../../../ui/src/styling/styled';
import { withLightTheme } from '../../../ui/src/testing/story-decorators';
import { createRefCleanupTracker } from '../../../ui/src/testing/interior-slot-assertions';
import { Button } from '../../../ui/src/components/button';
import { SvgIcon, createSvgIcon, type SvgIconTone } from './index';

const drawing = <><circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.1 15.1 20 20" /></>;
const SearchIcon = createSvgIcon(drawing, 'Icons.Search');
const solidDrawing = <path d="M9 5 18 12 9 19Z" />;
const PlaySolidIcon = createSvgIcon(solidDrawing, 'Icons.PlaySolid', { variant: 'solid' });
const Row = styled.div({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: vars.space[4] });
const TextRun = styled.p({ fontFamily: vars.font.sans, fontSize: vars.textSize.lg, color: vars.color.text, margin: 0 });
const TONES = ['inherit', 'accent', 'danger', 'warning', 'success', 'info', 'muted'] as const satisfies readonly SvgIconTone[];
function RootAdapter(props: ComponentPropsWithRef<'svg'>) { return <svg {...props} data-replacement="root" />; }
function ComponentAdapter(props: ComponentPropsWithRef<'svg'>) { return <svg {...props} data-replacement="component" />; }
function TitleAdapter(props: ComponentPropsWithRef<'title'>) { return <title {...props} data-replacement="title" />; }

const meta = {
  title: 'Data display/SvgIcon',
  component: SvgIcon,
  tags: ['autodocs'],
  args: { children: drawing },
  parameters: {
    a11y: { test: 'error' },
    docs: {
      description: { component: 'Draw an icon that follows the surrounding text or a semantic color.' },
      usage: `### When to use
Use SVG children for interface icons and consumer-authored marks. Keep decorative icons inside controls with a visible or accessible name.

### Keyboard and accessibility
Icons have no keyboard interaction. Give a standalone image an accessible name. Do not use color alone to communicate a status. Reduced motion requires no override because this component has no animation.

### Your own icon in 6 lines
Create the icon at module scope, then use it with the same props as the base drawing component. See the consumer icon example below.`,
      sections: [
        { title: 'Drawing', stories: ['Line', 'Solid'] },
        { title: 'Sizing', stories: ['Sizes', 'InheritSize'] },
        { title: 'Color', stories: ['Tones', 'Light'] },
        { title: 'Accessible names', stories: ['Labels'] },
        { title: 'Consumer icons', stories: ['Factory', 'ForeignGrid'] },
        { title: 'Replacement slots', stories: ['Replacements'] },
      ],
    },
  },
} satisfies Meta<typeof SvgIcon>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Line: Story = {
  parameters: { docs: { description: { story: 'Draw rounded lines on the 24-unit grid.' }, source: { code: `import { SvgIcon } from '@jfrader/ui';
<SvgIcon><circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.1 15.1 20 20" /></SvgIcon>` } } },
  play: async ({ canvasElement }) => {
    const icon = canvasElement.querySelector('svg')!;
    await expect(icon).toHaveAttribute('viewBox', '0 0 24 24');
    await expect(icon).toHaveAttribute('fill', 'none');
    await expect(icon).toHaveAttribute('stroke', 'currentColor');
    await expect(icon).toHaveAttribute('stroke-width', '1.5');
    await expect(icon).toHaveAttribute('stroke-linecap', 'round');
    await expect(icon).toHaveAttribute('stroke-linejoin', 'round');
    await expect(icon).toHaveAttribute('aria-hidden', 'true');
    await expect(icon).toHaveAttribute('focusable', 'false');
    await expect(icon.querySelector('title')).toBeNull();
  },
};
export const Solid: Story = {
  args: { variant: 'solid', children: <path d="M8.5 4.5 18.5 12 8.5 19.5Z" />, strokeWidth: 4 },
  parameters: { docs: { description: { story: 'Fill a silhouette instead of stroking its outline.' }, source: { code: `import { SvgIcon } from '@jfrader/ui';
<SvgIcon variant="solid"><path d="M8.5 4.5 18.5 12 8.5 19.5Z" /></SvgIcon>` } } },
  play: async ({ canvasElement }) => {
    const icon = canvasElement.querySelector('svg')!;
    await expect(icon).toHaveAttribute('fill', 'currentColor');
    for (const attribute of ['stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin']) await expect(icon).not.toHaveAttribute(attribute);
  },
};
export const Sizes: Story = {
  render: (args) => <Row>{(['sm', 'md', 'lg', 20, 0, -1, NaN, Infinity] as const).map((size, index) => <SvgIcon {...args} key={index} size={size} />)}</Row>,
  parameters: { docs: { description: { story: 'Compare presets, a 20px drawing, and invalid numeric sizes that fall back to medium.' }, source: { code: `import { SvgIcon } from '@jfrader/ui';
<>{(['sm', 'md', 'lg', 20, 0, -1, NaN, Infinity] as const).map((size, index) => <SvgIcon key={index} size={size}><circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.1 15.1 20 20" /></SvgIcon>)}</>` } } },
  play: async ({ canvasElement }) => {
    const icons = canvasElement.querySelectorAll('svg');
    for (const [index, dimension] of [16, 24, 32, 20, 24, 24, 24, 24].entries()) {
      await expect(icons[index]!.getBoundingClientRect().width).toBe(dimension);
      await expect(icons[index]!.getBoundingClientRect().height).toBe(dimension);
    }
  },
};
export const InheritSize: Story = {
  render: (args) => <TextRun>Search <SvgIcon {...args} size="inherit" /> the library</TextRun>,
  parameters: { docs: { description: { story: 'Keep an inline icon at the surrounding font size.' }, source: { code: `import { SvgIcon, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';
const TextRun = styled.p({ fontFamily: vars.font.sans, fontSize: vars.textSize.lg, color: vars.color.text, margin: 0 });
<TextRun>Search <SvgIcon size="inherit"><circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.1 15.1 20 20" /></SvgIcon> the library</TextRun>` } } },
  play: async ({ canvasElement }) => {
    const icon = canvasElement.querySelector('svg')!;
    await expect(icon.getBoundingClientRect().width).toBe(parseFloat(getComputedStyle(icon.parentElement!).fontSize));
  },
};
export const Tones: Story = {
  render: (args) => <Row>{TONES.map((tone) => <SvgIcon {...args} key={tone} tone={tone} label={tone} />)}</Row>,
  parameters: { docs: { description: { story: 'Choose inherited, accent, danger, warning, success, info, or muted color.' }, source: { code: `import { SvgIcon } from '@jfrader/ui';
<>{(['inherit', 'accent', 'danger', 'warning', 'success', 'info', 'muted'] as const).map((tone) => <SvgIcon key={tone} tone={tone} label={tone}><circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.1 15.1 20 20" /></SvgIcon>)}</>` } } },
  play: async ({ canvasElement }) => {
    const probe = canvasElement.ownerDocument.createElement('span');
    canvasElement.append(probe);
    for (const [index, color] of ['inherit', vars.color.accentText, vars.color.dangerText, vars.color.warning, vars.color.success, vars.color.info, vars.color.textMuted].entries()) {
      probe.style.color = color;
      await expect(getComputedStyle(canvasElement.querySelectorAll('svg')[index]!).color).toBe(getComputedStyle(probe).color);
    }
    probe.remove();
  },
};
export const Light: Story = { ...Tones, decorators: [withLightTheme], globals: { theme: 'light' } };
export const Labels: Story = {
  render: (args) => <Row><SvgIcon {...args} label="Search" /><Button><SvgIcon {...args} label="Ignored label" decorative />Search</Button></Row>,
  parameters: { docs: { description: { story: 'Name a standalone icon and hide the drawing inside a named control.' }, source: { code: `import { Button, SvgIcon } from '@jfrader/ui';
const drawing = <><circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.1 15.1 20 20" /></>;
<><SvgIcon label="Search">{drawing}</SvgIcon><Button><SvgIcon decorative label="Ignored label">{drawing}</SvgIcon>Search</Button></>` } } },
  play: async ({ canvas, canvasElement }) => {
    const icon = canvas.getByRole('img', { name: 'Search' });
    await expect(icon.querySelector('title')).toHaveTextContent('Search');
    await expect(canvas.getByRole('button', { name: 'Search' })).toBeVisible();
    const hidden = canvasElement.querySelector('button svg')!;
    await expect(hidden).toHaveAttribute('aria-hidden', 'true');
    await expect(hidden.querySelector('title')).toBeNull();
    await expect(hidden).not.toHaveAttribute('aria-label');
  },
};
export const Factory: Story = {
  render: (args) => <Row><SearchIcon {...args} tone="accent" size="lg" label="Factory search" /><PlaySolidIcon tone="accent" size="lg" label="Factory solid" /><SvgIcon {...args} tone="accent" size="lg" label="Base search" /></Row>,
  parameters: { docs: { description: { story: 'Your own icon in 6 lines: declare a drawing once and pass the same props to the factory icon and base. A third argument bakes in props such as `variant`, `viewBox`, or `inheritViewBox`.' }, source: { code: `import { createSvgIcon, SvgIcon } from '@jfrader/ui';
const drawing = <><circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.1 15.1 20 20" /></>;
const SearchIcon = createSvgIcon(drawing, 'Icons.Search');
const solidDrawing = <path d="M9 5 18 12 9 19Z" />;
const PlaySolidIcon = createSvgIcon(solidDrawing, 'Icons.PlaySolid', { variant: 'solid' });
const factoryIcon = <SearchIcon tone="accent" size="lg" label="Factory search" />;
const solidIcon = <PlaySolidIcon tone="accent" size="lg" label="Factory solid" />;
const baseIcon = <SvgIcon tone="accent" size="lg" label="Base search">{drawing}</SvgIcon>;
<>{factoryIcon}{solidIcon}{baseIcon}</>` } } },
  play: async ({ canvasElement }) => {
    await expect(SearchIcon.displayName).toBe('Icons.Search');
    await expect(PlaySolidIcon.displayName).toBe('Icons.PlaySolid');
    const [factory, baked, base] = canvasElement.querySelectorAll('svg');
    await expect(factory!.getBoundingClientRect().width).toBe(base!.getBoundingClientRect().width);
    await expect(getComputedStyle(factory!).color).toBe(getComputedStyle(base!).color);
    await expect(factory!.querySelector('path')!.getAttribute('d')).toBe(base!.querySelector('path')!.getAttribute('d'));
    await expect(baked).toHaveAttribute('fill', 'currentColor');
    await expect(baked).not.toHaveAttribute('stroke');
    await expect(baked!.querySelector('path')!.getAttribute('d')).toBe('M9 5 18 12 9 19Z');
    await expect(baked!.querySelector('circle')).toBeNull();
  },
};
export const ForeignGrid: Story = {
  args: { inheritViewBox: true, viewBox: '0 0 40 16', fill: 'currentColor', children: <path d="M2 2H38V14H2Z" /> },
  parameters: { docs: { description: { story: 'Keep a consumer mark on its own grid and supply its paint attributes.' }, source: { code: `import { SvgIcon } from '@jfrader/ui';
<SvgIcon inheritViewBox viewBox="0 0 40 16" fill="currentColor"><path d="M2 2H38V14H2Z" /></SvgIcon>` } } },
  play: async ({ canvasElement }) => {
    const icon = canvasElement.querySelector('svg')!;
    await expect(icon).toHaveAttribute('viewBox', '0 0 40 16');
    for (const attribute of ['stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin']) await expect(icon).not.toHaveAttribute(attribute);
  },
};
export const Replacements: Story = {
  render: (args) => <Row><SvgIcon {...args} component={RootAdapter} label="Component root" /><SvgIcon {...args} slots={{ root: RootAdapter, title: TitleAdapter }} slotProps={{ root: { 'data-ui': 'custom svg-icon custom', className: 'slot-root' }, title: { id: 'replacement-title' } }} data-ui="consumer custom" label="Slot root" /></Row>,
  parameters: { docs: { description: { story: 'Forward native attributes and refs through a module-level replacement.' }, source: { code: `import type { ComponentPropsWithRef } from 'react';
import { SvgIcon } from '@jfrader/ui';
function Root(props: ComponentPropsWithRef<'svg'>) { return <svg {...props} data-replacement="root" />; }
function Title(props: ComponentPropsWithRef<'title'>) { return <title {...props} />; }
const drawing = <><circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.1 15.1 20 20" /></>;
<><SvgIcon component={Root} label="Component root">{drawing}</SvgIcon><SvgIcon slots={{ root: Root, title: Title }} label="Slot root">{drawing}</SvgIcon></>` } } },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('img', { name: 'Component root' })).toHaveAttribute('data-replacement', 'root');
    const slot = canvas.getByRole('img', { name: 'Slot root' });
    await expect(slot).toHaveAttribute('data-ui', 'svg-icon consumer custom');
    await expect(slot).toHaveClass('slot-root');
    await expect(slot.querySelector('title')).toHaveAttribute('data-replacement', 'title');
  },
};

const iconRef = createRef<SVGSVGElement>();
const slotRef = createRef<SVGSVGElement>();
export const Contracts: Story = {
  tags: ['!autodocs'],
  render: () => <Row>
    <SvgIcon ref={iconRef} component={ComponentAdapter} slots={{ root: RootAdapter }} label="Contracts" className="consumer-root" sx={{ color: vars.color.success }} slotProps={{ root: { ref: slotRef, sx: { color: vars.color.dangerText }, className: 'slot-root', viewBox: '0 0 32 32' } }} strokeWidth={2}>{drawing}</SvgIcon>
    <SvgIcon inheritViewBox>{drawing}</SvgIcon>
    <SearchIcon variant="solid" viewBox="0 0 40 40"><rect width="40" height="40" /></SearchIcon>
  </Row>,
  play: async ({ canvasElement, canvas }) => {
    const icon = canvas.getByRole('img', { name: 'Contracts' });
    await expect(iconRef.current).toBe(icon);
    await expect(slotRef.current).toBe(icon);
    await expect(icon).toHaveAttribute('data-replacement', 'root');
    await expect(icon).toHaveClass('consumer-root', 'slot-root');
    await expect(icon).toHaveAttribute('viewBox', '0 0 32 32');
    await expect(icon).toHaveAttribute('stroke-width', '2');
    const probe = canvasElement.ownerDocument.createElement('span');
    probe.style.color = vars.color.success;
    canvasElement.append(probe);
    await expect(getComputedStyle(icon).color).toBe(getComputedStyle(probe).color);
    probe.remove();
    const [, foreign, factory] = canvasElement.querySelectorAll('svg');
    for (const attribute of ['viewBox', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin']) await expect(foreign).not.toHaveAttribute(attribute);
    await expect(factory).toHaveAttribute('viewBox', '0 0 40 40');
    await expect(factory).toHaveAttribute('fill', 'currentColor');
    await expect(factory!.querySelector('rect')).not.toBeNull();
    await expect(factory!.querySelector('circle')).toBeNull();
  },
};

const consumerCleanup = createRefCleanupTracker<SVGSVGElement>();
const slotCleanup = createRefCleanupTracker<SVGSVGElement>();
function RefLifecycleExample() {
  const [visible, setVisible] = useState(true);
  return <Row>
    <Button onClick={() => setVisible((value) => !value)}>Toggle icon</Button>
    {visible && <SvgIcon component={RootAdapter} ref={consumerCleanup.ref} slotProps={{ root: { ref: slotCleanup.ref } }}>{drawing}</SvgIcon>}
  </Row>;
}
export const RefLifecycle: Story = {
  tags: ['!autodocs'],
  render: () => <StrictMode><RefLifecycleExample /></StrictMode>,
  play: async ({ canvas, canvasElement, userEvent }) => {
    const icon = canvasElement.querySelector('svg');
    await expect(consumerCleanup.getNode()).toBe(icon);
    await expect(slotCleanup.getNode()).toBe(icon);
    await userEvent.click(canvas.getByRole('button', { name: 'Toggle icon' }));
    await expect(consumerCleanup.isCleanedUp()).toBe(true);
    await expect(slotCleanup.isCleanedUp()).toBe(true);
    await userEvent.click(canvas.getByRole('button', { name: 'Toggle icon' }));
    await expect(consumerCleanup.getNode()).toBe(canvasElement.querySelector('svg'));
    await expect(slotCleanup.getNode()).toBe(canvasElement.querySelector('svg'));
  },
};
