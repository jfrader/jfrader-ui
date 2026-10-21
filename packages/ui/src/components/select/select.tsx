'use client';
// APG pattern: select-only combobox. The trigger is a <button role="combobox"> with
// aria-haspopup="listbox", aria-expanded and (while open) aria-controls; the popup is a
// role="listbox" of role="option" items.
// Virtual focus: DOM focus never leaves the trigger. The active option is exposed through
// aria-activedescendant (useListNavigation with `virtual: true`), so there is no focus manager.
// Keyboard map, closed: Enter/Space/ArrowDown open on the selected option (first enabled when
// nothing is selected); ArrowUp opens on the selected option (last enabled when nothing is
// selected); printable characters open on the next prefix-matching enabled option without
// changing the value. Select owns the 500ms buffer, which persists across opening.
// Keyboard map, open: ArrowDown/ArrowUp move and wrap, skipping disabled options; Home/End jump;
// printable characters extend that same case-insensitive prefix buffer; Enter/Space select
// the active option and close; Escape closes without selecting; Tab closes without selecting
// and lets focus move on.
// Pointer: clicking an option selects it and closes; disabled options stay listed with
// aria-disabled="true" and ignore clicks. Pressing inside the listbox never takes focus from
// the trigger.
// The listbox stays mounted (hidden) while closed so Select.Value and closed-state typeahead
// can read option labels; it is only positioned while open.
// Forms: `name` renders a hidden input carrying the selected value. Native constraint
// validation (`required`) is not wired in this version.
import {
  createContext,
  useCallback,
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
  type MutableRefObject,
  type ReactElement,
  type ReactNode,
} from 'react';
import {
  FloatingList,
  useClick,
  useInteractions,
  useListNavigation,
  useMergeRefs,
  useRole,
  type Placement,
  type UseInteractionsReturn,
} from '@floating-ui/react';
import { vars } from '@jfrader/tokens/vars';
import { animate, MotionConfig } from 'motion/react';
import { useReducedMotion } from '../../utils/use-reduced-motion';
import { css } from '../../styling/css';
import {
  listboxItemStateStyle,
  listboxItemStyle,
  listboxOptionCheckStyle,
  listboxOptionStyle,
  listboxOptionTextStyle,
  listboxScrollStyle,
  listboxSurfaceStyle,
} from '../../styling/listbox-style';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import { WithSx, type SxProps } from '../../styling/sx';
import { triggerStyle } from '../../styling/trigger-style';
import { visuallyHiddenStyle } from '../../styling/visually-hidden';
import { fieldColumnStyle, type FieldLabelPlacement } from '../field/field-anatomy';
import { OverlayLayer, useLayerDismiss } from '../../overlay/overlay-layer';
import { OverlayPortal } from '../../overlay/overlay-portal';
import { useOverlayFloating } from '../../overlay/use-overlay-floating';
import {
  collectionItemId,
  useCollectionItem,
  useCollectionRegistry,
  type CollectionRegistration,
} from '../../utils/collection-registry';
import { isRenderable } from '../../utils/renderable';
import { useControlledState } from '../../utils/use-controlled-state';
import { useFormReset } from '../../utils/use-form-reset';

const TYPEAHEAD_RESET_MS = 500;
const TYPEAHEAD_COLLATOR = new Intl.Collator(undefined, { usage: 'search', sensitivity: 'base' });
const SELECTED_GLYPH = '✓';
const MORPH_SPRING = { type: 'spring', stiffness: 360, damping: 36 } as const;
const morphTriggerStyle = css({
  borderRadius: vars.radius.full,
});
const morphPanelStyle = css({
  transformOrigin: '0 0',
  borderRadius: vars.radius.lg,
});

export interface SelectOption<V extends string = string> {
  value: V;
  label: ReactNode;
  disabled?: boolean;
  textValue?: string;
  id?: string;
}

export type SelectSize = 'sm' | 'md' | 'lg';

export interface SelectTriggerProps extends ComponentPropsWithRef<'button'>, SxProps {
  /** Native id of the trigger. */
  id?: string;
  /** Sets the trigger height and text size. Defaults to `md`. */
  size?: SelectSize;
}
export interface SelectValueProps extends ComponentPropsWithRef<'span'>, SxProps {
  /** Shown when no option matches the selected value. */
  placeholder?: ReactNode;
}
export interface SelectContentProps extends ComponentPropsWithRef<'div'>, SxProps {}
export interface SelectItemProps extends ComponentPropsWithRef<'div'>, SxProps {
  /** Unique within the select. */
  value: string;
  /** Keeps the option visible but prevents selection and keyboard activation. Defaults to `false`. */
  disabled?: boolean;
  /** Supplies plain text for typeahead matching when the option content is not plain text. */
  textValue?: string;
}
export interface SelectLabelProps extends ComponentPropsWithRef<'label'>, SxProps {}
export interface SelectDescriptionProps extends ComponentPropsWithRef<'span'>, SxProps {}
export interface SelectErrorProps extends ComponentPropsWithRef<'span'>, SxProps {}
export interface SelectEmptyProps extends ComponentPropsWithRef<'div'>, SxProps {}

