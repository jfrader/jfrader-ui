import { useId, type ComponentPropsWithRef, type ComponentType, type ReactNode } from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { FORCED_COLORS } from '../../styling/media';
import type { SxProps } from '../../styling/sx';
import { PresentationSlot, type PresentationProps } from '../../utils/presentation-slot';
import { numberFormatter } from '../../utils/intl';
import { isRenderable } from '../../utils/renderable';
import { Card, type CardHeadingLevel, type CardPartProps, type CardVariant } from '../card';
import { Pill, type PillTone } from '../pill';

export interface MetricCardSlotProps {
  /** Props for the outer div. */
  root?: Omit<PresentationProps<'div'>, 'children'>;
  /** Card surface element; renders `Card`. */
  surface?: CardPartProps;
  /** Header container wrapping the metric label and delta pill. */
  header?: CardPartProps;
  /** Heading element displaying the metric name. */
  label?: CardPartProps;
  /** Container element displaying the formatted metric value. */
  value?: CardPartProps;
  /** Trend pill element displaying change; renders `Pill`. */
  delta?: CardPartProps;
  /** Paragraph element displaying supplementary metric details. */
  description?: CardPartProps;
}

export interface MetricCardSlots {
  /** Replaces the outer div; forwards its props, ref and className. */
  root?: ComponentType<ComponentPropsWithRef<'div'>>;
  /** Replaces the card surface. */
  surface?: ComponentType<CardPartProps & ComponentPropsWithRef<typeof Card>>;
  /** Replaces the header container. */
  header?: ComponentType<CardPartProps & ComponentPropsWithRef<'div'>>;
  /** Replaces the metric heading. Receives `headingLevel`. */
  label?: ComponentType<CardPartProps & ComponentPropsWithRef<'h3'> & { headingLevel?: CardHeadingLevel }>;
  /** Replaces the metric value container. */
  value?: ComponentType<CardPartProps & ComponentPropsWithRef<'div'>>;
  /** Replaces the change pill. */
  delta?: ComponentType<CardPartProps & ComponentPropsWithRef<typeof Pill>>;
  /** Replaces the description paragraph. */
  description?: ComponentType<CardPartProps & ComponentPropsWithRef<'p'>>;
}

export interface MetricCardProps extends Omit<ComponentPropsWithRef<'div'>, 'children'>, SxProps {
  /** Names the metric in the card heading. */
  label: ReactNode;
  /** Sets the number to format. Null and non-finite values show `missingValueLabel`. */
  value: number | null;
  /** Adds supplementary text below the value and describes the card for assistive technology. */
  description?: ReactNode;
  /** Sets the metric heading level. Defaults to `3`. */
  headingLevel?: CardHeadingLevel;
  /** Sets the card surface treatment. Defaults to `raised`. */
  variant?: CardVariant;
  /** Set locale to match server and client output. */
  locale?: Intl.LocalesArgument;
  /** Percent values are fractions; currency formatting requires a currency code. Invalid options throw. */
  formatOptions?: Intl.NumberFormatOptions;
  /** Appends a unit label after a finite formatted value. */
  unitLabel?: string;
  /** Shows a signed change pill. Omitted and non-finite values hide it. */
  delta?: number;
  /** Nonzero deltas always have a sign, including when signDisplay is 'never'. */
  deltaFormatOptions?: Intl.NumberFormatOptions;
  /** Sets the change pill color independently of its direction. Defaults to `neutral`. */
  deltaTone?: PillTone;
  /** Appends context after the formatted change inside the pill. */
  deltaDescription?: string;
  /** Marks the card as busy without replacing its content. Defaults to `false`. */
  loading?: boolean;
  /** Replaces null or non-finite metric values. Defaults to "Unavailable". */
  missingValueLabel?: string;
  /** Replaces the root, surface and metric content elements. */
  slots?: MetricCardSlots;
  /** Shorthand for slots.root; slots.root takes precedence. */
  component?: MetricCardSlots['root'];
  /** Applies props and styles to the named card parts. */
  slotProps?: MetricCardSlotProps;
}

const rootStyle = css({ minInlineSize: 0 });
const surfaceStyle = css({ display: 'grid', gap: vars.space[2], overflowWrap: 'anywhere' });
const headerStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: vars.space[2],
  minInlineSize: 0,
});
const labelStyle = css({
  margin: 0,
  minInlineSize: 0,
  fontSize: vars.textSize.sm,
  fontWeight: vars.fontWeight.semibold,
  lineHeight: vars.lineHeight.base,
  color: vars.color.text,
});
const valueStyle = css({
  minInlineSize: 0,
  fontFamily: vars.font.sans,
  fontSize: vars.textSize['3xl'],
  fontWeight: vars.fontWeight.semibold,
  lineHeight: vars.lineHeight.tight,
  fontVariantNumeric: 'tabular-nums',
});
const deltaStyle = css({
  gap: vars.space[1],
  minInlineSize: 0,
  maxInlineSize: '100%',
  blockSize: 'auto',
  minBlockSize: vars.space[5],
  paddingBlock: vars.space[1],
  whiteSpace: 'normal',
  lineHeight: vars.lineHeight.base,
  border: '1px solid transparent',
  [FORCED_COLORS]: { borderColor: 'CanvasText' },
});
const descriptionStyle = css({
  margin: 0,
  minInlineSize: 0,
  fontSize: vars.textSize.sm,
  lineHeight: vars.lineHeight.base,
  color: vars.color.textMuted,
});

