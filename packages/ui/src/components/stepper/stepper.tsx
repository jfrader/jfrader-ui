// Ordered-flow indicator. No dedicated APG pattern exists: a native <ol> keeps list position, the
// current step carries aria-current="step", and every state is spelled out in each step's name.
// Static mode is a labelled group; interactive mode is a labelled <nav> whose steps are native
// buttons (APG Button). It is not Tabs: steps do not own panels, and the app renders the content.
//
// Keyboard map (interactive mode only):
// - Tab / Shift+Tab: one roving stop — the focused step if still reachable, else the current step,
//   else the first reachable step.
// - ArrowLeft / ArrowRight (horizontal, swapped under RTL) or ArrowUp / ArrowDown (vertical): move
//   to the previous/next reachable step and clamp at the ends; the other axis is left to the page.
// - Home / End: first / last reachable step.
// - Enter / Space: native button activation; only enabled completed steps request a change.
// Reachable steps are the current step plus enabled completed steps. Arrows never change the value.
//
// State: `value` / `defaultValue` / `onValueChange`, a zero-based index where `steps.length`
// means every step is complete. Values are floored and clamped; normalization never notifies.
// Step ids are React keys, so duplicates trigger React's development key warning; ids reach the
// DOM only percent-encoded.
import { numberFormatter } from '../../utils/intl';
import {
  type ComponentType,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
} from 'react';
import { useMergeRefs } from '@floating-ui/react';
import { Check, Error } from '@jfrader/icons';
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type SerializedStyles, type Theme } from '../../styling/css';
import { focusRingOutset } from '../../styling/focus-ring';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import { withoutSx, WithSx, type SxProps } from '../../styling/sx';
import { visuallyHiddenStyle } from '../../styling/visually-hidden';
import { partId } from '../../utils/part-id';
import { isRenderable } from '../../utils/renderable';
import { useControlledState } from '../../utils/use-controlled-state';

export type StepperOrientation = 'horizontal' | 'vertical';
export type StepperSize = 'sm' | 'md';
export type StepperDetails = 'all' | 'current';
export type StepperStatus = 'complete' | 'current' | 'upcoming' | 'error';

export interface StepperStep {
  /** Stable unique identity. */
  id: string;
  /** Visible label; the default accessible name starts with it. */
  label: string;
  /** Secondary text. `0` renders; `false`/`null`/`undefined` render nothing. */
  description?: ReactNode;
  /** Error text; when renderable the step's status is `error` and the text is always shown. */
  error?: ReactNode;
  /** A disabled completed step cannot be selected or focused. */
  disabled?: boolean;
  /** Decorative marker content replacing the numeral/check/error glyph. */
  icon?: ReactNode;
}

export interface StepperPartProps {
  className?: string;
  sx?: Interpolation<Theme>;
}
export interface StepperSlots {
  /** Container naming the step sequence. */
  root?: ComponentType<ComponentPropsWithRef<'div'> & StepperPartProps>;
  /** Ordered list holding the steps. */
  list?: ComponentType<ComponentPropsWithRef<'ol'> & StepperPartProps>;
  /** List item containing one step. */
  item?: ComponentType<ComponentPropsWithRef<'li'> & StepperPartProps>;
  /** Button or static header naming a step. */
  head?: ComponentType<ComponentPropsWithRef<'button'> & StepperPartProps>;
  /** Badge showing the step's state. */
  marker?: ComponentType<ComponentPropsWithRef<'span'> & StepperPartProps>;
  /** Text naming a step. */
  label?: ComponentType<ComponentPropsWithRef<'span'> & StepperPartProps>;
  /** Text describing a step. */
  description?: ComponentType<ComponentPropsWithRef<'span'> & StepperPartProps>;
  /** Line connecting adjacent steps. */
  connector?: ComponentType<ComponentPropsWithRef<'span'> & StepperPartProps>;
  /** Current-step or completion caption. */
  caption?: ComponentType<ComponentPropsWithRef<'div'> & StepperPartProps>;
}

