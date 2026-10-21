'use client';

import { useId, useMemo, useState, type ComponentPropsWithRef, type ComponentType, type ReactNode } from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import { focusRingInset } from '../../styling/focus-ring';
import { FORCED_COLORS } from '../../styling/media';
import type { SxProps } from '../../styling/sx';
import { PresentationSlot, type PresentationProps } from '../../utils/presentation-slot';
import { SearchField } from '../search-field';

/** A linkable reference to another component in the same catalog. */
export interface ApiTypeRef {
  name: string;
  /** Optional docs URL. Rendered as a link when present. */
  href?: string;
}

/** One parameter of an `ApiSignatureDoc`. */
export interface ApiParameterDoc {
  name: string;
  type: string;
  description?: string;
  /** Fields of an object parameter type, e.g. `details: MoneyInputDetails`. */
  members?: readonly ApiPropDoc[];
}

/** A callable type shown under its prop (event handlers, render props). */
export interface ApiSignatureDoc {
  /** Full signature, e.g. `(value: string) => void`. */
  type: string;
  parameters: readonly ApiParameterDoc[];
}

export interface ApiTagDoc {
  /** `deprecated`, `since` and `example` are presented specially. */
  name: string;
  text: string;
}

/**
 * One documented prop. Shaped after the object react-docgen-typescript produces for the docs site,
 * so `@jfrader/storybook-docs` can pass its `ComponentPropsDoc` straight in without a mapping layer.
 */
export interface ApiPropDoc {
  name: string;
  /** Type as TypeScript prints it, e.g. `'sm' | 'md' | 'lg'` or `ReactNode`. */
  type: string;
  typeUnavailable?: boolean;
  required?: boolean;
  /** Printed initializer, e.g. `'md'` or `false`. */
  defaultValue?: string | null;
  description?: string;
  /** Interface or package the prop is inherited from. */
  inheritedFrom?: string;
  inheritedComponent?: ApiTypeRef;
  /** Component rendered by default for a slot. */
  component?: ApiTypeRef;
  /** Native element the prop ultimately renders. */
  defaultElement?: string;
  /** `data-ui` token of the part this prop configures. */
  part?: string;
  /** Shorthand/composed mode this prop belongs to when the other mode excludes it. */
  mode?: 'shorthand' | 'composed';
  tags?: readonly ApiTagDoc[];
  /** Expanded object type: members of `slots`, `slotProps`, `messages` and friends. */
  members?: readonly ApiPropDoc[];
  /** Expanded callable type. */
  signatures?: readonly ApiSignatureDoc[];
  /** Array element type and its fields, e.g. what each `options` entry accepts. */
  element?: ApiElementDoc;
}

export interface ApiElementDoc {
  type: string;
  members: readonly ApiPropDoc[];
}

export interface ApiTypeParameterDoc {
  name: string;
  constraint?: string;
  default?: string;
  description?: string;
}

export interface ApiComponentDoc {
  name: string;
  description?: string;
  props: readonly ApiPropDoc[];
  /** Generic parameters declared by the component, e.g. `V extends string = string`. */
  typeParameters?: readonly ApiTypeParameterDoc[];
  /** Native element whose props also apply, e.g. `button`. */
  native?: string;
}

/** One replaceable part, collected from a component's `slots` and `slotProps` maps. */
export interface ApiSlotDoc {
  name: string;
  description?: string;
  /** `data-ui` token the default renders with. */
  part?: string;
  /** Component that renders the slot by default. */
  component?: ApiTypeRef;
  /** Native element that renders the slot by default. */
  defaultElement?: string;
  /** Props the replacement element accepts. */
  type?: string;
  /** Fields of the accepted props type, when the docs engine can expand it. */
  members?: readonly ApiPropDoc[];
}

export type ApiTableDensity = 'comfortable' | 'compact';

export interface ApiTableSlots {
  /** Replaces the outer section; forwards its props, ref and className. */
  root?: ComponentType<PresentationProps<'section'>>;
}

export interface ApiTableSlotProps {
  /** Props for the outer section. */
  root?: PresentationProps<'section'>;
}

export interface ApiTableProps
  extends Omit<ComponentPropsWithRef<'section'>, 'children'>,
    SxProps {
  /** Component or part tables, in reading order. */
  components: readonly ApiComponentDoc[];
  /** Show the filter field. Default: `true`. */
  searchable?: boolean;
  /** Row spacing. Default: `comfortable`. */
  density?: ApiTableDensity;
  /** Heading level for each component name. Default: `3`. */
  headingLevel?: 2 | 3 | 4;
  /** Show the derived Slots section. Default: `true`. */
  showSlots?: boolean;
  /** Shown when no prop matches the filter. */
  emptyMessage?: ReactNode;
  /** Replace the outer section. Sugar for `slots.root`. */
  component?: ApiTableSlots['root'];
  slots?: ApiTableSlots;
  slotProps?: ApiTableSlotProps;
}

