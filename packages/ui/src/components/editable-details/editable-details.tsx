'use client';

// APG Disclosure: each section is a heading wrapping a native button with aria-expanded and
// aria-controls; Enter/Space toggle it and Tab follows document order. Rows are a definition list,
// the label in `dt` and the value in `dd`. An editable row's value is an InlineEdit, which owns its
// keyboard, pending and error contract; this component never edits anything itself.
//
// `rows` is the generic row model. The consumer maps its own data into rows, marks a text row
// editable by giving it `edit` (the context its save needs), and persists through
// `onSave(next, row)`. A row whose value is not text brings its own editor through `renderEditor`:
// the editor persists through `submit(persist)` with its own typed value, and the row owns the
// session around it (open state, initial focus, pending, error and focus return). The component
// owns presentation and which sections are expanded. Composition (Section, List, Item) builds the
// same anatomy by hand.
//
// Focus ownership follows the React tree, not the DOM, so focus in a portaled picker still counts
// as inside its section and its editor.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type ComponentType,
  type ReactNode,
  type Ref,
  type RefCallback,
  type RefObject,
  type SyntheticEvent,
} from 'react';
import { useMergeRefs } from '@floating-ui/react';
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type Theme } from '../../styling/css';
import { disclosureCaret, disclosureCaretInlineSize } from '../../styling/disclosure-caret';
import { focusRingInset } from '../../styling/focus-ring';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import { withoutSx, WithSx, type SxProps } from '../../styling/sx';
import { isRenderable } from '../../utils/renderable';
import { useControlledState } from '../../utils/use-controlled-state';
import { Button, buttonBlockSizes } from '../button/button';
import { FieldError } from '../field/field-anatomy';
import { InlineEdit, type InlineEditProps } from '../inline-edit';

declare const process: { env: { NODE_ENV?: string } };

export type EditableDetailsHeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

export interface EditableDetailsPartProps {
  className?: string;
  sx?: Interpolation<Theme>;
}

interface RowIdentity {
  /** Unique among all rows; identifies the row in `onSave` and in the expansion state. */
  id: string;
  /** Names the row: the term of a value row, the title of a section row. */
  label: string;
}

/** A read-only detail. Without `edit` there is no edit affordance. */
export interface EditableDetailsValueRow extends RowIdentity {
  /** Content shown as the value. Empty content shows the root's `emptyValue`. */
  value?: ReactNode;
  edit?: never;
  renderEditor?: never;
  children?: never;
}

/** A detail edited in place through InlineEdit. */
export interface EditableDetailsEditableRow<Context extends {} = true> extends RowIdentity {
  /** The persisted text. The row shows it until your data changes, never the draft. */
  value: string;
  /**
   * Makes the row editable and is handed back to `onSave` with the row: `true`, or what persisting
   * needs, such as a record id.
   */
  edit: Context;
  /** Returns a nonempty message to block the save and keep the editor open. */
  validate?: InlineEditProps['validate'];
  /** Turns the draft into the saved value. Defaults to the draft as typed. */
  normalize?: InlineEditProps['normalize'];
  /** Edits in a textarea; Shift+Enter inserts a newline. */
  multiline?: boolean;
  /** Native placeholder of the editor. */
  inputPlaceholder?: string;
  /** Error for this row from outside, such as a conflict; marks the editor invalid and blocks saving. */
  error?: ReactNode;
  renderEditor?: never;
  children?: never;
}

/** What a row hands to its `renderEditor` while the editor is open. */
export interface EditableDetailsEditorProps {
  /** Attach to the element that takes focus when the editor opens. Without it, the editor group takes focus. */
  initialFocusRef: RefCallback<HTMLElement>;
  /**
   * Saves through `persist`, which writes your value with your own function. The row is pending
   * until a returned promise settles. A resolved save closes the editor and returns focus to the
   * row's Edit button. A throw or rejection keeps the editor open and shows the row's error.
   * Ignored while a save is pending.
   */
  submit: (persist: () => void | Promise<unknown>) => void;
  /** Closes the editor without saving and returns focus to the row's Edit button. Ignored while a save is pending. */
  cancel: () => void;
  /** Whether a save is pending. Make the editor's fields and actions inert while it is `true`. */
  pending: boolean;
  /** Id of the row's error message while one shows. Add it to `aria-describedby` of the field it concerns. */
  errorId: string | undefined;
  /** Whether every enclosing section is expanded. Close portaled and top-layer surfaces while it is `false`. */
  visible: boolean;
}

