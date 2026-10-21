'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type ComponentType,
  type CSSProperties,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from 'react';
import { animate, MotionConfig, motion, useMotionValue, useReducedMotion } from 'motion/react';
import { vars } from '@jfrader/tokens/vars';
import { choiceInputStyle, choiceRootStateStyle } from '../../styling/choice-control';
import { css, type Interpolation, type SerializedStyles, type Theme } from '../../styling/css';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import { withoutSx, WithSx, type SxProps } from '../../styling/sx';
import { isRenderable } from '../../utils/renderable';
import { useControlledState } from '../../utils/use-controlled-state';

export type RadioCardsLayout = 'grid' | 'list';
export type RadioCardsSize = 'sm' | 'md';
export interface RadioCardsValueProps<V extends string = string> {
  /** Controls the selected card's value. */
  value?: NoInfer<V>;
  /** Sets the initially selected card. Defaults to no selection. */
  defaultValue?: NoInfer<V>;
  /** Receives the newly selected card's value. */
  onValueChange?: (value: V) => void;
}

export interface RadioCardsComposedProps
  extends Omit<ComponentPropsWithRef<'div'>, 'onChange' | 'defaultValue'>,
    SxProps,
    RadioCardsValueProps<string> {
  /** Names the group's native radio inputs for form submission. Defaults to a generated name. */
  name?: string;
  /** Requires a selection for native form validation. Defaults to `false`. */
  required?: boolean;
  /** Disables every card in the group. Defaults to `false`. */
  disabled?: boolean;
  /** Marks the group and its inputs invalid. Defaults to `false`. */
  invalid?: boolean;
  /** Displays an error associated with the group and marks it invalid. */
  error?: ReactNode;
  /** Arranges cards in a responsive grid or single-column list. Defaults to `grid`. */
  layout?: RadioCardsLayout;
  /** Sets the grid's minimum card width, capped by the available width. Defaults to `12rem`. */
  minColumnWidth?: CSSProperties['inlineSize'];
  /** Sets card padding and text size. Defaults to `md`. */
  size?: RadioCardsSize;
  options?: never;
  label?: never;
  slots?: never;
  component?: never;
  slotProps?: never;
}
export type RadioCardsOption<V extends string = string> = Omit<
  Pick<RadioCardsItemProps, 'value' | 'label' | 'description' | 'meta' | 'icon' | 'disabled' | 'disabledReason' | 'id'>,
  'value'
