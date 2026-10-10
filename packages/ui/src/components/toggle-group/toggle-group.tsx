// A group of native toggle buttons (`aria-pressed`) inside a labelled `role="group"`, with
// the toolbar keyboard model from the APG: the group is a single tab stop whose roving
// tabindex sits on the focused item, falling back to the first pressed item and then to the
// first enabled item.
// Keyboard map: ArrowRight/ArrowLeft (horizontal, swapped under RTL) or ArrowDown/ArrowUp
// (vertical) move focus to the next/previous enabled item and wrap; Home/End jump to the
// first/last enabled item. Focus never toggles; Space/Enter toggle through the native click.
// type="single" behaves like a radio set: activating the pressed item leaves it pressed
// unless `allowEmpty` is set, in which case it unpresses and the value becomes ''. Item
// values must therefore be non-empty. type="multiple" toggles items independently and
// reports values in the order they were pressed.
import {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type FocusEvent,
  type HTMLAttributes,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css, type SerializedStyles } from '../../styling/css';
import { useControlledState } from '../../utils/use-controlled-state';

export type ToggleGroupType = 'single' | 'multiple';
export type ToggleGroupOrientation = 'horizontal' | 'vertical';

export interface ToggleGroupProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange' | 'defaultValue'> {
  type?: ToggleGroupType;
  value?: string | string[];
  defaultValue?: string | string[];
  onValueChange?: (value: string | string[]) => void;
  orientation?: ToggleGroupOrientation;
  disabled?: boolean;
  allowEmpty?: boolean;
  label?: string;
}

export interface ToggleGroupItemProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'value'> {
  value: string;
}

interface ToggleGroupContextValue {
  pressed: readonly string[];
  toggle: (value: string) => void;
  focused: string | null;
  setFocused: (value: string | null) => void;
  disabled: boolean;
}

const ToggleGroupContext = createContext<ToggleGroupContextValue | null>(null);

function useToggleGroupContext(part: string): ToggleGroupContextValue {
  const context = useContext(ToggleGroupContext);
  if (!context) throw new Error(`ToggleGroup.${part} must be rendered inside <ToggleGroup>.`);
  return context;
}

const EMPTY: readonly string[] = [];

const toPressed = (value: string | string[] | undefined, type: ToggleGroupType): readonly string[] => {
  if (Array.isArray(value)) {
    if (type === 'multiple') return value;
    value = value[0] ?? '';
  }
  return value === undefined || value === '' ? EMPTY : [value];
};

const ITEM_SELECTOR = '[data-ui="toggle-group-item"]:not([disabled])';

type Move = (current: number, count: number) => number;

const NEXT: Move = (current, count) => (current + 1) % count;
const PREVIOUS: Move = (current, count) => (current - 1 + count) % count;
const FIRST: Move = () => 0;
const LAST: Move = (_current, count) => count - 1;

const KEY_MOVES: Record<ToggleGroupOrientation | 'horizontalRtl', Partial<Record<string, Move>>> = {
  horizontal: { ArrowRight: NEXT, ArrowLeft: PREVIOUS, Home: FIRST, End: LAST },
  horizontalRtl: { ArrowRight: PREVIOUS, ArrowLeft: NEXT, Home: FIRST, End: LAST },
  vertical: { ArrowDown: NEXT, ArrowUp: PREVIOUS, Home: FIRST, End: LAST },
};

const REDUCED_MOTION = '@media (prefers-reduced-motion: reduce)';
const FORCED_COLORS = '@media (forced-colors: active)';

// Gap between the track edge and its items.
const TRACK_INSET = '2px';

