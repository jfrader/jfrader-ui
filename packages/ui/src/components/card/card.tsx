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

export interface CardProps extends ComponentPropsWithRef<'div'> {
  variant?: CardVariant;
  slotProps?: CardSlotProps;
}

export type CardHeaderProps = ComponentPropsWithRef<'div'>;

export interface CardTitleProps extends ComponentPropsWithRef<'h3'> {
  level?: CardHeadingLevel;
}

export type CardDescriptionProps = ComponentPropsWithRef<'p'>;

export type CardContentProps = ComponentPropsWithRef<'div'>;

export type CardFooterProps = ComponentPropsWithRef<'div'>;

const CardSlotContext = createContext<CardSlotProps | undefined>(undefined);

function joinClassNames(...names: (string | undefined)[]) {
  return names.filter(Boolean).join(' ') || undefined;
}

// Precedence: base → variant → slotProps.root.css → consumer css (merged last by Emotion).
const rootStyle = css({
  boxSizing: 'border-box',
  minInlineSize: 0,
  backgroundColor: vars.color.surfaceRaised,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.lg,
  paddingBlock: vars.space[4],
  paddingInline: vars.space[5],
  fontFamily: vars.font.sans,
  lineHeight: vars.lineHeight.base,
  color: vars.color.text,
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

function CardRoot({ ref, variant = 'raised', slotProps, className, ...rest }: CardProps) {
  return (
    <CardSlotContext.Provider value={slotProps}>
      <div
        {...rest}
        ref={ref}
        data-ui="card"
        data-variant={variant}
        className={joinClassNames(slotProps?.root?.className, className)}
        css={[rootStyle, variantStyles[variant], slotProps?.root?.css]}
      />
    </CardSlotContext.Provider>
  );
}

CardRoot.displayName = 'Card';

function CardHeader({ ref, className, ...rest }: CardHeaderProps) {
  const slot = useContext(CardSlotContext)?.header;
  return (
    <div
      {...rest}
      ref={ref}
      data-ui="card-header"
      className={joinClassNames(slot?.className, className)}
      css={[headerStyle, slot?.css]}
    />
  );
}

CardHeader.displayName = 'Card.Header';

function CardTitle({ ref, level = 3, className, ...rest }: CardTitleProps) {
  const slot = useContext(CardSlotContext)?.title;
  const Heading = `h${level}` as const;
  return (
    <Heading
      {...rest}
      ref={ref}
      data-ui="card-title"
      className={joinClassNames(slot?.className, className)}
      css={[titleStyle, slot?.css]}
    />
  );
}

CardTitle.displayName = 'Card.Title';

function CardDescription({ ref, className, ...rest }: CardDescriptionProps) {
  const slot = useContext(CardSlotContext)?.description;
  return (
    <p
      {...rest}
      ref={ref}
      data-ui="card-description"
      className={joinClassNames(slot?.className, className)}
      css={[descriptionStyle, slot?.css]}
    />
  );
}

CardDescription.displayName = 'Card.Description';

function CardContent({ ref, className, ...rest }: CardContentProps) {
  const slot = useContext(CardSlotContext)?.content;
  return (
    <div
      {...rest}
      ref={ref}
      data-ui="card-content"
      className={joinClassNames(slot?.className, className)}
      css={[contentStyle, slot?.css]}
    />
  );
}

CardContent.displayName = 'Card.Content';

function CardFooter({ ref, className, ...rest }: CardFooterProps) {
  const slot = useContext(CardSlotContext)?.footer;
  return (
    <div
      {...rest}
      ref={ref}
      data-ui="card-footer"
      className={joinClassNames(slot?.className, className)}
      css={[footerStyle, slot?.css]}
    />
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
