'use client';

import { useCallback, useId, useLayoutEffect, useRef, type ComponentPropsWithRef, type Ref } from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css, type Interpolation, type Theme } from '../../styling/css';
import { focusRingInset } from '../../styling/focus-ring';
import { FORCED_COLORS } from '../../styling/media';
import { WithSx, type SxProps } from '../../styling/sx';
import { useControlledState } from '../../utils/use-controlled-state';
import { Button } from '../button';
import { CopyButton, type CopyButtonProps } from '../copy-button';

export interface CodeBlockSlotPartProps {
  className?: string;
  css?: Interpolation<Theme>;
}

export interface CodeBlockSlotProps {
  header?: CodeBlockSlotPartProps;
  label?: CodeBlockSlotPartProps;
  language?: CodeBlockSlotPartProps;
  sourceFrame?: CodeBlockSlotPartProps;
  gutter?: CodeBlockSlotPartProps;
  pre?: CodeBlockSlotPartProps;
  code?: CodeBlockSlotPartProps;
  toggle?: CodeBlockSlotPartProps;
}

export interface CodeBlockProps extends Omit<ComponentPropsWithRef<'section'>, 'children' | 'onChange'>, SxProps {
  code: string;
  filename?: string;
  language?: string;
  label?: string;
  sourceLabel?: string;
  maxLines?: number;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  lineNumbers?: boolean;
  locale?: Intl.LocalesArgument;
  getExpandLabel?: (count: number, formatted: string) => string;
  collapseLabel?: string;
  copyable?: boolean;
  copyButtonProps?: Partial<Omit<CopyButtonProps, 'text' | 'ref'>>;
  preRef?: Ref<HTMLPreElement>;
  slotProps?: CodeBlockSlotProps;
  css?: Interpolation<Theme>;
}

const rootStyle = css({
  label: 'code-block',
  boxSizing: 'border-box',
  minInlineSize: 0,
  maxInlineSize: '100%',
  backgroundColor: vars.color.surface,
  color: vars.color.text,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.md,
  fontFamily: vars.font.sans,
  fontSize: vars.textSize.sm,
  [FORCED_COLORS]: { borderColor: 'CanvasText', color: 'CanvasText' },
});
const headerStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: vars.space[2],
  paddingBlock: vars.space[3],
  paddingInline: vars.space[4],
});
const labelStyle = css({ fontWeight: vars.fontWeight.medium, overflowWrap: 'anywhere' });
const languageStyle = css({ color: vars.color.textMuted, overflowWrap: 'anywhere' });
const frameStyle = css({
  display: 'flex',
  direction: 'ltr',
  minInlineSize: 0,
  backgroundColor: vars.color.surfaceInset,
  borderBlock: `1px solid ${vars.color.borderSubtle}`,
});
const sourceTypography = css({
  fontFamily: vars.font.mono,
  fontSize: vars.textSize.sm,
  lineHeight: vars.lineHeight.relaxed,
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'pre',
});
const gutterStyle = css({
  flexShrink: 0,
  paddingBlock: vars.space[4],
  paddingInline: vars.space[3],
  textAlign: 'end',
  color: vars.color.textMuted,
  userSelect: 'none',
  borderInlineEnd: `1px solid ${vars.color.borderSubtle}`,
});
const preStyle = css({
  flex: '1 1 auto',
  minInlineSize: 0,
  margin: 0,
  padding: vars.space[4],
  overflow: 'auto',
  unicodeBidi: 'isolate',
  '&:focus-visible': focusRingInset,
});
const codeStyle = css({ font: 'inherit' });
const toggleStyle = css({
  margin: vars.space[3],
  maxInlineSize: `calc(100% - ${vars.space[3]} * 2)`,
  blockSize: 'auto',
  minBlockSize: vars.space[8],
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
});
const englishPluralRules = new Intl.PluralRules('en');
function defaultExpandLabel(count: number, formatted: string) {
  return `Show all ${formatted} ${englishPluralRules.select(count) === 'one' ? 'line' : 'lines'}`;
}

