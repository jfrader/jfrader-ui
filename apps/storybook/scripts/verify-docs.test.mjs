import assert from 'node:assert/strict';
import fs from 'node:fs';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { syncBuiltinESMExports } from 'node:module';
import { performance } from 'node:perf_hooks';
import path from 'node:path';
import { test } from 'node:test';
import { loadCsf } from 'storybook/internal/csf-tools';
import { checkComponentDocs, checkIntroduction, checkSections, checkSectionFiles, checkSnippets, checkGameStories } from './verify-docs.mjs';

test('checks curated section names against story exports, not display names or other exports', () => {
  const source = (names) => `
    export default { excludeStories: ['helper'], parameters: { docs: { sections: [{ title: 'Examples', stories: ${JSON.stringify(names)} }] } } };
    export const Default = { name: 'Basic example' };
    export const Other = {};
    export const helper = 1;
  `;
  assert.deepEqual(checkSections(source(['Default', 'Other'])), []);
  assert.deepEqual(checkSections(source([])), []);
  assert.deepEqual(checkSections('export default {}; export const Default = {};'), []);
  for (const name of ['Defualt', 'Basic example', 'helper']) {
    assert.deepEqual(checkSections(source([name])), [`parameters.docs.sections: unknown story export "${name}".`]);
  }
  assert.match(checkSections(source(['Default']).replace('["Default"]', '[storyName]'))[0], /literal story export name/);
  assert.match(checkSections(source(['Default']).replace('["Default"]', 'storyNames'))[0], /literal stories array/);
});

const gameStory = (meta = '', story = '') => `
  export default { title: 'Games/GameCard', tags: ['autodocs'], ${meta} };
  export const Default = { ${story} };
`;
const sourceCode = (code) => `parameters: { docs: { source: { code: ${JSON.stringify(code)} } } }`;
const checkGames = (source, component = 'game-card') => checkGameStories(source, 'game.stories.tsx', component);

test('requires authored snippets for every published Games entry, inherited or overridden', () => {
  assert.match(checkGames(gameStory())[0], /require authored/);
  assert.deepEqual(checkGames(gameStory(sourceCode('<GameCard label="Card" />'))), []);
  assert.deepEqual(checkGames(gameStory('', sourceCode('<GameCard label="Card" />'))), []);
  assert.deepEqual(checkGames(gameStory('', "tags: ['!autodocs']")), []);
  assert.match(checkGames(gameStory(sourceCode('<GameCard />'), sourceCode('')))[0], /require authored/);
  assert.match(checkGames(gameStory(), 'card-flights')[0], /require authored/);
});

test('rejects Games barrel imports including aliases, types and namespaces, not other UI symbols', () => {
  for (const code of [
    "import { GameCard } from '@jfrader/ui';",
    "import { GameCard as Card } from '@jfrader/ui';",
    "import type { Deck } from '@jfrader/ui';",
    "import * as UI from '@jfrader/ui';",
    "import { useBoardFlights } from '@jfrader/ui';",
  ]) assert.match(checkGames(gameStory(sourceCode(code))).join('\n'), /not the barrel/);
  assert.deepEqual(checkGames(gameStory(sourceCode("import { Button } from '@jfrader/ui'; import { GameCard } from '@jfrader/ui/game-card';"))), []);
});

test('rejects non-browser setup on published stories, including meta inheritance and spreads', () => {
  for (const setup of ['beforeEach: () => {}', 'loaders: [async () => ({})]', 'parameters: { viewport: { defaultViewport: "mobile" } }']) {
    const errors = checkGames(gameStory(setup, sourceCode('<GameCard />')));
    assert.match(errors.join('\n'), /published docs cannot declare/);
    assert.match(checkGames(gameStory(sourceCode('<GameCard />'), setup)).join('\n'), /published docs cannot declare/);
    assert.deepEqual(checkGames(gameStory(setup, "tags: ['!autodocs']")), []);
    assert.match(checkGames(`const setup = { ${setup} }; ${gameStory(sourceCode('<GameCard />'), '...setup')}`).join('\n'), /published docs cannot declare/);
  }
});

