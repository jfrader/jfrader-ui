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
  type ReactElement,
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

export type PlanSelectorSize = 'md' | 'lg';
export type PlanSelectorTone = 'neutral' | 'accent' | 'success';
type SlotProps<Element extends 'span' | 'del'> = ComponentPropsWithRef<Element> & {
  sx?: Interpolation<Theme>;
};

export interface PlanSelectorComposedProps
  extends Omit<ComponentPropsWithRef<'div'>, 'defaultValue' | 'onChange'>, SxProps {
  /** Controls the selected option. */
  value?: string;
  /** Sets the initial uncontrolled option. No option is selected by default. */
  defaultValue?: string;
  /** Receives the requested option value. */
  onValueChange?: (value: string) => void;
  /** Disables every option. Defaults to `false`. */
  disabled?: boolean;
  /** Sets the selector's visual size. Defaults to `md`. */
  size?: PlanSelectorSize;
  /** Sets the selection and badge color. Defaults to `success`. */
  tone?: PlanSelectorTone;
  /** Sets the locale `PlanSelector.Price` formats with. Defaults to the runtime locale. */
  locale?: Intl.LocalesArgument;
  options?: never;
  label?: never;
  slots?: never;
  component?: never;
  slotProps?: never;
}
export interface PlanSelectorOption<V extends string = string> {
  value: V;
  label: ReactNode;
  disabled?: boolean;
  id?: string;
  badge?: ReactNode;
  activeBadge?: ReactNode;
  /** Shows content after the options while this option is selected, such as a `PlanSelector.Price`. */
  detail?: ReactNode;
}
export interface PlanSelectorSlots {
  /** Container wrapping the label, the option list and the selected option's detail. */
  root?: ComponentType<ComponentPropsWithRef<'div'>>;
  /** Text naming the selector. */
  label?: ComponentType<PlanSelectorLabelProps>;
  /** List holding one item per option. */
  list?: ComponentType<PlanSelectorListProps>;
  /** One selectable option. */
  item?: ComponentType<PlanSelectorItemProps>;
}
export interface PlanSelectorSlotProps {
  /** Container wrapping the label, the option list and the selected option's detail. */
  root?: Omit<ComponentPropsWithRef<'div'>, 'children' | 'defaultValue' | 'onChange'> & SxProps & {

    [attribute: `data-${string}`]: unknown;
  };
  /** Text naming the selector. */
  label?: Omit<PlanSelectorLabelProps, 'children'>;
  /** List holding one item per option. */
  list?: Omit<PlanSelectorListProps, 'children'>;
  /** One selectable option. */
  item?: Omit<PlanSelectorItemProps, keyof PlanSelectorOption | 'children'>;
}
export interface PlanSelectorShorthandProps<V extends string = string>
  extends Omit<PlanSelectorComposedProps, 'value' | 'defaultValue' | 'onValueChange' | 'children' | 'options' | 'label' | 'slots' | 'slotProps' | 'component'> {
  /** Controls the selected option. */
  value?: NoInfer<V>;
  /** Sets the initial uncontrolled option. No option is selected by default. */
  defaultValue?: NoInfer<V>;
  /** Receives the requested option value. */
  onValueChange?: (value: V) => void;
  /** Defines the options rendered as selectable items, each with an optional `detail`. */
  options: readonly PlanSelectorOption<V>[];
  /** Shows a label naming the selector. */
  label?: ReactNode;
  /** Not accepted when `options` supplies the choices. */
  children?: never;
  /** Replaces the root, label, list and item elements. */
  slots?: PlanSelectorSlots;
  /** Replaces the root element as a shorthand for `slots.root`. */
  component?: PlanSelectorSlots['root'];
  /** Passes props and `sx` to the root, label, list and items. */
  slotProps?: PlanSelectorSlotProps;
}
export type PlanSelectorProps<V extends string = string> = PlanSelectorComposedProps | PlanSelectorShorthandProps<V>;
export interface PlanSelectorListProps
  extends Omit<ComponentPropsWithRef<'div'>, 'defaultValue' | 'onChange'>, SxProps {}
