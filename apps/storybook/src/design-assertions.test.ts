import { afterEach, expect, test } from 'vitest';
import '@jfrader/tokens/tokens.css';
import { vars } from '@jfrader/tokens/vars';
import { auditDesign } from '../../../packages/ui/src/testing/design-assertions';

afterEach(() => { document.body.replaceChildren(); });

function fixture(styles = '') {
  document.documentElement.dataset.theme = 'dark';
  const root = document.createElement('div');
  root.dataset.ui = 'photo-grid';
  root.style.cssText = `color: ${vars.color.text}; font-family: ${vars.font.sans}; font-size: ${vars.textSize.md}`;
  const button = document.createElement('button');
  button.textContent = 'Choose';
  button.style.cssText = `font: inherit; color: ${vars.color.text}; background: ${vars.color.surface}; border: 1px solid ${vars.color.borderControl}; border-radius: ${vars.radius.md}; ${styles}`;
  root.append(button);
  document.body.append(root);
  return { root, button };
}

test('accepts token typography, colors and radii', () => {
  fixture();
  expect(auditDesign(document)).toEqual([]);
});

test('reads the palette from a light theme scope', () => {
  const { root } = fixture();
  root.dataset.theme = 'light';
  expect(auditDesign(document)).toEqual([]);
});

test('audits composed family markers outside the root', () => {
  const { root, button } = fixture('font-size: 13.3333px');
  root.removeAttribute('data-ui');
  button.dataset.ui = 'button photo-grid-viewer-action';
  expect(auditDesign(document).some((failure) => failure.includes('UA font size'))).toBe(true);
});

test('rejects UA control typography', () => {
  fixture('font: initial');
  expect(auditDesign(document).some((failure) => failure.includes('control font'))).toBe(true);
});

test('rejects the UA control font size even with a library font family', () => {
  fixture('font-size: 13.3333px');
  expect(auditDesign(document).some((failure) => failure.includes('UA font size'))).toBe(true);
});

test('rejects colors outside the palette', () => {
  fixture('color: rgb(170, 170, 170)');
  expect(auditDesign(document).some((failure) => failure.includes('outside the token palette'))).toBe(true);
});

test('rejects off-scale radii', () => {
  fixture('border-radius: 13px');
  expect(auditDesign(document).some((failure) => failure.includes('outside the token scale'))).toBe(true);
});

test('rejects a literal color hidden inside a token mix', () => {
  fixture(`background: color-mix(in oklab, ${vars.color.surface} 85%, red)`);
  expect(auditDesign(document).some((failure) => failure.includes('outside the token palette'))).toBe(true);
});

test('accepts token-derived translucent colors in scoped themes', () => {
  const { root, button } = fixture();
  root.style.setProperty('--ui-color-surface', 'rgb(41, 45, 52)');
  const sheet = document.createElement('style');
  sheet.textContent = '.audit-overlay { background: color-mix(in oklab, var(--ui-color-surface) 85%, transparent); }';
  root.append(sheet);
  button.style.removeProperty('background');
  button.className = 'audit-overlay';
  expect(auditDesign(document)).toEqual([]);
});