test('resolves story reuse and factory metadata without executing setup', () => {
  assert.deepEqual(checkGames(`
    export default { tags: ['autodocs'] };
    const base = { tags: ['!autodocs'], beforeEach: () => { throw Error('must not execute'); } };
    function fixture() { return { ...base }; }
    export const Hidden = fixture();
    export const AlsoHidden = { ...base };
  `), []);
  assert.match(checkGames(`
    export default { tags: ['autodocs'], ${sourceCode('<GameCard />')} };
    const base = { beforeEach: () => {} };
    export const Visible = { ...base };
  `).join('\n'), /cannot declare beforeEach/);
});

test('does not trust opaque spreads that can replace source or setup metadata', () => {
  assert.notDeepEqual(checkGames(gameStory(sourceCode('<GameCard />'), '...externalStory')), []);
  assert.match(checkGames(gameStory(sourceCode('<GameCard />'), 'parameters: { ...externalParameters }')).join('\n'), /require authored/);
});

test('parses every authored TSX snippet, including story overrides', () => {
  const source = (first, second) => `
    export default { parameters: { docs: { source: { code: ${JSON.stringify(first)} } } } };
    export const Default = { parameters: { docs: { source: { code: ${JSON.stringify(second)} } } } };
  `;
  assert.deepEqual(checkSnippets(source('<A />', '<><A /><B /></>')), []);
  assert.match(checkSnippets(source('<A />', '<A />\n<B />'))[0], /Adjacent JSX/);
  assert.match(checkSnippets(source('<A', '<B />'))[0], /Unexpected token/);
  assert.match(checkSnippets(source('<A />', 'function Example() { return <B />;'))[0], /Unexpected token/);
});

const story = (description) => `
  const meta = {
    component: Button,
    parameters: { docs: { description: { component: ${description} } } },
  } satisfies Meta<typeof Button>;
  export default meta;
  export const Default = { render: () => <Button>Save</Button> };
`;

test('accepts an introduction in TSX meta without executing the story', () => {
  assert.deepEqual(checkIntroduction(story('"Choose a date. Use the arrows to change months."')), []);
  assert.deepEqual(checkIntroduction(story('`Choose a date.`')), []);
});

test('requires an explicit, nonempty string literal', () => {
  for (const value of ['undefined', '""', '"   "', '``', '`\n\t`', '["Choose a date."].join(" ")', '`Choose ${kind}.`']) {
    assert.match(checkIntroduction(story(value))[0], /string literal/);
  }
  assert.match(checkIntroduction('export default { component: Button };')[0], /string literal/);
});

test('accepts long documentation in strings and template literals', () => {
  const description = Array(100).fill('Explain the component and its usage.').join(' ');
  assert.deepEqual(checkIntroduction(story(JSON.stringify(description))), []);
  assert.deepEqual(checkIntroduction(story('`' + description + '`')), []);
});

test('accepts paragraphs, headings, lists, HTML, and any number of sentences', () => {
  for (const text of [
    'Choose a date.\n\nUse the arrows.', '## Dates', '- Choose a date', '<p>Choose a date.</p>',
    'Choose a date.\n+ Use arrows.', 'Choose a date.\n> Use arrows.', '1) Choose a date',
    '```\nChoose a date\n```', 'Choose a date\n===', '    Choose a date', '\tChoose a date',
  ]) {
    assert.deepEqual(checkIntroduction(story(JSON.stringify(text))), []);
  }
  assert.deepEqual(checkIntroduction(story('"Choose a date. Change the month. Confirm the date."')), []);
});

test('rejects metadata that a spread, computed key, or duplicate property can override', () => {
  const source = story('"Choose a date."');
  for (const overridden of [
    source.replace('} satisfies', '...extra } satisfies'),
    source.replace('component: "Choose a date."', 'component: "Choose a date.", ...extra'),
    source.replace('component: "Choose a date."', 'component: "Choose a date.", [key]: value'),
    source.replace('} } }', '}, ...extra } }'),
    source.replace('} } }', '} }, ...extra }'),
  ]) {
    assert.match(checkIntroduction(overridden)[0], /override the introduction/);
  }
  assert.match(checkIntroduction(source.replace('component: "Choose a date."',
    'component: "Choose a date.", component: longText'))[0], /metadata explicit/);
  assert.deepEqual(checkIntroduction(source.replace('component: "Choose a date."',
    '...extra, component: "Choose a date."')), []);
});

