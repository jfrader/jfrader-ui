'use client';

// Field anatomy around a framed control: the label, description and error come from FieldRoot like
// TextField, and the frame wears the shared input skin so the group reads as one text input with
// addons inside its boundary.
import {
  createContext,
  useContext,
  useMemo,
  type ComponentPropsWithRef,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css, type SerializedStyles } from '../../styling/css';
import { inputControlStyle } from '../../styling/input-control';
import type { SxProps } from '../../styling/sx';
import { isRenderable } from '../../utils/renderable';
import {
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldRoot,
  useFieldAnatomy,
  type FieldLabelPlacement,
} from '../field/field-anatomy';
import { FieldSlot, type FieldSlots, type FieldParts } from '../field/field-slot';

export type InputGroupSize = 'sm' | 'md' | 'lg';
type Anatomy = {
  /** Outer container wrapping the label, frame and messages. */
  root: 'div';
  /** Label element associated with the grouped control. */
  label: 'label';
  /** Bordered frame holding the control and its addons. */
  frame: 'div';
  /** Helper text element displayed below the frame. */
  description: 'span';
  /** Validation error message displayed when invalid. */
  error: 'span';
};
export type InputGroupSlots = FieldSlots<Anatomy>;
export type InputGroupSlotProps = FieldParts<Anatomy>;
export interface InputGroupProps extends Omit<ComponentPropsWithRef<'div'>, 'id'>, SxProps {
  /** Name the grouped control with an associated label. */
  label?: ReactNode;
  /** Label placement. `hidden` keeps the accessible name without taking layout space. */
  labelPlacement?: FieldLabelPlacement;
  /** Show supporting text and include it in the control's accessible description. */
  description?: ReactNode;
  /** Show a validation message and mark the control invalid. */
  error?: ReactNode;
  /** Set the control's id; the label and messages are wired to it. Defaults to a generated id. */
  id?: string;
  /** Sets the frame height and text size. Defaults to `"md"`. */
  size?: InputGroupSize;
  /** Marks the frame invalid and defaults the control's `aria-invalid` to `true`. */
  invalid?: boolean;
  /** Disables the input or textarea. Addon actions must be disabled explicitly. */
  disabled?: boolean;
  /** Marks the control required and shows the label's required marker. */
  required?: boolean;
  /** Replaces the wrapper div. Same as `slots.root`. */
  component?: InputGroupSlots['root'];
  /** Replaces the wrapper, label, frame, description, and error. */
  slots?: InputGroupSlots;
  /** Props and `sx` for the wrapper, label, frame, description, and error. */
  slotProps?: InputGroupSlotProps;
}
/** Native input props plus `sx`. The group owns the id; set `id` on InputGroup. */
export type InputGroupInputProps = Omit<ComponentPropsWithRef<'input'>, 'id'> & SxProps;
/** Native textarea props plus `sx`. The group owns the id; set `id` on InputGroup. */
export type InputGroupTextareaProps = Omit<ComponentPropsWithRef<'textarea'>, 'id'> & SxProps;
export interface InputGroupAddonProps extends ComponentPropsWithRef<'div'>, SxProps {
  /** Places the addon before or after the control. */
  placement: 'start' | 'end';
}

interface GroupContext {
  id: string | undefined;
  describedBy: string | undefined;
  ariaInvalid: ComponentPropsWithRef<'input'>['aria-invalid'];
  errored: boolean;
  disabled: boolean;
  required: boolean | undefined;
}
const Context = createContext<GroupContext>({
  id: undefined,
  describedBy: undefined,
  ariaInvalid: undefined,
  errored: false,
  disabled: false,
  required: undefined,
});
const CONTROL = '[data-ui~="input-group-input"], [data-ui~="input-group-textarea"]';
const INTERACTIVE = 'a[href], button, input, select, textarea, [tabindex]';

const frameStyle = css({
  display: 'flex',
  minInlineSize: 0,
  alignItems: 'center',
  gap: vars.space[2],
  cursor: 'text',
  '&[data-disabled]': { cursor: 'not-allowed' },
  '&:has(> [data-ui~="input-group-textarea"])': {
    alignItems: 'flex-end',
    '& > [data-ui~="input-group-addon"]': { paddingBlock: vars.space[2] },
  },
  '&:has(> [aria-invalid="true"]):not(:focus-visible, :has(:focus-visible))': {
    borderColor: vars.color.dangerBorder,
  },
});
const sizes: Record<InputGroupSize, SerializedStyles> = {
  sm: css({ minBlockSize: '32px', paddingInline: vars.space[3], fontSize: vars.textSize.sm }),
  md: css({ minBlockSize: '40px', paddingInline: vars.space[4], fontSize: vars.textSize.sm }),
  lg: css({ minBlockSize: '48px', paddingInline: vars.space[4], fontSize: vars.textSize.md }),
};
const controlStyle = css({
  flex: 1,
  alignSelf: 'stretch',
  minInlineSize: vars.space[8],
  inlineSize: '100%',
  boxSizing: 'border-box',
  margin: 0,
  border: 0,
  borderRadius: 0,
  outline: 'none',
  background: 'transparent',
  color: 'inherit',
  font: 'inherit',
  padding: 0,
  order: 1,
  '&::placeholder': { color: vars.color.textSubtle },
  '&:disabled': { cursor: 'not-allowed' },
});
const textareaStyle = css({
  lineHeight: vars.lineHeight.base,
  paddingBlock: vars.space[2],
  resize: 'vertical',
});
const addonStyle = css({
  display: 'flex',
  alignItems: 'center',
  minInlineSize: 'min-content',
  overflowWrap: 'anywhere',
  color: vars.color.textMuted,
  // The disabled frame's opacity already dims addons; muted text under it falls below 4.5:1.
  '[data-ui~="input-group-frame"][data-disabled] > &': { color: vars.color.text },
  '&[data-placement="start"]': { order: 0 },
  '&[data-placement="end"]': { order: 2 },
});

