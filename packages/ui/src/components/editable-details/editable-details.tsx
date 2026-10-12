'use client';

// APG Disclosure: native buttons toggle with Enter/Space; Tab follows document order.
// Editors own all form behavior. Hidden section panels retain their mounted sessions.
import {
  createContext,
  useCallback,
  useContext,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  type ComponentPropsWithRef,
  type ReactNode,
  type Ref,
  type RefCallback,
  type RefObject,
} from 'react';
import { useMergeRefs } from '@floating-ui/react';
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type Theme } from '../../styling/css';
import { disclosureCaret } from '../../styling/disclosure-caret';
import { focusRingInset, focusRingOutset } from '../../styling/focus-ring';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import { WithSx, type SxProps } from '../../styling/sx';
import { useControlledState } from '../../utils/use-controlled-state';

export interface EditableDetailsMessages {
  edit: string;
}
export interface EditableDetailsPartProps {
  className?: string;
  css?: Interpolation<Theme>;
}
export interface EditableDetailsProps extends ComponentPropsWithRef<'div'>, SxProps {
  messages?: Partial<EditableDetailsMessages>;
}
export interface EditableDetailsSectionProps extends Omit<ComponentPropsWithRef<'section'>, 'title'>, SxProps {
  title: ReactNode;
  headingLevel?: 1 | 2 | 3 | 4 | 5 | 6;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  triggerRef?: Ref<HTMLButtonElement>;
  slotProps?: {
    heading?: EditableDetailsPartProps;
    trigger?: EditableDetailsPartProps;
    panel?: EditableDetailsPartProps;
  };
}
export interface EditableDetailsListProps extends ComponentPropsWithRef<'dl'>, SxProps {}
export interface EditableDetailsEditorProps {
  initialFocusRef: RefCallback<HTMLElement>;
  complete: () => void;
  cancel: () => void;
  visible: boolean;
}
export interface EditableDetailsItemProps extends ComponentPropsWithRef<'div'>, SxProps {
  label: ReactNode;
  renderEditor?: (props: EditableDetailsEditorProps) => ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  slotProps?: {
    label?: EditableDetailsPartProps;
    description?: EditableDetailsPartProps;
    summary?: EditableDetailsPartProps;
    edit?: EditableDetailsPartProps;
    editor?: EditableDetailsPartProps;
  };
}

const DEFAULT_MESSAGES: EditableDetailsMessages = { edit: 'Edit' };
const HEADINGS = { 1: 'h1', 2: 'h2', 3: 'h3', 4: 'h4', 5: 'h5', 6: 'h6' } as const;
const MessagesContext = createContext(DEFAULT_MESSAGES);
interface DisclosureScope {
  visible: boolean;
  triggers: readonly RefObject<HTMLButtonElement | null>[];
}
const DisclosureContext = createContext<DisclosureScope>({ visible: true, triggers: [] });

