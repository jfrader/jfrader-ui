'use client';

import {
  createContext,
  useContext,
  useId,
  useLayoutEffect,
  useMemo,
  useState,
  type ComponentPropsWithRef,
  type ComponentPropsWithoutRef,
  type ReactNode,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'motion/react';
import { base } from '@jfrader/tokens';
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type SerializedStyles, type Theme } from '../../styling/css';
import { FORCED_COLORS } from '../../styling/media';
import { visuallyHiddenStyle } from '../../styling/visually-hidden';
import { WithSx, type SxProps } from '../../styling/sx';
import { isRenderable } from '../../utils/renderable';
import { useControlledState } from '../../utils/use-controlled-state';
import { SegmentedControl, type SegmentedControlItemProps } from '../segmented-control';

export type ToggleSubscriptionSize = 'md' | 'lg';
export type ToggleSubscriptionTone = 'neutral' | 'accent' | 'success';
type SlotProps<Element extends 'span' | 'del'> = ComponentPropsWithoutRef<Element> & {
  css?: Interpolation<Theme>;
};

export interface ToggleSubscriptionProps
  extends Omit<ComponentPropsWithRef<'div'>, 'defaultValue' | 'onChange'>, SxProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  size?: ToggleSubscriptionSize;
  tone?: ToggleSubscriptionTone;
  locale?: Intl.LocalesArgument;
}
export interface ToggleSubscriptionListProps
  extends Omit<ComponentPropsWithRef<'div'>, 'defaultValue' | 'onChange'>, SxProps {}
export interface ToggleSubscriptionLabelProps extends ComponentPropsWithRef<'span'>, SxProps {}
export interface ToggleSubscriptionItemProps extends Omit<SegmentedControlItemProps, 'accessory'> {
  badge?: ReactNode;
  activeBadge?: ReactNode;
  slotProps?: {
    label?: SlotProps<'span'>;
    badge?: SlotProps<'span'>;
    selection?: SlotProps<'span'>;
  };
}
export interface ToggleSubscriptionPriceProps
  extends Omit<ComponentPropsWithRef<'span'>, 'children'>, SxProps {
  amount: number;
  currency: string;
  locale?: Intl.LocalesArgument;
  formatOptions?: Omit<Intl.NumberFormatOptions, 'style' | 'currency'>;
  was?: number;
  period?: ReactNode;
  previousLabel?: string;
  slotProps?: {
    amount?: SlotProps<'span'>;
    previous?: SlotProps<'del'>;
    period?: SlotProps<'span'>;
  };
}