const rootStyle = css({
  minInlineSize: 0,
  // The docs chrome styles every <code> as a chip; type and prop names are already code, so a
  // nested chip adds noise. Keep the code background only for literal-value spans.
  '& code[class]': {
    backgroundColor: 'transparent',
    paddingInline: 0,
    paddingBlock: 0,
    borderRadius: 0,
    fontFamily: 'inherit',
    fontSize: 'inherit',
    lineHeight: 'inherit',
  },
  border: `1px solid ${vars.color.borderSubtle}`,
  borderRadius: vars.radius.lg,
  backgroundColor: vars.color.surface,
  color: vars.color.text,
  fontFamily: vars.font.sans,
  overflow: 'hidden',
  [FORCED_COLORS]: { borderColor: 'CanvasText' },
});

const toolbarStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: vars.space[3],
  paddingBlock: vars.space[3],
  paddingInline: vars.space[4],
  backgroundColor: vars.color.surfaceRaised,
  borderBlockEnd: `1px solid ${vars.color.borderSubtle}`,
});

const searchStyle = css({ flex: '1 1 240px', minInlineSize: 0 });
const summaryStyle = css({ flex: '0 0 auto', fontSize: vars.textSize.xs, color: vars.color.textMuted, fontVariantNumeric: 'tabular-nums' });

const partStyle = css({
  paddingInline: vars.space[4],
  paddingBlock: vars.space[2],
  '& + &': { borderBlockStart: `1px solid ${vars.color.borderSubtle}` },
  [FORCED_COLORS]: { borderColor: 'CanvasText' },
});
const tailStyle = css({ paddingBlockEnd: vars.space[3] });

const partHeaderStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'baseline',
  gap: vars.space[2],
  marginBlockStart: vars.space[3],
  marginBlockEnd: 0,
});
const partNameStyle = css({
  margin: 0,
  fontFamily: vars.font.mono,
  fontSize: vars.textSize.md,
  fontWeight: vars.fontWeight.semibold,
  lineHeight: vars.lineHeight.tight,
  overflowWrap: 'anywhere',
});
const partCountStyle = css({
  fontSize: vars.textSize.xs,
  color: vars.color.textMuted,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
});
const descriptionStyle = css({
  marginBlock: `${vars.space[2]} 0`,
  marginInline: 0,
  maxInlineSize: '72ch',
  color: vars.color.textMuted,
  fontSize: vars.textSize.sm,
  lineHeight: vars.lineHeight.relaxed,
});
const nativeStyle = css({ marginBlock: `${vars.space[2]} 0`, marginInline: 0, color: vars.color.textMuted, fontSize: vars.textSize.sm });
const signatureLineStyle = css({ marginBlock: `${vars.space[1]} 0 0`, marginInline: 0, fontFamily: vars.font.mono, fontSize: vars.textSize.sm, lineHeight: vars.lineHeight.base, overflowWrap: 'anywhere' });

const rowsStyle = css({ margin: 0, marginBlockStart: vars.space[2], borderBlockStart: `1px solid ${vars.color.borderSubtle}` });

const rowBaseStyle = css({
  display: 'grid',
  gridTemplateColumns: 'minmax(150px, 0.85fr) minmax(0, 2.15fr)',
  columnGap: vars.space[4],
  rowGap: vars.space[1],
  paddingInline: vars.space[4],
  borderBlockEnd: `1px solid ${vars.color.borderSubtle}`,
  '&:last-child': { borderBlockEnd: 0 },
  '&:hover': { backgroundColor: vars.color.surfaceHover },
  '&:focus-within': { backgroundColor: vars.color.surfaceHover },
  '@media (max-width: 640px)': { gridTemplateColumns: '1fr', rowGap: vars.space[1] },
  [FORCED_COLORS]: { borderColor: 'CanvasText' },
});
const rowComfortableStyle = css({ paddingBlock: vars.space[3] });
const rowCompactStyle = css({ paddingBlock: vars.space[2] });
const rowInheritedStyle = css({ backgroundColor: vars.color.surfaceInset });

const nameCellStyle = css({ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: vars.space[1], minInlineSize: 0 });
const nameStyle = css({ fontFamily: vars.font.mono, fontSize: vars.textSize.sm, fontWeight: vars.fontWeight.semibold, lineHeight: vars.lineHeight.base });
const nameLinkStyle = css({ color: 'inherit', textUnderlineOffset: '0.2em' });
const badgeStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  boxSizing: 'border-box',
  paddingInline: vars.space[1],
  borderRadius: vars.radius.sm,
  fontSize: '0.6875rem',
  fontWeight: vars.fontWeight.medium,
  lineHeight: 1.6,
  whiteSpace: 'nowrap',
});
const requiredStyle = css({ color: vars.color.accentText, border: `1px solid ${vars.color.accentBorder}` });
const inlineCodeStyle = css({
  paddingInline: '0.28em',
  borderRadius: vars.radius.sm,
  backgroundColor: vars.color.surfaceInset,
  color: vars.color.text,
  fontFamily: vars.font.mono,
  fontSize: '0.94em',
});
const deprecatedStyle = css({ color: vars.color.dangerText, backgroundColor: vars.color.dangerSoft });
const partBadgeStyle = css({ color: vars.color.accentText, backgroundColor: vars.color.accentSoft });
const modeBadgeStyle = css({ color: vars.color.textMuted, backgroundColor: vars.color.surfaceHover, border: `1px solid ${vars.color.borderSubtle}` });
const unavailableStyle = css({ color: vars.color.warning, backgroundColor: vars.color.warningSoft });

