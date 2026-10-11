'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type ComponentPropsWithoutRef,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { animate, MotionConfig, motion, useMotionValue, useReducedMotion } from 'motion/react';
import { vars } from '@jfrader/tokens/vars';
import { choiceInputStyle, choiceRootStateStyle } from '../../styling/choice-control';
import { css, type Interpolation, type SerializedStyles, type Theme } from '../../styling/css';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import { WithSx, type SxProps } from '../../styling/sx';
import { isRenderable } from '../../utils/renderable';
import { useControlledState } from '../../utils/use-controlled-state';

export type RadioCardsLayout = 'grid' | 'list';
export type RadioCardsSize = 'sm' | 'md';
export interface RadioCardsProps
  extends Omit<ComponentPropsWithRef<'div'>, 'onChange' | 'defaultValue'>, SxProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  name?: string;
  required?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  error?: ReactNode;
  layout?: RadioCardsLayout;
  minColumnWidth?: CSSProperties['inlineSize'];
  size?: RadioCardsSize;
}
export type RadioCardsPartProps = ComponentPropsWithoutRef<'span'> & { css?: Interpolation<Theme> };
export interface RadioCardsItemProps
  extends
    Omit<
      ComponentPropsWithRef<'input'>,
      'type' | 'name' | 'checked' | 'defaultChecked' | 'value' | 'size' | 'children'
    >,
    SxProps {
  value: string;
  label: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  icon?: ReactNode;
  disabledReason?: ReactNode;
  slotProps?: Partial<
    Record<'control' | 'indicator' | 'icon' | 'label' | 'description' | 'meta', RadioCardsPartProps>
  >;
}
export type RadioCardsLabelProps = ComponentPropsWithRef<'span'> & SxProps;
export type RadioCardsDescriptionProps = ComponentPropsWithRef<'span'> & SxProps;
type Relationship = 'label' | 'description';
interface CardsContext {
  value: string | undefined;
  requestChange: (value: string) => void;
  name: string;
  disabled: boolean;
  required: boolean;
  invalid: boolean;
  size: RadioCardsSize;
  register: (kind: Relationship, id: string) => () => void;
}
const Context = createContext<CardsContext | null>(null);
const MIN_COLUMN_WIDTH = '12rem';
const RING_SPRING = { type: 'spring', stiffness: 500, damping: 45 } as const;
const INPUT_QUERY = 'input[data-ui="radio-cards-input"]';

function useCardsContext(part: string) {
  const context = useContext(Context);
  if (!context) throw new Error(`RadioCards.${part} must be rendered inside <RadioCards>.`);
  return context;
}
function inputs(root: HTMLElement) {
  return Array.from(root.querySelectorAll<HTMLInputElement>(INPUT_QUERY)).filter(
    (input) => input.closest('[data-ui="radio-cards"]') === root,
  );
}
function joinIds(...ids: (string | false | undefined)[]) {
  return ids.filter(Boolean).join(' ') || undefined;
}

