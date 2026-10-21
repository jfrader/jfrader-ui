'use client';

// APG disclosure: Enter/Space toggle the native trigger; Tab follows document order.
// Escape requests collapse. Focus repair happens only after an accepted state change.
import {
  createContext,
  useContext,
  useId,
  useMemo,
  useRef,
  useState,
  useEffect,
  useLayoutEffect,
  type ComponentPropsWithRef,
  type ComponentType,
  type ReactNode,
  type RefObject,
} from 'react';
import { useMergeRefs } from '@floating-ui/react';
import { MotionConfig, animate, useMotionValue, useReducedMotion } from 'motion/react';
import { vars } from '@jfrader/tokens/vars';
import { base } from '@jfrader/tokens';
import { css } from '../../styling/css';
import { WithSx, type SxProps } from '../../styling/sx';
import { raisedSurface } from '../../styling/surface';
import { disclosureCaret } from '../../styling/disclosure-caret';
import { focusRingInset } from '../../styling/focus-ring';
import { REDUCED_MOTION, FORCED_COLORS } from '../../styling/media';
import { useControlledState } from '../../utils/use-controlled-state';
import { isRenderable } from '../../utils/renderable';

export interface ExpandableCardBaseProps
  extends Omit<ComponentPropsWithRef<'article'>, 'defaultValue' | 'onChange' | 'children' | 'title' | 'content'>, SxProps {
  /** Controls whether the details panel is expanded. */
  open?: boolean;
  /** Expands the uncontrolled card initially. Defaults to `false`. */
  defaultOpen?: boolean;
  /** Called when the trigger or Escape requests expansion or collapse. */
  onOpenChange?: (open: boolean) => void;
  /** Caps collapsed width in pixels, limited by available space; omitted, non-positive or non-finite values use available width. */
  collapsedInlineSize?: number;
  /** Caps expanded width in pixels, limited by available space; omitted, non-positive or non-finite values fall back to `collapsedInlineSize`. */
  expandedInlineSize?: number;
  /** Sets header and details padding and header height. Defaults to `md`. */
  size?: 'sm' | 'md';
  /** Disables the expansion trigger without forcing collapse. Defaults to `false`. */
  disabled?: boolean;
  /** Sets the heading level wrapping the trigger. Defaults to 3. */
  headingLevel?: 2 | 3 | 4;
}
export interface ExpandableCardSlots {
  /** Replaces the root card container; renders an `article` by default. */
  root?: ComponentType<ComponentPropsWithRef<'article'>>;
  /** Replaces the interactive header button that toggles expansion. */
  trigger?: ComponentType<ComponentPropsWithRef<'button'>>;
  /** Replaces the card heading title element. */
  title?: ComponentType<ComponentPropsWithRef<'span'>>;
  /** Replaces the card subheading description element. */
  description?: ComponentType<ComponentPropsWithRef<'span'>>;
  /** Replaces the expandable body panel containing card details. */
  content?: ComponentType<ComponentPropsWithRef<'div'>>;
}
export interface ExpandableCardSlotProps {
  /** Root card container element. */
  root?: Omit<ComponentPropsWithRef<'article'>, 'children'> & SxProps & {

    [attribute: `data-${string}`]: unknown;
  };
  /** Interactive header button that toggles expansion. */
  trigger?: Omit<ExpandableCardTriggerProps, 'children'>;
  /** Card heading title element. */
  title?: Omit<ExpandableCardTitleProps, 'children'>;
  /** Card subheading description element. */
  description?: Omit<ExpandableCardDescriptionProps, 'children'>;
  /** Expandable body panel containing card details. */
  content?: Omit<ExpandableCardContentProps, 'children'>;
}
export interface ExpandableCardComposedProps extends ExpandableCardBaseProps {
  /** Composes the trigger, title, description and content parts instead of using `content`. */
  children?: ReactNode;
  title?: string;
  description?: never;
  content?: never;
  component?: never;
  slots?: never;
  slotProps?: never;
}
export interface ExpandableCardShorthandProps extends ExpandableCardBaseProps {
  /** Renders the heading text inside the generated expansion trigger. */
  title: ReactNode;
  /** Renders secondary text inside the trigger and describes the details region. */
  description?: ReactNode;
  /** Renders details inside the expandable panel. */
  content: ReactNode;
  children?: never;
  /** Replaces the root article; takes precedence over `slots.root`. */
  component?: ExpandableCardSlots['root'];
  /** Replaces the generated root, trigger, title, description or content panel. */
  slots?: ExpandableCardSlots;
  /** Passes props to the generated root, trigger, title, description and content panel. */
  slotProps?: ExpandableCardSlotProps;
}
export type ExpandableCardProps = ExpandableCardComposedProps | ExpandableCardShorthandProps;
export type ExpandableCardTriggerProps = ComponentPropsWithRef<'button'> & SxProps;
export type ExpandableCardTitleProps = ComponentPropsWithRef<'span'> & SxProps;
export type ExpandableCardDescriptionProps = ComponentPropsWithRef<'span'> & SxProps;
export type ExpandableCardContentProps = Omit<ComponentPropsWithRef<'div'>, 'hidden'> & SxProps;