const typeCellStyle = css({
  minInlineSize: 0,
  '@media (min-width: 700px)': { borderInlineStart: `1px solid ${vars.color.borderSubtle}`, paddingInlineStart: vars.space[4] },
});
const typeStyle = css({ display: 'block', fontFamily: vars.font.mono, fontSize: vars.textSize.sm, lineHeight: 1.7, overflowWrap: 'anywhere', whiteSpace: 'normal' });
const complexTypeStyle = css({
  paddingBlock: vars.space[1],
  paddingInline: vars.space[2],
  borderRadius: vars.radius.sm,
  backgroundColor: vars.color.surfaceInset,
  border: `1px solid ${vars.color.borderSubtle}`,
});
const typeKeywordStyle = css({ color: vars.color.syntaxKeyword });
const typeTypeStyle = css({ color: vars.color.syntaxType });
const typePunctuationStyle = css({ color: vars.color.syntaxPunctuation });
const typeOperatorStyle = css({ color: vars.color.textMuted, paddingInline: '0.15em' });
const typeStringStyle = css({
  color: vars.color.syntaxString,
  backgroundColor: `color-mix(in srgb, ${vars.color.syntaxString} 14%, transparent)`,
  borderRadius: vars.radius.sm,
  paddingInline: '0.25em',
});
const typeNumberStyle = css({
  color: vars.color.syntaxConstant,
  backgroundColor: `color-mix(in srgb, ${vars.color.syntaxConstant} 14%, transparent)`,
  borderRadius: vars.radius.sm,
  paddingInline: '0.25em',
});

const defaultStyle = css({
  display: 'inline-flex',
  alignItems: 'baseline',
  gap: '0.3em',
  paddingInline: vars.space[1],
  borderRadius: vars.radius.sm,
  backgroundColor: vars.color.surfaceHover,
  color: vars.color.textMuted,
  fontFamily: vars.font.mono,
  fontSize: vars.textSize.xs,
});
const defaultLabelStyle = css({ color: vars.color.textMuted });
const metaStyle = css({ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: vars.space[1], color: vars.color.textMuted, fontSize: vars.textSize.xs });
const metaLinkStyle = css({ color: vars.color.accentText, textDecoration: 'underline', textUnderlineOffset: '0.15em', '&:focus-visible': focusRingInset });
const metaSeparatorStyle = css({ color: vars.color.borderStrong, paddingInline: '0.15em' });

const detailsButtonStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.3em',
  marginBlockStart: vars.space[1],
  padding: 0,
  border: 0,
  background: 'none',
  color: vars.color.accentText,
  font: 'inherit',
  fontSize: vars.textSize.xs,
  cursor: 'pointer',
  textDecoration: 'underline',
  textUnderlineOffset: '0.15em',
  '&:focus-visible': focusRingInset,
});
const detailsStyle = css({
  gridColumn: '1 / -1',
  marginBlockStart: vars.space[2],
  paddingBlock: vars.space[2],
  paddingInline: vars.space[3],
  borderInlineStart: `2px solid ${vars.color.borderStrong}`,
  backgroundColor: vars.color.surfaceInset,
  borderRadius: `0 ${vars.radius.sm} ${vars.radius.sm} 0`,
  '@media (max-width: 640px)': { gridColumn: '1' },
});
const memberListStyle = css({ display: 'grid', gap: vars.space[1], margin: 0 });
const memberRowStyle = css({
  display: 'grid',
  gridTemplateColumns: 'minmax(110px, 0.6fr) minmax(0, 1.4fr)',
  columnGap: vars.space[3],
  rowGap: '0.15em',
  '@media (max-width: 640px)': { gridTemplateColumns: '1fr' },
});
const memberNameStyle = css({ display: 'inline-flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '0.35em', fontFamily: vars.font.mono, fontSize: vars.textSize.xs, color: vars.color.text });
const memberNoteStyle = css({ color: vars.color.textMuted, fontSize: vars.textSize.xs, display: 'block' });
const signatureStyle = css({ display: 'grid', gap: vars.space[2] });
const signatureTypeStyle = css({
  display: 'block',
  fontFamily: vars.font.mono,
  fontSize: vars.textSize.xs,
  color: vars.color.text,
  whiteSpace: 'pre-wrap',
  overflowWrap: 'anywhere',
});
const parameterRowStyle = css({ display: 'grid', gridTemplateColumns: 'minmax(90px, 0.4fr) minmax(0, 1.6fr)', columnGap: vars.space[3], rowGap: '0.1em' });
const tagListStyle = css({ display: 'grid', gap: vars.space[1], marginBlockStart: vars.space[1] });
const tagStyle = css({ color: vars.color.textMuted, fontSize: vars.textSize.xs, lineHeight: vars.lineHeight.relaxed });
const exampleStyle = css({
  margin: 0,
  padding: vars.space[2],
  backgroundColor: vars.color.surfaceRaised,
  borderRadius: vars.radius.sm,
  fontFamily: vars.font.mono,
  fontSize: vars.textSize.xs,
  whiteSpace: 'pre-wrap',
  overflowWrap: 'anywhere',
});
const inheritedToggleStyle = css({
  alignSelf: 'start',
  marginBlockStart: vars.space[2],
  paddingBlock: vars.space[1],
  paddingInline: vars.space[2],
  border: `1px solid ${vars.color.borderSubtle}`,
  borderRadius: vars.radius.full,
  backgroundColor: vars.color.surfaceRaised,
  color: vars.color.textMuted,
  font: 'inherit',
  fontSize: vars.textSize.xs,
  cursor: 'pointer',
  '&:hover': { backgroundColor: vars.color.surfaceHover },
  '&:focus-visible': focusRingInset,
});
const emptyStyle = css({ margin: 0, paddingInline: vars.space[4], paddingBlock: vars.space[6], color: vars.color.textMuted, fontSize: vars.textSize.sm });
const statusStyle = css({
  position: 'absolute',
  inlineSize: 1,
  blockSize: 1,
  margin: -1,
  padding: 0,
  overflow: 'hidden',
  clipPath: 'inset(50%)',
  whiteSpace: 'nowrap',
  border: 0,
});

const elementLabelStyle = css({ marginBlock: `0 ${vars.space[1]}`, marginInline: 0, color: vars.color.textMuted, fontSize: vars.textSize.xs });
const slotsSectionStyle = css({ paddingInline: vars.space[4], paddingBlock: vars.space[2], borderBlockStart: `1px solid ${vars.color.borderSubtle}` });
const slotGridStyle = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
  gap: vars.space[2],
  margin: 0,
  marginBlockStart: vars.space[2],
});
const slotCardStyle = css({
  minInlineSize: 0,
  padding: vars.space[3],
  border: `1px solid ${vars.color.borderSubtle}`,
  borderRadius: vars.radius.md,
  backgroundColor: vars.color.surfaceRaised,
  '&:hover': { backgroundColor: vars.color.surfaceHover },
  [FORCED_COLORS]: { borderColor: 'CanvasText' },
});
const slotCompactStyle = css({ padding: vars.space[2] });
const slotNameStyle = css({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: vars.space[1], fontFamily: vars.font.mono, fontSize: vars.textSize.sm, fontWeight: vars.fontWeight.semibold });
const slotPartStyle = css({
  paddingInline: vars.space[1],
  borderRadius: vars.radius.sm,
  backgroundColor: vars.color.accentSoft,
  color: vars.color.accentText,
  fontFamily: vars.font.mono,
  fontSize: '0.625rem',
  fontWeight: vars.fontWeight.regular,
});
const slotMetaStyle = css({ marginBlockStart: vars.space[1], color: vars.color.textMuted, fontSize: vars.textSize.xs });
const slotDescriptionStyle = css({ marginBlock: `${vars.space[1]} 0`, marginInline: 0, color: vars.color.textMuted, fontSize: vars.textSize.xs, lineHeight: vars.lineHeight.relaxed });
const slotTypeStyle = css({ marginBlockStart: vars.space[1], minInlineSize: 0 });
const slotTypeDetailsStyle = css({ marginBlockStart: vars.space[1] });
const slotTypeSummaryStyle = css({ color: vars.color.textMuted, fontSize: vars.textSize.xs, cursor: 'pointer', '&:focus-visible': focusRingInset });

type TypeTokenKind = 'literal' | 'keyword' | 'type' | 'punctuation' | 'operator';

const NATIVE_INHERITED = /(?:HTMLAttributes|DOMAttributes|AriaAttributes|ClassAttributes|RefAttributes|CSSProperties|DetailedHTMLProps|SVGAttributes|HTMLProps|ComponentProps|EventHandler|EventTarget|ElementType|LonghandProperties|ShorthandProperties|ObsoleteProperties|SvgProperties)/;

/** Native DOM/React contracts are covered by the "Also accepts native <el>" note, not by rows. */
function isNativeInherited(prop: ApiPropDoc): boolean {
  if (prop.name === 'className' || prop.name === 'sx') return false;
  if (prop.name === 'style') return true;
  return Boolean(prop.inheritedFrom) && !prop.inheritedComponent && NATIVE_INHERITED.test(prop.inheritedFrom ?? '');
}

const TYPE_KEYWORDS = new Set([
  'any',
  'bigint',
  'boolean',
  'false',
  'infer',
  'keyof',
  'never',
  'null',
  'number',
  'object',
  'readonly',
  'string',
  'symbol',
  'this',
  'true',
  'typeof',
  'undefined',
  'unknown',
  'void',
]);

