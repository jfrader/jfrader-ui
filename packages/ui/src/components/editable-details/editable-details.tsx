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
  type ComponentType,
  type ReactNode,
  type Ref,
  type RefCallback,
  type RefObject,
} from 'react';
import { useMergeRefs } from '@floating-ui/react';
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type Theme } from '../../styling/css';
import { disclosureCaret, disclosureCaretInlineSize } from '../../styling/disclosure-caret';
import { focusRingInset } from '../../styling/focus-ring';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import { WithSx, type SxProps } from '../../styling/sx';
import { useControlledState } from '../../utils/use-controlled-state';

declare const process: { env: { NODE_ENV?: string } };

export interface EditableDetailsMessages {
  edit: string;
}
export interface EditableDetailsPartProps {
  className?: string;
  css?: Interpolation<Theme>;
}

export interface EditableDetailsItemRecord {
  /** Stable identifier for this item, used as React key. */
  value: string;
  /** Label describing this detail. */
  label: ReactNode;
  /** Content rendered for this detail in summary/read view. */
  content: ReactNode;
  /** Custom editor renderer. When provided, renders the Edit button and manages editor session. */
  renderEditor?: (props: EditableDetailsEditorProps) => ReactNode;
  /** Controls editor open state. */
  open?: boolean;
  /** Initial editor open state. */
  defaultOpen?: boolean;
  /** Callback fired when editor open state changes. */
  onOpenChange?: (open: boolean) => void;
  /** Optional item-specific slotProps overrides. */
  slotProps?: EditableDetailsItemProps['slotProps'];
}

export interface EditableDetailsSectionRecord {
  /** Stable identifier for this section, used as React key. */
  value: string;
  /** Section heading title. */
  title: ReactNode;
  /** Items contained within this section. */
  items: readonly EditableDetailsItemRecord[];
  /** Heading level for this section (1-6). Defaults to 3. */
  headingLevel?: 1 | 2 | 3 | 4 | 5 | 6;
  /** Controls section disclosure open state. */
  open?: boolean;
  /** Initial section disclosure open state. */
  defaultOpen?: boolean;
  /** Callback fired when section open state changes. */
  onOpenChange?: (open: boolean) => void;
  /** Ref to the disclosure trigger button. */
  triggerRef?: Ref<HTMLButtonElement>;
  /** Optional section-specific slotProps overrides. */
  slotProps?: EditableDetailsSectionProps['slotProps'];
}

export interface EditableDetailsSlots {
  /** Replaces the root container element; renders a `div` by default. */
  root?: ComponentType<ComponentPropsWithRef<'div'>>;
  /** Replaces the collapsible section container. */
  section?: ComponentType<EditableDetailsSectionProps>;
  /** Replaces the definition list container for items. */
  list?: ComponentType<EditableDetailsListProps>;
  /** Replaces each detail item row in the list. */
  item?: ComponentType<EditableDetailsItemProps>;
}

export interface EditableDetailsSlotProps {
  /** Root container element around the sections. */
  root?: ComponentPropsWithRef<'div'> &
    SxProps & {
      css?: Interpolation<Theme>;
      [attribute: `data-${string}`]: unknown;
    };
  /** Collapsible section container. */
  section?: Partial<Omit<EditableDetailsSectionProps, 'children' | 'title'>>;
  /** Definition list container for items. */
  list?: Partial<EditableDetailsListProps>;
  /** Each detail item row in the list. */
  item?: Partial<Omit<EditableDetailsItemProps, 'children' | 'label'>>;
}

export interface EditableDetailsBaseProps extends Omit<ComponentPropsWithRef<'div'>, 'children'>, SxProps {
  css?: Interpolation<Theme>;
  messages?: Partial<EditableDetailsMessages>;
  /** Replace the root. Exactly sugar for `slots.root`; declare the component outside render. */
  component?: ComponentType<ComponentPropsWithRef<'div'>>;
  [attribute: `data-${string}`]: unknown;
}

export interface EditableDetailsCompoundProps extends EditableDetailsBaseProps {
  children?: ReactNode;
  sections?: never;
  slots?: EditableDetailsSlots;
  slotProps?: EditableDetailsSlotProps;
}

