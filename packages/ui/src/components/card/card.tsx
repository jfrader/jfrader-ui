// Static surface for grouping related content. Not an APG widget and not interactive: every part
// is a plain styled element with no role, so the card adds no landmark on its own. To expose it
// as a region, pass role="region" with aria-labelledby pointing at the Card.Title id.
// Card.Title renders an h3 by default; pass `level` so the heading fits the page outline where
// the card is placed (a card under an h2 section keeps h3, a top-level card grid may need h2).
// slotProps on the root style the parts rendered inside it, so a consumer can theme a card's
// anatomy from one place; a part's own className/css still merges last.
import { createContext, useContext, type ComponentPropsWithRef } from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type SerializedStyles, type Theme } from '../../styling/css';
import { raisedSurface, surfaceAttributes, surfaceTheme, type SurfaceAppearance } from '../../styling/surface';
import { AppearanceScope, themeScopeStyle, useSurfaceAppearance, useSurfaceStyle } from '../../styling/theme-scope';
import { WithSx, type SxProps } from '../../styling/sx';

export type CardVariant = 'flat' | 'raised';

export type CardHeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

export interface CardPartProps {
  className?: string;
  css?: Interpolation<Theme>;
}

export interface CardSlotProps {
  root?: CardPartProps;
  header?: CardPartProps;
  title?: CardPartProps;
  description?: CardPartProps;
  content?: CardPartProps;
  footer?: CardPartProps;
}

export interface CardProps extends ComponentPropsWithRef<'div'>, SxProps {
  variant?: CardVariant;
  /** `contrast` paints the dark theme's own palette for this card on any page theme. */
  appearance?: SurfaceAppearance;
  slotProps?: CardSlotProps;
}

export type CardHeaderProps = ComponentPropsWithRef<'div'> & SxProps;

export interface CardTitleProps extends ComponentPropsWithRef<'h3'>, SxProps {
  level?: CardHeadingLevel;
}

export type CardDescriptionProps = ComponentPropsWithRef<'p'> & SxProps;

export type CardContentProps = ComponentPropsWithRef<'div'> & SxProps;

export type CardFooterProps = ComponentPropsWithRef<'div'> & SxProps;

const CardSlotContext = createContext<CardSlotProps | undefined>(undefined);

function joinClassNames(...names: (string | undefined)[]) {
  return names.filter(Boolean).join(' ') || undefined;
}

// Precedence: base → variant → slotProps.root.css → consumer css → consumer sx.
const rootStyle = css({
  ...raisedSurface,
  minInlineSize: 0,
  borderRadius: vars.radius.lg,
  paddingBlock: vars.space[4],
  paddingInline: vars.space[5],
});

const variantStyles: Record<CardVariant, SerializedStyles> = {
  flat: css({ boxShadow: 'none' }),
  raised: css({ boxShadow: vars.shadow.raised }),
};

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

function CardRoot({ ref, variant = 'raised', appearance, slotProps, className, style, sx, ...rest }: CardProps) {
  const surfaceAppearance = useSurfaceAppearance(appearance);
  const ownTheme = surfaceTheme(appearance ?? 'default');
  const surfaceStyle = useSurfaceStyle(ownTheme, style);

  return (
    <CardSlotContext.Provider value={slotProps}>
      <AppearanceScope theme={ownTheme} appearance={surfaceAppearance}>
        <WithSx
          className={joinClassNames(slotProps?.root?.className, className)}
          styles={[rootStyle, variantStyles[variant], ownTheme && themeScopeStyle, slotProps?.root?.css]}
          sx={sx}
        >
          {(className) => (
            <div
              {...rest}
              ref={ref}
              data-ui="card"
              data-variant={variant}
              {...surfaceAttributes(appearance ?? 'default')}
              className={className}
              style={surfaceStyle}
            />
          )}
        </WithSx>
      </AppearanceScope>
    </CardSlotContext.Provider>
  );
}

CardRoot.displayName = 'Card';

function CardHeader({ ref, className, sx, ...rest }: CardHeaderProps) {
  const slot = useContext(CardSlotContext)?.header;
  return (
    <WithSx className={joinClassNames(slot?.className, className)} styles={[headerStyle, slot?.css]} sx={sx}>
      {(className) => <div {...rest} ref={ref} data-ui="card-header" className={className} />}
    </WithSx>
  );
}

CardHeader.displayName = 'Card.Header';

function CardTitle({ ref, level = 3, className, sx, ...rest }: CardTitleProps) {
  const slot = useContext(CardSlotContext)?.title;
  const Heading = `h${level}` as const;
  return (
    <WithSx className={joinClassNames(slot?.className, className)} styles={[titleStyle, slot?.css]} sx={sx}>
      {(className) => <Heading {...rest} ref={ref} data-ui="card-title" className={className} />}
    </WithSx>
  );
}

CardTitle.displayName = 'Card.Title';

function CardDescription({ ref, className, sx, ...rest }: CardDescriptionProps) {
  const slot = useContext(CardSlotContext)?.description;
  return (
    <WithSx className={joinClassNames(slot?.className, className)} styles={[descriptionStyle, slot?.css]} sx={sx}>
      {(className) => <p {...rest} ref={ref} data-ui="card-description" className={className} />}
    </WithSx>
  );
}

CardDescription.displayName = 'Card.Description';

function CardContent({ ref, className, sx, ...rest }: CardContentProps) {
  const slot = useContext(CardSlotContext)?.content;
  return (
    <WithSx className={joinClassNames(slot?.className, className)} styles={[contentStyle, slot?.css]} sx={sx}>
      {(className) => <div {...rest} ref={ref} data-ui="card-content" className={className} />}
    </WithSx>
  );
}

CardContent.displayName = 'Card.Content';

function CardFooter({ ref, className, sx, ...rest }: CardFooterProps) {
  const slot = useContext(CardSlotContext)?.footer;
  return (
    <WithSx className={joinClassNames(slot?.className, className)} styles={[footerStyle, slot?.css]} sx={sx}>
      {(className) => <div {...rest} ref={ref} data-ui="card-footer" className={className} />}
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
