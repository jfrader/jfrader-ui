import { withoutSx } from '../../styling/sx';
'use client';

// Syntax highlighting is opt-in through `highlight`, a loader that returns tokenized lines. This
// module never imports a highlighter: `@jfrader/ui/code-block/shiki` provides a ready-made loader,
// and apps that pass none never load one. Until a loader settles, and whenever it rejects, throws
// or returns null, the source renders as plain text in the same box, so highlighting never shifts
// layout. Tokens are checked against the source line by line; a line whose tokens do not spell it
// renders plain.
import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type ComponentType,
  type Ref,
} from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type Theme } from '../../styling/css';
import { focusRingInset } from '../../styling/focus-ring';
import { FORCED_COLORS, REDUCED_MOTION } from '../../styling/media';
import type { SxProps } from '../../styling/sx';
import type { PresentationProps } from '../../utils/presentation-slot';
import { SurfaceRoot } from '../surface/surface-root';
import type { SurfaceAppearance } from '../../styling/surface';
import { numberFormatter } from '../../utils/intl';
import { useControlledState } from '../../utils/use-controlled-state';
import { Button } from '../button';
import { CopyButton, type CopyButtonProps } from '../copy-button';

/** Tab width for source text; kept as a named constant so it changes in one place. */
const TAB_SIZE = 2;

export interface CodeBlockSlotPartProps {
  className?: string;
  sx?: Interpolation<Theme>;
}

export interface CodeBlockSlotProps {
  /** Props for the outer section. */
  root?: Omit<PresentationProps<'section'>, 'children'>;
  /** Header bar holding the label, language tag, and copy button. */
  header?: CodeBlockSlotPartProps;
  /** Label element displaying the filename or snippet caption. */
  label?: CodeBlockSlotPartProps;
  /** Badge element displaying the programming language name. */
  language?: CodeBlockSlotPartProps;
  /** Frame container wrapping the line-number gutter and code block. */
  sourceFrame?: CodeBlockSlotPartProps;
  /** Gutter element displaying formatted line numbers. */
  gutter?: CodeBlockSlotPartProps;
  /** Preformatted container element wrapping the source code. */
  pre?: CodeBlockSlotPartProps;
  /** Code element containing highlighted tokens or raw text. */
  code?: CodeBlockSlotPartProps;
  /** Button element expanding or collapsing the code block. */
  toggle?: CodeBlockSlotPartProps;
}

export interface CodeHighlightToken {
  content: string;
  /** Any CSS color; token references (`vars.color.syntax*`) follow the theme. */
  color?: string;
  fontStyle?: 'normal' | 'italic';
}

/** One token list per source line, without line terminators. */
export type CodeHighlightLines = readonly (readonly CodeHighlightToken[])[];

export interface CodeHighlightRequest {
  code: string;
  language?: string;
}

/** Tokenizes `code`; `null` (e.g. an unsupported language) keeps plain text. */
export type CodeHighlightLoader = (
  request: CodeHighlightRequest,
) => CodeHighlightLines | null | PromiseLike<CodeHighlightLines | null>;

export interface CodeBlockProps extends Omit<ComponentPropsWithRef<'section'>, 'children' | 'onChange'>, SxProps {
  /** Use fixed charcoal with `contrast`; `default` inherits the parent appearance. */
  appearance?: SurfaceAppearance;
  /** Supplies the source text to display and copy. */
  code: string;
  /** Displays a filename in the header instead of `label`. */
  filename?: string;
  /** Displays the language badge and identifies the language for `highlight`. */
  language?: string;
  /** Displays the header caption when `filename` is absent. Defaults to "Source code". */
  label?: string;
  /** Names the selectable source region. Defaults to "Selectable source code". */
  sourceLabel?: string;
  /** Limits collapsed source lines, rounded down to at least one; nonpositive or nonfinite values disable collapsing. */
  maxLines?: number;
  /** Controls whether collapsible source is fully expanded. */
  open?: boolean;
  /** Expands collapsible source initially when uncontrolled. Defaults to false. */
  defaultOpen?: boolean;
  /** Requests expansion or collapse when the disclosure button is pressed. */
  onOpenChange?: (open: boolean) => void;
  /** Shows the line-number gutter. Defaults to false. */
  lineNumbers?: boolean;
  /** Formats line numbers and the expansion count; defaults to the runtime locale. */
  locale?: Intl.LocalesArgument;
  /** Builds the expand button text from the total line count and its formatted value; defaults to English. */
  getExpandLabel?: (count: number, formatted: string) => string;
  /** Labels the collapse button. Defaults to "Show fewer lines". */
  collapseLabel?: string;
  /** Shows the button that copies the full source. Defaults to true. */
  copyable?: boolean;
  /** Customizes the copy button without changing its source text. */
  copyButtonProps?: Partial<Omit<CopyButtonProps, 'text' | 'ref'>> & SxProps;
  /** Receives the preformatted source element. */
  preRef?: Ref<HTMLPreElement>;
  /** Syntax highlighting loader, read when `code` or `language` changes. */
  highlight?: CodeHighlightLoader;
  /** Passes props to the section and its presentation parts. */
  slotProps?: CodeBlockSlotProps;
  /** Replaces the section and its presentation parts. */
  slots?: CodeBlockSlots;
  /** Shorthand for slots.root; slots.root takes precedence. */
  component?: CodeBlockSlots['root'];
}

