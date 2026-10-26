'use client';

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type DOMAttributes,
  type ChangeEventHandler,
  type KeyboardEventHandler,
  type Ref,
  type ComponentPropsWithRef,
  type ComponentType,
  type ReactNode,
} from 'react';
import {
  useInteractions,
  useListNavigation,
  useMergeRefs,
  useRole,
  useTypeahead,
} from '@floating-ui/react';
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type Theme } from '../../styling/css';
import { focusRingInset } from '../../styling/focus-ring';
import { listboxItemStateStyle } from '../../styling/listbox-style';
import { WithSx, type SxProps } from '../../styling/sx';
import { visuallyHiddenStyle } from '../../styling/visually-hidden';
import { Button, type ButtonProps } from '../button';
import { TextField, type TextFieldProps } from '../text-field';
import { Textarea } from '../textarea';
import { Spinner } from '../spinner';
import { RadioGroup } from '../radio-group';
import type { RadioGroupComposedProps } from '../radio-group/radio-group';
import { consumerHandlersFirst } from '../menu/menu';
import { Morph, useMorphContext } from '../morph/morph';

export interface ActionMorphTextComposer {
  /** Selects the built-in text composer. Defaults to `"text"`. */
  kind?: 'text';
  title: string;
  label?: string;
  placeholder?: string;
  multiline?: boolean;
  choices?: {
    label: string;
    options: readonly { value: string; label: string; disabled?: boolean }[];
  };
  submitLabel: string;
  successLabel: string;
  emptyHint?: string;
}
export interface ActionMorphContentComposer {
  /** Selects consumer-owned content instead of the built-in text form. */
  kind: 'content';
  /** Names the composer surface and its heading. */
  title: string;
  /** Renders content with close and back actions. The consumer owns form submission. */
  content: ReactNode | ((api: { close: () => void; back: () => void }) => ReactNode);
}
export type ActionMorphComposer = ActionMorphTextComposer | ActionMorphContentComposer;
export interface ActionMorphAction {
  id: string;
  label: string;
  /** Labels an action group. Groups follow first appearance; actions retain order within each group. */
  group?: string;
  description?: ReactNode;
  icon?: ReactNode;
  shortcut?: string;
  disabled?: boolean;
  composer: ActionMorphComposer;
}
export interface ActionMorphSubmission {
  action: string;
  text: string;
  choice?: string;
}
export interface ActionMorphMessages {
  back: string;
  close: string;
  failure: string;
  emptyFallback: string;
  menuEmpty: string;
  announcePending: (label: string) => string;
  announceSuccess: (label: string) => string;
}
type NativePart<T extends 'div' | 'form' | 'span' | 'h3' | 'button'> = ComponentPropsWithRef<T> & {
  sx?: Interpolation<Theme>;
  'data-ui'?: string;
};
export interface ActionMorphFieldProps
  extends
    Omit<
      TextFieldProps,
      | keyof DOMAttributes<HTMLInputElement>
      | 'ref'
      | 'sx'
      | 'slots'
      | 'slotProps'
      | 'component'
      | 'render'
    >,
    Omit<DOMAttributes<HTMLInputElement | HTMLTextAreaElement>, 'onChange'> {
  ref?: Ref<HTMLInputElement | HTMLTextAreaElement>;
  onChange?: ChangeEventHandler<HTMLInputElement | HTMLTextAreaElement>;
  onKeyDown?: KeyboardEventHandler<HTMLInputElement | HTMLTextAreaElement>;
  multiline?: boolean;
  sx?: Interpolation<Theme>;
}
export interface ActionMorphSlotProps {
  root?: NativePart<'div'>;
  trigger?: ButtonProps;
  surface?: NativePart<'div'>;
  title?: NativePart<'h3'>;
  menuList?: NativePart<'div'>;
  item?: NativePart<'button'>;
  form?: NativePart<'form'>;
  field?: ActionMorphFieldProps;
  choices?: Omit<RadioGroupComposedProps, 'sx'> & {
    sx?: Interpolation<Theme>;
  };
  backButton?: ButtonProps;
  submitButton?: ButtonProps;
  error?: NativePart<'span'>;
  status?: NativePart<'span'>;
}
export type ActionMorphSlots = {
  [K in keyof ActionMorphSlotProps]?: ComponentType<NonNullable<ActionMorphSlotProps[K]>>;
};
export interface ActionMorphProps extends Omit<ComponentPropsWithRef<'div'>, 'onSubmit'>, SxProps {
  /** Supplies the menu actions and each action's composer configuration. */
  actions: readonly ActionMorphAction[];
  /** Names the trigger button. Defaults to `"Create"`. */
  label?: string;
  /** Controls whether the action menu or composer is open. */
  open?: boolean;
  /** Opens the uncontrolled menu initially. Defaults to `false`. */
  defaultOpen?: boolean;
  /** Receives requests to open or close the menu or composer. */
  onOpenChange?: (open: boolean) => void;
  /** Submits the action id, text, and choice. A rejected promise shows failure feedback; omission disables submission. */
  onSubmit?: (submission: ActionMorphSubmission) => void | Promise<unknown>;
  /** Aligns the popup above the trigger's logical edge. Defaults to `"end"`. */
  corner?: 'start' | 'end';
  /** Sets the menu and composer widths. Defaults to `"16rem"` and `"20rem"`. */
  width?: { menu?: string; composer?: string };
  /** Success feedback in milliseconds, default 1600; 0 resets immediately. */
  resetAfter?: number;
  /** Overrides navigation, validation, empty-state, and announcement text. */
  messages?: Partial<ActionMorphMessages>;
  /** Replaces the generated trigger, menu, composer, and feedback parts. */
  slots?: ActionMorphSlots;
  /** Replaces the root `div`. `slots.root` takes precedence. */
  component?: ActionMorphSlots['root'];
  /** Passes props to the generated root, trigger, menu, composer, and feedback parts. */
  slotProps?: ActionMorphSlotProps;
  /** Adds whitespace-separated root markers alongside `action-morph`, with duplicates removed. */
  'data-ui'?: string;
}
const DEFAULT_MESSAGES: ActionMorphMessages = {
  back: 'Back',
  close: 'Close',
  failure: 'Could not save. Try again.',
  emptyFallback: 'Enter some text.',
  menuEmpty: 'No actions available',
  announcePending: (label) => `${label}: sending`,
  announceSuccess: (label) => label,
};
const RESET_MS = 1600;
const TRIGGER_DIMENSION = 56;
const MENU_INLINE_SIZE = '16rem';
const COMPOSER_INLINE_SIZE = '20rem';
const MENU_STEP = 'menu';
const ACTION_STEP_PREFIX = 'action:';
const rootStyle = css({ display: 'inline-flex', position: 'relative' });
const triggerStyle = css({
  inlineSize: TRIGGER_DIMENSION,
  blockSize: TRIGGER_DIMENSION,
  borderRadius: vars.radius.full,
  padding: vars.space[3],
});
const titleStyle = css({
  margin: 0,
  padding: vars.space[2],
  fontFamily: vars.font.sans,
  fontSize: vars.textSize.md,
  fontWeight: vars.fontWeight.semibold,
  color: vars.color.text,
});
const groupHeadingStyle = css({
  margin: 0,
  padding: vars.space[2],
  fontFamily: vars.font.sans,
  fontSize: vars.textSize.sm,
  fontWeight: vars.fontWeight.semibold,
  color: vars.color.textMuted,
});
const itemStyle = css({
  appearance: 'none',
  inlineSize: '100%',
  minBlockSize: vars.space[10],
  border: 0,
  borderRadius: vars.radius.md,
  background: 'transparent',
  color: vars.color.text,
  padding: vars.space[2],
  display: 'flex',
  gap: vars.space[2],
  textAlign: 'start',
  fontFamily: vars.font.sans,
  fontSize: vars.textSize.sm,
  '&[aria-disabled="true"]': { opacity: 0.55 },
  '&:focus-visible': { ...focusRingInset },
});
const formStyle = css({ display: 'grid', gap: vars.space[3] });
const errorStyle = css({
  color: vars.color.dangerText,
  fontFamily: vars.font.sans,
  fontSize: vars.textSize.sm,
});
const iconStyle = css({
  display: 'inline-flex',
  '& svg': { inlineSize: '1em', blockSize: '1em' },
});
type Draft = { text: string; choice?: string };