/** A detail whose value is not text, edited by the editor you render. */
export interface EditableDetailsEditorRow extends RowIdentity {
  /** Content shown as the value while the editor is closed. Empty content shows the root's `emptyValue`. */
  value?: ReactNode;
  /**
   * Makes the row editable and renders its editor while it is open. Your editor keeps its own
   * draft and persists through `submit`; `onSave` is not called for this row.
   */
  renderEditor: (editor: EditableDetailsEditorProps) => ReactNode;
  /** Error for this row from outside, such as a conflict, shown under the value or the open editor. */
  error?: ReactNode;
  edit?: never;
  validate?: never;
  normalize?: never;
  multiline?: never;
  inputPlaceholder?: never;
  children?: never;
}

/** A collapsible group of rows. */
export interface EditableDetailsSectionRow<Context extends {} = true> extends RowIdentity {
  /** Rows inside the section. Value rows group into one list; section rows nest. */
  children: readonly EditableDetailsRow<Context>[];
  value?: never;
  edit?: never;
  renderEditor?: never;
}

export type EditableDetailsRow<Context extends {} = true> =
  | EditableDetailsValueRow
  | EditableDetailsEditableRow<Context>
  | EditableDetailsEditorRow
  | EditableDetailsSectionRow<Context>;

/** Text of the Edit button and save failure of rows with `renderEditor`. */
export interface EditableDetailsMessages {
  /** Visible text of the Edit button. */
  edit: string;
  /** Accessible name of the Edit button; it starts with the visible text. */
  editLabel: (context: { label: string }) => string;
  /** Error shown when `persist` throws or rejects. */
  failed: string;
}

/** InlineEdit props shared by every editable row. Row data and saving stay with the row. */
export type EditableDetailsEditProps = Partial<
  Omit<
    InlineEditProps,
    | 'value'
    | 'defaultValue'
    | 'onValueChange'
    | 'onSave'
    | 'label'
    | 'validate'
    | 'normalize'
    | 'multiline'
    | 'inputPlaceholder'
    | 'error'
  >
>;

export interface EditableDetailsSlots {
  /** Replaces the root container element; renders a `div` by default. */
  root?: ComponentType<ComponentPropsWithRef<'div'>>;
  /** Replaces each section generated from a section row. */
  section?: ComponentType<EditableDetailsSectionProps>;
  /** Replaces each definition list generated for value rows. */
  list?: ComponentType<EditableDetailsListProps>;
  /** Replaces each item generated from a value or editable row. */
  item?: ComponentType<EditableDetailsItemProps>;
  /** Replaces the InlineEdit of each text row with `edit`; forward its props and ref. */
  edit?: ComponentType<InlineEditProps>;
}

export interface EditableDetailsSlotProps {
  /** Root container element around the sections. */
  root?: ComponentPropsWithRef<'div'> & SxProps & { [attribute: `data-${string}`]: unknown };
  /** Each generated section. */
  section?: Partial<
    Omit<EditableDetailsSectionProps, 'children' | 'title' | 'headingLevel' | 'open' | 'defaultOpen' | 'onOpenChange'>
  >;
  /** Each generated definition list. */
  list?: Partial<EditableDetailsListProps>;
  /** Each generated item. */
  item?: Partial<Omit<EditableDetailsItemProps, 'children' | 'label'>>;
  /** InlineEdit of each text row with `edit`, such as `size`, `saveOnBlur` or `messages`. */
  edit?: EditableDetailsEditProps;
}

