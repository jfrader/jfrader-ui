import type { CSSProperties } from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { withLightTheme } from '../../testing/story-decorators';
import { expectInside, expectNoOverlap } from '../../testing/geometry-assertions';
import { Pagination, type PaginationProps } from './index';
import { Card } from '../card';

const paginationSource = `import { useState } from 'react';
import { Pagination } from '@jfrader/ui';

function ResultsPages() {
  const [page, setPage] = useState(5);
  return <Pagination page={page} totalPages={20} locale="en-US" onPageChange={setPage} />;
}`;

const stackStyle = {
  display: 'grid',
  justifyItems: 'start',
  gap: vars.space[4],
} satisfies CSSProperties;

const meta = {
  title: 'Navigation/Pagination',
  component: Pagination,
  parameters: {
    docs: {
      description: { component: 'Move between pages of results.' },
      sections: [
        { title: 'Basic', stories: ['Default'] },
        { title: 'Page ranges and ellipses', stories: ['SmallTotal', 'PageRange'] },
        { title: 'Sizes', stories: ['NarrowLayout'] },
        { title: 'Labels', stories: ['TranslatedLabels', 'LocalizedNumbers'] },
        { title: 'Controlled navigation', stories: ['Controlled'] },
        { title: 'Composition', stories: ['ResultsCard'] },
        { title: 'Keyboard', stories: ['Keyboard'] },
      ],
      usage: `### When to use
Use pagination for a finite set of results readers need to revisit by page. Load and render the requested results in your application, and keep the current page aligned with those results.

### Constraints
Page numbers start at one. Ellipses are not controls; choose a displayed page or use Previous and Next. With no pages, there are no numbered controls and both navigation buttons are disabled. There is one target size; reduce the number of visible neighbours rather than shrinking buttons in a narrow layout.

### Keyboard
- Press Tab to reach each enabled button, then Enter or Space to request a page. There is no arrow-key navigation between buttons.
- Previous and Next are disabled at the boundaries. If an accepted request disables the focused navigation button, focus moves to the current page button.

### Accessibility
Give each pagination landmark a distinct name when a page has more than one. Translate navigation names as well as page numerals.`,
    },
  },
  args: { page: 5, totalPages: 20, locale: 'en-US' },
  argTypes: {
    page: { control: { type: 'number', min: 1 } },
    totalPages: { control: { type: 'number', min: 0 } },
    siblingCount: { control: { type: 'number', min: 0 } },
  },
} satisfies Meta<typeof Pagination>;

export default meta;

type Story = StoryObj<typeof meta>;

function ControlledPagination({ page: initialPage, onPageChange, ...props }: PaginationProps) {
  const [page, setPage] = useState(initialPage);
  return (
    <Pagination
      {...props}
      page={page}
      onPageChange={(next) => {
        setPage(next);
        onPageChange?.(next);
      }}
    />
  );
}
ControlledPagination.displayName = 'ControlledPagination';

const getNav = (canvasElement: HTMLElement, name = 'Pagination') =>
  within(canvasElement).getByRole('navigation', { name });

// The visible sequence between Previous and Next: page numbers and ellipses.
const readWindow = (nav: HTMLElement) =>
  Array.from(nav.querySelectorAll('li'))
    .slice(1, -1)
    .map((item) => item.textContent)
    .join(' ');

const currentPage = (nav: HTMLElement) =>
  Array.from(nav.querySelectorAll('[aria-current]'), (node) => [node.textContent, node.getAttribute('aria-current')]);

