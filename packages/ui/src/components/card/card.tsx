'use client';

// Static surface for grouping related content. Not an APG widget and not interactive: every part
// is a plain styled element with no role, so the card adds no landmark on its own. To expose it
// as a region, pass role="region" with aria-labelledby pointing at the Card.Title id.
// Card.Title renders an h3 by default; pass `level` so the heading fits the page outline where
// the card is placed (a card under an h2 section keeps h3, a top-level card grid may need h2).
// slotProps on the root style the parts rendered inside it, so a consumer can theme a card's
// anatomy from one place; a part's own className/css still merges last. `slots` replaces a part
// with the consumer's component, which receives the part's props and the className its styles
// resolve to.
import { createContext, useContext, useEffect, useMemo, useRef, type ComponentPropsWithRef, type ComponentType, type ReactElement, type ReactNode } from 'react';
import { MotionConfig, useReducedMotionConfig, useSpring } from 'motion/react';
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type Theme } from '../../styling/css';
import type { SurfaceAppearance } from '../../styling/surface';
import type { SurfacePartProps, SurfaceRootCustomization, SurfaceRootSlotProps } from '../surface';
import { SurfaceRoot, resolveSurfaceValue } from '../surface/surface-root';
import { WithSx, type SxProps } from '../../styling/sx';
import { isRenderable } from '../../utils/renderable';
import { motionDurationMs } from '../../styling/motion-timings';
import { FORCED_COLORS, REDUCED_MOTION, REDUCED_TRANSPARENCY } from '../../styling/media';

export type CardVariant = 'flat' | 'raised';

export type CardHeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

export interface CardPartProps {
  className?: string;
  css?: Interpolation<Theme>;
}

export interface CardSlotProps {
  /** Root surface element; renders `Surface`. */
  root?: SurfaceRootSlotProps;
  /** Header container wrapping the title and description. */
  header?: CardPartProps;
  /** Heading element displaying the card title. */
  title?: CardPartProps;
  /** Paragraph displaying the card description. */
  description?: CardPartProps;
  /** Main body container holding the card content. */
  content?: CardPartProps;
  /** Holds the actions at the end of the card. */
  footer?: CardPartProps;
}

export interface CardSlots {
  /** Replaces the panel material. Same seam as `component`; `slots.root` wins. */
  root?: ComponentType<SurfacePartProps>;
  /** Replaces the header band that wraps the title and description. */
  header?: ComponentType<CardHeaderProps>;
  /** Replaces the heading element. */
  title?: ComponentType<CardTitleProps>;
  /** Replaces the description paragraph. */
  description?: ComponentType<CardDescriptionProps>;
  /** Replaces the body container. */
  content?: ComponentType<CardContentProps>;
  /** Replaces the actions band. */
  footer?: ComponentType<CardFooterProps>;
}

interface CardBaseProps
  extends Omit<SurfacePartProps, 'children' | 'title' | 'content'>,
    SxProps,
    Omit<SurfaceRootCustomization, 'slots' | 'slotProps'> {
  'data-variant'?: string;
  variant?: CardVariant;
  /**
   * `contrast` uses the dark palette with a charcoal surface on any page theme.
   * Omit this prop or use `default` to inherit the enclosing appearance, including contrast.
   * `glass` and `holo` apply local translucent materials without changing that palette scope.
   */
  appearance?: SurfaceAppearance | 'glass' | 'holo';
  /** Enable mouse/pen tilt and moving light for holo only. Disabled by reduced motion. */
  holoTilt?: boolean;
  slots?: CardSlots;
  slotProps?: CardSlotProps;
}

export interface CardCompoundProps extends CardBaseProps {
  children?: ReactNode;
  title?: string;
  description?: never;
  content?: string;
  footer?: never;
}

export interface CardEasyProps extends CardBaseProps {
  /** Show a heading in the generated header. */
  title?: ReactNode;
  /** Describe the card below its heading. */
  description?: ReactNode;
  /** Render the body with Card.Content. */
  content: ReactNode;
  /** Render actions below the body. */
  footer?: ReactNode;
  children?: never;
}

export type CardProps = CardCompoundProps | CardEasyProps;

export type CardHeaderProps = ComponentPropsWithRef<'div'> & SxProps;

export interface CardTitleProps extends ComponentPropsWithRef<'h3'>, SxProps {
  level?: CardHeadingLevel;
}

export type CardDescriptionProps = ComponentPropsWithRef<'p'> & SxProps;

export type CardContentProps = ComponentPropsWithRef<'div'> & SxProps;

export type CardFooterProps = ComponentPropsWithRef<'div'> & SxProps;

const CardSlotContext = createContext<{ slots?: CardSlots; slotProps?: CardSlotProps }>({});

function joinClassNames(...names: (string | undefined)[]) {
  return names.filter(Boolean).join(' ') || undefined;
}

// Precedence: base → variant → slotProps.root.css → consumer css → consumer sx.
const rootStyle = css({
  minInlineSize: 0,
  paddingBlock: vars.space[4],
  paddingInline: vars.space[5],
});

