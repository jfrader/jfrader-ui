'use client';

import { createContext, useContext, useMemo, type ComponentPropsWithRef, type ComponentType, type ReactNode } from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import type { SxProps } from '../../styling/sx';
import { ARTICLE_DESKTOP, articleHeadingFont, articleLabelStyle, articleLinkStyle, articleSoftRule, articleTimeStyle } from '../../styling/article';
import { isRenderable } from '../../utils/renderable';
import { PresentationSlot, repeatedTemplate, type ArticleHeadingLevel, type PresentationParts, type PresentationSlots, type PrintedTime, type RenderArticleLink } from '../../utils/presentation-slot';

export type ArticleListVariant = 'headlines' | 'wire' | 'stacked';
export type ArticleListItemVariant = 'headline-time' | 'headline-tag' | 'headline-place' | 'wire' | 'stacked';
export type ArticleListSize = 'sm' | 'md';
type ItemAnatomy = { root: 'li'; meta: 'div'; time: 'time'; label: 'span'; headline: 'span'; link: 'a'; place: 'span' };
type ItemSlots = Omit<PresentationSlots<ItemAnatomy>, 'headline'> & { headline?: ComponentType<ComponentPropsWithRef<'h2'> & { level?: ArticleHeadingLevel }> };
type ItemLink = {
  /** Renders the headline link with its anchor props; cannot be combined with `slots.link`. */
  renderLink: RenderArticleLink;
  /** Replaces item elements other than the link supplied by `renderLink`. */
  slots?: Omit<ItemSlots, 'link'> & { link?: never };
} | {
  renderLink?: never;
  /** Replaces the elements rendering the item and its metadata. */
  slots?: ItemSlots;
};
export type ArticleListItemProps = Omit<ComponentPropsWithRef<'li'>, 'children'> & SxProps & ItemLink & {
  /** Displays the headline; an empty headline omits the item. */
  headline: ReactNode;
  /** Links the headline to this destination. */
  href?: string;
  /** Displays a time label with its machine-readable `dateTime`, except in tag and place variants. */
  time?: PrintedTime;
  /** Displays a tag in `headline-tag`, `wire` and `stacked` variants. */
  label?: ReactNode;
  /** Displays a location in the `headline-place` variant. */
  place?: ReactNode;
  /** Renders the headline as a heading at this level; otherwise uses a `span`. */
  level?: ArticleHeadingLevel;
  /** Chooses the metadata layout, overriding the list's variant. Defaults to `headline-time` outside a list. */
  variant?: ArticleListItemVariant;
  /** Sets headline text size, overriding the list's size. Defaults to `sm` for `stacked`, otherwise `md`. */
  size?: ArticleListSize;
  /** Replaces the item root; `slots.root` takes precedence. */
  component?: ItemSlots['root'];
  /** Passes props and `sx` to the item and its metadata parts. */
  slotProps?: PresentationParts<ItemAnatomy>;
};
type WithEntryId<P> = P extends unknown ? Omit<P, 'id'> & { id: string } : never;
export type ArticleListEntry = WithEntryId<ArticleListItemProps>;
export interface ArticleListSlots {
  root?: ComponentType<ComponentPropsWithRef<'ul'>>;
  item?: ComponentType<ComponentPropsWithRef<'li'>>;
}
export interface ArticleListSlotProps {
  root?: PresentationParts<{ root: 'ul' }>['root'];
  item?: Partial<ArticleListItemProps>;
}
export type ArticleListProps = Omit<ComponentPropsWithRef<'ul'>, 'children'> & SxProps & ({
  /** Supplies keyed article records instead of composed children. A list with no renderable headlines is omitted. */
  items: readonly ArticleListEntry[];
  children?: never;
} | {
  items?: never;
  /** Composes article items instead of supplying `items`. */
  children?: ReactNode;
}) & {
  /** Chooses the default item layout. Defaults to `headlines`. */
  variant?: ArticleListVariant;
  /** Sets the default headline size for items; otherwise each variant chooses its size. */
  size?: ArticleListSize;
  /** Replaces the list root; `slots.root` takes precedence. */
  component?: ArticleListSlots['root'];
  /** Replaces the list root and default item root elements. */
  slots?: ArticleListSlots;
  /** Passes props and `sx` to the list root and repeated items. */
  slotProps?: ArticleListSlotProps;
};
const ListContext = createContext<Pick<ArticleListProps, 'variant' | 'size' | 'slots' | 'slotProps'>>({});
const rootStyle = css({ listStyle: 'none', padding: 0, margin: 0, minInlineSize: 0 });
const itemStyle = css({ minInlineSize: 0, paddingBlock: vars.space[3], color: vars.color.text, display: 'flex', flexDirection: 'column', gap: vars.space[2], '&:not(:first-child)': { borderBlockStart: `${vars.editorial.rule.thin} solid ${articleSoftRule}` } });
const rowStyle = css({ [ARTICLE_DESKTOP]: { flexDirection: 'row', alignItems: 'baseline', gap: vars.space[3] } });
const wireStyle = css({ flexDirection: 'row', alignItems: 'baseline', paddingBlock: vars.space[2] });
const headlineStyle = css({ margin: 0, minInlineSize: 0, fontFamily: articleHeadingFont, lineHeight: vars.editorial.lineHeight.brief, overflowWrap: 'anywhere' });
const itemSizes = { sm: css({ fontSize: vars.editorial.body }), md: css({ fontSize: vars.editorial.headline.brief }) };
const boldStyle = css({ fontWeight: vars.fontWeight.semibold });
const regularStyle = css({ fontWeight: vars.fontWeight.regular });
const placeStyle = css({ [ARTICLE_DESKTOP]: { marginInlineStart: 'auto' } });
const metaStyle = css({ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: vars.space[2] });
const wireLabelStyle = css({ marginInlineEnd: vars.space[2] });
const defaultItemVariant: Record<ArticleListVariant, ArticleListItemVariant> = { headlines: 'headline-time', wire: 'wire', stacked: 'stacked' };

