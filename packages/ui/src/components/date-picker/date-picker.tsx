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
  type ComponentType,
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
  useInteractions,
  useMergeRefs,
  useRole,
  type UseInteractionsReturn,
} from '@floating-ui/react';
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type Theme } from '../../styling/css';
import { raisedSurface } from '../../styling/surface';
import { WithSx, type SxProps } from '../../styling/sx';
import { OverlayLayer, useLayerDismiss } from '../../overlay/overlay-layer';
import { OverlayPortal } from '../../overlay/overlay-portal';
import { useOverlayFloating } from '../../overlay/use-overlay-floating';
import { getInputReferenceProps } from '../../overlay/input-reference-props';
import { dateTimeFormatter, defaultLocale } from '../../utils/intl';
import { CIVIL_DATE_FORMAT_OPTIONS, parseCivilDate, todayCivilDate, dateFromIso } from '../../utils/civil-date';
import { isRenderable } from '../../utils/renderable';
import { useControlledState } from '../../utils/use-controlled-state';
import { Calendar, type CalendarWeekday } from '../calendar';
import { clampDate } from '../calendar/calendar.utils';
import { TextField, type TextFieldProps } from '../text-field';

const PLACEMENT = 'bottom-start';
const OPEN_KEYS = new Set(['Enter', 'ArrowDown']);
const SPACE = ' ';
// These selectors and data-date deliberately depend on Calendar's public DOM contract:
// stable attributes covered by regression stories, with Calendar composed untouched.
// A Calendar onSelect-style callback is a follow-up alternative to this coupling.
const TAB_STOP_DAY = '[data-ui="calendar-day"][tabindex="0"]';
const DAY = '[data-ui="calendar-day"]';
const DATE_PICKER_FORMAT_OPTIONS = {
  ...CIVIL_DATE_FORMAT_OPTIONS,
  dateStyle: 'medium',
} satisfies Intl.DateTimeFormatOptions;

export interface DatePickerBaseProps {
  /** Selected date, 'YYYY-MM-DD'. */
  value?: string;
  /** Set the initial uncontrolled date as `YYYY-MM-DD`. Omit for no selection. */
  defaultValue?: string;
  /** Deduplicated value-change request with the date as 'YYYY-MM-DD'; controlled values may reject it. */
  onValueChange?: (value: string) => void;
  /** Control whether the calendar popup is open; `disabled` keeps it closed. */
  open?: boolean;
  /** Open the uncontrolled calendar initially. Defaults to `false`. */
  defaultOpen?: boolean;
  /** Receive requests to open or close the calendar popup. */
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
  /** Compose the date input and calendar popup. */
  children?: ReactNode;
}

export interface DatePickerComposedProps extends DatePickerBaseProps {
  label?: never;
  description?: never;
  error?: never;
  size?: never;
  slots?: never;
  slotProps?: never;
}

type DatePickerGeneratedPartProps<Props> = Omit<Props, 'children'> & { sx?: Interpolation<Theme> };

export interface DatePickerShorthandProps extends Omit<DatePickerBaseProps, 'children'> {
  /** Label the generated date field and its popup. */
  label: string;
  /** Show supporting content below the generated date field. */
  description?: ReactNode;
  /** Show an error below the generated field and mark it invalid. */
  error?: ReactNode;
  /** Set the generated date field's size. Defaults to `md`. */
  size?: DatePickerInputProps['size'];
  children?: never;
  /** Replace the field presentation or popup div; forward all supplied props and ref. */
  slots?: DatePickerSlots;
  /** Pass props and `sx` to the generated input and popup. */
  slotProps?: {
    /** Text field trigger displaying the selected date. Default: `TextField`. */
    input?: DatePickerGeneratedPartProps<DatePickerInputProps>;
    /** Dialog popup container enclosing the calendar. */
    popup?: DatePickerGeneratedPartProps<DatePickerPopupProps>;
  };
}

export type DatePickerProps = DatePickerComposedProps | DatePickerShorthandProps;

export interface DatePickerSlots {
  /** Displays the selected date in the field. */
  input?: ComponentType<TextFieldProps>;
  /** Holds the calendar dialog. */
  popup?: ComponentType<ComponentPropsWithRef<'div'>>;
}

/** Value, placeholder and form name live on the root; the input is read-only in this version. */
export interface DatePickerInputProps
  extends Omit<
    TextFieldProps,
    'value' | 'defaultValue' | 'onValueChange' | 'onChange' | 'readOnly' | 'placeholder' | 'name' | 'type'
  > {}

/** The popup renders its own calendar. */
export type DatePickerPopupProps = Omit<ComponentPropsWithRef<'div'>, 'children'> & SxProps;

type OverlayFloating = ReturnType<typeof useOverlayFloating<HTMLInputElement>>;

interface InputLabelling {
  labelledBy?: string;
  label?: string;
}

