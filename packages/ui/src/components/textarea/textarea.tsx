// APG pattern: native multi-line text input. The label, description and error text are wired
// with explicit ids (`htmlFor`, `aria-describedby`) so assistive tech reads name, help and
// error in order; the error region is an alert.
// `autoResize` uses `field-sizing: content` (Baseline June 2026); engines without it ignore
// the declaration and keep the fixed `rows` height.
import type { ChangeEvent, ComponentPropsWithRef, ReactNode } from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css, type SerializedStyles } from '../../styling/css';
import { inputControlStyle } from '../../styling/input-control';
import { controlBlockSize, controlTextSize } from '../../styling/control-size';
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

export type TextareaSize = 'sm' | 'md' | 'lg';
export type TextareaResize = 'none' | 'vertical';

export interface TextareaPartProps extends FieldPartProps {}

type TextareaAnatomy = {
  /** Outer container wrapping the textarea and its parts. */
  root: 'div';
  /** Label element associated with the textarea. */
  label: 'label';
  /** Native textarea receiving multi-line entry. */
  control: 'textarea';
  /** Helper text element displayed below the textarea. */
  description: 'span';
  /** Validation error message displayed when invalid. */
  error: 'span';
};
export type TextareaSlots = FieldSlots<TextareaAnatomy>;
export type TextareaSlotProps = FieldParts<TextareaAnatomy>;

export interface TextareaProps extends ComponentPropsWithRef<'textarea'>, SxProps {
  /** Name the textarea with a linked label. */
  label?: ReactNode;
  /** Label placement. `hidden` keeps the accessible name without taking layout space. */
  labelPlacement?: FieldLabelPlacement;
  /** Show supporting content linked to the textarea's accessible description. */
  description?: ReactNode;
  /** Show an error linked to the textarea and mark it invalid. */
  error?: ReactNode;
  /** Set the text size, padding and minimum height. Defaults to `md`. */
  size?: TextareaSize;
  /** Allow manual vertical resizing or disable it. Defaults to `vertical`. */
  resize?: TextareaResize;
  /** Grow with content in browsers supporting `field-sizing: content`, which ignores `rows`. Defaults to `false`. */
  autoResize?: boolean;
  /** Receive the current text after the native `onChange` callback. */
  onValueChange?: (value: string) => void;
  /** Replace the wrapper div; `slots.root` takes precedence. */
  component?: TextareaSlots['root'];
  /** Replace generated parts with components that forward props and ref. */
  slots?: TextareaSlots;
  /** Pass props and `sx` to the wrapper, control, label and supporting text. */
  slotProps?: TextareaSlotProps;
}

const controlStyle = css({
  paddingBlock: vars.space[2],
  lineHeight: vars.lineHeight.base,
});

// Size minimums are floors: rows or autoResize can make the control taller.
// With autoResize, engines supporting field-sizing: content ignore rows.
const sizeStyles: Record<TextareaSize, SerializedStyles> = {
  sm: css({ minBlockSize: `calc(${controlBlockSize.sm} * 2)`, paddingInline: vars.space[3], fontSize: controlTextSize.sm }),
  md: css({ minBlockSize: `calc(${controlBlockSize.md} * 2)`, paddingInline: vars.space[4], fontSize: controlTextSize.md }),
  lg: css({ minBlockSize: `calc(${controlBlockSize.lg} * 2)`, paddingInline: vars.space[4], fontSize: controlTextSize.lg }),
};

const resizeStyles: Record<TextareaResize, SerializedStyles> = {
  none: css({ resize: 'none' }),
  vertical: css({ resize: 'vertical' }),
};

const autoResizeStyle = css({ fieldSizing: 'content' });

export function Textarea({
  ref,
  label,
  labelPlacement = 'above',
  description,
  error,
  size = 'md',
  resize = 'vertical',
  autoResize = false,
  rows = 3,
  onChange,
  onValueChange,
  component,
  slots,
  slotProps,
  className,
  sx,
  dir,
  required,
  id: idProp,
  'aria-describedby': ariaDescribedByProp,
  'aria-invalid': ariaInvalidProp,
  ...rest
}: TextareaProps) {
  const field = useFieldAnatomy({
    id: idProp,
    description,
    error,
    'aria-describedby': ariaDescribedByProp,
    'aria-invalid': ariaInvalidProp,
  });

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    onChange?.(event);
    onValueChange?.(event.currentTarget.value);
  };

  return (
    <FieldRoot
      style={rest.style}
      title={rest.title}
      component={slots?.root ?? component}
      data-ui="textarea"
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
        element="textarea"
        component={slots?.control}
        slotProps={slotProps?.control}
        {...rest}
        ref={ref}
        id={field.id}
        rows={rows}
        dir={dir}
        required={required}
        aria-describedby={field.describedBy}
        aria-invalid={field.ariaInvalid}
        onChange={handleChange}
        styles={[
          inputControlStyle,
          controlStyle,
          sizeStyles[size],
          resizeStyles[resize],
          autoResize && autoResizeStyle,
        ]}
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

Textarea.displayName = 'Textarea';
