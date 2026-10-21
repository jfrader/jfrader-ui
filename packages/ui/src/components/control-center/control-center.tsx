'use client';

import {
  useEffect,
  useId,
  useMemo,
  useState,
  type ComponentPropsWithRef,
  type ComponentType,
  type ReactNode,
} from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type Theme } from '../../styling/css';
import type { SxProps } from '../../styling/sx';
import { useControlledState } from '../../utils/use-controlled-state';
import { resolveTimeOptions } from '../../utils/intl';
import { Button, type ButtonProps } from '../button';
import { Avatar } from '../avatar';
import { Dialog, type DialogContentProps } from '../dialog';
import { RadioGroup, type RadioGroupProps, type RadioGroupShorthandProps } from '../radio-group';
import { Slider, type SliderProps } from '../slider';
import { Switch, type SwitchProps } from '../switch';
import { FieldSlot, type FieldParts, type FieldSlots } from '../field/field-slot';
import {
  DEFAULT_FOCUS_MINUTES,
  bounded,
  controlCenterLimits,
  focusSession,
  normalizeSettings,
  type ControlCenterValue,
} from './control-center-config';

declare const process: { env: { NODE_ENV?: string } };

export type { ControlCenterValue } from './control-center-config';
export interface ControlCenterLabels {
  focus: string;
  notifications: string;
  presenting: string;
  focusDetails: string;
  notificationDetails: string;
  focusDescription: string;
  notificationDescription: string;
  modes: string;
  duration: string;
  volume: string;
  textSize: string;
  start: string;
  update: string;
  close: string;
  inactive: string;
  until: (time: string) => string;
  minutes: (minutes: number) => string;
}
type NativeAnatomy = { root: 'section'; grid: 'div'; status: 'p'; actions: 'div' };
type SlotProps<T> = Partial<
  Omit<
    T,
    | 'sx'
    | 'children'
    | 'defaultValue'
    | 'value'
    | 'onValueChange'
    | 'type'
    | 'thumbLabels'
    | 'minStepsBetweenThumbs'
  >