const variants = ['flat', 'raised'] as const;
const appearances = ['default', 'contrast', 'glass', 'holo'] as const;
const translucentMaterial = css({
  backgroundColor: vars.color.surfaceGlass,
  backdropFilter: `blur(${vars.cardMaterial.blur})`,
  WebkitBackdropFilter: `blur(${vars.cardMaterial.blur})`,
  borderColor: vars.color.borderStrong,
  boxShadow: `inset 0 1px 0 ${vars.color.surfaceHighlight}`,
  '&[data-variant="raised"]': { boxShadow: `inset 0 1px 0 ${vars.color.surfaceHighlight}, ${vars.shadow.raised}` },
  [REDUCED_TRANSPARENCY]: {
    backgroundColor: vars.color.surfaceRaised,
    backgroundImage: 'none',
    backdropFilter: 'none',
    WebkitBackdropFilter: 'none',
  },
  [FORCED_COLORS]: { backgroundImage: 'none', backdropFilter: 'none', WebkitBackdropFilter: 'none', '&, &[data-variant="raised"]': { boxShadow: 'none', borderColor: 'CanvasText' } },
});
const materialStyles = {
  default: undefined,
  contrast: undefined,
  glass: css([{
    backgroundImage: `linear-gradient(135deg, ${vars.color.surfaceSheen}, transparent)`,
  }, translucentMaterial]),
  holo: css([{
    backgroundImage: `radial-gradient(ellipse at calc(50% + var(--card-light-x, 0) * 50%) calc(50% + var(--card-light-y, 0) * 50%), ${vars.color.surfaceSheen}, transparent), linear-gradient(125deg, ${vars.color.surfaceHoloCyan}, ${vars.color.surfaceSheen}, ${vars.color.surfaceHoloRose})`,
  }, translucentMaterial]),
};
const tiltStyle = css({
  transform: `perspective(${vars.cardMaterial.perspective}) rotateX(calc(var(--card-light-y, 0) * -1 * ${vars.cardMaterial.tilt})) rotateY(calc(var(--card-light-x, 0) * ${vars.cardMaterial.tilt}))`,
  [REDUCED_MOTION]: { transform: 'none' },
  [FORCED_COLORS]: { transform: 'none' },
});
const tiltSpring = { duration: motionDurationMs.slow / 1000, bounce: 0 };

function useHoloTilt(enabled: boolean, root: SurfaceRootCustomization['component']) {
  const ref = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotionConfig();
  const active = enabled && reducedMotion === false;
  const x = useSpring(0, tiltSpring);
  const y = useSpring(0, tiltSpring);
  // The root identity keys this effect so listeners re-attach when a replacement swaps nodes.
  useEffect(() => {
    const node = ref.current;
    if (!node || !active) return;
    const unsubscribeX = x.on('change', (value) => node.style.setProperty('--card-light-x', String(value)));
    const unsubscribeY = y.on('change', (value) => node.style.setProperty('--card-light-y', String(value)));
    const reset = () => { x.set(0); y.set(0); };
    const move = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
      const rect = node.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      x.set(Math.max(-1, Math.min(1, (event.clientX - rect.left) / rect.width * 2 - 1)));
      y.set(Math.max(-1, Math.min(1, (event.clientY - rect.top) / rect.height * 2 - 1)));
    };
    node.addEventListener('pointermove', move, { passive: true });
    node.addEventListener('pointerleave', reset);
    node.addEventListener('pointercancel', reset);
    return () => {
      node.removeEventListener('pointermove', move);
      node.removeEventListener('pointerleave', reset);
      node.removeEventListener('pointercancel', reset);
      unsubscribeX(); unsubscribeY();
      x.jump(0); y.jump(0);
      node.style.removeProperty('--card-light-x');
      node.style.removeProperty('--card-light-y');
    };
  }, [active, root, x, y]);
  return { ref, active, reducedMotion };
}

const headerStyle = css({
  display: 'grid',
  gap: vars.space[1],
  marginBlockEnd: vars.space[4],
});

const titleStyle = css({
  margin: 0,
  fontSize: vars.textSize.md,
  fontWeight: vars.fontWeight.semibold,
  lineHeight: vars.lineHeight.tight,
  color: vars.color.text,
});

const descriptionStyle = css({
  margin: 0,
  fontSize: vars.textSize.sm,
  color: vars.color.textMuted,
});

const contentStyle = css({
  fontSize: vars.textSize.sm,
  color: vars.color.text,
});

const footerStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: vars.space[2],
  marginBlockStart: vars.space[4],
  paddingBlockStart: vars.space[4],
  borderBlockStart: `1px solid ${vars.color.borderSubtle}`,
  // A lone footer action stays pinned to the end.
  '& > :only-child': { marginInlineStart: 'auto' },
});