> & { value: V };
export interface RadioCardsSlots {
  /** Container element wrapping the radio card group. */
  root?: ComponentType<ComponentPropsWithRef<'div'>>;
  /** Header label naming the radio card group. Default: `RadioCards.Label`. */
  label?: ComponentType<RadioCardsLabelProps>;
  /** Selectable card representing an individual radio option. Default: `RadioCards.Item`. */
  item?: ComponentType<RadioCardsItemProps>;
  /** Validation error message displayed when invalid. */
  error?: ComponentType<ComponentPropsWithRef<'span'>>;
}
export interface RadioCardsSlotProps {
  /** Container element wrapping the radio card group. */
  root?: Omit<ComponentPropsWithRef<'div'>, 'children' | 'defaultValue' | 'onChange'> & SxProps & {

    [attribute: `data-${string}`]: unknown;
  };
  /** Header label naming the radio card group. Default: `RadioCards.Label`. */
  label?: Omit<RadioCardsLabelProps, 'children'>;
  /** Selectable card representing an individual radio option. Default: `RadioCards.Item`. */
  item?: Omit<RadioCardsItemProps, keyof RadioCardsOption>;
  /** Validation error message displayed when invalid. */
  error?: Omit<ComponentPropsWithRef<'span'>, 'children'> & { sx?: Interpolation<Theme> };
}
export interface RadioCardsShorthandProps<V extends string = string>
  extends Omit<
      RadioCardsComposedProps,
      'children' | 'options' | 'label' | 'slots' | 'slotProps' | 'component' | 'value' | 'defaultValue' | 'onValueChange'
    >,
    RadioCardsValueProps<V> {
  /** Supplies the cards to render in the generated group. */
  options: readonly RadioCardsOption<V>[];
  /** Names the generated radio group. */
  label?: ReactNode;
  /** Not accepted when `options` supplies the cards. */
  children?: never;
  /** Replaces the generated root, label, cards or error element. */
  slots?: RadioCardsSlots;
  /** Replaces the root element. `slots.root` takes precedence. */
  component?: RadioCardsSlots['root'];
  /** Passes props and style overrides to generated group parts. */
  slotProps?: RadioCardsSlotProps;
}
export type RadioCardsProps<V extends string = string> = RadioCardsComposedProps | RadioCardsShorthandProps<V>;
export type RadioCardsPartProps = ComponentPropsWithRef<'span'> & { sx?: Interpolation<Theme> };
export interface RadioCardsItemSlots {
  /** Container surrounding the option content. */
  control?: ComponentType<RadioCardsPartProps>;
  /** Ring indicating the selected option. */
  indicator?: ComponentType<RadioCardsPartProps>;
  /** Icon beside the option label. */
  icon?: ComponentType<RadioCardsPartProps>;
  /** Text naming the option. */
  label?: ComponentType<RadioCardsPartProps>;
  /** Supporting text under the label. */
  description?: ComponentType<RadioCardsPartProps>;
  /** Short value at the end of the option. */
  meta?: ComponentType<RadioCardsPartProps>;
}
export interface RadioCardsItemProps
  extends
    Omit<
      ComponentPropsWithRef<'input'>,
      'type' | 'name' | 'checked' | 'defaultChecked' | 'value' | 'size' | 'children'
    >,
    SxProps {
  /** Identifies this card for selection and form submission. */
  value: string;
  /** Names the card's radio input. */
  label: ReactNode;
  /** Adds supporting text beneath the card label. */
  description?: ReactNode;
  /** Shows a short value at the end of the card. */
  meta?: ReactNode;
  /** Shows a decorative icon beside the label. */
  icon?: ReactNode;
  /** Adds an explanation associated with the input when the card is disabled. */
  disabledReason?: ReactNode;
  /** Replaces the card's content parts. */
  slots?: RadioCardsItemSlots;
  /** Passes props and style overrides to the card's content parts. */
  slotProps?: Partial<
    Record<
      | /** Container surrounding the option content. */
        'control'
      | /** Ring drawn on the selected card. */
        'indicator'
      | /** Icon slot shown beside the card label. */
        'icon'
      | /** Text naming the option. */
        'label'
      | /** Supporting text under the option label. */
        'description'
      | /** Short value shown at the end of the card. */
        'meta',
      RadioCardsPartProps
    >
  >;
}
export type RadioCardsLabelProps = ComponentPropsWithRef<'span'> & SxProps;
export type RadioCardsDescriptionProps = ComponentPropsWithRef<'span'> & SxProps;
type Relationship = 'label' | 'description';
interface CardsContext {
  value: string | undefined;
  requestChange: (value: string) => void;
  name: string;
  disabled: boolean;
  required: boolean;
  invalid: boolean;
  size: RadioCardsSize;
  register: (kind: Relationship, id: string) => () => void;
}
const Context = createContext<CardsContext | null>(null);
const MIN_COLUMN_WIDTH = '12rem';
const RING_SPRING = { type: 'spring', stiffness: 500, damping: 45 } as const;
const INPUT_QUERY = 'input[data-ui="radio-cards-input"]';

