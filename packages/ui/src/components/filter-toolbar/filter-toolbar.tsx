'use client';

import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type ComponentPropsWithRef,
  type ComponentType,
  type MouseEventHandler,
  type ReactNode,
} from 'react';
import { useMergeRefs } from '@floating-ui/react';
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type Theme } from '../../styling/css';
import { focusRingOutset } from '../../styling/focus-ring';
import { FORCED_COLORS } from '../../styling/media';
import { WithSx, type SxProps } from '../../styling/sx';
import { numberFormatter } from '../../utils/intl';
import { isRenderable } from '../../utils/renderable';
import { useControlledState } from '../../utils/use-controlled-state';
import { Button, type ButtonProps } from '../button';
import { Select, type SelectEasyProps } from '../select';
import { MultiSelect, type MultiSelectEasyProps } from '../multi-select';

export interface FilterValue {
  id: string;
  label: string;
  value: string;
  valueLabel?: string;
}

export interface FilterToolbarMessages {
  remove: (filter: FilterValue) => string;
  clear: string;
}

export interface FilterControlsState {
  value: readonly FilterValue[];
  disabled: boolean;
  onValueChange: (next: readonly FilterValue[]) => void;
}

export interface FilterToolbarSelectOption {
  value: string;
  label: ReactNode;
  disabled?: boolean;
  textValue?: string;
  valueLabel?: string;
}

export interface FilterToolbarSelectDefinition {
  type: 'select';
  id: string;
  label: string;
  placeholder?: ReactNode;
  options: readonly FilterToolbarSelectOption[];
  disabled?: boolean;
  empty?: ReactNode;
  'aria-label'?: string;
}

export interface FilterToolbarMultiSelectOption extends FilterToolbarSelectOption {
  /** Stable chip identifier, unique across this toolbar's filter definitions and options. */
  id: string;
}

export interface FilterToolbarMultiSelectDefinition {
  type: 'multiselect';
  id: string;
  label: string;
  placeholder?: ReactNode;
  options: readonly FilterToolbarMultiSelectOption[];
  disabled?: boolean;
  maxVisible?: number;
  clearable?: boolean;
  empty?: ReactNode;
  'aria-label'?: string;
}

export type FilterToolbarDefinition =
  | FilterToolbarSelectDefinition
  | FilterToolbarMultiSelectDefinition;

export type FilterToolbarOption = FilterToolbarSelectOption | FilterToolbarMultiSelectOption;

export interface FilterToolbarControlsProps
  extends Omit<ComponentPropsWithRef<'div'>, 'children'>, SxProps {
  children?: ReactNode | ((state: FilterControlsState) => ReactNode);
}

type StyleSlot = { className?: string; css?: Interpolation<Theme> };
export interface FilterToolbarActiveFiltersSlotProps {
  /** List container element for active filter chips. */
  list?: StyleSlot;
  /** Each active filter chip element. */
  chip?: StyleSlot;
  /** Text label element inside a filter chip. */
  label?: StyleSlot;
  /** Remove button element on a filter chip. */
  remove?: StyleSlot;
}

export interface FilterToolbarActiveFiltersSlots {
  /** Groups the active filter chips. */
  list?: ComponentType<StyleSlot>;
  /** Displays an active filter chip. */
  chip?: ComponentType<StyleSlot>;
  /** Displays the filter label and value. */
  label?: ComponentType<StyleSlot>;
  /** Removes an active filter. */
  remove?: ComponentType<StyleSlot>;
}

export interface FilterToolbarActiveFiltersProps
  extends Omit<ComponentPropsWithRef<'div'>, 'children'>, SxProps {
  empty?: ReactNode;
  slotProps?: FilterToolbarActiveFiltersSlotProps;
  slots?: FilterToolbarActiveFiltersSlots;
}

export interface FilterToolbarClearProps extends Omit<ButtonProps, 'children' | 'onClick' | 'render'> {
  children?: ReactNode;
  onClick?: MouseEventHandler<HTMLButtonElement>;
}

