// Display primitive for a view with nothing to show yet: an empty list, a search with no matches,
// first-run content. Not an APG widget: a section holding a decorative icon, a real heading, an
// optional description and caller-owned actions (native Tab order, native activation).
// The section only becomes a region landmark when the consumer names it (aria-label or
// aria-labelledby); a supplied aria-labelledby is joined with the title id. It is never a live
// region and never moves focus — the surrounding view owns result announcements and focus handoff.
// Content changes (empty → success) replace text in place, so there is no motion to reduce.
import { useId, type ComponentPropsWithRef, type ComponentType, type ReactNode } from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type SerializedStyles, type Theme } from '../../styling/css';
import type { SxProps } from '../../styling/sx';
import { PresentationSlot, type PresentationProps } from '../../utils/presentation-slot';
import { isRenderable } from '../../utils/renderable';
import type { CardHeadingLevel } from '../card';

export type EmptyStateVariant = 'centered' | 'inline';

export interface EmptyStatePartProps {
  className?: string;
  sx?: Interpolation<Theme>;
}

export interface EmptyStateSlotProps {
  /** Props for the outer section. */
  root?: Omit<PresentationProps<'section'>, 'children'>;
  /** Container wrapping the decorative icon. */
  icon?: EmptyStatePartProps;
  /** Container wrapping the title and description text. */
  content?: EmptyStatePartProps;
  /** Heading element displaying the title. */
  title?: EmptyStatePartProps;
  /** Paragraph displaying the explanatory description. */
  description?: EmptyStatePartProps;
  /** Container wrapping action buttons or links. */
  action?: EmptyStatePartProps;
}

export interface EmptyStateSlots {
  /** Replaces the outer section; forwards its props, ref and className. */
  root?: ComponentType<ComponentPropsWithRef<'section'>>;
  /** Container wrapping the decorative icon. */
  icon?: ComponentType<ComponentPropsWithRef<'div'>>;
  /** Container wrapping the title and description text. */
  content?: ComponentType<ComponentPropsWithRef<'div'>>;
  /** Heading element displaying the title. Receives `headingLevel`. */
  title?: ComponentType<ComponentPropsWithRef<'h3'> & { headingLevel?: CardHeadingLevel }>;
  /** Paragraph displaying the explanatory description. */
  description?: ComponentType<ComponentPropsWithRef<'p'>>;
  /** Container wrapping action buttons or links. */
  action?: ComponentType<ComponentPropsWithRef<'div'>>;
}

export interface EmptyStateProps extends Omit<ComponentPropsWithRef<'section'>, 'title' | 'children'>, SxProps {
  /** Visible heading. */
  title: ReactNode;
  description?: ReactNode;
  /** Decorative; hidden from assistive tech. Never put interactive content here. */
  icon?: ReactNode;
  /** Caller-owned controls (Button, link), rendered as given. */
  action?: ReactNode;
  headingLevel?: CardHeadingLevel;
  variant?: EmptyStateVariant;
  slots?: EmptyStateSlots;
  /** Shorthand for slots.root; slots.root takes precedence. */
  component?: EmptyStateSlots['root'];
  slotProps?: EmptyStateSlotProps;
}

// Comfortable reading measure for the description, relative to the text size.
const DESCRIPTION_MEASURE = '40ch';
// Inline content keeps this basis before the actions wrap below it.
const INLINE_CONTENT_BASIS = '24ch';

const rootStyle = css({
  boxSizing: 'border-box',
  display: 'flex',
  gap: vars.space[4],
  minInlineSize: 0,
  fontFamily: vars.font.sans,
  lineHeight: vars.lineHeight.base,
  color: vars.color.text,
});

const variantStyles: Record<EmptyStateVariant, SerializedStyles> = {
  centered: css({
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    paddingBlock: vars.space[8],
    paddingInline: vars.space[5],
  }),
  inline: css({
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    textAlign: 'start',
    paddingBlock: vars.space[4],
    paddingInline: vars.space[5],
  }),
};

const iconStyle = css({
  boxSizing: 'border-box',
  display: 'grid',
  placeItems: 'center',
  flexShrink: 0,
  inlineSize: vars.space[12],
  blockSize: vars.space[12],
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.md,
  backgroundColor: vars.color.surfaceHover,
  color: vars.color.textMuted,
  '& > svg': { inlineSize: vars.space[6], blockSize: vars.space[6] },
});