const rootStyle = css({
  label: 'editable-details', display: 'grid', gap: vars.space[4], minInlineSize: 0,
  maxInlineSize: '100%', fontFamily: vars.font.sans, color: vars.color.text,
  lineHeight: vars.lineHeight.base, textAlign: 'start', overflowWrap: 'anywhere',
});
const sectionStyle = css({ minInlineSize: 0, borderBlockEnd: `1px solid ${vars.color.border}` });
const headingStyle = css({ margin: 0, font: 'inherit' });
const triggerStyle = css({
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: vars.space[3],
  inlineSize: '100%', minInlineSize: 0, minBlockSize: vars.space[10],
  paddingBlock: vars.space[2], paddingInline: vars.space[2], border: 0,
  background: 'transparent', color: 'inherit', font: 'inherit', fontWeight: vars.fontWeight.medium,
  textAlign: 'start', overflowWrap: 'anywhere', cursor: 'pointer',
  '&::after': disclosureCaret,
  '&[aria-expanded="true"]::after': { transform: 'rotate(90deg)' },
  '&[aria-expanded="true"]:dir(rtl)::after': { transform: 'rotate(-90deg)' },
  '&:hover': { backgroundColor: vars.color.surfaceHover }, '&:focus-visible': focusRingInset,
  [REDUCED_MOTION]: { '&::after': { transitionDuration: '0s' } },
  [FORCED_COLORS]: { '&::after': { forcedColorAdjust: 'none', borderInlineStartColor: 'ButtonText' } },
});
const panelStyle = css({ display: 'grid', gap: vars.space[3], minInlineSize: 0, paddingBlock: vars.space[3], '&[hidden]': { display: 'none' } });
const listStyle = css({ margin: 0, minInlineSize: 0 });
const itemStyle = css({
  display: 'flex', flexWrap: 'wrap', gap: vars.space[2], minInlineSize: 0,
  paddingBlock: vars.space[3], borderBlockEnd: `1px solid ${vars.color.border}`,
});
const labelStyle = css({ flex: '1 1 10rem', minInlineSize: 0, fontWeight: vars.fontWeight.medium });
const descriptionStyle = css({ flex: '2 1 16rem', minInlineSize: 0, margin: 0 });
const summaryStyle = css({ display: 'flex', flexWrap: 'wrap', alignItems: 'start', gap: vars.space[2], minInlineSize: 0 });
const valueStyle = css({ flex: '1 1 8rem', minInlineSize: 0 });
const editStyle = css({
  minBlockSize: vars.space[8], paddingInline: vars.space[2], paddingBlock: vars.space[1],
  border: `1px solid ${vars.color.borderControl}`, borderRadius: vars.radius.sm,
  background: 'transparent', color: vars.color.text, font: 'inherit', cursor: 'pointer',
  '&:hover': { backgroundColor: vars.color.surfaceHover }, '&:focus-visible': focusRingOutset,
  [FORCED_COLORS]: { borderColor: 'ButtonText', color: 'ButtonText' },
});
const editorStyle = css({ minInlineSize: 0, maxInlineSize: '100%', '&:focus': focusRingInset });

function isVisible(element: HTMLElement | null): element is HTMLElement {
  return element !== null && element.isConnected && element.getClientRects().length > 0 &&
    !element.closest('[hidden], [inert]') &&
    element.ownerDocument.defaultView?.getComputedStyle(element).visibility !== 'hidden';
}
function focusDisclosure(triggers: DisclosureScope['triggers']) {
  for (const ref of triggers) {
    if (isVisible(ref.current)) {
      ref.current.focus();
      return;
    }
  }
}

// Remember the last real focus target: removing or hiding focused DOM can leave activeElement at body.
function useFocusMemory(root: RefObject<HTMLElement | null>, invalidateWithin = false) {
  const last = useRef<Element | null>(null);
  const intent = useRef(false);
  useLayoutEffect(() => {
    const element = root.current;
    if (!element) return;
    const doc = element.ownerDocument;
    last.current = doc.activeElement;
    const focus = () => {
      last.current = doc.activeElement;
      if (invalidateWithin || !element.contains(doc.activeElement)) intent.current = false;
    };
    const press = (event: MouseEvent) => {
      if (!event.defaultPrevented && (invalidateWithin || !event.composedPath().includes(element))) intent.current = false;
      if (!event.defaultPrevented && !event.composedPath().includes(element)) {
        last.current = null;
      }
    };
    doc.addEventListener('focusin', focus);
    doc.addEventListener('mousedown', press);
    return () => {
      doc.removeEventListener('focusin', focus);
      doc.removeEventListener('mousedown', press);
    };
  }, [root, invalidateWithin]);
  return { last, intent };
}
function ownedFocus(element: HTMLElement, last: Element | null) {
  const active = element.ownerDocument.activeElement;
  return element.contains(active) || (active === element.ownerDocument.body && last !== null && element.contains(last));
}

function EditableDetailsRoot({ messages, className, sx, ...rest }: EditableDetailsProps) {
  const inherited = useContext(MessagesContext);
  const text = useMemo(() => ({ ...inherited, ...messages }), [inherited, messages]);
  return (
    <MessagesContext.Provider value={text}>
      <WithSx className={className} styles={rootStyle} sx={sx}>
        {(className) => <div {...rest} className={className} data-ui="editable-details" />}
      </WithSx>
    </MessagesContext.Provider>
  );
}
EditableDetailsRoot.displayName = 'EditableDetails';

