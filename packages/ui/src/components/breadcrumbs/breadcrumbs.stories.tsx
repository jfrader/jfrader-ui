import type { CSSProperties } from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { withLightTheme } from '../../testing/story-decorators';
import { Button } from '../button';
import { Breadcrumbs } from './index';

const LEVELS = [
  { label: 'Home', href: '/' },
  { label: 'Projects', href: '/projects' },
  { label: 'jfrader-ui', href: '/projects/jfrader-ui' },
] as const;

const stackStyle = {
  display: 'grid',
  justifyItems: 'start',
  gap: vars.space[4],
} satisfies CSSProperties;

const meta = {
  title: 'Navigation/Breadcrumbs',
  component: Breadcrumbs,
} satisfies Meta<typeof Breadcrumbs>;

export default meta;

type Story = StoryObj<typeof meta>;

const getSeparators = (nav: HTMLElement) =>
  Array.from(nav.querySelectorAll<HTMLElement>('[data-ui="breadcrumbs-separator"]'));

// The last level renders as plain text: it is the current page.
export const Default: Story = {
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

// Every level is a link; the current page stays a link with aria-current (APG).
export const WithHref: Story = {
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
    <div style={stackStyle}>
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
    </div>
  );
}
GrowingTrail.displayName = 'GrowingTrail';

// aria-current follows the last item when items mount or unmount.
export const DynamicItems: Story = {
  parameters: {
    docs: {
      source: {
        code: `<Breadcrumbs>
  {levels.slice(0, depth).map((level) => (
    <Breadcrumbs.Item key={level.href} href={level.href}>{level.label}</Breadcrumbs.Item>
  ))}
</Breadcrumbs>`,
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
    <div style={stackStyle}>
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
    </div>
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