const contentStyle = css({
  display: 'grid',
  gap: vars.space[2],
  minInlineSize: 0,
});

const contentVariantStyles: Record<EmptyStateVariant, SerializedStyles> = {
  centered: css({ justifyItems: 'center', maxInlineSize: '100%' }),
  inline: css({ flex: `1 1 ${INLINE_CONTENT_BASIS}` }),
};

const titleStyle = css({
  margin: 0,
  fontSize: vars.textSize.md,
  fontWeight: vars.fontWeight.medium,
  lineHeight: vars.lineHeight.base,
  color: vars.color.text,
  textWrap: 'balance',
  overflowWrap: 'anywhere',
});

const descriptionStyle = css({
  margin: 0,
  maxInlineSize: DESCRIPTION_MEASURE,
  fontSize: vars.textSize.sm,
  color: vars.color.textMuted,
  textWrap: 'pretty',
  overflowWrap: 'anywhere',
});

const actionStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: vars.space[3],
});

const actionVariantStyles: Record<EmptyStateVariant, SerializedStyles | undefined> = {
  centered: css({ justifyContent: 'center' }),
  inline: undefined,
};

function joinIds(...ids: (string | false | undefined)[]) {
  return ids.filter(Boolean).join(' ') || undefined;
}

/**
 * Show a message and action when content is empty. Use Skeleton while loading and Alert for an
 * error alongside existing content. Supply copy, translations and result announcements.
 */
export function EmptyState({
  ref,
  title,
  description,
  icon,
  action,
  headingLevel = 3,
  variant = 'centered',
  slots,
  component,
  slotProps,
  className,
  sx,
  'aria-labelledby': labelledBy,
  'aria-describedby': describedBy,
  ...rest
}: EmptyStateProps) {
  const id = useId();
  const titleId = `${id}-title`;
  const descriptionId = `${id}-description`;
  const hasTitle = isRenderable(title);
  const hasDescription = isRenderable(description);
  const Icon = slots?.icon ?? 'div';
  const Content = slots?.content ?? 'div';
  // The native heading carries the level in its own name; a replacement is told the level instead.
  const Heading = slots?.title ?? (`h${headingLevel}` as const);
  const Description = slots?.description ?? 'p';
  const Action = slots?.action ?? 'div';

  return (
        <PresentationSlot
          element="section"
          component={slots?.root ?? component}
          slotProps={{ ...slotProps?.root, 'data-variant': variant }}
          styles={[rootStyle, variantStyles[variant]]}
          sx={sx}
          {...rest}
          ref={ref}
          marker="empty-state"
          aria-labelledby={labelledBy ? joinIds(labelledBy, hasTitle && titleId) : undefined}
          aria-describedby={joinIds(describedBy, hasDescription && descriptionId)}
          className={className}
        >
          {isRenderable(icon) && (
            <Icon
              data-ui="empty-state-icon"
              aria-hidden="true"
              className={slotProps?.icon?.className}
              css={[iconStyle, slotProps?.icon?.sx]}
            >
              {icon}
            </Icon>
          )}
          <Content
            data-ui="empty-state-content"
            className={slotProps?.content?.className}
            css={[contentStyle, contentVariantStyles[variant], slotProps?.content?.sx]}
          >
            {hasTitle && (
              <Heading
                id={titleId}
                {...(slots?.title ? { headingLevel } : {})}
                className={slotProps?.title?.className}
                css={[titleStyle, slotProps?.title?.sx]}
              >
                {title}
              </Heading>
            )}
            {hasDescription && (
              <Description
                id={descriptionId}
                className={slotProps?.description?.className}
                css={[descriptionStyle, slotProps?.description?.sx]}
              >
                {description}
              </Description>
            )}
          </Content>
          {isRenderable(action) && (
            <Action
              data-ui="empty-state-action"
              className={slotProps?.action?.className}
              css={[actionStyle, actionVariantStyles[variant], slotProps?.action?.sx]}
            >
              {action}
            </Action>
          )}
        </PresentationSlot>
  );
}

EmptyState.displayName = 'EmptyState';