/**
 * Native button props for interactive step heads; static heads only use `className`/`css`.
 * Step names come from `getStepLabel`, so the slot takes no `aria-label`/`aria-labelledby`.
 */
export type StepperHeadSlotProps = Omit<
  ComponentPropsWithRef<'button'>,
  | 'children'
  | 'ref'
  | 'type'
  | 'disabled'
  | 'tabIndex'
  | 'aria-current'
  | 'aria-disabled'
  | 'aria-label'
  | 'aria-labelledby'
> &
  StepperPartProps;

export interface StepperSlotProps {
  /** Nav landmark wrapping the stepper workflow. */
  root?: ComponentPropsWithRef<'div'> & StepperPartProps;
  /** Ordered list container holding the step items. */
  list?: ComponentPropsWithRef<'ol'> & StepperPartProps;
  /** List item representing an individual step. */
  item?: ComponentPropsWithRef<'li'> & StepperPartProps;
  /** Interactive button or header container for a step. */
  head?: StepperHeadSlotProps;
  /** Circle badge displaying step index, checkmark, or error icon. */
  marker?: ComponentPropsWithRef<'span'> & StepperPartProps;
  /** Heading element displaying the step title. */
  label?: ComponentPropsWithRef<'span'> & StepperPartProps;
  /** Helper text element describing the step status or detail. */
  description?: ComponentPropsWithRef<'span'> & StepperPartProps;
  /** Line connecting consecutive steps in the sequence. */
  connector?: ComponentPropsWithRef<'span'> & StepperPartProps;
  /** Screen-reader status label describing step state. */
  caption?: ComponentPropsWithRef<'div'> & StepperPartProps;
}

export interface StepperBaseProps extends SxProps {
  /** Replaces the step sequence's container and parts. */
  slots?: StepperSlots;
  /** Defines the steps in display order. */
  steps: readonly StepperStep[];
  /** Controlled current index, `0..steps.length` (`steps.length` = all complete). */
  value?: number;
  /** Uncontrolled initial current index. */
  defaultValue?: number;
  /** Requested index after a completed step is activated (interactive mode). */
  onValueChange?: (index: number) => void;
  /** Sets the layout axis and arrow-key navigation axis. Defaults to `'horizontal'`. */
  orientation?: StepperOrientation;
  /** Which descriptions show; errors always show. */
  details?: StepperDetails;
  /** Markers only, with the current step in a caption. Error steps keep their label and text. */
  compact?: boolean;
  /** Horizontal steppers fold to compact below a 30rem container width. */
  responsive?: boolean;
  /** Marker and text scale; interactive targets stay at least 32px. */
  size?: StepperSize;
  /** Accessible name of the group/navigation when no `aria-label`/`aria-labelledby` is given. */
  label?: string;
  /** Caption shown once every step is complete. */
  completeLabel?: ReactNode;
  /** Locale for the default numerals and counts. */
  locale?: Intl.LocalesArgument;
  /** Full accessible name of a step; translate the wording here. */
  getStepLabel?: (step: StepperStep, index: number, count: number, status: StepperStatus) => string;
  /** Live summary of an accepted change; `step` is null when every step is complete. */
  getChangeLabel?: (step: StepperStep | null, index: number, count: number) => string;
  /** Announces accepted value changes in a polite live region. */
  announceChanges?: boolean;
  /** Passes props and styles to the step sequence's container and parts. */
  slotProps?: StepperSlotProps;
}

export type StepperStaticProps = StepperBaseProps & {
  /** Static indicator: a labelled group without controls. */
  interactive?: false;
} & Omit<ComponentPropsWithRef<'div'>, keyof StepperBaseProps | 'children'>;

export type StepperInteractiveProps = StepperBaseProps & {
  /** Navigation: completed steps are buttons that request `onValueChange`. */
  interactive: true;
} & Omit<ComponentPropsWithRef<'nav'>, keyof StepperBaseProps | 'children'>;

