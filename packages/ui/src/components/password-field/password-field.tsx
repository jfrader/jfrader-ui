'use client';

// Pattern: native input plus an APG toggle button. One input flips between `password` and
// `text`, so value, selection, focus and password-manager wiring survive a reveal. The reveal
// is a native `type="button"` with a stable name and `aria-pressed` (the name never changes
// with the state) and `aria-controls` pointing at the input. Keyboard: native editing; Tab
// moves input → reveal → page; Enter/Space on the reveal toggle once and never submit.
// Password and reveal are independent controlled/uncontrolled axes; a native form reset
// restores the uncontrolled ones without callbacks.
import { useEffect, useId, useRef, type ChangeEvent, type ComponentPropsWithRef, type ReactNode } from 'react';
import { useMergeRefs } from '@floating-ui/react';
import { vars } from '@jfrader/tokens/vars';
import { css, type SerializedStyles } from '../../styling/css';
import { focusRingInset } from '../../styling/focus-ring';
import { iconWrapperStyle } from '../../styling/icon-wrapper';
import { inputControlStyle } from '../../styling/input-control';
import { COARSE_POINTER, FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import type { SxProps } from '../../styling/sx';
import { isRenderable } from '../../utils/renderable';
import { useControlledState } from '../../utils/use-controlled-state';
import {
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldRoot,
  useFieldAnatomy,
  type FieldPartProps,
} from '../field/field-anatomy';
import { FieldSlot, type FieldSlots, type FieldParts } from '../field/field-slot';

export type PasswordFieldSize = 'sm' | 'md' | 'lg';

export interface PasswordFieldMessages {
  /** Accessible name of the reveal toggle; `aria-pressed` conveys whether it is on. */
  reveal: string;
}

const DEFAULT_MESSAGES: PasswordFieldMessages = { reveal: 'Show password' };

export interface PasswordFieldPartProps extends FieldPartProps {}

export type PasswordFieldSlotProps = FieldParts<PasswordFieldAnatomy>;

type PasswordFieldAnatomy = {
  root: 'div';
  label: 'label';
  control: 'input';
  description: 'span';
  error: 'span';
  shell: 'div';
  reveal: 'button';
};
export type PasswordFieldSlots = FieldSlots<PasswordFieldAnatomy>;

export interface PasswordFieldProps
  extends Omit<ComponentPropsWithRef<'input'>, 'type' | 'size' | 'value' | 'defaultValue' | 'children'>, SxProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  revealed?: boolean;
  defaultRevealed?: boolean;
  onRevealedChange?: (revealed: boolean) => void;
  label?: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  size?: PasswordFieldSize;
  messages?: Partial<PasswordFieldMessages>;
  /** Replaces the eye icon inside the toggle; hidden from assistive technology. */
  revealIcon?: (revealed: boolean) => ReactNode;
  /** Replace the wrapper div; `slots.root` takes precedence. */
  component?: PasswordFieldSlots['root'];
  /** Replace generated parts with components that forward props and ref. */
  slots?: PasswordFieldSlots;
  slotProps?: PasswordFieldSlotProps;
}

const shellStyle = css({
  position: 'relative',
  minInlineSize: 0,
});

// The control's inline-end padding equals its height: the square reveal lane plus its inset.
const controlSizeStyles: Record<PasswordFieldSize, SerializedStyles> = {
  sm: css({
    blockSize: vars.space[8],
    paddingInlineStart: vars.space[3],
    paddingInlineEnd: vars.space[8],
    fontSize: vars.textSize.sm,
  }),
  md: css({
    blockSize: vars.space[10],
    paddingInlineStart: vars.space[4],
    paddingInlineEnd: vars.space[10],
    fontSize: vars.textSize.sm,
  }),
  lg: css({
    blockSize: vars.space[12],
    paddingInlineStart: vars.space[4],
    paddingInlineEnd: vars.space[12],
    fontSize: vars.textSize.md,
  }),
};

const controlStyle = css({
  lineHeight: vars.lineHeight.base,
  [COARSE_POINTER]: { fontSize: vars.textSize.md },
});

const revealStyle = css({
  position: 'absolute',
  insetBlock: 0,
  insetInlineEnd: vars.space[1],
  marginBlock: 'auto',
  display: 'inline-grid',
  placeItems: 'center',
  padding: 0,
  border: 0,
  borderRadius: vars.radius.sm,
  backgroundColor: 'transparent',
  color: vars.color.textMuted,
  cursor: 'pointer',
  transitionProperty: 'background-color, color, transform',
  transitionDuration: vars.motion.duration.fast,
  transitionTimingFunction: vars.motion.easeStandard,
  '&:hover:not(:disabled)': {
    backgroundColor: vars.color.surfaceHover,
    color: vars.color.text,
  },
  '&:active:not(:disabled)': { transform: 'scale(0.94)' },
  '&:focus-visible': focusRingInset,
  '&:disabled': {
    opacity: 0.55,
    cursor: 'not-allowed',
  },
  [REDUCED_MOTION]: {
    transitionDuration: '0s',
    '&:active:not(:disabled)': { transform: 'none' },
  },
  [FORCED_COLORS]: {
    '&[aria-pressed="true"]': {
      backgroundColor: 'Highlight',
      color: 'HighlightText',
    },
  },
});

const revealSizeStyles: Record<PasswordFieldSize, SerializedStyles> = {
  sm: css({ inlineSize: vars.space[6], blockSize: vars.space[6], fontSize: vars.textSize.md }),
  md: css({ inlineSize: vars.space[8], blockSize: vars.space[8], fontSize: vars.textSize.lg }),
  lg: css({ inlineSize: vars.space[10], blockSize: vars.space[10], fontSize: vars.textSize.xl }),
};

