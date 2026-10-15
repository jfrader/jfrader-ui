// APG pattern: radio group, built on native radios that share one `name`. The browser owns
// the keyboard model: the group is a single tab stop (the checked radio; with none checked,
// the first or last enabled one by Tab direction), Arrow keys move focus AND selection to
// the next/previous enabled radio and wrap, and Space checks the focused radio. Up/Down and
// Left/Right both work in either orientation; `aria-orientation` only describes the layout.
// Disabled radios are skipped.
// Each hidden native input stays operable and draws the focus ring on its visual circle.
import {
  createContext,
  useContext,
  useId,
  useMemo,
  type ChangeEvent,
  type ComponentPropsWithRef,
  type ComponentType,
  type ReactNode,
} from 'react';
import { vars } from '@jfrader/tokens/vars';
import { choiceInputStyle, choiceRootStateStyle, choiceRootStyle, choiceRowStyle } from '../../styling/choice-control';
import { css, type Interpolation, type SerializedStyles, type Theme } from '../../styling/css';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import { WithSx, type SxProps } from '../../styling/sx';
import { isRenderable } from '../../utils/renderable';
import { useControlledState } from '../../utils/use-controlled-state';

export type RadioGroupOrientation = 'vertical' | 'horizontal';

export interface RadioGroupCompoundProps extends Omit<ComponentPropsWithRef<'div'>, 'onChange' | 'defaultValue'>, SxProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  name?: string;
  disabled?: boolean;
  orientation?: RadioGroupOrientation;
  options?: never;
  label?: never;
  slots?: never;
  component?: never;
  slotProps?: never;
}

export type RadioGroupOption = Pick<
  RadioGroupRadioProps,
  'value' | 'description' | 'disabled' | 'id'
> & { label: ReactNode };
export interface RadioGroupSlots {
  /** Container element wrapping the radio group. */
  root?: ComponentType<ComponentPropsWithRef<'div'>>;
  /** Header label naming the radio group. */
  label?: ComponentType<ComponentPropsWithRef<'span'>>;
  /** Radio button option within the group. Default: `RadioGroup.Radio`. */
  radio?: ComponentType<RadioGroupRadioProps>;
}
export interface RadioGroupSlotProps {
  /** Container element wrapping the radio group. */
  root?: Omit<ComponentPropsWithRef<'div'>, 'children' | 'defaultValue' | 'onChange'> & SxProps & {
    css?: Interpolation<Theme>;
    [attribute: `data-${string}`]: unknown;
  };
  /** Header label naming the radio group. */
  label?: Omit<ComponentPropsWithRef<'span'>, 'children'> & { css?: Interpolation<Theme> };
  /** Radio button option within the group. Default: `RadioGroup.Radio`. */
  radio?: Omit<RadioGroupRadioProps, 'value' | 'label' | 'description' | 'disabled' | 'id' | 'children'>;
}
export interface RadioGroupEasyProps extends Omit<RadioGroupCompoundProps, 'children' | 'options' | 'label' | 'slots' | 'slotProps' | 'component'> {
  options: readonly RadioGroupOption[];
  label?: ReactNode;
  children?: never;
  slots?: RadioGroupSlots;
  component?: RadioGroupSlots['root'];
  slotProps?: RadioGroupSlotProps;
}
export type RadioGroupProps = RadioGroupCompoundProps | RadioGroupEasyProps;

export interface RadioGroupRadioPartProps extends ComponentPropsWithRef<'span'> {
  className?: string;
  css?: Interpolation<Theme>;
}
export interface RadioGroupRadioSlots {
  /** Outer label wrapping the radio and text. */
  root?: ComponentType<ComponentPropsWithRef<'label'> & { css?: Interpolation<Theme> }>;
  /** Text naming the radio option. */
  label?: ComponentType<RadioGroupRadioPartProps>;
  /** Circle displaying the selection state. */
  control?: ComponentType<RadioGroupRadioPartProps>;
  /** Supporting text below the option. */
  description?: ComponentType<RadioGroupRadioPartProps>;
}

