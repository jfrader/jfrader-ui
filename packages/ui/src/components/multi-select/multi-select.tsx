'use client';

import {
  createContext,
  useContext,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type ComponentType,
  type HTMLProps,
  type KeyboardEvent,
  type KeyboardEventHandler,
  type ReactNode,
} from 'react';
import {
  FloatingList,
  useDismiss,
  useInteractions,
  useListNavigation,
  useMergeRefs,
  useRole,
  type Placement,
} from '@floating-ui/react';
import { vars } from '@jfrader/tokens/vars';
import { css, keyframes, type Interpolation, type Theme } from '../../styling/css';
import { WithSx, type SxProps } from '../../styling/sx';
import { triggerStyle } from '../../styling/trigger-style';
import { visuallyHiddenStyle } from '../../styling/visually-hidden';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import {
  listboxSurfaceStyle,
  listboxScrollStyle,
  listboxItemStyle,
  listboxItemStateStyle,
  listboxOptionStyle,
  listboxOptionTextStyle,
  listboxOptionCheckStyle,
} from '../../styling/listbox-style';
import { IsolatedOverlay } from '../../overlay/overlay-layer';
import { OverlayPortal } from '../../overlay/overlay-portal';
import { useOverlayFloating } from '../../overlay/use-overlay-floating';
import { collectionItemId, useCollectionItem, useCollectionRegistry } from '../../utils/collection-registry';
import { useControlledState } from '../../utils/use-controlled-state';
import { isRenderable } from '../../utils/renderable';

const EMPTY_VALUES: readonly string[] = [];
const TYPEAHEAD_RESET_MS = 500;
export interface MultiSelectMessages {
  clearLabel: string;
  empty: string;
  selected: (labels: readonly string[]) => string;
  toggled: (label: string, selected: boolean) => string;
  required: string;
}
export interface MultiSelectOption {
  value: string;
  label: ReactNode;
  disabled?: boolean;
  textValue?: string;
  id?: string;
}
export interface MultiSelectSlots {
  root?: ComponentType<ComponentPropsWithRef<'div'>>;
  label?: ComponentType<MultiSelectLabelProps>;
  description?: ComponentType<MultiSelectDescriptionProps>;
  error?: ComponentType<MultiSelectErrorProps>;
  trigger?: ComponentType<MultiSelectTriggerProps>;
  value?: ComponentType<MultiSelectValueProps>;
  clear?: ComponentType<MultiSelectClearProps>;
  content?: ComponentType<MultiSelectContentProps>;
  item?: ComponentType<MultiSelectItemProps>;
  empty?: ComponentType<MultiSelectEmptyProps>;
}
export interface MultiSelectSlotProps {
  root?: ComponentPropsWithRef<'div'> &
    SxProps & {
      css?: Interpolation<Theme>;
      [attribute: `data-${string}`]: unknown;
    };
  label?: Partial<MultiSelectLabelProps> & { css?: Interpolation<Theme> };
  description?: Partial<MultiSelectDescriptionProps> & { css?: Interpolation<Theme> };
  error?: Partial<MultiSelectErrorProps> & { css?: Interpolation<Theme> };
  trigger?: Partial<MultiSelectTriggerProps> & { css?: Interpolation<Theme> };
  value?: Partial<MultiSelectValueProps> & { css?: Interpolation<Theme> };
  clear?: Partial<MultiSelectClearProps> & { css?: Interpolation<Theme> };
  content?: Partial<MultiSelectContentProps> & { css?: Interpolation<Theme> };
  item?: Partial<Omit<MultiSelectItemProps, 'value' | 'id' | 'disabled' | 'textValue'>> & { css?: Interpolation<Theme> };
  empty?: Partial<MultiSelectEmptyProps> & { css?: Interpolation<Theme> };
}
export interface MultiSelectBaseProps {
  value?: readonly string[];
  defaultValue?: readonly string[];
  onValueChange?: (value: string[]) => void;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  locale?: Intl.LocalesArgument;
  messages?: Partial<MultiSelectMessages>;
  placement?: Placement;
}
export interface MultiSelectCompoundProps extends MultiSelectBaseProps {
  options?: never;
  children?: ReactNode;
  label?: never;
  description?: never;
  error?: never;
  placeholder?: never;
  maxVisible?: never;
  size?: never;
  clearable?: never;
  empty?: never;
  slots?: never;
  component?: never;
  slotProps?: never;
}
export interface MultiSelectEasyProps extends MultiSelectBaseProps {
  options: readonly MultiSelectOption[];
  children?: never;
  label?: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  placeholder?: ReactNode;
  maxVisible?: number;
  size?: 'sm' | 'md' | 'lg';
  clearable?: boolean;
  empty?: ReactNode;
  slots?: MultiSelectSlots;
  component?: MultiSelectSlots['root'];
  slotProps?: MultiSelectSlotProps;
}
export type MultiSelectProps = MultiSelectCompoundProps | MultiSelectEasyProps;
export interface MultiSelectTriggerProps extends ComponentPropsWithRef<'button'>, SxProps {
  size?: 'sm' | 'md' | 'lg';
}
export interface MultiSelectValueProps extends ComponentPropsWithRef<'span'>, SxProps {
  maxVisible?: number;
  placeholder?: ReactNode;
}
export interface MultiSelectContentProps extends ComponentPropsWithRef<'div'>, SxProps {}
export interface MultiSelectItemProps extends ComponentPropsWithRef<'div'>, SxProps {
  value: string;
  disabled?: boolean;
  textValue?: string;
}
export interface MultiSelectClearProps extends ComponentPropsWithRef<'button'>, SxProps {}
export interface MultiSelectLabelProps extends ComponentPropsWithRef<'label'>, SxProps {}
export interface MultiSelectDescriptionProps extends ComponentPropsWithRef<'span'>, SxProps {}
export interface MultiSelectErrorProps extends ComponentPropsWithRef<'span'>, SxProps {}
export interface MultiSelectEmptyProps extends ComponentPropsWithRef<'div'>, SxProps {}
interface OptionRecord {
  index: number;
  label: string;
  disabled: boolean;
  id: string;
  textValue?: string;
}
interface TriggerName {
  id: string;
  form?: string;
  labelledBy?: string;
  label?: string;
}

