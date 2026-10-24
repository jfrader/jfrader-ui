// Edits a bound text field the way native typing does: `beforeinput` (cancelable) first, then the
// value change through the prototype setter so React's value tracker sees it, then `input`.
export type TextTarget = HTMLInputElement | HTMLTextAreaElement;

export type TextEdit =
  | { inputType: 'insertText'; data: string }
  | { inputType: 'insertLineBreak' }
  | { inputType: 'deleteContentBackward' };

const LINE_BREAK = '\n';
const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

function previousGraphemeStart(value: string, caret: number) {
  let start = 0;
  for (const segment of graphemes.segment(value.slice(0, caret))) start = segment.index;
  return start;
}

function setNativeValue(target: TextTarget, value: string) {
  Object.getOwnPropertyDescriptor(Object.getPrototypeOf(target), 'value')?.set?.call(target, value);
}

/** Applies one edit at the target's selection. Returns `false` when nothing changed. */
export function applyTextEdit(target: TextTarget, edit: TextEdit): boolean {
  if (target.disabled || target.readOnly) return false;
  const value = target.value;
  // Inputs without the selection API (`email`, `number`) report null: edit at the end.
  const end = target.selectionEnd ?? value.length;
  let start = target.selectionStart ?? value.length;
  let data = '';
  if (edit.inputType === 'deleteContentBackward') {
    if (start === end) {
      if (start === 0) return false;
      start = previousGraphemeStart(value, start);
    }
  } else {
    data = edit.inputType === 'insertText' ? edit.data : LINE_BREAK;
    if (target.maxLength >= 0) data = data.slice(0, Math.max(0, target.maxLength - (value.length - (end - start))));
    if (data === '') return false;
  }
  const view = target.ownerDocument.defaultView;
  if (!view) return false;
  const init = { bubbles: true, inputType: edit.inputType, data: edit.inputType === 'insertText' ? data : null };
  if (!target.dispatchEvent(new view.InputEvent('beforeinput', { ...init, cancelable: true }))) return false;
  setNativeValue(target, value.slice(0, start) + data + value.slice(end));
  const caret = start + data.length;
  if (target.selectionStart !== null) target.setSelectionRange(caret, caret);
  target.dispatchEvent(new view.InputEvent('input', init));
  return true;
}
