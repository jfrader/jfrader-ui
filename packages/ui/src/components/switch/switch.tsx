// APG pattern: switch (native checkbox input with role="switch"). Space toggles it,
// the label is part of the click target, and state is exposed through the native
// checked property. The thumb position and track color change together, so state is
// never conveyed by color alone.
import { useId, type ChangeEvent, type ComponentPropsWithRef, type ComponentType, type ReactNode } from 'react';
import { vars } from '@jfrader/tokens/vars';
import { choiceInputStyle, choiceRootStateStyle, choiceRootStyle, choiceRowStyle } from '../../styling/choice-control';
import { css, type Interpolation, type SerializedStyles, type Theme } from '../../styling/css';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import { withoutSx, WithSx, type SxProps } from '../../styling/sx';
import { isRenderable } from '../../utils/renderable';

export type SwitchSize = 'sm' | 'md';

export interface SwitchPartProps extends ComponentPropsWithRef<'span'> {
  className?: string;
  sx?: Interpolation<Theme>;
}

export interface SwitchSlots {
  /** Label wrapping the switch and its text. */
  root?: ComponentType<SwitchPartProps & ComponentPropsWithRef<'label'>>;
  /** Text naming the switch. */
  label?: ComponentType<SwitchPartProps>;
  /** Track displaying the switch state. */
  control?: ComponentType<SwitchPartProps>;
  /** Helper text below the switch. */
  description?: ComponentType<SwitchPartProps>;
}

export interface SwitchProps extends Omit<ComponentPropsWithRef<'input'>, 'size' | 'type'>, SxProps {
  label?: ReactNode;
  description?: ReactNode;
  size?: SwitchSize;
  onCheckedChange?: (checked: boolean) => void;
  slots?: SwitchSlots;
  slotProps?: {
    /** Outer label wrapping the switch track, label, and description. */
    root?: SwitchPartProps & ComponentPropsWithRef<'label'>;
    /** Text label displayed alongside the switch control. */
    label?: SwitchPartProps;
    /** Visual track and sliding thumb representing the toggle switch. */
    control?: SwitchPartProps;
    /** Helper description text displayed below the switch row. */
    description?: SwitchPartProps;
  };
}

const TRACK_WIDTH: Record<SwitchSize, string> = { sm: '36px', md: '44px' };