export const Default: Story = {
  name: 'Browse result pages',
  args: { onPageChange: fn() },
  parameters: { docs: { description: { story: 'Choose a page or move through results with Previous and Next.' }, source: { language: 'tsx', code: paginationSource } } },
  render: (args) => <ControlledPagination {...args} />,
  play: async ({ canvasElement }) => {
    const nav = getNav(canvasElement);
    const list = within(nav).getByRole('list');
    await expect(list.tagName).toBe('UL');
    const buttons = within(nav).getAllByRole('button');
    const names = ['Previous page', '1', '4', '5', '6', '20', 'Next page'];
    await expect(buttons).toHaveLength(names.length);
    names.forEach((name, index) => expect(buttons[index]).toHaveAccessibleName(name));
    await expect(within(nav).getByRole('button', { name: 'Previous page' })).toBeEnabled();
    await expect(within(nav).getByRole('button', { name: 'Next page' })).toBeEnabled();
    await expect(currentPage(nav)).toEqual([['5', 'page']]);
    await expect(readWindow(nav)).toBe('1 … 4 5 6 … 20');

    const ellipses = Array.from(nav.querySelectorAll<HTMLElement>('[data-ui="pagination-ellipsis"]'));
    await expect(ellipses).toHaveLength(2);
    ellipses.forEach((ellipsis) => expect(ellipsis).toHaveAttribute('aria-hidden', 'true'));

    for (const button of buttons) {
      await expect(button).toHaveAttribute('type', 'button');
      const rect = button.getBoundingClientRect();
      await expect(rect.width).toBeGreaterThanOrEqual(32);
      await expect(rect.height).toBeGreaterThanOrEqual(32);
    }
  },
};

export const Boundaries: Story = {
  args: { onPageChange: fn() },
  render: (args) => (
    <div style={stackStyle}>
      <Pagination {...args} page={1} label="First page reached" />
      <Pagination {...args} page={20} label="Last page reached" />
      <ControlledPagination {...args} page={19} label="Near the end" />
      <ControlledPagination {...args} page={2} label="Near the start" />
    </div>
  ),
  play: async ({ args, canvasElement }) => {
    const first = within(getNav(canvasElement, 'First page reached'));
    await expect(first.getByRole('button', { name: 'Previous page' })).toBeDisabled();
    await expect(first.getByRole('button', { name: 'Next page' })).toBeEnabled();
    await expect(readWindow(getNav(canvasElement, 'First page reached'))).toBe('1 2 3 4 5 … 20');

    const last = within(getNav(canvasElement, 'Last page reached'));
    await expect(last.getByRole('button', { name: 'Previous page' })).toBeEnabled();
    await expect(last.getByRole('button', { name: 'Next page' })).toBeDisabled();
    await expect(readWindow(getNav(canvasElement, 'Last page reached'))).toBe('1 … 16 17 18 19 20');

    // Disabled buttons never request a page.
    await userEvent.click(first.getByRole('button', { name: 'Previous page' }));
    await userEvent.click(last.getByRole('button', { name: 'Next page' }));
    await expect(args.onPageChange).not.toHaveBeenCalled();

    // Stepping onto a boundary disables the focused button; focus moves to the current page.
    const nearEnd = within(getNav(canvasElement, 'Near the end'));
    await userEvent.click(nearEnd.getByRole('button', { name: 'Next page' }));
    await expect(args.onPageChange).toHaveBeenCalledTimes(1);
    await expect(args.onPageChange).toHaveBeenLastCalledWith(20);
    await expect(nearEnd.getByRole('button', { name: 'Next page' })).toBeDisabled();
    const twenty = nearEnd.getByRole('button', { name: '20' });
    await expect(twenty).toHaveAttribute('aria-current', 'page');
    await expect(twenty.ownerDocument.activeElement).toBe(twenty);

    const nearStart = within(getNav(canvasElement, 'Near the start'));
    await userEvent.click(nearStart.getByRole('button', { name: 'Previous page' }));
    await expect(args.onPageChange).toHaveBeenCalledTimes(2);
    await expect(args.onPageChange).toHaveBeenLastCalledWith(1);
    const one = nearStart.getByRole('button', { name: '1' });
    await expect(one.ownerDocument.activeElement).toBe(one);
  },
};