export interface SelectSlots {
  /** Container element wrapping the select field. */
  root?: ComponentType<ComponentPropsWithRef<'div'>>;
  /** Label element associated with the select. Default: `Select.Label`. */
  label?: ComponentType<SelectLabelProps>;
  /** Helper text element displayed below or above the trigger. Default: `Select.Description`. */
  description?: ComponentType<SelectDescriptionProps>;
  /** Validation error message element displayed when invalid. Default: `Select.Error`. */
  error?: ComponentType<SelectErrorProps>;
  /** Button trigger that opens the select dropdown. Default: `Select.Trigger`. */
  trigger?: ComponentType<SelectTriggerProps>;
  /** Text container displaying the selected option label. Default: `Select.Value`. */
  value?: ComponentType<SelectValueProps>;
  /** Floating popup panel holding the options list. Default: `Select.Content`. */
  content?: ComponentType<SelectContentProps>;
  /** Selectable option item within the list. Default: `Select.Item`. */
  item?: ComponentType<SelectItemProps>;
  /** Message container displayed when no options are available. Default: `Select.Empty`. */
  empty?: ComponentType<SelectEmptyProps>;
}

export interface SelectSlotProps {
  /** Container element wrapping the select field. */
  root?: ComponentPropsWithRef<'div'> &
    SxProps & {

      [attribute: `data-${string}`]: unknown;
    };
  /** Label element associated with the select. Default: `Select.Label`. */
  label?: Partial<SelectLabelProps>;
  /** Helper text element displayed below or above the trigger. Default: `Select.Description`. */
  description?: Partial<SelectDescriptionProps>;
  /** Validation error message element displayed when invalid. Default: `Select.Error`. */
  error?: Partial<SelectErrorProps>;
  /** Button trigger that opens the select dropdown. Default: `Select.Trigger`. */
  trigger?: Partial<SelectTriggerProps>;
  /** Text container displaying the selected option label. Default: `Select.Value`. */
  value?: Partial<SelectValueProps>;
  /** Floating popup panel holding the options list. Default: `Select.Content`. */
  content?: Partial<SelectContentProps>;
  /** Selectable option item within the list. Default: `Select.Item`. */
  item?: Partial<Omit<SelectItemProps, 'value' | 'id' | 'disabled' | 'textValue'>>;
  /** Message container displayed when no options are available. Default: `Select.Empty`. */
  empty?: Partial<SelectEmptyProps>;
}

export interface SelectStateProps<V extends string = string> {
  /** Controls the selected option value. */
  value?: NoInfer<V>;
  /** Sets the initial uncontrolled selection. Omit to start without a selection. */
  defaultValue?: NoInfer<V>;
  /** Highlight this enabled option on opening when no selected option exists. Typeahead takes precedence. */
  initialActiveValue?: NoInfer<V>;
  /** Fires once per accepted selection with the option's `value`. */
  onValueChange?: (value: V) => void;
}

export interface SelectBaseProps<V extends string = string> extends SelectStateProps<V> {
  /** Morph the pill trigger into the floating panel. Default: `default`. */
  variant?: 'default' | 'morph';
  /** Controls whether the option popup is open. A disabled select stays closed. */
  open?: boolean;
  /** Opens the uncontrolled popup initially. Defaults to `false`. */
  defaultOpen?: boolean;
  /** Receives requests to open or close the option popup. */
  onOpenChange?: (open: boolean) => void;
  /** Positions the popup relative to the trigger. Defaults to `bottom-start`. */
  placement?: Placement;
  /** Prevents opening the popup and selecting options. Defaults to `false`. */
  disabled?: boolean;
  /** Adds a hidden input to submit the value with a native form. */
  name?: string;
}

/** Composed mode declares its own values, so its root state stays a string. */
export interface SelectComposedProps extends SelectBaseProps<string> {
  options?: never;
  /** Composes the trigger, value, content and option parts instead of supplying `options`. */
  children?: ReactNode;
  label?: never;
  labelPlacement?: never;
  description?: never;
  error?: never;
  placeholder?: never;
  size?: never;
  empty?: never;
  slots?: never;
  component?: never;
  slotProps?: never;
}

/** Shorthand mode infers `V` from `options`, narrowing selection state and callbacks to those values. */
export interface SelectShorthandProps<V extends string = string> extends SelectBaseProps<V> {
  /** Supplies the options rendered by the shorthand select. */
  options: readonly SelectOption<V>[];
  children?: never;
  /** Shows a label associated with the trigger. */
  label?: ReactNode;
  /** Label placement. `hidden` keeps the accessible name without taking layout space. */
  labelPlacement?: FieldLabelPlacement;
  /** Shows helper text associated with the trigger. */
  description?: ReactNode;
  /** Marks the trigger invalid and shows an associated error message. */
  error?: ReactNode;
  /** Shows content in the trigger when no option matches the selected value. */
  placeholder?: ReactNode;
  /** Sets the trigger height and text size. Defaults to `md`. */
  size?: SelectSize;
  /** Shows content in the popup when the options list is empty. */
  empty?: ReactNode;
  /** Replaces select elements with custom components. */
  slots?: SelectSlots;
  /** Replaces the root element. Shorthand for `slots.root`. */
  component?: SelectSlots['root'];
  /** Passes props to the select elements. */
  slotProps?: SelectSlotProps;
}