/** Show a heading and number. Read-only; Tab skips it. No live region or value animation. */
export function MetricCard({
  ref,
  label,
  value,
  description,
  headingLevel = 3,
  variant = 'raised',
  locale,
  formatOptions,
  unitLabel,
  delta,
  deltaFormatOptions,
  deltaTone = 'neutral',
  deltaDescription,
  loading = false,
  missingValueLabel = 'Unavailable',
  slots,
  component,
  slotProps,
  className,
  sx,
  role,
  'aria-labelledby': labelledBy,
  'aria-describedby': describedBy,
  'aria-busy': busy,
  ...rest
}: MetricCardProps) {
  const labelId = `${useId()}-label`;
  const descriptionId = `${useId()}-description`;
  const hasLabel = isRenderable(label) && label !== '';
  const hasDescription = isRenderable(description) && description !== '';
  const normalizedDelta =
    delta !== undefined && Number.isFinite(delta) ? (delta === 0 ? 0 : delta) : undefined;
  const direction =
    normalizedDelta === 0
      ? 'unchanged'
      : normalizedDelta !== undefined && normalizedDelta > 0
        ? 'up'
        : 'down';
  const Surface = slots?.surface ?? Card;
  const Header = slots?.header ?? 'div';
  // The native heading carries the level in its own name; a replacement is told the level instead.
  const Heading = slots?.label ?? (`h${headingLevel}` as const);
  const Value = slots?.value ?? 'div';
  const Delta = slots?.delta ?? Pill;
  const Description = slots?.description ?? 'p';
  const hasFiniteValue = value !== null && Number.isFinite(value);
  const formattedValue = hasFiniteValue
    ? numberFormatter(locale, formatOptions).format(value)
    : missingValueLabel;
  const formattedDelta =
    normalizedDelta !== undefined
      ? numberFormatter(locale, {
          ...deltaFormatOptions,
          signDisplay: normalizedDelta === 0 ? 'exceptZero' : 'always',
        }).format(normalizedDelta)
      : undefined;

  return (
        <PresentationSlot
          element="div"
          component={slots?.root ?? component}
          slotProps={slotProps?.root}
          styles={rootStyle}
          sx={sx}
          {...rest}
          ref={ref}
          role={role}
          className={className}
          marker="metric-card"
          aria-busy={loading || busy}
          aria-labelledby={
            [labelledBy, role === 'region' && hasLabel && labelId].filter(Boolean).join(' ') || undefined
          }
          aria-describedby={
            [describedBy, hasDescription && descriptionId].filter(Boolean).join(' ') || undefined
          }
        >
          <Surface
            variant={variant}
            className={slotProps?.surface?.className}
            css={[surfaceStyle, slotProps?.surface?.sx]}
          >
            <Header
              data-ui="metric-card-header"
              className={slotProps?.header?.className}
              css={[headerStyle, slotProps?.header?.sx]}
            >
              {hasLabel && (
                <Heading
                  id={labelId}
                  data-ui="metric-card-label"
                  {...(slots?.label ? { headingLevel } : {})}
                  className={slotProps?.label?.className}
                  css={[labelStyle, slotProps?.label?.sx]}
                >
                  {label}
                </Heading>
              )}
              {normalizedDelta !== undefined && (
                <Delta
                  tone={deltaTone}
                  data-direction={direction}
                  className={slotProps?.delta?.className}
                  css={[deltaStyle, slotProps?.delta?.sx]}
                >
                  <span aria-hidden="true">
                    {normalizedDelta === 0 ? '↔' : normalizedDelta > 0 ? '↑' : '↓'}
                  </span>
                  <span>
                    {formattedDelta}
                    {deltaDescription ? ` ${deltaDescription}` : ''}
                  </span>
                </Delta>
              )}
            </Header>
            <Value
              data-ui="metric-card-value"
              className={slotProps?.value?.className}
              css={[valueStyle, slotProps?.value?.sx]}
            >
              {formattedValue}
              {hasFiniteValue && unitLabel ? ` ${unitLabel}` : ''}
            </Value>
            {hasDescription && (
              <Description
                id={descriptionId}
                data-ui="metric-card-description"
                className={slotProps?.description?.className}
                css={[descriptionStyle, slotProps?.description?.sx]}
              >
                {description}
              </Description>
            )}
          </Surface>
        </PresentationSlot>
  );
}

MetricCard.displayName = 'MetricCard';
