'use client';

import { createContext, useContext, useMemo, type ComponentPropsWithRef, type ComponentType, type CSSProperties, type ReactNode } from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type Theme } from '../../styling/css';
import type { SxProps } from '../../styling/sx';
import { ARTICLE_DESKTOP, articleBodyFont, articleHeadingFont, articleLabelStyle, articleLinkStyle, articleMeasure, articleRule, articleTimeStyle } from '../../styling/article';
import { isRenderable } from '../../utils/renderable';
import { PresentationSlot, type ArticleHeadingLevel, type PresentationParts, type PresentationSlots, type PrintedTime, type RenderArticleLink } from '../../utils/presentation-slot';

export type ArticleSize = 'lead' | 'secondary' | 'standard' | 'brief';
export type ArticleVariant = 'standard' | 'wide' | 'time-column' | 'rule-top' | 'no-dek' | 'rule-bottom' | 'centered';
type HeadingRoot = ComponentPropsWithRef<'h2'> & { level?: ArticleHeadingLevel };
type HeadlineSlots = { root?: ComponentType<HeadingRoot>; link?: ComponentType<ComponentPropsWithRef<'a'>> };
type HeadlineLink = { renderLink: RenderArticleLink; slots?: Omit<HeadlineSlots, 'link'> & { link?: never } } | { renderLink?: never; slots?: HeadlineSlots };
export type ArticleCardHeadlineProps = ComponentPropsWithRef<'h2'> & SxProps & HeadlineLink & {
  level?: ArticleHeadingLevel;
  size?: ArticleSize;
  href?: string;
  component?: HeadlineSlots['root'];
  slotProps?: PresentationParts<{ root: 'h2'; link: 'a' }>;
};
export type ArticleCardDekProps = ComponentPropsWithRef<'p'> & SxProps & {
  variant?: 'standard' | 'columns';
  size?: 'standard' | 'lead';
  component?: ComponentType<ComponentPropsWithRef<'p'>>;
  slots?: PresentationSlots<{ root: 'p' }>;
  slotProps?: PresentationParts<{ root: 'p' }>;
};
export type ArticleCardLedeProps = ComponentPropsWithRef<'p'> & SxProps & {
  visibility?: 'desktop' | 'always';
  clampLines?: number;
  component?: ComponentType<ComponentPropsWithRef<'p'>>;
  slots?: PresentationSlots<{ root: 'p' }>;
  slotProps?: PresentationParts<{ root: 'p' }>;
};
export type ArticleCardMediaProps = ComponentPropsWithRef<'figure'> & SxProps & {
  caption?: ReactNode;
  credit?: ReactNode;
  component?: ComponentType<ComponentPropsWithRef<'figure'>>;
  slots?: PresentationSlots<{ root: 'figure'; caption: 'figcaption'; credit: 'span' }>;
  slotProps?: PresentationParts<{ root: 'figure'; caption: 'figcaption'; credit: 'span' }>;
};
type NativeAnatomy = { root: 'article'; content: 'div'; time: 'time'; kicker: 'div'; rule: 'div'; meta: 'div' };
export type ArticleCardSlots = PresentationSlots<NativeAnatomy> & {
  headline?: ComponentType<HeadingRoot>;
  dek?: ComponentType<ComponentPropsWithRef<'p'>>;
  lede?: ComponentType<ComponentPropsWithRef<'p'>>;
  media?: ComponentType<ComponentPropsWithRef<'figure'>>;
};
type PartProps<P> = P & { css?: Interpolation<Theme> };
export type ArticleCardSlotProps = PresentationParts<NativeAnatomy> & {
  headline?: PartProps<ArticleCardHeadlineProps>;
  dek?: PartProps<ArticleCardDekProps>;
  lede?: PartProps<ArticleCardLedeProps>;
  media?: PartProps<ArticleCardMediaProps>;
};
type EasyContent = {
  headline: ReactNode; href?: string; renderLink?: RenderArticleLink; level?: ArticleHeadingLevel;
  kicker?: ReactNode; dek?: ReactNode; lede?: ReactNode; meta?: ReactNode; time?: PrintedTime; media?: ReactNode;
  children?: never;
};
type CompoundContent = { children?: ReactNode } & { [K in keyof Omit<EasyContent, 'children'>]?: never };
export type ArticleCardProps = Omit<ComponentPropsWithRef<'article'>, 'children'> & SxProps & (EasyContent | CompoundContent) & {
  size?: ArticleSize; variant?: ArticleVariant;
  component?: ArticleCardSlots['root']; slots?: ArticleCardSlots; slotProps?: ArticleCardSlotProps;
};
type CardContextValue = Pick<ArticleCardProps, 'slots' | 'slotProps'> & { size: ArticleSize; variant: ArticleVariant };
const CardContext = createContext<CardContextValue>({ size: 'standard', variant: 'standard' });
const rootStyle = css({ '--_article-inline-justify': 'normal', minInlineSize: 0, color: vars.color.text });
const standardSpacing = css({ paddingBlock: vars.space[3] });
const leadSpacing = css({ paddingBlockEnd: vars.space[2] });
const contentStyle = css({ minInlineSize: 0, display: 'grid', gap: vars.space[3] });
const variants = {
  standard: css({}),
  wide: css({}),
  'time-column': css({ display: 'grid', gap: vars.space[3], [ARTICLE_DESKTOP]: { gridTemplateColumns: 'auto minmax(0, 1fr)', columnGap: vars.space[6] } }),
  'rule-top': css({ borderBlockStart: `${vars.editorial.rule.strong} solid ${articleRule}`, paddingBlockStart: vars.space[4] }),
  'no-dek': css({}),
  'rule-bottom': css({}),
  centered: css({ textAlign: 'center', '--_article-inline-justify': 'center' }),
};
const treatmentHeadlineStyle = css({ lineHeight: vars.editorial.lineHeight.secondary, letterSpacing: vars.editorial.tracking.secondary });
const timeColumnSingleStyle = css({ [ARTICLE_DESKTOP]: { gridTemplateColumns: 'minmax(0, 1fr)' } });
const centeredDekStyle = css({ maxInlineSize: vars.editorial.centeredMeasure, marginInline: 'auto' });
const headlineStyle = css({ margin: 0, minInlineSize: 0, fontFamily: articleHeadingFont, fontWeight: vars.fontWeight.semibold, textWrap: 'balance', overflowWrap: 'anywhere', color: vars.color.text });
const sizes = {
  lead: css({ fontSize: vars.editorial.headline.lead, lineHeight: vars.editorial.lineHeight.lead, letterSpacing: vars.editorial.tracking.headline }),
  secondary: css({ fontSize: vars.editorial.headline.secondary, lineHeight: vars.editorial.lineHeight.secondary, letterSpacing: vars.editorial.tracking.secondary }),
  standard: css({ fontSize: vars.editorial.headline.standard, lineHeight: vars.lineHeight.tight, letterSpacing: vars.editorial.tracking.standard }),
  brief: css({ fontSize: vars.editorial.headline.brief, lineHeight: vars.editorial.lineHeight.brief }),
};
const paragraphStyle = css({ margin: 0, fontFamily: articleBodyFont, fontSize: vars.editorial.summary, lineHeight: vars.lineHeight.relaxed, maxInlineSize: articleMeasure, overflowWrap: 'anywhere', textWrap: 'pretty' });
const leadDekStyle = css({ fontSize: vars.editorial.dek });
const columnsStyle = css({ [ARTICLE_DESKTOP]: { columnCount: 2, columnGap: vars.space[10] } });
const ledeStyle = css({ fontSize: vars.editorial.lede, display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 'var(--article-lede-lines)', overflow: 'hidden' });
const desktopLedeStyle = css({ display: 'none', [ARTICLE_DESKTOP]: { display: '-webkit-box' } });
const mediaStyle = css({ margin: 0, minInlineSize: 0, '& > img, & > picture, & > video': { display: 'block', maxInlineSize: '100%', blockSize: 'auto' } });
const captionStyle = css({ marginBlockStart: vars.space[2], display: 'flex', flexWrap: 'wrap', gap: vars.space[2] });
const ruleStyle = css({ inlineSize: vars.space[10], borderBlockStart: `${vars.editorial.rule.strong} solid ${articleRule}` });