export interface FilterToolbarResultCountProps
  extends Omit<ComponentPropsWithRef<'p'>, 'children'>, SxProps {
  count: number | null;
  locale?: Intl.LocalesArgument;
  formatCount?: (count: number, formatted: string) => string;
  loading?: boolean;
  loadingLabel?: string;
  unknownLabel?: string;
}

export interface FilterToolbarSlots {
  /** Replaces the root container; renders a `div` by default. */
  root?: ComponentType<ComponentPropsWithRef<'div'>>;
  /** Replaces the filter controls container. */
  controls?: ComponentType<FilterToolbarControlsProps>;
  /** Replaces the single-select filter dropdown. */
  select?: ComponentType<SelectEasyProps>;
  /** Replaces the multi-select filter dropdown. */
  multiSelect?: ComponentType<MultiSelectEasyProps>;
  /** Replaces the active filter chips summary. */
  activeFilters?: ComponentType<FilterToolbarActiveFiltersProps>;
  /** Replaces the clear-all filters button. */
  clear?: ComponentType<FilterToolbarClearProps>;
  /** Replaces the matching results counter. */
  resultCount?: ComponentType<FilterToolbarResultCountProps>;
}

export type FilterToolbarSelectSlotProps = Partial<Omit<SelectEasyProps, 'options' | 'value' | 'defaultValue' | 'children'>> &
  SxProps & {
    className?: string;
    style?: CSSProperties;
    css?: Interpolation<Theme>;
    [attribute: `data-${string}`]: unknown;
  };

export type FilterToolbarMultiSelectSlotProps = Partial<Omit<MultiSelectEasyProps, 'options' | 'value' | 'defaultValue' | 'children'>> &
  SxProps & {
    className?: string;
    style?: CSSProperties;
    css?: Interpolation<Theme>;
    [attribute: `data-${string}`]: unknown;
  };

export interface FilterToolbarSlotProps {
  /** Root toolbar container element. */
  root?: ComponentPropsWithRef<'div'> &
    SxProps & {
      css?: Interpolation<Theme>;
      [attribute: `data-${string}`]: unknown;
    };
  /** Container grouping the filter controls. */
  controls?: Partial<Omit<FilterToolbarControlsProps, 'children'>>;
  /** Single-select filter dropdown. */
  select?: FilterToolbarSelectSlotProps;
  /** Multi-select filter dropdown. */
  multiSelect?: FilterToolbarMultiSelectSlotProps;
  /** Active filter chips summary container. */
  activeFilters?: Partial<FilterToolbarActiveFiltersProps>;
  /** Button that resets all active filters. */
  clear?: Partial<FilterToolbarClearProps>;
  /** Counter displaying matching result count. */
  resultCount?: Partial<FilterToolbarResultCountProps>;
}

export interface FilterToolbarBaseProps
  extends Omit<ComponentPropsWithRef<'div'>, 'defaultValue' | 'onChange'>, SxProps {
  css?: Interpolation<Theme>;
  value?: readonly FilterValue[];
  defaultValue?: readonly FilterValue[];
  onValueChange?: (filters: readonly FilterValue[]) => void;
  disabled?: boolean;
  label?: string;
  messages?: Partial<FilterToolbarMessages>;
  component?: ComponentType<ComponentPropsWithRef<'div'>>;
  [attribute: `data-${string}`]: unknown;
}

export interface FilterToolbarCompoundProps extends FilterToolbarBaseProps {
  children?: ReactNode;
  filters?: never;
  resultCount?: never;
  slots?: never;
  slotProps?: never;
}

export interface FilterToolbarEasyProps extends FilterToolbarBaseProps {
  children?: never;
  filters: readonly FilterToolbarDefinition[];
  resultCount?: number | null;
  slots?: FilterToolbarSlots;
  slotProps?: FilterToolbarSlotProps;
}