const multiSelectFieldStyle = css({
  display: 'inline-flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: vars.space[1],
  maxInlineSize: '100%',
});

const triggerRowStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: vars.space[2],
  maxInlineSize: '100%',
});

const triggerSkin = css({
  minInlineSize: 0,
  maxInlineSize: '100%',
  justifyContent: 'flex-start',
  '&[aria-invalid="true"]': { borderColor: vars.color.dangerText },
});
const sizes = {
  sm: css({ minBlockSize: vars.space[8] }),
  md: css({ minBlockSize: vars.space[10] }),
  lg: css({ minBlockSize: vars.space[12] }),
};
const valueStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: vars.space[1],
  minInlineSize: 0,
  overflow: 'hidden',
  '&[data-placeholder]': { color: vars.color.textMuted },
});
const chipStyle = css({
  borderRadius: vars.radius.full,
  paddingInline: vars.space[2],
  backgroundColor: vars.color.accentSoft,
  color: vars.color.accentText,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  minInlineSize: 0,
  [FORCED_COLORS]: { border: '1px solid CanvasText' },
});
const textStyle = css({
  fontFamily: vars.font.sans,
  fontSize: vars.textSize.sm,
  color: vars.color.text,
});
const errorStyle = css({ color: vars.color.dangerText });
const fade = keyframes({ from: { opacity: 0 }, to: { opacity: 1 } });
const panelStyle = css({
  minInlineSize: 0,
  maxInlineSize: '100vw',
  borderColor: vars.color.borderControl,
  animation: `${fade} ${vars.motion.duration.base} ${vars.motion.easeStandard}`,
  [REDUCED_MOTION]: { animation: 'none' },
  [FORCED_COLORS]: {
    borderColor: 'CanvasText',
    backgroundColor: 'Canvas',
    color: 'CanvasText',
  },
});
const optionStyle = css({
  overflowWrap: 'anywhere',
  [FORCED_COLORS]: { '&[data-active]': { outlineColor: 'Highlight' } },
});
const clearStyle = css({
  minBlockSize: vars.space[6],
  minInlineSize: vars.space[6],
});

