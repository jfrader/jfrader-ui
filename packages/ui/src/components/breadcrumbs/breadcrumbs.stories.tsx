// `styled` is the app-facing styling API; consumers import it from `@jfrader/ui`.
import { styled } from '../../index';
import type { ComponentPropsWithRef } from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { withLightTheme } from '../../testing/story-decorators';
import { Button } from '../button';
import { Breadcrumbs, type BreadcrumbsComposedProps, type BreadcrumbsShorthandProps } from './index';

const LEVELS = [
  { label: 'Home', href: '/' },
  { label: 'Projects', href: '/projects' },
  { label: 'jfrader-ui', href: '/projects/jfrader-ui' },
] as const;

const Stack = styled.div({
  display: 'grid',
  justifyItems: 'start',
  gap: vars.space[4],
});

const NarrowFrame = styled.div({ inlineSize: '180px' });

const meta = {
  title: 'Navigation/Breadcrumbs',
  component: Breadcrumbs,
  parameters: { docs: {
    description: { component: 'Show where a page sits and link to the pages above it.' },
    sections: [
      { title: 'Basic', stories: ['Default'] },
      { title: 'Links and current page', stories: ['ExplicitCurrent'] },
      { title: 'Long labels', stories: ['LongLabels'] },
      { title: 'Separators', stories: ['CustomSeparator'] },
      { title: 'Composition', stories: ['Composed', 'DynamicItems'] },
      { title: 'Keyboard', stories: ['WithHref'] },
    ],
    usage: `### When to use
Show the current page’s place in a hierarchy and provide links to its ancestors. Use a separate navigation menu for unrelated destinations.

### Current page

The last item becomes current unless another item is explicitly marked. Mark the current item explicitly when server-rendered markup must include its current-page announcement. The current page can remain a link or be plain text.

### Keyboard and accessibility

Tab and Shift+Tab move through links in page order; Enter follows a link. Text items and decorative separators are not tab stops. Give each breadcrumb landmark a distinct accessible name when a page has more than one trail.`,
  } },
} satisfies Meta<BreadcrumbsComposedProps>;

export default meta;

type Story = StoryObj<Omit<BreadcrumbsComposedProps, 'component'>>;
type CheckedShorthandArgs<Args extends BreadcrumbsShorthandProps> = Args;
export type ShorthandModeTypeRegression = {
  // @ts-expect-error Shorthand items cannot be combined with composed children.
  mixed: CheckedShorthandArgs<{ items: readonly []; children: string }>;
};
function BreadcrumbHost(props: ComponentPropsWithRef<'nav'>) {
  return <nav {...props} data-testid="breadcrumb-host" />;
}
function PathItem(props: ComponentPropsWithRef<'li'>) {
  return <li {...props} data-testid="path-item" />;
}

const getSeparators = (nav: HTMLElement) =>
  Array.from(nav.querySelectorAll<HTMLElement>('[data-ui="breadcrumbs-separator"]'));

// The last level renders as plain text: it is the current page.
export const Default: StoryObj<Omit<BreadcrumbsShorthandProps, 'component'>> = {
  name: 'Page hierarchy',
  args: { items: [ { key: 'home', label: 'Home', href: '/' }, { key: 'projects', label: 'Projects', href: '/projects' }, { key: 'current', label: 'jfrader-ui' } ] },
  render: (args) => <Breadcrumbs {...args} />,
  parameters: { docs: { description: { story: 'Link to ancestor pages and show the current page as text.' }, source: { language: 'tsx', code: `import { Breadcrumbs } from '@jfrader/ui';

<Breadcrumbs items={[
  { key: 'home', label: 'Home', href: '/' },
  { key: 'projects', label: 'Projects', href: '/projects' },
  { key: 'current', label: 'jfrader-ui' },
]} />` } } },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await expect(canvas.getByText('jfrader-ui')).toHaveAttribute('aria-current', 'page');
    await expect(canvas.getAllByRole('link')).toHaveLength(2);
    await userEvent.tab();
    await expect(canvasElement.ownerDocument.activeElement).toBe(canvas.getByRole('link', { name: 'Home' }));
    await userEvent.tab();
    await expect(canvasElement.ownerDocument.activeElement).toBe(canvas.getByRole('link', { name: 'Projects' }));
  },
};