const rootStyle = css({
  position: 'relative',
  display: 'grid',
  gap: vars.space[3],
  minInlineSize: 0,
  fontFamily: vars.font.sans,
  lineHeight: vars.lineHeight.base,
  color: vars.color.text,
});
const layoutStyles: Record<RadioCardsLayout, SerializedStyles> = {
  grid: css({ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, var(--radio-cards-column)), 1fr))' }),
  list: css({ gridTemplateColumns: 'minmax(0, 1fr)' }),
};
const itemStyle = css({
  position: 'relative',
  display: 'flex',
  minInlineSize: 0,
  cursor: 'pointer',
  'input:checked + span': { borderColor: vars.color.accent, backgroundColor: vars.color.accentSoft },
  'input:checked + span [data-ui="radio-cards-indicator"]': { borderColor: vars.color.accent },
  'input:checked + span [data-ui="radio-cards-indicator"]::after': { transform: 'scale(1)' },
  '&:hover:not(:has(input:disabled)) input:not(:checked) + span': {
    backgroundColor: vars.color.surfaceHover,
  },
  '&:has(input:disabled)': { opacity: 1, cursor: 'not-allowed' },
  '&:has(input:disabled) > span': { borderStyle: 'dashed' },
  [FORCED_COLORS]: {
    'input:checked + span': { borderColor: 'Highlight', backgroundColor: 'Canvas' },
    'input:checked + span [data-ui="radio-cards-indicator"]': { borderColor: 'Highlight' },
    'input:focus-visible + span': { outlineColor: 'Highlight' },
    '&:has(input:disabled) > span': { borderColor: 'GrayText' },
  },
});
const inputStyle = css({ inset: 0, inlineSize: '100%', blockSize: '100%', cursor: 'inherit' });
const controlStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'flex-start',
  gap: vars.space[2],
  inlineSize: '100%',
  minInlineSize: 0,
  minBlockSize: vars.space[8],
  boxSizing: 'border-box',
  border: `2px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.lg,
  backgroundColor: vars.color.surfaceRaised,
  color: vars.color.text,
  transitionProperty: 'background-color, border-color',
  transitionDuration: vars.motion.duration.fast,
  transitionTimingFunction: vars.motion.easeStandard,
  [REDUCED_MOTION]: { transitionDuration: '0s' },
  [FORCED_COLORS]: { borderColor: 'CanvasText' },
});
const sizeStyles: Record<RadioCardsSize, SerializedStyles> = {
  sm: css({ padding: vars.space[3], fontSize: vars.textSize.sm }),
  md: css({ padding: vars.space[4], fontSize: vars.textSize.md }),
};
const indicatorStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  inlineSize: vars.space[4],
  blockSize: vars.space[4],
  marginBlockStart: vars.space[1],
  border: `1px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.full,
  '&::after': {
    content: '""',
    inlineSize: '50%',
    blockSize: '50%',
    borderRadius: vars.radius.full,
    backgroundColor: vars.color.accent,
    transform: 'scale(0)',
    transitionProperty: 'transform',
    transitionDuration: vars.motion.duration.fast,
    transitionTimingFunction: vars.motion.easeStandard,
  },
  [REDUCED_MOTION]: { '&::after': { transitionDuration: '0s' } },
  [FORCED_COLORS]: { borderColor: 'CanvasText', '&::after': { backgroundColor: 'Highlight' } },
});
const contentStyle = css({
  display: 'grid',
  gap: vars.space[1],
  flex: '1 1 8rem',
  minInlineSize: 0,
  overflowWrap: 'anywhere',
});
const labelStyle = css({ fontWeight: vars.fontWeight.medium });
const descriptionStyle = css({ fontSize: vars.textSize.sm, color: vars.color.textMuted });
const metaStyle = css({
  marginInlineStart: 'auto',
  minInlineSize: 0,
  maxInlineSize: '100%',
  overflowWrap: 'anywhere',
  fontSize: vars.textSize.sm,
});
const iconStyle = css({
  display: 'inline-flex',
  flexShrink: 0,
  fontSize: vars.textSize.lg,
  '& > svg': { inlineSize: '1em', blockSize: '1em' },
});
const groupPartStyle = css({ gridColumn: '1 / -1', minInlineSize: 0, overflowWrap: 'anywhere' });
const errorStyle = css({ gridColumn: '1 / -1', color: vars.color.dangerText, fontSize: vars.textSize.sm });
const ringStyle = css({
  position: 'absolute',
  top: 0,
  left: 0,
  boxSizing: 'border-box',
  pointerEvents: 'none',
  border: `2px solid ${vars.color.accent}`,
  borderRadius: vars.radius.lg,
  [FORCED_COLORS]: { borderColor: 'Highlight' },
});

function SelectionRing({
  root,
  value,
  content,
}: {
  root: { current: HTMLDivElement | null };
  value: string | undefined;
  content: ReactNode;
}) {
  const reducedMotion = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const width = useMotionValue(0);
  const height = useMotionValue(0);
  const [visible, setVisible] = useState(false);
  const previous = useRef<string | undefined>(undefined);
  const initialized = useRef(false);
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const selected = inputs(element).find((input) => input.value === value)?.nextElementSibling as
      HTMLElement | undefined;
    const controls: ReturnType<typeof animate>[] = [];
    const stop = () => {
      controls.splice(0).forEach((control) => control.stop());
    };
    if (!selected) {
      setVisible(false);
      initialized.current = false;
      previous.current = value;
      return;
    }
    let lastCoordinates: number[] = [];
    const measure = (glide: boolean) => {
      const bounds = selected.getBoundingClientRect();
      const origin = element.getBoundingClientRect();
      const coordinates = [
        bounds.left - origin.left - element.clientLeft + element.scrollLeft,
        bounds.top - origin.top - element.clientTop + element.scrollTop,
        bounds.width,
        bounds.height,
      ];
      if (coordinates.every((coordinate, index) => coordinate === lastCoordinates[index])) return;
      lastCoordinates = coordinates;
      stop();
      [x, y, width, height].forEach((coordinate, index) => {
        if (glide && !reducedMotion) controls.push(animate(coordinate, coordinates[index]!, RING_SPRING));
        else coordinate.set(coordinates[index]!);
      });
      setVisible(true);
    };
    measure(initialized.current && previous.current !== value);
    initialized.current = true;
    previous.current = value;
    const observer = new ResizeObserver(() => measure(false));
    observer.observe(element);
    inputs(element).forEach((input) => {
      if (input.nextElementSibling) observer.observe(input.nextElementSibling);
    });
    return () => {
      observer.disconnect();
      stop();
    };
  }, [root, value, reducedMotion, x, y, width, height]);
  return (
    <motion.span
      aria-hidden="true"
      data-ui="radio-cards-ring"
      hidden={!visible}
      style={{ x, y, width, height }}
      css={ringStyle}
    />
  );
}