function useMultiSelectModel({
  value: valueProp,
  defaultValue = EMPTY_VALUES,
  onValueChange,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  disabled = false,
  required = false,
  locale,
  messages: messagesProp,
  placement = 'bottom-start',
}: MultiSelectProps) {
  const baseId = useId();
  const [listId, setListId] = useState(`${baseId}-listbox`);
  const [direction, setDirection] = useState('ltr');
  const [current = EMPTY_VALUES, requestValue] = useControlledState<readonly string[]>(
    valueProp,
    defaultValue,
    (next) => onValueChange?.([...next]),
  );
  const selected = useMemo(() => [...new Set(current)], [current]);
  const [open = false, requestOpen] = useControlledState(openProp, defaultOpen, onOpenChange);
  const [options, registration] = useCollectionRegistry<OptionRecord>();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [triggerName, setTriggerName] = useState<TriggerName | null>(null);
  const [labelId, setLabelId] = useState<string>();
  const [descriptionId, setDescriptionId] = useState<string>();
  const [errorId, setErrorId] = useState<string>();
  const [invalidAttempt, setInvalidAttempt] = useState(false);
  const [available, setAvailable] = useState({ width: 0, height: 0 });
  const elementsRef = useRef<Array<HTMLElement | null>>([]);
  const labelsRef = useRef<Array<string | null>>([]);
  const proxyRef = useRef<HTMLInputElement>(null);
  const clearRef = useRef<HTMLButtonElement>(null);
  const seed = useRef({ value: [...new Set(defaultValue)], open: defaultOpen });
  const formatters = useMemo(
    () => ({
      list: new Intl.ListFormat(locale),
      number: new Intl.NumberFormat(locale),
      plural: new Intl.PluralRules(locale),
      collator: new Intl.Collator(locale, {
        usage: 'search',
        sensitivity: 'base',
      }),
    }),
    [locale],
  );
  const messages = useMemo<MultiSelectMessages>(
    () => ({
      clearLabel: 'Clear selection',
      empty: 'No options',
      required: 'Select at least one option',
      selected: (labels) =>
        `${formatters.number.format(labels.length)} ${formatters.plural.select(labels.length) === 'one' ? 'option' : 'options'} selected${labels.length ? `: ${formatters.list.format([...labels])}` : ''}`,
      toggled: (label, checked) => `${label} ${checked ? 'selected' : 'deselected'}`,
      ...messagesProp,
    }),
    [formatters, messagesProp],
  );
  const byIndex = useMemo(() => {
    const values: Array<string | undefined> = [];
    options.forEach((record, value) => {
      if (record.index >= 0) values[record.index] = value;
    });
    return values;
  }, [options]);
  const activeValue = activeIndex === null ? undefined : byIndex[activeIndex];
  const activeId =
    open && !disabled && activeValue !== undefined && !options.get(activeValue)?.disabled
      ? options.get(activeValue)?.id
      : undefined;
  const selectedIndex =
    selected
      .map((value) => options.get(value))
      .find((record) => record && !record.disabled && record.index >= 0)?.index ?? null;
  const floating = useOverlayFloating({
    open,
    placement,
    onOpenChange: (next) => {
      if (!disabled) requestOpen(next);
    },
    onAvailableSize: setAvailable,
  });
  const role = useRole(floating.context, { role: 'listbox' });
  const dismiss = useDismiss(floating.context, {
    enabled: !disabled,
    outsidePress: (event) => !clearRef.current?.contains(event.target as Node),
  });
  const navigation = useListNavigation(floating.context, {
    enabled: !disabled,
    listRef: elementsRef,
    activeIndex,
    onNavigate: setActiveIndex,
    virtual: true,
    loop: true,
    selectedIndex,
    focusItemOnOpen: true,
    disabledIndices: (index) => {
      const value = byIndex[index];
      return value === undefined || options.get(value)?.disabled === true;
    },
  });
  const interactions = useInteractions([role, dismiss, navigation]);
  // Floating UI runs hook handlers before the user's; the trigger's own key handling (and any
  // consumer veto) must run first, and navigation/dismissal only for keys it left unhandled.
  const getReferenceProps = ({ onKeyDown, ...userProps }: HTMLProps<HTMLButtonElement> = {}) => {
    const props = interactions.getReferenceProps(userProps);
    const hookKeyDown = props.onKeyDown as KeyboardEventHandler<HTMLButtonElement> | undefined;
    return {
      ...props,
      onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => {
        onKeyDown?.(event);
        if (!event.defaultPrevented && !event.nativeEvent.isComposing) hookKeyDown?.(event);
      },
    };
  };
  const change = (next: readonly string[]) => {
    const unique = [...new Set(next)];
    if (unique.length === selected.length && unique.every((value, index) => value === selected[index]))
      return;
    requestValue(unique);
  };
  const toggle = (value: string) => {
    if (disabled || options.get(value)?.disabled) return;
    change(selected.includes(value) ? selected.filter((entry) => entry !== value) : [...selected, value]);
  };
  useLayoutEffect(() => {
    const proxy = proxyRef.current;
    if (!proxy) return;
    proxy.setCustomValidity(required && !disabled && selected.length === 0 ? messages.required : '');
  }, [required, disabled, selected.length, messages.required]);
  useLayoutEffect(() => {
    const form = proxyRef.current?.form;
    if (!form) return;
    const reset = (event: Event) => {
      queueMicrotask(() => {
        if (event.defaultPrevented) return;
        setInvalidAttempt(false);
        if (valueProp === undefined) change(seed.current.value);
        if (openProp === undefined) requestOpen(seed.current.open);
      });
    };
    form.addEventListener('reset', reset);
    return () => form.removeEventListener('reset', reset);
  });
  useLayoutEffect(() => {
    if (activeId) elementsRef.current[activeIndex!]?.scrollIntoView({ block: 'nearest' });
  }, [activeId, activeIndex]);
  return {
    baseId,
    listId,
    setListId,
    direction,
    setDirection,
    selected,
    open,
    disabled,
    required,
    options,
    registration,
    activeIndex,
    activeId,
    setActiveIndex,
    triggerName,
    setTriggerName,
    labelId,
    setLabelId,
    descriptionId,
    setDescriptionId,
    errorId,
    setErrorId,
    invalid: required && !disabled && invalidAttempt && selected.length === 0,
    setInvalidAttempt,
    available,
    elementsRef,
    labelsRef,
    proxyRef,
    clearRef,
    formatters,
    messages,
    byIndex,
    change,
    toggle,
    requestOpen,
    ...floating,
    ...interactions,
    getReferenceProps,
  };
}
type Model = ReturnType<typeof useMultiSelectModel>;
const Context = createContext<Model | null>(null);
const ContentContext = createContext(false);
function useModel(part: string) {
  const model = useContext(Context);
  if (!model) throw new Error(`MultiSelect.${part} must be rendered inside <MultiSelect>.`);
  return model;
}
const mergeIds = (...ids: Array<string | undefined>) => ids.filter(Boolean).join(' ') || undefined;
const tokens = (...values: Array<unknown>): string | undefined => {
  const list = [...new Set(values.flatMap((v) => (typeof v === 'string' ? v.split(/\s+/) : [])))].filter(Boolean);
  return list.join(' ') || undefined;
};