test('checks every public component and reports missing stories', (t) => {
  const root = mkdtempSync(path.join(tmpdir(), 'jfrader-docs-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const name of ['button', 'missing', 'internal']) mkdirSync(path.join(root, name));
  writeFileSync(path.join(root, 'button/index.ts'), '');
  writeFileSync(path.join(root, 'missing/index.ts'), '');
  writeFileSync(path.join(root, 'button/button.stories.tsx'), story('"Run an action."'));
  assert.deepEqual(checkComponentDocs(root), { checked: 1, errors: ['missing: missing component stories.'] });
  writeFileSync(path.join(root, 'missing/missing.stories.tsx'), story('"Show a message."'));
  assert.deepEqual(checkComponentDocs(root), { checked: 2, errors: [] });
  writeFileSync(path.join(root, 'missing/missing.stories.tsx'), story('undefined'));
  assert.match(checkComponentDocs(root).errors[0], /missing\/missing.stories.tsx: Add a string literal/);
  writeFileSync(path.join(root, 'missing/missing.stories.tsx'), story('"Show a message."')
    .replace('docs: {', 'docs: { sections: [{ title: "Examples", stories: ["Defualt"] }],'));
  assert.deepEqual(checkComponentDocs(root).errors, [
    'missing/missing.stories.tsx: parameters.docs.sections: unknown story export "Defualt".',
  ]);
});

test('reads each component story once across coverage and duplicate-title checks without caching between runs', (t) => {
  const root = mkdtempSync(path.join(tmpdir(), 'jfrader-docs-read-once-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(path.join(root, 'button'));
  writeFileSync(path.join(root, 'button/index.ts'), '');
  const fileName = path.join(root, 'button/button.stories.tsx');
  writeFileSync(fileName, story('"Run an action."'));
  const originalReadFileSync = fs.readFileSync;
  let reads = 0;
  t.mock.method(fs, 'readFileSync', (file, ...args) => {
    if (file === fileName) reads += 1;
    return originalReadFileSync(file, ...args);
  });
  syncBuiltinESMExports();
  t.after(() => {
    t.mock.restoreAll();
    syncBuiltinESMExports();
  });
  assert.deepEqual(checkComponentDocs(root), { checked: 1, errors: [] });
  assert.equal(reads, 1);
  writeFileSync(fileName, story('undefined'));
  assert.match(checkComponentDocs(root).errors[0], /string literal/);
  assert.equal(reads, 2);
  writeFileSync(fileName, 'export default {');
  const { errors } = checkComponentDocs(root);
  assert.equal(errors.length, 2);
  assert.match(errors[0], /button\/button.stories.tsx: .*Unexpected token/s);
  assert.match(errors[1], /button\/button.stories.tsx: cannot check docs title: .*Unexpected token/s);
  assert.equal(reads, 3);
});

test('deduplicates shared token arrays in section, snippet, and Games traversals', (t) => {
  const root = mkdtempSync(path.join(tmpdir(), 'jfrader-docs-shared-array-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(path.join(root, 'game-card'));
  writeFileSync(path.join(root, 'game-card/index.ts'), '');
  writeFileSync(path.join(root, 'game-card/game-card.stories.tsx'), '');
  const csf = loadCsf(story('"Show a card."'), {
    fileName: 'game-card.stories.tsx', makeTitle: () => 'Games/GameCard',
  }).parse();
  const size = 3000;
  const traversalCount = 3;
  const maxDurationMs = 5000;
  let elementReads = 0;
  const visits = Array(size).fill(0);
  const tokens = Array.from({ length: size }, (_, index) => ({
    get marker() { visits[index] += 1; return index; },
  }));
  for (const [index, token] of tokens.entries()) {
    Object.defineProperty(tokens, index, {
      enumerable: true,
      get() { elementReads += 1; return token; },
    });
  }
  csf._ast.sharedLocations = Array.from({ length: size }, () => ({ tokens }));
  const started = performance.now();
  assert.deepEqual(checkComponentDocs(root, () => csf), { checked: 1, errors: [] });
  const elapsed = performance.now() - started;
  t.diagnostic(`shared-array traversal: ${elapsed.toFixed(3)} ms, ${elementReads} element reads`);
  assert.deepEqual(visits, Array(size).fill(traversalCount));
  assert.equal(elementReads, size * traversalCount, 'shared arrays must be enumerated once per traversal');
  assert.ok(elapsed < maxDurationMs, `shared-array traversal took ${elapsed.toFixed(3)} ms (limit ${maxDurationMs} ms)`);
});

test('checks curated sections in nested story files without a component index', (t) => {
  const root = mkdtempSync(path.join(tmpdir(), 'jfrader-docs-sections-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(path.join(root, 'gallery'));
  const fileName = path.join(root, 'gallery/gallery.stories.tsx');
  writeFileSync(fileName, story('"Browse icons."')
    .replace('docs: {', 'docs: { sections: [{ title: "Examples", stories: ["Defualt"] }],'));
  assert.deepEqual(checkSectionFiles(root), [
    `${fileName}: parameters.docs.sections: unknown story export "Defualt".`,
  ]);
});

test('Article and ArticleSection each publish one documentation page', () => {
  for (const family of ['article', 'article-section']) {
    const directory = path.resolve(import.meta.dirname, '../../../packages/ui/src/components', family);
    const published = readdirSync(directory).filter((name) => {
      if (!name.endsWith('.stories.tsx')) return false;
      const file = path.join(directory, name);
      const { meta } = loadCsf(readFileSync(file, 'utf8'), { fileName: file, makeTitle: (title) => title }).parse();
      return !meta.tags?.includes('!autodocs');
    });
    assert.deepEqual(published, [`${family}.stories.tsx`], `${family}: auxiliary story files would create duplicate docs navigation`);
  }
});

test('component re-exports retain documentation checks in the owning package', (t) => {
  const root = mkdtempSync(path.join(tmpdir(), 'jfrader-docs-owner-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(path.join(root, 'components/svg-icon'), { recursive: true });
  mkdirSync(path.join(root, 'node_modules/@jfrader'), { recursive: true });
  const icons = path.resolve(import.meta.dirname, '../../../packages/icons');
  symlinkSync(icons, path.join(root, 'node_modules/@jfrader/icons'), 'dir');
  writeFileSync(path.join(root, 'components/svg-icon/index.ts'), "export { SvgIcon } from '@jfrader/icons/svg-icon';\n");
  assert.deepEqual(checkComponentDocs(path.join(root, 'components')), { checked: 1, errors: [] });
  const source = readFileSync(path.join(icons, 'src/svg-icon/svg-icon.stories.tsx'), 'utf8');
  assert.match(source, /title: 'Icons\/SvgIcon'/);
});

const titled = (title, tags = "['autodocs']") => `
  const meta = {
    title: ${JSON.stringify(title)},
    tags: ${tags},
    component: Button,
    parameters: { docs: { description: { component: 'Does a thing.' } } },
  };
  export default meta;
  export const Default = { render: () => null };
`;

test('reports two published story files that share a docs title', (t) => {
  const root = mkdtempSync(path.join(tmpdir(), 'jfrader-docs-titles-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(path.join(root, 'thing'));
  writeFileSync(path.join(root, 'thing/index.ts'), '');
  writeFileSync(path.join(root, 'thing/thing.stories.tsx'), titled('Data/Thing'));
  writeFileSync(path.join(root, 'thing/thing.extra.stories.tsx'), titled('Data/Thing'));
  const error = checkComponentDocs(root).errors.find((entry) => /Duplicate docs title/.test(entry));
  assert.match(error, /"Data\/Thing" creates 2 pages/);
  assert.match(error, /thing\/thing\.extra\.stories\.tsx/);

  writeFileSync(path.join(root, 'thing/thing.extra.stories.tsx'), titled('Data/Thing extra'));
  assert.deepEqual(checkComponentDocs(root).errors, []);

  writeFileSync(path.join(root, 'thing/thing.extra.stories.tsx'), titled('Data/Thing', "['autodocs', '!autodocs']"));
  assert.deepEqual(checkComponentDocs(root).errors, []);
});
