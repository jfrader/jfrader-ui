'use client';

// Pattern: native input plus an APG toggle button. One input flips between `password` and
// `text`, so value, selection, focus and password-manager wiring survive a reveal. The reveal
// is a native `type="button"` with a stable name and `aria-pressed` (the name never changes
// with the state) and `aria-controls` pointing at the input. Keyboard: native editing; Tab
// moves input → reveal → page; Enter/Space on the reveal toggle once and never submit.
// Password and reveal are independent controlled/uncontrolled axes; a native form reset
// restores the uncontrolled ones without callbacks.
import { useEffect, useRef, type ChangeEvent, type ComponentPropsWithRef, type ReactNode } from 'react';
import { useMergeRefs } from '@floating-ui/react';
import { Eye, EyeOff } from '@jfrader/icons';
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
  type FieldLabelPlacement,
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
  /** Outer container wrapping the password field. */
  root: 'div';
  /** Label element associated with the password input. */
  label: 'label';
  /** Native input control receiving password entry. */
  control: 'input';
  /** Helper text element displayed below the input. */
  description: 'span';
  /** Validation error message displayed when invalid. */
  error: 'span';
  /** Border and background frame enclosing the input and reveal button. */
  shell: 'div';
  /** Button toggling password visibility between masked and plain text. */
  reveal: 'button';
};
export type PasswordFieldSlots = FieldSlots<PasswordFieldAnatomy>;

export interface PasswordFieldProps
  extends Omit<ComponentPropsWithRef<'input'>, 'type' | 'size' | 'value' | 'defaultValue' | 'children'>, SxProps {
  /** Controls the password text. */
  value?: string;
  /** Sets the initial uncontrolled password and native form-reset value. */
  defaultValue?: string;
  /** Reports password edits, but not native form resets. */
  onValueChange?: (value: string) => void;
  /** Controls whether the password is shown as plain text. */
  revealed?: boolean;
  /** Sets the initial uncontrolled visibility and form-reset state. Defaults to `false`. */
  defaultRevealed?: boolean;
  /** Requests a visibility change when the reveal button is activated. */
  onRevealedChange?: (revealed: boolean) => void;
  /** Displays a label associated with the password input. */
  label?: ReactNode;
  /** Label placement. `hidden` keeps the accessible name without taking layout space. */
  labelPlacement?: FieldLabelPlacement;
  /** Displays helper content below the input and links it as an accessible description. */
  description?: ReactNode;
  /** Displays a validation message and marks the input invalid. */
  error?: ReactNode;
  /** Sets the input and reveal button sizing. Defaults to `md`. */
  size?: PasswordFieldSize;
  /** Overrides the reveal button's stable accessible name, which defaults to "Show password". */
  messages?: Partial<PasswordFieldMessages>;
  /** Replaces the eye icon inside the toggle; hidden from assistive technology. */
  revealIcon?: (revealed: boolean) => ReactNode;
  /** Replace the wrapper div; `slots.root` takes precedence. */
  component?: PasswordFieldSlots['root'];
  /** Replace generated parts with components that forward props and ref. */
  slots?: PasswordFieldSlots;
  /** Passes props and `sx` to the field's named parts. */
  slotProps?: PasswordFieldSlotProps;
}

const shellStyle = css({
  position: 'relative',
  minInlineSize: 0,
});

// Reserve the reveal lane and its inset in the control's inline-end padding.
const controlSizeStyles: Record<PasswordFieldSize, SerializedStyles> = {
  sm: css({
    blockSize: vars.space[8],
    paddingInlineStart: vars.space[3],
    paddingInlineEnd: vars.space[10],
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
  sm: css({ inlineSize: vars.space[8], blockSize: vars.space[6], fontSize: vars.textSize.md }),
  md: css({ inlineSize: vars.space[8], blockSize: vars.space[8], fontSize: vars.textSize.lg }),
  lg: css({ inlineSize: vars.space[10], blockSize: vars.space[10], fontSize: vars.textSize.xl }),
};

function EyeIcon({ revealed }: { revealed: boolean }) {
  const Icon = revealed ? EyeOff : Eye;
  return <Icon size="inherit" data-state={revealed ? 'on' : 'off'} decorative />;
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
  labelPlacement = 'above',
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
      <FieldLabel
        component={slots?.label}
        id={labelId}
        htmlFor={field.id}
        required={required}
        hidden={labelPlacement === 'hidden'}
        part={slotProps?.label}
      >
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
