'use client';

import {
  useEffect,
  useLayoutEffect,
  useRef,
  type ComponentPropsWithRef,
  type ComponentType,
  type CSSProperties,
  type ReactNode,
} from 'react';
import {
  MotionConfig,
  animate,
  useMotionValue,
  useReducedMotion,
} from 'motion/react';
import { useMergeRefs } from '@floating-ui/react';
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type Theme } from '../../styling/css';
import { WithSx, type SxProps } from '../../styling/sx';
import { focusRingOutset } from '../../styling/focus-ring';
import { FORCED_COLORS } from '../../styling/media';
import { useControlledState } from '../../utils/use-controlled-state';
import { isRenderable } from '../../utils/renderable';
import { Button, type ButtonProps } from '../button';

export interface PageCurlPage {
  id: string;
  content: ReactNode;
  label?: string;
  /** Noninteractive fold artwork; page content is never mounted twice. */
  renderFold?: () => ReactNode;
}
export interface PageCurlLabels {
  previous: string;
  next: string;
  empty: string;
  pageCount: (
    indices: readonly number[],
    total: number,
    locale?: Intl.LocalesArgument,
  ) => string;
}
type PartProps = ComponentPropsWithRef<'div'> & { css?: Interpolation<Theme> };
type ActionProps = Omit<ButtonProps, 'sx'> & { css?: Interpolation<Theme> };
export interface PageCurlSlots {
  root?: ComponentType<ComponentPropsWithRef<'div'>>;
  book?: ComponentType<ComponentPropsWithRef<'div'>>;
  page?: ComponentType<ComponentPropsWithRef<'div'>>;
  fold?: ComponentType<ComponentPropsWithRef<'div'>>;
  controls?: ComponentType<ComponentPropsWithRef<'div'>>;
  previousButton?: ComponentType<ButtonProps>;
  nextButton?: ComponentType<ButtonProps>;
  status?: ComponentType<ComponentPropsWithRef<'div'>>;
  hint?: ComponentType<ComponentPropsWithRef<'div'>>;
}
export interface PageCurlSlotProps {
  root?: PartProps;
  book?: PartProps;
  page?: PartProps | ((page: PageCurlPage, index: number) => PartProps);
  fold?: PartProps;
  controls?: PartProps;
  previousButton?: ActionProps;
  nextButton?: ActionProps;
  status?: PartProps;
  hint?: PartProps;
}
export interface PageCurlProps
  extends
    Omit<
      ComponentPropsWithRef<'div'>,
      'children' | 'defaultValue' | 'onChange'
    >,
    SxProps {
  pages: readonly PageCurlPage[];
  value?: number;
  defaultValue?: number;
  onValueChange?: (spread: number) => void;
  /** Page inline/block ratio. Defaults to 0.72. */
  pageAspect?: number;
  label?: string;
  roleDescription?: string;
  hint?: ReactNode;
  labels?: Partial<PageCurlLabels>;
  locale?: Intl.LocalesArgument;
  component?: PageCurlSlots['root'];
  slots?: PageCurlSlots;
  slotProps?: PageCurlSlotProps;
}