export type SelectProps<V extends string = string> = SelectComposedProps | SelectShorthandProps<V>;

type OverlayFloating = ReturnType<typeof useOverlayFloating>;

interface OptionRecord {
  index: number;
  label: string;
  disabled: boolean;
  textValue?: string;
}

interface TriggerLabelling {
  id: string;
  labelledBy?: string;
  label?: string;
}

interface SelectContextValue {
  variant: 'default' | 'morph';
  positioned: boolean;
  baseId: string;
  labelId: string | undefined;
  setLabelId: (id: string | undefined) => void;
  descriptionId: string | undefined;
  setDescriptionId: (id: string | undefined) => void;
  errorId: string | undefined;
  setErrorId: (id: string | undefined) => void;
  open: boolean;
  disabled: boolean;
  selectedValue: string | undefined;
  activeIndex: number | null;
  options: ReadonlyMap<string, OptionRecord>;
  triggerLabelling: TriggerLabelling | null;
  refs: OverlayFloating['refs'];
  floatingStyles: CSSProperties;
  elementsRef: MutableRefObject<Array<HTMLElement | null>>;
  labelsRef: MutableRefObject<Array<string | null>>;
  getReferenceProps: UseInteractionsReturn['getReferenceProps'];
  getFloatingProps: UseInteractionsReturn['getFloatingProps'];
  getItemProps: UseInteractionsReturn['getItemProps'];
  selectValue: (value: string) => void;
  resetValue: () => void;
  selectIndex: (index: number) => void;
  matchTypeahead: (search: string) => void;
  requestOpenChange: (open: boolean) => void;
  registration: CollectionRegistration<OptionRecord>;
  setTriggerLabelling: (labelling: TriggerLabelling | null) => void;
}

const SelectContext = createContext<SelectContextValue | null>(null);
// Set by Select.Content: items may only render inside it (they register with its FloatingList).
const SelectContentContext = createContext(false);

function useSelectContext(part: string): SelectContextValue {
  const context = useContext(SelectContext);
  if (!context) throw new Error(`Select.${part} must be rendered inside <Select>.`);
  return context;
}

function useSelectItemContext(): SelectContextValue {
  const context = useSelectContext('Item');
  if (!useContext(SelectContentContext)) throw new Error('Select.Item must be rendered inside <Select.Content>.');
  return context;
}

const selectTriggerStyle = css({
  justifyContent: 'flex-start',
  gap: vars.space[2],
  minInlineSize: '180px',
  maxInlineSize: '100%',
  '&[aria-expanded="true"]': {
    backgroundColor: vars.color.surfaceHover,
  },
});

// The trigger is a button, so it needs its own disclosure mark: a small CSS triangle pinned to
// the inline end. It rotates while open and disappears under reduced motion.
const selectCaretStyle = css({
  '&::after': {
    content: '""',
    flexShrink: 0,
    inlineSize: 0,
    blockSize: 0,
    marginInlineStart: 'auto',
    borderInline: `${vars.space[1]} solid transparent`,
    borderBlockStart: `${vars.space[1]} solid ${vars.color.textMuted}`,
    transitionProperty: 'transform',
    transitionDuration: vars.motion.duration.base,
    transitionTimingFunction: vars.motion.easeStandard,
  },
  '&[aria-expanded="true"]::after': { transform: 'rotate(180deg)' },
  [REDUCED_MOTION]: { '&::after': { transitionDuration: '0s' } },
  [FORCED_COLORS]: {
    '&::after': { forcedColorAdjust: 'none', borderBlockStartColor: 'CanvasText' },
  },
});

const triggerSizes = {
  sm: css({ minBlockSize: vars.space[8] }),
  md: css({ minBlockSize: vars.space[10] }),
  lg: css({ minBlockSize: vars.space[12] }),
};

const valueStyle = css({
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  '&[data-placeholder]': {
    color: vars.color.textMuted,
  },
});

const selectOptionTextStyle = css({
  overflowWrap: 'anywhere',
});

const selectLabelStyle = css({
  display: 'inline-flex',
  gap: vars.space[1],
  fontFamily: vars.font.sans,
  fontSize: vars.textSize.sm,
  fontWeight: vars.fontWeight.medium,
  color: vars.color.text,
  cursor: 'pointer',
});

const selectDescriptionStyle = css({
  fontFamily: vars.font.sans,
  fontSize: vars.textSize.sm,
  color: vars.color.textMuted,
});

const selectErrorStyle = css({
  fontFamily: vars.font.sans,
  fontSize: vars.textSize.sm,
  color: vars.color.dangerText,
});

const selectEmptyStyle = css({
  paddingBlock: vars.space[1],
  paddingInline: vars.space[2],
  fontSize: vars.textSize.sm,
  color: vars.color.textMuted,
});