export type StepperProps = StepperStaticProps | StepperInteractiveProps;

const DEFAULT_LABEL = 'Progress';
const DEFAULT_COMPLETE_LABEL = 'All steps complete';
const DEFAULT_STATUS_TEXT: Record<StepperStatus, string> = {
  complete: 'completed',
  current: 'current step',
  upcoming: 'upcoming',
  error: 'error',
};
const defaultStepLabel =
  (format: Intl.NumberFormat) => (step: StepperStep, index: number, count: number, status: StepperStatus) =>
    `${step.label}, step ${format.format(index + 1)} of ${format.format(count)}, ${DEFAULT_STATUS_TEXT[status]}`;
const defaultChangeLabel = (format: Intl.NumberFormat) => (step: StepperStep | null, index: number, count: number) =>
  step ? `Step ${format.format(index + 1)} of ${format.format(count)}: ${step.label}` : DEFAULT_COMPLETE_LABEL;
const CONNECTOR_THICKNESS = '2px';
const MARKER_SIZE = '--stepper-marker-size';
const MARKER_FONT = '--stepper-marker-font';
const DETAIL_FONT = '--stepper-detail-font';
const marker = `var(${MARKER_SIZE})`;
const NARROW_LAYOUT_QUERY = '@container stepper (max-width: 30rem)';

/** Styles for a part while the stepper is compact, manually or by the responsive container query. */
const whenCompact = <Styles extends object>(styles: Styles) => ({
  '[data-compact] &': styles,
  [NARROW_LAYOUT_QUERY]: { '[data-auto-compact] &': styles },
});

function normalizeIndex(value: number | undefined, count: number) {
  if (value === undefined) return undefined;
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(Math.floor(value), 0), count);
}

function getStatus(step: StepperStep, index: number, current: number): StepperStatus {
  if (isRenderable(step.error)) return 'error';
  if (index < current) return 'complete';
  return index === current ? 'current' : 'upcoming';
}

const joinIds = (...ids: (string | false | undefined)[]) => ids.filter(Boolean).join(' ') || undefined;

function CheckGlyph() {
  return (
    <Check size="inherit" decorative />
  );
}

function ErrorGlyph() {
  return (
    <Error size="inherit" decorative />
  );
}

const rootStyle = css({
  label: 'stepper',
  boxSizing: 'border-box',
  inlineSize: '100%',
  minInlineSize: 0,
  containerType: 'inline-size',
  containerName: 'stepper',
  fontFamily: vars.font.sans,
  lineHeight: vars.lineHeight.base,
  color: vars.color.text,
});

const rootSizeStyles: Record<StepperSize, SerializedStyles> = {
  sm: css({
    [MARKER_SIZE]: vars.space[6],
    [MARKER_FONT]: vars.textSize.xs,
    [DETAIL_FONT]: vars.textSize.xs,
    fontSize: vars.textSize.sm,
  }),
  md: css({
    [MARKER_SIZE]: vars.space[8],
    [MARKER_FONT]: vars.textSize.sm,
    [DETAIL_FONT]: vars.textSize.sm,
    fontSize: vars.textSize.md,
  }),
};

// `list-style: none` makes WebKit drop list semantics (MDN, list-style accessibility concerns), so
// the list and its items restate their roles explicitly.
const listStyles: Record<StepperOrientation, SerializedStyles> = {
  horizontal: css({ display: 'flex', margin: 0, padding: 0, listStyle: 'none' }),
  vertical: css({ display: 'flex', flexDirection: 'column', margin: 0, padding: 0, listStyle: 'none' }),
};

