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
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type SerializedStyles, type Theme } from '../../styling/css';
import { FORCED_COLORS } from '../../styling/media';
import { visuallyHiddenStyle } from '../../styling/visually-hidden';
import { WithSx, type SxProps } from '../../styling/sx';
import { isRenderable } from '../../utils/renderable';
import { useControlledState } from '../../utils/use-controlled-state';
import { SegmentedControl, type SegmentedControlItemProps } from '../segmented-control';

export type BillingToggleSize = 'md' | 'lg';
export type BillingToggleTone = 'neutral' | 'accent' | 'success';
type SlotProps<Element extends 'span' | 'del'> = ComponentPropsWithoutRef<Element> & {
  css?: Interpolation<Theme>;
};

export interface BillingToggleProps
  extends Omit<ComponentPropsWithRef<'div'>, 'defaultValue' | 'onChange'>, SxProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  size?: BillingToggleSize;
  tone?: BillingToggleTone;
  locale?: Intl.LocalesArgument;
}
export interface BillingToggleListProps
  extends Omit<ComponentPropsWithRef<'div'>, 'defaultValue' | 'onChange'>, SxProps {}
export interface BillingToggleLabelProps extends ComponentPropsWithRef<'span'>, SxProps {}
export interface BillingToggleItemProps extends Omit<SegmentedControlItemProps, 'accessory'> {
  badge?: ReactNode;
  activeBadge?: ReactNode;
  slotProps?: {
    label?: SlotProps<'span'>;
    badge?: SlotProps<'span'>;
    selection?: SlotProps<'span'>;
  };
}
export interface BillingTogglePriceProps
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

interface BillingContext {
  value: string | undefined;
  emptyValue: string;
  requestChange: (value: string) => void;
  disabled: boolean;
  size: BillingToggleSize;
  tone: BillingToggleTone;
  locale: Intl.LocalesArgument | undefined;
  labels: string[];
  setLabels: Dispatch<SetStateAction<string[]>>;
  selections: ReadonlyMap<string, SlotProps<'span'>>;
  setSelections: Dispatch<SetStateAction<ReadonlyMap<string, SlotProps<'span'>>>>;
}
const Context = createContext<BillingContext | null>(null);
function useBilling() {
  const context = useContext(Context);
  if (!context) throw new Error('BillingToggle parts must be rendered inside <BillingToggle>.');
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
const toneStyles: Record<BillingToggleTone, SerializedStyles> = {
  neutral: css({ color: vars.color.textMuted }),
  accent: css({ borderColor: vars.color.accentText }),
  success: css({ borderColor: vars.color.success }),
};
const selectionToneStyles: Record<BillingToggleTone, SerializedStyles> = {
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
const PRICE_SPRING = {
  type: 'spring',
  bounce: 0,
  visualDuration: 0.24,
} as const;

function BillingToggleRoot({
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
}: BillingToggleProps) {
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
            <div {...rest} ref={ref} className={className} data-ui="billing-toggle">
              {children}
            </div>
          )}
        </WithSx>
      </MotionConfig>
    </Context.Provider>
  );
}
BillingToggleRoot.displayName = 'BillingToggle';

function BillingToggleLabel({
  ref,
  id: idProp,
  className,
  sx,
  children,
  ...rest
}: BillingToggleLabelProps) {
  const { setLabels } = useBilling();
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
        <span {...rest} ref={ref} id={id} data-ui="billing-toggle-label" className={className}>
          {children}
        </span>
      )}
    </WithSx>
  );
}
BillingToggleLabel.displayName = 'BillingToggle.Label';

function BillingToggleList({ ref, className, sx, children, ...rest }: BillingToggleListProps) {
  const context = useBilling();
  const selection = context.value === undefined ? undefined : context.selections.get(context.value);
  return (
    <div data-ui="billing-toggle-list" css={listStyle}>
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
BillingToggleList.displayName = 'BillingToggle.List';

function BillingToggleItem({
  badge,
  activeBadge,
  slotProps,
  children,
  className,
  sx,
  ...rest
}: BillingToggleItemProps) {
  const context = useBilling();
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
    <WithSx className={className} sx={sx}>
      {(className) => (
        <SegmentedControl.Item
          {...rest}
          data-billing-part="item"
          className={className}
          accessory={
            hasBadge ? (
              <span
                {...slotProps?.badge}
                data-ui="billing-toggle-badge"
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
              data-ui="billing-toggle-item-label"
              css={slotProps?.label?.css}
            >
              {children}
            </span>
          )}
        </SegmentedControl.Item>
      )}
    </WithSx>
  );
}
BillingToggleItem.displayName = 'BillingToggle.Item';

function BillingTogglePrice({
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
}: BillingTogglePriceProps) {
  const { locale } = useBilling();
  const reducedMotion = useReducedMotion();
  const previousId = useId();
  if (!Number.isFinite(amount)) throw new RangeError('BillingToggle.Price amount must be finite.');
  const formatter = new Intl.NumberFormat(localeProp ?? locale, {
    ...formatOptions,
    style: 'currency',
    currency,
  });
  const formatted = formatter.format(amount);
  const hasPrevious = was !== undefined && Number.isFinite(was) && was > amount;
  if (hasPrevious && !previousLabel)
    throw new Error('BillingToggle.Price requires previousLabel when was exceeds amount.');
  return (
    <WithSx className={className} styles={priceStyle} sx={sx}>
      {(className) => (
        <span {...rest} ref={ref} data-ui="billing-toggle-price" className={className}>
          <span
            {...slotProps?.amount}
            data-ui="billing-toggle-amount"
            css={[amountStyle, slotProps?.amount?.css]}
          >
            <span css={visuallyHiddenStyle}>{formatted}</span>
            <motion.span
              aria-hidden="true"
              css={visualStyle}
              layout={!reducedMotion}
              transition={PRICE_SPRING}
            >
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
              data-ui="billing-toggle-previous"
              aria-describedby={[slotProps?.previous?.['aria-describedby'], previousId]
                .filter(Boolean)
                .join(' ')}
              css={[previousStyle, slotProps?.previous?.css]}
            >
              <span id={previousId} css={visuallyHiddenStyle}>
                {previousLabel}
              </span>
              {formatter.format(was)}
            </del>
          )}
          {isRenderable(period) && period !== '' && (
            <span
              {...slotProps?.period}
              data-ui="billing-toggle-period"
              css={[periodStyle, slotProps?.period?.css]}
            >
              {period}
            </span>
          )}
        </span>
      )}
    </WithSx>
  );
}
BillingTogglePrice.displayName = 'BillingToggle.Price';

export const BillingToggle = Object.assign(BillingToggleRoot, {
  List: BillingToggleList,
  Item: BillingToggleItem,
  Label: BillingToggleLabel,
  Price: BillingTogglePrice,
});
