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
export type ArticleSectionHeadingSlots = Omit<PresentationSlots<Anatomy>, 'heading'> & { heading?: ComponentType<PresentationHeadingProps> };
export type ArticleSectionHeadingSlotProps = PresentationParts<Anatomy>;
export type ArticleSectionHeadingProps = Omit<ComponentPropsWithRef<'header'>, 'title' | 'children'> & SxProps & {
  /** Sets the section heading content. Empty content renders nothing. */
  title: ReactNode;
  /** Sets the title's heading level. Defaults to `2`. */
  level?: ArticleHeadingLevel;
  /** Adds or removes the rule below the header. Defaults to `ruled`. */
  variant?: 'ruled' | 'plain';
  /** Adds a topic label above the title. */
  kicker?: ReactNode;
  /** Makes the title a link to this destination. */
  href?: string;
  /** Adds content below the title, such as a section action. */
  accessory?: ReactNode;
  /** Replaces the outer header element. `slots.root` takes precedence. */
  component?: ArticleSectionHeadingSlots['root'];
  /** Applies props and styles to the named heading parts. */
  slotProps?: ArticleSectionHeadingSlotProps;
} & ({
  /** Renders the title link with a custom link renderer instead of `slots.link`. */
  renderLink: RenderArticleLink;
  /** Replaces the heading parts. Use `renderLink` to replace the title link in this mode. */
  slots?: Omit<ArticleSectionHeadingSlots, 'link'> & { link?: never }
} | {
  renderLink?: never;
  /** Replaces the header, kicker, title, link and accessory elements. */
  slots?: ArticleSectionHeadingSlots
});
const rootStyle = css({ minInlineSize: 0, display: 'flex', flexDirection: 'column', alignItems: 'start', gap: vars.space[3], color: vars.color.text, overflowWrap: 'anywhere' });
const ruledStyle = css({ paddingBlockEnd: vars.space[3], borderBlockEnd: `${vars.editorial.rule.strong} solid ${articleRule}` });
const headingStyle = css({ margin: 0, fontFamily: articleHeadingFont, fontSize: vars.editorial.headline.secondary, fontWeight: vars.fontWeight.semibold, lineHeight: vars.lineHeight.tight, overflowWrap: 'anywhere', maxInlineSize: '100%' });
const accessoryStyle = css({ minInlineSize: 0, maxInlineSize: '100%' });

/** Introduce an article section with a title and optional link. */
export function ArticleSectionHeading({ title, level = 2, variant = 'ruled', kicker, href, renderLink, accessory, component, slots, slotProps, ...props }: ArticleSectionHeadingProps) {
  if (!isRenderable(title) || title === '') return null;
  return <PresentationSlot {...props} element="header" component={slots?.root ?? component} slotProps={slotProps?.root} marker="article-section-heading" data-variant={variant} styles={[rootStyle, variant === 'ruled' && ruledStyle]}>
    {isRenderable(kicker) && <PresentationSlot element="p" component={slots?.kicker} slotProps={slotProps?.kicker} marker="article-section-heading-kicker" styles={articleLabelStyle}>{kicker}</PresentationSlot>}
    <PresentationSlot element={`h${level}`} component={slots?.heading} slotProps={slotProps?.heading} marker="article-section-heading-title" styles={headingStyle} {...(slots?.heading ? { level } : {})}>
      {href !== undefined || renderLink ? <PresentationSlot element="a" component={slots?.link} slotProps={slotProps?.link} renderLink={renderLink} href={href} marker="article-section-heading-link" styles={articleLinkStyle}>{title}</PresentationSlot> : title}
    </PresentationSlot>
    {isRenderable(accessory) && <PresentationSlot element="div" component={slots?.accessory} slotProps={slotProps?.accessory} marker="article-section-heading-accessory" styles={accessoryStyle}>{accessory}</PresentationSlot>}
  </PresentationSlot>;
}
ArticleSectionHeading.displayName = 'ArticleSection.Heading';