export interface CodeBlockSlots {
    /** Replaces the outer section; forwards its props, ref and className. */
    root?: ComponentType<ComponentPropsWithRef<'section'>>;
    /** Holds the gutter and source text. */
    sourceFrame?: ComponentType<CodeBlockSlotPartProps>;
    /** Holds the label, language and copy action. */
    header?: ComponentType<CodeBlockSlotPartProps>;
    /** Displays the filename or caption. */
    label?: ComponentType<CodeBlockSlotPartProps>;
    /** Displays the language name. */
    language?: ComponentType<CodeBlockSlotPartProps>;
    /** Displays line numbers. */
    gutter?: ComponentType<CodeBlockSlotPartProps>;
    /** Holds the preformatted source. */
    pre?: ComponentType<CodeBlockSlotPartProps>;
    /** Displays source tokens or text. */
    code?: ComponentType<CodeBlockSlotPartProps>;
    /** Expands or collapses the source. */
    toggle?: ComponentType<CodeBlockSlotPartProps>;
}

// Inner corners stay concentric with the outer surface.
const innerRadius = `calc(${vars.radius.lg} - ${vars.space[1]})`;

const rootStyle = css({
  label: 'code-block',
  boxSizing: 'border-box',
  display: 'flex',
  flexDirection: 'column',
  gap: vars.space[1],
  minInlineSize: 0,
  maxInlineSize: '100%',
  padding: vars.space[1],
  fontFamily: vars.font.sans,
  fontSize: vars.textSize.sm,
  lineHeight: vars.lineHeight.base,
});
const headerStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: vars.space[2],
  minBlockSize: vars.space[8],
  paddingInlineStart: vars.space[3],
});
const labelStyle = css({ minInlineSize: 0, fontWeight: vars.fontWeight.medium, overflowWrap: 'anywhere' });
const languageStyle = css({
  flexShrink: 0,
  maxInlineSize: '50%',
  paddingInline: vars.space[2],
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.full,
  color: vars.color.textMuted,
  fontFamily: vars.font.mono,
  fontSize: vars.textSize.xs,
  overflowWrap: 'anywhere',
});
const copyStyle = css({ marginInlineStart: 'auto' });
const frameStyle = css({
  position: 'relative',
  display: 'flex',
  direction: 'ltr',
  minInlineSize: 0,
  overflow: 'hidden',
  backgroundColor: vars.color.surfaceInset,
  border: `1px solid ${vars.color.borderSubtle}`,
  borderRadius: innerRadius,
  // Fades the last visible lines into the disclosure footer while collapsed.
  '&[data-state="collapsed"]::after': {
    content: '""',
    position: 'absolute',
    insetInline: 0,
    insetBlockEnd: 0,
    blockSize: vars.space[8],
    backgroundImage: `linear-gradient(to bottom, transparent, ${vars.color.surfaceInset})`,
    pointerEvents: 'none',
  },
  [FORCED_COLORS]: { borderColor: 'CanvasText', '&[data-state="collapsed"]::after': { display: 'none' } },
});
const sourceTypography = css({
  fontFamily: vars.font.mono,
  fontSize: vars.textSize.sm,
  lineHeight: vars.lineHeight.relaxed,
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'pre',
  tabSize: TAB_SIZE,
});
const gutterStyle = css({
  flexShrink: 0,
  paddingBlock: vars.space[3],
  paddingInline: vars.space[3],
  textAlign: 'end',
  color: vars.color.textSubtle,
  userSelect: 'none',
  borderInlineEnd: `1px solid ${vars.color.border}`,
});
const preStyle = css({
  flex: '1 1 auto',
  minInlineSize: 0,
  margin: 0,
  paddingBlock: vars.space[3],
  paddingInline: vars.space[4],
  overflow: 'auto',
  unicodeBidi: 'isolate',
  borderRadius: 'inherit',
  scrollbarWidth: 'thin',
  scrollbarColor: `${vars.color.borderStrong} transparent`,
  '[data-ui="code-block-gutter"] + &': { borderStartStartRadius: 0, borderEndStartRadius: 0 },
  '&:focus-visible': focusRingInset,
});
const codeStyle = css({ font: 'inherit' });
const toggleStyle = css({
  inlineSize: '100%',
  blockSize: 'auto',
  minBlockSize: vars.space[8],
  borderRadius: innerRadius,
  color: vars.color.textMuted,
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
  '& svg': {
    transitionProperty: 'transform',
    transitionDuration: vars.motion.duration.base,
    transitionTimingFunction: vars.motion.easeStandard,
  },
  '&[aria-expanded="true"] svg': { transform: 'rotate(180deg)' },
  [REDUCED_MOTION]: { '& svg': { transitionDuration: '0s' } },
});
const chevron = (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 6l4 4 4-4" />
  </svg>
);
const englishPluralRules = new Intl.PluralRules('en');
function defaultExpandLabel(count: number, formatted: string) {
  return `Show all ${formatted} ${englishPluralRules.select(count) === 'one' ? 'line' : 'lines'}`;
}