const trackStyle = css({
  position: 'relative',
  display: 'inline-block',
  flexShrink: 0,
  boxSizing: 'border-box',
  border: `1px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.full,
  backgroundColor: vars.color.surfaceHover,
  transitionProperty: 'background-color, border-color',
  transitionDuration: vars.motion.duration.fast,
  transitionTimingFunction: vars.motion.easeStandard,
  '&::after': {
    content: '""',
    position: 'absolute',
    insetBlockStart: '2px',
    insetInlineStart: '2px',
    borderRadius: vars.radius.full,
    backgroundColor: vars.color.text,
    transitionProperty: 'transform, background-color',
    transitionDuration: vars.motion.duration.fast,
    transitionTimingFunction: vars.motion.easeStandard,
  },
  [REDUCED_MOTION]: {
    transitionDuration: '0s',
    '&::after': { transitionDuration: '0s' },
  },
  [FORCED_COLORS]: {
    '&::after': { backgroundColor: 'CanvasText' },
  },
});

const trackSizeStyles: Record<SwitchSize, SerializedStyles> = {
  sm: css({
    inlineSize: TRACK_WIDTH.sm,
    blockSize: '20px',
    '&::after': { inlineSize: '14px', blockSize: '14px' },
  }),
  md: css({
    inlineSize: TRACK_WIDTH.md,
    blockSize: '24px',
    '&::after': { inlineSize: '18px', blockSize: '18px' },
  }),
};

// `:dir(rtl)` reads the effective direction of the root, so nested [dir] overrides stay correct.
const checkedThumbStyles: Record<SwitchSize, SerializedStyles> = {
  sm: css({
    'input:checked + span::after': {
      transform: 'translateX(16px)',
      backgroundColor: vars.color.accentContrast,
    },
    '&:dir(rtl) input:checked + span::after': { transform: 'translateX(-16px)' },
    [FORCED_COLORS]: {
      'input:checked + span::after': { backgroundColor: 'CanvasText' },
    },
  }),
  md: css({
    'input:checked + span::after': {
      transform: 'translateX(20px)',
      backgroundColor: vars.color.accentContrast,
    },
    '&:dir(rtl) input:checked + span::after': { transform: 'translateX(-20px)' },
    [FORCED_COLORS]: {
      'input:checked + span::after': { backgroundColor: 'CanvasText' },
    },
  }),
};

const labelSizeStyles: Record<SwitchSize, SerializedStyles> = {
  sm: css({ fontSize: vars.textSize.sm }),
  md: css({ fontSize: vars.textSize.md }),
};

const descriptionStyle = css({
  fontSize: vars.textSize.sm,
  color: vars.color.textMuted,
});

const descriptionSizeStyles: Record<SwitchSize, SerializedStyles> = {
  sm: css({ marginInlineStart: `calc(${TRACK_WIDTH.sm} + ${vars.space[2]})` }),
  md: css({ marginInlineStart: `calc(${TRACK_WIDTH.md} + ${vars.space[2]})` }),
};

export function Switch({
  ref,
  label,
  description,
  size = 'md',
  onChange,
  onCheckedChange,
  slotProps,
  slots,
  className,
  sx,
  dir,
  'aria-labelledby': ariaLabelledByProp,
  'aria-describedby': ariaDescribedByProp,
  ...rest
}: SwitchProps) {
  const Root = slots?.root ?? 'label';
  const Label = slots?.label ?? 'span';
  const Control = slots?.control ?? 'span';
  const Description = slots?.description ?? 'span';
  const id = useId();
  const labelId = `${id}-label`;
  const descriptionId = `${id}-description`;
  const hasLabel = isRenderable(label);
  const hasDescription = isRenderable(description);
  const ariaLabelledBy = [ariaLabelledByProp, hasLabel && labelId].filter(Boolean).join(' ') || undefined;
  const ariaDescribedBy = [ariaDescribedByProp, hasDescription && descriptionId].filter(Boolean).join(' ') || undefined;
  const rootClassName = [className, slotProps?.root?.className].filter(Boolean).join(' ') || undefined;

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange?.(event);
    onCheckedChange?.(event.currentTarget.checked);
  };

  return (
    <WithSx
      className={rootClassName}
      styles={[choiceRootStyle, choiceRootStateStyle, checkedThumbStyles[size], slotProps?.root?.sx]}
      sx={sx}
    >
      {(className) => (
        <Root {...withoutSx(slotProps?.root)} css={undefined} data-ui="switch" dir={dir ?? slotProps?.root?.dir} className={className}>
          <span css={choiceRowStyle}>
            <input
              {...rest}
              ref={ref}
              type="checkbox"
              role="switch"
              aria-labelledby={ariaLabelledBy}
              aria-describedby={ariaDescribedBy}
              onChange={handleChange}
              css={choiceInputStyle}
            />
            <Control
              {...withoutSx(slotProps?.control)}
              aria-hidden="true"
              className={slotProps?.control?.className}
              css={[trackStyle, trackSizeStyles[size], slotProps?.control?.sx]}
            />
            {hasLabel && (
              <Label
                {...withoutSx(slotProps?.label)}
                id={labelId}
                className={slotProps?.label?.className}
                css={[labelSizeStyles[size], slotProps?.label?.sx]}
              >
                {label}
              </Label>
            )}
          </span>
          {hasDescription && (
            <Description
              {...withoutSx(slotProps?.description)}
              id={descriptionId}
              className={slotProps?.description?.className}
              css={[descriptionStyle, descriptionSizeStyles[size], slotProps?.description?.sx]}
            >
              {description}
            </Description>
          )}
        </Root>
      )}
    </WithSx>
  );
}

Switch.displayName = 'Switch';