// `pathLength="1"` normalizes the slash, so a 1-unit dash draws it from its start as the offset
// falls from 1 to 0. The mask copy cuts the eye outline under the slash.
const eyeStyle = css({
  '& [data-slash]': {
    strokeDasharray: '1 2',
    strokeDashoffset: 1,
    transitionProperty: 'stroke-dashoffset',
    transitionDuration: vars.motion.duration.base,
    transitionTimingFunction: vars.motion.easeStandard,
  },
  '&[data-state="on"] [data-slash]': { strokeDashoffset: 0 },
  [REDUCED_MOTION]: {
    '& [data-slash]': { transitionDuration: '0s' },
  },
});

const SLASH_PATH = 'M3 3l18 18';

function EyeIcon({ revealed }: { revealed: boolean }) {
  const maskId = `password-field-mask-${useId().replace(/[^\w-]/g, '_')}`;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      data-state={revealed ? 'on' : 'off'}
      css={eyeStyle}
    >
      <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
        <rect width="24" height="24" fill="white" stroke="none" />
        <path d={SLASH_PATH} pathLength={1} stroke="black" strokeWidth={5} data-slash="" />
      </mask>
      <g mask={`url(#${maskId})`}>
        <path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0" />
        <circle cx="12" cy="12" r="3" />
      </g>
      <path d={SLASH_PATH} pathLength={1} data-slash="" />
    </svg>
  );
}

export function PasswordField({
  ref,
  value,
  defaultValue,
  onChange,
  onValueChange,
  revealed: revealedProp,
  defaultRevealed = false,
  onRevealedChange,
  label,
  description,
  error,
  size = 'md',
  messages: messagesProp,
  revealIcon,
  component,
  slots,
  slotProps,
  className,
  sx,
  dir,
  disabled,
  required,
  form,
  id: idProp,
  'aria-labelledby': ariaLabelledByProp,
  'aria-describedby': ariaDescribedByProp,
  'aria-invalid': ariaInvalidProp,
  ...rest
}: PasswordFieldProps) {
  const field = useFieldAnatomy({
    id: idProp,
    description,
    error,
    'aria-describedby': ariaDescribedByProp,
    'aria-invalid': ariaInvalidProp,
  });
  const [revealedState, requestRevealed, resetRevealed] = useControlledState(
    revealedProp,
    defaultRevealed,
    onRevealedChange,
  );
  const revealed = revealedState ?? false;
  const inputRef = useRef<HTMLInputElement>(null);
  const mergedRef = useMergeRefs([inputRef, ref]);
  const messages = { ...DEFAULT_MESSAGES, ...messagesProp };
  const labelId = `${field.id}-label`;
  // A consumer aria-labelledby replaces the label's htmlFor name, so the visible label joins it.
  const ariaLabelledBy =
    ariaLabelledByProp === undefined
      ? undefined
      : [ariaLabelledByProp, isRenderable(label) && labelId].filter(Boolean).join(' ');

  // The value axis resets natively; the reveal axis follows once the reset is not cancelled.
  useEffect(() => {
    const owner = inputRef.current?.form;
    if (!owner) return;
    const handleReset = (event: Event) => {
      queueMicrotask(() => {
        if (!event.defaultPrevented) resetRevealed();
      });
    };
    owner.addEventListener('reset', handleReset);
    return () => owner.removeEventListener('reset', handleReset);
  }, [form, resetRevealed]);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange?.(event);
    onValueChange?.(event.currentTarget.value);
  };

  return (
    <FieldRoot
      style={rest.style}
      title={rest.title}
      component={slots?.root ?? component}
      data-ui="password-field"
      dir={dir}
      className={className}
      sx={sx}
      part={slotProps?.root}
    >
      <FieldLabel component={slots?.label} id={labelId} htmlFor={field.id} required={required} part={slotProps?.label}>
        {label}
      </FieldLabel>
      <FieldSlot element="div" component={slots?.shell} slotProps={slotProps?.shell} styles={[shellStyle]}>
        <FieldSlot
          element="input"
          component={slots?.control}
          slotProps={slotProps?.control}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          {...rest}
          ref={mergedRef}
          id={field.id}
          type={revealed ? 'text' : 'password'}
          value={value}
          defaultValue={defaultValue}
          dir={dir}
          disabled={disabled}
          required={required}
          form={form}
          aria-labelledby={ariaLabelledBy}
          aria-describedby={field.describedBy}
          aria-invalid={field.ariaInvalid}
          onChange={handleChange}
          styles={[inputControlStyle, controlStyle, controlSizeStyles[size]]}
        />
        <FieldSlot
          element="button"
          component={slots?.reveal}
          slotProps={slotProps?.reveal}
          type="button"
          disabled={disabled}
          aria-label={messages.reveal}
          aria-pressed={revealed}
          aria-controls={field.id}
          onClick={() => requestRevealed(!revealed)}
          styles={[revealStyle, revealSizeStyles[size]]}
        >
          <span aria-hidden css={iconWrapperStyle}>
            {revealIcon ? revealIcon(revealed) : <EyeIcon revealed={revealed} />}
          </span>
        </FieldSlot>
      </FieldSlot>
      <FieldDescription component={slots?.description} id={field.descriptionId} part={slotProps?.description}>
        {description}
      </FieldDescription>
      <FieldError component={slots?.error} id={field.errorId} part={slotProps?.error}>
        {error}
      </FieldError>
    </FieldRoot>
  );
}

PasswordField.displayName = 'PasswordField';
