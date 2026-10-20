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
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type ComponentType,
  type ReactNode,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type SerializedStyles, type Theme } from '../../styling/css';
import { focusRingInset } from '../../styling/focus-ring';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import { WithSx, type SxProps } from '../../styling/sx';
import { findByValue, moveRovingFocus, queryOwnedItems, type OwnedItemsQuery } from '../../utils/roving-focus';
import { useControlledState } from '../../utils/use-controlled-state';

export type ToggleGroupType = 'single' | 'multiple';
export type ToggleGroupOrientation = 'horizontal' | 'vertical';

type ToggleGroupValue = string | string[];

interface ToggleGroupBaseProps extends Omit<ComponentPropsWithRef<'div'>, 'onChange' | 'defaultValue'>, SxProps {
  /** Sets item layout and arrow-key navigation. Defaults to `horizontal`. */
  orientation?: ToggleGroupOrientation;
  /** Disables every item. Defaults to `false`. */
  disabled?: boolean;
  /** Allows clearing the pressed item in single mode to `''`. Defaults to `false`; ignored in multiple mode. */
  allowEmpty?: boolean;
  /** Names the group, taking precedence over `aria-label`. */
  label?: string;
}

export interface ToggleGroupSingleProps extends ToggleGroupBaseProps {
  /** Allows one pressed item at a time. Defaults to `single`. */
  type?: 'single';
  /** Controls the pressed item; `''` leaves every item unpressed. */
  value?: string;
  /** Initial uncontrolled pressed item. Defaults to no selection. */
  defaultValue?: string;
  /** Requests the pressed item's value, or `''` when cleared with `allowEmpty`. */
  onValueChange?: (value: string) => void;
}

export interface ToggleGroupMultipleProps extends ToggleGroupBaseProps {
  /** Allows items to be pressed and cleared independently. */
  type: 'multiple';
  /** Controls the pressed item values. */
  value?: string[];
  /** Initial uncontrolled pressed values. Defaults to no selection. */
  defaultValue?: string[];
  /** Requests pressed values in the order they were selected. */
  onValueChange?: (value: string[]) => void;
}

export interface ToggleGroupOption {
  value: string;
  label: ReactNode;
  disabled?: boolean;
  id?: string;
}
export interface ToggleGroupSlots {
  /** Container wrapping the group and its items. */
  root?: ComponentType<ComponentPropsWithRef<'div'>>;
  /** Button toggling one option. */
  item?: ComponentType<ToggleGroupItemProps>;
}
export interface ToggleGroupSlotProps {
  /** Container wrapping the group and its items. */
  root?: Omit<ComponentPropsWithRef<'div'>, 'children' | 'defaultValue' | 'onChange'> & SxProps & {

    [attribute: `data-${string}`]: unknown;
  };
  /** Button toggling one option. */
  item?: Omit<ToggleGroupItemProps, 'value' | 'children' | 'disabled' | 'id'>;
}
type ToggleGroupComposition =
  | {
      options?: never;
      /** Supplies compound `ToggleGroup.Item` elements instead of `options`. */
      children?: ReactNode;
      component?: never;
      slots?: never;
      slotProps?: never;
    }
  | {
      /** Generates items from nonempty values, labels and optional disabled states. */
      options: readonly ToggleGroupOption[];
      children?: never;
      /** Replaces the generated root; `slots.root` takes precedence. */
      component?: ToggleGroupSlots['root'];
      /** Replaces the generated root and items with components that forward props and refs. */
      slots?: ToggleGroupSlots;
      /** Supplies attributes and `sx` to the generated root and items. */
      slotProps?: ToggleGroupSlotProps;
    };
export type ToggleGroupCompoundProps = ToggleGroupSingleProps | ToggleGroupMultipleProps;
export type ToggleGroupProps = (Omit<ToggleGroupSingleProps, 'children'> | Omit<ToggleGroupMultipleProps, 'children'>) & ToggleGroupComposition;
export type ToggleGroupEasyProps = Extract<ToggleGroupProps, { options: readonly ToggleGroupOption[] }>;