export interface EditableDetailsBaseProps extends Omit<ComponentPropsWithRef<'div'>, 'children'>, SxProps {
  /** Replace the root. Exactly sugar for `slots.root`; declare the component outside render. */
  component?: ComponentType<ComponentPropsWithRef<'div'>>;
  [attribute: `data-${string}`]: unknown;
}

export interface EditableDetailsRowsProps<Context extends {} = true> extends EditableDetailsBaseProps {
  /** Rows mapped from your data. A row is editable when it has `edit` (text) or `renderEditor` (any value). */
  rows: readonly EditableDetailsRow<Context>[];
  /**
   * Persists a text row's changed value; rows with `renderEditor` persist through their editor. A
   * returned promise keeps that row pending until it settles; throw or reject to keep its editor
   * open with the failure as its error. Update your data so the row's `value` reflects the save.
   */
  onSave: (next: string, row: EditableDetailsEditableRow<NoInfer<Context>>) => void | Promise<unknown>;
  /** Overrides the English Edit button text and save failure of rows with `renderEditor`. */
  messages?: Partial<EditableDetailsMessages>;
  /** Ids of the expanded section rows. */
  expanded?: readonly string[];
  /** Section rows expanded initially, or `'all'`. Defaults to `'all'`. */
  defaultExpanded?: readonly string[] | 'all';
  /** Receives the requested expanded ids when a section is toggled. */
  onExpandedChange?: (expanded: readonly string[]) => void;
  /** Heading level of top-level section rows; each nested level adds one, up to 6. Defaults to `3`. */
  headingLevel?: EditableDetailsHeadingLevel;
  /** Shown for an empty value: a blank read-only value, or the placeholder of an empty editable one. */
  emptyValue?: ReactNode;
  children?: never;
  /** Replaces the root and the generated sections, lists, items and editors. */
  slots?: EditableDetailsSlots;
  /** Passes props and `sx` to the root and to every generated section, list, item and editor. */
  slotProps?: EditableDetailsSlotProps;
}

export interface EditableDetailsComposedProps extends EditableDetailsBaseProps {
  /** Composes sections, lists and items instead of supplying `rows`. */
  children?: ReactNode;
  rows?: never;
  onSave?: never;
  messages?: never;
  expanded?: never;
  defaultExpanded?: never;
  onExpandedChange?: never;
  headingLevel?: never;
  emptyValue?: never;
  /** Replaces the root. */
  slots?: Pick<EditableDetailsSlots, 'root'>;
  /** Passes props and `sx` to the root. */
  slotProps?: Pick<EditableDetailsSlotProps, 'root'>;
}

export type EditableDetailsProps<Context extends {} = true> =
  | EditableDetailsRowsProps<Context>
  | EditableDetailsComposedProps;

export interface EditableDetailsSectionSlots {
  /** Groups the section disclosure trigger. Renders an `h3` by default, or the heading set by `headingLevel`. */
  heading?: ComponentType<EditableDetailsPartProps>;
  /** Toggles the section disclosure. */
  trigger?: ComponentType<EditableDetailsPartProps>;
  /** Contains the collapsible section body. */
  panel?: ComponentType<EditableDetailsPartProps>;
}

export interface EditableDetailsItemSlots {
  /** Displays the detail label. */
  label?: ComponentType<EditableDetailsPartProps>;
  /** Contains the detail value. */
  description?: ComponentType<EditableDetailsPartProps>;
}