function MultiSelectOverlay(props: MultiSelectProps) {
  const model = useMultiSelectModel(props);
  const labels = model.selected.map((value) => model.options.get(value)?.label ?? value);
  const previousSelection = useRef(model.selected);
  const [announcement, setAnnouncement] = useState('');
  useLayoutEffect(() => {
    const previous = previousSelection.current;
    if (
      previous.length === model.selected.length &&
      previous.every((value, index) => value === model.selected[index])
    )
      return;
    const changed = [
      ...previous.filter((value) => !model.selected.includes(value)),
      ...model.selected.filter((value) => !previous.includes(value)),
    ];
    const changedValue = changed[0];
    setAnnouncement(
      changed.length === 1 && changedValue !== undefined
        ? model.messages.toggled(
            model.options.get(changedValue)?.label ?? changedValue,
            model.selected.includes(changedValue),
          )
        : model.messages.selected(labels),
    );
    previousSelection.current = model.selected;
  }, [model.selected, model.messages, model.options, labels]);
  let renderedContent: ReactNode;
  if ('options' in props && props.options !== undefined) {
    const {
      options: optionsList,
      label,
      description,
      error,
      placeholder,
      maxVisible,
      size,
      clearable,
      empty,
      slots,
      component,
      slotProps,
    } = props;
    const LabelPart = slots?.label ?? MultiSelectLabel;
    const TriggerPart = slots?.trigger ?? MultiSelectTrigger;
    const ValuePart = slots?.value ?? MultiSelectValue;
    const ClearPart = slots?.clear ?? MultiSelectClear;
    const ContentPart = slots?.content ?? MultiSelectContent;
    const ItemPart = slots?.item ?? MultiSelectItem;
    const EmptyPart = slots?.empty ?? MultiSelectEmpty;
    const DescriptionPart = slots?.description ?? MultiSelectDescription;
    const ErrorPart = slots?.error ?? MultiSelectError;
    const RootPart = slots?.root ?? component ?? 'div';
    const {
      className: rootClassName,
      css: rootCss,
      sx: rootSx,
      'data-ui': rootDataUi,
      ...rootRest
    } = slotProps?.root ?? {};

    const hasFieldAnatomy =
      isRenderable(label) ||
      isRenderable(description) ||
      isRenderable(error) ||
      clearable ||
      slots?.root !== undefined ||
      component !== undefined ||
      slotProps?.root !== undefined;

    const controlRow = clearable ? (
      <div css={triggerRowStyle}>
        <TriggerPart size={size} {...slotProps?.trigger}>
          <ValuePart placeholder={placeholder} maxVisible={maxVisible} {...slotProps?.value} />
        </TriggerPart>
        <ClearPart {...slotProps?.clear} />
      </div>
    ) : (
      <TriggerPart size={size} {...slotProps?.trigger}>
        <ValuePart placeholder={placeholder} maxVisible={maxVisible} {...slotProps?.value} />
      </TriggerPart>
    );

    const controlParts = (
      <>
        {isRenderable(label) && <LabelPart {...slotProps?.label}>{label}</LabelPart>}
        {controlRow}
        {isRenderable(description) && (
          <DescriptionPart {...slotProps?.description}>{description}</DescriptionPart>
        )}
        {isRenderable(error) && <ErrorPart {...slotProps?.error}>{error}</ErrorPart>}
      </>
    );

    renderedContent = (
      <>
        {hasFieldAnatomy ? (
          <WithSx className={rootClassName} styles={[multiSelectFieldStyle, rootCss]} sx={rootSx}>
            {(className) => (
              <RootPart
                {...rootRest}
                className={className}
                data-ui={tokens('multi-select', rootDataUi)}
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
    <Context.Provider value={model}>
      {renderedContent}
      <span id={`${model.baseId}-summary`} css={visuallyHiddenStyle}>
        {model.messages.selected(labels)}
      </span>
      <span css={visuallyHiddenStyle} role="status" aria-atomic="true">
        {announcement}
      </span>
      {props.name !== undefined &&
        model.selected.map((value) => (
          <input
            key={value}
            type="hidden"
            name={props.name}
            value={value}
            disabled={model.disabled}
            form={model.triggerName?.form}
          />
        ))}
      <input
        ref={model.proxyRef}
        form={model.triggerName?.form}
        type="text"
        css={visuallyHiddenStyle}
        tabIndex={-1}
        aria-label={model.messages.required}
        required={model.required}
        disabled={model.disabled}
        value={model.selected.length ? 'selected' : ''}
        onChange={(event) => {
          event.currentTarget.value = model.selected.length ? 'selected' : '';
        }}
        onInvalid={(event) => {
          event.preventDefault();
          model.setInvalidAttempt(true);
          setAnnouncement(model.messages.required);
          model.refs.domReference.current?.focus();
        }}
      />
    </Context.Provider>
  );
}
function MultiSelectRoot(props: MultiSelectProps) {
  return (
    <IsolatedOverlay>
      <MultiSelectOverlay {...props} />
    </IsolatedOverlay>
  );
}
MultiSelectRoot.displayName = 'MultiSelect';

/** Select-only combobox: arrows and Home/End move virtual focus; Enter/Space toggle without
 * closing; prefix typeahead persists for 500ms. Escape/Tab dismiss without changing values. */
function MultiSelectTrigger({
  ref,
  id: idProp,
  size = 'md',
  disabled: disabledProp,
  onKeyDown,
  onKeyUp,
  onClick,
  onBlur,
  className,
  sx,
  ...rest
}: MultiSelectTriggerProps) {
  const m = useModel('Trigger');
  const mergedRef = useMergeRefs([m.refs.setReference, ref]);
  const id = idProp ?? `${m.baseId}-trigger`;
  const labelledBy = mergeIds(rest['aria-labelledby'], m.labelId);
  const label = rest['aria-label'];
  const buffer = useRef({ text: '', time: 0 });
  const heldToggle = useRef(false);
  useLayoutEffect(() => {
    m.setTriggerName({ id, labelledBy, label, form: rest.form });
    const trigger = m.refs.domReference.current;
    if (trigger)
      m.setDirection(trigger.ownerDocument.defaultView?.getComputedStyle(trigger).direction ?? 'ltr');
    return () => m.setTriggerName(null);
  }, [id, labelledBy, label, rest.form, m.setTriggerName]);
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented || m.disabled || disabledProp || event.nativeEvent.isComposing) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (event.repeat || heldToggle.current) return;
      heldToggle.current = true;
      if (!m.open) m.requestOpen(true);
      else if (m.activeIndex !== null) {
        const value = m.byIndex[m.activeIndex];
        if (value !== undefined) m.toggle(value);
      }
    } else if (event.key === 'Tab') m.requestOpen(false);
    else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const now = performance.now();
      const text =
        (now - buffer.current.time > TYPEAHEAD_RESET_MS ? '' : buffer.current.text) + event.key;
      buffer.current = { text, time: now };
      for (let offset = 1; offset <= m.byIndex.length; offset++) {
        const index = ((m.activeIndex ?? -1) + offset) % m.byIndex.length;
        const value = m.byIndex[index];
        const record = value === undefined ? undefined : m.options.get(value);
        const searchCandidate = record?.textValue ?? record?.label;
        if (
          record &&
          !record.disabled &&
          searchCandidate &&
          m.formatters.collator.compare(searchCandidate.slice(0, text.length), text) === 0
        ) {
          m.requestOpen(true);
          m.setActiveIndex(index);
          break;
        }
      }
    }
  };
  return (
    <WithSx className={className} styles={[triggerStyle, triggerSkin, sizes[size]]} sx={sx}>
      {(className) => (
        <button
          {...m.getReferenceProps({
            ...rest,
            id,
            disabled: m.disabled || disabledProp,
            onKeyDown: handleKeyDown,
            onKeyUp: (event: React.KeyboardEvent<HTMLButtonElement>) => {
              onKeyUp?.(event);
              if (event.key === 'Enter' || event.key === ' ') heldToggle.current = false;
              if (event.key === ' ') event.preventDefault();
            },
            onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
              onClick?.(event);
              if (!event.defaultPrevented && !m.disabled && !disabledProp) m.requestOpen(!m.open);
            },
            onBlur: (event: React.FocusEvent<HTMLButtonElement>) => {
              heldToggle.current = false;
              onBlur?.(event);
            },
          })}
          type="button"
          ref={mergedRef}
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={m.open}
          aria-controls={m.listId}
          aria-activedescendant={m.activeId}
          aria-labelledby={labelledBy}
          aria-describedby={mergeIds(
            rest['aria-describedby'],
            `${m.baseId}-summary`,
            m.descriptionId,
            m.errorId,
          )}
          aria-required={m.required || undefined}
          aria-invalid={m.errorId || m.invalid ? true : rest['aria-invalid']}
          data-ui="multi-select"
          data-state={m.open ? 'open' : 'closed'}
          className={className}
        />
      )}
    </WithSx>
  );
}
MultiSelectTrigger.displayName = 'MultiSelect.Trigger';

