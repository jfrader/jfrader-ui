// APG pattern: date picker combobox with a dialog popup
// (https://www.w3.org/WAI/ARIA/apg/patterns/combobox/examples/combobox-datepicker/).
// DatePicker.Input is a read-only TextField whose <input> carries role="combobox",
// aria-haspopup="dialog", aria-expanded and (while open) aria-controls. Typing a date into the
// input lands in a follow-up; in this version the date is picked from the calendar only.
// DatePicker.Popup is a non-modal role="dialog" named by the input's label, holding a Calendar
// (header + grid) wired to value, min, max, locale and firstDayOfWeek.
// Keyboard map, input: click, Enter, ArrowDown or Space open the popup and move focus into the
// grid's tab-stop day (the selected day, else today, else the first enabled day of the shown
// month); while open, the same keys move focus back into the grid. Space opens on keyup so its
// keyup never activates the newly focused day.
// Keyboard map, popup: the Calendar grid keys; Enter/Space/click on a day commit it, close and
// return focus to the input; Escape closes and returns focus to the input without changing the
// value; Tab moves through the month buttons and the grid, and tabbing out closes.
// Focus return is explicit: only an accepted Escape or day selection restores focus to the
// input; outside presses and Tab-out never move focus (returnFocus is off).
// Each open shows the selected month (else the current month), clamped into min/max: the popup
// unmounts while closed, so an Escape discards any month navigation.
// Value and open are independent controlled axes: selecting a day requests the value and the
// close separately, and a controlled parent may accept either, both or neither.
// Values are date-only 'YYYY-MM-DD' strings; the input shows them through
// Intl.DateTimeFormat (dateStyle 'medium', Gregorian, formatted in UTC so the civil date is kept).
// Forms: `name` renders a hidden input carrying the ISO value ('' when empty).
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import {
  FloatingFocusManager,
  useClick,
  useDismiss,
  useInteractions,
  useMergeRefs,
  useRole,
  type UseInteractionsReturn,
} from '@floating-ui/react';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { raisedSurface } from '../../styling/surface';
import { WithSx, type SxProps } from '../../styling/sx';
import { OverlayPortal } from '../../overlay/overlay-portal';
import { useOverlayFloating } from '../../overlay/use-overlay-floating';
import { isRenderable } from '../../utils/renderable';
import { useControlledState } from '../../utils/use-controlled-state';
import { Calendar, type CalendarWeekday } from '../calendar';
import { TextField, type TextFieldProps } from '../text-field';

const PLACEMENT = 'bottom-start';
const OPEN_KEYS = new Set(['Enter', 'ArrowDown']);
const SPACE = ' ';
// These selectors and data-date deliberately depend on Calendar's public DOM contract:
// stable attributes covered by regression stories, with Calendar composed untouched.
// A Calendar onSelect-style callback is a follow-up alternative to this coupling.
const TAB_STOP_DAY = '[data-ui="calendar-day"][tabindex="0"]';
const DAY = '[data-ui="calendar-day"]';
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const CIVIL_DATE_FORMAT_OPTIONS = {
  calendar: 'gregory',
  timeZone: 'UTC',
  dateStyle: 'medium',
} satisfies Intl.DateTimeFormatOptions;

export interface DatePickerProps {
  /** Selected date, 'YYYY-MM-DD'. */
  value?: string;
  defaultValue?: string;
  /** Deduplicated value-change request with the date as 'YYYY-MM-DD'; controlled values may reject it. */
  onValueChange?: (value: string) => void;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Earliest selectable date, 'YYYY-MM-DD'. */
  min?: string;
  /** Latest selectable date, 'YYYY-MM-DD'. */
  max?: string;
  /** BCP 47 tag. Defaults to `navigator.language`. */
  locale?: string;
  /** Defaults to the locale's week start. */
  firstDayOfWeek?: CalendarWeekday;
  /** Closes the popup and blocks all interaction, even with controlled open=true. */
  disabled?: boolean;
  /** Renders a hidden input carrying the ISO value so it takes part in native form submission. */
  name?: string;
  /** Shown while no date is selected. Defaults to the locale's date field names in display order. */
  placeholder?: string;
  children?: ReactNode;
}

