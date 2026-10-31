import { withoutSx } from '../../styling/sx';
'use client';

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ComponentPropsWithRef, type ReactNode } from 'react';
import { FloatingFocusManager, useDismiss, useInteractions, useListNavigation, useMergeRefs } from '@floating-ui/react';
import { getCountries, getCountryCallingCode } from 'libphonenumber-js/max';
import { vars } from '@jfrader/tokens/vars';
import { controlFixedSizeStyles, controlTouchTargetStyles } from '../../styling/control-size';
import { css, type SerializedStyles } from '../../styling/css';
import { focusRingOutset } from '../../styling/focus-ring';
import { disclosureCaret } from '../../styling/disclosure-caret';
import { inputControlStyle } from '../../styling/input-control';
import { listboxSurfaceStyle, listboxItemStyle, listboxItemStateStyle, listboxOptionStyle } from '../../styling/listbox-style';
import { REDUCED_MOTION, FORCED_COLORS } from '../../styling/media';
import { visuallyHiddenStyle } from '../../styling/visually-hidden';
import type { SxProps } from '../../styling/sx';
import { OverlayPortal } from '../../overlay/overlay-portal';
import { useOverlayFloating } from '../../overlay/use-overlay-floating';
import { useControlledState } from '../../utils/use-controlled-state';
import { isRenderable } from '../../utils/renderable';
import { FieldRoot, FieldLabel, FieldDescription, FieldError, useFieldAnatomy } from '../field/field-anatomy';
import type { FieldParts } from '../field/field-slot';
import { countDigits, describePhone, editPhone, mapPhoneCaret, nationalPhoneDigits, type PhoneCountryCode, type PhoneInputDetails } from './phone-number';

export type { PhoneCountryCode, PhoneInputDetails } from './phone-number';
export interface PhoneInputMessages {
  countryButton: (name: string, callingCode: string) => string;
  searchLabel: string;
  searchPlaceholder: string;
  countriesLabel: string;
  suggestedLabel: string;
  allCountriesLabel: string;
  clearSearchLabel: string;
  closeLabel: string;
  empty: string;
  results: (count: number) => string;
  countryChanged: (name: string) => string;
  valid: (name: string) => string;
  invalid: (name: string | null) => string;
}
type PhoneInputAnatomy = {
  root: 'div'; label: 'label'; control: 'div'; countryTrigger: 'button'; number: 'input';
  search: 'input'; panel: 'div'; list: 'div'; option: 'div'; description: 'span'; error: 'span'; status: 'span';
};

export type PhoneInputSlotProps = FieldParts<PhoneInputAnatomy>;

type FocusTarget = 'search' | 'number' | 'trigger' | null;
export interface PhoneInputProps extends Omit<ComponentPropsWithRef<'input'>, 'size' | 'type' | 'value' | 'defaultValue'>, SxProps {
  /** Store a `+`-prefixed candidate, including incomplete numbers. */
  value?: string;
  /** Sets the initial international number candidate. Defaults to empty. */
  defaultValue?: string;
  /** Receives the international candidate, including incomplete numbers, with parsing and validation details. */
  onValueChange?: (value: string, details: PhoneInputDetails) => void;
  /** Controls the country used for national-number entry. `null` leaves it unselected. */
  country?: PhoneCountryCode | null;
  /** Sets the initial country for national-number entry. Defaults to `null`. */
  defaultCountry?: PhoneCountryCode | null;
  /** Receives the selected or inferred country, or `null` when unknown. */
  onCountryChange?: (country: PhoneCountryCode | null) => void;
  /** Controls whether the country picker is open. */
  open?: boolean;
  /** Opens the uncontrolled country picker initially. Defaults to `false`. */
  defaultOpen?: boolean;
  /** Receives changes to the country picker's open state. */
  onOpenChange?: (open: boolean) => void;
  /** Limits picker choices to these countries. Defaults to all supported countries. */
  countries?: readonly PhoneCountryCode[];
  /** Lists matching countries first in a suggested group. Defaults to none. */
  preferredCountries?: readonly PhoneCountryCode[];
  /** Names the phone-number field with a linked label. */
  label?: ReactNode;
  /** Adds supporting text associated with the number field. */
  description?: ReactNode;
  /** Displays an error instead of the generated validation message. */
  error?: ReactNode;
  /** Visually hides the label while retaining its accessible name. Defaults to `false`. */
  hideLabel?: boolean;
  /** Shows validation errors for nonempty invalid numbers after blur. Defaults to `true`. */
  validateOnBlur?: boolean;
  /** Sets the control height and text size. Defaults to `md`. */
  size?: 'sm' | 'md' | 'lg';
  /** Selects country names, sorting, search and count locale. Defaults to the runtime locale. */
  locale?: Intl.LocalesArgument;
  /** Overrides picker labels and validation announcements. Defaults to English. */
  messages?: Partial<PhoneInputMessages>;
  /** Renders a decorative icon beside the selected country in the trigger. */
  renderCountryIcon?: (country: PhoneCountryCode) => ReactNode;
  /** Style internal parts without replacing their semantics or behavior. */
  slotProps?: PhoneInputSlotProps;
}