interface CardContext {
  slots?: ExpandableCardSlots;
  open: boolean;
  request: (open: boolean) => void;
  disabled: boolean;
  headingLevel: 2 | 3 | 4;
  triggerId: string;
  titleId: string;
  descriptionId: string;
  panelId: string;
  hasTitle: boolean;
  hasDescription: boolean;
  setHasTitle: (present: boolean) => void;
  setHasDescription: (present: boolean) => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
  expandedWidth: number | undefined;
}
const Context = createContext<CardContext | null>(null);
function useCard(part: string) {
  const value = useContext(Context);
  if (!value) throw new Error(`ExpandableCard.${part} must be rendered inside <ExpandableCard>.`);
  return value;
}
const GEOMETRY_SPRING = {
  type: 'spring',
  stiffness: 400,
  damping: 40,
  mass: 1,
} as const;
/** `motion.easeStandard` (tokens.ts) as cubic-bezier numbers; `motion` cannot consume the CSS string. */
const EASE_STANDARD = [0.2, 0.6, 0.2, 1] as const;
const DETAIL_FADE = {
  duration: Number.parseFloat(base.motion.duration.fast) / 1000, // e.g. '120ms' -> 0.12s
  ease: EASE_STANDARD,
} as const;
const rootStyle = css({
  ...raisedSurface,
  borderColor: vars.color.borderControl,
  borderRadius: vars.radius.lg,
  boxShadow: vars.shadow.raised,
  minInlineSize: 0,
  maxInlineSize: '100%',
  marginInline: 'auto',
  overflow: 'clip',
});
const trackStyle = css({ inlineSize: '100%', minInlineSize: 0 });
const headingStyle = css({ margin: 0, font: 'inherit' });
const triggerStyle = css({
  appearance: 'none',
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  alignItems: 'center',
  gap: vars.space[2],
  inlineSize: '100%',
  boxSizing: 'border-box',
  minBlockSize: `calc(${vars.space[12]} + ${vars.space[4]})`,
  padding: vars.space[4],
  border: 0,
  background: 'transparent',
  color: 'inherit',
  font: 'inherit',
  textAlign: 'start',
  cursor: 'pointer',
  '& > span': { gridColumn: 1, overflowWrap: 'anywhere' },
  '&::after': { ...disclosureCaret, gridColumn: 2, gridRow: '1 / span 2' },
  '&[aria-expanded="true"]::after': { transform: 'rotate(90deg)' },
  '&[aria-expanded="true"]:dir(rtl)::after': { transform: 'rotate(-90deg)' },
  '&:focus-visible': focusRingInset,
  '&:hover:not(:disabled)': { backgroundColor: vars.color.surfaceHover },
  '&:disabled': { cursor: 'not-allowed', opacity: 0.55 },
  '[data-size="sm"] &': {
    minBlockSize: vars.space[12],
    padding: vars.space[3],
  },
  [REDUCED_MOTION]: { '&::after': { transitionDuration: '0s' } },
  [FORCED_COLORS]: {
    '&:focus-visible': { outlineColor: 'Highlight' },
    '&::after': {
      forcedColorAdjust: 'none',
      borderInlineStartColor: 'ButtonText',
    },
    '&:disabled::after': { borderInlineStartColor: 'GrayText' },
  },
});
const titleStyle = css({
  fontSize: vars.textSize.md,
  fontWeight: vars.fontWeight.medium,
});
const descriptionStyle = css({
  fontSize: vars.textSize.sm,
  color: vars.color.textMuted,
});
const contentStyle = css({
  overflow: 'clip',
  minInlineSize: 0,
  '&[hidden]': { display: 'none' },
});
const innerStyle = css({
  boxSizing: 'border-box',
  maxInlineSize: 'none',
  padding: vars.space[4],
  borderBlockStart: `1px solid ${vars.color.border}`,
  fontSize: vars.textSize.sm,
  overflowWrap: 'anywhere',
  // Intrinsically sized details (form controls, media) shrink to the available inline size instead
  // of overflowing the clipped panel; zero specificity so consumer styles still win.
  '& :where(input, select, textarea, img, video, canvas, svg, iframe)': {
    maxInlineSize: '100%',
    boxSizing: 'border-box',
  },
  '[data-size="sm"] &': { padding: vars.space[3] },
});
function validCap(value: number | undefined) {
  return value !== undefined && Number.isFinite(value) && value > 0 ? value : undefined;
}
function ids(...values: (string | false | undefined)[]) {
  return values.filter(Boolean).join(' ') || undefined;
}

