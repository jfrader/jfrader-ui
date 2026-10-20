'use client';
import { numberFormatter } from '../../utils/intl';

import {
  createContext,
  useContext,
  useId,
  useLayoutEffect,
  useMemo,
  useState,
  type ComponentPropsWithRef,
  type ComponentType,
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
import { withoutSx, WithSx, type SxProps } from '../../styling/sx';
import { isRenderable } from '../../utils/renderable';
import { useControlledState } from '../../utils/use-controlled-state';
import { SegmentedControl, type SegmentedControlItemProps } from '../segmented-control';

export type ToggleSubscriptionSize = 'md' | 'lg';
export type ToggleSubscriptionTone = 'neutral' | 'accent' | 'success';
type SlotProps<Element extends 'span' | 'del'> = ComponentPropsWithRef<Element> & {
  sx?: Interpolation<Theme>;
};

export interface ToggleSubscriptionCompoundProps
  extends Omit<ComponentPropsWithRef<'div'>, 'defaultValue' | 'onChange'>, SxProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  size?: ToggleSubscriptionSize;
  tone?: ToggleSubscriptionTone;
  locale?: Intl.LocalesArgument;
  options?: never;
  prices?: never;
  label?: never;
  slots?: never;
  component?: never;
  slotProps?: never;
}
export interface ToggleSubscriptionOption {
  value: string;
  label: ReactNode;
  disabled?: boolean;
  id?: string;
  badge?: ReactNode;
  activeBadge?: ReactNode;
}
export type ToggleSubscriptionPriceDefinition = Pick<
  ToggleSubscriptionPriceProps,
  'amount' | 'currency' | 'formatOptions' | 'was' | 'period' | 'previousLabel'
>;
export interface ToggleSubscriptionSlots {
  /** Container wrapping the label and the period list. */
  root?: ComponentType<ComponentPropsWithRef<'div'>>;
  /** Text naming the switch. */
  label?: ComponentType<ToggleSubscriptionLabelProps>;
  /** List holding one item per billing period. */
  list?: ComponentType<ToggleSubscriptionListProps>;
  /** One selectable billing period. */
  item?: ComponentType<ToggleSubscriptionItemProps>;
  /** Price text displayed inside an item. */
  price?: ComponentType<ToggleSubscriptionPriceProps>;
}
export interface ToggleSubscriptionSlotProps {
  /** Container wrapping the label and the period list. */
  root?: Omit<ComponentPropsWithRef<'div'>, 'children' | 'defaultValue' | 'onChange'> & SxProps & {

    [attribute: `data-${string}`]: unknown;
  };
  /** Text naming the switch. */
  label?: Omit<ToggleSubscriptionLabelProps, 'children'>;
  /** List holding one item per billing period. */
  list?: Omit<ToggleSubscriptionListProps, 'children'>;
  /** One selectable billing period. */
  item?: Omit<ToggleSubscriptionItemProps, keyof ToggleSubscriptionOption | 'children'>;
  /** Price text displayed inside an item. */
  price?: Omit<ToggleSubscriptionPriceProps, keyof ToggleSubscriptionPriceDefinition>;
}
export interface ToggleSubscriptionEasyProps extends Omit<ToggleSubscriptionCompoundProps, 'children' | 'options' | 'prices' | 'label' | 'slots' | 'slotProps' | 'component'> {
  options: readonly ToggleSubscriptionOption[];
  prices: Readonly<Record<string, ToggleSubscriptionPriceDefinition>>;
  label?: ReactNode;
  children?: never;
  slots?: ToggleSubscriptionSlots;
  component?: ToggleSubscriptionSlots['root'];
  slotProps?: ToggleSubscriptionSlotProps;
}
export type ToggleSubscriptionProps = ToggleSubscriptionCompoundProps | ToggleSubscriptionEasyProps;
export interface ToggleSubscriptionListProps
  extends Omit<ComponentPropsWithRef<'div'>, 'defaultValue' | 'onChange'>, SxProps {}
