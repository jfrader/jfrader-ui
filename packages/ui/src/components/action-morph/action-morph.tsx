'use client';

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
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
  FloatingFocusManager,
  useClick,
  useInteractions,
  useListNavigation,
  useMergeRefs,
  useRole,
  useTypeahead,
} from '@floating-ui/react';
import { MotionConfig, motion, useReducedMotion } from 'motion/react';
import { vars } from '@jfrader/tokens/vars';
import { LayerContent, MenuLayer, useLayerDismiss } from '../../overlay/overlay-layer';
import { OverlayPortal } from '../../overlay/overlay-portal';
import { useOverlayFloating } from '../../overlay/use-overlay-floating';
import { css, type Interpolation, type Theme } from '../../styling/css';
import { focusRingInset } from '../../styling/focus-ring';
import { listboxItemStateStyle, listboxSurfaceStyle } from '../../styling/listbox-style';
import { WithSx, type SxProps } from '../../styling/sx';
import { visuallyHiddenStyle } from '../../styling/visually-hidden';
import { useControlledState } from '../../utils/use-controlled-state';
import { Button, type ButtonProps } from '../button';
import { TextField, type TextFieldProps } from '../text-field';
import { Textarea } from '../textarea';
import { Spinner } from '../spinner';
import { RadioGroup } from '../radio-group';
import type { RadioGroupCompoundProps } from '../radio-group/radio-group';
import { consumerHandlersFirst, restoreTriggerFocus } from '../menu/menu';