function useCardsContext(part: string) {
  const context = useContext(Context);
  if (!context) throw new Error(`RadioCards.${part} must be rendered inside <RadioCards>.`);
  return context;
}
function inputs(root: HTMLElement) {
  return Array.from(root.querySelectorAll<HTMLInputElement>(INPUT_QUERY)).filter(
    (input) => input.closest('[data-ui="radio-cards"]') === root,
  );
}
function joinIds(...ids: (string | false | undefined)[]) {
  return ids.filter(Boolean).join(' ') || undefined;
}

const rootStyle = css({
  position: 'relative',
  display: 'grid',
  gap: vars.space[3],
  minInlineSize: 0,
  fontFamily: vars.font.sans,
  lineHeight: vars.lineHeight.base,
  color: vars.color.text,
});
const layoutStyles: Record<RadioCardsLayout, SerializedStyles> = {
  grid: css({ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, var(--radio-cards-column)), 1fr))' }),
  list: css({ gridTemplateColumns: 'minmax(0, 1fr)' }),
};
const itemStyle = css({
  position: 'relative',
  display: 'flex',
  minInlineSize: 0,
  cursor: 'pointer',
  'input:checked + span': { borderColor: vars.color.accent, backgroundColor: vars.color.accentSoft },
  'input:checked + span [data-ui="radio-cards-indicator"]': { borderColor: vars.color.accent },
  'input:checked + span [data-ui="radio-cards-indicator"]::after': { transform: 'scale(1)' },
  '&:hover:not(:has(input:disabled)) input:not(:checked) + span': {
    backgroundColor: vars.color.surfaceHover,
  },
  '&:has(input:disabled)': { opacity: 1, cursor: 'not-allowed' },
  '&:has(input:disabled) > span': { borderStyle: 'dashed' },
  [FORCED_COLORS]: {
    'input:checked + span': { borderColor: 'Highlight', backgroundColor: 'Canvas' },
    'input:checked + span [data-ui="radio-cards-indicator"]': { borderColor: 'Highlight' },
    'input:focus-visible + span': { outlineColor: 'Highlight' },
    '&:has(input:disabled) > span': { borderColor: 'GrayText' },
  },
});
const inputStyle = css({ inset: 0, inlineSize: '100%', blockSize: '100%', cursor: 'inherit' });
const controlStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'flex-start',
  gap: vars.space[2],
  inlineSize: '100%',
  minInlineSize: 0,
  minBlockSize: vars.space[8],
  boxSizing: 'border-box',
  border: `2px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.lg,
  backgroundColor: vars.color.surfaceRaised,
  color: vars.color.text,
  transitionProperty: 'background-color, border-color',
  transitionDuration: vars.motion.duration.fast,
  transitionTimingFunction: vars.motion.easeStandard,
  [REDUCED_MOTION]: { transitionDuration: '0s' },
  [FORCED_COLORS]: { borderColor: 'CanvasText' },
});
const sizeStyles: Record<RadioCardsSize, SerializedStyles> = {
  sm: css({ padding: vars.space[3], fontSize: vars.textSize.sm }),
  md: css({ padding: vars.space[4], fontSize: vars.textSize.md }),
};
const indicatorStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  inlineSize: vars.space[4],
  blockSize: vars.space[4],
  marginBlockStart: vars.space[1],
  border: `1px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.full,
  '&::after': {
    content: '""',
    inlineSize: '50%',
    blockSize: '50%',
    borderRadius: vars.radius.full,
    backgroundColor: vars.color.accent,
    transform: 'scale(0)',
    transitionProperty: 'transform',
    transitionDuration: vars.motion.duration.fast,
    transitionTimingFunction: vars.motion.easeStandard,
  },
  [REDUCED_MOTION]: { '&::after': { transitionDuration: '0s' } },
  [FORCED_COLORS]: { borderColor: 'CanvasText', '&::after': { backgroundColor: 'Highlight' } },
});
const contentStyle = css({
  display: 'grid',
  gap: vars.space[1],
  flex: '1 1 8rem',
  minInlineSize: 0,
  overflowWrap: 'anywhere',
});
const labelStyle = css({ fontWeight: vars.fontWeight.medium });
const descriptionStyle = css({ fontSize: vars.textSize.sm, color: vars.color.textMuted });
const metaStyle = css({
  marginInlineStart: 'auto',
  minInlineSize: 0,
  maxInlineSize: '100%',
  overflowWrap: 'anywhere',
  fontSize: vars.textSize.sm,
});
const iconStyle = css({
  display: 'inline-flex',
  flexShrink: 0,
  fontSize: vars.textSize.lg,
  '& > svg': { inlineSize: '1em', blockSize: '1em' },
});
const groupPartStyle = css({ gridColumn: '1 / -1', minInlineSize: 0, overflowWrap: 'anywhere' });
const errorStyle = css({ color: vars.color.dangerText, fontSize: vars.textSize.sm });
const ringStyle = css({
  position: 'absolute',
  // Motion x/y use physical DOMRect deltas from the group's top-left, including in RTL.
  top: 0,
  left: 0,
  boxSizing: 'border-box',
  pointerEvents: 'none',
  border: `2px solid ${vars.color.accent}`,
  borderRadius: vars.radius.lg,
  [FORCED_COLORS]: { borderColor: 'Highlight' },
});