export interface ToggleSubscriptionLabelProps extends ComponentPropsWithRef<'span'>, SxProps {}
export interface ToggleSubscriptionItemSlots {
  /** Text naming a billing period. */
  label?: ComponentType<SlotProps<'span'>>;
  /** Badge beside the billing period. */
  badge?: ComponentType<SlotProps<'span'>>;
  /** Selection indicator for the active period. */
  selection?: ComponentType<SlotProps<'span'>>;
}
export interface ToggleSubscriptionPriceSlots {
  /** Formatted current price. */
  amount?: ComponentType<SlotProps<'span'>>;
  /** Struck-through previous price. */
  previous?: ComponentType<SlotProps<'del'>>;
  /** Billing period after the price. */
  period?: ComponentType<SlotProps<'span'>>;
}
export interface ToggleSubscriptionItemProps extends Omit<SegmentedControlItemProps, 'accessory' | 'slots'> {
  slots?: ToggleSubscriptionItemSlots;
  badge?: ReactNode;
  activeBadge?: ReactNode;
  slotProps?: {
    /** Text naming the billing period. */
    label?: SlotProps<'span'>;
    /** Badge shown beside the label, such as a discount. */
    badge?: SlotProps<'span'>;
    /** Check glyph marking the selected period. */
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
  slots?: ToggleSubscriptionPriceSlots;
  slotProps?: {
    /** Formatted price for the current period. */
    amount?: SlotProps<'span'>;
    /** Struck-through former price. */
    previous?: SlotProps<'del'>;
    /** Billing period shown after the price. */
    period?: SlotProps<'span'>;
  };
}

interface SelectionPart {
  props?: SlotProps<'span'>;
  component?: ToggleSubscriptionItemSlots['selection'];
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
  selections: ReadonlyMap<string, SelectionPart>;
  setSelections: Dispatch<SetStateAction<ReadonlyMap<string, SelectionPart>>>;
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
  rootElement: Root = 'div',
  slotStyles,
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
}: ToggleSubscriptionCompoundProps & { rootElement?: 'div' | ToggleSubscriptionSlots['root']; slotStyles?: Interpolation<Theme> }) {
  const [value, requestChange] = useControlledState(valueProp, defaultValue, onValueChange);
  const [labels, setLabels] = useState<string[]>([]);
  const [selections, setSelections] = useState<ReadonlyMap<string, SelectionPart>>(new Map());
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
        <WithSx className={className} styles={[rootStyle, slotStyles]} sx={sx}>
          {(className) => (
            <Root {...rest} ref={ref} className={className} data-ui="toggle-subscription">
              {children}
            </Root>
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
  const selectionPart = context.value === undefined ? undefined : context.selections.get(context.value);
  const selection = selectionPart?.props;
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
            slots={{ selection: selectionPart?.component }}
            slotProps={{
              selection: {
                ...selection,
                sx: [selectionToneStyles[context.tone], forcedSelectionStyle, selection?.sx],
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
  slots,
  children,
  className,
  sx,
  ...rest
}: ToggleSubscriptionItemProps) {
  const Badge = slots?.badge ?? 'span';
  const Label = slots?.label ?? 'span';
  const context = useToggleSubscription();
  const { setSelections } = context;
  const selection = slotProps?.selection;
  const selectionComponent = slots?.selection;
  const value = rest.value;
  useLayoutEffect(() => {
    if (!selection && !selectionComponent) return;
    setSelections((current) => new Map(current).set(value, { props: selection, component: selectionComponent }));
    return () =>
      setSelections((current) => {
        const next = new Map(current);
        next.delete(value);
        return next;
      });
  }, [selection, selectionComponent, value, setSelections]);
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
                <Badge
                  {...withoutSx(slotProps?.badge)}
                  data-ui="toggle-subscription-badge"
                  css={[badgeStyle, toneStyles[context.tone], slotProps?.badge?.sx]}
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
                </Badge>
              ) : undefined
            }
          >
            {isRenderable(children) && children !== '' && (
              <Label
                {...withoutSx(slotProps?.label)}
                data-ui="toggle-subscription-item-label"
                css={slotProps?.label?.sx}
              >
                {children}
              </Label>
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
  slots,
  className,
  sx,
  ...rest
}: ToggleSubscriptionPriceProps) {
  const Amount = slots?.amount ?? 'span';
  const Previous = slots?.previous ?? 'del';
  const Period = slots?.period ?? 'span';
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
    return numberFormatter(tags, { ...options, style: 'currency', currency });
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
          <Amount
            {...withoutSx(slotProps?.amount)}
            data-ui="toggle-subscription-amount"
            css={[amountStyle, slotProps?.amount?.sx]}
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
          </Amount>
          {hasPrevious && (
            <Previous
              {...withoutSx(slotProps?.previous)}
              data-ui="toggle-subscription-previous"
              css={[previousStyle, slotProps?.previous?.sx]}
            >
              <span css={visuallyHiddenStyle}>{previousLabel}</span>
              {formatter.format(was)}
            </Previous>
          )}
          {isRenderable(period) && period !== '' && (
            <Period
              {...withoutSx(slotProps?.period)}
              data-ui="toggle-subscription-period"
              css={[periodStyle, slotProps?.period?.sx]}
            >
              {period}
            </Period>
          )}
        </MotionPriceSurface>
      )}
    </WithSx>
  );
}
ToggleSubscriptionPrice.displayName = 'ToggleSubscription.Price';

