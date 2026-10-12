import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { checkComponentDocs, checkIntroduction } from './verify-docs.mjs';

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