function SelectionRing({
  root,
  value,
  content,
}: {
  root: { current: HTMLDivElement | null };
  value: string | undefined;
  content: ReactNode;
}) {
  const reducedMotion = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const width = useMotionValue(0);
  const height = useMotionValue(0);
  const [visible, setVisible] = useState(false);
  const previous = useRef<string | undefined>(undefined);
  const initialized = useRef(false);
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const selected = inputs(element).find((input) => input.value === value)?.nextElementSibling as
      HTMLElement | undefined;
    const controls: ReturnType<typeof animate>[] = [];
    const stop = () => {
      controls.splice(0).forEach((control) => control.stop());
    };
    if (!selected) {
      setVisible(false);
      initialized.current = false;
      previous.current = value;
      return;
    }
    let lastCoordinates: number[] = [];
    const measure = (glide: boolean) => {
      const bounds = selected.getBoundingClientRect();
      const origin = element.getBoundingClientRect();
      const coordinates = [
        bounds.left - origin.left - element.clientLeft + element.scrollLeft,
        bounds.top - origin.top - element.clientTop + element.scrollTop,
        bounds.width,
        bounds.height,
      ];
      if (coordinates.every((coordinate, index) => coordinate === lastCoordinates[index])) return;
      lastCoordinates = coordinates;
      stop();
      [x, y, width, height].forEach((coordinate, index) => {
        if (glide && !reducedMotion) controls.push(animate(coordinate, coordinates[index]!, RING_SPRING));
        else coordinate.set(coordinates[index]!);
      });
      setVisible(true);
    };
    measure(initialized.current && previous.current !== value);
    initialized.current = true;
    previous.current = value;
    const observer = new ResizeObserver(() => measure(false));
    observer.observe(element);
    inputs(element).forEach((input) => {
      if (input.nextElementSibling) observer.observe(input.nextElementSibling);
    });
    return () => {
      observer.disconnect();
      stop();
    };
  }, [root, value, content, reducedMotion, x, y, width, height]);
  return (
    <motion.span
      aria-hidden="true"
      data-ui="radio-cards-ring"
      hidden={!visible}
      style={{ x, y, width, height }}
      css={ringStyle}
    />
  );
}

type RadioCardsRootProps<V extends string = string> = Omit<
  RadioCardsComposedProps,
  'value' | 'defaultValue' | 'onValueChange'
> &
  RadioCardsValueProps<V>;

