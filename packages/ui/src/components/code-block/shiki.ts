// Shiki adapter for CodeBlock's `highlight` loader, published as `@jfrader/ui/code-block/shiki`.
// This is the only module that imports shiki (an optional peer): apps that never import it never
// load or install it. The highlighter core, the JavaScript regex engine and each grammar load on
// first use; grammars load one by one, the first time their language is requested.
//
// Token colors are token references (`var(--ui-color-syntax-*)`), so one theme serves dark and
// light and follows the nearest ThemeRoot like every other component.
import { createHighlighterCore, getTokenStyleObject, type HighlighterCore, type ThemeRegistration } from 'shiki/core';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';
import { vars } from '@jfrader/tokens/vars';
import type { CodeHighlightLines, CodeHighlightLoader } from './code-block';

const THEME_NAME = 'jfrader-ui';

const theme: ThemeRegistration = {
  name: THEME_NAME,
  colors: { 'editor.foreground': vars.color.text, 'editor.background': vars.color.surfaceInset },
  tokenColors: [
    {
      scope: ['punctuation', 'meta.brace', 'keyword.operator'],
      settings: { foreground: vars.color.syntaxPunctuation },
    },
    {
      scope: ['keyword', 'storage', 'keyword.operator.new', 'keyword.operator.expression', 'variable.language'],
      settings: { foreground: vars.color.syntaxKeyword },
    },
    {
      scope: ['string', 'punctuation.definition.string', 'string.regexp'],
      settings: { foreground: vars.color.syntaxString },
    },
    {
      scope: ['constant', 'support.constant', 'keyword.other.unit'],
      settings: { foreground: vars.color.syntaxConstant },
    },
    {
      scope: ['entity.name.function', 'support.function', 'meta.function-call.generic'],
      settings: { foreground: vars.color.syntaxFunction },
    },
    {
      scope: ['entity.name.type', 'entity.name.class', 'support.type', 'support.class', 'entity.other.inherited-class'],
      settings: { foreground: vars.color.syntaxType },
    },
    {
      scope: ['entity.name.tag', 'entity.other.attribute-name.class.css', 'entity.other.attribute-name.id.css'],
      settings: { foreground: vars.color.syntaxTag },
    },
    {
      scope: [
        'entity.other.attribute-name',
        'support.type.property-name',
        'meta.object-literal.key',
        'variable.other.property',
      ],
      settings: { foreground: vars.color.syntaxProperty },
    },
    {
      scope: ['comment', 'punctuation.definition.comment'],
      settings: { foreground: vars.color.syntaxComment, fontStyle: 'italic' },
    },
  ],
};

const grammars = {
  javascript: () => import('shiki/langs/javascript.mjs'),
  typescript: () => import('shiki/langs/typescript.mjs'),
  jsx: () => import('shiki/langs/jsx.mjs'),
  tsx: () => import('shiki/langs/tsx.mjs'),
  json: () => import('shiki/langs/json.mjs'),
  css: () => import('shiki/langs/css.mjs'),
  shellscript: () => import('shiki/langs/shellscript.mjs'),
  html: () => import('shiki/langs/html.mjs'),
};
type Grammar = keyof typeof grammars;

const ALIASES = new Map<string, Grammar>([
  ['javascript', 'javascript'],
  ['js', 'javascript'],
  ['mjs', 'javascript'],
  ['cjs', 'javascript'],
  ['typescript', 'typescript'],
  ['ts', 'typescript'],
  ['mts', 'typescript'],
  ['cts', 'typescript'],
  ['jsx', 'jsx'],
  ['tsx', 'tsx'],
  ['json', 'json'],
  ['css', 'css'],
  ['bash', 'shellscript'],
  ['sh', 'shellscript'],
  ['shell', 'shellscript'],
  ['shellscript', 'shellscript'],
  ['zsh', 'shellscript'],
  ['html', 'html'],
]);

let highlighter: Promise<HighlighterCore> | undefined;
const loadedGrammars = new Map<Grammar, Promise<void>>();

function getHighlighter() {
  highlighter ??= createHighlighterCore({ themes: [theme], langs: [], engine: createJavaScriptRegexEngine() }).catch(
    (error: unknown) => {
      highlighter = undefined;
      throw error;
    },
  );
  return highlighter;
}

function loadGrammar(core: HighlighterCore, grammar: Grammar) {
  let loading = loadedGrammars.get(grammar);
  if (!loading) {
    loading = core.loadLanguage(grammars[grammar]()).catch((error: unknown) => {
      loadedGrammars.delete(grammar);
      throw error;
    });
    loadedGrammars.set(grammar, loading);
  }
  return loading;
}

/** Highlights js/ts/jsx/tsx/json/css/bash/html with shiki; any other language resolves to `null` (plain text). */
export const loadShikiHighlight: CodeHighlightLoader = async ({ code, language }) => {
  const grammar = language === undefined ? undefined : ALIASES.get(language.trim().toLowerCase());
  if (!grammar) return null;
  const core = await getHighlighter();
  await loadGrammar(core, grammar);
  return core.codeToTokensBase(code, { lang: grammar, theme: THEME_NAME }).map((line) =>
    line.map((token) => {
      const style = getTokenStyleObject(token);
      return {
        content: token.content,
        color: style.color === vars.color.text ? undefined : style.color,
        fontStyle: style['font-style'] === 'italic' ? 'italic' : undefined,
      };
    }),
  ) satisfies CodeHighlightLines;
};
