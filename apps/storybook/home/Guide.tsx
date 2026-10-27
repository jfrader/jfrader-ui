import { isValidElement, useMemo, type ComponentPropsWithoutRef } from 'react';
import Markdown from 'markdown-to-jsx';
import { CodeBlock, TypewriterTerminal } from '@jfrader/ui';
import { loadShikiHighlight } from '@jfrader/ui/code-block/shiki';
import './guide.css';

const guidePaths: Record<string, string> = {
  './getting-started.md': 'foundations-getting-started',
  './theming.md': 'foundations-theming',
  './flights.md': 'foundations-flights',
  './styling.md': 'foundations-styling',
  './icons.md': 'icons-usage',
};

/** A workbench link (`./?path=/docs/…`, `./?path=/story/…`) belongs to the manager, not the preview. */
const MANAGER_HREF = /^\.\/\?path=\/(?:docs|story)\//;

function GuideLink({ href, ...props }: ComponentPropsWithoutRef<'a'>) {
  const page = href && guidePaths[href];
  const target = href?.startsWith('#') ? '_self' : page || MANAGER_HREF.test(href ?? '') ? '_top' : props.target;
  return <a {...props} href={page ? `./?path=/docs/${page}--docs` : href} target={target} />;
}

const shellLanguages = new Set(['sh', 'shell', 'bash', 'shellscript']);

function GuideTerminal({ code }: { code: string }) {
  const steps = useMemo(() => [{ command: code }], [code]);
  return (
    <TypewriterTerminal
      steps={steps}
      title="Terminal"
      label="Setup commands"
      cwd=""
      playback={false}
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
    <div className="sb-unstyled" data-guide-example="">
      {language && shellLanguages.has(language.toLowerCase()) ? (
        <GuideTerminal code={code} />
      ) : (
        <CodeBlock role="group" code={code} filename={children.props.filename} language={language} highlight={loadShikiHighlight} />
      )}
    </div>
  );
}

const markdownOptions = { overrides: { a: GuideLink, pre: GuideCode } };

export function Guide({ children }: { children: string }) {
  return <article className="foundation-guide"><Markdown options={markdownOptions}>{children}</Markdown></article>;
}