export const GeneratedPartProps: StoryObj<Omit<BreadcrumbsShorthandProps, 'component'>> = {
  // Inline slot styles exercise the documented generated-part props API.
  args: { items: [ { key: 'home', label: 'Home', href: '/' }, { key: 'current', label: 'Project' } ], slotProps: { separator: { style: { fontWeight: 700 } }, item: { style: { fontStyle: 'italic' } } } },
  render: (args) => <Breadcrumbs {...args} />,
  parameters: { docs: { source: { code: `<Breadcrumbs items={path} slotProps={{ item: { sx: { fontStyle: 'italic' } } }} />` } } },
  play: async ({ canvas }) => {
    await expect(canvas.getAllByRole('listitem')[0]).toHaveStyle({ fontStyle: 'italic' });
  },
};

export const Composed: Story = {
  name: 'Compose the trail',
  parameters: { docs: { description: { story: 'Build the same page hierarchy from individual breadcrumb items.' }, source: { language: 'tsx', code: `import { Breadcrumbs } from '@jfrader/ui';

<Breadcrumbs>
  <Breadcrumbs.Item href="/">Home</Breadcrumbs.Item>
  <Breadcrumbs.Item href="/projects">Projects</Breadcrumbs.Item>
  <Breadcrumbs.Item>jfrader-ui</Breadcrumbs.Item>
</Breadcrumbs>` } } },
  render: (args) => (
    <Breadcrumbs {...args}>
      <Breadcrumbs.Item href={LEVELS[0].href}>{LEVELS[0].label}</Breadcrumbs.Item>
      <Breadcrumbs.Item href={LEVELS[1].href}>{LEVELS[1].label}</Breadcrumbs.Item>
      <Breadcrumbs.Item>{LEVELS[2].label}</Breadcrumbs.Item>
    </Breadcrumbs>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const nav = canvas.getByRole('navigation', { name: 'Breadcrumb' });
    const list = within(nav).getByRole('list');
    await expect(list.tagName).toBe('OL');
    const items = within(list).getAllByRole('listitem');
    await expect(items).toHaveLength(LEVELS.length);

    const links = within(nav).getAllByRole('link');
    await expect(links.map((link) => link.textContent)).toEqual(['Home', 'Projects']);
    links.forEach((link) => expect(link).not.toHaveAttribute('aria-current'));
    const current = within(items[2]!).getByText('jfrader-ui');
    await expect(current.tagName).toBe('SPAN');
    await expect(current).toHaveAttribute('aria-current', 'page');

    // One separator per item, all hidden from assistive tech; only those between items show.
    const separators = getSeparators(nav);
    await expect(separators).toHaveLength(LEVELS.length);
    separators.forEach((separator) => expect(separator).toHaveAttribute('aria-hidden', 'true'));
    await expect(separators.map((separator) => getComputedStyle(separator).display)).toEqual([
      'none',
      'flex',
      'flex',
    ]);
    await expect(separators[1]).toHaveTextContent('/');
  },
};

export const ReplacedParts: StoryObj<Omit<BreadcrumbsShorthandProps, 'component'>> = {
  args: { items: [ { key: 'home', label: 'Home', href: '/' }, { key: 'current', label: 'Project', href: '/project' } ], slots: { root: BreadcrumbHost, item: PathItem }, slotProps: { root: { 'aria-label': 'Project path' } } },
  render: (args) => <Breadcrumbs {...args} />,
  parameters: { docs: { source: { code: `<Breadcrumbs items={path} component={BreadcrumbHost} slotProps={{ root: { 'aria-label': 'Project path' } }} />` } } },
  play: async ({ canvas }) => {
    await expect(canvas.getByTestId('breadcrumb-host')).toHaveAccessibleName('Project path');
    await expect(canvas.getByRole('link', { name: 'Project' })).toHaveAttribute('aria-current', 'page');
    await expect(canvas.getAllByTestId('path-item')).toHaveLength(2);
  },
};