/** Value, placeholder and form name live on the root; the input is read-only in this version. */
export interface DatePickerInputProps
  extends Omit<
    TextFieldProps,
    'value' | 'defaultValue' | 'onValueChange' | 'onChange' | 'readOnly' | 'placeholder' | 'name' | 'type'
  > {}

/** The popup renders its own calendar. */
export type DatePickerPopupProps = Omit<ComponentPropsWithRef<'div'>, 'children'> & SxProps;

type OverlayFloating = ReturnType<typeof useOverlayFloating>;

interface InputLabelling {
  labelledBy?: string;
  label?: string;
}

interface DatePickerContextValue {
  open: boolean;
  disabled: boolean;
  value: string | undefined;
  displayValue: string;
  placeholder: string;
  initialMonth: string;
  min: string | undefined;
  max: string | undefined;
  locale: string;
  firstDayOfWeek: CalendarWeekday | undefined;
  inputLabelling: InputLabelling | null;
  gridRef: RefObject<HTMLTableElement | null>;
  refs: OverlayFloating['refs'];
  floatingContext: OverlayFloating['context'];
  floatingStyles: CSSProperties;
  getReferenceProps: UseInteractionsReturn['getReferenceProps'];
  getFloatingProps: UseInteractionsReturn['getFloatingProps'];
  requestOpenChange: (open: boolean) => void;
  selectDate: (date: string) => void;
  setInputLabelling: (labelling: InputLabelling | null) => void;
  setInputDisabled: (disabled: boolean) => void;
}

const DatePickerContext = createContext<DatePickerContextValue | null>(null);

function useDatePickerContext(part: string): DatePickerContextValue {
  const context = useContext(DatePickerContext);
  if (!context) throw new Error(`DatePicker.${part} must be rendered inside <DatePicker>.`);
  return context;
}

// ---- Date-only values ('YYYY-MM-DD', read as UTC calendar fields).

const pad = (value: number, length: number) => String(value).padStart(length, '0');

