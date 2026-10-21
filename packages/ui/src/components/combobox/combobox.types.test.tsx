import { createRef, type ComponentPropsWithRef } from 'react';
import { Combobox } from './index';
import { getInputReferenceProps } from '../../overlay/input-reference-props';

function contract() {
  const inputRef = createRef<HTMLInputElement>();
  const buttonRef = createRef<HTMLButtonElement>();
  const nativeProps: Omit<ComponentPropsWithRef<'input'>, 'size'> = {
    ref: inputRef,
    autoComplete: 'email',
    inputMode: 'email',
    onChange: (event) => event.currentTarget.select(),
    onFocus: (event) => event.currentTarget.setSelectionRange(0, 1),
  };
  <Combobox.Input {...nativeProps} />;
  <Combobox.Input
    ref={(input) => {
      input?.select();
      // @ts-expect-error The ref is an input, not a button.
      const button: HTMLButtonElement | null = input;
      void button;
    }}
    onKeyDown={(event) => {
      event.currentTarget.setSelectionRange(0, 1);
      // @ts-expect-error Native input handlers must not widen to button events or any.
      const button: HTMLButtonElement = event.currentTarget;
      void button;
    }}
  />;
  // @ts-expect-error Button refs are not input refs.
  <Combobox.Input ref={buttonRef} />;

  const merged = getInputReferenceProps((props) => ({ ...props }), nativeProps);
  const retained: ComponentPropsWithRef<'input'> = merged;
  const onChange: ComponentPropsWithRef<'input'>['onChange'] = merged.onChange;
  // @ts-expect-error The composition helper must retain the input ref type.
  const wrongRef: ComponentPropsWithRef<'button'>['ref'] = merged.ref;
  void retained;
  void onChange;
  void wrongRef;
}
void contract;