> & { sx?: Interpolation<Theme> };
export interface ControlCenterSlotProps extends FieldParts<NativeAnatomy> {
  tile?: SlotProps<ButtonProps>;
  detailTrigger?: SlotProps<ButtonProps>;
  meter?: SlotProps<Extract<SliderProps, { type?: 'single' }>>;
  dial?: SlotProps<Extract<SliderProps, { type?: 'single' }>>;
  modes?: SlotProps<RadioGroupShorthandProps>;
  channel?: SlotProps<SwitchProps>;
  person?: SlotProps<SwitchProps>;
  /** Uses `Dialog.Content` by default. */
  detail?: SlotProps<DialogContentProps>;
}
export interface ControlCenterSlots extends FieldSlots<NativeAnatomy> {
  root?: ComponentType<ComponentPropsWithRef<'section'>>;
  tile?: ComponentType<ButtonProps>;
  detailTrigger?: ComponentType<ButtonProps>;
  meter?: ComponentType<SliderProps>;
  dial?: ComponentType<SliderProps>;
  modes?: ComponentType<RadioGroupShorthandProps>;
  channel?: ComponentType<SwitchProps>;
  person?: ComponentType<SwitchProps>;
  /** Uses `Dialog.Content` by default. */
  detail?: ComponentType<DialogContentProps>;
}
export interface ControlCenterProps
  extends Omit<ComponentPropsWithRef<'section'>, 'children' | 'defaultValue' | 'onChange'>,
    SxProps {
  /** Names the settings section unless `aria-label` is supplied. */
  label: string;
  /** Supplies visible labels, descriptions and status message formatters. */
  labels: ControlCenterLabels;
  /** Defines focus modes and their initial durations in minutes; the first mode is the default. */
  focusModes: readonly {
    value: string;
    label: string;
    icon?: ReactNode;
    description: string;
    defaultMinutes: number;
  }[];
  /** Defines notification channels and their initial checked states. */
  channels: readonly {
    value: string;
    label: string;
    description?: string;
    defaultChecked?: boolean;
  }[];
  /** Lists people who can be allowed through during focus. Defaults to an empty list. */
  people?: readonly { value: string; name: string; avatar?: string }[];
  /** Controls committed settings; numeric settings are bounded to the supported ranges. */
  value?: ControlCenterValue;
  /** Seeds uncontrolled settings; omitted values use the built-in settings defaults. */
  defaultValue?: Partial<ControlCenterValue>;
  /** Requests committed settings after a control changes or focus details are applied. */
  onValueChange?: (value: ControlCenterValue) => void;
  /** Controls whether the detail dialog is open. */
  open?: boolean;
  /** Opens the detail dialog initially when uncontrolled. Defaults to `false`. */
  defaultOpen?: boolean;
  /** Requests a change to the detail dialog's open state. */
  onOpenChange?: (open: boolean) => void;
  /** Chooses the initial detail panel. Defaults to `focus`. */
  defaultDetail?: 'focus' | 'notifications';
  /** Sets number and focus-end time formatting. Defaults to the runtime locale. */
  locale?: Intl.LocalesArgument;
  /** Sets the focus-end time zone. Defaults to the runtime time zone. */
  timeZone?: string;
  /** Overrides focus-end time formatting, including `locale` and `timeZone`. */
  formatTime?: (date: Date) => string;
  /** Prevents settings changes and disables controls. Defaults to `false`. */
  disabled?: boolean;
  /** Replaces generated parts with components that forward supplied props and refs. */
  slots?: ControlCenterSlots;
  /** Supplies attributes and `sx` to generated parts. */
  slotProps?: ControlCenterSlotProps;
  /** Replaces the section root; `slots.root` takes precedence. */
  component?: ControlCenterSlots['root'];
}
const rootStyle = css({
  display: 'grid',
  gap: vars.space[4],
  padding: vars.space[4],
  color: vars.color.text,
  background: vars.color.surfaceRaised,
  border: `1px solid ${vars.color.borderControl}`,
  borderRadius: vars.radius.lg,
  fontFamily: vars.font.sans,
  minInlineSize: 0,
});
const gridStyle = css({ display: 'flex', flexWrap: 'wrap', gap: vars.space[2] });
const detailStyle = css({ display: 'grid', gap: vars.space[4] });
const statusStyle = css({ margin: 0, fontSize: vars.textSize.sm, overflowWrap: 'anywhere' });
const percent = (value: number, formatter: Intl.NumberFormat) => formatter.format(value / 100);
const percentOptions = { style: 'percent' } as const;