function CardRoot(props: CardEasyProps): ReactElement;
function CardRoot(props: CardCompoundProps): ReactElement;
function CardRoot(allProps: CardProps) {
  const easy = 'content' in allProps && allProps.children === undefined;
  const { variant: variantProp, appearance: appearanceProp, holoTilt = false, slots, slotProps, children, title, description, content, footer, ...props } = allProps;
  const customization = useMemo(() => ({ slots, slotProps }), [slots, slotProps]);
  const variant = resolveSurfaceValue('Card', 'variant', variantProp, variants, 'raised');
  const appearance = resolveSurfaceValue('Card', 'appearance', appearanceProp, appearances, 'default');
  const tilt = useHoloTilt(appearance === 'holo' && holoTilt, slots?.root ?? props.component);
  return (
    <MotionConfig reducedMotion={tilt.reducedMotion ? 'always' : 'user'}>
      <SurfaceRoot
        {...props}
        appearance={appearance === 'contrast' ? 'contrast' : 'default'}
        internalRef={tilt.ref}
        title={!easy && typeof title === 'string' ? title : undefined}
        content={!easy && typeof content === 'string' ? content : undefined}
        children={easy ? (
          <>
            {(isRenderable(title) || isRenderable(description)) && (
              <CardHeader>
                {isRenderable(title) && <CardTitle>{title}</CardTitle>}
                {isRenderable(description) && <CardDescription>{description}</CardDescription>}
              </CardHeader>
            )}
            <CardContent>{content}</CardContent>
            {isRenderable(footer) && <CardFooter>{footer}</CardFooter>}
          </>
        ) : children}
        slotProps={slotProps}
        slots={slots}
        owner="Card"
        marker="card"
        variant={variant}
        materialStyle={materialStyles[appearance]}
        structure={[rootStyle, tilt.active && tiltStyle]}
        attributes={{
          'data-variant': props['data-variant'] ?? variant,
          'data-card-appearance': appearance,
          'data-holo-tilt': tilt.active ? '' : undefined,
        }}
        wrapChildren={(children) => <CardSlotContext.Provider value={customization}>{children}</CardSlotContext.Provider>}
      />
    </MotionConfig>
  );
}

CardRoot.displayName = 'Card';

function CardHeader({ ref, className, sx, ...rest }: CardHeaderProps) {
  const { slots, slotProps } = useContext(CardSlotContext);
  const slot = slotProps?.header;
  const Header = slots?.header ?? 'div';
  return (
    <WithSx className={joinClassNames(slot?.className, className)} styles={[headerStyle, slot?.css]} sx={sx}>
      {(className) => <Header {...rest} ref={ref} data-ui="card-header" className={className} />}
    </WithSx>
  );
}

CardHeader.displayName = 'Card.Header';

function CardTitle({ ref, level = 3, className, sx, ...rest }: CardTitleProps) {
  const { slots, slotProps } = useContext(CardSlotContext);
  const slot = slotProps?.title;
  // The native element carries the level in its own name; a replacement is told the level
  // instead, so `<Card.Title level={2}>` keeps its heading level after the swap.
  const Heading = slots?.title ?? (`h${level}` as const);
  const props = slots?.title ? { ...rest, level } : rest;
  return (
    <WithSx className={joinClassNames(slot?.className, className)} styles={[titleStyle, slot?.css]} sx={sx}>
      {(className) => <Heading {...props} ref={ref} data-ui="card-title" className={className} />}
    </WithSx>
  );
}

CardTitle.displayName = 'Card.Title';

function CardDescription({ ref, className, sx, ...rest }: CardDescriptionProps) {
  const { slots, slotProps } = useContext(CardSlotContext);
  const slot = slotProps?.description;
  const Description = slots?.description ?? 'p';
  return (
    <WithSx className={joinClassNames(slot?.className, className)} styles={[descriptionStyle, slot?.css]} sx={sx}>
      {(className) => <Description {...rest} ref={ref} data-ui="card-description" className={className} />}
    </WithSx>
  );
}

CardDescription.displayName = 'Card.Description';

function CardContent({ ref, className, sx, ...rest }: CardContentProps) {
  const { slots, slotProps } = useContext(CardSlotContext);
  const slot = slotProps?.content;
  const Content = slots?.content ?? 'div';
  return (
    <WithSx className={joinClassNames(slot?.className, className)} styles={[contentStyle, slot?.css]} sx={sx}>
      {(className) => <Content {...rest} ref={ref} data-ui="card-content" className={className} />}
    </WithSx>
  );
}

CardContent.displayName = 'Card.Content';

function CardFooter({ ref, className, sx, ...rest }: CardFooterProps) {
  const { slots, slotProps } = useContext(CardSlotContext);
  const slot = slotProps?.footer;
  const Footer = slots?.footer ?? 'div';
  return (
    <WithSx className={joinClassNames(slot?.className, className)} styles={[footerStyle, slot?.css]} sx={sx}>
      {(className) => <Footer {...rest} ref={ref} data-ui="card-footer" className={className} />}
    </WithSx>
  );
}

CardFooter.displayName = 'Card.Footer';

export const Card = Object.assign(CardRoot, {
  Header: CardHeader,
  Title: CardTitle,
  Description: CardDescription,
  Content: CardContent,
  Footer: CardFooter,
});