export interface EditableDetailsEasyProps extends EditableDetailsBaseProps {
  /** Structured section records to render. */
  sections: readonly EditableDetailsSectionRecord[];
  children?: never;
  slots?: EditableDetailsSlots;
  slotProps?: EditableDetailsSlotProps;
}

export type EditableDetailsProps = EditableDetailsCompoundProps | EditableDetailsEasyProps;
export interface EditableDetailsSectionSlots {
  /** Groups the section disclosure trigger. */
  heading?: ComponentType<EditableDetailsPartProps>;
  /** Toggles the section disclosure. */
  trigger?: ComponentType<EditableDetailsPartProps>;
  /** Contains the collapsible section body. */
  panel?: ComponentType<EditableDetailsPartProps>;
}

export interface EditableDetailsItemSlots {
  /** Displays the detail label. */
  label?: ComponentType<EditableDetailsPartProps>;
  /** Contains the detail summary or editor. */
  description?: ComponentType<EditableDetailsPartProps>;
  /** Groups the read-only value and edit button. */
  summary?: ComponentType<EditableDetailsPartProps>;
  /** Opens the detail editor. */
  edit?: ComponentType<EditableDetailsPartProps>;
  /** Contains the active editor. */
  editor?: ComponentType<EditableDetailsPartProps>;
}