/** Change workspace settings. Focus details stay as a draft until Start or Update. */
export function ControlCenter({
  label,
  labels,
  focusModes,
  channels,
  people = [],
  value,
  defaultValue,
  onValueChange,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  defaultDetail = 'focus',
  locale,
  timeZone,
  formatTime,
  disabled = false,
  slots,
  slotProps,
  component,
  className,
  sx,
  ...rest
}: ControlCenterProps) {
  const [seed] = useState(() => normalizeSettings(defaultValue, focusModes, channels, people));
  const [stored, setStored] = useControlledState(value, seed, onValueChange);
  const current = normalizeSettings(stored, focusModes, channels, people);
  const [open, setOpen] = useControlledState(openProp, defaultOpen, onOpenChange);
  const [detail, setDetail] = useState(defaultDetail);
  const [draft, setDraft] = useState(() => draftFromCurrent());
  const detailId = useId();
  const timeOptions = useMemo(
    () =>
      resolveTimeOptions(
        'ControlCenter',
        locale ?? [],
        timeZone ?? new Intl.DateTimeFormat().resolvedOptions().timeZone,
      ),
    [locale, timeZone],
  );
  useEffect(() => {
    if (open) setDraft(draftFromCurrent());
  }, [open]);
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production')
      timeOptions.problems.forEach((problem) => console.warn(problem));
  }, [timeOptions]);
  const invalidControlled =
    value !== undefined &&
    (value.volume !== current.volume ||
      value.textSize !== current.textSize ||
      (value.focus !== null &&
        (current.focus === null || value.focus.minutes !== current.focus.minutes)));
  useEffect(() => {
    if (invalidControlled && process.env.NODE_ENV !== 'production')
      console.warn('ControlCenter: invalid controlled settings; rendering bounded values.');
  }, [invalidControlled]);
  function draftFromCurrent() {
    return {
      mode: current.focus?.mode ?? focusModes[0]?.value ?? '',
      minutes:
        current.focus?.minutes ??
        bounded(
          focusModes[0]?.defaultMinutes ?? DEFAULT_FOCUS_MINUTES,
          'minutes',
          DEFAULT_FOCUS_MINUTES,
        ),
      allowedPeople: current.focus?.allowedPeople ?? [],
    };
  }
  function change(patch: Partial<ControlCenterValue>) {
    if (!disabled) setStored({ ...current, ...patch });
  }
  function start() {
    if (!focusModes.some((mode) => mode.value === draft.mode)) return;
    change({
      focus: focusSession(draft),
    });
  }
  function show(target: typeof detail, button: HTMLButtonElement) {
    if (disabled) return;
    // Safari does not focus clicked buttons; capture the invoker for dialog focus return.
    button.focus();
    setDraft(draftFromCurrent());
    setDetail(target);
    setOpen(true);
  }
  const Root = slots?.root ?? component ?? 'section';
  const Tile = slots?.tile ?? Button;
  const DetailTrigger = slots?.detailTrigger ?? Button;
  const Meter = slots?.meter ?? Slider;
  const Dial = slots?.dial ?? Slider;
  const Modes = slots?.modes ?? RadioGroup;
  const Channel = slots?.channel ?? Switch;
  const Person = slots?.person ?? Switch;
  const Detail = slots?.detail ?? Dialog.Content;
  const time = current.focus
    ? (
        formatTime ??
        ((date: Date) =>
          new Intl.DateTimeFormat(timeOptions.locale, {
            timeStyle: 'short',
            timeZone: timeOptions.timeZone,
          }).format(date))
      )(new Date(current.focus.until))
    : null;
  return (
    <FieldSlot
      element="section"
      component={Root}
      slotProps={slotProps?.root}
      root
      {...rest}
      className={className}
      styles={rootStyle}
      sx={sx}
      aria-label={rest['aria-label'] ?? label}
      data-ui={['control-center', Reflect.get(rest, 'data-ui')].filter(Boolean).join(' ')}
    >
      <FieldSlot
        element="div"
        component={slots?.grid}
        slotProps={slotProps?.grid}
        styles={gridStyle}
        data-ui="control-center-grid"
      >
        <Tile
          {...slotProps?.tile}
          type="button"
          disabled={disabled || (!current.focus && focusModes.length === 0)}
          aria-pressed={!!current.focus}
          data-ui="control-center-tile"
          onClick={(event) => {
            slotProps?.tile?.onClick?.(event);
            if (event.defaultPrevented) return;
            const mode = focusModes[0];
            change({
              focus: current.focus
                ? null
                : mode
                  ? focusSession({
                      mode: mode.value,
                      minutes: bounded(mode.defaultMinutes, 'minutes', DEFAULT_FOCUS_MINUTES),
                      allowedPeople: [],
                    })
                  : null,
            });
          }}
        >
          {labels.focus}
        </Tile>
        <DetailTrigger
          {...slotProps?.detailTrigger}
          type="button"
          disabled={disabled}
          aria-haspopup="dialog"
          aria-controls={detailId}
          aria-expanded={open && detail === 'focus'}
          data-ui="control-center-detail-trigger"
          onClick={(event) => {
            slotProps?.detailTrigger?.onClick?.(event);
            if (!event.defaultPrevented) show('focus', event.currentTarget);
          }}
        >
          {labels.focusDetails}
        </DetailTrigger>
        <Tile
          {...slotProps?.tile}
          type="button"
          disabled={disabled}
          aria-pressed={current.notifications}
          data-ui="control-center-tile"
          onClick={(event) => {
            slotProps?.tile?.onClick?.(event);
            if (!event.defaultPrevented) change({ notifications: !current.notifications });
          }}
        >
          {labels.notifications}
        </Tile>
        <DetailTrigger
          {...slotProps?.detailTrigger}
          type="button"
          disabled={disabled}
          aria-haspopup="dialog"
          aria-controls={detailId}
          aria-expanded={open && detail === 'notifications'}
          data-ui="control-center-detail-trigger"
          onClick={(event) => {
            slotProps?.detailTrigger?.onClick?.(event);
            if (!event.defaultPrevented) show('notifications', event.currentTarget);
          }}
        >
          {labels.notificationDetails}
        </DetailTrigger>
        <Tile
          {...slotProps?.tile}
          type="button"
          disabled={disabled}
          aria-pressed={current.presenting}
          data-ui="control-center-tile"
          onClick={(event) => {
            slotProps?.tile?.onClick?.(event);
            if (!event.defaultPrevented) change({ presenting: !current.presenting });
          }}
        >
          {labels.presenting}
        </Tile>
      </FieldSlot>
      <FieldSlot
        element="p"
        component={slots?.status}
        slotProps={slotProps?.status}
        styles={statusStyle}
        data-ui="control-center-status"
      >
        {time === null ? labels.inactive : labels.until(time)}
      </FieldSlot>
      {(['volume', 'textSize'] as const).map((axis) => (
        <Meter
          key={axis}
          {...slotProps?.meter}
          type="single"
          label={labels[axis]}
          {...controlCenterLimits[axis]}
          value={current[axis]}
          onValueChange={(next) => change({ [axis]: next })}
          disabled={disabled}
          locale={timeOptions.locale}
          formatOptions={percentOptions}
          formatValue={percent}
          data-ui="control-center-meter"
        />
      ))}
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (next) setDraft(draftFromCurrent());
          setOpen(next);
        }}
      >
        <Detail
          {...slotProps?.detail}
          id={detailId}
          data-ui="control-center-detail"
        >
          <Dialog.Title>
            {detail === 'focus' ? labels.focusDetails : labels.notificationDetails}
          </Dialog.Title>
          <Dialog.Description>
            {detail === 'focus' ? labels.focusDescription : labels.notificationDescription}
          </Dialog.Description>
          <div css={detailStyle}>
            {detail === 'focus' ? (
              <>
                <Modes
                  {...slotProps?.modes}
                  options={focusModes.map((mode) => ({
                    value: mode.value,
                    label: (
                      <>
                        {mode.icon}
                        {mode.label}
                      </>
                    ),
                    description: mode.description,
                  }))}
                  label={labels.modes}
                  value={draft.mode}
                  disabled={disabled}
                  onValueChange={(mode) => {
                    const selected = focusModes.find((item) => item.value === mode);
                    setDraft({
                      ...draft,
                      mode,
                      minutes: bounded(
                        selected?.defaultMinutes ?? draft.minutes,
                        'minutes',
                        DEFAULT_FOCUS_MINUTES,
                      ),
                    });
                  }}
                />
                <Dial
                  {...slotProps?.dial}
                  type="single"
                  label={labels.duration}
                  {...controlCenterLimits.minutes}
                  value={draft.minutes}
                  onValueChange={(minutes) => setDraft({ ...draft, minutes })}
                  disabled={disabled}
                  formatValue={labels.minutes}
                  data-ui="control-center-dial"
                />
                {people.map((person) => (
                  <Person
                    key={person.value}
                    {...slotProps?.person}
                    label={
                      <>
                        <Avatar
                          name={person.name}
                          src={person.avatar}
                          size="sm"
                          aria-hidden="true"
                        />{' '}
                        {person.name}
                      </>
                    }
                    checked={draft.allowedPeople.includes(person.value)}
                    disabled={disabled}
                    onCheckedChange={(checked) =>
                      setDraft({
                        ...draft,
                        allowedPeople: checked
                          ? [...draft.allowedPeople, person.value]
                          : draft.allowedPeople.filter((id) => id !== person.value),
                      })
                    }
                  />
                ))}
                <FieldSlot
                  element="div"
                  component={slots?.actions}
                  slotProps={slotProps?.actions}
                  styles={gridStyle}
                  data-ui="control-center-actions"
                >
                  <Button type="button" disabled={disabled || !focusModes.length} onClick={start}>
                    {current.focus ? labels.update : labels.start}
                  </Button>
                </FieldSlot>
              </>
            ) : (
              channels.map((channel) => (
                <Channel
                  key={channel.value}
                  {...slotProps?.channel}
                  label={channel.label}
                  description={channel.description}
                  checked={current.channels[channel.value] === true}
                  disabled={disabled}
                  onCheckedChange={(checked) =>
                    change({ channels: { ...current.channels, [channel.value]: checked } })
                  }
                />
              ))
            )}
            <Dialog.Close>{labels.close}</Dialog.Close>
          </div>
        </Detail>
      </Dialog>
    </FieldSlot>
  );
}
ControlCenter.displayName = 'ControlCenter';