const ALL_COUNTRIES = getCountries();
const PAGE_STEP = 8;
const defaults: Omit<PhoneInputMessages, 'results'> = {
  countryButton: (name, code) => code ? `${name} ${code}` : name,
  searchLabel: 'Search countries', searchPlaceholder: 'Country or calling code', countriesLabel: 'Countries',
  suggestedLabel: 'Suggested countries', allCountriesLabel: 'All countries', clearSearchLabel: 'Clear search', closeLabel: 'Close countries', empty: 'No countries found',
  countryChanged: (name) => `Country: ${name}`, valid: (name) => `Valid phone number for ${name}`, invalid: (name) => name ? `Enter a valid phone number for ${name}` : 'Enter a valid international phone number',
};
const shellStyle = css({ display: 'flex', alignItems: 'center', minInlineSize: 0, borderRadius: vars.radius.sm, overflow: 'visible' });
const sizes: Record<NonNullable<PhoneInputProps['size']>, SerializedStyles> = {
  sm: css(controlFixedSizeStyles.sm, controlTouchTargetStyles.sm),
  md: css(controlFixedSizeStyles.md, controlTouchTargetStyles.md),
  lg: css(controlFixedSizeStyles.lg, controlTouchTargetStyles.lg),
};
const buttonStyle = css({
  font: 'inherit', color: vars.color.text, background: 'transparent', border: 0, borderRadius: vars.radius.sm,
  paddingInline: vars.space[3], paddingBlock: vars.space[1], minBlockSize: vars.space[8], cursor: 'pointer',
  '&:focus-visible': focusRingOutset, '&:disabled': { cursor: 'not-allowed' },
  '&:hover:not(:disabled)': { backgroundColor: vars.color.surfaceHover },
  [FORCED_COLORS]: { border: '1px solid ButtonText' },
});
const triggerStyle = css({ alignSelf: 'stretch', maxInlineSize: '55%', whiteSpace: 'nowrap', borderInlineEnd: `1px solid ${vars.color.borderControl}`, display: 'flex', alignItems: 'center', gap: vars.space[2], '&::after': { ...disclosureCaret, transform: 'rotate(90deg)', marginInlineStart: vars.space[1] }, '&[aria-expanded="true"]::after': { transform: 'rotate(-90deg)' } });
const countryTextStyle = css({ overflow: 'hidden', textOverflow: 'ellipsis' });
const numberStyle = css({
  flex: 1, minInlineSize: 0, inlineSize: '100%', blockSize: '100%', boxSizing: 'border-box', font: 'inherit', color: vars.color.text,
  background: 'transparent', border: 0, borderRadius: vars.radius.sm, paddingInline: vars.space[3], paddingBlock: 0,
  '&:focus-visible': focusRingOutset, '&::placeholder': { color: vars.color.textMuted },
});
const panelStyle = css({
  inlineSize: 'var(--phone-width)', minInlineSize: 0, maxInlineSize: 'var(--phone-available-width)',
  maxBlockSize: 'min(20rem, var(--phone-available-height, 50dvh))', overflow: 'hidden', zIndex: 1,
  transitionProperty: 'opacity', transitionDuration: vars.motion.duration.base, transitionTimingFunction: vars.motion.easeStandard,
  '@starting-style': { opacity: 0 }, [REDUCED_MOTION]: { transitionDuration: '0s' },
  [FORCED_COLORS]: { background: 'Canvas', color: 'CanvasText', borderColor: 'CanvasText' },
});
const searchRowStyle = css({ display: 'flex', gap: vars.space[1], flexShrink: 0 });
const searchStyle = css({ minInlineSize: 0, blockSize: vars.space[10], fontSize: vars.textSize.sm, paddingInline: vars.space[2] });
const listStyle = css({ overflow: 'auto', overscrollBehavior: 'contain', minBlockSize: 0, padding: vars.space[1], scrollPaddingBlock: vars.space[1] });
const headingStyle = css({ color: vars.color.textMuted, fontSize: vars.textSize.sm, paddingInline: vars.space[2], paddingBlock: vars.space[1] });
const optionStyle = css({ justifyContent: 'space-between', gap: vars.space[2], [FORCED_COLORS]: { '&[data-active]': { outlineColor: 'Highlight' } } });
const checkStyle = css({ color: vars.color.success, paddingInlineEnd: vars.space[3] });