const DEFAULT_ASPECT = 0.72;
const SPRING = { type: 'spring', stiffness: 280, damping: 34 } as const;
const FLICK_SPEED = 0.5;
const DRAG_THRESHOLD = 6;
const defaults: PageCurlLabels = {
  previous: 'Previous',
  next: 'Next',
  empty: 'No pages',
  pageCount: (indices, total, locale) => {
    const number = new Intl.NumberFormat(locale);
    return `${new Intl.ListFormat(locale, { type: 'conjunction' }).format(indices.map((index) => number.format(index)))} / ${number.format(total)}`;
  },
};
const rootStyle = css({
  display: 'grid',
  gap: vars.space[3],
  minInlineSize: 0,
  color: vars.color.text,
  fontFamily: vars.font.sans,
});
const bookStyle = css({
  position: 'relative',
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  minInlineSize: 0,
  '&:focus-visible': focusRingOutset,
});
const pageStyle = css({
  boxSizing: 'border-box',
  minInlineSize: 0,
  aspectRatio: 'var(--page-curl-aspect)',
  padding: vars.space[4],
  border: `1px solid ${vars.color.borderControl}`,
  background: vars.color.surfaceRaised,
  overflowWrap: 'anywhere',
  '&[data-side="start"]': { gridColumn: 1 },
  '&[data-side="end"]': { gridColumn: 2 },
  gridRow: 1,
});
const foldStyle = css({
  position: 'absolute',
  insetBlock: 0,
  insetInlineEnd: 0,
  inlineSize: '50%',
  pointerEvents: 'none',
  background: vars.color.surfaceRaised,
  border: `1px solid ${vars.color.borderControl}`,
  boxSizing: 'border-box',
  transformOrigin: 'left center',
  clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%)',
  '&:dir(rtl)': { transformOrigin: 'right center' },
  [FORCED_COLORS]: { background: 'Canvas', borderColor: 'CanvasText' },
});
const controlsStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'center',
  gap: vars.space[3],
});
const hintStyle = css({
  color: vars.color.textMuted,
  fontSize: vars.textSize.sm,
});
const nextStyle = css({ touchAction: 'pan-y' });
const clamp = (value: number, max: number) =>
  Math.max(0, Math.min(max, Number.isFinite(value) ? Math.trunc(value) : 0));