// Bundlers replace `process.env.NODE_ENV` in consumer builds; library mode leaves it in place.
declare const process: { env: { NODE_ENV?: string } };
function warnHighlightFailure(error: unknown) {
  if (process.env.NODE_ENV !== 'production') console.warn('CodeBlock: highlighting failed; showing plain text.', error);
}

interface HighlightState {
  loader: CodeHighlightLoader;
  code: string;
  language: string | undefined;
  lines: CodeHighlightLines;
}

function renderLine(line: string, tokens: readonly CodeHighlightToken[] | undefined) {
  const text = tokens?.map((token) => token.content).join('');
  if (tokens === undefined || text === undefined || !line.startsWith(text)) return line;
  return (
    <>
      {tokens.map((token, index) => (
        <span key={index} style={{ color: token.color, fontStyle: token.fontStyle }}>
          {token.content}
        </span>
      ))}
      {line.slice(text.length)}
    </>
  );
}

export function CodeBlock({
  appearance,
  ref,
  code,
  filename,
  language,
  label = 'Source code',
  sourceLabel = 'Selectable source code',
  maxLines,
  open,
  defaultOpen = false,
  onOpenChange,
  lineNumbers = false,
  locale,
  getExpandLabel = defaultExpandLabel,
  collapseLabel = 'Show fewer lines',
  copyable = true,
  copyButtonProps,
  preRef,
  highlight,
  slotProps,
  slots,
  component,
  className,
  sx,
  'aria-label': ariaLabel,
  'aria-labelledby': labelledBy,
  ...rest
}: CodeBlockProps) {
  const SourceFrame = slots?.sourceFrame ?? 'div';
  const Header = slots?.header ?? 'header';
  const Label = slots?.label ?? 'span';
  const Language = slots?.language ?? 'span';
  const Gutter = slots?.gutter ?? 'div';
  const Pre = slots?.pre ?? 'pre';
  const Code = slots?.code ?? 'code';
  const Toggle = slots?.toggle ?? Button;
  const id = useId();
  const labelId = `${id}-label`;
  const sourceId = `${id}-source`;
  const [expanded, requestOpen] = useControlledState(open, defaultOpen, onOpenChange);
  const lines = code.match(/[^\n]*\n|[^\n]+$/g) ?? [];
  const limit =
    maxLines !== undefined && Number.isFinite(maxLines) && maxLines > 0 ? Math.max(1, Math.floor(maxLines)) : undefined;
  const collapsible = limit !== undefined && lines.length > limit;
  const effectiveOpen = !collapsible || expanded;
  const visibleLines = effectiveOpen ? lines : lines.slice(0, limit);
  const formatter = numberFormatter(locale);
  const focusSource = useRef<Document | null>(null);
  const toggleRef = useCallback((node: HTMLButtonElement | null) => {
    if (!node) return;
    return () => {
      if (node.ownerDocument.activeElement === node) focusSource.current = node.ownerDocument;
    };
  }, []);
  const highlightRef = useRef(highlight);
  const [highlighted, setHighlighted] = useState<HighlightState | null>(null);
  const hasHighlight = highlight !== undefined;
  useEffect(() => {
    highlightRef.current = highlight;
  });
  useEffect(() => {
    const loader = highlightRef.current;
    setHighlighted(null);
    if (!loader || code === '') return;
    let active = true;
    let result: ReturnType<CodeHighlightLoader>;
    try {
      result = loader({ code, language });
    } catch (error) {
      warnHighlightFailure(error);
      return;
    }
    Promise.resolve(result).then(
      (lines) => {
        if (active) setHighlighted(lines ? { loader, code, language, lines } : null);
      },
      (error: unknown) => {
        if (active) warnHighlightFailure(error);
      },
    );
    return () => {
      active = false;
    };
  }, [code, language, hasHighlight, highlight]);
  const highlightedLines =
    hasHighlight && highlighted?.loader === highlight && highlighted.code === code && highlighted.language === language
      ? highlighted.lines
      : undefined;
  useLayoutEffect(() => {
    if (focusSource.current) {
      focusSource.current.getElementById(sourceId)?.focus();
      focusSource.current = null;
    }
  });

  return (
        <SurfaceRoot
          element="section"
          owner="CodeBlock"
          appearance={appearance}
          variant="raised"
          component={component}
          slots={slots}
          slotProps={slotProps}
          attributes={{ 'data-highlighted': highlightedLines ? '' : undefined }}
          structure={rootStyle}
          sx={sx}
          {...rest}
          internalRef={ref}
          marker="code-block"
          className={className}
          aria-label={ariaLabel}
          aria-labelledby={labelledBy ? `${labelledBy} ${labelId}` : ariaLabel !== undefined ? undefined : labelId}
        >
          <Header
            {...withoutSx(slotProps?.header)}
            data-ui="code-block-header"
            className={slotProps?.header?.className}
            css={[headerStyle, slotProps?.header?.sx]}
          >
            <Label
              {...withoutSx(slotProps?.label)}
              id={labelId}
              data-ui="code-block-label"
              className={slotProps?.label?.className}
              css={[labelStyle, slotProps?.label?.sx]}
            >
              {filename || label}
            </Label>
            {language !== undefined && language !== '' && (
              <Language
                {...withoutSx(slotProps?.language)}
                data-ui="code-block-language"
                className={slotProps?.language?.className}
                css={[languageStyle, slotProps?.language?.sx]}
              >
                {language}
              </Language>
            )}
            {copyable && (
              <CopyButton
                label="Copy code"
                pendingLabel="Copying code"
                copiedLabel="Code copied"
                errorLabel="Could not copy code"
                variant="ghost"
                iconOnly
                {...copyButtonProps}
                sx={[copyStyle, copyButtonProps?.sx]}
                text={code}
              />
            )}
          </Header>
          <SourceFrame
            {...withoutSx(slotProps?.sourceFrame)}
            data-ui="code-block-source-frame"
            data-state={collapsible ? (effectiveOpen ? 'expanded' : 'collapsed') : undefined}
            className={slotProps?.sourceFrame?.className}
            css={[frameStyle, slotProps?.sourceFrame?.sx]}
          >
            {lineNumbers && visibleLines.length > 0 && (
              <Gutter
                {...withoutSx(slotProps?.gutter)}
                aria-hidden="true"
                data-ui="code-block-gutter"
                className={slotProps?.gutter?.className}
                css={[sourceTypography, gutterStyle, slotProps?.gutter?.sx]}
              >
                {visibleLines.map((_, index) => formatter.format(index + 1)).join('\n')}
              </Gutter>
            )}
            <Pre
              {...withoutSx(slotProps?.pre)}
              id={sourceId}
              ref={preRef}
              role="group"
              tabIndex={0}
              dir="ltr"
              aria-label={sourceLabel}
              data-ui="code-block-pre"
              className={slotProps?.pre?.className}
              css={[sourceTypography, preStyle, slotProps?.pre?.sx]}
            >
              <Code
                {...withoutSx(slotProps?.code)}
                data-ui="code-block-code"
                className={slotProps?.code?.className}
                css={[codeStyle, slotProps?.code?.sx]}
              >
                {highlightedLines
                  ? visibleLines.map((line, index) => (
                      <Fragment key={index}>{renderLine(line, highlightedLines[index])}</Fragment>
                    ))
                  : effectiveOpen
                    ? code
                    : visibleLines.join('')}
              </Code>
            </Pre>
          </SourceFrame>
          {collapsible && (
            <Toggle
              {...withoutSx(slotProps?.toggle)}
              ref={toggleRef}
              variant="ghost"
              tone="neutral"
              size="sm"
              endIcon={chevron}
              aria-expanded={!!expanded}
              aria-controls={sourceId}
              data-ui="code-block-toggle"
              className={slotProps?.toggle?.className}
              css={[toggleStyle, slotProps?.toggle?.sx]}
              render={(buttonProps) => <button {...buttonProps} type="button" />}
              onClick={() => requestOpen(!expanded)}
            >
              {expanded ? collapseLabel : getExpandLabel(lines.length, formatter.format(lines.length))}
            </Toggle>
          )}
        </SurfaceRoot>
  );
}

CodeBlock.displayName = 'CodeBlock';
