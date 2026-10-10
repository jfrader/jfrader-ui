// APG pattern: native multi-line text input. The label, description and error text are wired
// with explicit ids (`htmlFor`, `aria-describedby`) so assistive tech reads name, help and
// error in order; the error region is an alert.
// `autoResize` uses `field-sizing: content` (Baseline June 2026); engines without it ignore
// the declaration and keep the fixed `rows` height.
import { forwardRef, type ChangeEvent, type ReactNode, type TextareaHTMLAttributes } from 'react';
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

export type TextareaSize = 'sm' | 'md' | 'lg';
export type TextareaResize = 'none' | 'vertical';

export interface TextareaPartProps extends FieldPartProps {}

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  size?: TextareaSize;
  resize?: TextareaResize;
  autoResize?: boolean;
  onValueChange?: (value: string) => void;
  slotProps?: FieldSlotProps<TextareaPartProps>;
}

const REDUCED_MOTION = '@media (prefers-reduced-motion: reduce)';

const controlStyle = css({
  display: 'block',
  inlineSize: '100%',
  boxSizing: 'border-box',
  margin: 0,
  paddingBlock: vars.space[2],
  backgroundColor: vars.color.surfaceRaised,
  border: `1px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.md,
  color: vars.color.text,
  fontFamily: vars.font.sans,
  lineHeight: vars.lineHeight.base,
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

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  {
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

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    onChange?.(event);
    onValueChange?.(event.currentTarget.value);
  };

  return (
    <FieldRoot data-ui="textarea" className={className} part={slotProps?.root}>
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
});