function ExpandableCardRoot(props: ExpandableCardProps) {
  const {
    ref,
    open: openProp,
    defaultOpen = false,
    onOpenChange,
    collapsedInlineSize,
    expandedInlineSize,
    size = 'md',
    disabled = false,
    headingLevel = 3,
    className,
    sx,
    onKeyDown,
    children,
    title,
    description,
    content,
    component,
    slots,
    slotProps,
    ...rest
  } = props;
  const shorthand = 'content' in props;
  const Root = component ?? slots?.root ?? 'article';
  const { className: slotClassName, style: slotStyle, sx: slotSx, ...rootProps } = slotProps?.root ?? {};
  const marker = typeof rootProps['data-ui'] === 'string' ? rootProps['data-ui'] : '';
  const rootDataUi = [...new Set(['expandable-card', ...marker.split(/\s+/)])].filter(Boolean).join(' ');
  const [state, request] = useControlledState(openProp, defaultOpen, onOpenChange);
  const open = Boolean(state);
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const articleRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const mergedRef = useMergeRefs([articleRef, ref, rootProps.ref]);
  const [hasTitle, setHasTitle] = useState(false);
  const [hasDescription, setHasDescription] = useState(false);
  const [room, setRoom] = useState<number>();
  const [inlineInset, setInlineInset] = useState(0);
  const reduced = useReducedMotion();
  const width = useMotionValue(0);
  const initialized = useRef(false);
  const collapsed = validCap(collapsedInlineSize);
  const expanded = validCap(expandedInlineSize) ?? collapsed;
  const targetWidth = room === undefined ? undefined : Math.min(room, (open ? expanded : collapsed) ?? room);
  const expandedWidth =
    room === undefined ? undefined : Math.max(0, Math.min(room, expanded ?? room) - inlineInset);
  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const measure = () => {
      setRoom(track.getBoundingClientRect().width);
      const article = articleRef.current;
      if (!article) return;
      const style = getComputedStyle(article);
      setInlineInset(
        Number.parseFloat(style.borderInlineStartWidth) +
          Number.parseFloat(style.borderInlineEndWidth) +
          Number.parseFloat(style.paddingInlineStart) +
          Number.parseFloat(style.paddingInlineEnd),
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(track);
    return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => {
    const article = articleRef.current;
    if (!article || targetWidth === undefined) return;
    const write = (value: number) => {
      article.style.inlineSize = `${value}px`;
    };
    const unsubscribe = width.on('change', write);
    if (!initialized.current || reduced) {
      width.jump(targetWidth);
      write(targetWidth);
      initialized.current = true;
    } else animate(width, targetWidth, GEOMETRY_SPRING);
    return () => {
      unsubscribe();
      width.stop();
    };
  }, [targetWidth, reduced, width]);
  const context = useMemo(
    () => ({
      open,
      request,
      disabled,
      headingLevel,
      triggerId: `${id}-trigger`,
      panelId: `${id}-panel`,
      titleId: `${id}-title`,
      descriptionId: `${id}-description`,
      hasTitle,
      hasDescription,
      setHasTitle,
      setHasDescription,
      triggerRef,
      expandedWidth,
      slots,
    }),
    [open, request, disabled, headingLevel, id, hasTitle, hasDescription, expandedWidth, slots],
  );
  return (
    <MotionConfig reducedMotion="user">
      <Context.Provider value={context}>
        <div ref={trackRef} css={trackStyle}>
          <WithSx className={[slotClassName, className].filter(Boolean).join(' ')} styles={[rootStyle, slotSx]} sx={sx}>
            {(className) => (
              <Root
                {...rest}
                {...rootProps}
                ref={mergedRef}
                title={rootProps.title ?? (!shorthand && typeof title === 'string' ? title : undefined)}
                style={{ ...rest.style, ...slotStyle }}
                data-ui={rootDataUi}
                data-size={size}
                data-state={open ? 'open' : 'closed'}
                className={className}
                onKeyDown={(event) => {
                  (rootProps.onKeyDown ?? onKeyDown)?.(event);
                  if (event.defaultPrevented || event.key !== 'Escape' || !open) return;
                  const target = event.target as Element;
                  const layer = target.closest('dialog, [role="dialog"], [role="menu"], [role="listbox"]');
                  if (
                    target.closest('[data-ui~="expandable-card"]') !== event.currentTarget ||
                    (layer && event.currentTarget.contains(layer))
                  )
                    return;
                  event.preventDefault();
                  request(false);
                }}
              >
                {shorthand ? (
                  <>
                    <ExpandableCardTrigger {...slotProps?.trigger}>
                      <ExpandableCardTitle {...slotProps?.title}>{title}</ExpandableCardTitle>
                      {isRenderable(description) && (
                        <ExpandableCardDescription {...slotProps?.description}>{description}</ExpandableCardDescription>
                      )}
                    </ExpandableCardTrigger>
                    <ExpandableCardContent {...slotProps?.content}>{content}</ExpandableCardContent>
                  </>
                ) : children}
              </Root>
            )}
          </WithSx>
        </div>
      </Context.Provider>
    </MotionConfig>
  );
}
ExpandableCardRoot.displayName = 'ExpandableCard';

function ExpandableCardTrigger({
  ref,
  className,
  sx,
  onClick,
  disabled,
  'aria-labelledby': labelledBy,
  'aria-describedby': describedBy,
  ...rest
}: ExpandableCardTriggerProps) {
  const c = useCard('Trigger');
  const Root = c.slots?.trigger ?? 'button';
  const mergedRef = useMergeRefs([c.triggerRef, ref]);
  const Heading = `h${c.headingLevel}` as const;
  return (
    // The heading mirrors the trigger name: with a falsy Title the heading would otherwise be
    // empty and fail the axe `empty-heading` gate (verified in the Falsy Nodes story).
    <Heading css={headingStyle} aria-labelledby={c.triggerId}>
      <WithSx className={className} styles={triggerStyle} sx={sx}>
        {(className) => (
          <Root
            {...rest}
            ref={mergedRef}
            type="button"
            id={c.triggerId}
            data-ui="expandable-card-trigger"
            className={className}
            disabled={c.disabled || disabled}
            aria-expanded={c.open}
            aria-controls={c.panelId}
            aria-labelledby={ids(labelledBy, c.hasTitle && c.titleId, c.hasDescription && c.descriptionId)}
            aria-describedby={ids(describedBy)}
            onClick={(event) => {
              onClick?.(event);
              if (!event.defaultPrevented) c.request(!c.open);
            }}
          />
        )}
      </WithSx>
    </Heading>
  );
}
ExpandableCardTrigger.displayName = 'ExpandableCard.Trigger';

function ExpandableCardTitle({ ref, className, sx, children, ...rest }: ExpandableCardTitleProps) {
  const { titleId, setHasTitle, slots } = useCard('Title');
  const Root = slots?.title ?? 'span';
  const present = isRenderable(children);
  useEffect(() => {
    setHasTitle(present);
    return () => setHasTitle(false);
  }, [present, setHasTitle]);
  if (!present) return null;
  return (
    <WithSx className={className} styles={titleStyle} sx={sx}>
      {(className) => (
        <Root {...rest} ref={ref} id={titleId} className={className} data-ui="expandable-card-title">
          {children}
        </Root>
      )}
    </WithSx>
  );
}
ExpandableCardTitle.displayName = 'ExpandableCard.Title';
function ExpandableCardDescription({
  ref,
  className,
  sx,
  children,
  ...rest
}: ExpandableCardDescriptionProps) {
  const { descriptionId, setHasDescription, slots } = useCard('Description');
  const Root = slots?.description ?? 'span';
  const present = isRenderable(children);
  useEffect(() => {
    setHasDescription(present);
    return () => setHasDescription(false);
  }, [present, setHasDescription]);
  if (!present) return null;
  return (
    <WithSx className={className} styles={descriptionStyle} sx={sx}>
      {(className) => (
        <Root
          {...rest}
          ref={ref}
          id={descriptionId}
          className={className}
          data-ui="expandable-card-description"
        >
          {' '}
          {children}
        </Root>
      )}
    </WithSx>
  );
}
ExpandableCardDescription.displayName = 'ExpandableCard.Description';

function ExpandableCardContent({
  ref,
  className,
  sx,
  children,
  'aria-labelledby': labelledBy,
  'aria-describedby': describedBy,
  ...rest
}: ExpandableCardContentProps) {
  const c = useCard('Content');
  const Root = c.slots?.content ?? 'div';
  const panelRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const mergedRef = useMergeRefs([panelRef, ref]);
  const height = useMotionValue(0);
  const opacity = useMotionValue(c.open ? 1 : 0);
  const reduced = useReducedMotion();
  const initialized = useRef(false);
  useLayoutEffect(() => {
    const panel = panelRef.current;
    const inner = innerRef.current;
    if (!panel || !inner) return;
    let generation = 0;
    let disposed = false;
    if (!c.open && panel.contains(panel.ownerDocument.activeElement)) c.triggerRef.current?.focus();
    panel.inert = !c.open;
    if (c.open) panel.hidden = false;
    else if (!initialized.current) panel.hidden = true;
    // The render sets `hidden` for SSR/initial markup; when a measured close animation runs,
    // clear it so the shrink is visible and restore it when the animation completes (below).
    else panel.hidden = false;
    if (c.expandedWidth === undefined) return;
    const write = (value: number) => {
      panel.style.blockSize = `${value}px`;
      if (c.open && value > 0 && opacity.get() === 0 && !opacity.isAnimating())
        animate(opacity, 1, DETAIL_FADE);
    };
    const unsubscribe = height.on('change', write);
    const unsubscribeOpacity = opacity.on('change', (value) => {
      panel.style.opacity = String(value);
    });
    const measure = () => {
      const current = ++generation;
      const target = c.open ? inner.getBoundingClientRect().height : 0;
      height.stop();
      const complete = () => {
        if (!disposed && current === generation && !c.open) panel.hidden = true;
      };
      if (!initialized.current || reduced) {
        opacity.jump(c.open ? 1 : 0);
        panel.style.opacity = String(opacity.get());
        height.jump(target);
        write(target);
        complete();
        initialized.current = true;
      } else if (c.open) {
        if (height.get() > 0) animate(opacity, 1, DETAIL_FADE);
        animate(height, target, { ...GEOMETRY_SPRING, onComplete: complete });
      } else {
        animate(opacity, 0, {
          ...DETAIL_FADE,
          onComplete: () => {
            if (!disposed && current === generation)
              animate(height, target, {
                ...GEOMETRY_SPRING,
                onComplete: complete,
              });
          },
        });
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(inner);
    return () => {
      disposed = true;
      generation++;
      observer.disconnect();
      unsubscribe();
      unsubscribeOpacity();
      height.stop();
      opacity.stop();
    };
  }, [c.open, c.expandedWidth, c.triggerRef, height, opacity, reduced]);
  return (
    <WithSx className={className} styles={contentStyle} sx={sx}>
      {(className) => (
        <Root
          {...rest}
          ref={mergedRef}
          id={c.panelId}
          role="region"
          className={className}
          data-ui="expandable-card-content"
          hidden={!c.open}
          aria-hidden={!c.open || undefined}
          aria-labelledby={ids(labelledBy, c.hasTitle ? c.titleId : c.triggerId)}
          aria-describedby={ids(describedBy, c.hasDescription && c.descriptionId)}
        >
          <div ref={innerRef} css={innerStyle} style={{ inlineSize: c.expandedWidth }}>
            {children}
          </div>
        </Root>
      )}
    </WithSx>
  );
}
ExpandableCardContent.displayName = 'ExpandableCard.Content';
export const ExpandableCard = Object.assign(ExpandableCardRoot, {
  Trigger: ExpandableCardTrigger,
  Title: ExpandableCardTitle,
  Description: ExpandableCardDescription,
  Content: ExpandableCardContent,
});
