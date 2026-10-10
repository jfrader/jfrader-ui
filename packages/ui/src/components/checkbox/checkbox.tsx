// APG pattern: native checkbox. Space toggles it, the label is part of the click target,
// and state is exposed through the native checked property plus aria-checked="mixed"
// while `indeterminate` is set. `indeterminate` is controlled: clear the prop to leave
// the mixed state.
import {
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  type ChangeEvent,
  type ComponentPropsWithRef,
  type ReactNode,
} from 'react';
import { vars } from '@jfrader/tokens/vars';
import { choiceInputStyle, choiceRootStateStyle, choiceRootStyle, choiceRowStyle } from '../../styling/choice-control';
import { css, type Interpolation, type SerializedStyles, type Theme } from '../../styling/css';
import { REDUCED_MOTION } from '../../styling/media';
import { isRenderable } from '../../utils/renderable';

export type CheckboxSize = 'sm' | 'md';

export interface CheckboxPartProps {
  className?: string;
  css?: Interpolation<Theme>;
}

export interface CheckboxProps extends Omit<ComponentPropsWithRef<'input'>, 'size' | 'type'> {
  label?: ReactNode;
  description?: ReactNode;
  indeterminate?: boolean;
  size?: CheckboxSize;
  onCheckedChange?: (checked: boolean) => void;
  slotProps?: {
    root?: CheckboxPartProps;
    label?: CheckboxPartProps;
    control?: CheckboxPartProps;
    description?: CheckboxPartProps;
  };
}

const BOX_SIZE: Record<CheckboxSize, string> = { sm: '16px', md: '20px' };

const glyphStateStyle = css({
  'input:checked + span svg': { opacity: 1 },
  '&[data-indeterminate] input + span': { backgroundColor: vars.color.accent, borderColor: vars.color.accent },
  '&[data-indeterminate] input + span svg': { opacity: 1 },
});

const boxStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  boxSizing: 'border-box',
  border: `1px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.sm,
  backgroundColor: vars.color.surfaceRaised,
  color: vars.color.accentContrast,
  transitionProperty: 'background-color, border-color',
  transitionDuration: vars.motion.duration.fast,
  transitionTimingFunction: vars.motion.easeStandard,
  '& svg': {
    inlineSize: '75%',
    blockSize: '75%',
    opacity: 0,
  },
  [REDUCED_MOTION]: {
    transitionDuration: '0s',
  },
});

const boxSizeStyles: Record<CheckboxSize, SerializedStyles> = {
  sm: css({ inlineSize: BOX_SIZE.sm, blockSize: BOX_SIZE.sm }),
  md: css({ inlineSize: BOX_SIZE.md, blockSize: BOX_SIZE.md }),
};

const labelSizeStyles: Record<CheckboxSize, SerializedStyles> = {
  sm: css({ fontSize: vars.textSize.sm }),
  md: css({ fontSize: vars.textSize.md }),
};

const descriptionStyle = css({
  fontSize: vars.textSize.sm,
  color: vars.color.textMuted,
});

const descriptionSizeStyles: Record<CheckboxSize, SerializedStyles> = {
  sm: css({ marginInlineStart: `calc(${BOX_SIZE.sm} + ${vars.space[2]})` }),
  md: css({ marginInlineStart: `calc(${BOX_SIZE.md} + ${vars.space[2]})` }),
};

function CheckGlyph({ indeterminate }: { indeterminate: boolean }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {indeterminate ? <line x1="4" y1="8" x2="12" y2="8" /> : <polyline points="3.5 8.5 6.5 11.5 12.5 4.5" />}
    </svg>
  );
}

export function Checkbox({
  ref,
  label,
  description,
  indeterminate = false,
  size = 'md',
  onChange,
  onCheckedChange,
  slotProps,
  className,
  'aria-labelledby': ariaLabelledByProp,
  'aria-describedby': ariaDescribedByProp,
  ...rest
}: CheckboxProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => inputRef.current as HTMLInputElement, []);

  useEffect(() => {
    if (inputRef.current) inputRef.current.indeterminate = indeterminate;
  }, [indeterminate]);

  const id = useId();
  const labelId = `${id}-label`;
  const descriptionId = `${id}-description`;
  const hasLabel = isRenderable(label);
  const hasDescription = isRenderable(description);
  const ariaLabelledBy = [ariaLabelledByProp, hasLabel && labelId].filter(Boolean).join(' ') || undefined;
  const ariaDescribedBy = [ariaDescribedByProp, hasDescription && descriptionId].filter(Boolean).join(' ') || undefined;
  const rootClassName = [className, slotProps?.root?.className].filter(Boolean).join(' ') || undefined;

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    // Native activation clears the DOM indeterminate flag; the prop is the source of
    // truth, so restore it until the parent clears `indeterminate`.
    if (indeterminate) event.currentTarget.indeterminate = true;
    onChange?.(event);
    onCheckedChange?.(event.currentTarget.checked);
  };

  return (
    <label
      data-ui="checkbox"
      data-indeterminate={indeterminate || undefined}
      className={rootClassName}
      css={[choiceRootStyle, glyphStateStyle, choiceRootStateStyle, slotProps?.root?.css]}
    >
      <span css={choiceRowStyle}>
        <input
          {...rest}
          ref={inputRef}
          type="checkbox"
          aria-labelledby={ariaLabelledBy}
          aria-describedby={ariaDescribedBy}
          aria-checked={indeterminate ? 'mixed' : undefined}
          onChange={handleChange}
          css={choiceInputStyle}
        />
        <span
          aria-hidden="true"
          className={slotProps?.control?.className}
          css={[boxStyle, boxSizeStyles[size], slotProps?.control?.css]}
        >
          <CheckGlyph indeterminate={indeterminate} />
        </span>
        {hasLabel && (
          <span id={labelId} className={slotProps?.label?.className} css={[labelSizeStyles[size], slotProps?.label?.css]}>
            {label}
          </span>
        )}
      </span>
      {hasDescription && (
        <span
          id={descriptionId}
          className={slotProps?.description?.className}
          css={[descriptionStyle, descriptionSizeStyles[size], slotProps?.description?.css]}
        >
          {description}
        </span>
      )}
    </label>
  );
}

Checkbox.displayName = 'Checkbox';
