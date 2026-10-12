import { isValidElement, useMemo, type ComponentPropsWithoutRef } from 'react';
import { Markdown, Unstyled } from '@storybook/addon-docs/blocks';
import { CodeBlock, TypewriterTerminal } from '@jfrader/ui';
import { loadShikiHighlight } from '@jfrader/ui/code-block/shiki';
import { css } from '../../../packages/ui/src/styling/css';
import './guide.css';

const guidePaths: Record<string, string> = {
  './consuming-jfrader-ui.md': 'foundations-getting-started',
  './theming.md': 'foundations-theming',
  './styling.md': 'foundations-styling',
};

function GuideLink({ href, ...props }: ComponentPropsWithoutRef<'a'>) {
  const page = href && guidePaths[href];
  const target = href?.startsWith('#') ? '_self' : page ? '_top' : props.target;
  return <a {...props} href={page ? `./?path=/docs/${page}--docs` : href} target={target} />;
}

const shellLanguages = new Set(['sh', 'shell', 'bash', 'shellscript']);
const terminalScreenStyle = css({ blockSize: 'auto' });
const terminalSlots = { screen: { css: terminalScreenStyle } };
const completedPosition = Number.MAX_SAFE_INTEGER;

function GuideTerminal({ code }: { code: string }) {
  const steps = useMemo(() => [{ command: code }], [code]);
  return (
    <TypewriterTerminal
      steps={steps}
      title="Terminal"
      label="Setup commands"
      cwd=""
      defaultValue={completedPosition}
      defaultPaused
      slotProps={terminalSlots}
    />
  );
}

function GuideCode({ children, ...props }: ComponentPropsWithoutRef<'pre'>) {
  if (!isValidElement<ComponentPropsWithoutRef<'code'> & { filename?: string }>(children) || typeof children.props.children !== 'string') {
    return <pre {...props}>{children}</pre>;
  }
  const code = children.props.children;
  const language = children.props.className?.match(/\blang(?:uage)?-(\S+)/)?.[1];
  return (
    <Unstyled data-guide-example="">
      {language && shellLanguages.has(language.toLowerCase()) ? (
        <GuideTerminal code={code} />
      ) : (
        <CodeBlock role="group" code={code} filename={children.props.filename} language={language} highlight={loadShikiHighlight} />
      )}
    </Unstyled>
  );
}

const markdownOptions = { overrides: { a: GuideLink, pre: GuideCode } };

export function Guide({ children }: { children: string }) {
  return <article className="foundation-guide"><Markdown options={markdownOptions}>{children}</Markdown></article>;
}