export const Controlled: Story = {
  name: 'Accept or hold a page request',
  parameters: { docs: { description: { story: 'Compare parent-updated navigation with a second pagination held on page five.' }, source: { language: 'tsx', code: `import { useState } from 'react';
import { Pagination, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

const Stack = styled.div({ display: 'grid', justifyItems: 'start', gap: vars.space[4] });

function ResultsPages() {
  const [page, setPage] = useState(5);
  return <Stack>
    <Pagination page={page} totalPages={20} locale="en-US" onPageChange={setPage} />
    <Pagination page={5} totalPages={20} locale="en-US" label="Locked pagination" />
  </Stack>;
}` } } },
  args: { onPageChange: fn() },
  render: (args) => (
    <div style={stackStyle}>
      <ControlledPagination {...args} />
      <Pagination {...args} label="Locked pagination" />
    </div>
  ),
  play: async ({ args, canvasElement }) => {
    const nav = getNav(canvasElement);
    const pages = within(nav);
    await userEvent.click(pages.getByRole('button', { name: '6' }));
    await expect(args.onPageChange).toHaveBeenCalledTimes(1);
    await expect(args.onPageChange).toHaveBeenNthCalledWith(1, 6);
    await expect(currentPage(nav)).toEqual([['6', 'page']]);
    await expect(readWindow(nav)).toBe('1 … 5 6 7 … 20');
    // Re-activating the current page is not a change.
    await userEvent.click(pages.getByRole('button', { name: '6' }));
    await expect(args.onPageChange).toHaveBeenCalledTimes(1);
    await userEvent.click(pages.getByRole('button', { name: 'Next page' }));
    await expect(args.onPageChange).toHaveBeenCalledTimes(2);
    await expect(args.onPageChange).toHaveBeenNthCalledWith(2, 7);
    await expect(currentPage(nav)).toEqual([['7', 'page']]);

    // The locked parent never honors requests: each activation issues exactly one request
    // and the current page stays on 5.
    const lockedNav = getNav(canvasElement, 'Locked pagination');
    const locked = within(lockedNav);
    await userEvent.click(locked.getByRole('button', { name: '6' }));
    await expect(args.onPageChange).toHaveBeenCalledTimes(3);
    await expect(args.onPageChange).toHaveBeenNthCalledWith(3, 6);
    await expect(currentPage(lockedNav)).toEqual([['5', 'page']]);
    await userEvent.click(locked.getByRole('button', { name: 'Next page' }));
    await expect(args.onPageChange).toHaveBeenCalledTimes(4);
    await expect(args.onPageChange).toHaveBeenNthCalledWith(4, 6);
    await userEvent.click(locked.getByRole('button', { name: 'Previous page' }));
    await expect(args.onPageChange).toHaveBeenCalledTimes(5);
    await expect(args.onPageChange).toHaveBeenNthCalledWith(5, 4);
    await userEvent.click(locked.getByRole('button', { name: '5' }));
    await expect(args.onPageChange).toHaveBeenCalledTimes(5);
    await expect(currentPage(lockedNav)).toEqual([['5', 'page']]);
  },
};

export const SmallTotal: Story = {
  name: 'Show every page',
  parameters: { docs: { description: { story: 'Keep all five page numbers visible when the result set is short.' }, source: { language: 'tsx', code: `import { Pagination } from '@jfrader/ui';

<Pagination page={3} totalPages={5} locale="en-US" />` } } },
  args: { page: 3, totalPages: 5 },
  play: async ({ canvasElement }) => {
    const nav = getNav(canvasElement);
    await expect(readWindow(nav)).toBe('1 2 3 4 5');
    await expect(nav.querySelector('[data-ui="pagination-ellipsis"]')).toBeNull();
    await expect(currentPage(nav)).toEqual([['3', 'page']]);
  },
};

interface WindowCase {
  totalPages: number;
  page: number;
  siblingCount?: number;
  expected: string;
}