export type FilterToolbarProps = FilterToolbarCompoundProps | FilterToolbarEasyProps;

const EMPTY: readonly FilterValue[] = [];
const CONTROL_SELECTOR = [
  'button:not(:disabled)',
  'input:not(:disabled)',
  'select:not(:disabled)',
  'textarea:not(:disabled)',
  'a[href]',
  '[tabindex]',
].map((selector) => `[data-ui="filter-toolbar-controls"] ${selector}`).join(', ');

const DEFAULT_MESSAGES: FilterToolbarMessages = {
  remove: (filter) => `Remove ${filter.label}: ${filter.valueLabel ?? filter.value}`,
  clear: 'Clear all',
};

const ENGLISH_PLURALS = new Intl.PluralRules('en');
const defaultFormatCount = (count: number, formatted: string) =>
  `${formatted} ${ENGLISH_PLURALS.select(count) === 'one' ? 'result' : 'results'}`;

function normalize(filters: readonly FilterValue[]): readonly FilterValue[] {
  return Array.from(new Map(filters.map((filter) => [filter.id, filter])).values());
}

function equal(left: readonly FilterValue[], right: readonly FilterValue[]) {
  return (
    left.length === right.length &&
    left.every((filter, index) => {
      const other = right[index];
      return (
        other !== undefined &&
        filter.id === other.id &&
        filter.value === other.value &&
        filter.label === other.label &&
        filter.valueLabel === other.valueLabel
      );
    })
  );
}

const tokens = (...values: Array<unknown>): string | undefined => {
  const list = [...new Set(values.flatMap((v) => (typeof v === 'string' ? v.split(/\s+/) : [])))].filter(Boolean);
  return list.join(' ') || undefined;
};

interface ToolbarContext extends FilterControlsState {
  messages: FilterToolbarMessages;
  remove: (filter: FilterValue, source: HTMLButtonElement) => void;
  clear: (source: HTMLButtonElement) => void;
}

const Context = createContext<ToolbarContext | null>(null);

function useToolbar(part: string) {
  const context = useContext(Context);
  if (!context) throw new Error(`FilterToolbar.${part} must be rendered inside <FilterToolbar>.`);
  return context;
}

const rowStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: vars.space[2],
  minInlineSize: 0,
  '& > *': { minInlineSize: 0, maxInlineSize: '100%' },
});

const rootStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: vars.space[3],
  minInlineSize: 0,
  padding: vars.space[4],
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.md,
  backgroundColor: vars.color.surface,
  color: vars.color.text,
  fontFamily: vars.font.sans,
  fontSize: vars.textSize.sm,
  '&:focus': focusRingOutset,
  [FORCED_COLORS]: { borderColor: 'CanvasText', backgroundColor: 'Canvas', color: 'CanvasText' },
});

const listStyle = css({ margin: 0, padding: 0, listStyle: 'none' });

const chipStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: vars.space[2],
  minInlineSize: 0,
  maxInlineSize: '100%',
  paddingInlineStart: vars.space[3],
  border: `1px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.full,
  backgroundColor: vars.color.surfaceHover,
  color: vars.color.text,
  [FORCED_COLORS]: { borderColor: 'CanvasText', backgroundColor: 'Canvas', color: 'CanvasText' },
});

const labelStyle = css({
  minInlineSize: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

const fieldStyle = css({ color: vars.color.textMuted });
const valueStyle = css({ fontWeight: vars.fontWeight.medium });

const removeStyle = css({
  flexShrink: 0,
  minInlineSize: vars.space[8],
  minBlockSize: vars.space[8],
  blockSize: 'auto',
  padding: 0,
  borderRadius: vars.radius.full,
  color: vars.color.text,
  [FORCED_COLORS]: { borderColor: 'ButtonText' },
});

const clearStyle = css({
  alignSelf: 'flex-start',
  maxInlineSize: '100%',
  blockSize: 'auto',
  minBlockSize: vars.space[8],
  paddingBlock: vars.space[2],
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
  borderColor: vars.color.borderControl,
  [FORCED_COLORS]: { borderColor: 'ButtonText' },
});

const statusStyle = css({
  margin: 0,
  minInlineSize: 0,
  overflowWrap: 'anywhere',
  color: vars.color.textMuted,
  fontSize: vars.textSize.sm,
  lineHeight: vars.lineHeight.base,
});

type PendingFocus = { source: HTMLButtonElement; removedId?: string; neighbors: readonly string[] };

function validateDefinitions(definitions: readonly FilterToolbarDefinition[]) {
  const ids = new Set<string>();
  const addId = (id: string) => {
    if (typeof id !== 'string' || !id || ids.has(id))
      throw new Error('FilterToolbar filter and option ids must be nonempty and unique.');
    ids.add(id);
  };
  definitions.forEach((definition) => addId(definition.id));
  for (const definition of definitions) {
    const values = new Set<string>();
    for (const option of definition.options) {
      if (typeof option.value !== 'string' || !option.value || values.has(option.value))
        throw new Error('FilterToolbar option values must be nonempty and unique within each definition.');
      values.add(option.value);
    }
    if (definition.type === 'multiselect') definition.options.forEach((option) => addId(option.id));
  }
}

function optionValueLabel(option: FilterToolbarSelectOption) {
  return option.valueLabel ?? option.textValue ?? (typeof option.label === 'string' ? option.label : undefined);
}

/** Group filters with a name and native Tab order. Enter/Space activate remove and clear buttons.
 * Editing keys pass through. Roving toolbar navigation is not supported. */
function FilterToolbarRoot(props: FilterToolbarProps) {
  const {
    ref,
    filters,
    resultCount,
    slots,
    slotProps,
    children,
    'data-ui': consumerDataUi,
    value: valueProp,
    defaultValue = EMPTY,
    onValueChange,
    disabled = false,
    label = 'Filters',
    messages: messagesProp,
    className,
    style,
    css: consumerCss,
    sx: consumerSx,
    component,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    tabIndex = -1,
    ...host
  } = props;

  const [stored = EMPTY, request] = useControlledState(valueProp, defaultValue, onValueChange);
  const value = useMemo(() => normalize(stored), [stored]);
  const rootRef = useRef<HTMLDivElement>(null);
  const {
    className: slotClassName, style: slotStyle, css: slotCss, sx: slotSx,
    ref: slotRef, 'data-ui': slotDataUi, ...slotRest
  } = slotProps?.root ?? {};
  const mergedRef = useMergeRefs([rootRef, slotRef ?? ref]);
  const RootPart = slots?.root ?? component ?? 'div';
  const pending = useRef<PendingFocus | null>(null);
  const messages = useMemo(() => ({ ...DEFAULT_MESSAGES, ...messagesProp }), [messagesProp]);

  const context = useMemo<ToolbarContext>(() => {
    const handleValueChange = (next: readonly FilterValue[]) => {
      if (disabled) return;
      const normalized = normalize(next);
      if (!equal(value, normalized)) request(normalized);
    };
    const prepareFocus = (source: HTMLButtonElement, removedId?: string) => {
      pending.current = null;
      if (source.ownerDocument.activeElement !== source) return;
      const index = value.findIndex((filter) => filter.id === removedId);
      pending.current = {
        source,
        removedId,
        neighbors:
          removedId === undefined
            ? []
            : [
                ...value.slice(index + 1).map((filter) => filter.id),
                ...value.slice(0, index).reverse().map((filter) => filter.id),
              ],
      };
    };
    return {
      value,
      disabled,
      messages,
      onValueChange: handleValueChange,
      remove: (filter, source) => {
        if (disabled) return;
        prepareFocus(source, filter.id);
        handleValueChange(value.filter((entry) => entry.id !== filter.id));
      },
      clear: (source) => {
        if (disabled) return;
        prepareFocus(source);
        handleValueChange(EMPTY);
      },
    };
  }, [value, disabled, messages, request]);

  useLayoutEffect(() => {
    const intent = pending.current;
    const root = rootRef.current;
    if (!intent || !root) return;
    const active = root.ownerDocument.activeElement;
    if (active !== intent.source && active !== root.ownerDocument.body) {
      pending.current = null;
      return;
    }
    const accepted =
      intent.removedId === undefined
        ? value.length === 0
        : !value.some((filter) => filter.id === intent.removedId);
    if (!accepted) return;
    pending.current = null;
    const owned = (element: HTMLElement) => element.closest('[data-ui~="filter-toolbar"]') === root;
    const removes = Array.from(
      root.querySelectorAll<HTMLButtonElement>('[data-ui~="filter-toolbar-remove"]:not(:disabled)'),
    ).filter(owned);
    const neighbor = intent.neighbors
      .map((id) => removes.find((button) => button.dataset.filterId === id))
      .find((button) => button !== undefined);
    const control = Array.from(root.querySelectorAll<HTMLElement>(CONTROL_SELECTOR)).find(
      (element) =>
        owned(element) &&
        element.tabIndex >= 0 &&
        element.getAttribute('aria-disabled') !== 'true' &&
        !element.closest('[hidden], [inert]') &&
        element.getClientRects().length > 0,
    );
    (neighbor ?? control ?? root).focus();
  }, [value]);

  let renderedContent: ReactNode = children;
  if (filters !== undefined) {
    validateDefinitions(filters);
    const ControlsPart = slots?.controls ?? Controls;
    const SelectPart = slots?.select ?? Select;
    const MultiSelectPart = slots?.multiSelect ?? MultiSelect;
    const ActiveFiltersPart = slots?.activeFilters ?? ActiveFilters;
    const ClearPart = slots?.clear ?? Clear;
    const ResultCountPart = slots?.resultCount ?? ResultCount;

    const renderedControls = filters.map((def) => {
      if (def.type === 'select') {
        const selectedFilter = value.find((f) => f.id === def.id);
        const selectedVal = selectedFilter?.value ?? '';
        const {
          className: selectClass,
          css: selectCss,
          sx: selectSx,
          style: selectStyle,
          slotProps: customSelectSlotProps,
          onValueChange: customOnValueChange,
          ...selectRest
        } = slotProps?.select ?? {};

        return (
          <SelectPart
            key={def.id}
            {...selectRest}
            disabled={disabled || def.disabled || selectRest.disabled}
            size="sm"
            placeholder={def.placeholder ?? def.label}
            options={def.options}
            value={selectedVal}
            onValueChange={(nextVal) => {
              customOnValueChange?.(nextVal);
              if (disabled || def.disabled) return;
              if (nextVal === '') {
                context.onValueChange(value.filter((f) => f.id !== def.id));
              } else {
                const opt = def.options.find((o) => o.value === nextVal);
                if (!opt) return;
                const nextFilter: FilterValue = {
                  id: def.id,
                  label: def.label,
                  value: nextVal,
                  valueLabel: optionValueLabel(opt),
                };
                const index = value.findIndex((f) => f.id === def.id);
                const nextFilters =
                  index >= 0 ? value.map((f, i) => (i === index ? nextFilter : f)) : [...value, nextFilter];
                context.onValueChange(nextFilters);
              }
            }}
            slotProps={{
              ...customSelectSlotProps,
              root: {
                className: selectClass,
                css: selectCss,
                sx: selectSx,
                style: selectStyle,
                ...customSelectSlotProps?.root,
              },
              trigger: {
                'aria-label': def['aria-label'] ?? def.label,
                ...customSelectSlotProps?.trigger,
              },
            }}
          />
        );
      }
      if (def.type === 'multiselect') {
        const selectedOptionValues: string[] = [];
        for (const opt of def.options) {
          if (value.some((f) => f.id === opt.id)) {
            selectedOptionValues.push(opt.value);
          }
        }
        const {
          className: multiClass,
          css: multiCss,
          sx: multiSx,
          style: multiStyle,
          slotProps: customMultiSlotProps,
          onValueChange: customOnValueChange,
          ...multiRest
        } = slotProps?.multiSelect ?? {};

        return (
          <MultiSelectPart
            key={def.id}
            {...multiRest}
            disabled={disabled || def.disabled || multiRest.disabled}
            size="sm"
            placeholder={def.placeholder ?? def.label}
            options={def.options.map(({ id: _id, ...option }) => option)}
            value={selectedOptionValues}
            maxVisible={def.maxVisible}
            clearable={def.clearable}
            onValueChange={(nextVals) => {
              customOnValueChange?.(nextVals);
              if (disabled || def.disabled) return;
              const otherFilters = value.filter((f) => !def.options.some((opt) => opt.id === f.id));
              const newDefFilters: FilterValue[] = [];
              for (const val of nextVals) {
                const opt = def.options.find((o) => o.value === val);
                if (!opt) continue;
                newDefFilters.push({
                  id: opt.id,
                  label: def.label,
                  value: val,
                  valueLabel: optionValueLabel(opt),
                });
              }
              context.onValueChange([...otherFilters, ...newDefFilters]);
            }}
            slotProps={{
              ...customMultiSlotProps,
              root: {
                className: multiClass,
                css: multiCss,
                sx: multiSx,
                style: multiStyle,
                ...customMultiSlotProps?.root,
              },
              trigger: {
                'aria-label': def['aria-label'] ?? def.label,
                ...customMultiSlotProps?.trigger,
              },
            }}
          />
        );
      }
      return null;
    });

    const countToRender = resultCount !== undefined ? resultCount : slotProps?.resultCount?.count;

    renderedContent = (
      <>
        <ControlsPart {...slotProps?.controls}>
          {renderedControls}
        </ControlsPart>
        <ActiveFiltersPart {...slotProps?.activeFilters} />
        <ClearPart {...slotProps?.clear} />
        {countToRender !== undefined && (
          <ResultCountPart {...slotProps?.resultCount} count={countToRender} />
        )}
      </>
    );
  }

  return (
    <Context.Provider value={context}>
      <WithSx className={tokens(slotClassName, className)} styles={[rootStyle, slotCss, slotSx, consumerCss]} sx={consumerSx}>
        {(className) => (
          <RootPart
            {...host}
            {...slotRest}
            ref={mergedRef}
            role="group"
            data-ui={tokens('filter-toolbar', consumerDataUi, slotDataUi)}
            className={className}
            style={{ ...style, ...slotStyle }}
            tabIndex={slotRest.tabIndex ?? tabIndex}
            aria-label={slotRest['aria-label'] ?? ariaLabel ??
              ((slotRest['aria-labelledby'] ?? ariaLabelledBy) ? undefined : label)}
            aria-labelledby={slotRest['aria-labelledby'] ?? ariaLabelledBy}
            aria-disabled={disabled || slotRest['aria-disabled'] || host['aria-disabled']}
          >
            {renderedContent}
          </RootPart>
        )}
      </WithSx>
    </Context.Provider>
  );
}

FilterToolbarRoot.displayName = 'FilterToolbar';

function Controls({ children, className, sx, ...rest }: FilterToolbarControlsProps) {
  const { value, disabled, onValueChange } = useToolbar('Controls');
  return (
    <WithSx className={className} styles={rowStyle} sx={sx}>
      {(className) => (
        <div {...rest} data-ui="filter-toolbar-controls" className={className}>
          {typeof children === 'function' ? children({ value, disabled, onValueChange }) : children}
        </div>
      )}
    </WithSx>
  );
}

Controls.displayName = 'FilterToolbar.Controls';

function ActiveFilters({ empty, slotProps, slots, className, sx, ...rest }: FilterToolbarActiveFiltersProps) {
  const List = slots?.list ?? 'ul';
  const Chip = slots?.chip ?? 'li';
  const Label = slots?.label ?? 'span';
  const Remove = slots?.remove ?? 'button';
  const { value, disabled, messages, remove } = useToolbar('ActiveFilters');
  return (
    <WithSx className={className} styles={rowStyle} sx={sx}>
      {(className) => (
        <div {...rest} data-ui="filter-toolbar-active-filters" className={className}>
          {value.length > 0 ? (
            <List {...slotProps?.list} className={slotProps?.list?.className} css={[rowStyle, listStyle, slotProps?.list?.css]}>
              {value.map((filter) => (
                <Chip
                  {...slotProps?.chip}
                  key={filter.id}
                  className={slotProps?.chip?.className}
                  css={[chipStyle, slotProps?.chip?.css]}
                >
                  <Label {...slotProps?.label} className={slotProps?.label?.className} css={[labelStyle, slotProps?.label?.css]}>
                    <span css={fieldStyle}>{filter.label}: </span>
                    <span css={valueStyle}>{filter.valueLabel ?? filter.value}</span>
                  </Label>
                  <Button
                    {...slotProps?.remove}
                    variant="ghost"
                    size="sm"
                    disabled={disabled}
                    aria-label={messages.remove(filter)}
                    data-ui="filter-toolbar-remove"
                    data-filter-id={filter.id}
                    className={slotProps?.remove?.className}
                    css={[removeStyle, slotProps?.remove?.css]}
                    onClick={(event) => remove(filter, event.currentTarget)}
                    render={(props) => (
                      <Remove {...props} type="button" disabled={disabled}>
                        <span aria-hidden="true">×</span>
                      </Remove>
                    )}
                  />
                </Chip>
              ))}
            </List>
          ) : isRenderable(empty) ? (
            empty
          ) : null}
        </div>
      )}
    </WithSx>
  );
}

ActiveFilters.displayName = 'FilterToolbar.ActiveFilters';

function Clear({ children, onClick, disabled: disabledProp = false, css: cssProp, ...rest }: FilterToolbarClearProps) {
  const { value, disabled: rootDisabled, messages, clear } = useToolbar('Clear');
  if (!value.length) return null;
  const disabled = rootDisabled || disabledProp;
  return (
    <Button
      variant="outline"
      size="sm"
      {...rest}
      disabled={disabled}
      data-ui="filter-toolbar-clear"
      css={[clearStyle, cssProp]}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) clear(event.currentTarget);
      }}
      render={(props) => <button {...props} type="button" disabled={disabled} />}
    >
      {children === undefined ? messages.clear : children}
    </Button>
  );
}

Clear.displayName = 'FilterToolbar.Clear';

function ResultCount({
  count,
  locale,
  formatCount = defaultFormatCount,
  loading = false,
  loadingLabel = 'Loading results',
  unknownLabel = 'Results unavailable',
  className,
  sx,
  ...rest
}: FilterToolbarResultCountProps) {
  useToolbar('ResultCount');
  const valid = count !== null && Number.isFinite(count) && Number.isInteger(count) && count >= 0;
  const text = valid ? formatCount(count, numberFormatter(locale).format(count)) : unknownLabel;
  return (
    <WithSx className={className} styles={statusStyle} sx={sx}>
      {(className) => (
        <p
          aria-live="polite"
          aria-atomic="true"
          {...rest}
          role="status"
          aria-busy={loading || rest['aria-busy']}
          data-ui="filter-toolbar-result-count"
          className={className}
        >
          {loading ? loadingLabel : text}
        </p>
      )}
    </WithSx>
  );
}

ResultCount.displayName = 'FilterToolbar.ResultCount';

export const FilterToolbar = Object.assign(FilterToolbarRoot, { Controls, ActiveFilters, Clear, ResultCount });