function EditableDetailsSection({
  ref, title, headingLevel = 3, open: openProp, defaultOpen = false, onOpenChange,
  triggerRef, slotProps, children, className, sx, ...rest
}: EditableDetailsSectionProps) {
  const [open, requestOpen] = useControlledState(openProp, defaultOpen, onOpenChange);
  const parent = useContext(DisclosureContext);
  const button = useRef<HTMLButtonElement>(null);
  const mergedTrigger = useMergeRefs([button, triggerRef]);
  const panel = useRef<HTMLDivElement>(null);
  const memory = useFocusMemory(panel);
  const id = useId();
  const Heading = HEADINGS[headingLevel];
  const visible = parent.visible && !!open;
  const triggers = useMemo(() => [button, ...parent.triggers], [parent.triggers]);
  const scope = useMemo(() => ({ visible, triggers }), [visible, triggers]);
  useLayoutEffect(() => {
    const element = panel.current;
    if (!visible && element && ownedFocus(element, memory.last.current)) focusDisclosure(scope.triggers);
  }, [visible, scope, memory.last]);
  return (
    <WithSx className={className} styles={sectionStyle} sx={sx}>
      {(className) => (
        <section {...rest} ref={ref} className={className} data-ui="editable-details-section" data-state={open ? 'open' : 'closed'}>
          <Heading css={[headingStyle, slotProps?.heading?.css]} className={slotProps?.heading?.className}>
            <button
              ref={mergedTrigger}
              type="button"
              id={`${id}-trigger`}
              aria-expanded={!!open}
              aria-controls={`${id}-panel`}
              onClick={() => requestOpen(!open)}
              css={[triggerStyle, slotProps?.trigger?.css]}
              className={slotProps?.trigger?.className}
              data-ui="editable-details-section-trigger"
            >
              {title}
            </button>
          </Heading>
          <DisclosureContext.Provider value={scope}>
            <div
              ref={panel}
              id={`${id}-panel`}
              hidden={!open}
              css={[panelStyle, slotProps?.panel?.css]}
              className={slotProps?.panel?.className}
              data-ui="editable-details-section-panel"
            >
              {children}
            </div>
          </DisclosureContext.Provider>
        </section>
      )}
    </WithSx>
  );
}
EditableDetailsSection.displayName = 'EditableDetails.Section';

function EditableDetailsList({ className, sx, ...rest }: EditableDetailsListProps) {
  return (
    <WithSx className={className} styles={listStyle} sx={sx}>
      {(className) => <dl {...rest} className={className} data-ui="editable-details-list" />}
    </WithSx>
  );
}
EditableDetailsList.displayName = 'EditableDetails.List';

interface SessionProps {
  renderEditor: NonNullable<EditableDetailsItemProps['renderEditor']>;
  labelId: string;
  hostId: string;
  part?: EditableDetailsPartProps;
  edit: RefObject<HTMLButtonElement | null>;
  requestClose: () => void;
  focusIntent: RefObject<boolean>;
  acceptedClose: RefObject<boolean>;
}
function EditorSession({ renderEditor, labelId, hostId, part, edit, requestClose, focusIntent, acceptedClose }: SessionProps) {
  const scope = useContext(DisclosureContext);
  const host = useRef<HTMLDivElement>(null);
  const target = useRef<HTMLElement | null>(null);
  const memory = useFocusMemory(host);
  const alive = useRef(false);
  const closeRequested = useRef(false);
  const returnFocus = memory.intent;
  const initialFocusRef = useCallback<RefCallback<HTMLElement>>((node) => {
    target.current = node;
    return () => { if (target.current === node) target.current = null; };
  }, []);
  const close = useCallback(() => {
    if (!alive.current) return;
    closeRequested.current = true;
    const element = host.current;
    returnFocus.current = !!element && ownedFocus(element, memory.last.current);
    requestClose();
  }, [requestClose, memory.last, returnFocus]);
  useLayoutEffect(() => {
    alive.current = true;
    const element = host.current;
    return () => {
      alive.current = false;
      if (!element) return;
      const owned = ownedFocus(element, memory.last.current);
      queueMicrotask(() => {
        if (element.isConnected || !owned || element.ownerDocument.activeElement !== element.ownerDocument.body) return;
        if (acceptedClose.current && closeRequested.current && !returnFocus.current) return;
        if (returnFocus.current && isVisible(edit.current)) edit.current.focus();
        else focusDisclosure(scope.triggers);
      });
    };
  }, [acceptedClose, edit, memory.last, returnFocus, scope.triggers]);
  useLayoutEffect(() => {
    if (!focusIntent.current) return;
    focusIntent.current = false;
    const element = host.current;
    if (!element || !scope.visible) return;
    if (isVisible(target.current)) {
      target.current.focus();
      if (element.ownerDocument.activeElement === target.current) return;
    }
    element.focus();
  }, [focusIntent, scope.visible]);
  return (
    <div
      ref={host}
      id={hostId}
      role="group"
      aria-labelledby={labelId}
      tabIndex={-1}
      className={part?.className}
      css={[editorStyle, part?.css]}
      data-ui="editable-details-editor"
    >
      {renderEditor({ initialFocusRef, complete: close, cancel: close, visible: scope.visible })}
    </div>
  );
}

