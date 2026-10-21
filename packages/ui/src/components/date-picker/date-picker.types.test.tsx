import { createRef, type ComponentProps } from 'react';
import { DatePicker } from './index';

function contract() {
  const inputRef = createRef<HTMLInputElement>();
  const buttonRef = createRef<HTMLButtonElement>();
  const inputProps: ComponentProps<typeof DatePicker.Input> = {
    ref: inputRef,
    autoComplete: 'off',
    inputMode: 'none',
    onFocus: (event) => event.currentTarget.select(),
    onKeyUp: (event) => event.currentTarget.setSelectionRange(0, 1),
  };
  <DatePicker.Input {...inputProps} />;
  <DatePicker label="Date" slotProps={{ input: inputProps }} />;
  <DatePicker.Input
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
  <DatePicker.Input ref={buttonRef} />;
  // @ts-expect-error Generated date inputs also retain input refs.
  <DatePicker label="Date" slotProps={{ input: { ref: buttonRef } }} />;
}
void contract;