export interface PlanSelectorLabelProps extends ComponentPropsWithRef<'span'>, SxProps {}
export interface PlanSelectorItemSlots {
  /** Text naming an option. */
  label?: ComponentType<SlotProps<'span'>>;
  /** Badge beside the option. */
  badge?: ComponentType<SlotProps<'span'>>;
  /** Selection indicator for the selected option. */
  selection?: ComponentType<SlotProps<'span'>>;
}
export interface PlanSelectorPriceSlots {
  /** Formatted current price. */
  amount?: ComponentType<SlotProps<'span'>>;
  /** Struck-through previous price. */
  previous?: ComponentType<SlotProps<'del'>>;
  /** Unit text after the price. */
  unit?: ComponentType<SlotProps<'span'>>;
}
export interface PlanSelectorItemProps extends Omit<SegmentedControlItemProps, 'accessory' | 'slots'> {
  /** Replaces the label, badge and selection-indicator elements. */
  slots?: PlanSelectorItemSlots;
  /** Shows a badge beside the option label. */
  badge?: ReactNode;
  /** Replaces `badge` while this option is selected. */
  activeBadge?: ReactNode;
  /** Passes props and `sx` to the label, badge and selection indicator. */
  slotProps?: {
    /** Text naming the option. */
    label?: SlotProps<'span'>;
    /** Badge shown beside the label, such as a discount. */
    badge?: SlotProps<'span'>;
    /** Check glyph marking the selected option. */
    selection?: SlotProps<'span'>;
  };
}
export interface PlanSelectorPriceProps
  extends Omit<ComponentPropsWithRef<'span'>, 'children'>, SxProps {
  /** Sets the current price in major currency units. Throws if not finite. */
  amount: number;
  /** Sets the currency code used by `Intl.NumberFormat`, such as `USD`. */
  currency: string;
  /** Overrides the root's formatting locale. */
  locale?: Intl.LocalesArgument;
  /** Configures currency formatting without changing the currency or formatting style. */
  formatOptions?: Omit<Intl.NumberFormatOptions, 'style' | 'currency'>;
  /** Shows a struck-through former price in major currency units when finite and greater than `amount`. */
  was?: number;
  /** Adds unit text after the price, such as `/ month` or `/ seat`. */
  unit?: ReactNode;
  /** Names the former price for assistive technology. Required when `was` is shown. */
  previousLabel?: string;
  /** Replaces the current-price, former-price and unit elements. */
  slots?: PlanSelectorPriceSlots;
  /** Passes props and `sx` to the current-price, former-price and unit elements. */
  slotProps?: {
    /** Formatted current price. */
    amount?: SlotProps<'span'>;
    /** Struck-through former price. */
    previous?: SlotProps<'del'>;
    /** Unit text shown after the price. */
    unit?: SlotProps<'span'>;
  };
}

