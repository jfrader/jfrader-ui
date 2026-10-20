import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { loadCsf } from 'storybook/internal/csf-tools';
import { checkComponentDocs, checkIntroduction, checkSnippets, checkGameStories } from './verify-docs.mjs';

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