const mergeIds = (...ids: Array<string | undefined>) => ids.filter(Boolean).join(' ') || undefined;
const tokens = (...values: Array<unknown>): string | undefined => {
  const list = [...new Set(values.flatMap((v) => (typeof v === 'string' ? v.split(/\s+/) : [])))].filter(Boolean);
  return list.join(' ') || undefined;
};

function SelectOverlay<V extends string = string>({ nodeId, ...props }: SelectProps<V> & { nodeId: string | undefined }) {
  const {
    variant = 'default',
    value: valueProp,
    defaultValue,
    initialActiveValue,
    onValueChange,
    open: openProp,
    defaultOpen = false,
    onOpenChange,
    placement = 'bottom-start',
    disabled = false,
    name,
  } = props;
  const baseId = useId();
  const [labelId, setLabelId] = useState<string>();
  const [descriptionId, setDescriptionId] = useState<string>();
  const [errorId, setErrorId] = useState<string>();
  // Options only carry `V`; composed children carry strings. The internal store stays a string and
  // this single boundary widens the emit, so the public callback keeps the option union.
  const notifyValueChange = useCallback((next: string) => {
    (onValueChange as ((value: string) => void) | undefined)?.(next);
  }, [onValueChange]);
  const [selectedValue, requestValueChange, resetValue] = useControlledState<string>(valueProp, defaultValue, notifyValueChange);
  const [openState = false, requestOpen] = useControlledState<boolean>(openProp, defaultOpen, onOpenChange);
  const open = openState && !disabled;
  const requestOpenChange = useCallback((next: boolean) => {
    if (next && disabled) return;
    requestOpen(next);
  }, [disabled, requestOpen]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  // Typeahead on the closed trigger opens on the match, not on the selected option.
  const [openedByTypeahead, setOpenedByTypeahead] = useState(false);
  const [options, registration] = useCollectionRegistry<OptionRecord>();
  const [triggerLabelling, setTriggerLabelling] = useState<TriggerLabelling | null>(null);
  const elementsRef = useRef<Array<HTMLElement | null>>([]);
  const labelsRef = useRef<Array<string | null>>([]);
  const virtualItemRef = useRef<HTMLElement | null>(null);

  // Closed (including a rejected typeahead open): drop the pending typeahead navigation.
  if (!open && openedByTypeahead) {
    setOpenedByTypeahead(false);
    setActiveIndex(null);
  }

  const { valuesByIndex, disabledIndices } = useMemo(() => {
    const values: Array<string | undefined> = [];
    const disabledSet = new Set<number>();
    options.forEach((record, value) => {
      if (record.index === -1) return;
      values[record.index] = value;
      if (record.disabled) disabledSet.add(record.index);
    });
    return { valuesByIndex: values, disabledIndices: disabledSet };
  }, [options]);

  const selectedRecord = selectedValue === undefined ? undefined : options.get(selectedValue);
  const selectedIndex = selectedRecord && selectedRecord.index !== -1 ? selectedRecord.index : null;
  const initialRecord = initialActiveValue === undefined ? undefined : options.get(initialActiveValue);
  const initialIndex = initialRecord && !initialRecord.disabled && initialRecord.index !== -1 ? initialRecord.index : null;

  const { refs, floatingStyles, context, isPositioned } = useOverlayFloating({
    nodeId,
    open,
    placement,
    transform: variant !== 'morph',
    gap: variant === 'morph' ? 0 : undefined,
    onOpenChange: (next) => requestOpenChange(next),
  });

  const click = useClick(context, { enabled: !disabled });
  const role = useRole(context, { role: 'listbox' });
  const dismiss = useLayerDismiss(context, 'container');
  const listNavigation = useListNavigation({ ...context, open: open && valuesByIndex.length > 0 }, {
    enabled: !disabled,
    listRef: elementsRef,
    activeIndex,
    onNavigate: setActiveIndex,
    virtual: true,
    virtualItemRef,
    scrollItemIntoView: false,
    loop: true,
    // Pointer opens also highlight the selected option (or the first enabled one).
    focusItemOnOpen: true,
    selectedIndex: openedByTypeahead ? null : selectedIndex ?? initialIndex,
    disabledIndices: (index) => disabledIndices.has(index),
  });
  const { getReferenceProps, getFloatingProps, getItemProps } = useInteractions([
    click,
    role,
    ...dismiss,
    listNavigation,
  ]);

  const value = useMemo<SelectContextValue>(() => {
    const selectValue = (next: string) => {
      if (disabled) return;
      // Value and open are independent requests: selection closes an uncontrolled list.
      // A controlled parent decides each axis; rejecting the value does not cancel the close.
      requestValueChange(next);
      requestOpenChange(false);
    };
    return {
      variant,
      positioned: isPositioned,
      baseId,
      labelId,
      setLabelId,
      descriptionId,
      setDescriptionId,
      errorId,
      setErrorId,
      open,
      disabled,
      selectedValue,
      activeIndex: disabled ? null : activeIndex,
      options,
      triggerLabelling,
      refs,
      floatingStyles,
      elementsRef,
      labelsRef,
      getReferenceProps,
      getFloatingProps,
      getItemProps,
      selectValue,
      resetValue,
      matchTypeahead: (search) => {
        if (disabled) return;
        const labels = labelsRef.current;
        const start = activeIndex ?? -1;
        for (let offset = 1; offset <= labels.length; offset += 1) {
          const index = (start + offset) % labels.length;
          const val = valuesByIndex[index];
          const record = val === undefined ? undefined : options.get(val);
          const candidate = record?.textValue ?? record?.label ?? labels[index];
          if (candidate === null || candidate === undefined || disabledIndices.has(index)) continue;
          if (TYPEAHEAD_COLLATOR.compare(candidate.slice(0, search.length), search) !== 0) continue;
          setActiveIndex(index);
          if (!open) {
            setOpenedByTypeahead(true);
            requestOpenChange(true);
          }
          return;
        }
      },
      selectIndex: (index) => {
        const next = valuesByIndex[index];
        if (next === undefined || disabledIndices.has(index)) return;
        selectValue(next);
      },
      requestOpenChange,
      registration,
      setTriggerLabelling,
    };
  }, [
    variant,
    isPositioned,
    baseId,
    labelId,
    descriptionId,
    errorId,
    open,
    disabled,
    selectedValue,
    activeIndex,
    options,
    triggerLabelling,
    refs,
    floatingStyles,
    getReferenceProps,
    getFloatingProps,
    getItemProps,
    valuesByIndex,
    disabledIndices,
    requestValueChange,
    resetValue,
    requestOpenChange,
    registration,
  ]);

  let renderedContent: ReactNode;
  if ('options' in props && props.options !== undefined) {
    const {
      options: optionsList,
      label,
      labelPlacement = 'above',
      description,
      error,
      placeholder,
      size = 'md',
      empty,
      slots,
      component,
      slotProps,
    } = props;
    const LabelPart = slots?.label ?? SelectLabel;
    const TriggerPart = slots?.trigger ?? SelectTrigger;
    const ValuePart = slots?.value ?? SelectValue;
    const ContentPart = slots?.content ?? SelectContent;
    const ItemPart = slots?.item ?? SelectItem;
    const DescriptionPart = slots?.description ?? SelectDescription;
    const ErrorPart = slots?.error ?? SelectError;
    const EmptyPart = slots?.empty ?? SelectEmpty;
    const RootPart = slots?.root ?? component ?? 'div';
    const {
      className: rootClassName,
      sx: rootSx,
      'data-ui': rootDataUi,
      ...rootRest
    } = slotProps?.root ?? {};

    const hasFieldAnatomy =
      isRenderable(label) ||
      isRenderable(description) ||
      isRenderable(error) ||
      slots?.root !== undefined ||
      component !== undefined ||
      slotProps?.root !== undefined;

    const controlParts = (
      <>
        {isRenderable(label) &&
          (labelPlacement === 'hidden' ? (
            <span css={visuallyHiddenStyle}>
              <LabelPart {...slotProps?.label}>{label}</LabelPart>
            </span>
          ) : (
            <LabelPart {...slotProps?.label}>{label}</LabelPart>
          ))}
        <TriggerPart size={size} {...slotProps?.trigger}>
          <ValuePart placeholder={placeholder} {...slotProps?.value} />
        </TriggerPart>
        {isRenderable(description) && (
          <DescriptionPart {...slotProps?.description}>{description}</DescriptionPart>
        )}
        {isRenderable(error) && <ErrorPart {...slotProps?.error}>{error}</ErrorPart>}
      </>
    );

    renderedContent = (
      <>
        {hasFieldAnatomy ? (
          <WithSx className={rootClassName} styles={[fieldColumnStyle, rootSx]}>
            {(className) => (
              <RootPart
                {...rootRest}
                className={className}
                data-ui={tokens('select', rootDataUi)}
              >
                {controlParts}
              </RootPart>
            )}
          </WithSx>
        ) : (
          controlParts
        )}
        <ContentPart {...slotProps?.content}>
          {optionsList.map((option) => (
            <ItemPart
              key={option.value}
              {...slotProps?.item}
              id={option.id}
              value={option.value}
              disabled={option.disabled}
              textValue={option.textValue}
            >
              {option.label}
            </ItemPart>
          ))}
          <EmptyPart {...slotProps?.empty}>{empty}</EmptyPart>
        </ContentPart>
      </>
    );
  } else {
    renderedContent = props.children;
  }

  return (
    <SelectContext.Provider value={value}>
      {renderedContent}
      {name !== undefined && <input type="hidden" name={name} value={selectedValue ?? ''} disabled={disabled} />}
    </SelectContext.Provider>
  );
}

function SelectRoot(props: SelectProps) {
  return (
    <MotionConfig reducedMotion="user">
      <OverlayLayer>
        {(nodeId) => <SelectOverlay {...props} nodeId={nodeId} />}
      </OverlayLayer>
    </MotionConfig>
  );
}

SelectRoot.displayName = 'Select';

/** Open the option list and handle keyboard selection. */
function SelectTrigger({
  ref,
  id: idProp,
  size = 'md',
  disabled: disabledProp,
  onKeyDown,
  className,
  sx,
  ...rest
}: SelectTriggerProps) {
  const {
    baseId,
    labelId,
    descriptionId,
    errorId,
    open,
    variant,
    disabled,
    activeIndex,
    refs,
    getReferenceProps,
    selectIndex,
    resetValue,
    matchTypeahead,
    requestOpenChange,
    setTriggerLabelling,
  } = useSelectContext('Trigger');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const mergedRef = useMergeRefs([triggerRef, refs.setReference, ref]);
  useFormReset(triggerRef, resetValue, rest.form);
  const typeaheadRef = useRef({ search: '', lastKeyAt: 0 });
  const id = idProp ?? `${baseId}-trigger`;
  const labelledBy = mergeIds(rest['aria-labelledby'], labelId);
  const describedBy = mergeIds(rest['aria-describedby'], descriptionId, errorId);
  const label = rest['aria-label'];

  // The listbox reuses the trigger's label so both share one accessible name.
  useLayoutEffect(() => {
    setTriggerLabelling({ id, labelledBy, label });
    return () => setTriggerLabelling(null);
  }, [id, labelledBy, label, setTriggerLabelling]);

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented || disabled || disabledProp) return;
    if (event.key.length === 1 && event.key !== ' ' && !event.ctrlKey && !event.altKey && !event.metaKey) {
      const now = performance.now();
      const previous = typeaheadRef.current;
      const search = (now - previous.lastKeyAt > TYPEAHEAD_RESET_MS ? '' : previous.search) + event.key;
      typeaheadRef.current = { search, lastKeyAt: now };
      matchTypeahead(search);
      return;
    }
    if (!open) return;
    if (event.key === 'Tab') {
      requestOpenChange(false);
      return;
    }
    if ((event.key === 'Enter' || event.key === ' ') && activeIndex !== null) {
      // Prevents the native button click, which would toggle the listbox again.
      event.preventDefault();
      selectIndex(activeIndex);
    }
  };

  return (
    <WithSx
      className={className}
      styles={[
        triggerStyle,
        selectTriggerStyle,
        selectCaretStyle,
        triggerSizes[size],
        variant === 'morph' && morphTriggerStyle,
      ]}
      sx={sx}
    >
      {(className) => (
        <button
          type="button"
          {...getReferenceProps({ ...rest, id, disabled: disabled || disabledProp, onKeyDown: handleKeyDown })}
          ref={mergedRef}
          aria-labelledby={labelledBy}
          aria-describedby={describedBy}
          aria-invalid={errorId ? true : rest['aria-invalid']}
          data-state={open ? 'open' : 'closed'}
          data-ui="select-trigger"
          data-variant={variant}
          className={className}
        />
      )}
    </WithSx>
  );
}

