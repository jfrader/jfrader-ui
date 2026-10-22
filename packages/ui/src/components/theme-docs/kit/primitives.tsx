import type { CSSProperties, ReactNode } from 'react';
import { parse } from 'culori';
import { vars } from '@jfrader/tokens/vars';
import { css, type SerializedStyles } from '../../../styling/css';
import { FORCED_COLORS } from '../../../styling/media';
import type { Contrast } from './model';

/**
 * Layout for the Theme reference pages. Every page (palette, type, spacing, motion) uses the same
 * row skeleton so the four pages read as one document: a specimen on the start edge, the token
 * identity next to it, and the authored values on the end edge.
 */

const panelStyle = css({
  boxSizing: 'border-box',
  maxInlineSize: '72rem',
  marginInline: 'auto',
  paddingBlock: vars.space[8],
  paddingInline: vars.space[6],
  backgroundColor: vars.color.bg,
  color: vars.color.text,
  fontFamily: vars.font.sans,
  fontSize: vars.textSize.md,
  lineHeight: vars.lineHeight.base,
  '@media (max-width: 640px)': {
    paddingBlock: vars.space[6],
    paddingInline: vars.space[4],
  },
});

const familyStyle = css({
  '& + &': {
    marginBlockStart: vars.space[8],
    paddingBlockStart: vars.space[8],
    borderBlockStart: `1px solid ${vars.color.border}`,
    [FORCED_COLORS]: { borderColor: 'CanvasText' },
  },
});

const familyHeaderStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'baseline',
  gap: vars.space[2],
  marginBlockEnd: vars.space[1],
});

const familyTitleStyle = css({
  margin: 0,
  fontSize: vars.textSize.lg,
  fontWeight: vars.fontWeight.semibold,
  lineHeight: vars.lineHeight.tight,
  letterSpacing: vars.editorial.tracking.standard,
});

const familyCountStyle = css({
  fontSize: vars.textSize.xs,
  color: vars.color.textMuted,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  fontVariantNumeric: 'tabular-nums',
});

const familyBlurbStyle = css({
  margin: 0,
  unicodeBidi: 'plaintext',
  marginBlockEnd: vars.space[4],
  maxInlineSize: '68ch',
  color: vars.color.textMuted,
  fontSize: vars.textSize.sm,
  lineHeight: vars.lineHeight.relaxed,
});

const listStyle = css({
  margin: 0,
  padding: 0,
  listStyle: 'none',
  borderBlockStart: `1px solid ${vars.color.borderSubtle}`,
  [FORCED_COLORS]: { borderColor: 'CanvasText' },
});

const rowStyle = css({
  display: 'grid',
  gridTemplateColumns: '44px minmax(0, 1fr) minmax(0, 19rem)',
  alignItems: 'start',
  columnGap: vars.space[4],
  rowGap: vars.space[2],
  paddingBlock: vars.space[3],
  paddingInline: vars.space[1],
  borderBlockEnd: `1px solid ${vars.color.borderSubtle}`,
  [FORCED_COLORS]: { borderColor: 'CanvasText' },
  '&:hover': { backgroundColor: vars.color.surfaceHover },
  '@media (max-width: 900px)': {
    gridTemplateColumns: '44px minmax(0, 1fr)',
  },
});

const previewStyle = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minBlockSize: '1.75rem',
});

const identityStyle = css({ minInlineSize: 0, display: 'grid', gap: '0.125rem' });

const nameStyle = css({
  margin: 0,
  // A token path is Latin: in an RTL page its leading `--` or brackets must not reorder.
  unicodeBidi: 'plaintext',
  fontFamily: vars.font.mono,
  fontSize: vars.textSize.sm,
  fontWeight: vars.fontWeight.semibold,
  lineHeight: vars.lineHeight.base,
  overflowWrap: 'anywhere',
});

const variableStyle = css({
  margin: 0,
  unicodeBidi: 'plaintext',
  fontFamily: vars.font.mono,
  fontSize: vars.textSize.xs,
  color: vars.color.textSubtle,
  lineHeight: vars.lineHeight.base,
  overflowWrap: 'anywhere',
});

const summaryStyle = css({
  margin: 0,
  unicodeBidi: 'plaintext',
  marginBlockStart: vars.space[1],
  maxInlineSize: '62ch',
  color: vars.color.textMuted,
  fontSize: vars.textSize.sm,
  lineHeight: vars.lineHeight.relaxed,
});

const valuesStyle = css({
  display: 'grid',
  gap: vars.space[1],
  margin: 0,
  minInlineSize: 0,
  '@media (max-width: 900px)': {
    gridColumn: '2',
  },
});

const valuePairStyle = css({
  display: 'grid',
  gridTemplateColumns: '3.25rem minmax(0, 1fr)',
  alignItems: 'baseline',
  columnGap: vars.space[2],
  minInlineSize: 0,
});

const valueLabelStyle = css({
  fontSize: '0.6875rem',
  color: vars.color.textMuted,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
});

const valueTextStyle = css({
  minInlineSize: 0,
  unicodeBidi: 'plaintext',
  fontFamily: vars.font.mono,
  fontSize: vars.textSize.xs,
  color: vars.color.text,
  overflowWrap: 'anywhere',
});

const badgeStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxSizing: 'border-box',
  marginInlineStart: vars.space[2],
  paddingInline: vars.space[1],
  borderRadius: vars.radius.sm,
  border: `1px solid ${vars.color.borderSubtle}`,
  fontSize: '0.6875rem',
  fontWeight: vars.fontWeight.medium,
  lineHeight: 1.7,
  whiteSpace: 'nowrap',
  fontVariantNumeric: 'tabular-nums',
  [FORCED_COLORS]: { borderColor: 'CanvasText' },
});

