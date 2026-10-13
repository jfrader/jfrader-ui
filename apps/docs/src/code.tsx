import { CodeBlock } from '@jfrader/ui';
import { loadShikiHighlight } from '@jfrader/ui/code-block/shiki';

/**
 * The code renderer the docs front uses everywhere it shows code. Same block and same highlighter
 * as the library's own docs, so a sample looks identical in both.
 */
export default function Code({ code, language, label }: { code: string; language?: string; label?: string }) {
  // The engine names each panel after its story; without forwarding it, every one is "Source code"
  // and a page with several examples exposes duplicate landmarks.
  return <CodeBlock code={code} language={language} label={label} highlight={loadShikiHighlight} copyable />;
}
