// APG pattern: native text input. The label, description and error text are wired with
// explicit ids (`htmlFor`, `aria-describedby`) so assistive tech reads name, help and
// error in order; the error region is an alert.
import { forwardRef, type ChangeEvent, type InputHTMLAttributes, type ReactNode } from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css, type SerializedStyles } from '../../styling/css';
import {
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldRoot,
  useFieldAnatomy,
  type FieldPartProps,
  type FieldSlotProps,
} from '../field/field-anatomy';

export type TextFieldSize = 'sm' | 'md' | 'lg';

export interface TextFieldPartProps extends FieldPartProps {}

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  size?: TextFieldSize;
  onValueChange?: (value: string) => void;
  slotProps?: FieldSlotProps<TextFieldPartProps>;
}

const REDUCED_MOTION = '@media (prefers-reduced-motion: reduce)';

const controlStyle = css({
  display: 'block',
  inlineSize: '100%',
  boxSizing: 'border-box',
  margin: 0,
  backgroundColor: vars.color.surfaceRaised,
  border: `1px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.md,
  color: vars.color.text,
  fontFamily: vars.font.sans,
  transitionProperty: 'border-color',
  transitionDuration: vars.motion.duration.fast,
  transitionTimingFunction: vars.motion.easeStandard,
  '&::placeholder': { color: vars.color.textSubtle },
  '&:hover:not(:disabled):not(:focus-visible)': { borderColor: vars.color.textSubtle },
  '&:focus-visible': {
    outline: `2px solid ${vars.color.focusRing}`,
    outlineOffset: '2px',
    borderColor: vars.color.focusRing,
  },
  '&:disabled': {
    opacity: 0.55,
    cursor: 'not-allowed',
  },
  '&[aria-invalid="true"]:not(:focus-visible)': {
    borderColor: vars.color.dangerBorder,
  },
  [REDUCED_MOTION]: {
    transitionDuration: '0s',
  },
});

const sizeStyles: Record<TextFieldSize, SerializedStyles> = {
  sm: css({ blockSize: '32px', paddingInline: vars.space[3], fontSize: vars.textSize.sm }),
  md: css({ blockSize: '40px', paddingInline: vars.space[4], fontSize: vars.textSize.sm }),
  lg: css({ blockSize: '48px', paddingInline: vars.space[4], fontSize: vars.textSize.md }),
};

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  {
    label,
    description,
    error,
    size = 'md',
    onChange,
    onValueChange,
    slotProps,
    className,
    required,
    id: idProp,
    'aria-describedby': ariaDescribedByProp,
    'aria-invalid': ariaInvalidProp,
    ...rest
  },
  ref,
) {
  const field = useFieldAnatomy({
    id: idProp,
    description,
    error,
    'aria-describedby': ariaDescribedByProp,
    'aria-invalid': ariaInvalidProp,
  });

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange?.(event);
    onValueChange?.(event.currentTarget.value);
  };

  return (
    <FieldRoot data-ui="text-field" className={className} part={slotProps?.root}>
      <FieldLabel htmlFor={field.id} required={required} part={slotProps?.label}>
        {label}
      </FieldLabel>
      <input
        {...rest}
        ref={ref}
        id={field.id}
        required={required}
        aria-describedby={field.describedBy}
        aria-invalid={field.ariaInvalid}
        onChange={handleChange}
        className={slotProps?.control?.className}
        css={[controlStyle, sizeStyles[size], slotProps?.control?.css]}
      />
      <FieldDescription id={field.descriptionId} part={slotProps?.description}>
        {description}
      </FieldDescription>
      <FieldError id={field.errorId} part={slotProps?.error}>
        {error}
      </FieldError>
    </FieldRoot>
  );
});
