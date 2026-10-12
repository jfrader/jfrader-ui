import { useEffect, useRef, type ComponentPropsWithRef, type ReactNode } from 'react';
import { useMergeRefs } from '@floating-ui/react';
import { vars } from '@jfrader/tokens/vars';
import { css, type SerializedStyles } from '../../styling/css';
import { focusRingInset } from '../../styling/focus-ring';
import { inputControlStyle } from '../../styling/input-control';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import { WithSx, type SxProps } from '../../styling/sx';
import { useControlledState } from '../../utils/use-controlled-state';
import {
  FieldDescription,
  FieldError,
  FieldLabel,
  useFieldAnatomy,
  type FieldPartProps,
  type FieldSlotProps,
} from '../field/field-anatomy';

export type SearchFieldSize = 'sm' | 'md' | 'lg';
export interface SearchFieldMessages {
  clear: string;
}
export interface SearchFieldSlotProps extends FieldSlotProps {
  shell?: FieldPartProps;
  icon?: FieldPartProps;
  clearSlot?: FieldPartProps;
  clear?: FieldPartProps;
}
export interface SearchFieldProps
  extends Omit<ComponentPropsWithRef<'input'>, 'type' | 'size' | 'value' | 'defaultValue' | 'children'>, SxProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  label?: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  size?: SearchFieldSize;
  clearable?: boolean;
  messages?: Partial<SearchFieldMessages>;
  searchIcon?: ReactNode;
  clearIcon?: ReactNode;
  slotProps?: SearchFieldSlotProps;
}

const rootStyle = css({ display: 'grid', gap: vars.space[1], inlineSize: '100%', minInlineSize: 0 });
const shellStyle = css({
  display: 'flex', alignItems: 'center', minInlineSize: 0,
  paddingInline: vars.space[2], borderRadius: vars.radius.sm,
  '&[data-disabled]': { opacity: 0.55, cursor: 'not-allowed' },
  '&[aria-invalid="true"]:not(:focus-within)': { borderColor: vars.color.dangerText },
  [FORCED_COLORS]: { borderColor: 'CanvasText' },
});
const sizeStyles: Record<SearchFieldSize, SerializedStyles> = {
  sm: css({ blockSize: vars.space[8], fontSize: vars.textSize.sm, '--search-action-size': vars.space[6], '--search-control-size': vars.space[8] }),
  md: css({ blockSize: vars.space[10], fontSize: vars.textSize.sm, '--search-action-size': vars.space[8], '--search-control-size': vars.space[10] }),
  lg: css({ blockSize: vars.space[12], fontSize: vars.textSize.md, '--search-action-size': vars.space[8], '--search-control-size': vars.space[12] }),
};
const iconStyle = css({
  display: 'inline-flex', flexShrink: 0, inlineSize: vars.space[4], blockSize: vars.space[4],
  color: vars.color.textMuted, '& > svg': { inlineSize: '100%', blockSize: '100%' },
});
const controlStyle = css({
  flex: '1 1 0%', minInlineSize: 0, blockSize: 'var(--search-control-size)', margin: 0, paddingInline: vars.space[2],
  border: 0, outline: 'none', backgroundColor: 'transparent', color: vars.color.text,
  fontFamily: vars.font.sans, fontSize: 'inherit', lineHeight: vars.lineHeight.base,
  '&::placeholder': { color: vars.color.textSubtle },
  '&:disabled': { cursor: 'not-allowed' },
  '&::-webkit-search-cancel-button, &::-webkit-search-decoration': { appearance: 'none', display: 'none' },
  '@media (pointer: coarse)': { fontSize: vars.textSize.md },
});
const clearSlotStyle = css({
  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  inlineSize: 'var(--search-action-size)', blockSize: 'var(--search-action-size)',
});
const clearStyle = css({
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  inlineSize: '100%', blockSize: '100%', padding: 0, border: '1px solid transparent',
  borderRadius: vars.radius.sm, color: vars.color.textMuted, backgroundColor: 'transparent', cursor: 'pointer',
  transitionProperty: 'background-color, color, opacity, transform',
  transitionDuration: vars.motion.duration.fast, transitionTimingFunction: vars.motion.easeStandard,
  '&:hover:not(:disabled)': { backgroundColor: vars.color.surfaceHover, color: vars.color.text },
  '&:focus-visible': focusRingInset,
  '&:disabled': { cursor: 'not-allowed' },
  '&[data-enter]': { '@starting-style': { opacity: 0, transform: 'scale(0.9)' } },
  [REDUCED_MOTION]: {
    transitionDuration: '0s',
    transform: 'none',
    '&[data-enter]': { '@starting-style': { opacity: 1, transform: 'none' } },
  },
  [FORCED_COLORS]: { borderColor: 'ButtonText', color: 'ButtonText' },
});
const defaultMessages: SearchFieldMessages = { clear: 'Clear search' };
const searchGlyph = <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></svg>;
const clearGlyph = <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 6 12 12M18 6 6 18" /></svg>;