interface ToggleSubscriptionContext {
  value: string | undefined;
  emptyValue: string;
  requestChange: (value: string) => void;
  disabled: boolean;
  size: ToggleSubscriptionSize;
  tone: ToggleSubscriptionTone;
  locale: Intl.LocalesArgument | undefined;
  labels: string[];
  setLabels: Dispatch<SetStateAction<string[]>>;
  selections: ReadonlyMap<string, SlotProps<'span'>>;
  setSelections: Dispatch<SetStateAction<ReadonlyMap<string, SlotProps<'span'>>>>;
}
const Context = createContext<ToggleSubscriptionContext | null>(null);
function useToggleSubscription() {
  const context = useContext(Context);
  if (!context) throw new Error('ToggleSubscription parts must be rendered inside <ToggleSubscription>.');
  return context;
}
const rootStyle = css({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: vars.space[3],
  minInlineSize: 0,
  fontFamily: vars.font.sans,
  color: vars.color.text,
});
const listStyle = css({ minInlineSize: 0, maxInlineSize: '100%' });
const itemStyle = css({ display: 'contents' });
const labelStyle = css({
  fontSize: vars.textSize.sm,
  fontWeight: vars.fontWeight.medium,
});
const badgeStyle = css({
  display: 'inline-grid',
  border: `1px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.full,
  paddingInline: vars.space[2],
  fontSize: vars.textSize.xs,
  color: vars.color.text,
  backgroundColor: vars.color.surfaceRaised,
  [FORCED_COLORS]: {
    borderColor: 'CanvasText',
    backgroundColor: 'Canvas',
    color: 'CanvasText',
  },
});
const badgeCellStyle = css({ gridArea: '1 / 1', whiteSpace: 'nowrap' });
const sizerStyle = css({ visibility: 'hidden', pointerEvents: 'none' });
const toneStyles: Record<ToggleSubscriptionTone, SerializedStyles> = {
  neutral: css({ color: vars.color.textMuted }),
  accent: css({ borderColor: vars.color.accentText }),
  success: css({ borderColor: vars.color.success }),
};
const selectionToneStyles: Record<ToggleSubscriptionTone, SerializedStyles> = {
  neutral: css({ backgroundColor: vars.color.surfaceRaised }),
  accent: css({ backgroundColor: vars.color.accentSoft }),
  success: css({ backgroundColor: vars.color.successSoft }),
};
const forcedSelectionStyle = css({ [FORCED_COLORS]: { backgroundColor: 'Canvas' } });
const priceStyle = css({
  display: 'inline-flex',
  flexWrap: 'wrap',
  alignItems: 'baseline',
  gap: vars.space[2],
  minInlineSize: 0,
  maxInlineSize: '100%',
  overflowWrap: 'anywhere',
  fontVariantNumeric: 'tabular-nums',
});
const amountStyle = css({
  minInlineSize: 0,
  maxInlineSize: '100%',
  fontSize: vars.textSize['3xl'],
  lineHeight: vars.lineHeight.tight,
  fontWeight: vars.fontWeight.medium,
});
const visualStyle = css({
  display: 'inline-grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  maxInlineSize: '100%',
});
const priceCellStyle = css({ gridArea: '1 / 1', minInlineSize: 0 });
const previousStyle = css({ color: vars.color.textMuted, minInlineSize: 0 });
const periodStyle = css({ color: vars.color.textMuted, minInlineSize: 0 });
const PRICE_SPRING_VISUAL_DURATION = Number.parseFloat(base.motion.duration.slow) / 1000; // '240ms' -> 0.24s
const PRICE_SPRING = {
  type: 'spring',
  bounce: 0,
  visualDuration: PRICE_SPRING_VISUAL_DURATION,
} as const;

function PriceSurface({
  ref,
  nativeProps,
  ...rest
}: ComponentPropsWithRef<'span'> & { nativeProps: ComponentPropsWithoutRef<'span'> }) {
  return <span {...nativeProps} {...rest} ref={ref} data-ui="toggle-subscription-price" />;
}
const MotionPriceSurface = motion.create(PriceSurface);

function ToggleSubscriptionRoot({
  ref,
  value: valueProp,
  defaultValue,
  onValueChange,
  disabled = false,
  size = 'md',
  tone = 'success',
  locale,
  className,
  sx,
  children,
  ...rest
}: ToggleSubscriptionProps) {
  const [value, requestChange] = useControlledState(valueProp, defaultValue, onValueChange);
  const [labels, setLabels] = useState<string[]>([]);
  const [selections, setSelections] = useState<ReadonlyMap<string, SlotProps<'span'>>>(new Map());
  const emptyValue = useId();
  const context = useMemo(
    () => ({
      value,
      emptyValue,
      requestChange,
      disabled,
      size,
      tone,
      locale,
      labels,
      setLabels,
      selections,
      setSelections,
    }),
    [value, emptyValue, requestChange, disabled, size, tone, locale, labels, selections],
  );
  return (
    <Context.Provider value={context}>
      <MotionConfig reducedMotion="user">
        <WithSx className={className} styles={rootStyle} sx={sx}>
          {(className) => (
            <div {...rest} ref={ref} className={className} data-ui="toggle-subscription">
              {children}
            </div>
          )}
        </WithSx>
      </MotionConfig>
    </Context.Provider>
  );
}
ToggleSubscriptionRoot.displayName = 'ToggleSubscription';

function ToggleSubscriptionLabel({
  ref,
  id: idProp,
  className,
  sx,
  children,
  ...rest
}: ToggleSubscriptionLabelProps) {
  const { setLabels } = useToggleSubscription();
  const generatedId = useId();
  const id = idProp ?? generatedId;
  const present = isRenderable(children) && children !== '';
  useLayoutEffect(() => {
    if (!present) return;
    setLabels((labels) => [...labels, id]);
    return () => setLabels((labels) => labels.filter((label) => label !== id));
  }, [id, present, setLabels]);
  if (!present) return null;
  return (
    <WithSx className={className} styles={labelStyle} sx={sx}>
      {(className) => (
        <span {...rest} ref={ref} id={id} data-ui="toggle-subscription-label" className={className}>
          {children}
        </span>
      )}
    </WithSx>
  );
}
ToggleSubscriptionLabel.displayName = 'ToggleSubscription.Label';

function ToggleSubscriptionList({ ref, className, sx, children, ...rest }: ToggleSubscriptionListProps) {
  const context = useToggleSubscription();
  const selection = context.value === undefined ? undefined : context.selections.get(context.value);
  return (
    <div data-ui="toggle-subscription-list" css={listStyle}>
      <WithSx className={className} styles={listStyle} sx={sx}>
        {(className) => (
          <SegmentedControl
            {...rest}
            ref={ref}
            className={className}
            value={context.value ?? context.emptyValue}
            onValueChange={context.requestChange}
            disabled={context.disabled}
            size={context.size}
            variant="soft"
            slotProps={{
              selection: {
                ...selection,
                css: [selectionToneStyles[context.tone], forcedSelectionStyle, selection?.css],
              },
            }}
            aria-labelledby={
              [rest['aria-labelledby'], ...context.labels].filter(Boolean).join(' ') || undefined
            }
          >
            {children}
          </SegmentedControl>
        )}
      </WithSx>
    </div>
  );
}
ToggleSubscriptionList.displayName = 'ToggleSubscription.List';

function ToggleSubscriptionItem({
  badge,
  activeBadge,
  slotProps,
  children,
  className,
  sx,
  ...rest
}: ToggleSubscriptionItemProps) {
  const context = useToggleSubscription();
  const { setSelections } = context;
  const selection = slotProps?.selection;
  const value = rest.value;
  useLayoutEffect(() => {
    if (!selection) return;
    setSelections((current) => new Map(current).set(value, selection));
    return () =>
      setSelections((current) => {
        const next = new Map(current);
        next.delete(value);
        return next;
      });
  }, [selection, value, setSelections]);
  const currentBadge =
    context.value === rest.value && activeBadge !== undefined ? activeBadge : badge;
  const hasBadge = isRenderable(currentBadge) && currentBadge !== '';
  return (
    <span data-ui="toggle-subscription-item" css={itemStyle}>
      <WithSx className={className} sx={sx}>
        {(className) => (
          <SegmentedControl.Item
            {...rest}
            className={className}
            accessory={
              hasBadge ? (
                <span
                  {...slotProps?.badge}
                  data-ui="toggle-subscription-badge"
                  css={[badgeStyle, toneStyles[context.tone], slotProps?.badge?.css]}
                >
                  {isRenderable(badge) && badge !== '' && (
                    <span aria-hidden="true" css={[badgeCellStyle, sizerStyle]}>
                      {badge}
                    </span>
                  )}
                  {isRenderable(activeBadge) && activeBadge !== '' && (
                    <span aria-hidden="true" css={[badgeCellStyle, sizerStyle]}>
                      {activeBadge}
                    </span>
                  )}
                  <span css={badgeCellStyle}>{currentBadge}</span>
                </span>
              ) : undefined
            }
          >
            {isRenderable(children) && children !== '' && (
              <span
                {...slotProps?.label}
                data-ui="toggle-subscription-item-label"
                css={slotProps?.label?.css}
              >
                {children}
              </span>
            )}
          </SegmentedControl.Item>
        )}
      </WithSx>
    </span>
  );
}
ToggleSubscriptionItem.displayName = 'ToggleSubscription.Item';

function ToggleSubscriptionPrice({
  ref,
  amount,
  currency,
  locale: localeProp,
  formatOptions,
  was,
  period,
  previousLabel,
  slotProps,
  className,
  sx,
  ...rest
}: ToggleSubscriptionPriceProps) {
  // Validate before any hooks: keeps hook order stable even if the guard ever changes.
  if (!Number.isFinite(amount)) throw new RangeError('ToggleSubscription.Price amount must be finite.');
  const { locale } = useToggleSubscription();
  const reducedMotion = useReducedMotion();
  const locales = localeProp ?? locale;
  const formatKey = JSON.stringify([
    Intl.getCanonicalLocales(locales === undefined ? [] : [locales].flat().map(String)),
    currency,
    formatOptions ?? {},
  ]);
  const formatter = useMemo(() => {
    const [tags, currency, options] = JSON.parse(formatKey) as [
      string[],
      string,
      ToggleSubscriptionPriceProps['formatOptions'],
    ];
    return new Intl.NumberFormat(tags, { ...options, style: 'currency', currency });
  }, [formatKey]);
  const formatted = formatter.format(amount);
  const hasPrevious = was !== undefined && Number.isFinite(was) && was > amount;
  if (hasPrevious && !previousLabel)
    throw new Error('ToggleSubscription.Price requires previousLabel when was exceeds amount.');
  return (
    <WithSx className={className} styles={priceStyle} sx={sx}>
      {(className) => (
        <MotionPriceSurface
          nativeProps={rest}
          style={rest.style}
          ref={ref}
          className={className}
          layout={!reducedMotion}
          transition={PRICE_SPRING}
        >
          <span
            {...slotProps?.amount}
            data-ui="toggle-subscription-amount"
            css={[amountStyle, slotProps?.amount?.css]}
          >
            <span css={visuallyHiddenStyle}>{formatted}</span>
            <motion.span aria-hidden="true" css={visualStyle} transition={PRICE_SPRING}>
              <AnimatePresence initial={false}>
                <motion.span
                  key={formatted}
                  css={priceCellStyle}
                  initial={reducedMotion ? false : { opacity: 0, y: '0.25em' }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: '-0.25em' }}
                  transition={reducedMotion ? { duration: 0 } : PRICE_SPRING}
                >
                  {formatted}
                </motion.span>
              </AnimatePresence>
            </motion.span>
          </span>
          {hasPrevious && (
            <del
              {...slotProps?.previous}
              data-ui="toggle-subscription-previous"
              css={[previousStyle, slotProps?.previous?.css]}
            >
              <span css={visuallyHiddenStyle}>{previousLabel}</span>
              {formatter.format(was)}
            </del>
          )}
          {isRenderable(period) && period !== '' && (
            <span
              {...slotProps?.period}
              data-ui="toggle-subscription-period"
              css={[periodStyle, slotProps?.period?.css]}
            >
              {period}
            </span>
          )}
        </MotionPriceSurface>
      )}
    </WithSx>
  );
}
ToggleSubscriptionPrice.displayName = 'ToggleSubscription.Price';

export const ToggleSubscription = Object.assign(ToggleSubscriptionRoot, {
  List: ToggleSubscriptionList,
  Item: ToggleSubscriptionItem,
  Label: ToggleSubscriptionLabel,
  Price: ToggleSubscriptionPrice,
});