function RadioCardsRoot<V extends string = string>({
  rootElement: Root = 'div',
  slotStyles,
  errorElement: Error = 'span',
  errorSlotProps,
  ref,
  value: valueProp,
  defaultValue,
  onValueChange,
  name: nameProp,
  required = false,
  disabled = false,
  invalid = false,
  error,
  layout = 'grid',
  minColumnWidth = MIN_COLUMN_WIDTH,
  size = 'md',
  className,
  sx,
  style,
  children,
  onKeyDown,
  'aria-labelledby': labelledBy,
  'aria-describedby': describedBy,
  'aria-invalid': ariaInvalid,
  ...rest
}: RadioCardsRootProps<V> & {
  rootElement?: 'div' | RadioCardsSlots['root'];
  slotStyles?: Interpolation<Theme>;

  errorElement?: 'span' | RadioCardsSlots['error'];
  errorSlotProps?: RadioCardsSlotProps['error'];
}) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  useImperativeHandle(ref, () => rootRef.current as HTMLDivElement, []);
  // Options only carry `V`; composed items carry strings. One boundary widens the emit.
  const notifyChange = useCallback((next: string) => {
    (onValueChange as ((value: string) => void) | undefined)?.(next);
  }, [onValueChange]);
  const [value, requestChange, resetToDefault] = useControlledState<string>(valueProp, defaultValue, notifyChange);
  const [relationships, setRelationships] = useState<Record<Relationship, string[]>>({
    label: [],
    description: [],
  });
  const hasError = isRenderable(error);
  const { sx: errorCss, ...errorProps } = errorSlotProps ?? {};
  const register = useCallback((kind: Relationship, partId: string) => {
    setRelationships((current) => ({ ...current, [kind]: [...current[kind], partId] }));
    return () =>
      setRelationships((current) => ({
        ...current,
        [kind]: current[kind].filter((entry) => entry !== partId),
      }));
  }, []);
  const context = useMemo<CardsContext>(
    () => ({
      value,
      requestChange,
      name: nameProp ?? id,
      disabled,
      required,
      invalid: invalid || hasError,
      size,
      register,
    }),
    [value, requestChange, nameProp, id, disabled, required, invalid, hasError, size, register],
  );
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const forms = new Set(
      inputs(root)
        .map((input) => input.form)
        .filter((form) => form !== null),
    );
    const reset = (event: Event) => {
      queueMicrotask(() => {
        if (event.defaultPrevented) return;
        resetToDefault();
        const next = valueProp !== undefined ? valueProp : defaultValue;
        inputs(root).forEach((input) => {
          input.checked = input.value === next;
        });
      });
    };
    forms.forEach((form) => form.addEventListener('reset', reset));
    return () => forms.forEach((form) => form.removeEventListener('reset', reset));
  }, [resetToDefault, valueProp, defaultValue]);
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented || disabled) return;
    const available = inputs(event.currentTarget).filter((input) => !input.disabled);
    const index = available.indexOf(event.target as HTMLInputElement);
    if (index < 0) return;
    const rtl = getComputedStyle(event.currentTarget).direction === 'rtl';
    const targets: Record<string, number> = {
      ArrowRight: index + (rtl ? -1 : 1),
      ArrowLeft: index + (rtl ? 1 : -1),
      ArrowDown: index + 1,
      ArrowUp: index - 1,
      Home: 0,
      End: available.length - 1,
      Enter: index,
    };
    const target = targets[event.key];
    if (target === undefined) return;
    event.preventDefault();
    const input = available[(target + available.length) % available.length]!;
    input.focus();
    input.click();
  };
  return (
    <Context.Provider value={context}>
      <WithSx className={className} styles={[rootStyle, layoutStyles[layout], slotStyles]} sx={sx}>
        {(className) => (
          <Root
            {...rest}
            ref={rootRef}
            role="radiogroup"
            data-ui="radio-cards"
            data-layout={layout}
            aria-labelledby={joinIds(labelledBy, ...relationships.label)}
            aria-describedby={joinIds(describedBy, ...relationships.description, hasError && `${id}-error`)}
            aria-required={required || undefined}
            aria-disabled={disabled || undefined}
            aria-invalid={invalid || hasError ? true : ariaInvalid}
            onKeyDown={handleKeyDown}
            className={className}
            style={
              {
                ...style,
                '--radio-cards-column':
                  typeof minColumnWidth === 'number' ? `${minColumnWidth}px` : minColumnWidth,
              } as CSSProperties
            }
          >
            {children}
            {hasError && (
              <Error
                {...errorProps}
                id={`${id}-error`}
                role="alert"
                data-ui="radio-cards-error"
                css={[groupPartStyle, errorStyle, errorCss]}
              >
                {error}
              </Error>
            )}
            <MotionConfig reducedMotion="user">
              <SelectionRing root={rootRef} value={value} content={children} />
            </MotionConfig>
          </Root>
        )}
      </WithSx>
    </Context.Provider>
  );
}
RadioCardsRoot.displayName = 'RadioCards';

