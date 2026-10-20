'use client';

import type { ComponentPropsWithRef, ComponentType, ReactNode } from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import type { SxProps } from '../../styling/sx';
import { articleHeadingFont, articleLabelStyle, articleLinkStyle, articleRule } from '../../styling/article';
import { isRenderable } from '../../utils/renderable';
import { PresentationSlot, type ArticleHeadingLevel, type PresentationHeadingProps, type PresentationParts, type PresentationSlots, type RenderArticleLink } from '../../utils/presentation-slot';

type Anatomy = {
  /** Renders a `header` by default. */
  root: 'header';
  kicker: 'p';
  heading: 'h2';
  link: 'a';
  accessory: 'div';
};
export type SectionHeadingSlots = Omit<PresentationSlots<Anatomy>, 'heading'> & { heading?: ComponentType<PresentationHeadingProps> };
export type SectionHeadingSlotProps = PresentationParts<Anatomy>;
export type SectionHeadingProps = Omit<ComponentPropsWithRef<'header'>, 'title' | 'children'> & SxProps & {
  title: ReactNode;
  level?: ArticleHeadingLevel;
  variant?: 'ruled' | 'plain';
  kicker?: ReactNode;
  href?: string;
  accessory?: ReactNode;
  component?: SectionHeadingSlots['root'];
  slotProps?: SectionHeadingSlotProps;
} & ({ renderLink: RenderArticleLink; slots?: Omit<SectionHeadingSlots, 'link'> & { link?: never } } | { renderLink?: never; slots?: SectionHeadingSlots });
const rootStyle = css({ minInlineSize: 0, display: 'flex', flexDirection: 'column', alignItems: 'start', gap: vars.space[3], color: vars.color.text, overflowWrap: 'anywhere' });
const ruledStyle = css({ paddingBlockEnd: vars.space[3], borderBlockEnd: `${vars.editorial.rule.strong} solid ${articleRule}` });
const headingStyle = css({ margin: 0, fontFamily: articleHeadingFont, fontSize: vars.editorial.headline.secondary, fontWeight: vars.fontWeight.semibold, lineHeight: vars.lineHeight.tight, overflowWrap: 'anywhere', maxInlineSize: '100%' });
const accessoryStyle = css({ minInlineSize: 0, maxInlineSize: '100%' });

/** Introduce an article section with a title and optional link. */
export function SectionHeading({ title, level = 2, variant = 'ruled', kicker, href, renderLink, accessory, component, slots, slotProps, ...props }: SectionHeadingProps) {
  if (!isRenderable(title) || title === '') return null;
  return <PresentationSlot {...props} element="header" component={slots?.root ?? component} slotProps={slotProps?.root} marker="section-heading" data-variant={variant} styles={[rootStyle, variant === 'ruled' && ruledStyle]}>
    {isRenderable(kicker) && <PresentationSlot element="p" component={slots?.kicker} slotProps={slotProps?.kicker} marker="section-heading-kicker" styles={articleLabelStyle}>{kicker}</PresentationSlot>}
    <PresentationSlot element={`h${level}`} component={slots?.heading} slotProps={slotProps?.heading} marker="section-heading-heading" styles={headingStyle} {...(slots?.heading ? { level } : {})}>
      {href !== undefined || renderLink ? <PresentationSlot element="a" component={slots?.link} slotProps={slotProps?.link} renderLink={renderLink} href={href} marker="section-heading-link" styles={articleLinkStyle}>{title}</PresentationSlot> : title}
    </PresentationSlot>
    {isRenderable(accessory) && <PresentationSlot element="div" component={slots?.accessory} slotProps={slotProps?.accessory} marker="section-heading-accessory" styles={accessoryStyle}>{accessory}</PresentationSlot>}
  </PresentationSlot>;
}
SectionHeading.displayName = 'SectionHeading';