SelectTrigger.displayName = 'Select.Trigger';

function SelectValue({ ref, placeholder, className, sx, ...rest }: SelectValueProps) {
  const { selectedValue, options } = useSelectContext('Value');
  const label = selectedValue === undefined ? undefined : options.get(selectedValue)?.label;
  const isPlaceholder = label === undefined;

  return (
    <WithSx className={className} styles={valueStyle} sx={sx}>
      {(className) => (
        <span
          {...rest}
          ref={ref}
          data-placeholder={isPlaceholder || undefined}
          data-ui="select-value"
          className={className}
        >
          {isPlaceholder ? placeholder : label}
        </span>
      )}
    </WithSx>
  );
}

SelectValue.displayName = 'Select.Value';

function SelectContent({ ref, style, onMouseDown, children, className, sx, ...rest }: SelectContentProps) {
  const { open, activeIndex, variant, positioned, triggerLabelling, refs, floatingStyles, elementsRef, getFloatingProps } = useSelectContext('Content');
  const reduced = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const [exiting, setExiting] = useState(false);
  const wasOpen = useRef(false);
  const morphAnimation = useRef<ReturnType<typeof animate> | null>(null);
  const collapsedTransform = useRef('');
  const lastPosition = useRef(floatingStyles);
  const morph = variant === 'morph';
  const visible = open || (morph && (exiting || wasOpen.current) && !reduced);
  // Only an open listbox is the floating element, so a closed one does no positioning work.
  const mergedRef = useMergeRefs([open ? refs.setFloating : null, panelRef, ref]);
  const centered = useRef(false);

  useLayoutEffect(() => {
    if (!open) centered.current = false;
    const panel = panelRef.current;
    if (!open || !positioned || !panel || activeIndex === null) return;
    const option = elementsRef.current[activeIndex];
    if (!option) return;
    const scrollActive = () => {
      const view = panel.ownerDocument.defaultView;
      if (!view || !panel.clientHeight) return;
      const styles = view.getComputedStyle(panel);
      const start = Number.parseFloat(styles.scrollPaddingTop) || 0;
      const end = Number.parseFloat(styles.scrollPaddingBottom) || 0;
      const panelRect = panel.getBoundingClientRect();
      const scale = panelRect.height / panel.offsetHeight || 1;
      const optionRect = option.getBoundingClientRect();
      const top = (optionRect.top - panelRect.top) / scale - panel.clientTop;
      const bottom = top + option.offsetHeight;
      if (!centered.current) {
        panel.scrollTop += top - start - (panel.clientHeight - start - end - option.offsetHeight) / 2;
        centered.current = true;
      } else if (top < start) panel.scrollTop += top - start;
      else if (bottom > panel.clientHeight - end) panel.scrollTop += bottom - panel.clientHeight + end;
    };
    scrollActive();
    const observer = new ResizeObserver(scrollActive);
    observer.observe(panel);
    return () => observer.disconnect();
  }, [open, positioned, activeIndex, elementsRef]);

  useLayoutEffect(() => {
    if (open) lastPosition.current = floatingStyles;
    const panel = panelRef.current;
    const trigger = refs.domReference.current;
    if (!panel || !trigger) return;
    panel.dir = rest.dir ?? trigger.ownerDocument.defaultView?.getComputedStyle(trigger).direction ?? 'ltr';
    if (!morph || reduced) {
      morphAnimation.current?.stop();
      wasOpen.current = open;
      setExiting(false);
      panel.style.transform = morph ? '' : floatingStyles.transform ?? style?.transform ?? '';
      panel.style.borderRadius = '';
      return;
    }
    if (open && !positioned) return;
    if (open && wasOpen.current) return;
    if (!open && !wasOpen.current) return;
    morphAnimation.current?.stop();
    const triggerRect = trigger.getBoundingClientRect();
    const panelRect = { width: panel.offsetWidth, height: panel.offsetHeight };
    const left = Number.parseFloat(String(floatingStyles.left)) || 0;
    const top = Number.parseFloat(String(floatingStyles.top)) || 0;
    const offsetParent = panel.offsetParent;
    const parentRect = offsetParent instanceof HTMLElement ? offsetParent.getBoundingClientRect() : null;
    const x = triggerRect.left - (parentRect?.left ?? 0) - left;
    const y = triggerRect.top - (parentRect?.top ?? 0) - top;
    const collapsed = `translate(${x}px, ${y}px) scale(${triggerRect.width / (panelRect.width || 1)}, ${triggerRect.height / (panelRect.height || 1)})`;
    if (open) collapsedTransform.current = collapsed;
    const expanded = 'translate(0px, 0px) scale(1, 1)';
    panel.style.borderRadius = '';
    const expandedRadius = trigger.ownerDocument.defaultView?.getComputedStyle(panel).borderRadius ?? '0px';
    const opening = open;
    wasOpen.current = open;
    setExiting(!open);
    morphAnimation.current = animate(panel, {
      transform: opening ? [collapsed, expanded] : [panel.style.transform || expanded, collapsedTransform.current],
      borderRadius: opening ? [`${triggerRect.height / 2}px`, expandedRadius] : [expandedRadius, `${triggerRect.height / 2}px`],
    }, { ...MORPH_SPRING, onComplete: () => { if (!opening) setExiting(false); } });
  }, [open, positioned, morph, reduced, refs, floatingStyles.left, floatingStyles.top, rest.dir]);
  useEffect(() => () => { morphAnimation.current?.stop(); }, []);

  const labelling =
    rest['aria-labelledby'] !== undefined || rest['aria-label'] !== undefined
      ? {}
      : triggerLabelling?.labelledBy !== undefined
        ? { 'aria-labelledby': triggerLabelling.labelledBy }
        : triggerLabelling?.label !== undefined
          ? { 'aria-label': triggerLabelling.label }
          : { 'aria-labelledby': triggerLabelling?.id };

  const handleMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    onMouseDown?.(event);
    // Keeps DOM focus on the trigger: the active option is virtual.
    event.preventDefault();
  };

  return (
    <OverlayPortal>
      <WithSx className={className} styles={[listboxSurfaceStyle, listboxScrollStyle, morph && morphPanelStyle]} sx={sx}>
        {(className) => (
          <div
            {...getFloatingProps({ ...labelling, ...rest, onMouseDown: handleMouseDown })}
            ref={mergedRef}
            hidden={!visible}
            inert={!open ? true : undefined}
            aria-hidden={!open ? true : undefined}
            data-state={open ? 'open' : 'closed'}
            data-ui="select-listbox"
            data-variant={variant}
            style={{ ...style, ...(morph && !open ? lastPosition.current : floatingStyles) }}
            className={className}
          >
            <FloatingList elementsRef={elementsRef}>
              <SelectContentContext.Provider value>{children}</SelectContentContext.Provider>
            </FloatingList>
          </div>
        )}
      </WithSx>
    </OverlayPortal>
  );
}