function RadioCardsRoot({
  ref,
  value: valueProp,
  defaultValue,
  onValueChange,
  name: nameProp,
  required = false,
  disabled = false,
  invalid = false,
  error,
  layout = 'grid',
  minColumnWidth = MIN_COLUMN_WIDTH,
  size = 'md',
  className,
  sx,
  style,
  children,
  onKeyDown,
  'aria-labelledby': labelledBy,
  'aria-describedby': describedBy,
  'aria-invalid': ariaInvalid,
  ...rest
}: RadioCardsProps) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  useImperativeHandle(ref, () => rootRef.current as HTMLDivElement, []);
  const [value, requestChange, resetToDefault] = useControlledState(valueProp, defaultValue, onValueChange);
  const [relationships, setRelationships] = useState<Record<Relationship, string[]>>({
    label: [],
    description: [],
  });
  const hasError = isRenderable(error);
  const register = useCallback((kind: Relationship, partId: string) => {
    setRelationships((current) => ({ ...current, [kind]: [...current[kind], partId] }));
    return () =>
      setRelationships((current) => ({
        ...current,
        [kind]: current[kind].filter((entry) => entry !== partId),
      }));
  }, []);
  const context = useMemo<CardsContext>(
    () => ({
      value,
      requestChange,
      name: nameProp ?? id,
      disabled,
      required,
      invalid: invalid || hasError,
      size,
      register,
    }),
    [value, requestChange, nameProp, id, disabled, required, invalid, hasError, size, register],
  );
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const forms = new Set(
      inputs(root)
        .map((input) => input.form)
        .filter((form) => form !== null),
    );
    const reset = (event: Event) => {
      queueMicrotask(() => {
        if (event.defaultPrevented) return;
        resetToDefault();
        const next = valueProp !== undefined ? valueProp : defaultValue;
        inputs(root).forEach((input) => {
          input.checked = input.value === next;
        });
      });
    };
    forms.forEach((form) => form.addEventListener('reset', reset));
    return () => forms.forEach((form) => form.removeEventListener('reset', reset));
  }, [resetToDefault, valueProp, defaultValue]);
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented || disabled) return;
    const available = inputs(event.currentTarget).filter((input) => !input.disabled);
    const index = available.indexOf(event.target as HTMLInputElement);
    if (index < 0) return;
    const rtl = getComputedStyle(event.currentTarget).direction === 'rtl';
    const targets: Record<string, number> = {
      ArrowRight: index + (rtl ? -1 : 1),
      ArrowLeft: index + (rtl ? 1 : -1),
      ArrowDown: index + 1,
      ArrowUp: index - 1,
      Home: 0,
      End: available.length - 1,
      Enter: index,
    };
    const target = targets[event.key];
    if (target === undefined) return;
    event.preventDefault();
    const input = available[(target + available.length) % available.length]!;
    input.focus();
    input.click();
  };
  return (
    <Context.Provider value={context}>
      <WithSx className={className} styles={[rootStyle, layoutStyles[layout]]} sx={sx}>
        {(className) => (
          <div
            {...rest}
            ref={rootRef}
            role="radiogroup"
            data-ui="radio-cards"
            data-layout={layout}
            aria-labelledby={joinIds(labelledBy, ...relationships.label)}
            aria-describedby={joinIds(describedBy, ...relationships.description, hasError && `${id}-error`)}
            aria-required={required || undefined}
            aria-disabled={disabled || undefined}
            aria-invalid={invalid || hasError ? true : ariaInvalid}
            onKeyDown={handleKeyDown}
            className={className}
            style={
              {
                ...style,
                '--radio-cards-column':
                  typeof minColumnWidth === 'number' ? `${minColumnWidth}px` : minColumnWidth,
              } as CSSProperties
            }
          >
            {children}
            {hasError && (
              <span id={`${id}-error`} role="alert" data-ui="radio-cards-error" css={errorStyle}>
                {error}
              </span>
            )}
            <MotionConfig reducedMotion="user">
              <SelectionRing root={rootRef} value={value} content={children} />
            </MotionConfig>
          </div>
        )}
      </WithSx>
    </Context.Provider>
  );
}
RadioCardsRoot.displayName = 'RadioCards';