function EditableDetailsItem({
  ref, label, renderEditor, open: openProp, defaultOpen = false, onOpenChange,
  children, slotProps, className, sx, ...rest
}: EditableDetailsItemProps) {
  const [open, requestOpen, resetOpen] = useControlledState(openProp, renderEditor ? defaultOpen : false, onOpenChange);
  const scope = useContext(DisclosureContext);
  const text = useContext(MessagesContext);
  const root = useRef<HTMLDivElement>(null);
  const edit = useRef<HTMLButtonElement>(null);
  const memory = useFocusMemory(root, true);
  const wasCapable = useRef(!!renderEditor);
  const acceptedClose = useRef(false);
  acceptedClose.current = !open && !!renderEditor;
  const id = useId();
  useLayoutEffect(() => {
    if (wasCapable.current && !renderEditor) {
      memory.intent.current = false;
      resetOpen();
    }
    wasCapable.current = !!renderEditor;
  }, [renderEditor, resetOpen, memory.intent]);
  const recoverRemovedRow = useCallback<RefCallback<HTMLDivElement>>((node) => {
    root.current = node;
    return () => {
      if (node && ownedFocus(node, memory.last.current)) {
        queueMicrotask(() => {
          if (!node.isConnected && node.ownerDocument.activeElement === node.ownerDocument.body) focusDisclosure(scope.triggers);
        });
      }
      root.current = null;
    };
  }, [memory.last, scope.triggers]);
  const mergedRef = useMergeRefs([recoverRemovedRow, ref]);
  const requestClose = useCallback(() => requestOpen(false), [requestOpen]);
  const editing = !!open && !!renderEditor;
  return (
    <WithSx className={className} styles={itemStyle} sx={sx}>
      {(className) => (
        <div {...rest} ref={mergedRef} className={className} data-ui="editable-details-item" data-state={editing ? 'open' : 'closed'}>
          <dt id={`${id}-label`} css={[labelStyle, slotProps?.label?.css]} className={slotProps?.label?.className}>
            {label}
          </dt>
          <dd css={[descriptionStyle, slotProps?.description?.css]} className={slotProps?.description?.className}>
            {editing ? (
              <EditorSession
                renderEditor={renderEditor}
                labelId={`${id}-label`}
                hostId={`${id}-editor`}
                part={slotProps?.editor}
                edit={edit}
                requestClose={requestClose}
                focusIntent={memory.intent}
                acceptedClose={acceptedClose}
              />
            ) : (
              <div css={[summaryStyle, slotProps?.summary?.css]} className={slotProps?.summary?.className}>
                <div css={valueStyle}>{children}</div>
                {renderEditor && (
                  <button
                    ref={edit}
                    type="button"
                    id={`${id}-edit`}
                    aria-labelledby={`${id}-edit ${id}-label`}
                    onClick={() => { memory.intent.current = true; requestOpen(true); }}
                    css={[editStyle, slotProps?.edit?.css]}
                    className={slotProps?.edit?.className}
                    data-ui="editable-details-edit"
                  >
                    {text.edit}
                  </button>
                )}
              </div>
            )}
          </dd>
        </div>
      )}
    </WithSx>
  );
}
EditableDetailsItem.displayName = 'EditableDetails.Item';

export const EditableDetails = Object.assign(EditableDetailsRoot, {
  Section: EditableDetailsSection, List: EditableDetailsList, Item: EditableDetailsItem,
});