const passStyle = css({ color: vars.color.textMuted });
const cautionStyle = css({ color: vars.color.dangerText, borderColor: vars.color.dangerBorder, backgroundColor: vars.color.dangerSoft });

const swatchStyle = css({
  boxSizing: 'border-box',
  inlineSize: '2rem',
  blockSize: '2rem',
  borderRadius: vars.radius.sm,
  border: `1px solid ${vars.color.borderStrong}`,
  // Translucent roles need something to sit on, or the alpha is invisible.
  backgroundImage: `repeating-conic-gradient(${vars.color.colorPickerCheckerA} 0% 25%, ${vars.color.colorPickerCheckerB} 0% 50%)`,
  backgroundSize: '0.5rem 0.5rem',
  [FORCED_COLORS]: { borderColor: 'CanvasText' },
});

/** Only a translucent fill needs the checkerboard underneath it. */
const swatchOpaqueStyle = css({ backgroundImage: 'none' });

const swatchFillStyle = css({ display: 'block', inlineSize: '100%', blockSize: '100%', borderRadius: 'calc(0.375rem - 1px)' });

export interface TokenPanelProps {
  children: ReactNode;
}

/** The page body: full-bleed inside the docs frame, padded and on the page background. */
export function TokenPanel({ children }: TokenPanelProps) {
  return <div css={panelStyle}>{children}</div>;
}

export interface TokenFamilyProps {
  title: string;
  blurb?: string;
  count?: number;
  children: ReactNode;
}

/** One token family: heading, a one-line explanation and its rows. */
export function TokenFamily({ title, blurb, count, children }: TokenFamilyProps) {
  return (
    <section css={familyStyle}>
      <div css={familyHeaderStyle}>
        <h2 css={familyTitleStyle}>{title}</h2>
        {count === undefined ? null : <span css={familyCountStyle}>{count === 1 ? '1 token' : `${count} tokens`}</span>}
      </div>
      {blurb ? <p css={familyBlurbStyle}>{blurb}</p> : null}
      <ul role="list" css={listStyle}>{children}</ul>
    </section>
  );
}

export interface TokenValue {
  /** `Dark`, `Light`, `Value`, `Size`… */
  label: string;
  /** The authored CSS string. */
  value: string;
  /** Measured contrast for this palette, when the role is a foreground. */
  contrast?: Contrast | null;
}

export interface TokenRowProps {
  /** The specimen: a swatch, a bar, a radius box, a type sample. */
  preview: ReactNode;
  /** The typed reference, e.g. `theme.color.textMuted`. */
  name: string;
  /** The CSS custom property it resolves to. */
  variable?: string;
  description?: string;
  values?: readonly TokenValue[];
}

export function TokenRow({ preview, name, variable, description, values }: TokenRowProps) {
  return (
    <li css={rowStyle}>
      <span css={previewStyle}>{preview}</span>
      <div css={identityStyle}>
        <p css={nameStyle}>{name}</p>
        {variable ? <p css={variableStyle}>{variable}</p> : null}
        {description ? <p css={summaryStyle}>{description}</p> : null}
      </div>
      {values?.length ? (
        <dl css={valuesStyle}>
          {values.map((entry) => (
            <div key={entry.label} css={valuePairStyle}>
              <dt css={valueLabelStyle}>{entry.label}</dt>
              <dd css={valueTextStyle}>
                {entry.value}
                {entry.contrast ? <ContrastBadge contrast={entry.contrast} /> : null}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </li>
  );
}

/** A measured ratio next to its grade. The grade is text, so it never depends on color alone. */
export function ContrastBadge({ contrast }: { contrast: Contrast }) {
  const failed = contrast.grade === 'Fail';
  return (
    <span css={[badgeStyle, failed ? cautionStyle : passStyle]}>
      {`${contrast.ratio.toFixed(2)}:1 · ${contrast.grade}`}
    </span>
  );
}

export interface SwatchProps {
  /** The color role to paint, e.g. `accentSoft`. Painted through its custom property so the
   * swatch always shows the palette of the page it is on. */
  token: string;
  /** The authored value, used only to tell whether the fill is translucent. */
  value: string;
  label?: string;
}

export function Swatch({ token, value, label }: SwatchProps) {
  const translucent = (parse(value)?.alpha ?? 1) < 1;
  return (
    <span
      css={[swatchStyle, translucent ? undefined : swatchOpaqueStyle]}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <span css={swatchFillStyle} data-swatch="" style={{ backgroundColor: `var(${token})` }} />
    </span>
  );
}

const tokenStyles = new Map<string, SerializedStyles>();

/**
 * One class per property/value pair, built once. A specimen sizes itself from the token it
 * documents, so the value differs per row; caching keeps that out of the render path.
 */
export function tokenStyle(property: keyof CSSProperties, value: string): SerializedStyles {
  const key = `${property}:${value}`;
  let style = tokenStyles.get(key);
  if (!style) {
    style = css({ [property]: value });
    tokenStyles.set(key, style);
  }
  return style;
}

/** A horizontal bar whose width is the token value: the space scale and fixed sizes. */
export function ScaleBar({ value, max }: { value: string; max?: number }) {
  const style: CSSProperties = { inlineSize: value, maxInlineSize: max ? `${max}px` : '100%' };
  return <span css={barStyle} style={style} aria-hidden="true" />;
}

const barStyle = css({
  display: 'block',
  blockSize: '0.625rem',
  borderRadius: vars.radius.full,
  backgroundColor: vars.color.accent,
  minInlineSize: '2px',
  [FORCED_COLORS]: { backgroundColor: 'Highlight' },
});
