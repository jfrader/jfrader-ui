// APG pattern: accordion. Each Trigger is a native <button> inside an <h3> heading, with
// aria-expanded and aria-controls pointing at its Panel; each Panel is a role="region"
// labelled by its Trigger. The heading level is fixed at h3 — consumers must place the
// accordion where a level-three heading fits the page outline.
// Keyboard map: Enter/Space toggle the focused trigger (native button); ArrowDown/ArrowUp
// move focus to the next/previous enabled trigger and wrap; Home/End jump to the
// first/last enabled trigger. Tab moves through triggers and focusable panel content in
// page order. Disabled items keep a real `disabled` button and are skipped by arrows.
//
// State: `value` is a string in single mode ('' means every panel is collapsed) and a
// string[] with `multiple`. With `collapsible={false}` the last open panel cannot be
// closed; its trigger carries aria-disabled="true" while it is the only open one.
// Panels stay mounted while collapsed (`hidden`), so their inner state persists.
import {
  createContext,
  forwardRef,
  useContext,
  useId,
  useMemo,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { useControlledState } from '../../utils/use-controlled-state';

export type AccordionValue = string | string[];

export interface AccordionProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange' | 'defaultValue'> {
  value?: AccordionValue;
  defaultValue?: AccordionValue;
  onValueChange?: (value: AccordionValue) => void;
  /** Allow several panels open at once. Values are emitted as string[]. */
  multiple?: boolean;
  /** Allow closing the last open panel. */
  collapsible?: boolean;
}

export interface AccordionItemProps extends HTMLAttributes<HTMLDivElement> {
  value: string;
  disabled?: boolean;
}

export type AccordionTriggerProps = ButtonHTMLAttributes<HTMLButtonElement>;

export type AccordionPanelProps = HTMLAttributes<HTMLDivElement>;

interface AccordionContextValue {
  openValues: readonly string[];
  toggle: (itemValue: string) => void;
  canCollapse: boolean;
}

interface AccordionItemContextValue {
  value: string;
  disabled: boolean;
  expanded: boolean;
  triggerId: string;
  panelId: string;
}

const AccordionContext = createContext<AccordionContextValue | null>(null);
const AccordionItemContext = createContext<AccordionItemContextValue | null>(null);

function useAccordionContext(part: string): AccordionContextValue {
  const context = useContext(AccordionContext);
  if (!context) throw new Error(`Accordion.${part} must be rendered inside <Accordion>.`);
  return context;
}

function useAccordionItemContext(part: string): AccordionItemContextValue {
  const context = useContext(AccordionItemContext);
  if (!context) throw new Error(`Accordion.${part} must be rendered inside <Accordion.Item>.`);
  return context;
}

const EMPTY_SINGLE_VALUE = '';
const TRIGGER_SELECTOR = '[data-ui="accordion-trigger"]:not([disabled])';
const ROOT_SELECTOR = '[data-ui="accordion"]';

const toOpenValues = (value: AccordionValue | undefined, multiple: boolean): string[] => {
  if (multiple && Array.isArray(value)) return value;
  // In single mode, array value/defaultValue uses only its first element.
  const singleValue = Array.isArray(value) ? value[0] : value;
  return singleValue === undefined || singleValue === EMPTY_SINGLE_VALUE ? [] : [singleValue];
};

type Move = (current: number, count: number) => number;

const KEY_MOVES: Partial<Record<string, Move>> = {
  ArrowDown: (current, count) => (current + 1) % count,
  ArrowUp: (current, count) => (current - 1 + count) % count,
  Home: () => 0,
  End: (_current, count) => count - 1,
};

const REDUCED_MOTION = '@media (prefers-reduced-motion: reduce)';

const itemStyle = css({
  borderBlockEnd: `1px solid ${vars.color.border}`,
  '&:first-of-type': {
    borderBlockStart: `1px solid ${vars.color.border}`,
  },
});

const headingStyle = css({
  margin: 0,
  font: 'inherit',
});

const triggerStyle = css({
  appearance: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: vars.space[3],
  inlineSize: '100%',
  border: 0,
  background: 'transparent',
  cursor: 'pointer',
  paddingBlock: vars.space[3],
  paddingInline: vars.space[4],
  font: 'inherit',
  fontSize: vars.textSize.sm,
  fontWeight: vars.fontWeight.medium,
  color: vars.color.text,
  textAlign: 'start',
  transitionProperty: 'background-color',
  transitionDuration: vars.motion.duration.fast,
  transitionTimingFunction: vars.motion.easeStandard,
  '&::after': {
    content: '""',
    flexShrink: 0,
    borderBlock: `${vars.space[1]} solid transparent`,
    borderInlineStart: `calc(${vars.space[1]} * 1.5) solid currentColor`,
    transitionProperty: 'transform',
    transitionDuration: vars.motion.duration.base,
    transitionTimingFunction: vars.motion.easeStandard,
  },
  '&[aria-expanded="true"]::after': {
    transform: 'rotate(90deg)',
  },
  // The triangle points toward inline-end, so under RTL it points left and must turn the
  // other way to point down.
  '&[aria-expanded="true"]:dir(rtl)::after': {
    transform: 'rotate(-90deg)',
  },
  '&:hover:not(:disabled):not([aria-disabled="true"])': {
    backgroundColor: vars.color.surfaceHover,
  },
  '&[aria-disabled="true"]': {
    cursor: 'default',
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
    '&::after': {
      transitionDuration: '0s',
    },
  },
});

