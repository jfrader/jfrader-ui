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

test('rejects duplicate style applications in styles and css arrays', () => {
  for (const source of [
    '<WithSx styles={[own, sx]} sx={sx} />',
    '<Part css={[slotSx, consumerSx]} sx={consumerSx} />',
    '<WithSx styles={[own, [enabled && slot.sx]]} sx={[consumer, slot.sx]} />',
    '<Part css={[props["sx"]]} sx={props.sx} />',
    '<WithSx styles={sx ?? fallback} sx={sx} />',
  ]) assert.match(checkStylingApi(source).join('\n'), /applied in both/);
});

test('compares complete member accesses, not their property or receiver identifiers', () => {
  for (const source of [
    '<WithSx styles={[slot.sx]} sx={sx} />',
    '<Part css={[first.sx]} sx={second.sx} />',
    '<Part css={[props.own]} sx={props.sx} />',
    '<Part css={[theme => theme.sx]} sx={sx} />',
    '<WithSx styles={[own, slot.sx]} sx={consumer.sx} />',
    '<Part css={undefined} sx={undefined} />',
  ]) assert.deepEqual(checkStylingApi(source), []);
});

test('checks published usage and description prose, including semantic stories', () => {
  for (const source of [
    'export default { parameters: { docs: { usage: "slotProps accepts css" } } };',
    'export const Story = { parameters: { docs: { description: { story: `slotProps.root takes css, not sx` } } } };',
    'export default { parameters: { docs: { description: { component: "Use css and sx with slotProps" } } } };',
    'const usage = "slotProps accepts css"; export default { parameters: { docs: { usage } } };',
    'export default { parameters: { docs: { usage: `slotProps ${part} accepts css` } } };',
  ]) assert.match(checkStylingApi(source, 'part.semantic.stories.tsx').join('\n'), /published slotProps prose/);
  assert.deepEqual(checkStylingApi('const implementation = { description: "slotProps and css" };'), []);
  assert.deepEqual(checkStylingApi('const implementation = { description: "slotProps and css" };', 'part.stories.tsx'), []);
  assert.deepEqual(checkStylingApi('export default { parameters: { docs: { usage: "slotProps accepts sx. CSS transitions respect reduced motion." } } };', 'part.stories.tsx'), []);
});