function ComposerField({ multiline, ref, ...props }: ActionMorphFieldProps) {
  const mergedRef = useMergeRefs<HTMLInputElement | HTMLTextAreaElement>([ref]);
  return multiline ? (
    <Textarea {...props} ref={mergedRef} />
  ) : (
    <TextField {...props} ref={mergedRef} />
  );
}

function ActionControlButton(props: ButtonProps) {
  return (
    <Button
      {...props}
      render={(buttonProps) => (
        <button {...buttonProps} type={props.type ?? 'button'} disabled={props.disabled} />
      )}
    />
  );
}

function ActionMenuItem({
  component: Item,
  slotRef,
  ref,
  ...props
}: NativePart<'button'> & {
  component: ComponentType<NativePart<'button'>> | 'button';
  slotRef?: Ref<HTMLButtonElement>;
}) {
  const mergedRef = useMergeRefs([ref, slotRef]);
  return <Item {...props} ref={mergedRef} />;
}

function ActionMorphControl({
  actions: suppliedActions,
  label = 'Create',
  onSubmit,
  width,
  resetAfter = RESET_MS,
  messages: messageOverrides,
  component,
  slots,
  slotProps,
  ref,
  className,
  sx,
  style,
  ...props
}: Omit<ActionMorphProps, 'open' | 'defaultOpen' | 'onOpenChange' | 'corner'>) {
  const groups = new Map<string | undefined, ActionMorphAction[]>();
  for (const item of suppliedActions) {
    const group = groups.get(item.group);
    if (group) group.push(item);
    else groups.set(item.group, [item]);
  }
  const actions = [...groups.values()].flat();
  const actionIndexes = new Map(actions.map((item, index) => [item.id, index]));
  const messages = { ...DEFAULT_MESSAGES, ...messageOverrides };
  const { open, requestOpen, step, requestStep, floating, presence } = useMorphContext();
  const { context } = floating;
  const actionId = step?.startsWith(ACTION_STEP_PREFIX)
    ? step.slice(ACTION_STEP_PREFIX.length)
    : undefined;
  function setActionId(id: string | undefined) {
    requestStep(id === undefined ? MENU_STEP : `${ACTION_STEP_PREFIX}${id}`);
  }
  const action = actions.find((item) => item.id === actionId);
  const previousAction = useRef(action?.id);
  const [drafts, setDrafts] = useState(() => new Map<string, Draft>());
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [success, setSuccess] = useState('');
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const operation = useRef<object | null>(null);
  const succeeded = useRef<string | null>(null);
  const fieldRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const confirmationRef = useRef<HTMLButtonElement>(null);
  const items = useRef<Array<HTMLElement | null>>([]);
  const names = useRef<Array<string | null>>([]);
  names.current = actions.map((item) => (item.disabled ? null : item.label));
  const id = useId();
  const role = useRole(context, { role: action ? 'dialog' : 'menu' });
  const navigation = useListNavigation(context, {
    listRef: items,
    activeIndex,
    onNavigate: setActiveIndex,
    loop: true,
    orientation: 'vertical',
    enabled: !action,
    disabledIndices: actions.flatMap((item, index) => (item.disabled ? [index] : [])),
    focusItemOnOpen: true,
  });
  const typeahead = useTypeahead(context, {
    listRef: names,
    activeIndex,
    onMatch: setActiveIndex,
    enabled: !action,
    resetMs: 500,
  });
  const { getReferenceProps, getFloatingProps, getItemProps } = useInteractions([
    role,
    navigation,
    typeahead,
  ]);
  const {
    sx: rootCss,
    className: rootClass,
    style: rootInline,
    ref: rootRef,
    ...rootProps
  } = slotProps?.root ?? {};
  const mergedRef = useMergeRefs([ref, rootRef]);
  const {
    ref: triggerRef,
    sx: triggerCss,
    size: triggerSize,
    tone: triggerTone,
    variant: triggerVariant,
    ...triggerProps
  } = slotProps?.trigger ?? {};
  const { ref: surfaceRef, sx: surfaceCss, ...surfaceProps } = slotProps?.surface ?? {};
  const mergedBackRef = useMergeRefs([confirmationRef, slotProps?.backButton?.ref]);
  const { sx: titleCss, ...titleProps } = slotProps?.title ?? {};
  const { sx: listCss, ...listProps } = slotProps?.menuList ?? {};
  const { sx: itemCss, ref: itemRef, ...itemProps } = slotProps?.item ?? {};
  const { sx: formCss, ...formProps } = slotProps?.form ?? {};
  const { sx: fieldCss, ref: externalFieldRef, ...fieldProps } = slotProps?.field ?? {};
  const mergedFieldRef = useMergeRefs([fieldRef, externalFieldRef]);
  const { sx: choicesCss, ...choicesProps } = slotProps?.choices ?? {};
  const { sx: errorCss, ...errorProps } = slotProps?.error ?? {};
  const { sx: statusCss, ...statusProps } = slotProps?.status ?? {};
  const Root = slots?.root ?? component ?? 'div';
  const Trigger = slots?.trigger ?? ActionControlButton;
  const Title = slots?.title ?? 'h3';
  const List = slots?.menuList ?? 'div';
  const Item = slots?.item ?? 'button';
  const Form = slots?.form ?? 'form';
  const Field = slots?.field ?? ComposerField;
  const Choices = slots?.choices ?? RadioGroup;
  const Back = slots?.backButton ?? ActionControlButton;
  const Submit = slots?.submitButton ?? ActionControlButton;
  const ErrorPart = slots?.error ?? 'span';
  const Status = slots?.status ?? 'span';
  const draft = action ? (drafts.get(action.id) ?? { text: '' }) : { text: '' };
  function updateDraft(next: Partial<Draft>) {
    if (!action) return;
    setDrafts((previous) =>
      new Map(previous).set(action.id, { ...(previous.get(action.id) ?? { text: '' }), ...next }),
    );
  }
  function back() {
    operation.current = null;
    setPending(false);
    setError('');
    setStatus('');
    setActionId(undefined);
    const index = actions.findIndex((item) => item.id === actionId);
    setActiveIndex(index >= 0 ? index : null);
  }
  useLayoutEffect(() => {
    if (open && action && error && !pending) fieldRef.current?.focus();
  }, [open, action?.id, error, pending]);
  useLayoutEffect(() => {
    if (open && action && succeeded.current === action.id) confirmationRef.current?.focus();
  }, [open, action?.id, pending, success]);
  useEffect(() => {
    if (!action && actionId !== undefined) {
      operation.current = null;
      setPending(false);
      setError('');
      setActionId(undefined);
    }
  }, [action, actionId]);
  useEffect(() => {
    if (!open || !action) {
      operation.current = null;
      setPending(false);
      setError('');
    }
    if (open && !action && previousAction.current !== undefined) setStatus('');
    previousAction.current = action?.id;
  }, [open, action?.id]);
  useEffect(() => {
    if (!presence.present) {
      setPending(false);
      setError('');
      setActionId(undefined);
      if (succeeded.current) {
        const completed = succeeded.current;
        setDrafts((previous) => {
          const next = new Map(previous);
          next.delete(completed);
          return next;
        });
        succeeded.current = null;
      }
    }
  }, [presence.present]);
  useEffect(
    () => () => {
      operation.current = null;
    },
    [],
  );
  const resetDelay = Number.isFinite(resetAfter) && resetAfter > 0 ? resetAfter : 0;
  useEffect(() => {
    if (!success) return;
    if (!resetDelay) {
      setSuccess('');
      return;
    }
    const timer = setTimeout(() => setSuccess(''), resetDelay);
    return () => clearTimeout(timer);
  }, [success, resetDelay]);
  const latest = useRef({ requestOpen, messages });
  useLayoutEffect(() => {
    latest.current = { requestOpen, messages };
  });
  const marker = [
    ...new Set([
      'action-morph',
      ...[props['data-ui'], rootProps['data-ui']].flatMap(
        (x) => x?.split(/\s+/).filter(Boolean) ?? [],
      ),
    ]),
  ].join(' ');
  return (
    <WithSx
      className={[rootClass, className].filter(Boolean).join(' ')}
      styles={[rootStyle, rootCss]}
      sx={sx}
    >
      {(resolved) => (
        <Root
          {...props}
          {...rootProps}
          ref={mergedRef}
          className={resolved}
          style={{ ...style, ...rootInline }}
          data-ui={marker}
          data-state={
            open
              ? action
                ? pending
                  ? 'sending'
                  : 'composer'
                : 'menu'
              : success
                ? 'success'
                : 'closed'
          }
        >
          <Morph.Trigger
            component={Trigger}
            {...consumerHandlersFirst(triggerProps, getReferenceProps)}
            size={triggerSize}
            tone={triggerTone}
            variant={triggerVariant}
            ref={triggerRef}
            disabled={actions.length === 0 || triggerProps.disabled}
            css={[triggerStyle, triggerCss]}
            aria-label={success ? `${label}: ${success}` : label}
            data-ui="action-morph-trigger"
          >
            {success ? '✓' : '+'}
          </Morph.Trigger>
          <Morph.Surface
            component={slots?.surface}
            label={action?.composer.title ?? label}
            width={
              action ? (width?.composer ?? COMPOSER_INLINE_SIZE) : (width?.menu ?? MENU_INLINE_SIZE)
            }
            data-face={action ? 'composer' : 'menu'}
            dir={rootProps.dir ?? props.dir}
            {...getFloatingProps(surfaceProps)}
            ref={surfaceRef}
            sx={surfaceCss}
            data-ui="action-morph-surface"
            aria-labelledby={
              surfaceProps['aria-label']
                ? undefined
                : [surfaceProps['aria-labelledby'], `${id}-title`].filter(Boolean).join(' ')
            }
          >
            <Morph.Step id={step ?? MENU_STEP} back={!!action && succeeded.current !== action.id}>
              <Title
                {...titleProps}
                id={`${id}-title`}
                role={action ? undefined : 'presentation'}
                css={[titleStyle, titleCss]}
                data-ui="action-morph-title"
              >
                {action?.composer.title ?? label}
              </Title>
              {!action ? (
                <List
                  {...listProps}
                  css={listCss}
                  data-ui="action-morph-menu-list"
                  onKeyDown={(event) => {
                    listProps.onKeyDown?.(event);
                    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey)
                      return;
                    const match = actions.find(
                      (item) =>
                        !item.disabled &&
                        item.shortcut?.toLocaleLowerCase() === event.key.toLocaleLowerCase(),
                    );
                    if (match && event.key.length === 1) {
                      event.preventDefault();
                      event.stopPropagation();
                      setActionId(match.id);
                      setError('');
                    }
                  }}
                >
                  {[...groups].map(([group, entries], groupIndex) => {
                    const content = entries.map((item) => {
                      const index = actionIndexes.get(item.id)!;
                      return (
                        <ActionMenuItem
                          component={Item}
                          slotRef={itemRef}
                          {...consumerHandlersFirst(itemProps, getItemProps)}
                          onClick={(event) => {
                            itemProps.onClick?.(event);
                            if (event.defaultPrevented || item.disabled) return;
                            setActionId(item.id);
                            setError('');
                            setActiveIndex(index);
                          }}
                          key={item.id}
                          ref={(node) => {
                            items.current[index] = node;
                          }}
                          type="button"
                          role="menuitem"
                          data-autofocus={activeIndex === index || undefined}
                          tabIndex={activeIndex === index ? 0 : -1}
                          aria-disabled={item.disabled || undefined}
                          aria-keyshortcuts={item.shortcut}
                          css={[itemStyle, listboxItemStateStyle, itemCss]}
                          data-ui="action-morph-item"
                        >
                          <span css={iconStyle} aria-hidden="true">
                            {item.icon}
                          </span>
                          <span>
                            {item.label}
                            {item.description != null && <span>{item.description}</span>}
                          </span>
                        </ActionMenuItem>
                      );
                    });
                    return group === undefined ? content : (
                      <div key={group} role="group" aria-labelledby={`${id}-group-${groupIndex}`}>
                        <h3 role="presentation" id={`${id}-group-${groupIndex}`} css={groupHeadingStyle}>
                          {group}
                        </h3>
                        {content}
                      </div>
                    );
                  })}
                  {actions.length === 0 && messages.menuEmpty}
                </List>
              ) : action.composer.kind === 'content' ? (
                typeof action.composer.content === 'function' ? (
                  action.composer.content({ close: () => requestOpen(false), back })
                ) : (
                  action.composer.content
                )
              ) : succeeded.current === action.id ? (
                <>
                  <span data-ui="action-morph-confirmation">{action.composer.successLabel}</span>
                  <Back
                    {...slotProps?.backButton}
                    ref={mergedBackRef}
                    data-ui="action-morph-back"
                    onClick={(event) => {
                      slotProps?.backButton?.onClick?.(event);
                      if (!event.defaultPrevented) {
                        requestOpen(false);
                      }
                    }}
                  >
                    {messages.close}
                  </Back>
                </>
              ) : (
                <Form
                  {...formProps}
                  css={[formStyle, formCss]}
                  data-ui="action-morph-form"
                  aria-busy={pending || undefined}
                  onSubmit={async (event) => {
                    if (action.composer.kind === 'content') return;
                    formProps.onSubmit?.(event);
                    const canceled = event.defaultPrevented;
                    event.preventDefault();
                    if (canceled || operation.current || !onSubmit) return;
                    if (!draft.text.trim()) {
                      setError(action.composer.emptyHint ?? messages.emptyFallback);
                      fieldRef.current?.focus();
                      return;
                    }
                    const token = {};
                    const successLabel = action.composer.successLabel;
                    const captured = action;
                    operation.current = token;
                    setPending(true);
                    setError('');
                    setStatus(messages.announcePending(action.label));
                    try {
                      await onSubmit({
                        action: action.id,
                        text: draft.text,
                        choice: draft.choice,
                      });
                      if (operation.current !== token) return;
                      operation.current = null;
                      setPending(false);
                      succeeded.current = captured.id;
                      setSuccess(successLabel);
                      setStatus(latest.current.messages.announceSuccess(successLabel));
                      latest.current.requestOpen(false);
                    } catch {
                      if (operation.current !== token) return;
                      operation.current = null;
                      setPending(false);
                      setError(latest.current.messages.failure);
                      setStatus(latest.current.messages.failure);
                      fieldRef.current?.focus();
                    }
                  }}
                >
                  <Field
                    {...fieldProps}
                    css={fieldCss}
                    ref={mergedFieldRef}
                    data-autofocus
                    multiline={action.composer.multiline}
                    label={action.composer.label ?? action.composer.title}
                    placeholder={action.composer.placeholder}
                    value={draft.text}
                    disabled={pending}
                    aria-invalid={error ? true : fieldProps['aria-invalid']}
                    aria-describedby={
                      [fieldProps['aria-describedby'], error ? `${id}-error` : undefined]
                        .filter(Boolean)
                        .join(' ') || undefined
                    }
                    onChange={(event) => {
                      fieldProps.onChange?.(event);
                      if (!event.defaultPrevented)
                        updateDraft({
                          text: event.currentTarget.value,
                        });
                    }}
                    onKeyDown={(event) => {
                      fieldProps.onKeyDown?.(event);
                      if (event.defaultPrevented) return;
                      if (event.key === 'Enter' && event.nativeEvent.isComposing) {
                        event.preventDefault();
                        return;
                      }
                      if (
                        event.key === 'Enter' &&
                        action.composer.kind !== 'content' &&
                        action.composer.multiline &&
                        (event.metaKey || event.ctrlKey)
                      ) {
                        event.preventDefault();
                        event.currentTarget.form?.requestSubmit();
                      }
                    }}
                  />
                  {action.composer.choices && (
                    <Choices
                      {...choicesProps}
                      css={choicesCss}
                      value={draft.choice ?? ''}
                      aria-label={action.composer.choices.label}
                      onValueChange={(next) => {
                        choicesProps.onValueChange?.(next);
                        updateDraft({ choice: next });
                      }}
                    >
                      {action.composer.choices.options.map((option) => (
                        <RadioGroup.Radio
                          key={option.value}
                          value={option.value}
                          disabled={pending || option.disabled}
                          label={option.label}
                        />
                      ))}
                    </Choices>
                  )}
                  {error && (
                    <ErrorPart
                      {...errorProps}
                      id={`${id}-error`}
                      css={[errorStyle, errorCss]}
                      data-ui="action-morph-error"
                    >
                      {error}
                    </ErrorPart>
                  )}
                  <Back
                    {...slotProps?.backButton}
                    ref={mergedBackRef}
                    type="button"
                    variant="ghost"
                    data-ui="action-morph-back"
                    onClick={(event) => {
                      slotProps?.backButton?.onClick?.(event);
                      if (!event.defaultPrevented) back();
                    }}
                  >
                    {messages.back}
                  </Back>
                  <Submit
                    {...slotProps?.submitButton}
                    type="submit"
                    aria-busy={pending || undefined}
                    aria-disabled={pending || undefined}
                    startIcon={
                      pending ? (
                        <Spinner value="loading" decorative />
                      ) : (
                        slotProps?.submitButton?.startIcon
                      )
                    }
                    disabled={!onSubmit}
                    data-ui="action-morph-submit"
                  >
                    {action.composer.submitLabel}
                  </Submit>
                </Form>
              )}
            </Morph.Step>
          </Morph.Surface>
          <Status
            {...statusProps}
            css={[visuallyHiddenStyle, statusCss]}
            data-ui="action-morph-status"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {status}
          </Status>
        </Root>
      )}
    </WithSx>
  );
}

export function ActionMorph({
  open,
  defaultOpen,
  onOpenChange,
  corner,
  ...props
}: ActionMorphProps) {
  return (
    <Morph.Root
      open={open}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange}
      corner={corner}
      defaultStep={MENU_STEP}
    >
      <ActionMorphControl {...props} />
    </Morph.Root>
  );
}
ActionMorph.displayName = 'ActionMorph';