const panelStyle = css({
  paddingBlock: vars.space[3],
  paddingInline: vars.space[4],
  color: vars.color.textMuted,
  lineHeight: vars.lineHeight.relaxed,
  '&[hidden]': {
    display: 'none',
  },
});

const Root = forwardRef<HTMLDivElement, AccordionProps>(function Accordion(
  {
    value: valueProp,
    defaultValue,
    onValueChange,
    multiple = false,
    collapsible = true,
    onKeyDown,
    ...rest
  },
  ref,
) {
  const [value, setValue] = useControlledState<AccordionValue>(valueProp, defaultValue, onValueChange);

  const context = useMemo(() => {
    const openValues = toOpenValues(value, multiple);
    const canCollapse = collapsible || openValues.length > 1;
    const toggle = (itemValue: string) => {
      const isOpen = openValues.includes(itemValue);
      if (isOpen && !canCollapse) return;
      if (multiple) {
        setValue(isOpen ? openValues.filter((open) => open !== itemValue) : [...openValues, itemValue]);
      } else {
        setValue(isOpen ? EMPTY_SINGLE_VALUE : itemValue);
      }
    };
    return { openValues, toggle, canCollapse };
  }, [value, setValue, multiple, collapsible]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    const move = KEY_MOVES[event.key];
    if (event.defaultPrevented || !move) return;

    // Scope to this accordion's own triggers so a nested accordion keeps its own focus order.
    const root = event.currentTarget;
    const triggers = Array.from(root.querySelectorAll<HTMLButtonElement>(TRIGGER_SELECTOR)).filter(
      (trigger) => trigger.closest(ROOT_SELECTOR) === root,
    );
    const current = triggers.indexOf(event.target as HTMLButtonElement);
    if (current === -1) return;

    event.preventDefault();
    triggers[move(current, triggers.length)]?.focus();
  };

  return (
    <AccordionContext.Provider value={context}>
      <div {...rest} ref={ref} data-ui="accordion" onKeyDown={handleKeyDown} />
    </AccordionContext.Provider>
  );
});

const Item = forwardRef<HTMLDivElement, AccordionItemProps>(function AccordionItem(
  { value, disabled = false, ...rest },
  ref,
) {
  const { openValues } = useAccordionContext('Item');
  const id = useId();
  const expanded = openValues.includes(value);

  const context = useMemo(
    () => ({ value, disabled, expanded, triggerId: `${id}-trigger`, panelId: `${id}-panel` }),
    [value, disabled, expanded, id],
  );

  return (
    <AccordionItemContext.Provider value={context}>
      <div
        {...rest}
        ref={ref}
        data-ui="accordion-item"
        data-state={expanded ? 'open' : 'closed'}
        data-disabled={disabled ? '' : undefined}
        css={itemStyle}
      />
    </AccordionItemContext.Provider>
  );
});

const Trigger = forwardRef<HTMLButtonElement, AccordionTriggerProps>(function AccordionTrigger(
  { onClick, disabled: disabledProp, ...rest },
  ref,
) {
  const { toggle, canCollapse } = useAccordionContext('Trigger');
  const { value, disabled: itemDisabled, expanded, triggerId, panelId } = useAccordionItemContext('Trigger');
  const locked = expanded && !canCollapse;

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    onClick?.(event);
    if (event.defaultPrevented) return;
    toggle(value);
  };

  return (
    <h3 data-ui="accordion-heading" css={headingStyle}>
      <button
        {...rest}
        ref={ref}
        type="button"
        id={triggerId}
        data-ui="accordion-trigger"
        data-state={expanded ? 'open' : 'closed'}
        aria-expanded={expanded}
        aria-controls={panelId}
        aria-disabled={locked || undefined}
        disabled={itemDisabled || disabledProp}
        onClick={handleClick}
        css={triggerStyle}
      />
    </h3>
  );
});

const Panel = forwardRef<HTMLDivElement, AccordionPanelProps>(function AccordionPanel(
  { 'aria-labelledby': ariaLabelledByProp, ...rest },
  ref,
) {
  const { expanded, triggerId, panelId } = useAccordionItemContext('Panel');
  const ariaLabelledBy = [ariaLabelledByProp, triggerId].filter(Boolean).join(' ');

  return (
    <div
      {...rest}
      ref={ref}
      role="region"
      id={panelId}
      aria-labelledby={ariaLabelledBy}
      hidden={!expanded}
      data-ui="accordion-panel"
      data-state={expanded ? 'open' : 'closed'}
      css={panelStyle}
    />
  );
});

export const Accordion = Object.assign(Root, { Item, Trigger, Panel });