function MultiSelectValue({
  ref,
  maxVisible = 2,
  placeholder,
  className,
  sx,
  ...rest
}: MultiSelectValueProps) {
  const m = useModel('Value');
  if (!Number.isFinite(maxVisible) || !Number.isInteger(maxVisible) || maxVisible < 0)
    throw new RangeError('MultiSelect.Value maxVisible must be a finite nonnegative integer.');
  const labels = m.selected.map((value) => m.options.get(value)?.label ?? value);
  const remaining = Math.max(0, labels.length - maxVisible);
  return (
    <WithSx className={className} styles={valueStyle} sx={sx}>
      {(className) => (
        <span
          {...rest}
          ref={ref}
          aria-hidden="true"
          data-ui="multi-select-value"
          data-placeholder={!labels.length || undefined}
          className={className}
        >
          {labels.length ? (
            <>
              {labels.slice(0, maxVisible).map((label, index) => (
                <span key={m.selected[index]} css={chipStyle}>
                  {label}
                </span>
              ))}
              {remaining > 0 && <span css={chipStyle}>+{m.formatters.number.format(remaining)}</span>}
            </>
          ) : (
            placeholder
          )}
        </span>
      )}
    </WithSx>
  );
}
MultiSelectValue.displayName = 'MultiSelect.Value';