export function CodeBlock({
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
  slotProps,
  className,
  sx,
  'aria-label': ariaLabel,
  'aria-labelledby': labelledBy,
  ...rest
}: CodeBlockProps) {
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
  const formatter = new Intl.NumberFormat(locale);
  const focusSource = useRef<Document | null>(null);
  const toggleRef = useCallback((node: HTMLButtonElement | null) => {
    if (!node) return;
    return () => {
      if (node.ownerDocument.activeElement === node) focusSource.current = node.ownerDocument;
    };
  }, []);
  useLayoutEffect(() => {
    if (focusSource.current) {
      focusSource.current.getElementById(sourceId)?.focus();
      focusSource.current = null;
    }
  });

  return (
    <WithSx className={className} styles={rootStyle} sx={sx}>
      {(mergedClassName) => (
        <section
          {...rest}
          ref={ref}
          data-ui="code-block"
          className={mergedClassName}
          aria-label={ariaLabel}
          aria-labelledby={labelledBy ? `${labelledBy} ${labelId}` : ariaLabel !== undefined ? undefined : labelId}
        >
          <header
            data-ui="code-block-header"
            className={slotProps?.header?.className}
            css={[headerStyle, slotProps?.header?.css]}
          >
            <span
              id={labelId}
              data-ui="code-block-label"
              className={slotProps?.label?.className}
              css={[labelStyle, slotProps?.label?.css]}
            >
              {filename || label}
            </span>
            {language !== undefined && language !== '' && (
              <span
                data-ui="code-block-language"
                className={slotProps?.language?.className}
                css={[languageStyle, slotProps?.language?.css]}
              >
                {language}
              </span>
            )}
            {copyable && (
              <CopyButton
                label="Copy code"
                pendingLabel="Copying code"
                copiedLabel="Code copied"
                errorLabel="Could not copy code"
                {...copyButtonProps}
                text={code}
              />
            )}
          </header>
          <div
            data-ui="code-block-source-frame"
            className={slotProps?.sourceFrame?.className}
            css={[frameStyle, slotProps?.sourceFrame?.css]}
          >
            {lineNumbers && visibleLines.length > 0 && (
              <div
                aria-hidden="true"
                data-ui="code-block-gutter"
                className={slotProps?.gutter?.className}
                css={[sourceTypography, gutterStyle, slotProps?.gutter?.css]}
              >
                {visibleLines.map((_, index) => formatter.format(index + 1)).join('\n')}
              </div>
            )}
            <pre
              id={sourceId}
              ref={preRef}
              role="group"
              tabIndex={0}
              dir="ltr"
              aria-label={sourceLabel}
              data-ui="code-block-pre"
              className={slotProps?.pre?.className}
              css={[sourceTypography, preStyle, slotProps?.pre?.css]}
            >
              <code
                data-ui="code-block-code"
                className={slotProps?.code?.className}
                css={[codeStyle, slotProps?.code?.css]}
              >
                {effectiveOpen ? code : visibleLines.join('')}
              </code>
            </pre>
          </div>
          {collapsible && (
            <Button
              ref={toggleRef}
              variant="ghost"
              tone="neutral"
              size="sm"
              aria-expanded={!!expanded}
              aria-controls={sourceId}
              data-ui="code-block-toggle"
              className={slotProps?.toggle?.className}
              css={[toggleStyle, slotProps?.toggle?.css]}
              render={(buttonProps) => <button {...buttonProps} type="button" />}
              onClick={() => requestOpen(!expanded)}
            >
              {expanded ? collapseLabel : getExpandLabel(lines.length, formatter.format(lines.length))}
            </Button>
          )}
        </section>
      )}
    </WithSx>
  );
}

CodeBlock.displayName = 'CodeBlock';