export interface ToggleGroupItemProps extends Omit<ComponentPropsWithRef<'button'>, 'value'>, SxProps {
  /** Identifies this item in the group's selection; must be nonempty. */
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

const toPressed = (value: ToggleGroupValue | undefined, type: ToggleGroupType): readonly string[] => {
  if (Array.isArray(value)) {
    if (type === 'multiple') return value;
    value = value[0] ?? '';
  }
  return value === undefined || value === '' ? EMPTY : [value];
};

const ITEM_QUERY: OwnedItemsQuery = {
  itemSelector: '[data-ui="toggle-group-item"]:not([disabled])',
  ownerSelector: '[data-ui="toggle-group-root"]',
};

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
    ...focusRingInset,
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

function ToggleGroupRoot({
  rootElement: Root = 'div',
  slotStyles,
  ref,
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
  className,
  sx,
  ...rest
}: ToggleGroupCompoundProps & { rootElement?: 'div' | ToggleGroupSlots['root']; slotStyles?: Interpolation<Theme> }) {
  // `toggle` only emits the shape that matches `type`, so either callback accepts it.
  const [value, setValue] = useControlledState<ToggleGroupValue>(
    valueProp,
    defaultValue,
    onValueChange as ((value: ToggleGroupValue) => void) | undefined,
  );
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
    const items = queryOwnedItems(root, ITEM_QUERY);
    if (items.length === 0) return;
    if (items.some((item) => item.tabIndex === 0)) return;
    const firstPressed = items.find((item) => item.getAttribute('aria-pressed') === 'true');
    setFocused((firstPressed ?? findByValue(items, focused) ?? items[0])?.dataset.value ?? null);
  });

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    const root = rootRef.current;
    if (event.defaultPrevented || !root) return;
    moveRovingFocus(event, root, orientation, ITEM_QUERY);
  };

  return (
    <ToggleGroupContext.Provider value={context}>
      <WithSx className={className} styles={[rootStyle, rootOrientationStyles[orientation], slotStyles]} sx={sx}>
        {(className) => (
          <Root
            {...rest}
            ref={rootRef}
            role="group"
            aria-label={label ?? ariaLabelProp}
            aria-disabled={disabled ? true : (rest['aria-disabled'] as boolean | 'true' | 'false' | undefined)}
            data-ui="toggle-group-root"
            data-type={type}
            data-orientation={orientation}
            onKeyDown={handleKeyDown}
            className={className}
          />
        )}
      </WithSx>
    </ToggleGroupContext.Provider>
  );
}

ToggleGroupRoot.displayName = 'ToggleGroup';

/** Toggle an option within the group's selection. */
function ToggleGroupItem({
  ref,
  value,
  disabled: disabledProp,
  onClick,
  onFocus,
  className,
  sx,
  ...rest
}: ToggleGroupItemProps) {
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
    <WithSx className={className} styles={itemStyle} sx={sx}>
      {(className) => (
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
          className={className}
        />
      )}
    </WithSx>
  );
}

ToggleGroupItem.displayName = 'ToggleGroup.Item';

function ToggleGroupComponent(props: ToggleGroupProps) {
  if (props.options === undefined) return <ToggleGroupRoot {...props} />;
  const { options, component, slots, slotProps, ...rest } = props;
  const { className, style, sx: slotSx, ...rootProps } = slotProps?.root ?? {};
  const Item = slots?.item ?? ToggleGroupItem;
  return (
    <ToggleGroupRoot
      {...rest}
      {...rootProps}
      rootElement={slots?.root ?? component}
      slotStyles={slotSx}
      className={[className, rest.className].filter(Boolean).join(' ') || undefined}
      style={{ ...rest.style, ...style }}
      sx={rest.sx}
    >
      {options.map(({ label, ...option }) => (
        <Item {...slotProps?.item} {...option} key={option.value}>
          {label}
        </Item>
      ))}
    </ToggleGroupRoot>
  );
}
ToggleGroupComponent.displayName = 'ToggleGroup';
export const ToggleGroup = Object.assign(ToggleGroupComponent, { Item: ToggleGroupItem });