const itemStyles: Record<StepperOrientation, SerializedStyles> = {
  horizontal: css({
    display: 'grid',
    gridTemplateColumns: `minmax(0, max-content) minmax(${vars.space[4]}, 1fr)`,
    alignItems: 'start',
    flex: '1 1 0',
    minInlineSize: 0,
    '&:last-of-type': { gridTemplateColumns: 'minmax(0, max-content)', flex: '0 1 auto' },
    [NARROW_LAYOUT_QUERY]: {
      gridTemplateColumns: `calc(${marker} + 2 * ${vars.space[1]}) minmax(0, 1fr)`,
      '&:last-of-type': { gridTemplateColumns: 'minmax(0, 1fr)', flex: '1 1 0' },
    },
  }),
  vertical: css({
    display: 'grid',
    gridTemplateColumns: `calc(${marker} + 2 * ${vars.space[1]}) minmax(0, 1fr)`,
    minInlineSize: 0,
  }),
};

const headStyle = css({
  boxSizing: 'border-box',
  gridRow: 1,
  justifySelf: 'start',
  display: 'inline-flex',
  alignItems: 'flex-start',
  gap: vars.space[3],
  maxInlineSize: '100%',
  minInlineSize: vars.space[8],
  minBlockSize: vars.space[8],
  margin: 0,
  padding: vars.space[1],
  border: 0,
  borderRadius: vars.radius.sm,
  backgroundColor: 'transparent',
  color: 'inherit',
  font: 'inherit',
  textAlign: 'start',
  transitionProperty: 'background-color, transform',
  transitionDuration: vars.motion.duration.base,
  transitionTimingFunction: vars.motion.easeStandard,
  [REDUCED_MOTION]: { transitionDuration: '0s' },
});

const headOrientationStyles: Record<StepperOrientation, SerializedStyles> = {
  horizontal: css({
    gridColumn: 1,
    [NARROW_LAYOUT_QUERY]: { gridColumn: '1 / -1', flexDirection: 'column', gap: vars.space[1] },
  }),
  vertical: css({ gridColumn: '1 / -1' }),
};

const buttonHeadStyle = css({
  cursor: 'pointer',
  '&[aria-disabled="true"]': { cursor: 'default' },
  '&:not([aria-disabled="true"]):hover': { backgroundColor: vars.color.surfaceHover },
  '&:not([aria-disabled="true"]):active': { transform: 'scale(0.98)' },
  '&:focus-visible': focusRingOutset,
  [REDUCED_MOTION]: { '&:not([aria-disabled="true"]):active': { transform: 'none' } },
});

