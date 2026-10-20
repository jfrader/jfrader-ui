// Pattern: a labelled <nav> landmark around a list of native buttons (no APG composite widget,
// so no roving tabindex: every enabled button is a Tab stop; Enter/Space activate natively).
// The current page button carries aria-current="page". Previous/Next use the native `disabled`
// attribute at the boundaries; when a step lands on a boundary and disables the focused button,
// focus moves to the current page button. Their arrow glyphs are aria-hidden and mirror under
// RTL; the accessible name comes from visually hidden text.
// Windowing keeps a constant item count once pages overflow: first, last, the current page with
// `siblingCount` neighbours each side, and an ellipsis only where it hides two or more pages.
// `page` is controlled: activating a page requests it through onPageChange and the component
// only moves when the parent updates `page`. Requests for the current page are not changes.
import { useImperativeHandle, useLayoutEffect, useMemo, useRef, type ComponentPropsWithRef } from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { focusRingOutset } from '../../styling/focus-ring';
import { REDUCED_MOTION } from '../../styling/media';
import { WithSx, type SxProps } from '../../styling/sx';
import { visuallyHiddenStyle } from '../../styling/visually-hidden';
import { defaultLocale, numberFormatter } from '../../utils/intl';

export interface PaginationProps extends Omit<ComponentPropsWithRef<'nav'>, 'onChange'>, SxProps {
  /** Control the one-based current page; clamped to the available page range. */
  page: number;
  /** Set the number of pages; non-finite or negative values become 0 and fractions round down. */
  totalPages: number;
  /** Receive a requested one-based page different from the current page. */
  onPageChange?: (page: number) => void;
  /** Pages shown on each side of the current page. */
  siblingCount?: number;
  /** Accessible name of the navigation landmark. */
  label?: string;
  /** Name the previous-page button. Defaults to `Previous page`. */
  previousLabel?: string;
  /** Name the next-page button. Defaults to `Next page`. */
  nextLabel?: string;
  /** Format page numbers with this locale. Defaults to the environment locale. */
  locale?: string;
}

type PageItem = number | 'start-ellipsis' | 'end-ellipsis';

const MAX_SIBLING_COUNT = 50;
const MAX_PAGE_ITEMS = MAX_SIBLING_COUNT * 2 + 5;
const normalizeCount = (value: number) => Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));

const range = (start: number, end: number) =>
  Array.from({ length: Math.min(MAX_PAGE_ITEMS, Math.max(0, end - start + 1)) }, (_, index) => start + index);

function getPageItems(page: number, totalPages: number, siblingCount: number): PageItem[] {
  // first + last + current + two ellipses, plus siblings on both sides.
  const slots = siblingCount * 2 + 5;
  if (totalPages <= slots) return range(1, totalPages);

  const leftSibling = Math.max(page - siblingCount, 1);
  const rightSibling = Math.min(page + siblingCount, totalPages);
  // An ellipsis only replaces two or more pages; otherwise the edge run is shown in full.
  const showStartEllipsis = leftSibling > 3;
  const showEndEllipsis = rightSibling < totalPages - 2;
  const edgeRun = slots - 2;

  if (!showStartEllipsis) return [...range(1, edgeRun), 'end-ellipsis', totalPages];
  if (!showEndEllipsis) return [1, 'start-ellipsis', ...range(totalPages - edgeRun + 1, totalPages)];
  return [1, 'start-ellipsis', ...range(leftSibling, rightSibling), 'end-ellipsis', totalPages];
}

const listStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: vars.space[1],
  margin: 0,
  padding: 0,
  listStyle: 'none',
  fontFamily: vars.font.sans,
  fontSize: vars.textSize.sm,
  lineHeight: vars.lineHeight.tight,
});

const cellStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minInlineSize: '32px',
  blockSize: '32px',
});