function ArticleCardRoot({ size = 'standard', variant = 'standard', component, slots, slotProps, children, headline, href, renderLink, level, kicker, dek, lede, meta, time, media, ...props }: ArticleCardProps) {
  const context = useMemo(() => ({ size, variant, slots, slotProps }), [size, variant, slots, slotProps]);
  const easy = headline !== undefined;
  const hasTime = time !== undefined && isRenderable(time.label);
  return <CardContext.Provider value={context}>
    <PresentationSlot {...props} element="article" component={slots?.root ?? component} slotProps={slotProps?.root} marker="article-card" data-size={size} data-variant={variant} styles={[rootStyle, variants[variant], variant === 'time-column' && !hasTime && timeColumnSingleStyle, variant === 'standard' && (size === 'lead' ? leadSpacing : standardSpacing)]}>
      {easy ? <>
        {hasTime && time && <PresentationSlot element="time" component={slots?.time} slotProps={slotProps?.time} data-ui="article-card-time" dateTime={time.dateTime} styles={[articleLabelStyle, articleTimeStyle]}>{time.label}</PresentationSlot>}
        <PresentationSlot element="div" component={slots?.content} slotProps={slotProps?.content} data-ui="article-card-content" styles={contentStyle}>
          {variant !== 'rule-bottom' && isRenderable(kicker) && <PresentationSlot element="div" component={slots?.kicker} slotProps={slotProps?.kicker} data-ui="article-card-kicker">{kicker}</PresentationSlot>}
          <ArticleCardHeadline href={href} {...(renderLink ? { renderLink } : {})} level={level}>{headline}</ArticleCardHeadline>
          {isRenderable(media) && <ArticleCardMedia>{media}</ArticleCardMedia>}
          {size !== 'brief' && variant !== 'no-dek' && variant !== 'rule-bottom' && isRenderable(dek) && <ArticleCardDek size={size === 'lead' ? 'lead' : 'standard'}>{dek}</ArticleCardDek>}
          {isRenderable(lede) && <ArticleCardLede>{lede}</ArticleCardLede>}
          {variant === 'rule-bottom' && <PresentationSlot element="div" component={slots?.rule} slotProps={slotProps?.rule} data-ui="article-card-rule" aria-hidden="true" styles={ruleStyle} />}
          {isRenderable(meta) && <PresentationSlot element="div" component={slots?.meta} slotProps={slotProps?.meta} data-ui="article-card-meta">{meta}</PresentationSlot>}
        </PresentationSlot>
      </> : children}
    </PresentationSlot>
  </CardContext.Provider>;
}
ArticleCardRoot.displayName = 'ArticleCard';