function RadioCardsItem({
  ref,
  value,
  label,
  description,
  meta,
  icon,
  disabledReason,
  dir,
  disabled: disabledProp,
  required: requiredProp,
  onChange,
  slotProps,
  slots,
  className,
  sx,
  'aria-label': ariaLabel,
  'aria-labelledby': labelledBy,
  'aria-describedby': describedBy,
  'aria-invalid': ariaInvalid,
  ...rest
}: RadioCardsItemProps) {
  const Control = slots?.control ?? 'span';
  const Indicator = slots?.indicator ?? 'span';
  const Icon = slots?.icon ?? 'span';
  const Label = slots?.label ?? 'span';
  const Description = slots?.description ?? 'span';
  const Meta = slots?.meta ?? 'span';
  const context = useCardsContext('Item');
  const id = useId();
  const disabled = context.disabled || disabledProp;
  const detail = disabled && isRenderable(disabledReason) ? disabledReason : description;
  const hasLabel = isRenderable(label);
  const hasDetail = isRenderable(detail);
  return (
    <WithSx className={className} styles={[choiceRootStateStyle, itemStyle]} sx={sx}>
      {(className) => (
        <label
          dir={dir}
          data-ui="radio-cards-item"
          data-state={context.value === value ? 'checked' : 'unchecked'}
          className={className}
        >
          <input
            {...rest}
            ref={ref}
            type="radio"
            data-ui="radio-cards-input"
            name={context.name}
            value={value}
            checked={context.value === value}
            disabled={disabled}
            required={context.required || requiredProp}
            aria-label={ariaLabel}
            aria-labelledby={joinIds(labelledBy, !ariaLabel && hasLabel && `${id}-label`)}
            aria-describedby={joinIds(describedBy, hasDetail && `${id}-description`)}
            aria-invalid={context.invalid ? true : ariaInvalid}
            onChange={(event) => {
              onChange?.(event);
              if (event.currentTarget.checked) context.requestChange(value);
            }}
            css={[choiceInputStyle, inputStyle]}
          />
          <Control
            {...withoutSx(slotProps?.control)}
            data-ui="radio-cards-control"
            css={[controlStyle, sizeStyles[context.size], slotProps?.control?.sx]}
          >
            <Indicator
              {...withoutSx(slotProps?.indicator)}
              aria-hidden="true"
              data-ui="radio-cards-indicator"
              css={[indicatorStyle, slotProps?.indicator?.sx]}
            />
            {isRenderable(icon) && (
              <Icon
                {...withoutSx(slotProps?.icon)}
                aria-hidden="true"
                data-ui="radio-cards-icon"
                css={[iconStyle, slotProps?.icon?.sx]}
              >
                {icon}
              </Icon>
            )}
            {(hasLabel || hasDetail) && (
              <span css={contentStyle}>
                {hasLabel && (
                  <Label
                    {...withoutSx(slotProps?.label)}
                    id={`${id}-label`}
                    data-ui="radio-cards-item-label"
                    css={[labelStyle, slotProps?.label?.sx]}
                  >
                    {label}
                  </Label>
                )}
                {hasDetail && (
                  <Description
                    {...withoutSx(slotProps?.description)}
                    id={`${id}-description`}
                    data-ui="radio-cards-item-description"
                    css={[descriptionStyle, slotProps?.description?.sx]}
                  >
                    {detail}
                  </Description>
                )}
              </span>
            )}
            {isRenderable(meta) && (
              <Meta {...withoutSx(slotProps?.meta)} data-ui="radio-cards-meta" css={[metaStyle, slotProps?.meta?.sx]}>
                {meta}
              </Meta>
            )}
          </Control>
        </label>
      )}
    </WithSx>
  );
}
RadioCardsItem.displayName = 'RadioCards.Item';