export function SearchField({
  ref,
  value,
  defaultValue = '',
  onValueChange,
  label,
  description,
  error,
  size = 'md',
  clearable = true,
  messages,
  searchIcon = searchGlyph,
  clearIcon = clearGlyph,
  slotProps,
  className,
  sx,
  dir,
  required,
  disabled,
  readOnly,
  onChange,
  onKeyDown,
  id,
  'aria-describedby': describedBy,
  'aria-invalid': invalid,
  ...rest
}: SearchFieldProps) {
  const field = useFieldAnatomy({ id, description, error, 'aria-describedby': describedBy, 'aria-invalid': invalid });
  const inputRef = useRef<HTMLInputElement>(null);
  const mergedRef = useMergeRefs([inputRef, ref]);
  const initialValue = useRef(defaultValue);
  const resetting = useRef(false);
  const [query = '', requestChange] = useControlledState(value, initialValue.current, (next) => {
    if (!resetting.current) onValueChange?.(next);
  });
  const stateRef = useRef({ value, query });
  stateRef.current = { value, query };
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
  }, []);

  useEffect(() => {
    const input = inputRef.current;
    const form = input?.form;
    if (!form || !input) return;
    let active = true;
    const reset = (event: Event) => {
      queueMicrotask(() => {
        if (!active || event.defaultPrevented) return;
        const next = stateRef.current.value === undefined ? initialValue.current : stateRef.current.query;
        input.value = next;
        resetting.current = true;
        try {
          requestChange(next);
        } finally {
          resetting.current = false;
        }
      });
    };
    form.addEventListener('reset', reset);
    return () => {
      active = false;
      form.removeEventListener('reset', reset);
    };
  }, [requestChange, rest.form]);

  const clear = () => {
    requestChange('');
    inputRef.current?.focus();
  };
  const rootClassName = [className, slotProps?.root?.className].filter(Boolean).join(' ') || undefined;

  return (
    <WithSx className={rootClassName} styles={[rootStyle, slotProps?.root?.css]} sx={sx}>
      {(rootClass) => (
        <div data-ui="search-field" dir={dir} className={rootClass}>
          <FieldLabel htmlFor={field.id} required={required} part={slotProps?.label}>
            {label}
          </FieldLabel>
          <div
            aria-invalid={field.ariaInvalid}
            data-disabled={disabled ? '' : undefined}
            className={slotProps?.shell?.className}
            css={[inputControlStyle, shellStyle, sizeStyles[size], slotProps?.shell?.css]}
          >
            <span aria-hidden className={slotProps?.icon?.className} css={[iconStyle, slotProps?.icon?.css]}>
              {searchIcon}
            </span>
            <input
              {...rest}
              ref={mergedRef}
              type="search"
              id={field.id}
              dir={dir}
              value={query}
              required={required}
              disabled={disabled}
              readOnly={readOnly}
              aria-describedby={field.describedBy}
              aria-invalid={field.ariaInvalid}
              className={slotProps?.control?.className}
              css={[controlStyle, slotProps?.control?.css]}
              onChange={(event) => {
                onChange?.(event);
                if (!disabled && !readOnly) requestChange(event.currentTarget.value);
              }}
              onKeyDown={(event) => {
                onKeyDown?.(event);
                if (
                  event.defaultPrevented || event.key !== 'Escape' || event.nativeEvent.isComposing ||
                  event.nativeEvent.keyCode === 229 || query === '' || !clearable || disabled || readOnly
                ) return;
                event.preventDefault();
                clear();
              }}
            />
            <span className={slotProps?.clearSlot?.className} css={[clearSlotStyle, slotProps?.clearSlot?.css]}>
              {clearable && !readOnly && query !== '' && (
                <button
                  type="button"
                  disabled={disabled}
                  data-enter={mounted.current ? '' : undefined}
                  aria-label={messages?.clear || defaultMessages.clear}
                  aria-controls={field.id}
                  onClick={clear}
                  className={slotProps?.clear?.className}
                  css={[clearStyle, slotProps?.clear?.css]}
                >
                  <span aria-hidden css={iconStyle}>{clearIcon}</span>
                </button>
              )}
            </span>
          </div>
          <FieldDescription id={field.descriptionId} part={slotProps?.description}>
            {description}
          </FieldDescription>
          <FieldError id={field.errorId} part={slotProps?.error}>
            {error}
          </FieldError>
        </div>
      )}
    </WithSx>
  );
}
SearchField.displayName = 'SearchField';
