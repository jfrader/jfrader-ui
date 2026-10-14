import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkUsage } from './verify-docs-usage.mjs';

const story = (metadata) => `
  const meta = { title: 'Games/Example', ${metadata} };
  export default meta;
  export const Default = {};
`;
const source = "parameters: { docs: { source: { code: `import { ThemeRoot } from '@jfrader/ui'; <ThemeRoot>Content</ThemeRoot>` } } }";

test('providers and null children require authored meta Usage, including inherited autodocs', () => {
  for (const metadata of [
    'component: DeckProvider', 'component: CardFlightsProvider', 'component: ThemeRoot',
    'component: UI.DeckProvider', 'component: DialogStack, args: { children: null }',
  ]) {
    assert.equal(checkUsage(story(metadata)).length, 1);
    assert.deepEqual(checkUsage(story(`${metadata}, ${source}`)), []);
  }
});

test('empty and dynamic snippets cannot satisfy the guard', () => {
  for (const code of ['""', '`   `', 'example', '`<${component} />`', 'undefined']) {
    assert.equal(checkUsage(story(`component: ThemeRoot,
      parameters: { docs: { source: { code: ${code} } } }`)).length, 1);
  }
});

test('ordinary components, non-component guides and excluded regression stories are allowed', () => {
  for (const metadata of [
    'component: Button, args: { children: "Save" }',
    'parameters: { docs: { description: { component: "Guide" } } }',
    "component: DeckProvider, tags: ['!autodocs']",
  ]) assert.deepEqual(checkUsage(story(metadata)), []);
});

test('story-level source does not replace the required meta Usage', () => {
  assert.equal(checkUsage(story('component: DeckProvider')
    .replace('export const Default = {};', `export const Default = { ${source} };`)).length, 1);
});

test('overridden source metadata cannot satisfy the guard', () => {
  const valid = story(`component: ThemeRoot, ${source}`);
  for (const overwritten of [
    valid.replace('source: { code:', 'source: { code: "", code:'),
    valid.replace('} } }', '}, ...extra } }'),
    valid.replace('} } }', '}, [key]: value } }'),
    valid.replace('} } }', '} }, ...extra }'),
  ]) assert.equal(checkUsage(overwritten).length, 1);
});