const buttonStyle = css({
  position: 'relative',
  appearance: 'none',
  paddingInline: vars.space[2],
  border: '1px solid transparent',
  borderRadius: vars.radius.md,
  background: 'transparent',
  color: vars.color.text,
  font: 'inherit',
  fontVariantNumeric: 'tabular-nums',
  cursor: 'pointer',
  transitionProperty: 'background-color, border-color, color',
  transitionDuration: vars.motion.duration.fast,
  transitionTimingFunction: vars.motion.easeStandard,
  '&:hover:not(:disabled):not([aria-current="page"])': {
    backgroundColor: vars.color.surfaceHover,
  },
  '&[aria-current="page"]': {
    backgroundColor: vars.color.accentSoft,
    borderColor: vars.color.accentBorder,
    color: vars.color.accentText,
    fontWeight: vars.fontWeight.semibold,
  },
  '&:disabled': {
    cursor: 'not-allowed',
    opacity: 0.55,
  },
  '&:focus-visible': {
    ...focusRingOutset,
  },
  [REDUCED_MOTION]: {
    transitionDuration: '0s',
  },
});

const ellipsisStyle = css({
  color: vars.color.textMuted,
});

const glyphStyle = css({
  display: 'inline-block',
  '&:dir(rtl)': {
    transform: 'scaleX(-1)',
  },
});

export function Pagination({
  ref,
  page,
  totalPages,
  onPageChange,
  siblingCount = 1,
  label = 'Pagination',
  previousLabel = 'Previous page',
  nextLabel = 'Next page',
  locale = defaultLocale(),
  className,
  sx,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  ...rest
}: PaginationProps) {
  const lastPage = normalizeCount(totalPages);
  const current = Math.min(Math.max(normalizeCount(page), 1), Math.max(lastPage, 1));
  const items = getPageItems(current, lastPage, Math.min(normalizeCount(siblingCount), MAX_SIBLING_COUNT));
  const numberFormat = useMemo(() => numberFormatter(locale), [locale]);

  const navRef = useRef<HTMLElement>(null);
  useImperativeHandle(ref, () => navRef.current as HTMLElement, []);
  // Set when Previous/Next requests a boundary page: that button becomes disabled once the
  // parent commits it, so focus moves to the current page instead of falling to the body.
  const boundaryRequestRef = useRef(false);

  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!boundaryRequestRef.current || !nav) return;
    boundaryRequestRef.current = false;
    const active = nav.ownerDocument.activeElement;
    if (active === nav.ownerDocument.body || (active && nav.contains(active) && active.matches(':disabled'))) {
      nav.querySelector<HTMLButtonElement>('[aria-current="page"]')?.focus();
    }
  }, [current]);

  const requestPage = (next: number, fromStep = false) => {
    boundaryRequestRef.current = fromStep && (next <= 1 || next >= lastPage);
    if (next !== current) onPageChange?.(next);
  };

  return (
    <WithSx className={className} sx={sx}>
      {(className) => (
        <nav
          {...rest}
          ref={navRef}
          aria-label={ariaLabel ?? (ariaLabelledBy === undefined ? label : undefined)}
          aria-labelledby={ariaLabelledBy}
          data-ui="pagination"
          className={className}
        >
          <ul css={listStyle}>
            <li>
              <button
                type="button"
                disabled={current <= 1}
                onClick={() => requestPage(current - 1, true)}
                data-ui="pagination-previous"
                css={[cellStyle, buttonStyle]}
              >
                <span aria-hidden="true" css={glyphStyle}>
                  ‹
                </span>
                <span css={visuallyHiddenStyle}>{previousLabel}</span>
              </button>
            </li>
            {items.map((item) =>
              typeof item === 'number' ? (
                <li key={item}>
                  <button
                    type="button"
                    aria-current={item === current ? 'page' : undefined}
                    aria-label={numberFormat.format(item)}
                    onClick={() => requestPage(item)}
                    data-ui="pagination-page"
                    css={[cellStyle, buttonStyle]}
                  >
                    {numberFormat.format(item)}
                  </button>
                </li>
              ) : (
                <li key={item}>
                  <span aria-hidden="true" data-ui="pagination-ellipsis" css={[cellStyle, ellipsisStyle]}>
                    …
                  </span>
                </li>
              ),
            )}
            <li>
              <button
                type="button"
                disabled={current >= lastPage}
                onClick={() => requestPage(current + 1, true)}
                data-ui="pagination-next"
                css={[cellStyle, buttonStyle]}
              >
                <span aria-hidden="true" css={glyphStyle}>
                  ›
                </span>
                <span css={visuallyHiddenStyle}>{nextLabel}</span>
              </button>
            </li>
          </ul>
        </nav>
      )}
    </WithSx>
  );
}

Pagination.displayName = 'Pagination';