SelectContent.displayName = 'Select.Content';

function SelectItem({
  ref,
  value,
  id: idProp,
  disabled = false,
  textValue,
  onClick,
  children,
  className,
  sx,
  ...rest
}: SelectItemProps) {
  const { baseId, selectedValue, activeIndex, labelsRef, getItemProps, selectValue, registration } =
    useSelectItemContext();
  const textRef = useRef<HTMLSpanElement>(null);
  const id = idProp ?? collectionItemId(baseId, value);
  // Disabled options stay out of typeahead.
  const { ref: listItemRef, index } = useCollectionItem(
    value,
    registration,
    textRef,
    (itemIndex, label) => ({
      index: itemIndex,
      label,
      disabled,
      textValue,
    }),
    { labelsRef, include: !disabled },
  );
  const mergedRef = useMergeRefs([listItemRef, ref]);
  const isActive = index !== -1 && activeIndex === index;
  const isSelected = selectedValue === value;

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    onClick?.(event);
    if (disabled || event.defaultPrevented) return;
    selectValue(value);
  };

  return (
    <WithSx className={className} styles={[listboxItemStyle, listboxItemStateStyle, listboxOptionStyle]} sx={sx}>
      {(className) => (
        <div
          {...getItemProps({ ...rest, id, onClick: handleClick })}
          ref={mergedRef}
          role="option"
          aria-selected={isSelected}
          aria-disabled={disabled || undefined}
          data-active={isActive || undefined}
          data-ui="select-item"
          className={className}
        >
          <span ref={textRef} css={[listboxOptionTextStyle, selectOptionTextStyle]}>
            {children}
          </span>
          {isSelected && (
            <span aria-hidden="true" css={listboxOptionCheckStyle}>
              {SELECTED_GLYPH}
            </span>
          )}
        </div>
      )}
    </WithSx>
  );
}