function ArticleListRoot({ items, children, variant = 'headlines', size, component, slots, slotProps, ...props }: ArticleListProps) {
  const context = useMemo(() => ({ variant, size, slots, slotProps }), [variant, size, slots, slotProps]);
  if (items && !items.some((item) => isRenderable(item.headline))) return null;
  return <ListContext.Provider value={context}>
    <PresentationSlot {...props} element="ul" component={slots?.root ?? component} slotProps={slotProps?.root} marker="article-list" data-variant={variant} styles={rootStyle}>
      {items ? items.map(({ id, ...item }) => <ArticleListItem key={id} {...item} />) : children}
    </PresentationSlot>
  </ListContext.Provider>;
}
ArticleListRoot.displayName = 'ArticleList';

/** Present an article headline with optional time, label and place. */
function ArticleListItem(allProps: ArticleListItemProps) {
  const parent = useContext(ListContext);
  const template = repeatedTemplate(parent.slotProps?.item);
  const { headline, href, renderLink, time, label, place, level, variant: ownVariant, size: ownSize, component, slots, slotProps, ...props } = {
    ...template, ...allProps,
    className: [template?.className, allProps.className].filter(Boolean).join(' ') || undefined,
    style: { ...template?.style, ...allProps.style },
  };
  const variant = ownVariant ?? template?.variant ?? defaultItemVariant[parent.variant ?? 'headlines'];
  const size = ownSize ?? template?.size ?? parent.size ?? (variant === 'stacked' ? 'sm' : 'md');
  if (!isRenderable(headline)) return null;
  const hasTime = time !== undefined && isRenderable(time.label);
  const hasLabel = isRenderable(label);
  const Time = hasTime ? <PresentationSlot element="time" component={slots?.time} slotProps={slotProps?.time} dateTime={time.dateTime} data-ui="article-list-time" styles={[articleLabelStyle, articleTimeStyle]}>{time.label}</PresentationSlot> : null;
  const Label = hasLabel ? <PresentationSlot element="span" component={slots?.label} slotProps={slotProps?.label} data-ui="article-list-label" styles={[articleLabelStyle, variant === 'wire' && wireLabelStyle]}>{label}</PresentationSlot> : null;
  const link = slotProps?.link;
  const content = <>{variant === 'wire' && Label}{headline}</>;
  return <PresentationSlot {...props} element="li" component={slots?.root ?? component ?? parent.slots?.item} slotProps={slotProps?.root} marker="article-list-item" data-variant={variant} data-size={size} styles={[itemStyle, variant.startsWith('headline-') && rowStyle, variant === 'wire' && wireStyle]}>
    {variant === 'stacked' && (hasTime || hasLabel) && <PresentationSlot element="div" component={slots?.meta} slotProps={slotProps?.meta} data-ui="article-list-meta" styles={metaStyle}>{Label}{hasTime && hasLabel && <span aria-hidden="true">·</span>}{Time}</PresentationSlot>}
    {(variant === 'headline-time' || variant === 'wire') && Time}
    {variant === 'headline-tag' && Label}
    <PresentationSlot element={level ? `h${level}` : 'span'} component={slots?.headline} slotProps={slotProps?.headline} data-ui="article-list-headline" styles={[headlineStyle, itemSizes[size], variant.startsWith('headline-') ? boldStyle : regularStyle]} {...(slots?.headline ? { level } : {})}>
      {href !== undefined || renderLink ? <PresentationSlot element="a" component={slots?.link} slotProps={link} renderLink={renderLink} href={href} data-ui="article-list-link" styles={articleLinkStyle}>{content}</PresentationSlot> : content}
    </PresentationSlot>
    {variant === 'headline-place' && isRenderable(place) && <PresentationSlot element="span" component={slots?.place} slotProps={slotProps?.place} data-ui="article-list-place" styles={[articleLabelStyle, placeStyle]}>{place}</PresentationSlot>}
  </PresentationSlot>;
}
ArticleListItem.displayName = 'ArticleList.Item';
/** List article headlines with their publication details. */
export const ArticleList = Object.assign(ArticleListRoot, { Item: ArticleListItem });
