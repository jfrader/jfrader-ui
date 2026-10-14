// Semantics: one `role="group"` root named by `aria-labelledby`, `aria-label`, or fallback `label`.
// Each visible member is a presentational span wrapping an `Avatar` with `role="img"`.
// If hidden members exist, an overflow circle is rendered with `role="img"` and accessible name
// from `getOverflowLabel`, with visible count aria-hidden.
// A visually hidden summary span describes the total member count once for assistive tech.
// Not interactive; skips tab sequence.
import { useId, type ComponentPropsWithRef } from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type SerializedStyles, type Theme } from '../../styling/css';
import { FORCED_COLORS } from '../../styling/media';
import { WithSx, type SxProps } from '../../styling/sx';
import { visuallyHiddenStyle } from '../../styling/visually-hidden';
import { numberFormatter } from '../../utils/intl';
import { Avatar, type AvatarProps, type AvatarSize, type AvatarStatus } from '../avatar';

export interface AvatarGroupMember {
  id: string;
  name: string;
  src?: string;
  status?: AvatarStatus;
  statusLabel?: string;
}

export interface AvatarGroupPartProps {
  className?: string;
  css?: Interpolation<Theme>;
}

export interface AvatarGroupProps
  extends Omit<ComponentPropsWithRef<'div'>, 'children' | 'role'>,
    SxProps {
  /** People in display order. Treat this array as immutable. */
  members: readonly AvatarGroupMember[];
  /** Maximum number of visible people; overflow does not consume a person slot. Defaults to 4. */
  max?: number;
  /** Size for avatars and the overflow count circle. Defaults to 'md'. */
  size?: AvatarSize;
  /** Fallback accessible name for the group landmark. Defaults to 'Team members'. */
  label?: string;
  /** Locale for counts. Set it for SSR; otherwise uses the environment's Intl locale. */
  locale?: Intl.LocalesArgument;
  /** Formats the accessible name of the overflow image. Defaults to English plural wording. */
  getOverflowLabel?: (hidden: number, formatted: string) => string;
  /** Formats the total count summary description. Defaults to English plural wording. */
  getSummaryLabel?: (total: number, formatted: string) => string;
  /** Style overrides for internal parts. */
  slotProps?: {
    member?: AvatarGroupPartProps;
    overflow?: AvatarGroupPartProps;
    summary?: AvatarGroupPartProps;
  };
  /** Style overrides for each Avatar. Cannot override id/name/status. */
  avatarProps?: Pick<AvatarProps, 'slotProps' | 'sx' | 'className'>;
}

const defaultPluralRules = new Intl.PluralRules('en');

function defaultGetOverflowLabel(hidden: number, formatted: string): string {
  return defaultPluralRules.select(hidden) === 'one'
    ? `${formatted} more member`
    : `${formatted} more members`;
}

function defaultGetSummaryLabel(total: number, formatted: string): string {
  return defaultPluralRules.select(total) === 'one'
    ? `${formatted} member`
    : `${formatted} members`;
}

const rootStyle = css({
  position: 'relative',
  display: 'inline-flex',
  alignItems: 'center',
  flexWrap: 'nowrap',
  minInlineSize: 0,
  verticalAlign: 'middle',
});

// Overlap is a maximum-safe -4px: deeper overlaps clip the initials of the covered circle
// (verified in-browser at DPR 4: -8px cut GH by 2.3px and MH by 3.7px at md).
const memberStyle = css({
  position: 'relative',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  borderRadius: vars.radius.full,
  verticalAlign: 'middle',
  '&:not(:first-of-type)': {
    marginInlineStart: `calc(-1 * ${vars.space[1]})`,
  },
});

const avatarSeparationStyle = css({
  boxSizing: 'border-box',
  border: `2px solid ${vars.color.surface}`,
  [FORCED_COLORS]: {
    borderColor: 'Canvas',
  },
});