export interface EditableDetailsSectionProps extends Omit<ComponentPropsWithRef<'section'>, 'title'>, SxProps {
  slots?: EditableDetailsSectionSlots;
  title: ReactNode;
  headingLevel?: 1 | 2 | 3 | 4 | 5 | 6;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  triggerRef?: Ref<HTMLButtonElement>;
  slotProps?: {
    /** Heading element wrapping the disclosure trigger button. */
    heading?: EditableDetailsPartProps;
    /** Button that toggles the section open and closed. */
    trigger?: EditableDetailsPartProps;
    /** Collapsible panel containing the section body. */
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
  slots?: EditableDetailsItemSlots;
  label: ReactNode;
  renderEditor?: (props: EditableDetailsEditorProps) => ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  slotProps?: {
    /** Definition term (`<dt>`) displaying the item label. */
    label?: EditableDetailsPartProps;
    /** Definition description (`<dd>`) holding the summary or editor. */
    description?: EditableDetailsPartProps;
    /** Container holding the read-only value and edit button. */
    summary?: EditableDetailsPartProps;
    /** Button that switches the item into edit mode. */
    edit?: EditableDetailsPartProps;
    /** Container holding the active editor form fields. */
    editor?: EditableDetailsPartProps;
  };
}

const DEFAULT_MESSAGES: EditableDetailsMessages = { edit: 'Edit' };
const HEADINGS = { 1: 'h1', 2: 'h2', 3: 'h3', 4: 'h4', 5: 'h5', 6: 'h6' } as const;
const MessagesContext = createContext(DEFAULT_MESSAGES);
const SectionDepthContext = createContext(0);
interface DisclosureScope {
  visible: boolean;
  triggers: readonly RefObject<HTMLButtonElement | null>[];
}
const DisclosureContext = createContext<DisclosureScope>({ visible: true, triggers: [] });

// Row geometry, published on the section as custom properties. A section title starts after the
// row inset and the caret glyph, and the panel pads its content by that same column, so the
// section's rows line up under its own title. Both parts read the properties, so retuning the
// geometry happens in one place instead of restyling the trigger and losing the alignment.
const rowInset = vars.space[1];
const rowGap = vars.space[2];
const rowInsetVar = 'var(--editable-details-row-inset)';
const rowGapVar = 'var(--editable-details-row-gap)';

const rootStyle = css({
  label: 'editable-details', display: 'grid', gap: vars.space[8], minInlineSize: 0,
  maxInlineSize: '100%', fontFamily: vars.font.sans, color: vars.color.text,
  fontSize: vars.textSize.sm,
  lineHeight: vars.lineHeight.base, textAlign: 'start', overflowWrap: 'anywhere',
});
const sectionStyle = css({
  minInlineSize: 0,
  '--editable-details-row-inset': rowInset,
  '--editable-details-row-gap': rowGap,
  '--editable-details-title-inset': `calc(${rowInsetVar} + ${disclosureCaretInlineSize} + ${rowGapVar})`,
});
const headingStyle = css({ margin: 0, font: 'inherit' });
const triggerStyle = css({
  display: 'flex', alignItems: 'center', gap: rowGapVar,
  inlineSize: '100%', minInlineSize: 0,
  paddingBlock: vars.space[2], paddingInlineStart: rowInsetVar, paddingInlineEnd: vars.space[2], border: 0,
  background: 'transparent', color: 'inherit', font: 'inherit', fontSize: vars.textSize.md, fontWeight: vars.fontWeight.semibold,
  textAlign: 'start', overflowWrap: 'anywhere', cursor: 'pointer', borderRadius: vars.radius.sm,
  '&::before': disclosureCaret,
  '&[aria-expanded="true"]::before': { transform: 'rotate(90deg)' },
  '&[aria-expanded="true"]:dir(rtl)::before': { transform: 'rotate(-90deg)' },
  '&:hover': { backgroundColor: vars.color.surfaceHover }, '&:focus-visible': focusRingInset,
  [REDUCED_MOTION]: { '&::before': { transitionDuration: '0s' } },
  [FORCED_COLORS]: { '&::before': { forcedColorAdjust: 'none', borderInlineStartColor: 'ButtonText' } },
});
const topLevelTriggerStyle = css({ minBlockSize: vars.space[10] });
const nestedTriggerStyle = css({ minBlockSize: vars.space[8] });
const panelStyle = css({
  display: 'grid', gap: vars.space[4], minInlineSize: 0, paddingBlockStart: vars.space[2],
  paddingInlineStart: 'var(--editable-details-title-inset)', position: 'relative',
  '&::before': {
    content: '""', position: 'absolute', insetBlock: 0, insetInlineStart: rowInsetVar,
    borderInlineStart: `1px solid ${vars.color.border}`, pointerEvents: 'none',
  },
  '&[hidden]': { display: 'none' },
  '&:empty': { paddingBlockStart: 0 },
  [FORCED_COLORS]: { '&::before': { borderInlineStartColor: 'CanvasText' } },
});
const listStyle = css({ margin: 0, minInlineSize: 0 });
const itemStyle = css({
  display: 'flex', flexWrap: 'wrap', gap: vars.space[2], minInlineSize: 0,
  paddingBlock: vars.space[2], minBlockSize: vars.space[8], alignItems: 'start',
  '&:where(:not(:last-child))': { borderBlockEnd: `1px solid ${vars.color.border}` },
});
const labelStyle = css({ flex: '1 1 12rem', minInlineSize: 0, color: vars.color.textMuted, fontWeight: vars.fontWeight.regular });
const descriptionStyle = css({ flex: '2 1 18rem', minInlineSize: 0, margin: 0 });
const summaryStyle = css({ display: 'flex', flexWrap: 'wrap', alignItems: 'start', gap: vars.space[2], minInlineSize: 0 });
const valueStyle = css({ flex: '1 1 8rem', minInlineSize: 0, fontWeight: vars.fontWeight.medium, color: vars.color.text });
const editStyle = css({
  minBlockSize: vars.space[8], paddingInline: vars.space[2], paddingBlock: vars.space[1],
  border: '1px solid transparent', borderRadius: vars.radius.sm,
  background: 'transparent', color: vars.color.textMuted, font: 'inherit', fontSize: vars.textSize.sm, cursor: 'pointer',
  marginInlineStart: 'auto',
  '&:hover': { backgroundColor: vars.color.surfaceHover, color: vars.color.text }, '&:focus-visible': focusRingInset,
  [FORCED_COLORS]: { borderColor: 'ButtonText', color: 'ButtonText' },
});
const editorStyle = css({
  minInlineSize: 0, maxInlineSize: '100%', padding: vars.space[3],
  border: `1px solid ${vars.color.border}`, borderRadius: vars.radius.sm,
  background: vars.color.surfaceInset, '&:focus': focusRingInset,
});

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

const tokens = (...values: Array<unknown>): string | undefined => {
  const list = [...new Set(values.flatMap((v) => (typeof v === 'string' ? v.split(/\s+/) : [])))].filter(Boolean);
  return list.join(' ') || undefined;
};

function EditableDetailsRoot(props: EditableDetailsProps) {
  const {
    ref,
    component,
    slots,
    slotProps,
    messages,
    className,
    style,
    sx,
    css: consumerCss,
    'data-ui': consumerDataUi,
    sections,
    children,
    ...restProps
  } = props;

  if (process.env.NODE_ENV !== 'production') {
    if (component && slots?.root && component !== slots.root) {
      console.warn('EditableDetails: component is redundant when slots.root is supplied; slots.root wins.');
    }
  }

  const RootPart = slots?.root ?? component ?? 'div';
  const rootSlot = slotProps?.root;
  const {
    css: slotCss,
    className: slotClassName,
    style: slotStyle,
    ref: slotRef,
    sx: slotSx,
    'data-ui': slotDataUi,
    ...slotRest
  } = rootSlot ?? {};

  const merged = { ref, ...restProps, ...slotRest };
  const effectiveRef = slotRef ?? ref;
  const mergedStyle = style || slotStyle ? { ...style, ...slotStyle } : undefined;
  const mergedClassName = [slotClassName, className].filter(Boolean).join(' ') || undefined;

  const inherited = useContext(MessagesContext);
  const text = useMemo(() => ({ ...inherited, ...messages }), [inherited, messages]);

  let renderedContent: ReactNode;
  if (sections !== undefined) {
    const SectionPart = slots?.section ?? EditableDetailsSection;
    const ListPart = slots?.list ?? EditableDetailsList;
    const ItemPart = slots?.item ?? EditableDetailsItem;

    renderedContent = sections.map((section) => {
      const {
        value: sectionValue,
        title: sectionTitle,
        items: sectionItems,
        headingLevel: sectionHeadingLevel,
        open: sectionOpen,
        defaultOpen: sectionDefaultOpen,
        onOpenChange: sectionOnOpenChange,
        triggerRef: sectionTriggerRef,
        slotProps: sectionItemSlotProps,
      } = section;

      return (
        <SectionPart
          key={sectionValue}
          {...slotProps?.section}
          triggerRef={sectionTriggerRef ?? slotProps?.section?.triggerRef}
          title={sectionTitle}
          headingLevel={sectionHeadingLevel ?? slotProps?.section?.headingLevel}
          open={sectionOpen !== undefined ? sectionOpen : slotProps?.section?.open}
          defaultOpen={sectionDefaultOpen !== undefined ? sectionDefaultOpen : slotProps?.section?.defaultOpen}
          onOpenChange={sectionOnOpenChange ?? slotProps?.section?.onOpenChange}
          slotProps={sectionItemSlotProps ?? slotProps?.section?.slotProps}
        >
          <ListPart {...slotProps?.list}>
            {sectionItems.map((item) => {
              const {
                value: itemValue,
                label: itemLabel,
                content: itemContent,
                renderEditor: itemRenderEditor,
                open: itemOpen,
                defaultOpen: itemDefaultOpen,
                onOpenChange: itemOnOpenChange,
                slotProps: itemCustomSlotProps,
              } = item;

              return (
                <ItemPart
                  key={itemValue}
                  {...slotProps?.item}
                  label={itemLabel}
                  renderEditor={itemRenderEditor ?? slotProps?.item?.renderEditor}
                  open={itemOpen !== undefined ? itemOpen : slotProps?.item?.open}
                  defaultOpen={itemDefaultOpen !== undefined ? itemDefaultOpen : slotProps?.item?.defaultOpen}
                  onOpenChange={itemOnOpenChange ?? slotProps?.item?.onOpenChange}
                  slotProps={itemCustomSlotProps ?? slotProps?.item?.slotProps}
                >
                  {itemContent}
                </ItemPart>
              );
            })}
          </ListPart>
        </SectionPart>
      );
    });
  } else {
    renderedContent = children;
  }

  return (
    <MessagesContext.Provider value={text}>
      <WithSx className={mergedClassName} styles={[rootStyle, slotCss, slotSx, consumerCss]} sx={sx}>
        {(classes) => (
          <RootPart
            {...merged}
            ref={effectiveRef}
            style={mergedStyle}
            className={classes}
            data-ui={tokens('editable-details', consumerDataUi, slotDataUi)}
          >
            {renderedContent}
          </RootPart>
        )}
      </WithSx>
    </MessagesContext.Provider>
  );
}
EditableDetailsRoot.displayName = 'EditableDetails';

function EditableDetailsSection({
  ref, title, headingLevel = 3, open: openProp, defaultOpen = false, onOpenChange,
  triggerRef, slotProps, slots, children, className, sx, ...rest
}: EditableDetailsSectionProps) {
  const [open, requestOpen] = useControlledState(openProp, defaultOpen, onOpenChange);
  const parent = useContext(DisclosureContext);
  const depth = useContext(SectionDepthContext);
  const button = useRef<HTMLButtonElement>(null);
  const mergedTrigger = useMergeRefs([button, triggerRef]);
  const panel = useRef<HTMLDivElement>(null);
  const memory = useFocusMemory(panel);
  const id = useId();
  const Heading = slots?.heading ?? HEADINGS[headingLevel];
  const Trigger = slots?.trigger ?? 'button';
  const Panel = slots?.panel ?? 'div';
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
        <section {...rest} ref={ref} className={className} data-ui="editable-details-section" data-state={open ? 'open' : 'closed'} data-depth={depth}>
          <Heading {...slotProps?.heading} css={[headingStyle, slotProps?.heading?.css]} className={slotProps?.heading?.className}>
            <Trigger
              {...slotProps?.trigger}
              ref={mergedTrigger}
              type="button"
              id={`${id}-trigger`}
              aria-expanded={!!open}
              aria-controls={`${id}-panel`}
              onClick={() => requestOpen(!open)}
              css={[triggerStyle, depth === 0 ? topLevelTriggerStyle : nestedTriggerStyle, slotProps?.trigger?.css]}
              className={slotProps?.trigger?.className}
              data-ui="editable-details-section-trigger"
            >
              {title}
            </Trigger>
          </Heading>
          <DisclosureContext.Provider value={scope}>
            <Panel
              {...slotProps?.panel}
              ref={panel}
              id={`${id}-panel`}
              hidden={!open}
              css={[panelStyle, slotProps?.panel?.css]}
              className={slotProps?.panel?.className}
              data-ui="editable-details-section-panel"
            >
              <SectionDepthContext.Provider value={depth + 1}>{children}</SectionDepthContext.Provider>
            </Panel>
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
  component?: EditableDetailsItemSlots['editor'];
  edit: RefObject<HTMLButtonElement | null>;
  requestClose: () => void;
  focusIntent: RefObject<boolean>;
  acceptedClose: RefObject<boolean>;
}
function EditorSession({ renderEditor, labelId, hostId, part, component, edit, requestClose, focusIntent, acceptedClose }: SessionProps) {
  const Editor = component ?? 'div';
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
    <Editor
      {...part}
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
    </Editor>
  );
}