// Every level is a link; the current page stays a link with aria-current (APG).
export const WithHref: Story = {
  name: 'Tab through page links',
  parameters: { docs: {
    description: { story: 'Press Tab to visit each link, including the current page, and Enter to follow it.' },
    source: { language: 'tsx', code: `import { Breadcrumbs } from '@jfrader/ui';

<Breadcrumbs>
  <Breadcrumbs.Item href="/">Home</Breadcrumbs.Item>
  <Breadcrumbs.Item href="/projects">Projects</Breadcrumbs.Item>
  <Breadcrumbs.Item href="/projects/jfrader-ui">jfrader-ui</Breadcrumbs.Item>
</Breadcrumbs>` },
  } },
  render: (args) => (
    <Breadcrumbs {...args}>
      {LEVELS.map((level) => (
        <Breadcrumbs.Item key={level.href} href={level.href}>
          {level.label}
        </Breadcrumbs.Item>
      ))}
    </Breadcrumbs>
  ),
  play: async ({ canvasElement }) => {
    const nav = within(canvasElement).getByRole('navigation', { name: 'Breadcrumb' });
    const links = within(nav).getAllByRole('link');
    await expect(links.map((link) => link.getAttribute('href'))).toEqual(LEVELS.map((level) => level.href));
    await expect(links[2]).toHaveAttribute('aria-current', 'page');
    await expect(links[0]).not.toHaveAttribute('aria-current');
    await expect(links[1]).not.toHaveAttribute('aria-current');

    // Native link tab order, each with a visible focus ring.
    for (const link of links) {
      await userEvent.tab();
      await expect(link.ownerDocument.activeElement).toBe(link);
      await expect(getComputedStyle(link).outlineStyle).not.toBe('none');
      await expect(getComputedStyle(link).outlineWidth).not.toBe('0px');
    }
    await userEvent.tab();
    await expect(nav.contains(nav.ownerDocument.activeElement)).toBe(false);
  },
};

export const CustomSeparator: Story = {
  name: 'Chevron separators',
  parameters: { docs: {
    description: { story: 'Separate levels with a chevron without changing their accessible names.' },
    source: { language: 'tsx', code: `import { Breadcrumbs } from '@jfrader/ui';

<Breadcrumbs separator="›" label="Project trail">
  <Breadcrumbs.Item href="/">Home</Breadcrumbs.Item>
  <Breadcrumbs.Item href="/projects">Projects</Breadcrumbs.Item>
  <Breadcrumbs.Item>jfrader-ui</Breadcrumbs.Item>
</Breadcrumbs>` },
  } },
  args: { separator: '›', label: 'Project trail' },
  render: (args) => (
    <Breadcrumbs {...args}>
      <Breadcrumbs.Item href={LEVELS[0].href}>{LEVELS[0].label}</Breadcrumbs.Item>
      <Breadcrumbs.Item href={LEVELS[1].href}>{LEVELS[1].label}</Breadcrumbs.Item>
      <Breadcrumbs.Item>{LEVELS[2].label}</Breadcrumbs.Item>
    </Breadcrumbs>
  ),
  play: async ({ canvasElement }) => {
    const nav = within(canvasElement).getByRole('navigation', { name: 'Project trail' });
    const separators = getSeparators(nav);
    separators.forEach((separator) => expect(separator).toHaveTextContent('›'));
    separators.forEach((separator) => expect(separator).toHaveAttribute('aria-hidden', 'true'));
    // Separators never leak into the link names.
    await expect(within(nav).getByRole('link', { name: 'Projects' })).toBeInTheDocument();
  },
};

// An explicit `current` wins over the automatic last-item default.
export const ExplicitCurrent: Story = {
  name: 'Choose the current level',
  parameters: { docs: {
    description: { story: 'Mark an ancestor as current instead of using the final item.' },
    source: { language: 'tsx', code: `import { Breadcrumbs } from '@jfrader/ui';

<Breadcrumbs>
  <Breadcrumbs.Item href="/">Home</Breadcrumbs.Item>
  <Breadcrumbs.Item href="/projects" current>Projects</Breadcrumbs.Item>
  <Breadcrumbs.Item href="/projects/jfrader-ui">jfrader-ui</Breadcrumbs.Item>
</Breadcrumbs>` },
  } },
  render: (args) => (
    <Breadcrumbs {...args}>
      <Breadcrumbs.Item href={LEVELS[0].href}>{LEVELS[0].label}</Breadcrumbs.Item>
      <Breadcrumbs.Item href={LEVELS[1].href} current>
        {LEVELS[1].label}
      </Breadcrumbs.Item>
      <Breadcrumbs.Item href={LEVELS[2].href}>{LEVELS[2].label}</Breadcrumbs.Item>
    </Breadcrumbs>
  ),
  play: async ({ canvasElement }) => {
    const nav = within(canvasElement).getByRole('navigation');
    const current = nav.querySelectorAll('[aria-current]');
    await expect(current).toHaveLength(1);
    await expect(current[0]).toHaveTextContent('Projects');
    await expect(current[0]).toHaveAttribute('aria-current', 'page');
  },
};