function RadioCardsItem({
  ref,
  value,
  label,
  description,
  meta,
  icon,
  disabledReason,
  disabled: disabledProp,
  required: requiredProp,
  onChange,
  slotProps,
  className,
  sx,
  'aria-label': ariaLabel,
  'aria-labelledby': labelledBy,
  'aria-describedby': describedBy,
  'aria-invalid': ariaInvalid,
  ...rest
}: RadioCardsItemProps) {
  const context = useCardsContext('Item');
  const id = useId();
  const disabled = context.disabled || disabledProp;
  const detail = disabled && isRenderable(disabledReason) ? disabledReason : description;
  const hasLabel = isRenderable(label);
  const hasDetail = isRenderable(detail);
  return (
    <WithSx className={className} styles={[choiceRootStateStyle, itemStyle]} sx={sx}>
      {(className) => (
        <label
          data-ui="radio-cards-item"
          data-state={context.value === value ? 'checked' : 'unchecked'}
          className={className}
        >
          <input
            {...rest}
            ref={ref}
            type="radio"
            data-ui="radio-cards-input"
            name={context.name}
            value={value}
            checked={context.value === value}
            disabled={disabled}
            required={context.required || requiredProp}
            aria-label={ariaLabel}
            aria-labelledby={joinIds(labelledBy, !ariaLabel && hasLabel && `${id}-label`)}
            aria-describedby={joinIds(describedBy, hasDetail && `${id}-description`)}
            aria-invalid={context.invalid ? true : ariaInvalid}
            onChange={(event) => {
              onChange?.(event);
              if (event.currentTarget.checked) context.requestChange(value);
            }}
            css={[choiceInputStyle, inputStyle]}
          />
          <span
            {...slotProps?.control}
            data-ui="radio-cards-control"
            css={[controlStyle, sizeStyles[context.size], slotProps?.control?.css]}
          >
            <span
              {...slotProps?.indicator}
              aria-hidden="true"
              data-ui="radio-cards-indicator"
              css={[indicatorStyle, slotProps?.indicator?.css]}
            />
            {isRenderable(icon) && (
              <span
                {...slotProps?.icon}
                aria-hidden="true"
                data-ui="radio-cards-icon"
                css={[iconStyle, slotProps?.icon?.css]}
              >
                {icon}
              </span>
            )}
            {(hasLabel || hasDetail) && (
              <span css={contentStyle}>
                {hasLabel && (
                  <span
                    {...slotProps?.label}
                    id={`${id}-label`}
                    data-ui="radio-cards-item-label"
                    css={[labelStyle, slotProps?.label?.css]}
                  >
                    {label}
                  </span>
                )}
                {hasDetail && (
                  <span
                    {...slotProps?.description}
                    id={`${id}-description`}
                    data-ui="radio-cards-item-description"
                    css={[descriptionStyle, slotProps?.description?.css]}
                  >
                    {detail}
                  </span>
                )}
              </span>
            )}
            {isRenderable(meta) && (
              <span {...slotProps?.meta} data-ui="radio-cards-meta" css={[metaStyle, slotProps?.meta?.css]}>
                {meta}
              </span>
            )}
          </span>
        </label>
      )}
    </WithSx>
  );
}
RadioCardsItem.displayName = 'RadioCards.Item';

function GroupPart({
  kind,
  ref,
  id: idProp,
  children,
  className,
  sx,
  ...rest
}: RadioCardsLabelProps & { kind: Relationship }) {
  const { register } = useCardsContext(kind === 'label' ? 'Label' : 'Description');
  const generatedId = useId();
  const id = idProp ?? generatedId;
  const present = isRenderable(children);
  useEffect(() => (present ? register(kind, id) : undefined), [register, kind, id, present]);
  if (!present) return null;
  return (
    <WithSx
      className={className}
      styles={[groupPartStyle, kind === 'label' ? labelStyle : descriptionStyle]}
      sx={sx}
    >
      {(className) => (
        <span {...rest} ref={ref} id={id} data-ui={`radio-cards-${kind}`} className={className}>
          {children}
        </span>
      )}
    </WithSx>
  );
}
function RadioCardsLabel(props: RadioCardsLabelProps) {
  return <GroupPart {...props} kind="label" />;
}
function RadioCardsDescription(props: RadioCardsDescriptionProps) {
  return <GroupPart {...props} kind="description" />;
}
RadioCardsLabel.displayName = 'RadioCards.Label';
RadioCardsDescription.displayName = 'RadioCards.Description';
export const RadioCards = Object.assign(RadioCardsRoot, {
  Item: RadioCardsItem,
  Label: RadioCardsLabel,
  Description: RadioCardsDescription,
});
