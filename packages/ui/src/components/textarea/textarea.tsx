// APG pattern: native multi-line text input. The label, description and error text are wired
// with explicit ids (`htmlFor`, `aria-describedby`) so assistive tech reads name, help and
// error in order; the error region is an alert.
// `autoResize` uses `field-sizing: content` (Baseline June 2026); engines without it ignore
// the declaration and keep the fixed `rows` height.
import type { ChangeEvent, ComponentPropsWithRef, ReactNode } from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css, type SerializedStyles } from '../../styling/css';
import { inputControlStyle } from '../../styling/input-control';
import type { SxProps } from '../../styling/sx';
import {
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldRoot,
  useFieldAnatomy,
  type FieldPartProps,
  type FieldSlotProps,
} from '../field/field-anatomy';

export type TextareaSize = 'sm' | 'md' | 'lg';
export type TextareaResize = 'none' | 'vertical';

export interface TextareaPartProps extends FieldPartProps {}

export interface TextareaProps extends ComponentPropsWithRef<'textarea'>, SxProps {
  label?: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  size?: TextareaSize;
  resize?: TextareaResize;
  autoResize?: boolean;
  onValueChange?: (value: string) => void;
  slotProps?: FieldSlotProps<TextareaPartProps>;
}

const controlStyle = css({
  paddingBlock: vars.space[2],
  lineHeight: vars.lineHeight.base,
});

// Size minimums are floors: rows or autoResize can make the control taller.
// With autoResize, engines supporting field-sizing: content ignore rows.
const sizeStyles: Record<TextareaSize, SerializedStyles> = {
  sm: css({ minBlockSize: '64px', paddingInline: vars.space[3], fontSize: vars.textSize.sm }),
  md: css({ minBlockSize: '80px', paddingInline: vars.space[4], fontSize: vars.textSize.sm }),
  lg: css({ minBlockSize: '96px', paddingInline: vars.space[4], fontSize: vars.textSize.md }),
};

const resizeStyles: Record<TextareaResize, SerializedStyles> = {
  none: css({ resize: 'none' }),
  vertical: css({ resize: 'vertical' }),
};

const autoResizeStyle = css({ fieldSizing: 'content' });

export function Textarea({
  ref,
  label,
  description,
  error,
  size = 'md',
  resize = 'vertical',
  autoResize = false,
  rows = 3,
  onChange,
  onValueChange,
  slotProps,
  className,
  sx,
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
    <FieldRoot data-ui="textarea" className={className} sx={sx} part={slotProps?.root}>
      <FieldLabel htmlFor={field.id} required={required} part={slotProps?.label}>
        {label}
      </FieldLabel>
      <textarea
        {...rest}
        ref={ref}
        id={field.id}
        rows={rows}
        required={required}
        aria-describedby={field.describedBy}
        aria-invalid={field.ariaInvalid}
        onChange={handleChange}
        className={slotProps?.control?.className}
        css={[
          inputControlStyle,
          controlStyle,
          sizeStyles[size],
          resizeStyles[resize],
          autoResize && autoResizeStyle,
          slotProps?.control?.css,
        ]}
      />
      <FieldDescription id={field.descriptionId} part={slotProps?.description}>
        {description}
      </FieldDescription>
      <FieldError id={field.errorId} part={slotProps?.error}>
        {error}
      </FieldError>
    </FieldRoot>
  );
}

Textarea.displayName = 'Textarea';