function MultiSelectContent({
  ref,
  id: idProp,
  children,
  style,
  onMouseDown,
  className,
  sx,
  ...rest
}: MultiSelectContentProps) {
  const m = useModel('Content');
  const id = idProp ?? `${m.baseId}-listbox`;
  useLayoutEffect(() => {
    m.setListId(id);
    return () => m.setListId(`${m.baseId}-listbox`);
  }, [id, m.baseId, m.setListId]);
  const mergedRef = useMergeRefs([m.open ? m.refs.setFloating : null, ref]);
  const naming =
    rest['aria-label'] !== undefined || rest['aria-labelledby'] !== undefined
      ? {}
      : {
          'aria-label': m.triggerName?.label,
          'aria-labelledby':
            m.triggerName?.labelledBy ?? (m.triggerName?.label ? undefined : m.triggerName?.id),
        };
  return (
    <OverlayPortal>
      <WithSx className={className} styles={[listboxSurfaceStyle, listboxScrollStyle, panelStyle]} sx={sx}>
        {(className) => (
          <div
            {...m.getFloatingProps({
              ...naming,
              ...rest,
              onMouseDown: (event: React.MouseEvent<HTMLDivElement>) => {
                onMouseDown?.(event);
                event.preventDefault();
              },
            })}
            id={id}
            dir={rest.dir ?? m.direction}
            ref={mergedRef}
            role="listbox"
            aria-multiselectable="true"
            hidden={!m.open}
            data-ui="multi-select-content"
            className={className}
            style={{
              ...style,
              ...m.floatingStyles,
              inlineSize: m.refs.domReference.current?.getBoundingClientRect().width,
              maxBlockSize: m.available.height || undefined,
              maxInlineSize: m.available.width || undefined,
            }}
          >
            <FloatingList elementsRef={m.elementsRef}>
              <ContentContext.Provider value>{children}</ContentContext.Provider>
            </FloatingList>
          </div>
        )}
      </WithSx>
    </OverlayPortal>
  );
}
MultiSelectContent.displayName = 'MultiSelect.Content';