const TYPE_TOKEN = /\s+|('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")|\b\d+(?:\.\d+)?\b|=>|[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*|\S/g;

function typeTokenKind(token: string): TypeTokenKind | null {
  if (token.startsWith("'") || token.startsWith('"')) return 'literal';
  if (token === '=>' || token === '|' || token === '&') return 'operator';
  if (/^\d/.test(token)) return 'literal';
  if (/^[A-Za-z_$]/.test(token)) {
    if (TYPE_KEYWORDS.has(token)) return 'keyword';
    if (/^[A-Z]/.test(token) || /[A-Z]/.test(token.slice(0, token.indexOf('.') === -1 ? token.length : token.indexOf('.')))) return 'type';
    return null;
  }
  return 'punctuation';
}

const tokenStyles: Record<TypeTokenKind, ReturnType<typeof css>> = {
  literal: typeStringStyle,
  keyword: typeKeywordStyle,
  type: typeTypeStyle,
  punctuation: typePunctuationStyle,
  operator: typeOperatorStyle,
};

/** Print a TypeScript type as tokenized code, so unions and generics stay scannable. */
function InlineText({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`)/g);
  return (
    <>
      {parts.map((part, index) =>
        part.length > 1 && part.startsWith('`') && part.endsWith('`') ? (
          <code key={index} css={inlineCodeStyle}>{part.slice(1, -1)}</code>
        ) : (
          part
        ),
      )}
    </>
  );
}

function TypeText({ type }: { type: string }) {
  const tokens = useMemo(() => [...type.matchAll(TYPE_TOKEN)].map((match) => match[0]), [type]);
  return (
    <code css={typeStyle} data-ui="api-table-type">
      {tokens.map((token, index) => {
        if (/^\s+$/.test(token)) return token;
        const kind = typeTokenKind(token);
        if (kind === null) return token;
        const style = kind === 'literal' && /^\d/.test(token) ? typeNumberStyle : tokenStyles[kind];
        return (
          <span key={index} css={style} data-kind={kind}>
            {token}
          </span>
        );
      })}
    </code>
  );
}

function countLabel(count: number): string {
  return `${count} ${count === 1 ? 'prop' : 'props'}`;
}

function inheritedLabel(count: number): string {
  return count === 1 ? '1 inherited prop' : `${count} inherited props`;
}

function matchesTerm(prop: ApiPropDoc, term: string, depth = 0): boolean {
  if (!term) return true;
  const own = [prop.name, prop.type, prop.description, prop.inheritedFrom, prop.defaultValue, prop.part, prop.component?.name]
    .some((value) => value?.toLowerCase().includes(term));
  if (own) return true;
  if (depth >= 2) return false;
  return Boolean(
    prop.members?.some((member) => matchesTerm(member, term, depth + 1))
      || prop.element?.members.some((member) => matchesTerm(member, term, depth + 1))
      || prop.signatures?.some((signature) => signature.type.toLowerCase().includes(term)
        || signature.parameters.some((parameter) => parameter.name.toLowerCase().includes(term)
          || parameter.type.toLowerCase().includes(term)
          || parameter.description?.toLowerCase().includes(term)
          || parameter.members?.some((member) => matchesTerm(member, term, depth + 1)))),
  );
}

function MemberRows({ members, depth = 0 }: { members: readonly ApiPropDoc[]; depth?: number }) {
  return (
    <dl css={memberListStyle}>
      {members.map((member) => (
        <div
          key={member.name}
          css={memberRowStyle}
          style={depth ? { paddingInlineStart: `calc(${vars.space[3]} * ${depth})` } : undefined}
        >
          <dt css={memberNameStyle}>
            {member.name}
            {member.required ? <span css={badgeStyle}>required</span> : null}
          </dt>
          <dd style={{ margin: 0, minInlineSize: 0 }}>
            <TypeText type={member.type} />
            {member.defaultValue ? (
              <span css={defaultStyle}>
                <span css={defaultLabelStyle}>=</span>
                {member.defaultValue}
              </span>
            ) : null}
            {member.component ? (
              <span css={defaultStyle}>
                Default:{' '}
                {member.component.href ? (
                  <a css={metaLinkStyle} href={member.component.href}>{member.component.name}</a>
                ) : (
                  member.component.name
                )}
              </span>
            ) : null}
            {member.defaultElement ? (
              <span css={defaultStyle}>
                Renders <code>{`<${member.defaultElement}>`}</code>
              </span>
            ) : null}
            {member.description ? <span css={memberNoteStyle}><InlineText text={member.description} /></span> : null}
            {member.members?.length ? <MemberRows members={member.members} depth={depth + 1} /> : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Signatures({ signatures, propType }: { signatures: readonly ApiSignatureDoc[]; propType?: string }) {
  return (
    <div css={signatureStyle}>
      {signatures.map((signature) => (
        <div key={signature.type}>
          <code css={signatureTypeStyle}>
            <TypeText type={signature.type} />
          </code>
          {signature.parameters.length > 0 ? (
            <dl css={memberListStyle} style={{ marginBlockStart: vars.space[1] }}>
              {signature.parameters.map((parameter) => (
                <div key={parameter.name} css={parameterRowStyle}>
                  <dt css={memberNameStyle}>{parameter.name}</dt>
                  <dd style={{ margin: 0, minInlineSize: 0 }}>
                    <TypeText type={parameter.type} />
                    {parameter.description ? <span css={memberNoteStyle}><InlineText text={parameter.description} /></span> : null}
                    {parameter.members?.length ? <MemberRows members={parameter.members} /> : null}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
      ))}
    </div>
  );
}

const SLOT_WRAPPER = /^(?:Partial|Readonly|Required|ComponentType|ElementType)<(.+)>$/;

/** Turn `Partial<Omit<SelectItemProps, 'id'>>` into the name a reader needs: `SelectItemProps`. */
function slotTypeLabel(type: string): string {
  let current = type.trim();
  for (let depth = 0; depth < 3; depth += 1) {
    const match = current.match(SLOT_WRAPPER);
    if (!match?.[1]) break;
    current = match[1];
  }
  if (/(?:HTMLAttributes|ClassAttributes|DetailedHTMLProps|ComponentPropsWithRef)/.test(current)) return 'HTML attributes';
  const omitted = current.match(/^Omit<([^,>]+)/);
  return omitted?.[1] ?? current;
}

function collectSlots(components: readonly ApiComponentDoc[]): ApiSlotDoc[] {
  const slots = new Map<string, ApiSlotDoc>();
  // Only keys in `slots` are replaceable; `slotProps` alone is styling-only.
  for (const component of components) {
    for (const member of component.props.find((prop) => prop.name === 'slots')?.members ?? []) {
      slots.set(member.name, { name: member.name, description: member.description, part: member.part, component: member.component, defaultElement: member.defaultElement, type: member.type, members: member.members });
    }
  }
  for (const component of components) {
    for (const member of component.props.find((prop) => prop.name === 'slotProps')?.members ?? []) {
      const slot = slots.get(member.name);
      if (!slot) continue;
      slot.description ||= member.description;
      slot.part ??= member.part;
      slot.component ??= member.component;
      slot.defaultElement ??= member.defaultElement;
      slot.type = member.type;
      slot.members = member.members ?? slot.members;
    }
  }
  return [...slots.values()].sort((a, b) => Number(b.name === 'root') - Number(a.name === 'root') || a.name.localeCompare(b.name));
}

function ApiSlots({
  slots,
  density,
  headingLevel,
}: {
  slots: readonly ApiSlotDoc[];
  density: ApiTableDensity;
  headingLevel: 2 | 3 | 4;
}) {
  const Heading = `h${headingLevel}` as 'h2' | 'h3' | 'h4';
  return (
    <section css={slotsSectionStyle}>
      <div css={partHeaderStyle}>
        <Heading css={partNameStyle}>Slots</Heading>
        <span css={partCountStyle}>{slots.length} replaceable</span>
      </div>
      <p css={descriptionStyle}>
        Replace a slot with <code>slots.&lt;name&gt;</code>; pass its props with <code>slotProps.&lt;name&gt;</code>.
      </p>
      <dl css={slotGridStyle}>
        {slots.map((slot) => (
          <div key={slot.name} css={[slotCardStyle, density === 'compact' ? slotCompactStyle : undefined]}>
            <dt css={slotNameStyle}>
              <code>{slot.name}</code>
              {slot.part ? <span css={slotPartStyle}>{`data-ui="${slot.part}"`}</span> : null}
            </dt>
            <dd style={{ margin: 0, minInlineSize: 0 }}>
              {slot.component || slot.defaultElement ? (
                <span css={slotMetaStyle}>
                  Default:{' '}
                  {slot.component ? (
                    slot.component.href ? (
                      <a css={metaLinkStyle} href={slot.component.href}>
                        {slot.component.name}
                      </a>
                    ) : (
                      slot.component.name
                    )
                  ) : (
                    <code>{`<${slot.defaultElement}>`}</code>
                  )}
                </span>
              ) : null}
              {slot.description ? <p css={slotDescriptionStyle}><InlineText text={slot.description} /></p> : null}
              {slot.type ? (
                <details css={slotTypeDetailsStyle}>
                  <summary css={slotTypeSummaryStyle}>
                    Props: <code>{slotTypeLabel(slot.type)}</code>
                  </summary>
                  <div css={slotTypeStyle}>
                    <TypeText type={slot.type} />
                  </div>
                  {slot.members?.length ? <MemberRows members={slot.members} /> : null}
                </details>
              ) : null}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function PropRow({ prop, density }: { prop: ApiPropDoc; density: ApiTableDensity }) {
  const [open, setOpen] = useState(false);
  const detailsId = useId();
  const deprecated = prop.tags?.find((tag) => tag.name === 'deprecated');
  const since = prop.tags?.find((tag) => tag.name === 'since');
  const example = prop.tags?.find((tag) => tag.name === 'example');
  const expandable = Boolean(prop.members?.length || prop.element?.members.length || prop.signatures?.length || example || deprecated);
  const detailsLabel = prop.members?.length
    ? `${prop.members.length} ${prop.members.length === 1 ? 'member' : 'members'}`
    : prop.element?.members.length
      ? `${prop.element.members.length} element ${prop.element.members.length === 1 ? 'field' : 'fields'}`
      : prop.signatures?.length
      ? prop.signatures.length === 1
        ? 'Signature'
        : 'Signatures'
      : 'Details';

  return (
    <div
      css={[rowBaseStyle, density === 'compact' ? rowCompactStyle : rowComfortableStyle, prop.inheritedFrom ? rowInheritedStyle : undefined]}
      data-prop={prop.name}
      data-inherited={prop.inheritedFrom ? '' : undefined}
    >
      <dt css={nameCellStyle}>
        <code css={nameStyle}>{prop.name}</code>
        {prop.required ? <span css={[badgeStyle, requiredStyle]}>required</span> : null}
        {prop.part ? <span css={[badgeStyle, partBadgeStyle]}>{prop.part}</span> : null}
        {prop.mode ? <span css={[badgeStyle, modeBadgeStyle]}>{prop.mode} only</span> : null}
        {deprecated ? <span css={[badgeStyle, deprecatedStyle]}>deprecated</span> : null}
      </dt>

      <dd css={typeCellStyle} style={{ margin: 0 }}>
        {prop.typeUnavailable ? (
          <span css={[badgeStyle, unavailableStyle]}>type unavailable</span>
        ) : (
          <div css={prop.members?.length || prop.element?.members.length || prop.signatures?.length ? complexTypeStyle : undefined}>
            <TypeText type={prop.type} />
          </div>
        )}

        {prop.description ? <p css={descriptionStyle}><InlineText text={prop.description} /></p> : null}

        <div css={metaStyle}>
          {prop.defaultValue !== null && prop.defaultValue !== undefined ? (
            <span css={defaultStyle} data-default="">
              <span css={defaultLabelStyle}>=</span>
              <code>{prop.defaultValue}</code>
            </span>
          ) : null}
          {prop.defaultValue && (prop.component || prop.defaultElement || prop.inheritedFrom || since) ? (
            <span css={metaSeparatorStyle} aria-hidden="true">
              ·
            </span>
          ) : null}
          {prop.component ? (
            <span>
              Default: {prop.component.href ? <a css={metaLinkStyle} href={prop.component.href}>{prop.component.name}</a> : prop.component.name}
            </span>
          ) : null}
          {prop.defaultElement ? <span>Renders &lt;{prop.defaultElement}&gt;</span> : null}
          {prop.inheritedFrom ? (
            <span>
              Inherited from{' '}
              {prop.inheritedComponent?.href ? (
                <a css={metaLinkStyle} href={prop.inheritedComponent.href}>
                  {prop.inheritedFrom}
                </a>
              ) : (
                prop.inheritedFrom
              )}
            </span>
          ) : null}
          {since ? <span>Since {since.text}</span> : null}
        </div>

        {expandable ? (
          <button
            type="button"
            css={detailsButtonStyle}
            aria-expanded={open}
            aria-controls={detailsId}
            onClick={() => setOpen((value) => !value)}
          >
            <span aria-hidden="true">{open ? '▾' : '▸'}</span>
            {detailsLabel}
          </button>
        ) : null}
      </dd>

      {expandable ? (
        <div css={detailsStyle} id={detailsId} hidden={!open}>
          {prop.element?.members.length ? (
            <>
              <p css={elementLabelStyle}>
                Each entry: <TypeText type={prop.element.type} />
              </p>
              <MemberRows members={prop.element.members} />
            </>
          ) : null}
          {prop.members?.length ? <MemberRows members={prop.members} /> : null}
          {prop.signatures?.length ? <Signatures signatures={prop.signatures} propType={prop.type} /> : null}
          {deprecated ? <p css={tagStyle}>{deprecated.text}</p> : null}
          {example ? <pre css={exampleStyle}>{example.text}</pre> : null}
        </div>
      ) : null}
    </div>
  );
}

function ApiPart({
  component,
  density,
  headingLevel,
  term,
}: {
  component: ApiComponentDoc;
  density: ApiTableDensity;
  headingLevel: 2 | 3 | 4;
  term: string;
}) {
  const [showInherited, setShowInherited] = useState(false);
  const own = component.props.filter((prop) => !prop.inheritedFrom && !isNativeInherited(prop));
  const inherited = component.props.filter((prop) => prop.inheritedFrom && !isNativeInherited(prop));
  const ownMatches = own.filter((prop) => matchesTerm(prop, term));
  const inheritedMatches = inherited.filter((prop) => matchesTerm(prop, term));
  const inheritedVisible = term ? inheritedMatches : showInherited ? inherited : [];
  const Heading = `h${headingLevel}` as 'h2' | 'h3' | 'h4';

  if (term && ownMatches.length === 0 && inheritedMatches.length === 0) return null;

  return (
    <section css={[partStyle, tailStyle]}>
      <div css={partHeaderStyle}>
        <Heading css={partNameStyle}>{component.name}</Heading>
        <span css={partCountStyle}>{countLabel(term ? ownMatches.length : own.length)}</span>
      </div>
      {component.typeParameters?.length ? (
        <p css={signatureLineStyle}>
          <TypeText
            type={`${component.name}<${component.typeParameters
              .map((parameter) => `${parameter.name}${parameter.constraint ? ` extends ${parameter.constraint}` : ''}${parameter.default ? ` = ${parameter.default}` : ''}`)
              .join(', ')}>`}
          />
        </p>
      ) : null}
      {component.description ? <p css={descriptionStyle}><InlineText text={component.description} /></p> : null}
      {component.native ? (
        <p css={nativeStyle}>
          Also accepts native <code>{`<${component.native}>`}</code> props.
        </p>
      ) : null}

      {ownMatches.length > 0 ? (
        <dl css={rowsStyle}>
          {ownMatches.map((prop) => (
            <PropRow key={prop.name} prop={prop} density={density} />
          ))}
        </dl>
      ) : (
        <p css={descriptionStyle}>No component-specific props.</p>
      )}

      {inherited.length > 0 && !term ? (
        <button type="button" css={inheritedToggleStyle} aria-expanded={showInherited} onClick={() => setShowInherited((value) => !value)}>
          {showInherited ? 'Hide' : 'Show'} {inheritedLabel(inherited.length)}
        </button>
      ) : null}

      {inheritedVisible.length > 0 ? (
        <dl css={rowsStyle}>
          {inheritedVisible.map((prop) => (
            <PropRow key={prop.name} prop={prop} density={density} />
          ))}
        </dl>
      ) : null}
    </section>
  );
}

/**
 * Document a component's props and types: literal unions as chips, expanded members and
 * signatures, defaults, parts and inherited sources. Designed to drop into the API section of the
 * docs site with the data the docs build already extracts.
 */
export function ApiTable({
  components,
  searchable = true,
  showSlots = true,
  density = 'comfortable',
  headingLevel = 3,
  emptyMessage = 'No props match this filter.',
  component,
  slots,
  slotProps,
  ref,
  className,
  sx,
  ...rest
}: ApiTableProps) {
  const [query, setQuery] = useState('');
  const term = query.trim().toLowerCase();

  const visible = useMemo(
    () =>
      components
        .map((entry) => ({
          entry,
          own: entry.props.filter((prop) => !prop.inheritedFrom && !isNativeInherited(prop) && matchesTerm(prop, term)),
          inherited: entry.props.filter((prop) => Boolean(prop.inheritedFrom) && !isNativeInherited(prop) && matchesTerm(prop, term)),
        }))
        .filter(({ own, inherited }) => !term || own.length > 0 || inherited.length > 0),
    [components, term],
  );

  const total = visible.reduce((sum, { own, inherited }) => sum + (term ? own.length + inherited.length : own.length), 0);
  const slotDocs = useMemo(() => collectSlots(components), [components]);
  const status = term ? `${total} ${total === 1 ? 'prop matches' : 'props match'} “${query.trim()}”` : `${total} documented props`;

  return (
    <PresentationSlot
      element="section"
      marker="api-table"
      component={slots?.root ?? component}
      slotProps={slotProps?.root}
      styles={rootStyle}
      sx={sx}
      ref={ref}
      className={className}
      aria-label="API reference"
      {...rest}
    >
      <div css={toolbarStyle}>
        {searchable ? (
          <div css={searchStyle}>
            <SearchField
              size="sm"
              label="Filter props"
              labelPlacement="hidden"
              placeholder="Filter by prop, type, field or description"
              value={query}
              onValueChange={setQuery}
              clearable
            />
          </div>
        ) : null}
        <span css={summaryStyle} aria-hidden="true">
          {term ? `${total} of ${components.reduce((sum, entry) => sum + entry.props.filter((prop) => !prop.inheritedFrom && !isNativeInherited(prop)).length, 0)} props` : countLabel(total)}
        </span>
      </div>

      <p css={statusStyle} role="status" aria-live="polite">
        {status}
      </p>

      {visible.length === 0 ? (
        <p css={emptyStyle}>{emptyMessage}</p>
      ) : (
        visible.map(({ entry }) => (
          <ApiPart key={entry.name} component={entry} density={density} headingLevel={headingLevel} term={term} />
        ))
      )}

      {showSlots && !term && slotDocs.length > 0 ? (
        <ApiSlots slots={slotDocs} density={density} headingLevel={headingLevel} />
      ) : null}
    </PresentationSlot>
  );
}

ApiTable.displayName = 'ApiTable';
