import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkStylingApi } from './verify-styling-api.mjs';

test('rejects css declarations and the retired alias in component and slot types', () => {
  for (const source of [
    'export interface Part { css?: Interpolation<Theme> }',
    'type Slot = NativeProps & { "css"?: Styles };',
    'export type Slot = SlotCss;',
  ]) assert.ok(checkStylingApi(source).length);
});

test('allows internal Emotion style constants, attributes and implementation options', () => {
  assert.deepEqual(checkStylingApi(`
    const own = css({ color: 'red' });
    const implementation = { css: own };
    type InternalOptions = { styles?: Styles };
    export interface Slot extends SxProps {}
    const view = <div css={[own, slotProps?.root?.sx]} />;
  `), []);
});

test('checks inline slots, callback slots and referenced fixtures without chasing cycles', () => {
  for (const source of [
    'const view = <Panel slotProps={{ root: { css: styles } }} />;',
    'const story = { args: { slotProps: { item: () => ({ css: styles }) } } };',
    'const shared = { root: { css: styles } }; const view = <Panel slotProps={shared} />;',
    'const root = { css: styles }; const shared = { root }; const view = <Panel slotProps={shared} />;',
  ]) assert.match(checkStylingApi(source).join('\n'), /slotProps styling uses sx/);
  assert.deepEqual(checkStylingApi('const loop = { loop }; const view = <Panel slotProps={loop} />;'), []);
});

test('checks authored snippets including interpolated templates and semantic stories', () => {
  for (const code of [
    '"<Panel slotProps={{ root: { css: styles } }} />"',
    '`<Panel slotProps={{ root: { css: ${styles} } }} />`',
  ]) assert.match(checkStylingApi(`const story = { parameters: { docs: { source: { code: ${code} } } } };`, 'panel.semantic.stories.tsx').join('\n'), /source.code.*slotProps/);
  assert.deepEqual(checkStylingApi('const story = { source: { code: "<div css={own} />" } };'), []);
});

test('accepts sx across public types, fixtures and snippets', () => {
  assert.deepEqual(checkStylingApi(`
    export type Slot = NativeProps & SxProps;
    const shared = { root: { sx: styles } };
    const view = <Panel slotProps={shared} />;
    const story = { source: { code: '<Panel slotProps={{ root: { sx: styles } }} />' } };
  `), []);
});