export interface ActionMorphComposer {
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
export interface ActionMorphAction {
  id: string;
  label: string;
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
  css?: Interpolation<Theme>;
  'data-ui'?: string;
};
export interface ActionMorphFieldProps
  extends
    Omit<
      TextFieldProps,
      keyof DOMAttributes<HTMLInputElement> | 'ref' | 'sx' | 'slots' | 'slotProps' | 'component' | 'render'
    >,
    Omit<DOMAttributes<HTMLInputElement | HTMLTextAreaElement>, 'onChange'> {
  ref?: Ref<HTMLInputElement | HTMLTextAreaElement>;
  onChange?: ChangeEventHandler<HTMLInputElement | HTMLTextAreaElement>;
  onKeyDown?: KeyboardEventHandler<HTMLInputElement | HTMLTextAreaElement>;
  multiline?: boolean;
  css?: Interpolation<Theme>;
}
export interface ActionMorphSlotProps {
  root?: NativePart<'div'>;
  trigger?: ButtonProps & { css?: Interpolation<Theme> };
  surface?: NativePart<'div'>;
  title?: NativePart<'h3'>;
  menuList?: NativePart<'div'>;
  item?: NativePart<'button'>;
  form?: NativePart<'form'>;
  field?: ActionMorphFieldProps;
  choices?: Omit<RadioGroupCompoundProps, 'sx'> & {
    css?: Interpolation<Theme>;
  };
  backButton?: ButtonProps & { css?: Interpolation<Theme> };
  submitButton?: ButtonProps & { css?: Interpolation<Theme> };
  error?: NativePart<'span'>;
  status?: NativePart<'span'>;
}
export type ActionMorphSlots = {
  [K in keyof ActionMorphSlotProps]?: ComponentType<NonNullable<ActionMorphSlotProps[K]>>;
};
export interface ActionMorphProps extends Omit<ComponentPropsWithRef<'div'>, 'onSubmit'>, SxProps {
  actions: readonly ActionMorphAction[];
  label?: string;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSubmit?: (submission: ActionMorphSubmission) => void | Promise<unknown>;
  corner?: 'start' | 'end';
  /** Success feedback in milliseconds, default 1600; 0 resets immediately. */
  resetAfter?: number;
  messages?: Partial<ActionMorphMessages>;
  slots?: ActionMorphSlots;
  component?: ActionMorphSlots['root'];
  slotProps?: ActionMorphSlotProps;
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
const SHAPE_SPRING = { type: 'spring', stiffness: 380, damping: 36 } as const;
const rootStyle = css({ display: 'inline-flex', position: 'relative' });
const triggerStyle = css({
  inlineSize: TRIGGER_DIMENSION,
  blockSize: TRIGGER_DIMENSION,
  borderRadius: vars.radius.full,
  padding: vars.space[3],
});
const surfaceStyle = css({
  maxInlineSize: `calc(100vw - 2 * ${vars.space[4]})`,
  inlineSize: MENU_INLINE_SIZE,
  '&[data-face="composer"]': { inlineSize: COMPOSER_INLINE_SIZE },
  padding: vars.space[3],
  borderRadius: vars.radius.lg,
  maxBlockSize: 'var(--action-morph-available-height)',
  overflowY: 'auto',
});
const titleStyle = css({
  margin: 0,
  padding: vars.space[2],
  fontFamily: vars.font.sans,
  fontSize: vars.textSize.md,
  fontWeight: vars.fontWeight.semibold,
  color: vars.color.text,
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
  return multiline ? <Textarea {...props} ref={mergedRef} /> : <TextField {...props} ref={mergedRef} />;
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
  nodeId,
  actions,
  label = 'Create',
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  onSubmit,
  corner = 'end',
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
}: ActionMorphProps & { nodeId: string | undefined }) {
  const messages = { ...DEFAULT_MESSAGES, ...messageOverrides };
  const [open = false, requestOpen] = useControlledState(openProp, defaultOpen, onOpenChange);
  const [actionId, setActionId] = useState<string>();
  const action = actions.find((item) => item.id === actionId);
  const [drafts, setDrafts] = useState(() => new Map<string, Draft>());
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [success, setSuccess] = useState('');
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const operation = useRef<object | null>(null);
  const succeeded = useRef<string | null>(null);
  const returnFocus = useRef(false);
  const menuFocus = useRef<number | null>(null);
  const previousOpen = useRef(open);
  const initialOpenFocus = useRef(open);
  const fieldRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const confirmationRef = useRef<HTMLButtonElement>(null);
  const [direction, setDirection] = useState<'ltr' | 'rtl'>('ltr');
  const items = useRef<Array<HTMLElement | null>>([]);
  const names = useRef<Array<string | null>>([]);
  names.current = actions.map((item) => (item.disabled ? null : item.label));
  const id = useId();
  const reduce = useReducedMotion();
  const { refs, context, floatingStyles } = useOverlayFloating({
    open,
    nodeId,
    transform: false,
    onAvailableSize: ({ height }) => {
      refs.floating.current?.style.setProperty(
        '--action-morph-available-height',
        `${Math.max(0, height)}px`,
      );
    },
    placement: corner === 'start' ? 'top-start' : 'top-end',
    onOpenChange(next, _event, reason) {
      if (!next && reason === 'escape-key' && action && !succeeded.current) {
        back();
        return;
      }
      returnFocus.current = !next && reason === 'escape-key';
      requestOpen(next);
    },
  });
  const click = useClick(context);
  const role = useRole(context, { role: action ? 'dialog' : 'menu' });
  const dismiss = useLayerDismiss(context, 'container');
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
    click,
    role,
    ...dismiss,
    navigation,
    typeahead,
  ]);
  const {
    css: rootCss,
    className: rootClass,
    style: rootInline,
    ref: rootRef,
    ...rootProps
  } = slotProps?.root ?? {};
  const mergedRef = useMergeRefs([ref, rootRef]);
  const {
    ref: triggerRef,
    css: triggerCss,
    size: triggerSize,
    tone: triggerTone,
    variant: triggerVariant,
    ...triggerProps
  } = slotProps?.trigger ?? {};
  const mergedTriggerRef = useMergeRefs([refs.setReference, triggerRef]);
  const { ref: surfaceRef, css: surfaceCss, ...surfaceProps } = slotProps?.surface ?? {};
  const mergedSurfaceRef = useMergeRefs([refs.setFloating, surfaceRef]);
  const mergedBackRef = useMergeRefs([confirmationRef, slotProps?.backButton?.ref]);
  const { css: titleCss, ...titleProps } = slotProps?.title ?? {};
  const { css: listCss, ...listProps } = slotProps?.menuList ?? {};
  const { css: itemCss, ref: itemRef, ...itemProps } = slotProps?.item ?? {};
  const { css: formCss, ...formProps } = slotProps?.form ?? {};
  const { css: fieldCss, ref: externalFieldRef, ...fieldProps } = slotProps?.field ?? {};
  const mergedFieldRef = useMergeRefs([fieldRef, externalFieldRef]);
  const { css: choicesCss, ...choicesProps } = slotProps?.choices ?? {};
  const { css: errorCss, ...errorProps } = slotProps?.error ?? {};
  const { css: statusCss, ...statusProps } = slotProps?.status ?? {};
  const Root = slots?.root ?? component ?? 'div';
  const Trigger = slots?.trigger ?? ActionControlButton;
  const Surface = useMemo(() => motion.create(slots?.surface ?? 'div'), [slots?.surface]);
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
    menuFocus.current = index >= 0 ? index : 0;
    setActiveIndex(index >= 0 ? index : null);
  }
  useLayoutEffect(() => {
    if (!open) return;
    if (action) fieldRef.current?.focus();
    else if (menuFocus.current !== null) {
      items.current[menuFocus.current]?.focus();
      menuFocus.current = null;
    } else if (initialOpenFocus.current) {
      initialOpenFocus.current = false;
      const index = actions.findIndex((item) => !item.disabled);
      if (index >= 0) {
        setActiveIndex(index);
        items.current[index]?.focus();
      }
    }
  }, [open, action?.id]);
  useLayoutEffect(() => {
    if (open && action && error && !pending) fieldRef.current?.focus();
  }, [open, action?.id, error, pending]);
  useLayoutEffect(() => {
    if (open && action && succeeded.current === action.id) confirmationRef.current?.focus();
  }, [open, action?.id, pending, success]);
  useLayoutEffect(() => {
    const node = refs.domReference.current;
    if (node)
      setDirection(
        node.ownerDocument.defaultView?.getComputedStyle(node).direction === 'rtl' ? 'rtl' : 'ltr',
      );
  }, [open, props.dir, rootProps.dir, refs]);
  useEffect(() => {
    if (!action && actionId !== undefined) {
      operation.current = null;
      setPending(false);
      setError('');
      setActionId(undefined);
      menuFocus.current = actions.findIndex((item) => !item.disabled);
    }
  }, [action, actionId]);
  useEffect(() => {
    if (!open && previousOpen.current) {
      operation.current = null;
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
      if (returnFocus.current) restoreTriggerFocus(refs.domReference.current);
      returnFocus.current = false;
    }
    previousOpen.current = open;
  }, [open, refs]);
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
            open ? (action ? (pending ? 'sending' : 'composer') : 'menu') : success ? 'success' : 'closed'
          }
        >
          <Trigger
            {...consumerHandlersFirst(triggerProps, getReferenceProps)}
            size={triggerSize}
            tone={triggerTone}
            variant={triggerVariant}
            ref={mergedTriggerRef}
            disabled={actions.length === 0 || triggerProps.disabled}
            css={[triggerStyle, triggerCss]}
            aria-label={success ? `${label}: ${success}` : label}
            data-ui="action-morph-trigger"
          >
            {success ? '✓' : '+'}
          </Trigger>
          {open && (
            <OverlayPortal>
              <FloatingFocusManager
                context={context}
                modal={false}
                initialFocus={-1}
                returnFocus={false}
                restoreFocus
              >
                <Surface
                  layout={reduce ? false : true}
                  initial={false}
                  transition={reduce ? { duration: 0 } : SHAPE_SPRING}
                  data-face={action ? 'composer' : 'menu'}
                  dir={direction}
                  {...getFloatingProps(surfaceProps)}
                  ref={mergedSurfaceRef}
                  style={{ ...surfaceProps.style, ...floatingStyles }}
                  css={[listboxSurfaceStyle, surfaceStyle, surfaceCss]}
                  data-ui="action-morph-surface"
                  aria-labelledby={
                    surfaceProps['aria-label']
                      ? undefined
                      : [surfaceProps['aria-labelledby'], `${id}-title`].filter(Boolean).join(' ')
                  }
                >
                  <LayerContent nodeId={nodeId}>
                    <motion.div
                      layout={reduce ? false : true}
                      transition={reduce ? { duration: 0 } : SHAPE_SPRING}
                    >
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
                          {actions.map((item, index) => (
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
                          ))}
                          {actions.length === 0 && messages.menuEmpty}
                        </List>
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
                                returnFocus.current = true;
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
                              setSuccess(captured.composer.successLabel);
                              setStatus(
                                latest.current.messages.announceSuccess(captured.composer.successLabel),
                              );
                              returnFocus.current = true;
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
                    </motion.div>
                  </LayerContent>
                </Surface>
              </FloatingFocusManager>
            </OverlayPortal>
          )}
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

export function ActionMorph(props: ActionMorphProps) {
  return (
    <MotionConfig reducedMotion="user">
      <MenuLayer>{(nodeId) => <ActionMorphControl {...props} nodeId={nodeId} />}</MenuLayer>
    </MotionConfig>
  );
}
ActionMorph.displayName = 'ActionMorph';