function MultiSelectItem({
  ref,
  id: idProp,
  value,
  disabled = false,
  textValue,
  onClick,
  children,
  className,
  sx,
  ...rest
}: MultiSelectItemProps) {
  const m = useModel('Item');
  if (!useContext(ContentContext))
    throw new Error('MultiSelect.Item must be rendered inside MultiSelect.Content.');
  const textRef = useRef<HTMLSpanElement>(null);
  const id = idProp ?? collectionItemId(m.baseId, value);
  const item = useCollectionItem(value, m.registration, textRef, (index, label) => ({
    index,
    label: textValue ?? label,
    textValue,
    disabled,
    id,
  }));
  const mergedRef = useMergeRefs([item.ref, ref]);
  const selected = m.selected.includes(value);
  return (
    <WithSx
      className={className}
      styles={[listboxItemStyle, listboxItemStateStyle, listboxOptionStyle, optionStyle]}
      sx={sx}
    >
      {(className) => (
        <div
          {...m.getItemProps({
            ...rest,
            onClick: (event: React.MouseEvent<HTMLDivElement>) => {
              onClick?.(event);
              if (!event.defaultPrevented) m.toggle(value);
            },
          })}
          id={id}
          ref={mergedRef}
          role="option"
          aria-selected={selected}
          aria-disabled={m.disabled || disabled || undefined}
          data-active={(item.index >= 0 && m.activeIndex === item.index && !m.disabled) || undefined}
          data-ui="multi-select-item"
          className={className}
        >
          <span ref={textRef} css={listboxOptionTextStyle}>
            {children}
          </span>
          {selected && (
            <span aria-hidden="true" css={listboxOptionCheckStyle}>
              ✓
            </span>
          )}
        </div>
      )}
    </WithSx>
  );
}
MultiSelectItem.displayName = 'MultiSelect.Item';