interface DatePickerContextValue {
  slots: DatePickerShorthandProps['slots'];
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
  direction: 'ltr' | 'rtl';
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

function DatePickerOverlay({
  nodeId,
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
  slots,
}: DatePickerBaseProps & Pick<DatePickerShorthandProps, 'slots'> & { nodeId: string | undefined }) {
  const [value, requestValueChange] = useControlledState<string>(valueProp, defaultValue, onValueChange);
  const [requestedOpen = false, requestOpenChange] = useControlledState<boolean>(openProp, defaultOpen, onOpenChange);
  const [inputDisabled, setInputDisabled] = useState(false);
  const disabled = disabledProp || inputDisabled;
  const open = requestedOpen && !disabled;
  const [inputLabelling, setInputLabelling] = useState<InputLabelling | null>(null);
  const gridRef = useRef<HTMLTableElement>(null);
  const [direction, setDirection] = useState<'ltr' | 'rtl'>('ltr');
  const pendingFocusRestoreRef = useRef(false);

  const locale = useMemo(
    () => dateTimeFormatter(localeProp ?? defaultLocale()).resolvedOptions().locale,
    [localeProp],
  );
  const formatter = useMemo(() => dateTimeFormatter(locale, DATE_PICKER_FORMAT_OPTIONS), [locale]);
  const defaultPlaceholder = useMemo(() => fieldPlaceholder(formatter, locale), [formatter, locale]);
  const selectedDate = parseCivilDate(value);
  const displayValue = selectedDate ? formatter.format(dateFromIso(selectedDate)) : '';
  const min = parseCivilDate(minProp) ?? undefined;
  const max = parseCivilDate(maxProp) ?? undefined;
  const initialMonth = clampDate(
    selectedDate ?? todayCivilDate({ timeZone: dateTimeFormatter().resolvedOptions().timeZone }),
    min,
    max,
  ).slice(0, 7);

  const { refs, floatingStyles, context } = useOverlayFloating<HTMLInputElement>({
    nodeId,
    open,
    placement: PLACEMENT,
    onOpenChange: (next, _event, reason) => {
      if (disabled && next) return;
      // Escape requests a close; focus is restored only once the close is actually applied.
      if (!next) pendingFocusRestoreRef.current = reason === 'escape-key';
      requestOpenChange(next);
    },
  });

  useLayoutEffect(() => {
    const input = refs.domReference.current;
    if (open && input) setDirection(getComputedStyle(input).direction === 'rtl' ? 'rtl' : 'ltr');
  }, [open, refs]);

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
  const dismiss = useLayerDismiss(context, 'container');
  const role = useRole(context, { role: 'dialog' });
  const { getReferenceProps, getFloatingProps } = useInteractions([click, ...dismiss, role]);

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
      direction,
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
      slots,
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
      direction,
      getReferenceProps,
      getFloatingProps,
      requestOpenChange,
      requestValueChange,
      slots,
    ],
  );

  return (
    <DatePickerContext.Provider value={contextValue}>
      {children}
      {name !== undefined && <input type="hidden" name={name} value={value ?? ''} disabled={disabled} />}
    </DatePickerContext.Provider>
  );
}

function DatePickerRoot(props: DatePickerProps) {
  const children = props.label !== undefined ? (
    <>
      <DatePickerInput
        label={props.label}
        description={props.description}
        error={props.error}
        size={props.size}
        {...props.slotProps?.input}
      />
      <DatePickerPopup {...props.slotProps?.popup} />
    </>
  ) : props.children;
  return (
    <OverlayLayer>
      {(nodeId) => <DatePickerOverlay {...props} nodeId={nodeId}>{children}</DatePickerOverlay>}
    </OverlayLayer>
  );
}

DatePickerRoot.displayName = 'DatePicker';

function DatePickerInput({
  ref,
  label,
  size,
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
    slots,
  } = useDatePickerContext('Input');
  const Input = slots?.input ?? TextField;
  const mergedRef = useMergeRefs([refs.setReference, ref]);
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
    <Input
      {...getInputReferenceProps(getReferenceProps, { ...rest, onKeyDown: handleKeyDown, onKeyUp: handleKeyUp })}
      ref={mergedRef}
      size={size}
      id={id}
      label={hasLabel ? <span id={labelId}>{label}</span> : label}
      slotProps={{ ...slotProps, control: { ...slotProps?.control, sx: [inputStyle, slotProps?.control?.sx] } }}
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
    direction,
    getFloatingProps,
    selectDate,
    slots,
  } = useDatePickerContext('Popup');
  const Root = slots?.popup ?? 'div';
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
    const date = parseCivilDate(button?.dataset.date);
    if (date !== null) selectDate(date);
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
            <Root
              {...getFloatingProps({ ...labelling, ...rest })}
              ref={mergedRef}
              data-ui="date-picker-popup"
              dir={rest.dir ?? direction}
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
            </Root>
          )}
        </WithSx>
      </FloatingFocusManager>
    </OverlayPortal>
  );
}

DatePickerPopup.displayName = 'DatePicker.Popup';

export const DatePicker = Object.assign(DatePickerRoot, { Input: DatePickerInput, Popup: DatePickerPopup });
