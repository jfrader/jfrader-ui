import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { withLightTheme } from '../../testing/story-decorators';
import { Pagination, type PaginationProps } from './index';

const stackStyle = css({
  display: 'grid',
  justifyItems: 'start',
  gap: vars.space[4],
});

const meta = {
  title: 'Navigation/Pagination',
  component: Pagination,
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
  args: { onPageChange: fn() },
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
    <div css={stackStyle}>
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
  args: { onPageChange: fn() },
  render: (args) => (
    <div css={stackStyle}>
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
  render: () => (
    <div css={stackStyle}>
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
    <div css={stackStyle}>
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

export const LightTheme: Story = {
  decorators: [withLightTheme],
  play: async ({ canvasElement }) => {
    await expect(currentPage(getNav(canvasElement))).toEqual([['5', 'page']]);
  },
};