const WINDOW_CASES: readonly WindowCase[] = [
  { totalPages: 3, page: 1, expected: '1 2 3' },
  { totalPages: 3, page: 5, expected: '1 2 3' },
  { totalPages: 3, page: 20, expected: '1 2 3' },
  { totalPages: 5, page: 1, expected: '1 2 3 4 5' },
  { totalPages: 5, page: 5, expected: '1 2 3 4 5' },
  { totalPages: 5, page: 20, expected: '1 2 3 4 5' },
  { totalPages: 7, page: 1, expected: '1 2 3 4 5 6 7' },
  { totalPages: 7, page: 5, expected: '1 2 3 4 5 6 7' },
  { totalPages: 7, page: 20, expected: '1 2 3 4 5 6 7' },
  { totalPages: 20, page: 1, expected: '1 2 3 4 5 … 20' },
  { totalPages: 20, page: 4, expected: '1 2 3 4 5 … 20' },
  { totalPages: 20, page: 5, expected: '1 … 4 5 6 … 20' },
  { totalPages: 20, page: 16, expected: '1 … 15 16 17 … 20' },
  { totalPages: 20, page: 17, expected: '1 … 16 17 18 19 20' },
  { totalPages: 20, page: 20, expected: '1 … 16 17 18 19 20' },
  { totalPages: 20, page: 5, siblingCount: 0, expected: '1 … 5 … 20' },
  { totalPages: 20, page: 10, siblingCount: 2, expected: '1 … 8 9 10 11 12 … 20' },
  { totalPages: 1, page: 1, expected: '1' },
];

const caseLabel = ({ totalPages, page, siblingCount }: WindowCase) =>
  `Page ${page} of ${totalPages}${siblingCount === undefined ? '' : `, ${siblingCount} siblings`}`;