// A press on the frame or on addon text focuses the control, like a press inside a TextField.
function focusControl(event: MouseEvent<HTMLDivElement>) {
  if (event.defaultPrevented || event.button !== 0) return;
  const target = event.target as Element;
  if (target.closest(INTERACTIVE)) return;
  const control = event.currentTarget.querySelector<HTMLElement>(CONTROL);
  if (!control || control.matches(':disabled')) return;
  event.preventDefault();
  control.focus();
}

function InputGroupRoot({
  label,
  labelPlacement = 'above',
  description,
  error,
  id: idProp,
  size = 'md',
  invalid = false,
  disabled = false,
  required,
  component,
  slots,
  slotProps,
  children,
  sx,
  ...props
}: InputGroupProps) {
  const field = useFieldAnatomy({
    id: idProp,
    description,
    error,
    'aria-invalid': invalid || undefined,
  });
  const errored = isRenderable(error);
  const context = useMemo(
    () => ({
      id: field.id,
      describedBy: field.describedBy,
      ariaInvalid: field.ariaInvalid,
      errored,
      disabled,
      required,
    }),
    [field.id, field.describedBy, field.ariaInvalid, errored, disabled, required],
  );
  return (
    <Context value={context}>
      <FieldRoot
        {...props}
        component={slots?.root ?? component}
        part={slotProps?.root}
        data-ui="input-group"
        sx={sx}
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
          element="div"
          component={slots?.frame}
          slotProps={slotProps?.frame}
          data-ui="input-group-frame"
          data-invalid={invalid || errored || undefined}
          data-disabled={disabled || undefined}
          behavior={{ onMouseDown: focusControl }}
          styles={[inputControlStyle, frameStyle, sizes[size]]}
        >
          {children}
        </FieldSlot>
        <FieldDescription component={slots?.description} id={field.descriptionId} part={slotProps?.description}>
          {description}
        </FieldDescription>
        <FieldError component={slots?.error} id={field.errorId} part={slotProps?.error}>
          {error}
        </FieldError>
      </FieldRoot>
    </Context>
  );
}

function useControlProps({
  disabled,
  required,
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedBy,
}: Pick<InputGroupInputProps, 'disabled' | 'required' | 'aria-invalid' | 'aria-describedby'>) {
  const group = useContext(Context);
  return {
    id: group.id,
    disabled: group.disabled || disabled,
    required: required ?? group.required,
    'aria-invalid': group.errored ? true : (ariaInvalid ?? group.ariaInvalid),
    'aria-describedby': [ariaDescribedBy, group.describedBy].filter(Boolean).join(' ') || undefined,
  };
}

function InputGroupInput({ sx, disabled, required, 'aria-invalid': invalid, 'aria-describedby': describedBy, ...props }: InputGroupInputProps) {
  const control = useControlProps({ disabled, required, 'aria-invalid': invalid, 'aria-describedby': describedBy });
  return (
    <FieldSlot
      element="input"
      {...props}
      {...control}
      data-ui="input-group-input"
      styles={controlStyle}
      sx={sx}
    />
  );
}

function InputGroupTextarea({ sx, disabled, required, 'aria-invalid': invalid, 'aria-describedby': describedBy, ...props }: InputGroupTextareaProps) {
  const control = useControlProps({ disabled, required, 'aria-invalid': invalid, 'aria-describedby': describedBy });
  return (
    <FieldSlot
      element="textarea"
      {...props}
      {...control}
      data-ui="input-group-textarea"
      styles={[controlStyle, textareaStyle]}
      sx={sx}
    />
  );
}

function InputGroupAddon({ placement, sx, ...props }: InputGroupAddonProps) {
  return (
    <FieldSlot
      element="div"
      {...props}
      data-ui="input-group-addon"
      data-placement={placement}
      styles={addonStyle}
      sx={sx}
    />
  );
}

InputGroupRoot.displayName = 'InputGroup';
InputGroupInput.displayName = 'InputGroup.Input';
InputGroupTextarea.displayName = 'InputGroup.Textarea';
InputGroupAddon.displayName = 'InputGroup.Addon';
export const InputGroup = Object.assign(InputGroupRoot, {
  Input: InputGroupInput,
  Textarea: InputGroupTextarea,
  Addon: InputGroupAddon,
});