function ArticleCardHeadline({ level: ownLevel, size: ownSize, href, renderLink, component, slots, slotProps, children, ...props }: ArticleCardHeadlineProps) {
  const parent = useContext(CardContext);
  const { level = ownLevel ?? 2, size = ownSize ?? parent.size, href: slotHref, renderLink: slotRenderLink, component: parentComponent, slots: parentSlots, slotProps: parentParts, sx: parentSx, ...parentProps } = parent.slotProps?.headline ?? {};
  if (!isRenderable(children)) return null;
  const Root = slots?.root ?? component ?? parentSlots?.root ?? parentComponent ?? parent.slots?.headline;
  const link = slotProps?.link;
  const resolvedHref = slotHref ?? href;
  const resolvedRenderLink = slotRenderLink ?? renderLink;
  return <PresentationSlot sx={parentSx} {...props} templateProps={parentProps} inheritedSlotProps={parentParts?.root} element={`h${level}`} component={Root} slotProps={slotProps?.root} marker="article-card-headline" styles={[headlineStyle, sizes[size], parent.variant !== 'standard' && treatmentHeadlineStyle]} {...(Root ? { level } : {})}>
    {resolvedHref !== undefined || resolvedRenderLink ? <PresentationSlot element="a" component={slots?.link ?? parentSlots?.link} slotProps={link} templateProps={parentParts?.link} renderLink={resolvedRenderLink} href={resolvedHref} data-ui="article-card-headline-link" styles={articleLinkStyle}>{children}</PresentationSlot> : children}
  </PresentationSlot>;
}
ArticleCardHeadline.displayName = 'ArticleCard.Headline';

