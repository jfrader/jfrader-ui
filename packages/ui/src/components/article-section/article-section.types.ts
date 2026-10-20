import type { ComponentPropsWithRef, ComponentType, ReactNode } from 'react';
import type { SxProps } from '../../styling/sx';
import type { ArticleHeadingLevel, PresentationParts, PresentationSlots, PrintedTime } from '../../utils/presentation-slot';
import type { ArticleContentProps, ArticleProps } from '../article';
import type { ArticleListItemProps, ArticleListProps } from '../article-list';
import type { ArticleSectionHeadingProps } from './article-section-heading';

/** Prepared article content in the order it should appear in the section. */
export type ArticleSectionEntry = ArticleContentProps & {
  /** Stable collection key; not used as a DOM id. */
  id: string;
  /** Topic shown in headline-tag rows. */
  label?: ReactNode;
  /** Location shown in headline-place rows. */
  place?: ReactNode;
  /** Printed time for time-column cards and timed headline rows. */
  time?: PrintedTime;
};

type Anatomy = { root: 'section'; heading: 'header'; band: 'div'; article: 'article'; list: 'ul'; listItem: 'li' };
type HeadingTemplate<P> = P extends unknown ? Omit<P, 'title'> : never;
export type ArticleSectionSlots = PresentationSlots<Anatomy>;
export type ArticleSectionSlotProps = {
  root?: PresentationParts<Anatomy>['root'];
  /** Props for the generated ArticleSection.Heading. */
  heading?: HeadingTemplate<ArticleSectionHeadingProps>;
  band?: PresentationParts<Anatomy>['band'];
  /** Shared Article props; article content and planned treatments remain authoritative. */
  article?: Omit<Partial<ArticleProps>, keyof ArticleContentProps | 'children'>;
  /** Shared ArticleList props for generated headline lists. */
  list?: Omit<ArticleListProps, 'items' | 'children'>;
  /** Shared props for generated headline rows. */
  listItem?: Omit<Partial<ArticleListItemProps>, 'headline'>;
};

export type ArticleSectionProps = Omit<ComponentPropsWithRef<'section'>, 'children'> & SxProps & {
  /** Ordered articles; an empty collection renders nothing. */
  articles: readonly ArticleSectionEntry[];
  /** Section title. Omit it to render the articles without a header. */
  heading?: ReactNode;
  /** Article headline level. Defaults to one below the section heading, or 2 without a heading. */
  level?: ArticleHeadingLevel;
  /** Replaces the outer section element. `slots.root` takes precedence. */
  component?: ComponentType<ComponentPropsWithRef<'section'>>;
  /** Replaces the section, heading, bands, articles and list elements. */
  slots?: ArticleSectionSlots;
  /** Applies shared props and styles to the generated section parts. */
  slotProps?: ArticleSectionSlotProps;
  /** Disallows direct children. Supply content through `articles` and `heading`. */
  children?: never;
};