function GroupPart({
  kind,
  ref,
  id: idProp,
  children,
  className,
  sx,
  ...rest
}: RadioCardsLabelProps & { kind: Relationship }) {
  const { register } = useCardsContext(kind === 'label' ? 'Label' : 'Description');
  const generatedId = useId();
  const id = idProp ?? generatedId;
  const present = isRenderable(children);
  useEffect(() => (present ? register(kind, id) : undefined), [register, kind, id, present]);
  if (!present) return null;
  return (
    <WithSx
      className={className}
      styles={[groupPartStyle, kind === 'label' ? labelStyle : descriptionStyle]}
      sx={sx}
    >
      {(className) => (
        <span {...rest} ref={ref} id={id} data-ui={`radio-cards-${kind}`} className={className}>
          {children}
        </span>
      )}
    </WithSx>
  );
}
function RadioCardsLabel(props: RadioCardsLabelProps) {
  return <GroupPart {...props} kind="label" />;
}
function RadioCardsDescription(props: RadioCardsDescriptionProps) {
  return <GroupPart {...props} kind="description" />;
}
RadioCardsLabel.displayName = 'RadioCards.Label';
RadioCardsDescription.displayName = 'RadioCards.Description';
function RadioCardsComponent<V extends string = string>(props: RadioCardsProps<V>) {
  if (props.options === undefined) return <RadioCardsRoot {...props} />;
  const { options, label, component, slots, slotProps, ...rest } = props;
  const { className, style, sx: slotSx, ...rootProps } = slotProps?.root ?? {};
  const Label = slots?.label ?? RadioCardsLabel;
  const Item = slots?.item ?? RadioCardsItem;
  return (
    <RadioCardsRoot
      {...rest}
      {...rootProps}
      rootElement={slots?.root ?? component}
      slotStyles={slotSx}
      errorElement={slots?.error}
      errorSlotProps={slotProps?.error}
      className={[className, rest.className].filter(Boolean).join(' ') || undefined}
      style={{ ...rest.style, ...style }}
      sx={rest.sx}
    >
      {isRenderable(label) && <Label {...slotProps?.label}>{label}</Label>}
      {options.map((option) => (
        <Item {...slotProps?.item} {...option} key={option.value} />
      ))}
    </RadioCardsRoot>
  );
}
RadioCardsComponent.displayName = 'RadioCards';
export interface RadioCardsComponentContract {
  <V extends string = string>(props: RadioCardsShorthandProps<V>): ReactElement;
  (props: RadioCardsComposedProps): ReactElement;
  /** Accepts a pre-built shorthand/composed union, e.g. `RadioCardsProps<Plan>` spread into the component. */
  <V extends string = string>(props: RadioCardsProps<V>): ReactElement;
  Item: typeof RadioCardsItem;
  Label: typeof RadioCardsLabel;
  Description: typeof RadioCardsDescription;
}

export const RadioCards = Object.assign(RadioCardsComponent, {
  Item: RadioCardsItem,
  Label: RadioCardsLabel,
  Description: RadioCardsDescription,
}) as RadioCardsComponentContract;