export const WindowingMatrix: Story = {
  parameters: {
    docs: {
      source: {
        code: `<>
  <Pagination page={1} totalPages={20} siblingCount={1} locale="en-US" />
  <Pagination page={10} totalPages={20} siblingCount={2} locale="en-US" />
  <Pagination page={20} totalPages={20} siblingCount={1} locale="en-US" />
</>`,
      },
    },
  },
  render: () => (
    <div style={stackStyle}>
      {WINDOW_CASES.map((windowCase) => (
        <Pagination
          key={caseLabel(windowCase)}
          label={caseLabel(windowCase)}
          page={windowCase.page}
          totalPages={windowCase.totalPages}
          siblingCount={windowCase.siblingCount}
          locale="en-US"
        />
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    for (const windowCase of WINDOW_CASES) {
      const nav = getNav(canvasElement, caseLabel(windowCase));
      await expect(readWindow(nav)).toBe(windowCase.expected);
      const format = new Intl.NumberFormat('en-US');
      const labels = windowCase.expected.split(' ').filter((label) => label !== '…');
      const buttons = Array.from(nav.querySelectorAll('[data-ui="pagination-page"]'));
      await expect(buttons.map((button) => button.textContent)).toEqual(labels);
      for (const [index, button] of buttons.entries()) {
        await expect(button).toHaveAccessibleName(labels[index]);
      }
      await expect(currentPage(nav)).toEqual([
        [format.format(Math.min(windowCase.page, windowCase.totalPages)), 'page'],
      ]);
    }
  },
};

export const InvalidAndEmptyInputs: Story = {
  args: { onPageChange: fn() },
  render: (args) => (
    <div style={stackStyle}>
      <Pagination {...args} page={0} totalPages={20} label="Page zero" />
      <Pagination {...args} page={5} totalPages={0} label="No pages" />
      <Pagination {...args} page={1} totalPages={1} label="Single page" />
    </div>
  ),
  play: async ({ args, canvasElement }) => {
    const zero = getNav(canvasElement, 'Page zero');
    await expect(readWindow(zero)).toBe('1 2 3 4 5 … 20');
    await expect(currentPage(zero)).toEqual([['1', 'page']]);
    await expect(within(zero).getByRole('button', { name: 'Previous page' })).toBeDisabled();
    await expect(within(zero).getByRole('button', { name: 'Next page' })).toBeEnabled();
    await userEvent.click(within(zero).getByRole('button', { name: '1' }));

    const empty = getNav(canvasElement, 'No pages');
    await expect(empty.querySelectorAll('[data-ui="pagination-page"]')).toHaveLength(0);
    await expect(currentPage(empty)).toEqual([]);
    await expect(readWindow(empty)).toBe('');

    const single = getNav(canvasElement, 'Single page');
    await expect(single.querySelectorAll('[data-ui="pagination-page"]')).toHaveLength(1);
    await expect(readWindow(single)).toBe('1');
    await expect(currentPage(single)).toEqual([['1', 'page']]);
    await userEvent.click(within(single).getByRole('button', { name: '1' }));

    for (const nav of [empty, single]) {
      for (const name of ['Previous page', 'Next page']) {
        const button = within(nav).getByRole('button', { name });
        await expect(button).toBeDisabled();
        await userEvent.click(button);
      }
    }
    await expect(args.onPageChange).not.toHaveBeenCalled();
  },
};

export const LocalizedNumbers: Story = {
  name: 'Localized page numerals',
  parameters: { docs: { description: { story: 'Format page numbers with Arabic-Indic numerals.' }, source: { language: 'tsx', code: `import { useState } from 'react';
import { Pagination } from '@jfrader/ui';

function ResultsPages() {
  const [page, setPage] = useState(5);
  return <Pagination page={page} totalPages={20} locale="ar-EG-u-nu-arab" onPageChange={setPage} />;
}` } } },
  args: { locale: 'ar-EG-u-nu-arab', onPageChange: fn() },
  render: (args) => <ControlledPagination {...args} />,
  play: async ({ args, canvasElement }) => {
    const nav = getNav(canvasElement);
    const format = new Intl.NumberFormat(args.locale);
    const labels = [1, 4, 5, 6, 20].map((page) => format.format(page));
    const buttons = Array.from(nav.querySelectorAll('[data-ui="pagination-page"]'));
    await expect(buttons.map((button) => button.textContent)).toEqual(labels);
    for (const [index, button] of buttons.entries()) {
      await expect(button).toHaveAccessibleName(labels[index]);
      await expect(button).toHaveAttribute('aria-label', labels[index]);
    }
    await expect(currentPage(nav)).toEqual([[format.format(5), 'page']]);
    await userEvent.click(within(nav).getByRole('button', { name: format.format(6) }));
    await expect(args.onPageChange).toHaveBeenCalledTimes(1);
    await expect(args.onPageChange).toHaveBeenLastCalledWith(6);
    await expect(currentPage(nav)).toEqual([[format.format(6), 'page']]);
  },
};

export const Keyboard: Story = {
  name: 'Navigate with Tab and Enter',
  parameters: { docs: { description: { story: 'Tab between enabled buttons and press Enter or Space to change page.' }, source: { language: 'tsx', code: paginationSource } } },
  args: { onPageChange: fn() },
  render: (args) => <ControlledPagination {...args} />,
  play: async ({ args, canvasElement }) => {
    const nav = getNav(canvasElement);
    const pages = within(nav);
    const expectFocus = async (name: string) => {
      const button = pages.getByRole('button', { name });
      await expect(button.ownerDocument.activeElement).toBe(button);
      await expect(getComputedStyle(button).outlineStyle).not.toBe('none');
      await expect(getComputedStyle(button).outlineWidth).not.toBe('0px');
    };

    // Every enabled button is a tab stop, in visual order; ellipses are skipped.
    for (const name of ['Previous page', '1', '4', '5', '6', '20', 'Next page']) {
      await userEvent.tab();
      await expectFocus(name);
    }
    await userEvent.tab();
    await expect(nav.contains(nav.ownerDocument.activeElement)).toBe(false);

    // Enter and Space each request once; focus stays on the activated button.
    await userEvent.tab({ shift: true });
    await userEvent.tab({ shift: true });
    await userEvent.tab({ shift: true });
    await expectFocus('6');
    await userEvent.keyboard('{Enter}');
    await expect(args.onPageChange).toHaveBeenCalledTimes(1);
    await expect(args.onPageChange).toHaveBeenLastCalledWith(6);
    await expectFocus('6');
    await expect(currentPage(nav)).toEqual([['6', 'page']]);
    await userEvent.tab({ shift: true });
    await expectFocus('5');
    await userEvent.keyboard('[Space]');
    await expect(args.onPageChange).toHaveBeenCalledTimes(2);
    await expect(args.onPageChange).toHaveBeenLastCalledWith(5);
    await expect(currentPage(nav)).toEqual([['5', 'page']]);
  },
};

export const PageRange: Story = {
  name: 'Wider page range',
  args: { page: 10, siblingCount: 2 },
  render: (args) => <ControlledPagination {...args} />,
  parameters: { docs: {
    description: { story: 'Show two neighbours on each side while ellipses stand for hidden pages.' },
    source: { language: 'tsx', code: `import { useState } from 'react';
import { Pagination } from '@jfrader/ui';

function ResultsPages() {
  const [page, setPage] = useState(10);
  return <Pagination page={page} totalPages={20} siblingCount={2} locale="en-US" onPageChange={setPage} />;
}` },
  } },
};

export const NarrowLayout: Story = {
  name: 'Narrow result footer',
  args: { siblingCount: 0, sx: { inlineSize: '16rem', maxInlineSize: '100%' } },
  render: (args) => <ControlledPagination {...args} />,
  parameters: { docs: {
    description: { story: 'Keep full-size controls in a narrow footer by omitting neighbouring pages.' },
    source: { language: 'tsx', code: `import { useState } from 'react';
import { Pagination } from '@jfrader/ui';

function ResultsPages() {
  const [page, setPage] = useState(5);
  return <Pagination page={page} totalPages={20} siblingCount={0} locale="en-US"
    onPageChange={setPage} sx={{ inlineSize: '16rem', maxInlineSize: '100%' }} />;
}` },
  } },
};

export const LongCounts: Story = {
  args: { page: 123456789, totalPages: 987654321, sx: { inlineSize: '16rem', maxInlineSize: '100%' } },
  render: (args) => <ControlledPagination {...args} />,
  play: async ({ canvasElement }) => {
    const nav = getNav(canvasElement);
    await expect(nav.scrollWidth).toBeLessThanOrEqual(nav.clientWidth);
    const buttons = within(nav).getAllByRole('button');
    for (const [index, button] of buttons.entries()) {
      await expectInside(button, nav);
      await expect(button.scrollWidth).toBeLessThanOrEqual(button.clientWidth);
      for (const other of buttons.slice(index + 1)) await expectNoOverlap(button, other);
    }
  },
};

export const TranslatedLabels: Story = {
  name: 'Translated navigation names',
  args: { locale: 'es-ES', label: 'Páginas de resultados', previousLabel: 'Página anterior', nextLabel: 'Página siguiente' },
  render: (args) => <ControlledPagination {...args} />,
  parameters: { docs: {
    description: { story: 'Name the navigation and its previous and next controls in Spanish.' },
    source: { language: 'tsx', code: `import { useState } from 'react';
import { Pagination } from '@jfrader/ui';

function ResultsPages() {
  const [page, setPage] = useState(5);
  return <Pagination page={page} totalPages={20} onPageChange={setPage} locale="es-ES"
    label="Páginas de resultados" previousLabel="Página anterior" nextLabel="Página siguiente" />;
}` },
  } },
};

export const ResultsCard: Story = {
  name: 'Pagination in a results card',
  render: (args) => (
    <Card title="Search results" content="100 matching projects" footer={<ControlledPagination {...args} label="Project result pages" />} />
  ),
  parameters: { docs: {
    description: { story: 'Place page navigation after a result summary in a card footer.' },
    source: { language: 'tsx', code: `import { useState } from 'react';
import { Card, Pagination } from '@jfrader/ui';

function ProjectResults() {
  const [page, setPage] = useState(5);
  return <Card title="Search results" content="100 matching projects" footer={
    <Pagination page={page} totalPages={20} locale="en-US" onPageChange={setPage} label="Project result pages" />
  } />;
}` },
  } },
};

export const LightTheme: Story = {
  decorators: [withLightTheme],
  play: async ({ canvasElement }) => {
    await expect(currentPage(getNav(canvasElement))).toEqual([['5', 'page']]);
  },
};

export const ExternalAria: Story = {
  render: (args) => (
    <div style={stackStyle}>
      <p id="pagination-heading">Search results</p>
      <Pagination {...args} aria-label="Results pages" />
      <Pagination {...args} aria-labelledby="pagination-heading" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const named = getNav(canvasElement, 'Results pages');
    await expect(named).toHaveAttribute('aria-label', 'Results pages');
    const labelled = getNav(canvasElement, 'Search results');
    await expect(labelled).toHaveAttribute('aria-labelledby', 'pagination-heading');
    await expect(labelled).not.toHaveAttribute('aria-label');
  },
};
