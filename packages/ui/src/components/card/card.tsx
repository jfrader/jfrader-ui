// Static surface for grouping related content. Not an APG widget and not interactive: every part
// is a plain styled element with no role, so the card adds no landmark on its own. To expose it
// as a region, pass role="region" with aria-labelledby pointing at the Card.Title id.
// Card.Title renders an h3 by default; pass `level` so the heading fits the page outline where
// the card is placed (a card under an h2 section keeps h3, a top-level card grid may need h2).
// slotProps on the root style the parts rendered inside it, so a consumer can theme a card's
// anatomy from one place; a part's own className/css still merges last.
import { createContext, forwardRef, useContext, type HTMLAttributes } from 'react';
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

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  slotProps?: CardSlotProps;
}

export type CardHeaderProps = HTMLAttributes<HTMLDivElement>;

export interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  level?: CardHeadingLevel;
}

export type CardDescriptionProps = HTMLAttributes<HTMLParagraphElement>;

export type CardContentProps = HTMLAttributes<HTMLDivElement>;

export type CardFooterProps = HTMLAttributes<HTMLDivElement>;

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
  justifyContent: 'flex-end',
  gap: vars.space[2],
  marginBlockStart: vars.space[4],
  paddingBlockStart: vars.space[4],
  borderBlockStart: `1px solid ${vars.color.borderSubtle}`,
});

const CardRoot = forwardRef<HTMLDivElement, CardProps>(function Card(
  { variant = 'raised', slotProps, className, ...rest },
  ref,
) {
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
});

const Header = forwardRef<HTMLDivElement, CardHeaderProps>(function CardHeader({ className, ...rest }, ref) {
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
});

const Title = forwardRef<HTMLHeadingElement, CardTitleProps>(function CardTitle(
  { level = 3, className, ...rest },
  ref,
) {
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
});

const Description = forwardRef<HTMLParagraphElement, CardDescriptionProps>(function CardDescription(
  { className, ...rest },
  ref,
) {
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
});

const Content = forwardRef<HTMLDivElement, CardContentProps>(function CardContent({ className, ...rest }, ref) {
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
});

const Footer = forwardRef<HTMLDivElement, CardFooterProps>(function CardFooter({ className, ...rest }, ref) {
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
});

export const Card = Object.assign(CardRoot, { Header, Title, Description, Content, Footer });
