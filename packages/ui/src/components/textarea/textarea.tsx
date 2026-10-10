// APG pattern: native multi-line text input. The label, description and error text are wired
// with explicit ids (`htmlFor`, `aria-describedby`) so assistive tech reads name, help and
// error in order; the error region is an alert.
// `autoResize` uses `field-sizing: content` (Baseline June 2026); engines without it ignore
// the declaration and keep the fixed `rows` height.
import { forwardRef, useId, type ChangeEvent, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type SerializedStyles, type Theme } from '../../styling/css';
import { isRenderable } from '../../utils/renderable';

export type TextareaSize = 'sm' | 'md' | 'lg';
export type TextareaResize = 'none' | 'vertical';

export interface TextareaPartProps {
  className?: string;
  css?: Interpolation<Theme>;
}

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  size?: TextareaSize;
  resize?: TextareaResize;
  autoResize?: boolean;
  onValueChange?: (value: string) => void;
  slotProps?: {
    root?: TextareaPartProps;
    label?: TextareaPartProps;
    control?: TextareaPartProps;
    description?: TextareaPartProps;
    error?: TextareaPartProps;
  };
}

const REDUCED_MOTION = '@media (prefers-reduced-motion: reduce)';

const rootStyle = css({
  display: 'grid',
  gap: vars.space[1],
  inlineSize: '100%',
});

const labelStyle = css({
  display: 'inline-flex',
  gap: vars.space[1],
  fontSize: vars.textSize.sm,
  fontWeight: vars.fontWeight.medium,
  color: vars.color.text,
});

const requiredMarkStyle = css({
  color: vars.color.dangerText,
});

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

const descriptionStyle = css({
  fontSize: vars.textSize.sm,
  color: vars.color.textMuted,
});

const errorStyle = css({
  fontSize: vars.textSize.sm,
  color: vars.color.dangerText,
});

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
  const generatedId = useId();
  const id = idProp ?? generatedId;
  const descriptionId = `${id}-description`;
  const errorId = `${id}-error`;
  const hasDescription = isRenderable(description);
  const hasError = isRenderable(error);
  const describedBy =
    [ariaDescribedByProp, hasDescription && descriptionId, hasError && errorId].filter(Boolean).join(' ') || undefined;
  const ariaInvalid = hasError ? true : ariaInvalidProp;
  const rootClassName = [className, slotProps?.root?.className].filter(Boolean).join(' ') || undefined;

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    onChange?.(event);
    onValueChange?.(event.currentTarget.value);
  };

  return (
    <div data-ui="textarea" className={rootClassName} css={[rootStyle, slotProps?.root?.css]}>
      {isRenderable(label) && (
        <label htmlFor={id} className={slotProps?.label?.className} css={[labelStyle, slotProps?.label?.css]}>
          {label}
          {required && (
            <span aria-hidden css={requiredMarkStyle}>
              {' *'}
            </span>
          )}
        </label>
      )}
      <textarea
        {...rest}
        ref={ref}
        id={id}
        rows={rows}
        required={required}
        aria-describedby={describedBy}
        aria-invalid={ariaInvalid}
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
      {hasDescription && (
        <span
          id={descriptionId}
          className={slotProps?.description?.className}
          css={[descriptionStyle, slotProps?.description?.css]}
        >
          {description}
        </span>
      )}
      {hasError && (
        <span
          id={errorId}
          role="alert"
          className={slotProps?.error?.className}
          css={[errorStyle, slotProps?.error?.css]}
        >
          {error}
        </span>
      )}
    </div>
  );
});
