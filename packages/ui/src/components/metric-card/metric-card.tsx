import { useId, type ComponentPropsWithRef, type ComponentType, type ReactNode } from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { FORCED_COLORS } from '../../styling/media';
import { WithSx, type SxProps } from '../../styling/sx';
import { numberFormatter } from '../../utils/intl';
import { isRenderable } from '../../utils/renderable';
import { Card, type CardHeadingLevel, type CardPartProps, type CardVariant } from '../card';
import { Pill, type PillTone } from '../pill';

export interface MetricCardSlotProps {
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
  /** Replaces the card surface. */
  surface?: ComponentType<CardPartProps & ComponentPropsWithRef<typeof Card>>;
  /** Replaces the header container. */
  header?: ComponentType<CardPartProps & ComponentPropsWithRef<'div'>>;
  /** Replaces the metric heading. */
  label?: ComponentType<CardPartProps & ComponentPropsWithRef<'h3'>>;
  /** Replaces the metric value container. */
  value?: ComponentType<CardPartProps & ComponentPropsWithRef<'div'>>;
  /** Replaces the change pill. */
  delta?: ComponentType<CardPartProps & ComponentPropsWithRef<typeof Pill>>;
  /** Replaces the description paragraph. */
  description?: ComponentType<CardPartProps & ComponentPropsWithRef<'p'>>;
}

export interface MetricCardProps extends Omit<ComponentPropsWithRef<'div'>, 'children'>, SxProps {
  label: ReactNode;
  value: number | null;
  description?: ReactNode;
  headingLevel?: CardHeadingLevel;
  variant?: CardVariant;
  /** Set locale to match server and client output. */
  locale?: Intl.LocalesArgument;
  /** Percent values are fractions; currency formatting requires a currency code. Invalid options throw. */
  formatOptions?: Intl.NumberFormatOptions;
  unitLabel?: string;
  delta?: number;
  /** Nonzero deltas always have a sign, including when signDisplay is 'never'. */
  deltaFormatOptions?: Intl.NumberFormatOptions;
  deltaTone?: PillTone;
  deltaDescription?: string;
  loading?: boolean;
  missingValueLabel?: string;
  slots?: MetricCardSlots;
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
    <WithSx className={className} styles={rootStyle} sx={sx}>
      {(className) => (
        <div
          {...rest}
          ref={ref}
          role={role}
          className={className}
          data-ui="metric-card"
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
            css={[surfaceStyle, slotProps?.surface?.css]}
          >
            <Header
              data-ui="metric-card-header"
              className={slotProps?.header?.className}
              css={[headerStyle, slotProps?.header?.css]}
            >
              {hasLabel && (
                <Heading
                  id={labelId}
                  data-ui="metric-card-label"
                  className={slotProps?.label?.className}
                  css={[labelStyle, slotProps?.label?.css]}
                >
                  {label}
                </Heading>
              )}
              {normalizedDelta !== undefined && (
                <Delta
                  tone={deltaTone}
                  data-direction={direction}
                  className={slotProps?.delta?.className}
                  css={[deltaStyle, slotProps?.delta?.css]}
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
              css={[valueStyle, slotProps?.value?.css]}
            >
              {formattedValue}
              {hasFiniteValue && unitLabel ? ` ${unitLabel}` : ''}
            </Value>
            {hasDescription && (
              <Description
                id={descriptionId}
                data-ui="metric-card-description"
                className={slotProps?.description?.className}
                css={[descriptionStyle, slotProps?.description?.css]}
              >
                {description}
              </Description>
            )}
          </Surface>
        </div>
      )}
    </WithSx>
  );
}

MetricCard.displayName = 'MetricCard';