export interface RadioGroupRadioProps
  extends Omit<ComponentPropsWithRef<'input'>, 'type' | 'value' | 'name' | 'checked' | 'defaultChecked' | 'size'>,
    SxProps {
  value: string;
  label?: ReactNode;
  description?: ReactNode;
  slots?: RadioGroupRadioSlots;
  slotProps?: {
    /** Outer label wrapping the radio control and text. */
    root?: ComponentPropsWithRef<'label'> & { css?: Interpolation<Theme> };
    /** Text label displayed alongside the radio button. */
    label?: RadioGroupRadioPartProps;
    /** Visual circular indicator displaying the radio dot. */
    control?: RadioGroupRadioPartProps;
    /** Helper text displayed below the radio label. */
    description?: RadioGroupRadioPartProps;
  };
}

interface RadioGroupContextValue {
  value: string | undefined;
  setValue: (value: string) => void;
  name: string;
  disabled: boolean;
}

const RadioGroupContext = createContext<RadioGroupContextValue | null>(null);

function useRadioGroupContext(part: string): RadioGroupContextValue {
  const context = useContext(RadioGroupContext);
  if (!context) throw new Error(`RadioGroup.${part} must be rendered inside <RadioGroup>.`);
  return context;
}

const CONTROL_SIZE = '16px';

const rootStyles: Record<RadioGroupOrientation, SerializedStyles> = {
  vertical: css({
    display: 'grid',
    justifyItems: 'start',
    gap: vars.space[3],
  }),
  horizontal: css({
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    gap: vars.space[4],
  }),
};

const dotStateStyle = css({
  'input:checked + span::after': { opacity: 1 },
});

const rowFloorStyle = css({
  minBlockSize: '32px',
});

const circleStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  boxSizing: 'border-box',
  inlineSize: CONTROL_SIZE,
  blockSize: CONTROL_SIZE,
  border: `1px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.full,
  backgroundColor: vars.color.surfaceRaised,
  transitionProperty: 'background-color, border-color',
  transitionDuration: vars.motion.duration.fast,
  transitionTimingFunction: vars.motion.easeStandard,
  '&::after': {
    content: '""',
    inlineSize: '40%',
    blockSize: '40%',
    borderRadius: vars.radius.full,
    backgroundColor: vars.color.accentContrast,
    opacity: 0,
  },
  [REDUCED_MOTION]: {
    transitionDuration: '0s',
  },
  [FORCED_COLORS]: {
    '&::after': { backgroundColor: 'CanvasText' },
  },
});

const labelStyle = css({
  fontSize: vars.textSize.sm,
});
const groupLabelStyle = css({
  flexBasis: '100%',
  fontFamily: vars.font.sans,
  fontSize: vars.textSize.sm,
  fontWeight: vars.fontWeight.medium,
  color: vars.color.text,
});

const descriptionStyle = css({
  marginInlineStart: `calc(${CONTROL_SIZE} + ${vars.space[2]})`,
  fontSize: vars.textSize.sm,
  color: vars.color.textMuted,
});

function RadioGroupRoot({
  rootElement: Root = 'div',
  rootCss,
  ref,
  value: valueProp,
  defaultValue,
  onValueChange,
  name: nameProp,
  disabled = false,
  orientation = 'vertical',
  className,
  sx,
  ...rest
}: RadioGroupCompoundProps & { rootElement?: 'div' | RadioGroupSlots['root']; rootCss?: Interpolation<Theme> }) {
  const generatedName = useId();
  const name = nameProp ?? generatedName;
  const [value, setValue] = useControlledState<string>(valueProp, defaultValue, onValueChange);

  const context = useMemo(() => ({ value, setValue, name, disabled }), [value, setValue, name, disabled]);

  return (
    <RadioGroupContext.Provider value={context}>
      <WithSx className={className} styles={[rootStyles[orientation], rootCss]} sx={sx}>
        {(className) => (
          <Root
            {...rest}
            ref={ref}
            role="radiogroup"
            aria-orientation={orientation}
            aria-disabled={disabled ? true : (rest['aria-disabled'] as boolean | 'true' | 'false' | undefined)}
            data-ui="radio-group-root"
            data-orientation={orientation}
            className={className}
          />
        )}
      </WithSx>
    </RadioGroupContext.Provider>
  );
}

RadioGroupRoot.displayName = 'RadioGroup';

function RadioGroupRadio({
  ref,
  value,
  label,
  description,
  disabled: disabledProp,
  onChange,
  slotProps,
  slots,
  className,
  sx,
  dir,
  'aria-labelledby': ariaLabelledByProp,
  'aria-describedby': ariaDescribedByProp,
  ...rest
}: RadioGroupRadioProps) {
  const Root = slots?.root ?? 'label';
  const Label = slots?.label ?? 'span';
  const Control = slots?.control ?? 'span';
  const Description = slots?.description ?? 'span';
  const { value: selectedValue, setValue, name, disabled: groupDisabled } = useRadioGroupContext('Radio');
  const disabled = groupDisabled || disabledProp;

  const id = useId();
  const labelId = `${id}-label`;
  const descriptionId = `${id}-description`;
  const hasLabel = isRenderable(label);
  const hasDescription = isRenderable(description);
  const ariaLabelledBy = [ariaLabelledByProp, hasLabel && labelId].filter(Boolean).join(' ') || undefined;
  const ariaDescribedBy = [ariaDescribedByProp, hasDescription && descriptionId].filter(Boolean).join(' ') || undefined;
  const rootClassName = [className, slotProps?.root?.className].filter(Boolean).join(' ') || undefined;

  // Native radios only fire `change` when they become checked, so every event is a selection
  // request. React restores the controlled checked radio when the parent rejects it.
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange?.(event);
    if (event.currentTarget.checked) setValue(value);
  };

  return (
    <WithSx
      className={rootClassName}
      styles={[choiceRootStyle, dotStateStyle, choiceRootStateStyle, slotProps?.root?.css]}
      sx={sx}
    >
      {(className) => (
        <Root {...slotProps?.root} css={undefined} data-ui="radio-group-radio" dir={dir} className={className}>
          <span css={[choiceRowStyle, rowFloorStyle]}>
            <input
              {...rest}
              ref={ref}
              type="radio"
              name={name}
              value={value}
              dir={dir}
              checked={selectedValue === value}
              disabled={disabled}
              aria-labelledby={ariaLabelledBy}
              aria-describedby={ariaDescribedBy}
              onChange={handleChange}
              css={choiceInputStyle}
            />
            <Control
              {...slotProps?.control}
              aria-hidden="true"
              className={slotProps?.control?.className}
              css={[circleStyle, slotProps?.control?.css]}
            />
            {hasLabel && (
              <Label {...slotProps?.label} id={labelId} className={slotProps?.label?.className} css={[labelStyle, slotProps?.label?.css]}>
                {label}
              </Label>
            )}
          </span>
          {hasDescription && (
            <Description
              {...slotProps?.description}
              id={descriptionId}
              className={slotProps?.description?.className}
              css={[descriptionStyle, slotProps?.description?.css]}
            >
              {description}
            </Description>
          )}
        </Root>
      )}
    </WithSx>
  );
}

RadioGroupRadio.displayName = 'RadioGroup.Radio';

function RadioGroupComponent(props: RadioGroupProps) {
  const labelId = useId();
  if (props.options === undefined) return <RadioGroupRoot {...props} />;
  const { options, label, component, slots, slotProps, ...rest } = props;
  const { css: rootCss, className, style, sx, ...rootProps } = slotProps?.root ?? {};
  const Label = slots?.label ?? 'span';
  const Radio = slots?.radio ?? RadioGroupRadio;
  const hasLabel = isRenderable(label);
  const resolvedLabelId = slotProps?.label?.id ?? labelId;
  return (
    <RadioGroupRoot
      {...rest}
      {...rootProps}
      rootElement={slots?.root ?? component}
      rootCss={rootCss}
      className={[className, rest.className].filter(Boolean).join(' ') || undefined}
      style={{ ...rest.style, ...style }}
      sx={[sx, rest.sx]}
      aria-labelledby={[rootProps['aria-labelledby'] ?? rest['aria-labelledby'], hasLabel && resolvedLabelId].filter(Boolean).join(' ') || undefined}
    >
      {hasLabel && (
        <Label {...slotProps?.label} id={resolvedLabelId} css={[groupLabelStyle, slotProps?.label?.css]}>
          {label}
        </Label>
      )}
      {options.map((option) => (
        <Radio {...slotProps?.radio} {...option} key={option.value} />
      ))}
    </RadioGroupRoot>
  );
}
RadioGroupComponent.displayName = 'RadioGroup';
export const RadioGroup = Object.assign(RadioGroupComponent, { Radio: RadioGroupRadio });
