// APG pattern: native text input. The label, description and error text are wired with
// explicit ids (`htmlFor`, `aria-describedby`) so assistive tech reads name, help and
// error in order; the error region is an alert.
import type { ChangeEvent, ComponentPropsWithRef, ReactNode } from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css, type SerializedStyles } from '../../styling/css';
import { inputControlStyle } from '../../styling/input-control';
import { controlFixedSizeStyles, controlTouchTargetStyles } from '../../styling/control-size';
import type { SxProps } from '../../styling/sx';
import {
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldRoot,
  useFieldAnatomy,
  type FieldLabelPlacement,
  type FieldPartProps,
} from '../field/field-anatomy';
import { FieldSlot, type FieldSlots, type FieldParts } from '../field/field-slot';

export type TextFieldSize = 'sm' | 'md' | 'lg';

export interface TextFieldPartProps extends FieldPartProps {}

type TextFieldAnatomy = {
  /** Outer container wrapping the text field. */
  root: 'div';
  /** Label element associated with the input control. */
  label: 'label';
  /** Native text input receiving user entry. */
  control: 'input';
  /** Helper text element displayed below the input. */
  description: 'span';
  /** Validation error message displayed when invalid. */
  error: 'span';
};
export type TextFieldSlots = FieldSlots<TextFieldAnatomy>;
export type TextFieldSlotProps = FieldParts<TextFieldAnatomy>;

export interface TextFieldProps extends Omit<ComponentPropsWithRef<'input'>, 'size'>, SxProps {
  /** Name the input with an associated label. */
  label?: ReactNode;
  /** Label placement. `hidden` keeps the accessible name without taking layout space. */
  labelPlacement?: FieldLabelPlacement;
  /** Show supporting text and include it in the input's accessible description. */
  description?: ReactNode;
  /** Show a validation message and mark the input invalid. */
  error?: ReactNode;
  /** Set the input height and text size. Defaults to `md`. */
  size?: TextFieldSize;
  /** Receive the input text after the native `onChange` callback runs. */
  onValueChange?: (value: string) => void;
  /** Replace the wrapper div; `slots.root` takes precedence. */
  component?: TextFieldSlots['root'];
  /** Replace generated parts with components that forward props and ref. */
  slots?: TextFieldSlots;
  /** Pass props and `sx` to the wrapper, label, input, description, and error. */
  slotProps?: TextFieldSlotProps;
}

const sizeStyles: Record<TextFieldSize, SerializedStyles> = {
  sm: css(controlFixedSizeStyles.sm, controlTouchTargetStyles.sm, { paddingInline: vars.space[3] }),
  md: css(controlFixedSizeStyles.md, controlTouchTargetStyles.md, { paddingInline: vars.space[4] }),
  lg: css(controlFixedSizeStyles.lg, controlTouchTargetStyles.lg, { paddingInline: vars.space[4] }),
};

export function TextField({
  ref,
  label,
  labelPlacement = 'above',
  description,
  error,
  size = 'md',
  onChange,
  onValueChange,
  component,
  slots,
  slotProps,
  className,
  sx,
  required,
  id: idProp,
  dir,
  'aria-describedby': ariaDescribedByProp,
  'aria-invalid': ariaInvalidProp,
  ...rest
}: TextFieldProps) {
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
    <FieldRoot
      style={rest.style}
      title={rest.title}
      component={slots?.root ?? component}
      data-ui="text-field"
      dir={dir}
      className={className}
      sx={sx}
      part={slotProps?.root}
    >
      <FieldLabel
        component={slots?.label}
        htmlFor={field.id}
        required={required}
        hidden={labelPlacement === 'hidden'}
        part={slotProps?.label}
      >
        {label}
      </FieldLabel>
      <FieldSlot
        element="input"
        component={slots?.control}
        slotProps={slotProps?.control}
        {...rest}
        ref={ref}
        id={field.id}
        dir={dir}
        required={required}
        aria-describedby={field.describedBy}
        aria-invalid={field.ariaInvalid}
        onChange={handleChange}
        styles={[inputControlStyle, sizeStyles[size]]}
      />
      <FieldDescription component={slots?.description} id={field.descriptionId} part={slotProps?.description}>
        {description}
      </FieldDescription>
      <FieldError component={slots?.error} id={field.errorId} part={slotProps?.error}>
        {error}
      </FieldError>
    </FieldRoot>
  );
}

TextField.displayName = 'TextField';