/** Turn short editorial sequences with persistent native previous/next controls. */
export function PageCurl({
  ref,
  pages,
  value,
  defaultValue = 0,
  onValueChange,
  pageAspect = DEFAULT_ASPECT,
  label = 'Book',
  roleDescription = 'book',
  hint = null,
  labels,
  locale,
  component,
  slots,
  slotProps,
  sx,
  className,
  style,
  ...props
}: PageCurlProps) {
  const [accepted, request] = useControlledState<number>(
    value,
    defaultValue,
    onValueChange,
  );
  const max = Math.floor(pages.length / 2);
  const current = clamp(accepted ?? 0, max);
  const copy = { ...defaults, ...labels };
  const reduced = useReducedMotion();
  const book = useRef<HTMLDivElement>(null);
  const progress = useMotionValue(0);
  const fold = useRef<HTMLDivElement>(null);
  const gesture = useRef<{
    x: number;
    lastX: number;
    time: number;
    velocity: number;
    pointer: number;
    target: HTMLElement;
  } | null>(null);
  const animation = useRef<ReturnType<typeof animate> | null>(null);
  const suppressClick = useRef(false);
  const rootRef = useMergeRefs([ref, slotProps?.root?.ref]);
  const bookRef = useMergeRefs([book, slotProps?.book?.ref]);
  const foldRef = useMergeRefs([fold, slotProps?.fold?.ref]);
  const Root = slots?.root ?? component ?? 'div';
  const Book = slots?.book ?? 'div';
  const Page = slots?.page ?? 'div';
  const Fold = slots?.fold ?? 'div';
  const Controls = slots?.controls ?? 'div';
  const Previous = slots?.previousButton ?? Button;
  const Next = slots?.nextButton ?? Button;
  const Status = slots?.status ?? 'div';
  const Hint = slots?.hint ?? 'div';
  const visible =
    current === 0
      ? [0]
      : [current * 2 - 1, current * 2].filter((index) => index < pages.length);
  const count = pages.length
    ? copy.pageCount(
        visible.map((index) => index + 1),
        pages.length,
        locale,
      )
    : copy.empty;
  function cancel() {
    const active = gesture.current;
    if (active) suppressClick.current = true;
    gesture.current = null;
    if (active?.target.hasPointerCapture(active.pointer))
      active.target.releasePointerCapture(active.pointer);
    animation.current?.stop();
    progress.set(0);
  }
  function turn(target: number) {
    const next = clamp(target, max);
    if (next === current) return;
    const active = book.current?.ownerDocument.activeElement;
    if (
      active &&
      book.current?.querySelector('[data-ui="page-curl-page"]') &&
      visible.some((index) =>
        book.current
          ?.querySelector(`[data-page-index="${index}"]`)
          ?.contains(active),
      )
    )
      book.current?.focus();
    request(next);
  }
  useLayoutEffect(() => {
    cancel();
  }, [current, pages]);
  useEffect(() => {
    const unsubscribe = progress.on('change', (amount) => {
      if (!fold.current) return;
      fold.current.style.visibility = amount === 0 ? 'hidden' : 'visible';
      const rtl = book.current?.matches(':dir(rtl)');
      fold.current.style.transform = `perspective(1000px) rotateY(${amount * (rtl ? 150 : -150)}deg)`;
      fold.current.style.clipPath = `polygon(${amount * 40}% 0, 100% ${amount * 25}%, 100% 100%, 0 100%)`;
    });
    return () => {
      unsubscribe();
      animation.current?.stop();
    };
  }, [progress]);
  useLayoutEffect(() => {
    return () => {
      const active = book.current?.ownerDocument.activeElement;
      if (
        active &&
        Array.from(
          book.current?.querySelectorAll('[data-ui="page-curl-page"]') ?? [],
        ).some((page) => page.contains(active))
      )
        book.current?.focus();
    };
  }, [pages, current]);
  const root = slotProps?.root;
  return (
    <MotionConfig reducedMotion="user">
      <WithSx
        className={[className, root?.className].filter(Boolean).join(' ')}
        styles={[rootStyle, root?.css]}
        sx={sx}
      >
        {(resolved) => (
          <Root
            {...props}
            {...root}
            ref={rootRef}
            className={resolved}
            style={
              {
                ...style,
                ...root?.style,
                '--page-curl-aspect':
                  Number.isFinite(pageAspect) && pageAspect > 0
                    ? pageAspect
                    : DEFAULT_ASPECT,
              } as CSSProperties
            }
            data-ui="page-curl"
          >
            <Book
              {...slotProps?.book}
              ref={bookRef}
              css={[bookStyle, slotProps?.book?.css]}
              role="group"
              tabIndex={0}
              aria-label={label}
              aria-roledescription={roleDescription}
              data-ui="page-curl-book"
              onKeyDown={(event) => {
                slotProps?.book?.onKeyDown?.(event);
                if (event.defaultPrevented) return;
                if (event.key === 'Escape' && gesture.current) {
                  event.preventDefault();
                  cancel();
                  return;
                }
                if (
                  event.target !== event.currentTarget ||
                  event.altKey ||
                  event.ctrlKey ||
                  event.metaKey
                )
                  return;
                const rtl = event.currentTarget.matches(':dir(rtl)');
                const targets: Record<string, number> = {
                  Home: 0,
                  End: max,
                  PageDown: current + 1,
                  PageUp: current - 1,
                  ArrowRight: current + (rtl ? -1 : 1),
                  ArrowLeft: current + (rtl ? 1 : -1),
                };
                if (event.key in targets) {
                  event.preventDefault();
                  turn(targets[event.key]!);
                }
              }}
            >
              {visible
                .filter((index) => pages[index])
                .map((index) => {
                  const page = pages[index]!;
                  const part =
                    typeof slotProps?.page === 'function'
                      ? slotProps.page(page, index)
                      : slotProps?.page;
                  return (
                    <Page
                      {...part}
                      key={page.id}
                      css={[pageStyle, part?.css]}
                      data-ui="page-curl-page"
                      data-page-index={index}
                      data-side={
                        index === 0 || index % 2 === 0 ? 'end' : 'start'
                      }
                      role={page.label ? 'group' : undefined}
                      aria-label={page.label}
                    >
                      {page.content}
                    </Page>
                  );
                })}
              {!reduced && (
                <Fold
                  {...slotProps?.fold}
                  ref={foldRef}
                  css={[foldStyle, slotProps?.fold?.css]}
                  style={{ ...slotProps?.fold?.style, visibility: 'hidden' }}
                  inert
                  aria-hidden="true"
                  data-ui="page-curl-fold"
                >
                  {pages[visible.at(-1) ?? 0]?.renderFold?.()}
                </Fold>
              )}
            </Book>
            <Controls
              {...slotProps?.controls}
              css={[controlsStyle, slotProps?.controls?.css]}
              data-ui="page-curl-controls"
            >
              <Previous
                {...slotProps?.previousButton}
                css={slotProps?.previousButton?.css}
                type="button"
                disabled={current === 0 || !pages.length}
                data-ui="page-curl-previous"
                onClick={(event) => {
                  slotProps?.previousButton?.onClick?.(event);
                  if (!event.defaultPrevented) {
                    cancel();
                    turn(current - 1);
                  }
                }}
              >
                {copy.previous}
              </Previous>
              <Status
                {...slotProps?.status}
                role="status"
                aria-atomic="true"
                data-ui="page-curl-status"
              >
                {count}
              </Status>
              <Next
                {...slotProps?.nextButton}
                css={[nextStyle, slotProps?.nextButton?.css]}
                type="button"
                disabled={current === max || !pages.length}
                data-ui="page-curl-next"
                onClick={(event) => {
                  if (suppressClick.current) {
                    suppressClick.current = false;
                    event.preventDefault();
                    return;
                  }
                  slotProps?.nextButton?.onClick?.(event);
                  if (!event.defaultPrevented) {
                    cancel();
                    turn(current + 1);
                  }
                }}
                onPointerDown={(event) => {
                  slotProps?.nextButton?.onPointerDown?.(event);
                  if (event.defaultPrevented || reduced || event.button !== 0)
                    return;
                  cancel();
                  suppressClick.current = false;
                  event.currentTarget.setPointerCapture(event.pointerId);
                  gesture.current = {
                    x: event.clientX,
                    lastX: event.clientX,
                    time: event.timeStamp,
                    velocity: 0,
                    pointer: event.pointerId,
                    target: event.currentTarget,
                  };
                }}
                onPointerMove={(event) => {
                  slotProps?.nextButton?.onPointerMove?.(event);
                  const active = gesture.current;
                  if (
                    !active ||
                    active.pointer !== event.pointerId ||
                    event.defaultPrevented
                  )
                    return;
                  const direction = event.currentTarget.matches(':dir(rtl)')
                    ? 1
                    : -1;
                  active.velocity =
                    (direction * (event.clientX - active.lastX)) /
                    Math.max(1, event.timeStamp - active.time);
                  active.lastX = event.clientX;
                  active.time = event.timeStamp;
                  progress.set(
                    Math.max(
                      0,
                      Math.min(
                        1,
                        (direction * (event.clientX - active.x)) /
                          Math.max(1, (book.current?.clientWidth ?? 1) / 2),
                      ),
                    ),
                  );
                }}
                onPointerUp={(event) => {
                  slotProps?.nextButton?.onPointerUp?.(event);
                  const active = gesture.current;
                  if (!active) return;
                  const moved =
                    Math.abs(event.clientX - active.x) > DRAG_THRESHOLD;
                  const complete =
                    progress.get() > 0.5 || active.velocity > FLICK_SPEED;
                  gesture.current = null;
                  if (event.currentTarget.hasPointerCapture(event.pointerId))
                    event.currentTarget.releasePointerCapture(event.pointerId);
                  if (moved) {
                    suppressClick.current = true;
                    if (complete && !event.defaultPrevented) turn(current + 1);
                  }
                  animation.current = animate(progress, 0, SPRING);
                }}
                onPointerCancel={(event) => {
                  slotProps?.nextButton?.onPointerCancel?.(event);
                  cancel();
                }}
                onLostPointerCapture={(event) => {
                  slotProps?.nextButton?.onLostPointerCapture?.(event);
                  if (gesture.current) cancel();
                }}
              >
                {copy.next}
              </Next>
            </Controls>
            {isRenderable(hint) && (
              <Hint
                {...slotProps?.hint}
                css={[hintStyle, slotProps?.hint?.css]}
                data-ui="page-curl-hint"
              >
                {hint}
              </Hint>
            )}
          </Root>
        )}
      </WithSx>
    </MotionConfig>
  );
}
PageCurl.displayName = 'PageCurl';
