// APG pattern: radio group, built on native radios that share one `name`. The browser owns
// the keyboard model: the group is a single tab stop (the checked radio; with none checked,
// the first or last enabled one by Tab direction), Arrow keys move focus AND selection to
// the next/previous enabled radio and wrap, and Space checks the focused radio. Up/Down and
// Left/Right both work in either orientation; `aria-orientation` only describes the layout.
// Disabled radios are skipped.
// Each hidden native input stays operable and draws the focus ring on its visual circle.
import {
  createContext,
  forwardRef,
  useContext,
  useId,
  useMemo,
  type ChangeEvent,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type SerializedStyles, type Theme } from '../../styling/css';
import { isRenderable } from '../../utils/renderable';
import { useControlledState } from '../../utils/use-controlled-state';

export type RadioGroupOrientation = 'vertical' | 'horizontal';

export interface RadioGroupProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange' | 'defaultValue'> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  name?: string;
  disabled?: boolean;
  orientation?: RadioGroupOrientation;
}

export interface RadioGroupRadioPartProps {
  className?: string;
  css?: Interpolation<Theme>;
}

export interface RadioGroupRadioProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'name' | 'checked' | 'defaultChecked' | 'size'> {
  value: string;
  label?: ReactNode;
  description?: ReactNode;
  slotProps?: {
    root?: RadioGroupRadioPartProps;
    label?: RadioGroupRadioPartProps;
    control?: RadioGroupRadioPartProps;
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

const REDUCED_MOTION = '@media (prefers-reduced-motion: reduce)';
const FORCED_COLORS = '@media (forced-colors: active)';

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

const radioStyle = css({
  display: 'inline-flex',
  flexDirection: 'column',
  gap: vars.space[1],
  cursor: 'pointer',
  'input:checked + span': { backgroundColor: vars.color.accent, borderColor: vars.color.accent },
  'input:checked + span::after': { opacity: 1 },
  'input:focus-visible + span': {
    outline: `2px solid ${vars.color.focusRing}`,
    outlineOffset: '2px',
  },
  '&:has(input:disabled)': {
    opacity: 0.55,
    cursor: 'not-allowed',
  },
});

const rowStyle = css({
  position: 'relative',
  display: 'inline-flex',
  alignItems: 'center',
  minBlockSize: '32px',
  gap: vars.space[2],
});

const inputStyle = css({
  position: 'absolute',
  opacity: 0,
  inlineSize: CONTROL_SIZE,
  blockSize: CONTROL_SIZE,
  margin: 0,
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

const descriptionStyle = css({
  marginInlineStart: `calc(${CONTROL_SIZE} + ${vars.space[2]})`,
  fontSize: vars.textSize.sm,
  color: vars.color.textMuted,
});

const Root = forwardRef<HTMLDivElement, RadioGroupProps>(function RadioGroup(
  {
    value: valueProp,
    defaultValue,
    onValueChange,
    name: nameProp,
    disabled = false,
    orientation = 'vertical',
    ...rest
  },
  ref,
) {
  const generatedName = useId();
  const name = nameProp ?? generatedName;
  const [value, setValue] = useControlledState<string>(valueProp, defaultValue, onValueChange);

  const context = useMemo(() => ({ value, setValue, name, disabled }), [value, setValue, name, disabled]);

  return (
    <RadioGroupContext.Provider value={context}>
      <div
        {...rest}
        ref={ref}
        role="radiogroup"
        aria-orientation={orientation}
        data-ui="radio-group-root"
        data-orientation={orientation}
        css={rootStyles[orientation]}
      />
    </RadioGroupContext.Provider>
  );
});

const Radio = forwardRef<HTMLInputElement, RadioGroupRadioProps>(function RadioGroupRadio(
  {
    value,
    label,
    description,
    disabled: disabledProp,
    onChange,
    slotProps,
    className,
    'aria-labelledby': ariaLabelledByProp,
    'aria-describedby': ariaDescribedByProp,
    ...rest
  },
  ref,
) {
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
    <label data-ui="radio-group-radio" className={rootClassName} css={[radioStyle, slotProps?.root?.css]}>
      <span css={rowStyle}>
        <input
          {...rest}
          ref={ref}
          type="radio"
          name={name}
          value={value}
          checked={selectedValue === value}
          disabled={disabled}
          aria-labelledby={ariaLabelledBy}
          aria-describedby={ariaDescribedBy}
          onChange={handleChange}
          css={inputStyle}
        />
        <span aria-hidden="true" className={slotProps?.control?.className} css={[circleStyle, slotProps?.control?.css]} />
        {hasLabel && (
          <span id={labelId} className={slotProps?.label?.className} css={[labelStyle, slotProps?.label?.css]}>
            {label}
          </span>
        )}
      </span>
      {hasDescription && (
        <span
          id={descriptionId}
          className={slotProps?.description?.className}
          css={[descriptionStyle, slotProps?.description?.css]}
        >
          {description}
        </span>
      )}
    </label>
  );
});

export const RadioGroup = Object.assign(Root, { Radio });