function GrowingTrail() {
  const [depth, setDepth] = useState(2);
  return (
    <Stack>
      <Breadcrumbs>
        {LEVELS.slice(0, depth).map((level) => (
          <Breadcrumbs.Item key={level.href} href={level.href}>
            {level.label}
          </Breadcrumbs.Item>
        ))}
      </Breadcrumbs>
      <Button size="sm" onClick={() => setDepth((value) => (value === LEVELS.length ? 2 : value + 1))}>
        Toggle level
      </Button>
    </Stack>
  );
}
GrowingTrail.displayName = 'GrowingTrail';

// aria-current follows the last item when items mount or unmount.
export const DynamicItems: Story = {
  name: 'Add or remove a level',
  parameters: {
    docs: {
      description: { story: 'Toggle the final level and let the current-page marker follow the trail.' },
      source: {
        language: 'tsx',
        code: `import { useState } from 'react';
import { Breadcrumbs, Button, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const TrailLayout = styled.div({ display: 'grid', justifyItems: 'start', gap: vars.space[4] });
const pages = [
  { label: 'Home', href: '/' },
  { label: 'Projects', href: '/projects' },
  { label: 'jfrader-ui', href: '/projects/jfrader-ui' },
];

export function ProjectTrail() {
  const [depth, setDepth] = useState(2);
  return (
    <TrailLayout>
      <Breadcrumbs>
        {pages.slice(0, depth).map((page) => (
          <Breadcrumbs.Item key={page.href} href={page.href}>{page.label}</Breadcrumbs.Item>
        ))}
      </Breadcrumbs>
      <Button size="sm" onClick={() => setDepth((value) => value === pages.length ? 2 : value + 1)}>
        Toggle level
      </Button>
    </TrailLayout>
  );
}`,
      },
    },
  },
  render: () => <GrowingTrail />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const nav = canvas.getByRole('navigation', { name: 'Breadcrumb' });
    const currentText = () => Array.from(nav.querySelectorAll('[aria-current="page"]'), (node) => node.textContent);
    await expect(currentText()).toEqual(['Projects']);
    await userEvent.click(canvas.getByRole('button', { name: 'Toggle level' }));
    await expect(currentText()).toEqual(['jfrader-ui']);
    await userEvent.click(canvas.getByRole('button', { name: 'Toggle level' }));
    await expect(currentText()).toEqual(['Projects']);
  },
};

function ReorderingTrail() {
  const [swapped, setSwapped] = useState(false);
  const levels = swapped ? [LEVELS[2], LEVELS[1]] : [LEVELS[1], LEVELS[2]];
  return (
    <Stack>
      <Breadcrumbs>
        <Breadcrumbs.Item href={LEVELS[0].href}>{LEVELS[0].label}</Breadcrumbs.Item>
        {levels.map((level) => (
          <Breadcrumbs.Item key={level.href} href={level.href}>
            {level.label}
          </Breadcrumbs.Item>
        ))}
      </Breadcrumbs>
      <Button size="sm" onClick={() => setSwapped((value) => !value)}>
        Swap levels
      </Button>
    </Stack>
  );
}
ReorderingTrail.displayName = 'ReorderingTrail';