SelectItem.displayName = 'Select.Item';

function SelectLabel({ ref, id: idProp, children, className, sx, ...rest }: SelectLabelProps) {
  const { baseId, triggerLabelling, setLabelId } = useSelectContext('Label');
  const id = idProp ?? `${baseId}-label`;
  const present = isRenderable(children);
  useLayoutEffect(() => {
    if (!present) return;
    setLabelId(id);
    return () => setLabelId(undefined);
  }, [id, present, setLabelId]);
  if (!present) return null;
  return (
    <WithSx className={className} styles={selectLabelStyle} sx={sx}>
      {(className) => (
        <label
          htmlFor={triggerLabelling?.id ?? `${baseId}-trigger`}
          {...rest}
          id={id}
          ref={ref}
          data-ui="select-label"
          className={className}
        >
          {children}
        </label>
      )}
    </WithSx>
  );
}

SelectLabel.displayName = 'Select.Label';

function SelectDescription({ ref, id: idProp, children, className, sx, ...rest }: SelectDescriptionProps) {
  const { baseId, setDescriptionId } = useSelectContext('Description');
  const id = idProp ?? `${baseId}-description`;
  const present = isRenderable(children);
  useLayoutEffect(() => {
    if (!present) return;
    setDescriptionId(id);
    return () => setDescriptionId(undefined);
  }, [id, present, setDescriptionId]);
  if (!present) return null;
  return (
    <WithSx className={className} styles={selectDescriptionStyle} sx={sx}>
      {(className) => (
        <span {...rest} id={id} ref={ref} data-ui="select-description" className={className}>
          {children}
        </span>
      )}
    </WithSx>
  );
}

