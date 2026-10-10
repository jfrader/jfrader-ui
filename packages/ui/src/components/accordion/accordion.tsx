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
// string[] with type="multiple". With `collapsible={false}` the last open panel cannot be
// closed; its trigger carries aria-disabled="true" while it is the only open one.
// Panels stay mounted while collapsed (`hidden`), so their inner state persists.
import {
  createContext,
  useContext,
  useId,
  useMemo,
  type ComponentPropsWithRef,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { disclosureCaret } from '../../styling/disclosure-caret';
import { focusRingInset } from '../../styling/focus-ring';
import { REDUCED_MOTION } from '../../styling/media';
import { WithSx, type SxProps } from '../../styling/sx';
import { moveRovingFocus, type OwnedItemsQuery } from '../../utils/roving-focus';
import { useControlledState } from '../../utils/use-controlled-state';

export type AccordionType = 'single' | 'multiple';
export type AccordionValue = string | string[];

interface AccordionBaseProps extends Omit<ComponentPropsWithRef<'div'>, 'onChange' | 'defaultValue'>, SxProps {
  /** Allow closing the last open panel. */
  collapsible?: boolean;
}

export interface AccordionSingleProps extends AccordionBaseProps {
  type?: 'single';
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
}

export interface AccordionMultipleProps extends AccordionBaseProps {
  /** Allow several panels open at once. */
  type: 'multiple';
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (value: string[]) => void;
}

export type AccordionProps = AccordionSingleProps | AccordionMultipleProps;

export interface AccordionItemProps extends ComponentPropsWithRef<'div'>, SxProps {
  value: string;
  disabled?: boolean;
}

export type AccordionTriggerProps = ComponentPropsWithRef<'button'> & SxProps;

export type AccordionPanelProps = ComponentPropsWithRef<'div'> & SxProps;

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
const TRIGGER_QUERY: OwnedItemsQuery = {
  itemSelector: '[data-ui="accordion-trigger"]:not([disabled])',
  ownerSelector: '[data-ui="accordion"]',
};

const toOpenValues = (value: AccordionValue | undefined, type: AccordionType): string[] => {
  if (type === 'multiple' && Array.isArray(value)) return value;
  // In single mode, array value/defaultValue uses only its first element.
  const singleValue = Array.isArray(value) ? value[0] : value;
  return singleValue === undefined || singleValue === EMPTY_SINGLE_VALUE ? [] : [singleValue];
};

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
    ...disclosureCaret,
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
    ...focusRingInset,
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

function AccordionRoot({
  ref,
  value: valueProp,
  defaultValue,
  onValueChange,
  type = 'single',
  collapsible = true,
  onKeyDown,
  className,
  sx,
  ...rest
}: AccordionProps) {
  // `toggle` only emits the shape that matches `type`, so either callback accepts it.
  const [value, setValue] = useControlledState<AccordionValue>(
    valueProp,
    defaultValue,
    onValueChange as ((value: AccordionValue) => void) | undefined,
  );

  const context = useMemo(() => {
    const openValues = toOpenValues(value, type);
    const canCollapse = collapsible || openValues.length > 1;
    const toggle = (itemValue: string) => {
      const isOpen = openValues.includes(itemValue);
      if (isOpen && !canCollapse) return;
      if (type === 'multiple') {
        setValue(isOpen ? openValues.filter((open) => open !== itemValue) : [...openValues, itemValue]);
      } else {
        setValue(isOpen ? EMPTY_SINGLE_VALUE : itemValue);
      }
    };
    return { openValues, toggle, canCollapse };
  }, [value, setValue, type, collapsible]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;
    // Scope to this accordion's own triggers so a nested accordion keeps its own focus order.
    moveRovingFocus(event, event.currentTarget, 'vertical', TRIGGER_QUERY);
  };

  return (
    <AccordionContext.Provider value={context}>
      <WithSx className={className} sx={sx}>
        {(className) => (
          <div {...rest} ref={ref} data-ui="accordion" onKeyDown={handleKeyDown} className={className} />
        )}
      </WithSx>
    </AccordionContext.Provider>
  );
}

AccordionRoot.displayName = 'Accordion';

function AccordionItem({ ref, value, disabled = false, className, sx, ...rest }: AccordionItemProps) {
  const { openValues } = useAccordionContext('Item');
  const id = useId();
  const expanded = openValues.includes(value);

  const context = useMemo(
    () => ({ value, disabled, expanded, triggerId: `${id}-trigger`, panelId: `${id}-panel` }),
    [value, disabled, expanded, id],
  );

  return (
    <AccordionItemContext.Provider value={context}>
      <WithSx className={className} styles={itemStyle} sx={sx}>
        {(className) => (
          <div
            {...rest}
            ref={ref}
            data-ui="accordion-item"
            data-state={expanded ? 'open' : 'closed'}
            data-disabled={disabled ? '' : undefined}
            className={className}
          />
        )}
      </WithSx>
    </AccordionItemContext.Provider>
  );
}

AccordionItem.displayName = 'Accordion.Item';

function AccordionTrigger({ ref, onClick, disabled: disabledProp, className, sx, ...rest }: AccordionTriggerProps) {
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
      <WithSx className={className} styles={triggerStyle} sx={sx}>
        {(className) => (
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
            className={className}
          />
        )}
      </WithSx>
    </h3>
  );
}

AccordionTrigger.displayName = 'Accordion.Trigger';

function AccordionPanel({ ref, 'aria-labelledby': ariaLabelledByProp, className, sx, ...rest }: AccordionPanelProps) {
  const { expanded, triggerId, panelId } = useAccordionItemContext('Panel');
  const ariaLabelledBy = [ariaLabelledByProp, triggerId].filter(Boolean).join(' ');

  return (
    <WithSx className={className} styles={panelStyle} sx={sx}>
      {(className) => (
        <div
          {...rest}
          ref={ref}
          role="region"
          id={panelId}
          aria-labelledby={ariaLabelledBy}
          hidden={!expanded}
          data-ui="accordion-panel"
          data-state={expanded ? 'open' : 'closed'}
          className={className}
        />
      )}
    </WithSx>
  );
}

AccordionPanel.displayName = 'Accordion.Panel';

export const Accordion = Object.assign(AccordionRoot, {
  Item: AccordionItem,
  Trigger: AccordionTrigger,
  Panel: AccordionPanel,
});