export const ReorderedItems: Story = {
  parameters: {
    docs: {
      source: {
        code: `<Breadcrumbs>
  <Breadcrumbs.Item href="/">Home</Breadcrumbs.Item>
  {levels.map((level) => (
    <Breadcrumbs.Item key={level.href} href={level.href}>{level.label}</Breadcrumbs.Item>
  ))}
</Breadcrumbs>`,
      },
    },
  },
  render: () => <ReorderingTrail />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const nav = canvas.getByRole('navigation', { name: 'Breadcrumb' });
    const projects = within(nav).getByRole('link', { name: 'Projects' });
    const library = within(nav).getByRole('link', { name: 'jfrader-ui' });
    await expect(library).toHaveAttribute('aria-current', 'page');
    await expect(projects).not.toHaveAttribute('aria-current');
    await userEvent.click(canvas.getByRole('button', { name: 'Swap levels' }));
    await expect(within(nav).getAllByRole('link').map((link) => link.textContent)).toEqual([
      'Home',
      'jfrader-ui',
      'Projects',
    ]);
    await expect(projects).toHaveAttribute('aria-current', 'page');
    await expect(library).not.toHaveAttribute('aria-current');
    await expect(nav.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
    await userEvent.click(canvas.getByRole('button', { name: 'Swap levels' }));
    await expect(library).toHaveAttribute('aria-current', 'page');
    await expect(projects).not.toHaveAttribute('aria-current');
  },
};

export const LightTheme: Story = {
  decorators: [withLightTheme],
  render: (args) => (
    <Breadcrumbs {...args}>
      <Breadcrumbs.Item href={LEVELS[0].href}>{LEVELS[0].label}</Breadcrumbs.Item>
      <Breadcrumbs.Item href={LEVELS[1].href}>{LEVELS[1].label}</Breadcrumbs.Item>
      <Breadcrumbs.Item>{LEVELS[2].label}</Breadcrumbs.Item>
    </Breadcrumbs>
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('jfrader-ui')).toHaveAttribute('aria-current', 'page');
  },
};

export const NarrowTrail: Story = {
  args: { dir: 'rtl', 'aria-label': 'Location' },
  render: (args) => (
    <NarrowFrame>
      <Breadcrumbs {...args}>
        <Breadcrumbs.Item href="/">Home</Breadcrumbs.Item>
        <Breadcrumbs.Item href="/projects">AnUnbrokenProjectLabelThatMustFitTheAvailableWidth</Breadcrumbs.Item>
        <Breadcrumbs.Item>Current page</Breadcrumbs.Item>
      </Breadcrumbs>
    </NarrowFrame>
  ),
  play: async ({ canvasElement, userEvent }) => {
    const nav = within(canvasElement).getByRole('navigation', { name: 'Location' });
    await expect(nav).toHaveAttribute('dir', 'rtl');
    await expect(nav.scrollWidth).toBeLessThanOrEqual(nav.clientWidth);
    for (const link of within(nav).getAllByRole('link')) {
      await expect(link.getBoundingClientRect().height).toBeGreaterThanOrEqual(32);
      await userEvent.tab();
      await expect(link.ownerDocument.activeElement).toBe(link);
      await expect(getComputedStyle(link).outlineWidth).toBe('2px');
    }
  },
};

export const LongLabels: Story = {
  name: 'Long labels in a narrow trail',
  parameters: { docs: {
    description: { story: 'Wrap an unbroken project name within a narrow navigation lane.' },
    source: { language: 'tsx', code: `import { Breadcrumbs, styled } from '@jfrader/ui';

const TrailLane = styled.div({ inlineSize: '180px' });

<TrailLane>
  <Breadcrumbs label="Location">
    <Breadcrumbs.Item href="/">Home</Breadcrumbs.Item>
    <Breadcrumbs.Item href="/projects">AnUnbrokenProjectLabelThatMustFitTheAvailableWidth</Breadcrumbs.Item>
    <Breadcrumbs.Item>Current page</Breadcrumbs.Item>
  </Breadcrumbs>
</TrailLane>` },
  } },
  render: () => (
    <NarrowFrame>
      <Breadcrumbs label="Location">
        <Breadcrumbs.Item href="/">Home</Breadcrumbs.Item>
        <Breadcrumbs.Item href="/projects">AnUnbrokenProjectLabelThatMustFitTheAvailableWidth</Breadcrumbs.Item>
        <Breadcrumbs.Item>Current page</Breadcrumbs.Item>
      </Breadcrumbs>
    </NarrowFrame>
  ),
};