function MultiSelectClear({
  ref,
  disabled,
  onClick,
  children,
  className,
  sx,
  ...rest
}: MultiSelectClearProps) {
  const m = useModel('Clear');
  const retained = m.selected.filter((value) => m.options.get(value)?.disabled);
  const pending = useRef<readonly string[] | null>(null);
  const [, setClearRequest] = useState(0);
  const mergedRef = useMergeRefs([m.clearRef, ref]);
  useLayoutEffect(() => {
    if (
      pending.current &&
      !m.open &&
      pending.current.length === m.selected.length &&
      pending.current.every((value, index) => value === m.selected[index])
    ) {
      m.refs.domReference.current?.focus();
    }
    pending.current = null;
  });
  return (
    <WithSx className={className} styles={[triggerStyle, clearStyle]} sx={sx}>
      {(className) => (
        <button
          {...rest}
          ref={mergedRef}
          type="button"
          disabled={m.disabled || disabled || retained.length === m.selected.length}
          aria-label={rest['aria-label'] ?? m.messages.clearLabel}
          data-ui="multi-select-clear"
          className={className}
          onClick={(event) => {
            onClick?.(event);
            if (event.defaultPrevented) return;
            pending.current = retained;
            m.change(retained);
            m.requestOpen(false);
            setClearRequest((request) => request + 1);
          }}
        >
          {children === undefined ? '×' : children}
        </button>
      )}
    </WithSx>
  );
}
MultiSelectClear.displayName = 'MultiSelect.Clear';

function MultiSelectLabel({ ref, id: idProp, children, className, sx, ...rest }: MultiSelectLabelProps) {
  const m = useModel('Label');
  const id = idProp ?? `${m.baseId}-label`;
  const present = isRenderable(children);
  useLayoutEffect(() => {
    if (!present) return;
    m.setLabelId(id);
    return () => m.setLabelId(undefined);
  }, [id, present, m.setLabelId]);
  if (!present) return null;
  return (
    <WithSx className={className} styles={textStyle} sx={sx}>
      {(className) => (
        <label
          htmlFor={m.triggerName?.id ?? `${m.baseId}-trigger`}
          {...rest}
          id={id}
          ref={ref}
          data-ui="multi-select-label"
          className={className}
        >
          {children}
        </label>
      )}
    </WithSx>
  );
}
MultiSelectLabel.displayName = 'MultiSelect.Label';
function FieldText({
  part,
  error = false,
  ref,
  id: idProp,
  children,
  className,
  sx,
  ...rest
}: MultiSelectDescriptionProps & { part: string; error?: boolean }) {
  const m = useModel(part);
  const id = idProp ?? `${m.baseId}-${part}`;
  const present = isRenderable(children);
  const setter = error ? m.setErrorId : m.setDescriptionId;
  useLayoutEffect(() => {
    if (!present) return;
    setter(id);
    return () => setter(undefined);
  }, [id, present, setter]);
  if (!present) return null;
  return (
    <WithSx className={className} styles={[textStyle, error && errorStyle]} sx={sx}>
      {(className) => (
        <span
          {...rest}
          ref={ref}
          id={id}
          role={error ? 'alert' : rest.role}
          data-ui={`multi-select-${part}`}
          className={className}
        >
          {children}
        </span>
      )}
    </WithSx>
  );
}
function MultiSelectDescription(props: MultiSelectDescriptionProps) {
  return <FieldText {...props} part="description" />;
}
MultiSelectDescription.displayName = 'MultiSelect.Description';
function MultiSelectError(props: MultiSelectErrorProps) {
  return <FieldText {...props} part="error" error />;
}
MultiSelectError.displayName = 'MultiSelect.Error';
function MultiSelectEmpty({ ref, children, className, sx, ...rest }: MultiSelectEmptyProps) {
  const m = useModel('Empty');
  if (m.options.size) return null;
  const content = children === undefined ? m.messages.empty : children;
  if (!isRenderable(content)) return null;
  return (
    <>
      <WithSx className={className} styles={textStyle} sx={sx}>
        {(className) => (
          <div {...rest} ref={ref} aria-hidden="true" data-ui="multi-select-empty" className={className}>
            {content}
          </div>
        )}
      </WithSx>
      <OverlayPortal>
        <div role="status" css={visuallyHiddenStyle} hidden={!m.open}>
          {content}
        </div>
      </OverlayPortal>
    </>
  );
}
MultiSelectEmpty.displayName = 'MultiSelect.Empty';
export const MultiSelect = Object.assign(MultiSelectRoot, {
  Trigger: MultiSelectTrigger,
  Value: MultiSelectValue,
  Content: MultiSelectContent,
  Item: MultiSelectItem,
  Clear: MultiSelectClear,
  Label: MultiSelectLabel,
  Description: MultiSelectDescription,
  Error: MultiSelectError,
  Empty: MultiSelectEmpty,
});