const isoFromParts = (year: number, month: number, day: number) => `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;

function civilDate(iso: string | undefined): Date | undefined {
  if (iso === undefined || !ISO_DATE.test(iso)) return undefined;
  const [year = Number.NaN, month = Number.NaN, day = Number.NaN] = iso.split('-').map(Number);
  // setUTCFullYear keeps years 0–99 literal; the round trip rejects overflowing days.
  const date = new Date(Date.UTC(0, 0, 1));
  date.setUTCFullYear(year, month - 1, day);
  return isoFromParts(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()) === iso ? date : undefined;
}

const validDate = (iso: string | undefined) => (civilDate(iso) ? iso : undefined);

function clampDate(iso: string, min: string | undefined, max: string | undefined): string {
  if (min !== undefined && iso < min) return min;
  if (max !== undefined && iso > max) return max;
  return iso;
}

function localToday(): string {
  // The user's local civil day, as Calendar marks it.
  const now = new Date();
  return isoFromParts(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

const defaultLocale = () => (typeof navigator === 'undefined' ? undefined : navigator.language);

/** The date format's fields in the locale's order, e.g. "month day, year". */
function fieldPlaceholder(formatter: Intl.DateTimeFormat, locale: string): string {
  const fieldNames = new Intl.DisplayNames(locale, { type: 'dateTimeField' });
  return formatter
    .formatToParts(new Date(0))
    .map((part) => (part.type === 'literal' ? part.value : (fieldNames.of(part.type) ?? part.value)))
    .join('');
}

function focusTabStopDay(grid: HTMLTableElement | null) {
  const day = grid?.querySelector<HTMLButtonElement>(TAB_STOP_DAY) ?? null;
  day?.focus({ preventScroll: true });
  return day;
}

// ---- Styles.

const inputStyle = css({
  cursor: 'pointer',
  '&:disabled': {
    cursor: 'not-allowed',
  },
});

const popupStyle = css({
  ...raisedSurface,
  borderRadius: vars.radius.md,
  boxShadow: vars.shadow.overlay,
  padding: vars.space[3],
});

// ---- Parts.

function DatePickerRoot({
  value: valueProp,
  defaultValue,
  onValueChange,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  min: minProp,
  max: maxProp,
  locale: localeProp,
  firstDayOfWeek,
  disabled: disabledProp = false,
  name,
  placeholder: placeholderProp,
  children,
}: DatePickerProps) {
  const [value, requestValueChange] = useControlledState<string>(valueProp, defaultValue, onValueChange);
  const [requestedOpen = false, requestOpenChange] = useControlledState<boolean>(openProp, defaultOpen, onOpenChange);
  const [inputDisabled, setInputDisabled] = useState(false);
  const disabled = disabledProp || inputDisabled;
  const open = requestedOpen && !disabled;
  const [inputLabelling, setInputLabelling] = useState<InputLabelling | null>(null);
  const gridRef = useRef<HTMLTableElement>(null);
  const pendingFocusRestoreRef = useRef(false);

  const locale = useMemo(
    () => new Intl.DateTimeFormat(localeProp ?? defaultLocale()).resolvedOptions().locale,
    [localeProp],
  );
  const formatter = useMemo(() => new Intl.DateTimeFormat(locale, CIVIL_DATE_FORMAT_OPTIONS), [locale]);
  const defaultPlaceholder = useMemo(() => fieldPlaceholder(formatter, locale), [formatter, locale]);
  const selectedDate = civilDate(value);
  const displayValue = selectedDate ? formatter.format(selectedDate) : '';
  const min = validDate(minProp);
  const max = validDate(maxProp);
  const initialMonth = clampDate(validDate(value) ?? localToday(), min, max).slice(0, 7);

  const { refs, floatingStyles, context } = useOverlayFloating({
    open,
    placement: PLACEMENT,
    onOpenChange: (next, _event, reason) => {
      if (disabled && next) return;
      // Escape requests a close; focus is restored only once the close is actually applied.
      if (!next) pendingFocusRestoreRef.current = reason === 'escape-key';
      requestOpenChange(next);
    },
  });

  useEffect(() => {
    if (!disabled) return;
    pendingFocusRestoreRef.current = false;
    if (requestedOpen) requestOpenChange(false);
  }, [disabled, requestedOpen, requestOpenChange]);

  // A rejected controlled close keeps the popup open, so focus stays inside it.
  useEffect(() => {
    if (!disabled && !open && pendingFocusRestoreRef.current) {
      pendingFocusRestoreRef.current = false;
      refs.domReference.current?.focus();
    }
  }, [disabled, open, refs]);

  // Keyboard opening is handled by DatePicker.Input (Space on keyup, focus into the grid).
  const click = useClick(context, { enabled: !disabled, keyboardHandlers: false });
  const dismiss = useDismiss(context, { escapeKey: true, outsidePress: true });
  const role = useRole(context, { role: 'dialog' });
  const { getReferenceProps, getFloatingProps } = useInteractions([click, dismiss, role]);

  const contextValue = useMemo<DatePickerContextValue>(
    () => ({
      open,
      disabled,
      value,
      displayValue,
      placeholder: placeholderProp ?? defaultPlaceholder,
      initialMonth,
      min,
      max,
      locale,
      firstDayOfWeek,
      inputLabelling,
      gridRef,
      refs,
      floatingContext: context,
      floatingStyles,
      getReferenceProps,
      getFloatingProps,
      requestOpenChange: (next) => {
        if (disabled && next) return;
        requestOpenChange(next);
      },
      selectDate: (date) => {
        if (disabled) return;
        // Value and open are independent requests: a controlled parent decides each axis.
        requestValueChange(date);
        pendingFocusRestoreRef.current = true;
        requestOpenChange(false);
      },
      setInputLabelling,
      setInputDisabled,
    }),
    [
      open,
      disabled,
      value,
      displayValue,
      placeholderProp,
      defaultPlaceholder,
      initialMonth,
      min,
      max,
      locale,
      firstDayOfWeek,
      inputLabelling,
      refs,
      context,
      floatingStyles,
      getReferenceProps,
      getFloatingProps,
      requestOpenChange,
      requestValueChange,
    ],
  );

  return (
    <DatePickerContext.Provider value={contextValue}>
      {children}
      {name !== undefined && <input type="hidden" name={name} value={value ?? ''} disabled={disabled} />}
    </DatePickerContext.Provider>
  );
}

DatePickerRoot.displayName = 'DatePicker';

function DatePickerInput({
  ref,
  label,
  id: idProp,
  disabled: disabledProp,
  slotProps,
  onKeyDown,
  onKeyUp,
  ...rest
}: DatePickerInputProps) {
  const {
    open,
    disabled: rootDisabled,
    displayValue,
    placeholder,
    gridRef,
    refs,
    getReferenceProps,
    requestOpenChange,
    setInputLabelling,
    setInputDisabled,
  } = useDatePickerContext('Input');
  // The floating reference is typed for button triggers; any element positions the same.
  const mergedRef = useMergeRefs([refs.setReference as (node: Element | null) => void, ref]);
  const generatedId = useId();
  const id = idProp ?? generatedId;
  const labelId = `${id}-label`;
  const hasLabel = isRenderable(label);
  const labelledBy = rest['aria-labelledby'];
  const ariaLabel = rest['aria-label'];
  const inputAriaLabel = ariaLabel ?? (typeof label === 'string' ? label : undefined);
  const disabled = rootDisabled || disabledProp === true;

  useLayoutEffect(() => {
    setInputDisabled(disabledProp === true);
    return () => setInputDisabled(false);
  }, [disabledProp, setInputDisabled]);

  // The dialog reuses the input's label so both share one accessible name.
  useLayoutEffect(() => {
    setInputLabelling(
      labelledBy !== undefined
        ? { labelledBy }
        : ariaLabel !== undefined
          ? { label: ariaLabel }
          : typeof label === 'string'
            ? { label }
            // Non-string labels rely on the external label node, which FloatingFocusManager
            // aria-hides while open; supply aria-label for an accessible name in that state.
            : { labelledBy: hasLabel ? labelId : undefined },
    );
    return () => setInputLabelling(null);
  }, [labelledBy, ariaLabel, label, hasLabel, labelId, setInputLabelling]);

  const openOrFocusGrid = () => {
    if (disabled) return;
    if (open) focusTabStopDay(gridRef.current);
    else requestOpenChange(true);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented || disabled) return;
    if (event.key === SPACE) {
      event.preventDefault();
      return;
    }
    if (!OPEN_KEYS.has(event.key)) return;
    // Also keeps Enter from submitting the form.
    event.preventDefault();
    openOrFocusGrid();
  };

  const handleKeyUp = (event: KeyboardEvent<HTMLInputElement>) => {
    onKeyUp?.(event);
    if (event.defaultPrevented || disabled || event.key !== SPACE) return;
    openOrFocusGrid();
  };

  return (
    <TextField
      {...getReferenceProps({ ...rest, onKeyDown: handleKeyDown, onKeyUp: handleKeyUp } as unknown as Parameters<typeof getReferenceProps>[0])}
      ref={mergedRef}
      id={id}
      label={hasLabel ? <span id={labelId}>{label}</span> : label}
      slotProps={{ ...slotProps, control: { ...slotProps?.control, css: [inputStyle, slotProps?.control?.css] } }}
      value={displayValue}
      placeholder={placeholder}
      disabled={disabled}
      readOnly
      role="combobox"
      aria-label={inputAriaLabel}
      aria-autocomplete="none"
      data-state={open ? 'open' : 'closed'}
      data-ui="date-picker-input"
    />
  );
}

DatePickerInput.displayName = 'DatePicker.Input';

function DatePickerPopup({ ref, style, className, sx, ...rest }: DatePickerPopupProps) {
  const {
    open,
    value,
    initialMonth,
    min,
    max,
    locale,
    firstDayOfWeek,
    inputLabelling,
    gridRef,
    refs,
    floatingContext,
    floatingStyles,
    getFloatingProps,
    selectDate,
  } = useDatePickerContext('Popup');
  const mergedRef = useMergeRefs([refs.setFloating, ref]);
  // The grid mounts with every open (the portal attaches after its first commit, so an effect
  // here could run before the grid exists): focus its tab-stop day as it attaches, and hand
  // the same element to FloatingFocusManager. A negative initialFocus would instead trigger
  // its "untrapped typeable combobox" branch, which aria-hides everything outside the popup.
  const initialFocusRef = useRef<HTMLElement | null>(null);
  const setGridRef = (grid: HTMLTableElement | null) => {
    gridRef.current = grid;
    initialFocusRef.current = focusTabStopDay(grid);
  };
  const mergedGridRef = useMergeRefs([setGridRef]);

  if (!open) return null;

  const labelling =
    rest['aria-labelledby'] !== undefined || rest['aria-label'] !== undefined
      ? {}
      : inputLabelling?.labelledBy !== undefined
        ? { 'aria-labelledby': inputLabelling.labelledBy }
        : { 'aria-label': inputLabelling?.label };

  // Every day activation (click, Enter, Space) is a selection, including the selected day,
  // so the popup closes even when the value does not change.
  const handleGridClick = (event: MouseEvent<HTMLTableElement>) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>(DAY);
    if (button?.disabled) return;
    const date = button?.dataset.date;
    if (date !== undefined) selectDate(date);
  };

  const handleGridPointerDown = (event: PointerEvent<HTMLTableElement>) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>(DAY);
    if (button?.disabled) event.preventDefault();
  };

  return (
    <OverlayPortal>
      {/* Non-modal: no trap; Tab-out closes via focus-out. Focus return is explicit (see
          selectDate and the Escape path) — returnFocus is off so an outside press never
          transiently focuses the input. Initial focus is the grid's tab-stop day, passed as a
          ref: a negative initialFocus on this combobox input would trigger Floating UI's
          "untrapped typeable combobox" branch, which aria-hides everything outside the popup
          (the input's label and any outside click target). */}
      <FloatingFocusManager
        context={floatingContext}
        modal={false}
        initialFocus={initialFocusRef}
        returnFocus={false}
      >
        <WithSx className={className} styles={popupStyle} sx={sx}>
          {(className) => (
            <div
              {...getFloatingProps({ ...labelling, ...rest })}
              ref={mergedRef}
              data-ui="date-picker-popup"
              style={{ ...style, ...floatingStyles }}
              className={className}
            >
              {/* '' keeps the calendar controlled while nothing is selected; selection goes
                  through the grid click handler. */}
              <Calendar
                value={value ?? ''}
                defaultVisibleMonth={initialMonth}
                min={min}
                max={max}
                locale={locale}
                firstDayOfWeek={firstDayOfWeek}
              >
                <Calendar.Header />
                <Calendar.Grid
                  ref={mergedGridRef}
                  onClick={handleGridClick}
                  onPointerDownCapture={handleGridPointerDown}
                />
              </Calendar>
            </div>
          )}
        </WithSx>
      </FloatingFocusManager>
    </OverlayPortal>
  );
}

DatePickerPopup.displayName = 'DatePicker.Popup';

export const DatePicker = Object.assign(DatePickerRoot, { Input: DatePickerInput, Popup: DatePickerPopup });