export interface EditableDetailsSectionProps extends Omit<ComponentPropsWithRef<'section'>, 'title'>, SxProps {
  /** Replaces the section heading, disclosure trigger and panel. */
  slots?: EditableDetailsSectionSlots;
  /** Displays the section's disclosure button text. */
  title: ReactNode;
  /** Sets the section heading's HTML level. Defaults to `3`. */
  headingLevel?: EditableDetailsHeadingLevel;
  /** Controls whether the section body is visible. */
  open?: boolean;
  /** Shows the uncontrolled section body initially. Defaults to `false`. */
  defaultOpen?: boolean;
  /** Receives requests to expand or collapse the section. */
  onOpenChange?: (open: boolean) => void;
  /** Receives the section's disclosure button. */
  triggerRef?: Ref<HTMLButtonElement>;
  /** Passes props and `sx` to the section heading, disclosure trigger and panel. */
  slotProps?: {
    /** Heading element wrapping the disclosure trigger button. Renders an `h3` by default, or the heading set by `headingLevel`. */
    heading?: EditableDetailsPartProps;
    /** Button that toggles the section open and closed. */
    trigger?: EditableDetailsPartProps;
    /** Collapsible panel containing the section body. */
    panel?: EditableDetailsPartProps;
  };
}

export interface EditableDetailsListProps extends ComponentPropsWithRef<'dl'>, SxProps {}

export interface EditableDetailsItemProps extends ComponentPropsWithRef<'div'>, SxProps {
  /** Replaces the item's label and value parts. */
  slots?: EditableDetailsItemSlots;
  /** Names the detail beside its value. */
  label: ReactNode;
  /** Passes props and `sx` to the item's label and value parts. */
  slotProps?: {
    /** Definition term (`<dt>`) displaying the item label. */
    label?: EditableDetailsPartProps;
    /** Definition description (`<dd>`) holding the value. */
    description?: EditableDetailsPartProps;
  };
}

const HEADINGS = { 1: 'h1', 2: 'h2', 3: 'h3', 4: 'h4', 5: 'h5', 6: 'h6' } as const;
const DEFAULT_HEADING_LEVEL: EditableDetailsHeadingLevel = 3;
const MAX_HEADING_LEVEL: EditableDetailsHeadingLevel = 6;
const SectionDepthContext = createContext(0);
interface DisclosureScope {
  triggers: readonly RefObject<HTMLButtonElement | null>[];
  /** Whether every enclosing section is expanded. */
  visible: boolean;
}
const DisclosureContext = createContext<DisclosureScope>({ triggers: [], visible: true });

const DEFAULT_MESSAGES: EditableDetailsMessages = {
  edit: 'Edit',
  editLabel: ({ label }) => `Edit ${label}`,
  failed: 'Could not save. Try again.',
};