SelectDescription.displayName = 'Select.Description';

function SelectError({ ref, id: idProp, children, className, sx, ...rest }: SelectErrorProps) {
  const { baseId, setErrorId } = useSelectContext('Error');
  const id = idProp ?? `${baseId}-error`;
  const present = isRenderable(children);
  useLayoutEffect(() => {
    if (!present) return;
    setErrorId(id);
    return () => setErrorId(undefined);
  }, [id, present, setErrorId]);
  if (!present) return null;
  return (
    <WithSx className={className} styles={selectErrorStyle} sx={sx}>
      {(className) => (
        <span {...rest} id={id} ref={ref} role="alert" data-ui="select-error" className={className}>
          {children}
        </span>
      )}
    </WithSx>
  );
}

SelectError.displayName = 'Select.Error';

function SelectEmpty({ ref, children, className, sx, ...rest }: SelectEmptyProps) {
  const { options } = useSelectContext('Empty');
  if (options.size > 0) return null;
  const content = children === undefined ? 'No options' : children;
  if (!isRenderable(content)) return null;
  return (
    <WithSx className={className} styles={selectEmptyStyle} sx={sx}>
      {(className) => (
        <div {...rest} ref={ref} data-ui="select-empty" className={className}>
          {content}
        </div>
      )}
    </WithSx>
  );
}

SelectEmpty.displayName = 'Select.Empty';

/** `Object.assign` instantiates the root with its default type argument; this keeps the generic call signature. */
export interface SelectComponent {
  <V extends string = string>(props: SelectShorthandProps<V>): ReactElement;
  (props: SelectComposedProps): ReactElement;
  /** Accepts a pre-built shorthand/composed union, e.g. `SelectProps<Status>` spread into the component. */
  <V extends string = string>(props: SelectProps<V>): ReactElement;
  Trigger: typeof SelectTrigger;
  Value: typeof SelectValue;
  Content: typeof SelectContent;
  Item: typeof SelectItem;
  Label: typeof SelectLabel;
  Description: typeof SelectDescription;
  Error: typeof SelectError;
  Empty: typeof SelectEmpty;
}

export const Select = Object.assign(SelectRoot, {
  Trigger: SelectTrigger,
  Value: SelectValue,
  Content: SelectContent,
  Item: SelectItem,
  Label: SelectLabel,
  Description: SelectDescription,
  Error: SelectError,
  Empty: SelectEmpty,
}) as SelectComponent;