const rootStyle = css({
  display: 'inline-flex',
  gap: TRACK_INSET,
  padding: TRACK_INSET,
  border: `1px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.md,
  backgroundColor: vars.color.surfaceInset,
});

const rootOrientationStyles: Record<ToggleGroupOrientation, SerializedStyles> = {
  horizontal: css({ flexDirection: 'row' }),
  vertical: css({ flexDirection: 'column', alignItems: 'stretch' }),
};

// Pressed pairs (AA in both themes): accentText on accentSoft over surfaceInset, plus an
// accent border so the state is not carried by fill color alone.
const itemStyle = css({
  appearance: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: vars.space[2],
  minBlockSize: '32px',
  boxSizing: 'border-box',
  border: '1px solid transparent',
  borderRadius: vars.radius.sm,
  background: 'transparent',
  cursor: 'pointer',
  paddingBlock: vars.space[1],
  paddingInline: vars.space[3],
  font: 'inherit',
  fontSize: vars.textSize.sm,
  fontWeight: vars.fontWeight.medium,
  color: vars.color.textMuted,
  transitionProperty: 'background-color, border-color, color',
  transitionDuration: vars.motion.duration.fast,
  transitionTimingFunction: vars.motion.easeStandard,
  '&:hover:not(:disabled):not([aria-pressed="true"])': {
    backgroundColor: vars.color.surfaceHover,
    color: vars.color.text,
  },
  '&[aria-pressed="true"]': {
    backgroundColor: vars.color.accentSoft,
    borderColor: vars.color.accent,
    color: vars.color.accentText,
  },
  '&[aria-pressed="true"]:hover:not(:disabled)': {
    backgroundColor: vars.color.accentSoftHover,
  },
  '&:disabled': {
    opacity: 0.55,
    cursor: 'not-allowed',
  },
  '&:focus-visible': {
    outline: `2px solid ${vars.color.focusRing}`,
    outlineOffset: '-2px',
  },
  [REDUCED_MOTION]: {
    transitionDuration: '0s',
  },
  [FORCED_COLORS]: {
    '&[aria-pressed="true"]': {
      backgroundColor: 'SelectedItem',
      borderColor: 'SelectedItem',
      color: 'SelectedItemText',
    },
  },
});

const Root = forwardRef<HTMLDivElement, ToggleGroupProps>(function ToggleGroup(
  {
    type = 'single',
    value: valueProp,
    defaultValue,
    onValueChange,
    orientation = 'horizontal',
    disabled = false,
    allowEmpty = false,
    label,
    'aria-label': ariaLabelProp,
    onKeyDown,
    ...rest
  },
  ref,
) {
  const [value, setValue] = useControlledState<string | string[]>(valueProp, defaultValue, onValueChange);
  const [focused, setFocused] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  useImperativeHandle(ref, () => rootRef.current as HTMLDivElement, []);

  const pressed = useMemo(() => toPressed(value, type), [value, type]);

  const context = useMemo(() => {
    const toggle = (item: string) => {
      const isPressed = pressed.includes(item);
      if (type === 'multiple') {
        setValue(isPressed ? pressed.filter((entry) => entry !== item) : [...pressed, item]);
      } else if (!isPressed) {
        setValue(item);
      } else if (allowEmpty) {
        setValue('');
      }
    };
    return { pressed, toggle, focused, setFocused, disabled };
  }, [pressed, setValue, type, allowEmpty, focused, disabled]);

  // Keep exactly one item in the page tab order, preferring (in order): the first pressed
  // item, the focused item, the first enabled item. This also recovers when the focused or
  // pressed item becomes disabled or is removed.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const items = Array.from(root.querySelectorAll<HTMLButtonElement>(ITEM_SELECTOR));
    if (items.length === 0) return;
    if (items.some((item) => item.tabIndex === 0)) return;
    const firstPressed = items.find((item) => item.getAttribute('aria-pressed') === 'true');
    const prefer = (candidate: string | null) => items.find((item) => item.dataset.value === candidate);
    setFocused((firstPressed ?? prefer(focused) ?? items[0])?.dataset.value ?? null);
  });

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    const root = rootRef.current;
    if (event.defaultPrevented || !root) return;

    const isRtl = orientation === 'horizontal' && getComputedStyle(root).direction === 'rtl';
    const move = KEY_MOVES[isRtl ? 'horizontalRtl' : orientation][event.key];
    if (!move) return;

    const items = Array.from(root.querySelectorAll<HTMLButtonElement>(ITEM_SELECTOR));
    const current = items.indexOf(event.target as HTMLButtonElement);
    if (current === -1) return;

    event.preventDefault();
    items[move(current, items.length)]?.focus();
  };

  return (
    <ToggleGroupContext.Provider value={context}>
      <div
        {...rest}
        ref={rootRef}
        role="group"
        aria-label={label ?? ariaLabelProp}
        aria-disabled={disabled || undefined}
        data-ui="toggle-group-root"
        data-type={type}
        data-orientation={orientation}
        onKeyDown={handleKeyDown}
        css={[rootStyle, rootOrientationStyles[orientation]]}
      />
    </ToggleGroupContext.Provider>
  );
});

const Item = forwardRef<HTMLButtonElement, ToggleGroupItemProps>(function ToggleGroupItem(
  { value, disabled: disabledProp, onClick, onFocus, ...rest },
  ref,
) {
  const { pressed, toggle, focused, setFocused, disabled: groupDisabled } = useToggleGroupContext('Item');
  const disabled = groupDisabled || disabledProp;
  const isPressed = pressed.includes(value);
  const isTabStop = !disabled && (focused !== null ? focused === value : pressed[0] === value);

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    onClick?.(event);
    if (event.defaultPrevented) return;
    toggle(value);
  };

  const handleFocus = (event: FocusEvent<HTMLButtonElement>) => {
    onFocus?.(event);
    setFocused(value);
  };

  return (
    <button
      {...rest}
      ref={ref}
      type="button"
      aria-pressed={isPressed}
      data-ui="toggle-group-item"
      data-value={value}
      data-state={isPressed ? 'on' : 'off'}
      tabIndex={isTabStop ? 0 : -1}
      disabled={disabled}
      onClick={handleClick}
      onFocus={handleFocus}
      css={itemStyle}
    />
  );
});

export const ToggleGroup = Object.assign(Root, { Item });