function EditableDetailsItem({
  ref, label, renderEditor, open: openProp, defaultOpen = false, onOpenChange,
  children, slotProps, slots, className, sx, ...rest
}: EditableDetailsItemProps) {
  const Label = slots?.label ?? 'dt';
  const Description = slots?.description ?? 'dd';
  const Summary = slots?.summary ?? 'div';
  const Edit = slots?.edit ?? 'button';
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
          <Label {...slotProps?.label} id={`${id}-label`} css={[labelStyle, slotProps?.label?.css]} className={slotProps?.label?.className}>
            {label}
          </Label>
          <Description {...slotProps?.description} css={[descriptionStyle, slotProps?.description?.css]} className={slotProps?.description?.className}>
            {editing ? (
              <EditorSession
                renderEditor={renderEditor}
                labelId={`${id}-label`}
                hostId={`${id}-editor`}
                part={slotProps?.editor}
                component={slots?.editor}
                edit={edit}
                requestClose={requestClose}
                focusIntent={memory.intent}
                acceptedClose={acceptedClose}
              />
            ) : (
              <Summary {...slotProps?.summary} css={[summaryStyle, slotProps?.summary?.css]} className={slotProps?.summary?.className}>
                <div css={valueStyle}>{children}</div>
                {renderEditor && (
                  <Edit
                    {...slotProps?.edit}
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
                  </Edit>
                )}
              </Summary>
            )}
          </Description>
        </div>
      )}
    </WithSx>
  );
}
EditableDetailsItem.displayName = 'EditableDetails.Item';

export const EditableDetails = Object.assign(EditableDetailsRoot, {
  Section: EditableDetailsSection, List: EditableDetailsList, Item: EditableDetailsItem,
});