function ArticleCardDek({ variant: ownVariant, size: ownSize, component, slots, slotProps, children, ...props }: ArticleCardDekProps) {
  const parent = useContext(CardContext);
  const { variant = ownVariant ?? 'standard', size = ownSize ?? 'standard', component: parentComponent, slots: parentSlots, slotProps: parentParts, sx: parentSx, ...parentProps } = parent.slotProps?.dek ?? {};
  if (!isRenderable(children)) return null;
  return <PresentationSlot sx={parentSx} {...props} templateProps={parentProps} inheritedSlotProps={parentParts?.root} element="p" component={slots?.root ?? component ?? parentSlots?.root ?? parentComponent ?? parent.slots?.dek} slotProps={slotProps?.root} marker="article-card-dek" styles={[paragraphStyle, size === 'lead' && leadDekStyle, variant === 'columns' && columnsStyle, parent.variant === 'centered' && centeredDekStyle]}>{children}</PresentationSlot>;
}
ArticleCardDek.displayName = 'ArticleCard.Dek';

function ArticleCardLede({ visibility: ownVisibility, clampLines: ownClamp, component, slots, slotProps, children, style, ...props }: ArticleCardLedeProps) {
  const parent = useContext(CardContext);
  const { visibility = ownVisibility ?? 'desktop', clampLines = ownClamp ?? 4, component: parentComponent, slots: parentSlots, slotProps: parentParts, sx: parentSx, ...parentProps } = parent.slotProps?.lede ?? {};
  if (!isRenderable(children)) return null;
  return <PresentationSlot sx={parentSx} {...props} templateProps={parentProps} inheritedSlotProps={parentParts?.root} element="p" component={slots?.root ?? component ?? parentSlots?.root ?? parentComponent ?? parent.slots?.lede} slotProps={slotProps?.root} marker="article-card-lede" styles={[paragraphStyle, ledeStyle, visibility === 'desktop' && desktopLedeStyle]} style={{ '--article-lede-lines': clampLines, ...style } as CSSProperties}>{children}</PresentationSlot>;
}
ArticleCardLede.displayName = 'ArticleCard.Lede';

function ArticleCardMedia({ caption: ownCaption, credit: ownCredit, component, slots, slotProps, children, ...props }: ArticleCardMediaProps) {
  const parent = useContext(CardContext);
  const { caption = ownCaption, credit = ownCredit, component: parentComponent, slots: parentSlots, slotProps: parentParts, sx: parentSx, ...parentProps } = parent.slotProps?.media ?? {};
  if (!isRenderable(children)) return null;
  return <PresentationSlot sx={parentSx} {...props} templateProps={parentProps} inheritedSlotProps={parentParts?.root} element="figure" component={slots?.root ?? component ?? parentSlots?.root ?? parentComponent ?? parent.slots?.media} slotProps={slotProps?.root} marker="article-card-media" styles={mediaStyle}>
    {children}
    {(isRenderable(caption) || isRenderable(credit)) && <PresentationSlot element="figcaption" component={slots?.caption ?? parentSlots?.caption} templateProps={parentParts?.caption} slotProps={slotProps?.caption} data-ui="article-card-media-caption" styles={[articleLabelStyle, captionStyle]}>
      {caption}
      {isRenderable(credit) && <PresentationSlot element="span" component={slots?.credit ?? parentSlots?.credit} templateProps={parentParts?.credit} slotProps={slotProps?.credit} data-ui="article-card-media-credit">{credit}</PresentationSlot>}
    </PresentationSlot>}
  </PresentationSlot>;
}
ArticleCardMedia.displayName = 'ArticleCard.Media';

export const ArticleCard = Object.assign(ArticleCardRoot, { Headline: ArticleCardHeadline, Dek: ArticleCardDek, Lede: ArticleCardLede, Media: ArticleCardMedia });
export type { ArticleHeadingLevel, PrintedTime, RenderArticleLink };