const markerStyle = css({
  boxSizing: 'border-box',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  // Content-sized: long Intl numerals grow the pill instead of overflowing it.
  minInlineSize: marker,
  blockSize: marker,
  paddingInline: vars.space[1],
  border: `${CONNECTOR_THICKNESS} solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.full,
  backgroundColor: 'transparent',
  color: vars.color.textMuted,
  fontSize: `var(${MARKER_FONT})`,
  fontWeight: vars.fontWeight.medium,
  fontVariantNumeric: 'tabular-nums',
  lineHeight: 1,
  whiteSpace: 'nowrap',
  transitionProperty: 'background-color, border-color, color',
  transitionDuration: vars.motion.duration.base,
  transitionTimingFunction: vars.motion.easeStandard,
  '& svg': { inlineSize: '1em', blockSize: '1em' },
  // Generated content keeps the decorative numeral out of the button's visible-text name check.
  '&[data-numeral]::before': { content: 'attr(data-numeral)' },
  '&[data-state="complete"]': {
    borderColor: vars.color.accent,
    backgroundColor: vars.color.accent,
    color: vars.color.accentContrast,
  },
  // Beyond color, the current marker gains a detached halo ring and a heavier numeral. The halo
  // sits inside the head's padding, so the head's focus ring still draws outside it.
  '&[data-state="current"]': {
    borderColor: vars.color.accent,
    backgroundColor: vars.color.accentSoft,
    color: vars.color.text,
    fontWeight: vars.fontWeight.semibold,
    outline: `${CONNECTOR_THICKNESS} solid ${vars.color.accent}`,
    outlineOffset: CONNECTOR_THICKNESS,
  },
  '&[data-state="error"]': {
    borderColor: vars.color.dangerText,
    backgroundColor: vars.color.dangerSoft,
    color: vars.color.dangerText,
  },
  [REDUCED_MOTION]: { transitionDuration: '0s' },
  [FORCED_COLORS]: {
    borderColor: 'CanvasText',
    '&[data-state="current"], &[data-state="error"]': { borderColor: 'Highlight', outlineColor: 'Highlight' },
    '&[data-state="complete"]': {
      forcedColorAdjust: 'none',
      borderColor: 'Highlight',
      backgroundColor: 'Highlight',
      color: 'HighlightText',
    },
  },
});

const labelStyle = css({
  display: 'flex',
  alignItems: 'center',
  minBlockSize: marker,
  minInlineSize: 0,
  fontWeight: vars.fontWeight.medium,
  overflowWrap: 'anywhere',
  '&[data-state="current"]': { fontWeight: vars.fontWeight.semibold },
  '&[data-state="upcoming"]': { color: vars.color.textMuted },
  '&[data-state="error"]': { color: vars.color.dangerText },
  ...whenCompact({ '&:not([data-state="error"])': { display: 'none' } }),
});

const descriptionStyle = css({
  gridRow: 2,
  minInlineSize: 0,
  paddingInlineEnd: vars.space[2],
  fontSize: `var(${DETAIL_FONT})`,
  color: vars.color.textMuted,
  overflowWrap: 'anywhere',
  '&[data-state="error"]': { color: vars.color.dangerText },
  // The visible caption repeats the current description aria-hidden, so the original stays readable.
  ...whenCompact({ '&:not([data-state="error"])': visuallyHiddenStyle }),
});

// Horizontal details align with the label; vertical ones sit beside the connector rail.
const descriptionOrientationStyles: Record<StepperOrientation, SerializedStyles> = {
  horizontal: css({
    gridColumn: '1 / -1',
    paddingInlineStart: `calc(${vars.space[1]} + ${marker} + ${vars.space[3]})`,
    [NARROW_LAYOUT_QUERY]: { paddingInlineStart: vars.space[1] },
  }),
  vertical: css({ gridColumn: 2, paddingInlineStart: vars.space[2], paddingBlockEnd: vars.space[2] }),
};

const connectorStyle = css({
  position: 'relative',
  overflow: 'hidden',
  backgroundColor: vars.color.border,
  '&::after': {
    content: '""',
    position: 'absolute',
    inset: 0,
    backgroundColor: vars.color.accent,
    transitionProperty: 'transform',
    transitionDuration: vars.motion.duration.base,
    transitionTimingFunction: vars.motion.easeStandard,
  },
  '&[data-state="complete"]::after': { transform: 'none' },
  [REDUCED_MOTION]: { '&::after': { transitionDuration: '0s' } },
  [FORCED_COLORS]: {
    forcedColorAdjust: 'none',
    backgroundColor: 'CanvasText',
    '&::after': { backgroundColor: 'Highlight' },
  },
});

// The fill grows from the logical start: inline start horizontally, the top vertically.
const connectorOrientationStyles: Record<StepperOrientation, SerializedStyles> = {
  horizontal: css({
    gridColumn: 2,
    gridRow: 1,
    blockSize: CONNECTOR_THICKNESS,
    marginInline: vars.space[2],
    marginBlockStart: `calc(${vars.space[1]} + ${marker} / 2 - ${CONNECTOR_THICKNESS} / 2)`,
    '&:not([data-state="complete"])::after': { transform: 'scaleX(0)' },
    '&::after': { transformOrigin: 'left' },
    '&:dir(rtl)::after': { transformOrigin: 'right' },
  }),
  vertical: css({
    gridColumn: 1,
    gridRow: 2,
    justifySelf: 'center',
    inlineSize: CONNECTOR_THICKNESS,
    minBlockSize: vars.space[6],
    marginBlock: vars.space[1],
    '&:not([data-state="complete"])::after': { transform: 'scaleY(0)' },
    '&::after': { transformOrigin: 'top' },
  }),
};

const captionStyle = css({
  marginBlockStart: vars.space[3],
  fontSize: vars.textSize.sm,
  color: vars.color.textMuted,
  overflowWrap: 'anywhere',
  '&[data-complete]': { color: vars.color.text, fontWeight: vars.fontWeight.medium },
  '&:not([data-complete])': { display: 'none' },
  ...whenCompact({ '&:not([data-complete])': { display: 'block' } }),
});

const captionTitleStyle = css({
  display: 'block',
  color: vars.color.text,
  fontWeight: vars.fontWeight.medium,
});

export function Stepper(props: StepperProps) {
  const {
    ref,
    steps,
    value: valueProp,
    defaultValue = 0,
    onValueChange,
    interactive = false,
    orientation = 'horizontal',
    details = 'all',
    compact = false,
    responsive = true,
    size = 'md',
    label = DEFAULT_LABEL,
    completeLabel = DEFAULT_COMPLETE_LABEL,
    locale,
    getStepLabel,
    getChangeLabel,
    announceChanges = false,
    slotProps,
    slots,
    className,
    sx,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    ...rest
  } = props;
  const Root = slots?.root ?? (interactive ? 'nav' : 'div');
  const List = slots?.list ?? 'ol';
  const Item = slots?.item ?? 'li';
  const InteractiveHead = slots?.head ?? 'button';
  const Head = slots?.head ?? 'span';
  const Marker = slots?.marker ?? 'span';
  const Label = slots?.label ?? 'span';
  const Description = slots?.description ?? 'span';
  const Connector = slots?.connector ?? 'span';
  const Caption = slots?.caption ?? 'div';
  const mergedRootRef = useMergeRefs([ref as Ref<HTMLDivElement>, slotProps?.root?.ref]);

  const count = steps.length;
  const baseId = useId();
  const [rawCurrent, requestChange] = useControlledState(
    normalizeIndex(valueProp, count),
    normalizeIndex(defaultValue, count),
    onValueChange,
  );
  const current = normalizeIndex(rawCurrent, count) ?? 0;
  const currentStep = steps[current] ?? null;
  const allComplete = count > 0 && currentStep === null;

  const numberFormat = numberFormatter(locale);
  const stepLabel = getStepLabel ?? defaultStepLabel(numberFormat);
  const changeLabel = getChangeLabel ?? defaultChangeLabel(numberFormat);

  // Accepted changes only, adjusted during render: nothing is announced on mount or focus moves.
  const [announcedIndex, setAnnouncedIndex] = useState(current);
  const [announcement, setAnnouncement] = useState('');
  if (announcedIndex !== current) {
    setAnnouncedIndex(current);
    if (announceChanges) setAnnouncement(changeLabel(currentStep, current, count));
  }

  const isReachable = (index: number) =>
    index === current || (index < current && steps[index]?.disabled !== true);
  const reachable = interactive ? steps.flatMap((_, index) => (isReachable(index) ? [index] : [])) : [];

  const [focusedId, setFocusedId] = useState<string | null>(null);
  const focusedIndex = steps.findIndex((step) => step.id === focusedId);
  const tabStop = reachable.includes(focusedIndex)
    ? focusedIndex
    : reachable.includes(current)
      ? current
      : reachable[0];

  const buttons = useRef(new Map<string, HTMLButtonElement>());
  // Set when a focused step button leaves the DOM; focus returns to the roving stop only if
  // nothing else took it in the meantime.
  const focusLost = useRef(false);
  useLayoutEffect(() => {
    if (!focusLost.current) return;
    focusLost.current = false;
    const tabStopButton = tabStop === undefined ? undefined : buttons.current.get(steps[tabStop]?.id ?? '');
    const active = tabStopButton?.ownerDocument.activeElement;
    if (tabStopButton && (!active || active === tabStopButton.ownerDocument.body)) tabStopButton.focus();
  });

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const isRtl = getComputedStyle(event.currentTarget).direction === 'rtl';
    const [backKey, forwardKey] =
      orientation === 'vertical' ? ['ArrowUp', 'ArrowDown'] : isRtl ? ['ArrowRight', 'ArrowLeft'] : ['ArrowLeft', 'ArrowRight'];
    // A pointer-focused unreachable step moves relative to the roving stop.
    const position = reachable.indexOf(reachable.includes(index) ? index : (tabStop ?? -1));
    const targets: Record<string, number | undefined> = {
      [backKey]: reachable[Math.max(position - 1, 0)],
      [forwardKey]: reachable[Math.min(position + 1, reachable.length - 1)],
      Home: reachable[0],
      End: reachable.at(-1),
    };
    if (!(event.key in targets)) return;
    event.preventDefault();
    const target = targets[event.key];
    const targetStep = target === undefined ? undefined : steps[target];
    if (targetStep) buttons.current.get(targetStep.id)?.focus();
  };

  const select = (index: number) => {
    if (index < current && steps[index]?.disabled !== true) requestChange(index);
  };

  const {
    className: headClassName,
    sx: headCss,
    onClick: onHeadClick,
    onKeyDown: onHeadKeyDown,
    onFocus: onHeadFocus,
    'aria-describedby': headAriaDescribedBy,
    ...headRest
  } = slotProps?.head ?? {};

  const list = (
    <List
      {...withoutSx(slotProps?.list)}
      role="list"
      data-ui="stepper-list"
      className={slotProps?.list?.className}
      css={[listStyles[orientation], slotProps?.list?.sx]}
    >
      {steps.map((step, index) => {
        const status = getStatus(step, index, current);
        const isCurrent = index === current;
        const name = stepLabel(step, index, count, status);
        const hasError = status === 'error';
        const showDetail =
          hasError || (isRenderable(step.description) && (details === 'all' || isCurrent));
        const detailId = partId(baseId, 'detail', step.id);
        const hasIcon = isRenderable(step.icon);
        const glyph = status === 'complete' ? <CheckGlyph /> : hasError ? <ErrorGlyph /> : null;
        const numeral = hasIcon || glyph ? undefined : numberFormat.format(index + 1);

        const headContent = (
          <>
            <Marker
              {...withoutSx(slotProps?.marker)}
              aria-hidden="true"
              data-ui="stepper-marker"
              data-state={status}
              data-numeral={numeral}
              className={slotProps?.marker?.className}
              css={[markerStyle, slotProps?.marker?.sx]}
            >
              {hasIcon ? step.icon : glyph}
            </Marker>
            <Label
              {...withoutSx(slotProps?.label)}
              aria-hidden={interactive ? undefined : true}
              data-ui="stepper-label"
              data-state={status}
              className={slotProps?.label?.className}
              css={[labelStyle, slotProps?.label?.sx]}
            >
              {step.label}
            </Label>
            {!interactive && <span css={visuallyHiddenStyle}>{name}</span>}
          </>
        );

        return (
          <Item
            {...withoutSx(slotProps?.item)}
            key={step.id}
            role="listitem"
            data-ui="stepper-item"
            data-state={status}
            aria-current={isCurrent ? 'step' : undefined}
            aria-label={name}
            className={slotProps?.item?.className}
            css={[itemStyles[orientation], slotProps?.item?.sx]}
          >
            {interactive ? (
              <InteractiveHead
                {...headRest}
                ref={(node) => {
                  if (!node) return;
                  buttons.current.set(step.id, node);
                  return () => {
                    buttons.current.delete(step.id);
                    if (node.ownerDocument.activeElement === node) focusLost.current = true;
                  };
                }}
                type="button"
                data-ui="stepper-head"
                data-state={status}
                tabIndex={index === tabStop ? 0 : -1}
                aria-current={isCurrent ? 'step' : undefined}
                aria-disabled={index < current && !step.disabled ? undefined : true}
                aria-label={name}
                aria-describedby={joinIds(headAriaDescribedBy, showDetail && detailId)}
                className={headClassName}
                css={[headStyle, headOrientationStyles[orientation], buttonHeadStyle, headCss]}
                onFocus={(event) => {
                  onHeadFocus?.(event);
                  setFocusedId(step.id);
                }}
                onKeyDown={(event) => {
                  onHeadKeyDown?.(event);
                  if (!event.defaultPrevented) handleKeyDown(event, index);
                }}
                onClick={(event) => {
                  onHeadClick?.(event);
                  if (!event.defaultPrevented) select(index);
                }}
              >
                {headContent}
              </InteractiveHead>
            ) : (
              <Head
                {...headRest}
                data-ui="stepper-head"
                data-state={status}
                className={headClassName}
                css={[headStyle, headOrientationStyles[orientation], headCss]}
              >
                {headContent}
              </Head>
            )}
            {showDetail && (
              <Description
                {...withoutSx(slotProps?.description)}
                id={detailId}
                data-ui="stepper-description"
                data-state={status}
                className={slotProps?.description?.className}
                css={[descriptionStyle, descriptionOrientationStyles[orientation], slotProps?.description?.sx]}
              >
                {hasError ? step.error : step.description}
              </Description>
            )}
            {index < count - 1 && (
              <Connector
                {...withoutSx(slotProps?.connector)}
                aria-hidden="true"
                data-ui="stepper-connector"
                data-state={index < current ? 'complete' : 'upcoming'}
                className={slotProps?.connector?.className}
                css={[connectorStyle, connectorOrientationStyles[orientation], slotProps?.connector?.sx]}
              />
            )}
          </Item>
        );
      })}
    </List>
  );

  // The current-step caption repeats the step's accessible name, so it is hidden from assistive
  // tech; the completion caption is the only statement of completion and stays exposed.
  const caption = allComplete ? (
    isRenderable(completeLabel) && (
      <Caption
        {...withoutSx(slotProps?.caption)}
        data-ui="stepper-caption"
        data-complete=""
        className={slotProps?.caption?.className}
        css={[captionStyle, slotProps?.caption?.sx]}
      >
        {completeLabel}
      </Caption>
    )
  ) : (
    currentStep && (
      <Caption
        {...withoutSx(slotProps?.caption)}
        aria-hidden="true"
        data-ui="stepper-caption"
        className={slotProps?.caption?.className}
        css={[captionStyle, slotProps?.caption?.sx]}
      >
        <span css={captionTitleStyle}>{currentStep.label}</span>
        {!isRenderable(currentStep.error) && isRenderable(currentStep.description) && currentStep.description}
      </Caption>
    )
  );

  const rootProps = {
    ...rest,
    'data-ui': 'stepper',
    'data-orientation': orientation,
    'data-size': size,
    'data-compact': compact ? '' : undefined,
    'data-auto-compact': responsive && orientation === 'horizontal' ? '' : undefined,
    'aria-label': ariaLabel ?? (ariaLabelledBy === undefined ? label : undefined),
    'aria-labelledby': ariaLabelledBy,
  };

  const children = (
    <>
      {list}
      {caption}
      {announceChanges && (
        <span aria-live="polite" aria-atomic="true" data-ui="stepper-live" css={visuallyHiddenStyle}>
          {announcement}
        </span>
      )}
    </>
  );

  return (
    <WithSx
      className={[slotProps?.root?.className, className].filter(Boolean).join(' ') || undefined}
      styles={[rootStyle, rootSizeStyles[size], slotProps?.root?.sx]}
      sx={sx}
    >
      {(rootClassName) =>
        interactive ? (
          // The mode discriminates the prop union, so an interactive ref targets the <nav>.
          <Root {...withoutSx(slotProps?.root)} css={undefined} {...rootProps} ref={mergedRootRef} className={rootClassName}>
            {children}
          </Root>
        ) : (
          <Root {...withoutSx(slotProps?.root)} css={undefined} {...rootProps} ref={mergedRootRef} role="group" className={rootClassName}>
            {children}
          </Root>
        )
      }
    </WithSx>
  );
}

Stepper.displayName = 'Stepper';
