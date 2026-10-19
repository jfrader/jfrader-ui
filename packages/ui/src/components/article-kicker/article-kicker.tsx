'use client';

import { createContext, useContext, useMemo, type ComponentPropsWithRef, type ComponentType, type ReactNode } from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type Theme } from '../../styling/css';
import type { SxProps } from '../../styling/sx';
import { articleLabelStyle, articleLinkStyle } from '../../styling/article';
import { isRenderable } from '../../utils/renderable';
import { PresentationSlot, repeatedTemplate, type PresentationParts, type PresentationSlots, type RenderArticleLink } from '../../utils/presentation-slot';

type PlainItem = ComponentPropsWithRef<'span'> & { href?: never; renderLink?: never; slots?: PresentationSlots<ItemAnatomy> };
type LinkedItem = ComponentPropsWithRef<'a'> & { href: string; renderLink?: never; slots?: PresentationSlots<ItemAnatomy> };
type RenderedItem = ComponentPropsWithRef<'a'> & { href?: string; renderLink: RenderArticleLink; slots?: Omit<PresentationSlots<ItemAnatomy>, 'link'> & { link?: never } };
type ItemAnatomy = { root: 'span'; link: 'a' };
export type ArticleKickerItemProps = (PlainItem | LinkedItem | RenderedItem) & SxProps & {
  component?: ComponentType<ComponentPropsWithRef<'span'>>;
  slotProps?: PresentationParts<ItemAnatomy>;
};
export type ArticleKickerEntry = { id: string; label: ReactNode; href?: string; renderLink?: RenderArticleLink };
export interface ArticleKickerSlots {
  root?: ComponentType<ComponentPropsWithRef<'p'>>;
  item?: ComponentType<ComponentPropsWithRef<'span'> | ComponentPropsWithRef<'a'>>;
}
export interface ArticleKickerSlotProps {
  root?: PresentationParts<{ root: 'p' }>['root'];
  item?: Omit<ArticleKickerItemProps, 'children'> & { css?: Interpolation<Theme> };
}
type Content = { items: readonly ArticleKickerEntry[]; children?: never } | { items?: never; children?: ReactNode };
export type ArticleKickerProps = Omit<ComponentPropsWithRef<'p'>, 'children'> & SxProps & Content & {
  tone?: 'accent' | 'neutral';
  component?: ArticleKickerSlots['root'];
  slots?: ArticleKickerSlots;
  slotProps?: ArticleKickerSlotProps;
};
const rootStyle = css({ display: 'flex', flexWrap: 'wrap', justifyContent: 'var(--_article-inline-justify, normal)', gap: vars.space[2], fontSize: vars.editorial.kicker, fontWeight: vars.fontWeight.bold, letterSpacing: vars.editorial.tracking.kicker });
const tones = { accent: css({ color: vars.color.accentText }), neutral: css({ color: vars.color.textMuted }) };
const ItemContext = createContext<Pick<ArticleKickerProps, 'slots' | 'slotProps'>>({});

function ArticleKickerRoot({ items, children, tone = 'accent', component, slots, slotProps, ...props }: ArticleKickerProps) {
  const context = useMemo(() => ({ slots, slotProps }), [slots, slotProps]);
  if (items && !items.some((item) => isRenderable(item.label))) return null;
  if (!items && !isRenderable(children)) return null;
  return <ItemContext.Provider value={context}>
    <PresentationSlot {...props} element="p" component={slots?.root ?? component} slotProps={slotProps?.root} marker="article-kicker" data-tone={tone} styles={[articleLabelStyle, rootStyle, tones[tone]]}>
      {items ? items.filter((item) => isRenderable(item.label)).map(({ id, label, href, renderLink }) => {
        return renderLink ? <ArticleKickerItem key={id} href={href} renderLink={renderLink}>{label}</ArticleKickerItem> : href !== undefined ? <ArticleKickerItem key={id} href={href}>{label}</ArticleKickerItem> : <ArticleKickerItem key={id}>{label}</ArticleKickerItem>;
      }) : children}
    </PresentationSlot>
  </ItemContext.Provider>;
}
ArticleKickerRoot.displayName = 'ArticleKicker';

function ArticleKickerItem(allProps: ArticleKickerItemProps) {
  const parent = useContext(ItemContext);
  const template = repeatedTemplate(parent.slotProps?.item);
  const { href, renderLink, component, slots, slotProps, children, ...props } = {
    ...template, ...allProps,
    className: [template?.className, allProps.className].filter(Boolean).join(' ') || undefined,
    style: { ...template?.style, ...allProps.style },
  };
  if (!isRenderable(children)) return null;
  if (href !== undefined || renderLink) {
    const link = slotProps?.link;
    return <PresentationSlot {...props as ComponentPropsWithRef<'a'>} element="a" component={slots?.link ?? slots?.root ?? component ?? parent.slots?.item} slotProps={link} templateProps={slotProps?.root} renderLink={renderLink} href={href} marker="article-kicker-item" styles={articleLinkStyle}>{children}</PresentationSlot>;
  }
  return <PresentationSlot {...props as ComponentPropsWithRef<'span'>} element="span" component={slots?.root ?? component ?? parent.slots?.item} slotProps={slotProps?.root} marker="article-kicker-item">{children}</PresentationSlot>;
}
ArticleKickerItem.displayName = 'ArticleKicker.Item';
export const ArticleKicker = Object.assign(ArticleKickerRoot, { Item: ArticleKickerItem });
