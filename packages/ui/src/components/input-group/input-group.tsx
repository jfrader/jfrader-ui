'use client';

import { createContext, useContext, type ComponentPropsWithRef } from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { inputControlStyle } from '../../styling/input-control';
import type { SxProps } from '../../styling/sx';
import { FieldSlot, type FieldSlots, type FieldParts } from '../field/field-slot';

export type InputGroupSize = 'sm' | 'md' | 'lg';
type Anatomy = { root: 'div' };
export type InputGroupSlots = FieldSlots<Anatomy>;
export type InputGroupSlotProps = FieldParts<Anatomy>;
export interface InputGroupProps extends ComponentPropsWithRef<'div'>, SxProps {
  /** Sets the frame height and text size. Defaults to `"md"`. */
  size?: InputGroupSize;
  /** Marks the frame invalid and defaults the control's `aria-invalid` to `true`. */
  invalid?: boolean;
  /** Disables the input or textarea. Addon actions must be disabled explicitly. */
  disabled?: boolean;
  /** Replaces the frame. Same as `slots.root`. */
  component?: InputGroupSlots['root'];
  /** Replaces frame parts. */
  slots?: InputGroupSlots;
  /** Props for frame parts. */
  slotProps?: InputGroupSlotProps;
}
/** Native input props plus `sx`. */
export type InputGroupInputProps = ComponentPropsWithRef<'input'> & SxProps;
/** Native textarea props plus `sx`. */
export type InputGroupTextareaProps = ComponentPropsWithRef<'textarea'> & SxProps;
export interface InputGroupAddonProps extends ComponentPropsWithRef<'div'>, SxProps {
  /** Places the addon before or after the control. */
  placement: 'start' | 'end';
}

const Context = createContext({ disabled: false, invalid: false });
const frameStyle = css({
  display: 'flex',
  minInlineSize: 0,
  alignItems: 'center',
  gap: vars.space[2],
  '&:has([data-ui~="input-group-textarea"])': { alignItems: 'flex-end' },
});
const sizes = {
  sm: css({ minBlockSize: '32px', paddingInline: vars.space[3], fontSize: vars.textSize.sm }),
  md: css({ minBlockSize: '40px', paddingInline: vars.space[4], fontSize: vars.textSize.sm }),
  lg: css({ minBlockSize: '48px', paddingInline: vars.space[4], fontSize: vars.textSize.md }),
};
const controlStyle = css({
  flex: 1,
  minInlineSize: vars.space[8],
  inlineSize: '100%',
  boxSizing: 'border-box',
  border: 0,
  borderRadius: 0,
  outline: 'none',
  background: 'transparent',
  color: 'inherit',
  font: 'inherit',
  lineHeight: vars.lineHeight.base,
  paddingBlock: vars.space[2],
  paddingInline: 0,
  order: 1,
  '&::placeholder': { color: vars.color.textSubtle },
  '&:disabled': { cursor: 'not-allowed' },
});
const textareaStyle = css({ resize: 'vertical' });
const addonStyle = css({
  display: 'flex',
  alignItems: 'center',
  minInlineSize: 'min-content',
  overflowWrap: 'anywhere',
  paddingBlock: vars.space[1],
  '&[data-placement="start"]': { order: 0 },
  '&[data-placement="end"]': { order: 2 },
});

function InputGroupRoot({
  size = 'md', invalid = false, disabled = false,
  component, slots, slotProps, children, sx, ...props
}: InputGroupProps) {
  return (
    <Context value={{ disabled, invalid }}>
      <FieldSlot
        element="div"
        root
        component={slots?.root ?? component}
        slotProps={slotProps?.root}
        {...props}
        data-ui="input-group"
        data-invalid={invalid || undefined}
        data-disabled={disabled || undefined}
        styles={[inputControlStyle, frameStyle, sizes[size]]}
        sx={sx}
      >
        {children}
      </FieldSlot>
    </Context>
  );
}

function InputGroupInput({ sx, disabled, 'aria-invalid': invalid, ...props }: InputGroupInputProps) {
  const group = useContext(Context);
  return (
    <FieldSlot
      element="input"
      {...props}
      disabled={group.disabled || disabled}
      aria-invalid={invalid ?? (group.invalid || undefined)}
      data-ui="input-group-input"
      styles={controlStyle}
      sx={sx}
    />
  );
}

function InputGroupTextarea({ sx, disabled, 'aria-invalid': invalid, ...props }: InputGroupTextareaProps) {
  const group = useContext(Context);
  return (
    <FieldSlot
      element="textarea"
      {...props}
      disabled={group.disabled || disabled}
      aria-invalid={invalid ?? (group.invalid || undefined)}
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