interface SelectionPart {
  props?: SlotProps<'span'>;
  component?: PlanSelectorItemSlots['selection'];
}
interface PlanSelectorContext {
  value: string | undefined;
  emptyValue: string;
  requestChange: (value: string) => void;
  disabled: boolean;
  size: PlanSelectorSize;
  tone: PlanSelectorTone;
  locale: Intl.LocalesArgument | undefined;
  labels: string[];
  setLabels: Dispatch<SetStateAction<string[]>>;
  selections: ReadonlyMap<string, SelectionPart>;
  setSelections: Dispatch<SetStateAction<ReadonlyMap<string, SelectionPart>>>;
}
const Context = createContext<PlanSelectorContext | null>(null);
function usePlanSelector() {
  const context = useContext(Context);
  if (!context) throw new Error('PlanSelector parts must be rendered inside <PlanSelector>.');
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
const controlItemStyle = css({
  maxInlineSize: '100%',
  flexWrap: 'wrap',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
});
const itemLabelStyle = css({ minInlineSize: 0, maxInlineSize: '100%' });
const labelStyle = css({
  fontSize: vars.textSize.sm,
  fontWeight: vars.fontWeight.medium,
});
// Reserves the widest of `badge` and `activeBadge` so the item keeps its width when they swap; the
// visible badge hugs its own text at the start of that space, beside the label.
const badgeSlotStyle = css({
  display: 'inline-grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  justifyItems: 'start',
  maxInlineSize: '100%',
});
const badgeStyle = css({
  gridArea: '1 / 1',
  minInlineSize: 0,
  maxInlineSize: '100%',
  overflowWrap: 'anywhere',
  boxSizing: 'border-box',
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
const sizerStyle = css({ visibility: 'hidden', pointerEvents: 'none' });
const toneStyles: Record<PlanSelectorTone, SerializedStyles> = {
  neutral: css({ color: vars.color.textMuted }),
  accent: css({ borderColor: vars.color.accentText }),
  success: css({ borderColor: vars.color.success }),
};
const selectionToneStyles: Record<PlanSelectorTone, SerializedStyles> = {
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
const unitStyle = css({ color: vars.color.textMuted, minInlineSize: 0 });
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
  return <span {...nativeProps} {...rest} ref={ref} data-ui="plan-selector-price" />;
}
const MotionPriceSurface = motion.create(PriceSurface);

function PlanSelectorRoot({
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
}: PlanSelectorComposedProps & { rootElement?: 'div' | PlanSelectorSlots['root']; slotStyles?: Interpolation<Theme> }) {
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
            <Root {...rest} ref={ref} className={className} data-ui="plan-selector">
              {children}
            </Root>
          )}
        </WithSx>
      </MotionConfig>
    </Context.Provider>
  );
}
PlanSelectorRoot.displayName = 'PlanSelector';

function PlanSelectorLabel({
  ref,
  id: idProp,
  className,
  sx,
  children,
  ...rest
}: PlanSelectorLabelProps) {
  const { setLabels } = usePlanSelector();
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
        <span {...rest} ref={ref} id={id} data-ui="plan-selector-label" className={className}>
          {children}
        </span>
      )}
    </WithSx>
  );
}
PlanSelectorLabel.displayName = 'PlanSelector.Label';

function PlanSelectorList({ ref, className, sx, children, ...rest }: PlanSelectorListProps) {
  const context = usePlanSelector();
  const selectionPart = context.value === undefined ? undefined : context.selections.get(context.value);
  const selection = selectionPart?.props;
  return (
    <div data-ui="plan-selector-list" css={listStyle}>
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
PlanSelectorList.displayName = 'PlanSelector.List';

function PlanSelectorItem({
  badge,
  activeBadge,
  slotProps,
  slots,
  children,
  className,
  sx,
  ...rest
}: PlanSelectorItemProps) {
  const Badge = slots?.badge ?? 'span';
  const Label = slots?.label ?? 'span';
  const context = usePlanSelector();
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
    <span data-ui="plan-selector-item" css={itemStyle}>
      <WithSx className={className} styles={controlItemStyle} sx={sx}>
        {(className) => (
          <SegmentedControl.Item
            {...rest}
            className={className}
            accessory={
              hasBadge ? (
                <span css={badgeSlotStyle}>
                  {[badge, activeBadge].map((sizer, index) =>
                    isRenderable(sizer) && sizer !== '' ? (
                      <span key={index} aria-hidden="true" css={[badgeStyle, sizerStyle, slotProps?.badge?.sx]}>
                        {sizer}
                      </span>
                    ) : null,
                  )}
                  <Badge
                    {...withoutSx(slotProps?.badge)}
                    data-ui="plan-selector-badge"
                    css={[badgeStyle, toneStyles[context.tone], slotProps?.badge?.sx]}
                  >
                    {currentBadge}
                  </Badge>
                </span>
              ) : undefined
            }
          >
            {isRenderable(children) && children !== '' && (
              <Label
                {...withoutSx(slotProps?.label)}
                data-ui="plan-selector-item-label"
                css={[itemLabelStyle, slotProps?.label?.sx]}
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
PlanSelectorItem.displayName = 'PlanSelector.Item';

function PlanSelectorPrice({
  ref,
  amount,
  currency,
  locale: localeProp,
  formatOptions,
  was,
  unit,
  previousLabel,
  slotProps,
  slots,
  className,
  sx,
  ...rest
}: PlanSelectorPriceProps) {
  const Amount = slots?.amount ?? 'span';
  const Previous = slots?.previous ?? 'del';
  const Unit = slots?.unit ?? 'span';
  // Validate before any hooks: keeps hook order stable even if the guard ever changes.
  if (!Number.isFinite(amount)) throw new RangeError('PlanSelector.Price amount must be finite.');
  const { locale } = usePlanSelector();
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
      PlanSelectorPriceProps['formatOptions'],
    ];
    return numberFormatter(tags, { ...options, style: 'currency', currency });
  }, [formatKey]);
  const formatted = formatter.format(amount);
  const hasPrevious = was !== undefined && Number.isFinite(was) && was > amount;
  if (hasPrevious && !previousLabel)
    throw new Error('PlanSelector.Price requires previousLabel when was exceeds amount.');
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
            data-ui="plan-selector-amount"
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
              data-ui="plan-selector-previous"
              css={[previousStyle, slotProps?.previous?.sx]}
            >
              <span css={visuallyHiddenStyle}>{previousLabel}</span>
              {formatter.format(was)}
            </Previous>
          )}
          {isRenderable(unit) && unit !== '' && (
            <Unit
              {...withoutSx(slotProps?.unit)}
              data-ui="plan-selector-unit"
              css={[unitStyle, slotProps?.unit?.sx]}
            >
              {unit}
            </Unit>
          )}
        </MotionPriceSurface>
      )}
    </WithSx>
  );
}
PlanSelectorPrice.displayName = 'PlanSelector.Price';