// Row geometry, published on the section as custom properties. A section title starts after the
// row inset and the caret glyph, and the panel pads its content by that same column, so the
// section's rows line up under its own title. Both parts read the properties, so retuning the
// geometry happens in one place instead of restyling the trigger and losing the alignment.
const rowInset = vars.space[1];
const rowGap = vars.space[2];
const rowInsetVar = 'var(--editable-details-row-inset)';
const rowGapVar = 'var(--editable-details-row-gap)';
// Every value sits on one line of the editor's small block, editable or not, so rows keep one rhythm.
const valueLine = buttonBlockSizes.sm;

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
  display: 'flex', flexWrap: 'wrap', columnGap: vars.space[2], minInlineSize: 0,
  paddingBlock: vars.space[1], alignItems: 'start',
  '&:where(:not(:last-child))': { borderBlockEnd: `1px solid ${vars.color.border}` },
});
const lineStyle = css({ display: 'flex', alignItems: 'center', minBlockSize: valueLine, minInlineSize: 0 });
const labelStyle = css({ flex: '1 1 12rem', color: vars.color.textMuted, fontWeight: vars.fontWeight.regular });
const descriptionStyle = css({ flex: '2 1 18rem', margin: 0, fontSize: vars.textSize.md, color: vars.color.text });
// A read-only value takes the InlineEdit trigger's inline box, so its text starts where an
// editable value's text does.
const valueStyle = css({
  boxSizing: 'border-box', minInlineSize: 0, paddingInline: vars.space[2],
  borderInline: '1px solid transparent',
});
const editStyle = css({ flex: '1 1 auto' });
// A row with its own editor: the value and its Edit button rest on the value line, the open editor
// replaces both, and the row's error follows either.
const editorRowStyle = css({ display: 'grid', gap: vars.space[1], flex: '1 1 auto', minInlineSize: 0 });
const summaryStyle = css({ display: 'flex', alignItems: 'center', gap: vars.space[2], minBlockSize: valueLine, minInlineSize: 0 });
const summaryValueStyle = css({ flex: '1 1 auto' });
const editorStyle = css({
  display: 'grid', gap: vars.space[3], minInlineSize: 0, paddingBlock: vars.space[1],
  borderRadius: vars.radius.sm, '&:focus-visible': focusRingInset,
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

// Whether focus last landed in this part's React tree, portaled content included. Hiding or
// removing the focused element leaves activeElement at body without a focusin, so ownership holds
// until focus lands elsewhere or a press outside may move it. Spread `claim` as the part's
// `onFocus` and `onMouseDown`: React dispatches from its root, below the document, so the claim is
// recorded before the document listener settles the same event.
function useFocusOwnership(root: RefObject<HTMLElement | null>) {
  const owned = useRef(false);
  const claimed = useRef<Event | null>(null);
  useLayoutEffect(() => {
    const element = root.current;
    if (!element) return;
    const doc = element.ownerDocument;
    owned.current = element.contains(doc.activeElement);
    const inside = (event: Event) => claimed.current === event || event.composedPath().includes(element);
    const focus = (event: FocusEvent) => {
      owned.current = inside(event);
    };
    const press = (event: MouseEvent) => {
      if (!event.defaultPrevented && !inside(event)) owned.current = false;
    };
    doc.addEventListener('focusin', focus);
    doc.addEventListener('mousedown', press);
    return () => {
      doc.removeEventListener('focusin', focus);
      doc.removeEventListener('mousedown', press);
    };
  }, [root]);
  const claim = useCallback((event: SyntheticEvent) => {
    claimed.current = event.nativeEvent;
  }, []);
  return { owned, claim };
}

const tokens = (...values: Array<unknown>): string | undefined => {
  const list = [...new Set(values.flatMap((v) => (typeof v === 'string' ? v.split(/\s+/) : [])))].filter(Boolean);
  return list.join(' ') || undefined;
};

// A blank string is no value to show, unlike `0` or other renderable content.
const isEmptyValue = (value: ReactNode) => !isRenderable(value) || (typeof value === 'string' && value.trim() === '');

const isSectionRow =<Context extends {}>(row: EditableDetailsRow<Context>): row is EditableDetailsSectionRow<Context> =>
  row.children !== undefined;
const isEditableRow = <Context extends {}>(row: EditableDetailsRow<Context>): row is EditableDetailsEditableRow<Context> =>
  row.edit !== undefined;
const isEditorRow = <Context extends {}>(row: EditableDetailsRow<Context>): row is EditableDetailsEditorRow =>
  row.renderEditor !== undefined;
type DetailRow<Context extends {}> = EditableDetailsValueRow | EditableDetailsEditableRow<Context> | EditableDetailsEditorRow;

function sectionIds<Context extends {}>(rows: readonly EditableDetailsRow<Context>[]): string[] {
  return rows.flatMap((row) => (isSectionRow(row) ? [row.id, ...sectionIds(row.children)] : []));
}

const headingAt = (base: EditableDetailsHeadingLevel, depth: number) =>
  Math.min(base + depth, MAX_HEADING_LEVEL) as EditableDetailsHeadingLevel;

function EditableDetailsRoot<Context extends {} = true>(props: EditableDetailsProps<Context>) {
  const {
    ref,
    component,
    slots,
    slotProps,
    className,
    style,
    sx,
    'data-ui': consumerDataUi,
    rows,
    onSave,
    messages,
    expanded: expandedProp,
    defaultExpanded = 'all',
    onExpandedChange,
    headingLevel = DEFAULT_HEADING_LEVEL,
    emptyValue,
    children,
    ...restProps
  } = props;

  if (process.env.NODE_ENV !== 'production') {
    if (component && slots?.root && component !== slots.root) {
      console.warn('EditableDetails: component is redundant when slots.root is supplied; slots.root wins.');
    }
  }

  const RootPart = slots?.root ?? component ?? 'div';
  const {
    className: slotClassName,
    style: slotStyle,
    ref: slotRef,
    sx: slotSx,
    'data-ui': slotDataUi,
    ...slotRest
  } = slotProps?.root ?? {};

  const merged = { ref, ...restProps, ...slotRest };
  const effectiveRef = slotRef ?? ref;
  const mergedStyle = style || slotStyle ? { ...style, ...slotStyle } : undefined;
  const mergedClassName = [slotClassName, className].filter(Boolean).join(' ') || undefined;

  // The expansion seed resolves once, like any default.
  const [expansionSeed] = useState(() =>
    defaultExpanded === 'all' ? sectionIds(rows ?? []) : defaultExpanded,
  );
  const [expandedState, requestExpanded] = useControlledState<readonly string[]>(
    expandedProp,
    expansionSeed,
    onExpandedChange,
  );
  const expanded = useMemo(() => new Set(expandedState), [expandedState]);

  const renderRows = (list: readonly EditableDetailsRow<Context>[], depth: number): ReactNode => {
    if (!rows || !onSave) return null;
    const rowSlots = slots as EditableDetailsSlots | undefined;
    const parts = slotProps as EditableDetailsSlotProps | undefined;
    const SectionPart = rowSlots?.section ?? EditableDetailsSection;
    const ListPart = rowSlots?.list ?? EditableDetailsList;
    const ItemPart = rowSlots?.item ?? EditableDetailsItem;
    const EditPart = rowSlots?.edit ?? InlineEdit;
    const text: EditableDetailsMessages = { ...DEFAULT_MESSAGES, ...messages };

    const renderItem = (row: DetailRow<Context>) => (
      <ItemPart key={row.id} {...parts?.item} label={row.label}>
        {isEditorRow(row) ? (
          <EditorValue row={row} emptyValue={emptyValue} text={text} />
        ) : isEditableRow(row) ? (
          <EditPart
            variant="body"
            size="sm"
            placeholder={emptyValue}
            {...parts?.edit}
            label={row.label}
            value={row.value}
            onSave={(next) => onSave(next, row)}
            validate={row.validate}
            normalize={row.normalize}
            multiline={row.multiline}
            inputPlaceholder={row.inputPlaceholder}
            error={row.error}
            sx={[editStyle, parts?.edit?.sx]}
          />
        ) : (
          <span css={valueStyle}>{isEmptyValue(row.value) ? emptyValue : row.value}</span>
        )}
      </ItemPart>
    );

    // Consecutive value rows share one list; a section row ends it.
    const output: ReactNode[] = [];
    let pending: Array<DetailRow<Context>> = [];
    const flush = () => {
      if (pending.length === 0) return;
      output.push(
        <ListPart key={`list-${pending[0]!.id}`} {...parts?.list}>
          {pending.map(renderItem)}
        </ListPart>,
      );
      pending = [];
    };
    for (const row of list) {
      if (!isSectionRow(row)) {
        pending.push(row);
        continue;
      }
      flush();
      output.push(
        <SectionPart
          key={row.id}
          {...parts?.section}
          title={row.label}
          headingLevel={headingAt(headingLevel, depth)}
          open={expanded.has(row.id)}
          onOpenChange={(open) =>
            requestExpanded(open ? [...(expandedState ?? []), row.id] : (expandedState ?? []).filter((id) => id !== row.id))
          }
        >
          {renderRows(row.children, depth + 1)}
        </SectionPart>,
      );
    }
    flush();
    return output;
  };

  return (
    <WithSx className={mergedClassName} styles={[rootStyle, slotSx]} sx={sx}>
      {(classes) => (
        <RootPart
          {...merged}
          ref={effectiveRef}
          style={mergedStyle}
          className={classes}
          data-ui={tokens('editable-details', consumerDataUi, slotDataUi)}
        >
          {rows ? renderRows(rows, 0) : children}
        </RootPart>
      )}
    </WithSx>
  );
}
EditableDetailsRoot.displayName = 'EditableDetails';

function EditableDetailsSection({
  ref, title, headingLevel = DEFAULT_HEADING_LEVEL, open: openProp, defaultOpen = false, onOpenChange,
  triggerRef, slotProps, slots, children, className, sx, ...rest
}: EditableDetailsSectionProps) {
  const [open, requestOpen] = useControlledState(openProp, defaultOpen, onOpenChange);
  const parent = useContext(DisclosureContext);
  const depth = useContext(SectionDepthContext);
  const button = useRef<HTMLButtonElement>(null);
  const mergedTrigger = useMergeRefs([button, triggerRef]);
  const panel = useRef<HTMLDivElement>(null);
  const focus = useFocusOwnership(panel);
  const id = useId();
  const Heading = slots?.heading ?? HEADINGS[headingLevel];
  const Trigger = slots?.trigger ?? 'button';
  const Panel = slots?.panel ?? 'div';
  const triggers = useMemo(() => [button, ...parent.triggers], [parent.triggers]);
  const visible = parent.visible && !!open;
  const scope = useMemo(() => ({ triggers, visible }), [triggers, visible]);
  // Collapsing a section that holds focus hands it to the nearest visible disclosure.
  useLayoutEffect(() => {
    if (!open && focus.owned.current) focusDisclosure(scope.triggers);
  }, [open, scope, focus.owned]);
  return (
    <WithSx className={className} styles={sectionStyle} sx={sx}>
      {(className) => (
        <section {...rest} ref={ref} className={className} data-ui="editable-details-section" data-state={open ? 'open' : 'closed'} data-depth={depth}>
          <Heading {...withoutSx(slotProps?.heading)} css={[headingStyle, slotProps?.heading?.sx]} className={slotProps?.heading?.className}>
            <Trigger
              {...withoutSx(slotProps?.trigger)}
              ref={mergedTrigger}
              type="button"
              id={`${id}-trigger`}
              aria-expanded={!!open}
              aria-controls={`${id}-panel`}
              onClick={() => requestOpen(!open)}
              css={[triggerStyle, depth === 0 ? topLevelTriggerStyle : nestedTriggerStyle, slotProps?.trigger?.sx]}
              className={slotProps?.trigger?.className}
              data-ui="editable-details-section-trigger"
            >
              {title}
            </Trigger>
          </Heading>
          <DisclosureContext.Provider value={scope}>
            <Panel
              {...withoutSx(slotProps?.panel)}
              ref={panel}
              id={`${id}-panel`}
              hidden={!open}
              onFocus={focus.claim}
              onMouseDown={focus.claim}
              css={[panelStyle, slotProps?.panel?.sx]}
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

function EditableDetailsItem({ label, children, slotProps, slots, className, sx, ...rest }: EditableDetailsItemProps) {
  const Label = slots?.label ?? 'dt';
  const Description = slots?.description ?? 'dd';
  return (
    <WithSx className={className} styles={itemStyle} sx={sx}>
      {(className) => (
        <div {...rest} className={className} data-ui="editable-details-item">
          <Label {...withoutSx(slotProps?.label)} css={[lineStyle, labelStyle, slotProps?.label?.sx]} className={slotProps?.label?.className}>
            {label}
          </Label>
          <Description {...withoutSx(slotProps?.description)} css={[lineStyle, descriptionStyle, slotProps?.description?.sx]} className={slotProps?.description?.className}>
            {children}
          </Description>
        </div>
      )}
    </WithSx>
  );
}
EditableDetailsItem.displayName = 'EditableDetails.Item';

type EditorPhase = 'idle' | 'saving' | 'failed';
type EditorFocusIntent = 'editor' | 'edit';

interface EditorValueProps {
  row: EditableDetailsEditorRow;
  emptyValue: ReactNode;
  text: EditableDetailsMessages;
}

// The session around a consumer editor. The editor owns its draft and its persistence; the row owns
// whether it is open, which save is current, the error, and where focus goes on open and close.
function EditorValue({ row, emptyValue, text }: EditorValueProps) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<EditorPhase>('idle');
  const [focusIntent, setFocusIntent] = useState<EditorFocusIntent | null>(null);
  const { visible } = useContext(DisclosureContext);
  const root = useRef<HTMLDivElement>(null);
  const group = useRef<HTMLDivElement>(null);
  const editButton = useRef<HTMLButtonElement>(null);
  const initialFocus = useRef<HTMLElement | null>(null);
  // The save whose settlement still counts; an unmount drops it.
  const run = useRef<object | null>(null);
  const focus = useFocusOwnership(root);
  const errorId = useId();

  useEffect(() => () => {
    run.current = null;
  }, []);

  // An intent applies once its state commits: the editor's designated element on open, the Edit
  // button on close.
  useLayoutEffect(() => {
    if (focusIntent === null || (focusIntent === 'editor') !== open) return;
    setFocusIntent(null);
    if (focusIntent === 'edit') {
      editButton.current?.focus();
      return;
    }
    const target = initialFocus.current;
    if (isVisible(target)) target.focus();
    if (target?.ownerDocument.activeElement !== target) group.current?.focus();
  }, [focusIntent, open]);

  const initialFocusRef = useCallback<RefCallback<HTMLElement>>((node) => {
    initialFocus.current = node;
    return () => {
      if (initialFocus.current === node) initialFocus.current = null;
    };
  }, []);

  const close = () => {
    if (focus.owned.current) setFocusIntent('edit');
    setOpen(false);
  };

  const submit = (persist: () => void | Promise<unknown>) => {
    if (run.current !== null) return;
    const current = {};
    run.current = current;
    setPhase('saving');
    const settle = (ok: boolean) => {
      if (run.current !== current) return;
      run.current = null;
      setPhase(ok ? 'idle' : 'failed');
      if (ok) close();
    };
    // The executor turns a synchronous throw into a rejection.
    new Promise<unknown>((resolve) => resolve(persist())).then(
      () => settle(true),
      () => settle(false),
    );
  };

  const cancel = () => {
    if (run.current !== null) return;
    setPhase('idle');
    close();
  };

  const startEditing = () => {
    setPhase('idle');
    setFocusIntent('editor');
    setOpen(true);
  };

  const errorContent = isRenderable(row.error) ? row.error : phase === 'failed' ? text.failed : null;
  const hasError = isRenderable(errorContent);
  const describedBy = hasError ? errorId : undefined;
  const pending = phase === 'saving';

  return (
    <div
      ref={root}
      css={editorRowStyle}
      data-state={open ? 'open' : 'closed'}
      data-phase={phase}
      onFocus={focus.claim}
      onMouseDown={focus.claim}
    >
      {open ? (
        <div
          ref={group}
          role="group"
          aria-label={row.label}
          aria-busy={pending || undefined}
          aria-describedby={describedBy}
          tabIndex={-1}
          css={editorStyle}
          data-ui="editable-details-editor"
        >
          {row.renderEditor({ initialFocusRef, submit, cancel, pending, errorId: describedBy, visible })}
        </div>
      ) : (
        <div css={summaryStyle}>
          <span css={[valueStyle, summaryValueStyle]}>{isEmptyValue(row.value) ? emptyValue : row.value}</span>
          <Button
            ref={editButton}
            variant="ghost"
            size="sm"
            aria-label={text.editLabel({ label: row.label })}
            aria-describedby={describedBy}
            onClick={startEditing}
          >
            {text.edit}
          </Button>
        </div>
      )}
      <FieldError id={errorId}>{errorContent}</FieldError>
    </div>
  );
}

export const EditableDetails = Object.assign(EditableDetailsRoot, {
  Section: EditableDetailsSection, List: EditableDetailsList, Item: EditableDetailsItem,
});