function ToggleSubscriptionEasyPrice({
  prices,
  slots,
  slotProps,
}: Pick<ToggleSubscriptionEasyProps, 'prices' | 'slots' | 'slotProps'>) {
  const { value } = useToggleSubscription();
  if (value === undefined) return null;
  const price = Object.hasOwn(prices, value) ? prices[value] : undefined;
  if (!price) {
    throw new Error(`ToggleSubscription requires a price for selected period "${value}".`);
  }
  const Price = slots?.price ?? ToggleSubscriptionPrice;
  return <Price {...slotProps?.price} {...price} />;
}
function ToggleSubscriptionComponent(props: ToggleSubscriptionProps) {
  if (props.options === undefined) return <ToggleSubscriptionRoot {...props} />;
  const { options, prices, label, component, slots, slotProps, ...rest } = props;
  const { className, style, sx: slotSx, ...rootProps } = slotProps?.root ?? {};
  const Label = slots?.label ?? ToggleSubscriptionLabel;
  const List = slots?.list ?? ToggleSubscriptionList;
  const Item = slots?.item ?? ToggleSubscriptionItem;
  return (
    <ToggleSubscriptionRoot
      {...rest}
      {...rootProps}
      rootElement={slots?.root ?? component}
      slotStyles={slotSx}
      className={[className, rest.className].filter(Boolean).join(' ') || undefined}
      style={{ ...rest.style, ...style }}
      sx={rest.sx}
    >
      {isRenderable(label) && <Label {...slotProps?.label}>{label}</Label>}
      <List {...slotProps?.list}>
        {options.map(({ label, ...option }) => (
          <Item {...slotProps?.item} {...option} key={option.value}>
            {label}
          </Item>
        ))}
      </List>
      <ToggleSubscriptionEasyPrice prices={prices} slots={slots} slotProps={slotProps} />
    </ToggleSubscriptionRoot>
  );
}
ToggleSubscriptionComponent.displayName = 'ToggleSubscription';
export const ToggleSubscription = Object.assign(ToggleSubscriptionComponent, {
  List: ToggleSubscriptionList,
  Item: ToggleSubscriptionItem,
  Label: ToggleSubscriptionLabel,
  Price: ToggleSubscriptionPrice,
});
