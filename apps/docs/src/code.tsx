import { CodeBlock } from '@jfrader/ui';
import { loadShikiHighlight } from '@jfrader/ui/code-block/shiki';

/**
 * The code renderer the docs front uses everywhere it shows code. Same block and same highlighter
 * as the library's own docs, so a sample looks identical in both.
 */
export default function Code({ code, language }: { code: string; language?: string }) {
  return <CodeBlock code={code} language={language} highlight={loadShikiHighlight} copyable />;
}