/** Collect a telephone number and choose its country. */
export function PhoneInput({
  ref, value: valueProp, defaultValue = '', onValueChange, country: countryProp, defaultCountry = null, onCountryChange,
  open: openProp, defaultOpen = false, onOpenChange, countries = ALL_COUNTRIES, preferredCountries = [],
  label, description, error, hideLabel = false, validateOnBlur = true, size = 'md', locale, messages: messageOverrides,
  renderCountryIcon, slotProps, className, sx, dir, name, disabled, readOnly, required, form,
  onChange, onBlur, onKeyDown, onPaste, id, 'aria-describedby': describedBy, 'aria-labelledby': labelledBy, 'aria-invalid': invalidProp, ...native
}: PhoneInputProps) {
  const [country, requestCountry] = useControlledState<PhoneCountryCode | null>(countryProp, defaultCountry, onCountryChange);
  const proposedCountry = useRef<PhoneCountryCode | null>(country ?? null);
  const [value, requestValue] = useControlledState(valueProp, defaultValue, (next) => onValueChange?.(next, describePhone(next, proposedCountry.current)));
  const [open, requestOpen] = useControlledState(openProp, defaultOpen, onOpenChange);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [blurred, setBlurred] = useState(false);
  const [editError, setEditError] = useState(false);
  const [caretEdit, setCaretEdit] = useState<{ text: string; digits: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const exitQueued = useRef(false);
  const listRef = useRef<Array<HTMLElement | null>>([]);
  const [focusIntent, setFocusIntent] = useState<{ open: boolean; target: FocusTarget } | null>(null);
  const uid = useId();
  const listId = `${uid}-countries`;
  const labelId = `${uid}-label`;
  const currentCountry = country ?? null;
  const currentValue = value ?? '';
  const details = describePhone(currentValue, currentCountry);
  const names = useMemo(() => new Intl.DisplayNames(locale, { type: 'region' }), [locale]);
  const countryName = (code: PhoneCountryCode) => names.of(code) ?? code;
  const countryLabel = currentCountry ? countryName(currentCountry) : messageOverrides?.countriesLabel ?? defaults.countriesLabel;
  const messages: PhoneInputMessages = {
    ...defaults,
    results: (count) => {
      const number = new Intl.NumberFormat(locale).format(count);
      return new Intl.PluralRules(locale).select(count) === 'one' ? `${number} country` : `${number} countries`;
    },
    ...messageOverrides,
  };
  const internalError = editError || (blurred && validateOnBlur && currentValue !== '' && !details.valid);
  const displayedError = isRenderable(error) ? error : internalError ? messages.invalid(currentCountry ? countryLabel : null) : undefined;
  const field = useFieldAnatomy({ id, description, error: displayedError, 'aria-describedby': describedBy, 'aria-invalid': invalidProp });
  const pool = useMemo(() => {
    const collator = new Intl.Collator(locale, { sensitivity: 'base', usage: 'sort' });
    return [...new Set(countries)].filter((code) => ALL_COUNTRIES.includes(code)).sort((a, b) => collator.compare(names.of(a) ?? a, names.of(b) ?? b));
  }, [countries, locale, names]);
  const searchCollator = useMemo(() => new Intl.Collator(locale, { sensitivity: 'base', usage: 'search' }), [locale]);
  const matches = (text: string) => {
    const needle = query.trim();
    if (!needle) return true;
    return Array.from({ length: Math.max(0, text.length - needle.length + 1) }, (_, index) => text.slice(index, index + needle.length)).some((part) => searchCollator.compare(part, needle) === 0);
  };
  const filtered = pool.filter((code) => matches(countryName(code)) || matches(code) || matches(`+${getCountryCallingCode(code)}`));
  const preferred = [...new Set(preferredCountries)].filter((code) => filtered.includes(code));
  const remaining = filtered.filter((code) => !preferred.includes(code));
  const rows = [...preferred, ...remaining];
  const activeCountry = activeIndex !== null ? rows[activeIndex] : undefined;
  const optionId = (code: PhoneCountryCode) => `${uid}-country-${code}`;

  function changeOpen(next: boolean, focus: FocusTarget = null) {
    if (disabled || (readOnly && next)) return;
    if (next === !!open) return;
    setFocusIntent({ open: next, target: focus });
    requestOpen(next);
  }
  const floating = useOverlayFloating({
    open: !!open && !disabled, placement: 'bottom-start',
    onOpenChange: (next, _event, reason) => changeOpen(next, reason === 'escape-key' ? 'trigger' : null),
    onAvailableSize: ({ width, height }) => {
      const element = floating.refs.floating.current;
      if (!element) return;
      element.style.setProperty('--phone-available-width', `${width}px`);
      element.style.setProperty('--phone-available-height', `${height}px`);
      element.style.setProperty('--phone-width', `${shellRef.current?.getBoundingClientRect().width ?? width}px`);
    },
  });
  const dismiss = useDismiss(floating.context);
  const navigation = useListNavigation(floating.context, {
    listRef, activeIndex: activeCountry ? activeIndex : null, selectedIndex: currentCountry ? rows.indexOf(currentCountry) : null,
    onNavigate: setActiveIndex, virtual: true, loop: false, focusItemOnOpen: false, enabled: !!open,
  });
  const { getReferenceProps, getFloatingProps, getItemProps } = useInteractions([dismiss, navigation]);
  const mergedInputRef = useMergeRefs([ref, inputRef]);
  const mergedTriggerRef = useMergeRefs([triggerRef, floating.refs.setReference]);

  useLayoutEffect(() => {
    if (!focusIntent) return;
    if (!!open !== focusIntent.open) { setFocusIntent(null); return; }
    const targets = { search: searchRef.current, number: inputRef.current, trigger: triggerRef.current };
    const target = focusIntent.target ? targets[focusIntent.target] : null;
    if (focusIntent.target === 'search' && !target) return;
    target?.focus();
    setFocusIntent(null);
  });
  useLayoutEffect(() => {
    if (!caretEdit) return;
    const input = inputRef.current;
    if (input && input.ownerDocument.activeElement === input) {
      const caret = mapPhoneCaret(caretEdit.text, details.formatted, caretEdit.digits);
      input.setSelectionRange(caret, caret);
    }
    setCaretEdit(null);
  });
  useEffect(() => {
    if (open && activeCountry) listRef.current[activeIndex!]?.scrollIntoView({ block: 'nearest' });
  }, [open, activeCountry, activeIndex]);
  useEffect(() => {
    const ownerForm = inputRef.current?.form;
    if (!ownerForm) return;
    const reset = (event: Event) => {
      queueMicrotask(() => {
        if (event.defaultPrevented) return;
        proposedCountry.current = defaultCountry;
        requestValue(defaultValue);
        requestCountry(defaultCountry);
        requestOpen(defaultOpen);
        setBlurred(false); setEditError(false); setQuery('');
      });
    };
    ownerForm.addEventListener('reset', reset);
    return () => ownerForm.removeEventListener('reset', reset);
  }, [form, defaultValue, defaultCountry, defaultOpen, requestValue, requestCountry, requestOpen]);

  function edit(text: string, digits: number) {
    setCaretEdit({ text, digits });
    const proposed = editPhone(text, currentCountry);
    if (!proposed || (proposed.international && proposed.country && !pool.includes(proposed.country))) {
      setEditError(true); return;
    }
    setEditError(false);
    const nextCountry = proposed.international ? proposed.country : currentCountry;
    proposedCountry.current = nextCountry;
    if (proposed.international) requestCountry(nextCountry);
    requestValue(proposed.value);
  }
  function openPicker(seed = '', last = false) {
    if (disabled || readOnly) return;
    setQuery(seed);
    const index = currentCountry ? rows.indexOf(currentCountry) : -1;
    setActiveIndex(index >= 0 ? index : last ? rows.length - 1 : 0);
    changeOpen(true, 'search');
  }
  function selectCountry(next: PhoneCountryCode) {
    if (disabled || readOnly) return;
    requestCountry(next);
    proposedCountry.current = next;
    const national = details.formatted.startsWith('+') ? nationalPhoneDigits(currentValue) : details.formatted;
    const proposed = national ? editPhone(national, next) : null;
    requestValue(proposed?.value ?? currentValue);
    setEditError(false);
    changeOpen(false, 'number');
  }
  function validateExit() {
    if (exitQueued.current) return;
    exitQueued.current = true;
    queueMicrotask(() => {
      exitQueued.current = false;
      const active = inputRef.current?.ownerDocument.activeElement;
      if (!active) return;
      const insidePanel = floating.refs.floating.current?.contains(active);
      if (open && !insidePanel) changeOpen(false);
      if (rootRef.current?.contains(active) || insidePanel) return;
      setBlurred(true);
    });
  }
  const status = editError ? messages.invalid(currentCountry ? countryLabel : null)
    : open ? messages.results(rows.length)
    : details.valid ? messages.valid(countryLabel)
    : currentCountry ? messages.countryChanged(countryLabel) : '';

  return (
    <FieldRoot data-ui="phone-input" ref={rootRef} dir={dir} part={slotProps?.root} className={className} sx={sx} onBlur={validateExit}>
      <FieldLabel id={labelId} htmlFor={field.id} required={required} hidden={hideLabel} part={slotProps?.label}>{label}</FieldLabel>
      <div {...withoutSx(slotProps?.control)} ref={shellRef} data-ui="phone-input-control" data-disabled={disabled ? '' : undefined} data-invalid={field.ariaInvalid === true ? '' : undefined} css={[inputControlStyle, shellStyle, sizes[size], slotProps?.control?.sx]}>
        <button {...getReferenceProps({ onClick: () => open ? changeOpen(false) : openPicker() })} {...withoutSx(slotProps?.countryTrigger)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); openPicker('', event.key === 'ArrowUp'); }
            else if (event.key.length === 1 && /\p{L}/u.test(event.key) && !event.altKey && !event.ctrlKey && !event.metaKey && !event.nativeEvent.isComposing) { event.preventDefault(); openPicker(event.key); }
          }} ref={mergedTriggerRef} type="button" disabled={disabled || readOnly}
          aria-activedescendant={undefined}
          aria-label={messages.countryButton(countryLabel, currentCountry ? `+${getCountryCallingCode(currentCountry)}` : '')}
          aria-haspopup="listbox" aria-expanded={!!open && !disabled} aria-controls={open && !disabled ? listId : undefined}
          css={[buttonStyle, triggerStyle, slotProps?.countryTrigger?.sx]}>
          {currentCountry && renderCountryIcon && <span aria-hidden>{renderCountryIcon(currentCountry)}</span>}
          <span css={countryTextStyle}>{countryLabel}</span>
          {currentCountry && <span aria-hidden dir="ltr">{` +${getCountryCallingCode(currentCountry)}`}</span>}
        </button>
        <input {...withoutSx(slotProps?.number)} {...native} ref={mergedInputRef} id={field.id} type="tel" inputMode="tel" dir="ltr" form={form}
          disabled={disabled} readOnly={readOnly} required={required} value={details.formatted}
          aria-describedby={field.describedBy} aria-labelledby={[labelledBy, isRenderable(label) && labelId].filter(Boolean).join(' ') || undefined} aria-invalid={field.ariaInvalid}
          css={[numberStyle, slotProps?.number?.sx]}
          onBlur={onBlur}
          onChange={(event) => {
            onChange?.(event);
            if (!event.defaultPrevented && !readOnly) edit(event.currentTarget.value, countDigits(event.currentTarget.value.slice(0, event.currentTarget.selectionStart ?? 0)));
          }}
          onPaste={onPaste}
          onKeyDown={(event) => {
            onKeyDown?.(event);
            if (event.defaultPrevented || readOnly || event.nativeEvent.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
            if (event.key === '+') { event.preventDefault(); openPicker('+'); return; }
            const input = event.currentTarget;
            const start = input.selectionStart ?? 0;
            if (start !== input.selectionEnd || !['Backspace', 'Delete'].includes(event.key)) return;
            const backward = event.key === 'Backspace';
            const adjacent = backward ? start - 1 : start;
            if (adjacent < 0 || adjacent >= input.value.length || /[\d+]/.test(input.value[adjacent]!)) return;
            let target = adjacent;
            while (target >= 0 && target < input.value.length && !/\d/.test(input.value[target]!)) target += backward ? -1 : 1;
            if (target < 0 || target >= input.value.length) return;
            event.preventDefault();
            const text = input.value.slice(0, target) + input.value.slice(target + 1);
            edit(text, countDigits(input.value.slice(0, backward ? target : start)));
          }} />
        {details.valid && <span aria-hidden css={checkStyle}>✓</span>}
      </div>
      <FieldDescription id={field.descriptionId} part={slotProps?.description}>{description}</FieldDescription>
      <FieldError id={field.errorId} part={slotProps?.error}>{displayedError}</FieldError>
      <input type="hidden" name={name} form={form} value={currentValue} disabled={disabled} />
      <span {...withoutSx(slotProps?.status)} role="status" aria-live="polite" aria-atomic="true" css={[visuallyHiddenStyle, slotProps?.status?.sx]}>{status}</span>
      {open && !disabled && <OverlayPortal>
        <FloatingFocusManager context={floating.context} modal={false} initialFocus={-1} returnFocus={false} closeOnFocusOut>
          <div {...getFloatingProps({ onBlur: validateExit })} {...withoutSx(slotProps?.panel)} role="dialog" aria-label={messages.countriesLabel} aria-orientation={undefined} aria-activedescendant={undefined} ref={floating.refs.setFloating} data-ui="phone-input-panel" dir={dir} style={floating.floatingStyles} css={[listboxSurfaceStyle, panelStyle, slotProps?.panel?.sx]}>
            <div css={searchRowStyle}>
              <input {...withoutSx(slotProps?.search)} ref={(element) => { searchRef.current = element; if (element && focusIntent?.target === 'search' && open) { element.focus(); setFocusIntent(null); } }} role="combobox" aria-label={messages.searchLabel} placeholder={messages.searchPlaceholder} aria-autocomplete="list" aria-expanded="true" aria-controls={listId} aria-activedescendant={activeCountry ? optionId(activeCountry) : undefined}
                value={query} css={[inputControlStyle, searchStyle, slotProps?.search?.sx]}
                onChange={(event) => { setQuery(event.currentTarget.value); setActiveIndex(0); }}
                onKeyDown={(event) => {
                  if (event.nativeEvent.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
                  if (event.key === 'Enter') { event.preventDefault(); if (activeCountry) selectCountry(activeCountry); return; }
                  if (event.key === 'Escape') return;
                  const moves: Record<string, number> = { ArrowDown: (activeIndex ?? -1) + 1, ArrowUp: (activeIndex ?? rows.length) - 1, PageDown: (activeIndex ?? 0) + PAGE_STEP, PageUp: (activeIndex ?? 0) - PAGE_STEP, ...(!query ? { Home: 0, End: rows.length - 1 } : {}) };
                  if (event.key in moves) { event.preventDefault(); event.stopPropagation(); setActiveIndex(rows.length ? Math.max(0, Math.min(rows.length - 1, moves[event.key]!)) : null); }
                }} />
              {query && <button type="button" tabIndex={-1} aria-label={messages.clearSearchLabel} css={buttonStyle} onClick={() => { setQuery(''); setActiveIndex(0); searchRef.current?.focus(); }}>×</button>}
              <button type="button" tabIndex={-1} aria-label={messages.closeLabel} css={buttonStyle} onClick={() => changeOpen(false, 'trigger')}>×</button>
            </div>
            <div {...withoutSx(slotProps?.list)} id={listId} role="listbox" aria-label={messages.countriesLabel} css={[listStyle, slotProps?.list?.sx]}>
              {([{ codes: preferred, heading: messages.suggestedLabel }, { codes: remaining, heading: messages.allCountriesLabel }]).map(({ codes: group, heading }, groupIndex) => {
                return group.length > 0 && <div role="group" aria-labelledby={`${uid}-group-${groupIndex}`} key={groupIndex}>
                  <div id={`${uid}-group-${groupIndex}`} css={headingStyle}>{heading}</div>
                  {group.map((code) => {
                    const index = rows.indexOf(code);
                    return <div {...getItemProps({ onClick: () => selectCountry(code), onMouseMove: () => setActiveIndex(index) })} {...withoutSx(slotProps?.option)} onMouseDown={(event) => event.preventDefault()} ref={(element) => { listRef.current[index] = element; }} key={code} id={optionId(code)} role="option" aria-selected={code === currentCountry} data-active={code === activeCountry ? '' : undefined} css={[listboxItemStyle, listboxItemStateStyle, listboxOptionStyle, optionStyle, slotProps?.option?.sx]}>
                      <span>{countryName(code)}</span><span dir="ltr">+{getCountryCallingCode(code)}{code === currentCountry ? ' ✓' : ''}</span>
                    </div>;
                  })}
                </div>;
              })}
            </div>
            {!rows.length && <div css={headingStyle}>{messages.empty}</div>}
          </div>
        </FloatingFocusManager>
      </OverlayPortal>}
    </FieldRoot>
  );
}
PhoneInput.displayName = 'PhoneInput';