function PlanSelectorShorthandDetail({ options }: { options: readonly PlanSelectorOption[] }) {
  const { value } = usePlanSelector();
  return options.find((option) => option.value === value)?.detail;
}
function PlanSelectorComponent<V extends string = string>(props: PlanSelectorProps<V>) {
  if (props.options === undefined) return <PlanSelectorRoot {...props} />;
  const { options, label, component, slots, slotProps, onValueChange, ...rest } = props;
  const { className, style, sx: slotSx, ...rootProps } = slotProps?.root ?? {};
  const Label = slots?.label ?? PlanSelectorLabel;
  const List = slots?.list ?? PlanSelectorList;
  const Item = slots?.item ?? PlanSelectorItem;
  return (
    <PlanSelectorRoot
      {...rest}
      {...rootProps}
      // Items only carry `V`, so every emitted value is one of the options.
      onValueChange={onValueChange as ((value: string) => void) | undefined}
      rootElement={slots?.root ?? component}
      slotStyles={slotSx}
      className={[className, rest.className].filter(Boolean).join(' ') || undefined}
      style={{ ...rest.style, ...style }}
      sx={rest.sx}
    >
      {isRenderable(label) && <Label {...slotProps?.label}>{label}</Label>}
      <List {...slotProps?.list}>
        {options.map(({ value, label, disabled, id, badge, activeBadge }) => (
          <Item {...slotProps?.item} key={value} value={value} disabled={disabled} id={id} badge={badge} activeBadge={activeBadge}>
            {label}
          </Item>
        ))}
      </List>
      <PlanSelectorShorthandDetail options={options} />
    </PlanSelectorRoot>
  );
}
PlanSelectorComponent.displayName = 'PlanSelector';

export interface PlanSelectorComponentType {
  <V extends string = string>(props: PlanSelectorShorthandProps<V>): ReactElement;
  (props: PlanSelectorComposedProps): ReactElement;
  /** Accepts a pre-built shorthand/composed union spread into the component. */
  <V extends string = string>(props: PlanSelectorProps<V>): ReactElement;
  displayName?: string;
  List: typeof PlanSelectorList;
  Item: typeof PlanSelectorItem;
  Label: typeof PlanSelectorLabel;
  Price: typeof PlanSelectorPrice;
}
export const PlanSelector = Object.assign(PlanSelectorComponent, {
  List: PlanSelectorList,
  Item: PlanSelectorItem,
  Label: PlanSelectorLabel,
  Price: PlanSelectorPrice,
}) as PlanSelectorComponentType;