const overflowBaseStyle = css({
  position: 'relative',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  boxSizing: 'border-box',
  borderRadius: vars.radius.full,
  backgroundColor: vars.color.surfaceHover,
  color: vars.color.text,
  fontWeight: vars.fontWeight.medium,
  fontVariantNumeric: 'tabular-nums',
  lineHeight: 1,
  whiteSpace: 'nowrap',
  userSelect: 'none',
  verticalAlign: 'middle',
  border: `2px solid ${vars.color.surface}`,
  '&:not(:first-of-type)': {
    marginInlineStart: `calc(-1 * ${vars.space[1]})`,
  },
  [FORCED_COLORS]: {
    borderColor: 'Canvas',
    color: 'CanvasText',
    backgroundColor: 'Canvas',
  },
});

// The size token is a minimum: longer formatted counts widen the circle into a pill.
const overflowSizeStyles: Record<AvatarSize, SerializedStyles> = {
  sm: css({
    minInlineSize: vars.space[6],
    blockSize: vars.space[6],
    paddingInline: `calc(${vars.space[1]} / 2)`,
    fontSize: vars.textSize.xs,
  }),
  md: css({
    minInlineSize: vars.space[8],
    blockSize: vars.space[8],
    paddingInline: vars.space[1],
    fontSize: vars.textSize.sm,
  }),
  lg: css({
    minInlineSize: vars.space[10],
    blockSize: vars.space[10],
    paddingInline: vars.space[1],
    fontSize: vars.textSize.md,
  }),
};

export function AvatarGroup({
  ref,
  members,
  max = 4,
  size = 'md',
  label = 'Team members',
  locale,
  getOverflowLabel = defaultGetOverflowLabel,
  getSummaryLabel = defaultGetSummaryLabel,
  slotProps,
  avatarProps,
  className,
  sx,
  ...rest
}: AvatarGroupProps) {
  const summaryId = useId();

  const normalizedMax =
    typeof max === 'number' && Number.isFinite(max)
      ? Math.max(0, Math.floor(max))
      : 4;

  const totalCount = members.length;
  const visibleMembers = members.slice(0, normalizedMax);
  const hiddenCount = totalCount - visibleMembers.length;
  const hasOverflow = hiddenCount > 0;

  const numberFormat = numberFormatter(locale);
  const formattedHidden = numberFormat.format(hiddenCount);
  const formattedTotal = numberFormat.format(totalCount);

  const overflowLabel = getOverflowLabel(hiddenCount, formattedHidden);
  const summaryLabel = getSummaryLabel(totalCount, formattedTotal);

  // A consumer aria-label is always kept; only the fallback `label` yields to aria-labelledby.
  const hasLabelledBy = Boolean(rest['aria-labelledby']?.trim());
  const resolvedAriaLabel = rest['aria-label'] ?? (hasLabelledBy ? undefined : label);

  const externalDescribedBy = rest['aria-describedby'];
  const ariaDescribedBy = [externalDescribedBy, summaryId].filter(Boolean).join(' ');

  return (
    <WithSx className={className} styles={rootStyle} sx={sx}>
      {(className) => (
        <div
          {...rest}
          ref={ref}
          data-ui="avatar-group"
          role="group"
          aria-label={resolvedAriaLabel}
          aria-describedby={ariaDescribedBy}
          className={className}
        >
          {visibleMembers.map((member) => (
            <span
              key={member.id}
              data-ui="avatar-group-member"
              className={slotProps?.member?.className}
              css={[memberStyle, slotProps?.member?.css]}
            >
              <Avatar
                size={size}
                name={member.name}
                src={member.src}
                status={member.status}
                statusLabel={member.statusLabel}
                slotProps={avatarProps?.slotProps}
                className={avatarProps?.className}
                sx={[avatarSeparationStyle, avatarProps?.sx]}
              />
            </span>
          ))}
          {hasOverflow && (
            <span
              data-ui="avatar-group-overflow"
              role="img"
              aria-label={overflowLabel}
              className={slotProps?.overflow?.className}
              css={[overflowBaseStyle, overflowSizeStyles[size], slotProps?.overflow?.css]}
            >
              <span aria-hidden="true">+{formattedHidden}</span>
            </span>
          )}
          <span
            id={summaryId}
            data-ui="avatar-group-summary"
            className={slotProps?.summary?.className}
            css={[visuallyHiddenStyle, slotProps?.summary?.css]}
          >
            {summaryLabel}
          </span>
        </div>
      )}
    </WithSx>
  );
}

AvatarGroup.displayName = 'AvatarGroup';
