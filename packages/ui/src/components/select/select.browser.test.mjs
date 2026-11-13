import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createRequire } from 'node:module';
import { createBrowserWorkbench } from '../../../../../apps/storybook/scripts/browser-workbench.mjs';

let workbench;
before(async () => { workbench = await createBrowserWorkbench(); });
after(async () => workbench?.close());

async function withStory(id, run, viewport = { width: 390, height: 844 }, reducedMotion = 'reduce') {
  const context = await workbench.browser.newContext({ viewport, reducedMotion });
  try {
    const page = await context.newPage();
    await page.goto(`${workbench.baseURL}/iframe.html?id=${id}&viewMode=story&embed=true`);
    await page.locator('#storybook-root input:visible, #storybook-root button:visible').first().waitFor();
    await run(page);
  } finally { await context.close(); }
}

async function traceResets(page) {
  await page.evaluate(() => {
    window.resetEvents = [];
    document.addEventListener('reset', event => setTimeout(() => {
      window.resetEvents.push({ trusted: event.isTrusted, cancelable: event.cancelable, canceled: event.defaultPrevented });
    }, 0), true);
  });
}

async function resetAndObserve(page, canceled) {
  const previous = await page.evaluate(() => window.resetEvents.length);
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await page.waitForFunction(n => window.resetEvents.length > n, previous);
  const event = await page.evaluate(() => window.resetEvents.at(-1));
  assert.deepEqual(event, { trusted: true, cancelable: true, canceled });
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 0)));
}

async function doubleText(page) {
  await page.evaluate(async () => {
    window.originalTextStyles ??= new Map();
    for (const [element, declarations] of window.originalTextStyles) {
      for (const [property, value, priority] of declarations) element.style.setProperty(property, value, priority);
    }
    const sizes = [...document.querySelectorAll('*')].map(element => {
      if (!window.originalTextStyles.has(element)) window.originalTextStyles.set(element,
        ['font-size', 'line-height'].map(property => [property, element.style.getPropertyValue(property), element.style.getPropertyPriority(property)]));
      const styles = getComputedStyle(element);
      return { element, font: styles.fontSize, line: styles.lineHeight };
    });
    for (const { element, font, line } of sizes) {
      if (element === document.documentElement) continue;
      element.style.setProperty('font-size', `${parseFloat(font) * 2}px`, 'important');
      if (line !== 'normal') element.style.setProperty('line-height', `${parseFloat(line) * 2}px`, 'important');
    }
    await document.fonts.ready;
  });
}

async function assertViewportText(page) {
  const result = await page.evaluate(() => {
    const overflow = [];
    const walker = document.createTreeWalker(document.getElementById('storybook-root'), NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!node.textContent.trim() || node.parentElement.closest('[hidden],[data-ui="select-value"]')) continue;
      const range = document.createRange();
      range.selectNode(node);
      for (const box of range.getClientRects()) {
        if (box.width && (box.left < -1 || box.right > innerWidth + 1)) overflow.push(node.textContent);
      }
    }
    return { document: document.documentElement.scrollWidth, viewport: innerWidth, overflow };
  });
  assert.ok(result.document <= result.viewport + 1, JSON.stringify(result));
  assert.deepEqual(result.overflow, []);
}

test('trusted canceled associated reset retains Select selection until an accepted reset', async () => {
  await withStory('inputs-select--associated-form-reset', async page => {
    await traceResets(page);
    const input = page.getByRole('combobox', { name: 'Fruit', exact: true });
    const controlled = page.getByRole('combobox', { name: 'Controlled fruit' });
    const chooseCherry = async () => {
      await input.click();
      await input.press('End');
      await input.press('Enter');
      assert.equal(await input.textContent(), 'Cherry');
    };
    await chooseCherry();
    const changes = await page.getByLabel('Selection callbacks').textContent();
    await resetAndObserve(page, true);
    assert.equal(await input.textContent(), 'Cherry');
    assert.equal(await controlled.textContent(), 'Cherry');
    assert.equal(await page.getByLabel('Selection callbacks').textContent(), changes);
    await chooseCherry();
    await page.getByRole('button', { name: 'Allow reset' }).click();
    await resetAndObserve(page, false);
    await page.waitForFunction(() => document.querySelector('[data-ui="select-trigger"]').textContent === 'Apple');
    assert.equal(await controlled.textContent(), 'Cherry');
    assert.equal(await page.getByLabel('Selection callbacks').textContent(), changes);
  });
});

test('trusted accepted shorthand reset restores its payload without selection callbacks', async () => {
  await withStory('inputs-select--shorthand-form-reset', async page => {
    await traceResets(page);
    const trigger = page.getByRole('combobox');
    await trigger.click();
    await trigger.press('End');
    await trigger.press('Enter');
    assert.equal(await trigger.textContent(), 'Cherry');
    assert.equal(await page.locator('form').evaluate(form => new FormData(form).get('fruit')), 'cherry');
    await resetAndObserve(page, false);
    await page.waitForFunction(() => document.querySelector('[data-ui="select-trigger"]').textContent === 'Apple');
    assert.equal(await page.locator('form').evaluate(form => new FormData(form).get('fruit')), 'apple');
  });
});

test('trusted cancellation preserves Combobox selection and query and controlled input', async () => {
  await withStory('inputs-combobox--associated-form-reset', async page => {
    await traceResets(page);
    const input = page.getByRole('combobox', { name: 'Fruit', exact: true });
    const controlled = page.getByRole('combobox', { name: 'Controlled fruit' });
    await input.fill('Cherry');
    await input.press('ArrowDown');
    await input.press('Enter');
    await input.fill('Cherry edited');
    const calls = await page.getByLabel('Reset callbacks').textContent();
    await resetAndObserve(page, true);
    assert.equal(await input.inputValue(), 'Cherry edited');
    assert.equal(await controlled.inputValue(), 'Controlled query');
    assert.equal(await page.getByLabel('Reset callbacks').textContent(), calls);
    await page.getByRole('button', { name: 'Allow reset' }).click();
    await resetAndObserve(page, false);
    await page.waitForFunction(() => document.querySelector('[role="combobox"]').value === 'Apple');
    assert.equal(await controlled.inputValue(), 'Controlled query');
    assert.equal(await page.getByLabel('Reset callbacks').textContent(), calls);
    await input.press('ArrowDown');
    await page.getByRole('option', { name: 'Apricot', exact: true }).waitFor();
    assert.equal(await input.evaluate(element => document.getElementById(element.getAttribute('aria-activedescendant'))?.textContent?.replace('✓', '').trim()), 'Apple');
    assert.ok(await input.evaluate(element => element === document.activeElement));
  });
});

test('trusted cancellation preserves MoneyInput axes and transient state without reset change callbacks', async () => {
  await withStory('inputs-moneyinput--canceled-form-reset', async page => {
    await traceResets(page);
    const amounts = page.getByRole('spinbutton');
    for (let index = 0; index < 4; index++) {
      await amounts.nth(index).fill('25');
      await amounts.nth(index).press('Enter');
      await page.getByRole('combobox').nth(index).click();
      await page.getByRole('option', { name: /\(EUR\)$/ }).click();
    }
    await amounts.first().fill('invalid');
    await page.evaluate(() => {
      window.moneyBeforeReset = null;
      window.readMoney = () => ({
        values: [...document.querySelectorAll('[role="spinbutton"]')].map(input => input.value),
        currencies: [...document.querySelectorAll('[role="combobox"]')].map(button => button.textContent),
        errors: [...document.querySelectorAll('[role="alert"]')].map(element => element.textContent),
        status: [...document.querySelectorAll('[role="status"]')].map(element => element.textContent),
        payload: [...new FormData(document.forms[0])],
        calls: document.querySelector('[aria-label="Reset callbacks"]').textContent,
      });
      document.addEventListener('reset', () => { window.moneyBeforeReset = window.readMoney(); }, { capture: true, once: true });
    });
    await resetAndObserve(page, true);
    assert.deepEqual(await page.evaluate(() => window.readMoney()), await page.evaluate(() => window.moneyBeforeReset));
    const callbacks = await page.getByLabel('Reset callbacks').textContent();
    await page.getByRole('button', { name: 'Allow reset' }).click();
    await resetAndObserve(page, false);
    await page.waitForFunction(() => document.querySelector('[role="spinbutton"]').value === '$12.50');
    assert.deepEqual(await page.locator('form').evaluate(form => Object.fromEntries(new FormData(form))), {
      uncontrolled: '1250', 'amount-owned': '4500', 'currency-owned': '1250', 'both-owned': '4500',
    });
    assert.deepEqual(await page.getByRole('combobox').allTextContents(), ['USD', 'USD', 'USD', 'USD']);
    assert.equal(await page.getByLabel('Reset callbacks').textContent(), callbacks);
    assert.deepEqual(await page.getByRole('alert').allTextContents(), []);
    assert.ok((await page.locator('[role="status"]').allTextContents()).every(text => text === '' || text === 'Currency: US Dollar'));
  });
});

for (const mode of ['rerender', 'reassociate', 'unmount']) {
  test(`pending native reset ${mode} keeps the correct binding and latest callback`, async () => {
    await withStory('inputs-select--reset-lifecycle', async page => {
      await traceResets(page);
      await page.getByRole('button', { name: mode, exact: true }).click();
      await page.getByRole('textbox', { name: 'Lifecycle input' }).fill('Cherry');
      await resetAndObserve(page, false);
      await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 0)));
      assert.equal(await page.getByLabel('Settled resets').textContent(), mode === 'rerender' ? '[1]' : '[]');
      if (mode === 'reassociate') {
        await page.getByRole('button', { name: 'Reset alternate', exact: true }).click();
        await page.waitForFunction(() => document.querySelector('[aria-label="Settled resets"]').textContent === '[0]');
      }
      if (mode === 'unmount') assert.equal(await page.getByRole('textbox', { name: 'Lifecycle input' }).count(), 0);
    });
  });
}

test('rapid trusted resets retain all pending work across ordinary rerenders', async () => {
  await withStory('inputs-select--reset-lifecycle', async page => {
    await traceResets(page);
    await page.getByRole('button', { name: 'Reset', exact: true }).dblclick();
    await page.waitForFunction(() => JSON.parse(document.querySelector('[aria-label="Settled resets"]').textContent).length === 2);
    const settled = JSON.parse(await page.getByLabel('Settled resets').textContent());
    assert.equal(settled.at(-1), 2);
    assert.deepEqual(await page.evaluate(() => window.resetEvents), [
      { trusted: true, cancelable: true, canceled: false },
      { trusted: true, cancelable: true, canceled: false },
    ]);
  });
});

async function adjacentGeometry(page) {
  return page.getByRole('listbox').evaluate(list => {
    const trigger = document.querySelector('[data-ui="select-trigger"]');
    const active = document.getElementById(trigger.getAttribute('aria-activedescendant'));
    const panel = list.getBoundingClientRect(), anchor = trigger.getBoundingClientRect(), item = active.getBoundingClientRect();
    const hit = document.elementFromPoint(item.left + item.width / 2, item.top + item.height / 2);
    return {
      panel: { top: panel.top, bottom: panel.bottom, left: panel.left, right: panel.right, height: panel.height },
      anchor: { top: anchor.top, bottom: anchor.bottom },
      active: { top: item.top, bottom: item.bottom, text: active.textContent, hit: active === hit || active.contains(hit) },
      stickyInset: parseFloat(getComputedStyle(list).scrollPaddingTop) || 0,
      maximum: getComputedStyle(list).maxBlockSize,
      sizing: list.style.getPropertyValue('max-block-size'),
      viewport: { width: innerWidth, height: innerHeight },
    };
  });
}

function assertAdjacentBounds(geometry) {
  const { panel, anchor, viewport } = geometry;
  assert.ok(panel.bottom <= anchor.top + 1 || panel.top >= anchor.bottom - 1, JSON.stringify(geometry));
  assert.ok(panel.top >= 0 && panel.bottom <= viewport.height + 1, JSON.stringify(geometry));
  assert.ok(panel.left >= 0 && panel.right <= viewport.width + 1, JSON.stringify(geometry));
}

function assertAdjacent(geometry) {
  assertAdjacentBounds(geometry);
  const { panel, active, stickyInset } = geometry;
  assert.ok(active.top >= panel.top + stickyInset - 1 && active.bottom <= panel.bottom + 1, JSON.stringify(geometry));
  assert.ok(active.hit, JSON.stringify(geometry));
}

test('ordinary Select keeps its sticky list adjacent in a short viewport and grows after resize', async () => {
  await withStory('inputs-select--sticky-list', async page => {
    const trigger = page.getByRole('combobox');
    await trigger.click();
    await page.waitForFunction(() => document.querySelector('[role="listbox"]')?.scrollTop > 0);
    const short = await adjacentGeometry(page);
    assert.equal(short.active.text, 'Option 720');
    assertAdjacent(short);
    for (const key of ['Home', 'End']) {
      await trigger.press(key);
      assertAdjacent(await adjacentGeometry(page));
    }
    await page.setViewportSize({ width: 844, height: 900 });
    await page.waitForFunction(height => document.querySelector('[role="listbox"]').getBoundingClientRect().height > height + 1, short.panel.height);
    assertAdjacent(await adjacentGeometry(page));
    await trigger.press('Enter');
    assert.equal(await trigger.textContent(), 'Option 1439');
    assert.ok(await trigger.evaluate(element => element === document.activeElement));
  }, { width: 844, height: 390 });
});

test('composed Select actions and callback history wrap without losing their full text', async () => {
  for (const story of ['composed', 'controlled']) for (const enlarged of [false, true]) {
    await withStory(`inputs-select--${story}`, async page => {
      if (enlarged) await doubleText(page);
      await assertViewportText(page);
      const trigger = page.getByRole('combobox', { name: 'Fruit', exact: true });
      await trigger.click();
      if (enlarged) await doubleText(page);
      await trigger.press('End');
      await trigger.press('Enter');
      assert.equal(await trigger.textContent(), 'Cherry');
      if (story === 'controlled') assert.equal(await page.getByLabel('Callback order').textContent(), 'open:true,value:cherry,open:false');
      await assertViewportText(page);
      await page.getByRole('button', { name: 'After', exact: true }).click();
      assert.ok(await page.getByRole('button', { name: 'After', exact: true }).evaluate(element => document.activeElement === element));
    }, { width: 320, height: 812 });
  }
});

test('ordinary Select respects a smaller composed authored maximum and enlarged RTL text', async () => {
  await withStory('inputs-select--sticky-list', async page => {
    await page.addStyleTag({ content: '[data-ui="select-listbox"] { max-block-size: min(144px, var(--select-available-height, 100vh)); }' });
    await page.evaluate(() => { document.documentElement.dir = 'rtl'; });
    await doubleText(page);
    const trigger = page.getByRole('combobox');
    await trigger.click();
    await page.waitForFunction(() => document.querySelector('[role="listbox"]')?.scrollTop > 0);
    await settleCss(page);
    const short = await adjacentGeometry(page);
    assertAdjacent(short);
    assert.ok(short.panel.height <= 145);
    await page.setViewportSize({ width: 844, height: 900 });
    await page.waitForFunction(() => document.querySelector('[role="listbox"]').getBoundingClientRect().bottom <= innerHeight);
    await settleCss(page);
    const tall = await adjacentGeometry(page);
    assertAdjacent(tall);
    assert.ok(tall.panel.height <= 145);
    await page.getByRole('listbox').evaluate(element => { element.style.maxBlockSize = 'min(112px, var(--select-available-height, 100vh))'; });
    await page.waitForFunction(() => document.querySelector('[role="listbox"]').getBoundingClientRect().height <= 113);
    await settleCss(page);
    assertAdjacent(await adjacentGeometry(page));
    await trigger.press('End');
    assertAdjacent(await adjacentGeometry(page));
    await trigger.press('Enter');
    assert.equal(await trigger.textContent(), 'Option 1439');
  }, { width: 844, height: 390 });
});

for (const story of ['long-list', 'viewport-edge']) {
  test(`ordinary Select at ${story} keeps first and last options adjacent and reachable`, async () => {
    await withStory(`inputs-select--${story}`, async page => {
      const trigger = page.getByRole('combobox');
      await trigger.click();
      await page.getByRole('listbox').waitFor();
      for (const key of ['Home', 'End']) {
        await trigger.press(key);
        assertAdjacent(await adjacentGeometry(page));
      }
      const last = (await adjacentGeometry(page)).active.text;
      await trigger.press('Enter');
      assert.equal(await trigger.textContent(), last);
      assert.ok(await trigger.evaluate(element => element === document.activeElement));
    }, { width: 844, height: 390 });
  });
}

test('an open ordinary Select follows smaller and larger authored maximum updates', async () => {
  await withStory('inputs-select--authored-popup-maximum', async page => {
    await page.getByRole('listbox').waitFor();
    await page.getByRole('button', { name: 'Limit popup', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('[role="listbox"]').getBoundingClientRect().height <= 145, undefined, { timeout: 3000 });
    const limited = await adjacentGeometry(page);
    assertAdjacent(limited);
    await page.getByRole('button', { name: 'Expand popup', exact: true }).click();
    await page.setViewportSize({ width: 844, height: 900 });
    await page.waitForFunction(height => document.querySelector('[role="listbox"]').getBoundingClientRect().height > height + 1, limited.panel.height);
    const expanded = await adjacentGeometry(page);
    assertAdjacent(expanded);
    assert.ok(expanded.panel.height <= 241);
  }, { width: 844, height: 390 });
});

test('empty Select owns a disabled nonselectable option without a phantom active descendant', async () => {
  await withStory('inputs-select--field-states', async page => {
    const trigger = page.getByRole('combobox', { name: 'Empty', exact: true });
    await trigger.click();
    const list = page.getByRole('listbox', { name: 'Empty', exact: true });
    const empty = list.getByRole('option', { name: 'No workspaces', exact: true });
    const require = createRequire(import.meta.url);
    const addon = createRequire(require.resolve('@storybook/addon-a11y/package.json', { paths: [new URL('../../../../../apps/storybook/', import.meta.url).pathname] }));
    await page.addScriptTag({ path: addon.resolve('axe-core/axe.min.js') });
    const violations = await list.evaluate(async node => (await window.axe.run(node)).violations.filter(v => v.impact === 'critical').map(v => ({ id: v.id, nodes: v.nodes.map(n => n.html) })));
    assert.deepEqual(violations, []);
    assert.equal(await empty.getAttribute('aria-disabled'), 'true');
    assert.equal(await empty.getAttribute('aria-selected'), 'false');
    for (const key of ['ArrowDown', 'ArrowUp', 'Home', 'End', 'n']) {
      await trigger.press(key);
      assert.equal(await trigger.getAttribute('aria-activedescendant'), null);
      assert.ok(await trigger.evaluate(node => node === document.activeElement));
    }
    const box = await empty.boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    assert.equal(await trigger.getAttribute('aria-expanded'), 'true');
    assert.equal(await trigger.textContent(), 'Choose a workspace');
    await trigger.press('Enter');
    assert.equal(await trigger.textContent(), 'Choose a workspace');
    await trigger.press('Escape');
    assert.equal(await trigger.getAttribute('aria-expanded'), 'false');
    assert.ok(await trigger.evaluate(node => node === document.activeElement));
  });
});

for (const enlarged of [false, true]) {
test(`trusted Escape closes ColorPicker Format before its native dialog and returns focus in order (${enlarged ? '200% text' : 'normal'})`, async () => {
  await withStory('inputs-colorpicker--default', async page => {
    const opener = page.locator('[data-ui="color-picker"] button').first();
    await opener.click();
    const dialog = page.getByRole('dialog', { name: 'Choose a color' });
    await dialog.waitFor();
    if (enlarged) await doubleText(page);
    await dialog.evaluate(node => {
      window.nativeEvents = [];
      for (const type of ['cancel', 'close']) node.addEventListener(type, event => setTimeout(() => {
        window.nativeEvents.push({ type, trusted: event.isTrusted, prevented: event.defaultPrevented });
      }, 0));
    });
    const format = dialog.getByRole('combobox', { name: 'Format', exact: true });
    await format.click();
    await page.getByRole('listbox', { name: 'Format' }).waitFor();
    if (enlarged) await doubleText(page);
    await format.press('Escape');
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 0)));
    assert.ok(await page.locator('dialog').evaluate(node => node.open), 'first Escape must leave the native parent open');
    assert.equal(await format.getAttribute('aria-expanded'), 'false');
    assert.ok(await format.evaluate(node => node === document.activeElement));
    await page.waitForFunction(() => window.nativeEvents.length === 1);
    assert.deepEqual(await page.evaluate(() => window.nativeEvents), [{ type: 'cancel', trusted: true, prevented: true }]);
    await format.click();
    await format.press('r');
    await format.press('Enter');
    assert.equal(await format.textContent(), 'RGB');
    assert.ok(await dialog.evaluate(node => node.open));
    await format.press('Escape');
    await page.waitForFunction(() => !document.querySelector('dialog')?.open);
    assert.ok(await opener.evaluate(node => node === document.activeElement));
    await page.waitForFunction(() => window.nativeEvents.length === 3);
    assert.deepEqual(await page.evaluate(() => window.nativeEvents), [
      { type: 'cancel', trusted: true, prevented: true },
      { type: 'cancel', trusted: true, prevented: true },
      { type: 'close', trusted: true, prevented: false },
    ]);
  });
});
}

for (const { presentation, enlarged } of [
  { presentation: 'list', enlarged: false },
  { presentation: 'dial', enlarged: false },
  { presentation: 'list', enlarged: true },
]) {
  test(`TimePicker ${presentation} retains adjacent bounds and canonical selection after actual ancestor wheel${enlarged ? ' with 200% RTL text' : ''}`, async () => {
    await withStory(`inputs-timepicker--ancestor-scroll${presentation === 'dial' ? '-dial' : ''}`, async page => {
      const host = page.getByTestId('time-scroll-host');
      const trigger = page.getByRole('combobox', { name: 'Scroll time' });
      if (enlarged) {
        await page.evaluate(() => { document.documentElement.dir = 'rtl'; });
        await doubleText(page);
      }
      await trigger.click();
      await page.getByRole('listbox').waitFor();
      await settleCss(page);
      await host.evaluate(node => {
        window.timeScrollEvents = [];
        window.timeResizeEvents = 0;
        node.addEventListener('scroll', event => window.timeScrollEvents.push({ trusted: event.isTrusted, top: node.scrollTop }));
        addEventListener('resize', () => window.timeResizeEvents++);
      });
      const check = presentation === 'list' ? assertAdjacent : assertAdjacentBounds;
      const before = await adjacentGeometry(page);
      check(before);
      const panel = await page.getByRole('listbox').elementHandle();
      const dialSize = presentation === 'dial' ? await page.locator('[data-ui="time-picker-dial"]').evaluate(node => ({ width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height })) : undefined;
      const bounds = await host.boundingBox();
      const point = { x: bounds.x + bounds.width - 20, y: bounds.y + bounds.height - 30 };
      assert.ok(await host.evaluate((node, point) => node.contains(document.elementFromPoint(point.x, point.y)) && !document.elementFromPoint(point.x, point.y).closest('[role="listbox"]'), point));
      await page.mouse.move(point.x, point.y);
      await page.mouse.wheel(0, 140);
      await page.waitForFunction(() => window.timeScrollEvents.length > 0);
      await settleCss(page);
      const after = await adjacentGeometry(page);
      check(after);
      assert.ok(after.anchor.top < before.anchor.top);
      assert.equal(await page.getByRole('listbox').evaluate((node, original) => node === original, panel), true);
      assert.equal(await trigger.getAttribute('aria-expanded'), 'true');
      assert.equal(await page.evaluate(() => window.timeResizeEvents), 0);
      assert.ok((await page.evaluate(() => window.timeScrollEvents)).every(event => event.trusted));
      assert.equal(await page.getByLabel('Scroll time changes').textContent(), '[]');
      if (dialSize) assert.deepEqual(await page.locator('[data-ui="time-picker-dial"]').evaluate(node => ({ width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height })), dialSize);
      for (const key of ['Home', 'End']) {
        await trigger.press(key);
        check(await adjacentGeometry(page));
      }
      await trigger.press('Enter');
      assert.equal(await trigger.textContent(), '23:45');
      assert.equal(await page.locator('input[name="scroll-time"]').inputValue(), '23:45');
      assert.equal(await page.getByLabel('Scroll time changes').textContent(), '["23:45"]');
      assert.ok(await trigger.evaluate(node => node === document.activeElement));
    }, { width: 844, height: 390 });
  });
}

test('TimePicker content adapter keeps off-step seeding, capture veto, RTL and trigger width after resize', async () => {
  await withStory('inputs-timepicker--available-space-adapter', async page => {
    const trigger = page.getByRole('combobox', { name: 'Start time' });
    await trigger.click();
    const popup = page.getByTestId('time-content-adapter');
    await popup.waitFor();
    assert.equal(await popup.getAttribute('data-consumer-ref'), 'attached');
    assert.equal(await popup.getAttribute('dir'), 'rtl');
    assert.equal(await trigger.textContent(), '9:07');
    assert.ok((await adjacentGeometry(page)).active.text.includes('9:15'));
    assert.equal(await popup.locator('[aria-selected="true"]').count(), 0);
    const active = await trigger.getAttribute('aria-activedescendant');
    await trigger.press('End');
    assert.equal(await trigger.getAttribute('aria-activedescendant'), active);
    const widths = [];
    for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      await settleCss(page);
      await page.waitForFunction(() => {
        const trigger = document.querySelector('[role="combobox"]'), popup = document.querySelector('[role="listbox"]');
        return Math.abs(trigger.getBoundingClientRect().width - popup.getBoundingClientRect().width) < 1;
      });
      const geometry = await adjacentGeometry(page);
      assertAdjacent(geometry);
      widths.push(await trigger.evaluate(node => node.getBoundingClientRect().width));
      assert.equal(await popup.getAttribute('dir'), 'rtl');
    }
    assert.ok(widths[1] > widths[0]);
    assert.equal(widths[0], widths[2]);
    await trigger.press('Home');
    assertAdjacent(await adjacentGeometry(page));
    await trigger.press('Enter');
    assert.equal(await page.locator('input[name="adapted-time"]').inputValue(), '00:00');
    assert.ok(await trigger.evaluate(node => node === document.activeElement));
  });
});

test('TimePicker portrait dial retains virtual focus, keyboard selection and pointer commitment', async () => {
  await withStory('inputs-timepicker--dial', async page => {
    const trigger = page.getByRole('combobox', { name: 'Start time' });
    await trigger.click();
    await page.getByRole('listbox').waitFor();
    assertAdjacentBounds(await adjacentGeometry(page));
    assert.ok((await adjacentGeometry(page)).active.hit);
    await trigger.press('Home');
    assert.ok((await adjacentGeometry(page)).active.text.includes('0:00'));
    await trigger.press('End');
    assertAdjacent(await adjacentGeometry(page));
    await trigger.press('Enter');
    assert.equal(await trigger.textContent(), '23:45');
    assert.ok(await trigger.evaluate(node => node === document.activeElement));
    await trigger.click();
    const dial = page.locator('[data-ui="time-picker-dial"]');
    await dial.waitFor();
    assert.equal(await dial.getAttribute('aria-hidden'), 'true');
    const box = await dial.boundingBox();
    await page.mouse.click(box.x + box.width * 0.9, box.y + box.height / 2);
    await page.waitForFunction(() => document.querySelector('[role="combobox"]').getAttribute('aria-expanded') === 'false');
    assert.equal(await trigger.textContent(), '6:00');
    assert.ok(await trigger.evaluate(node => node === document.activeElement));
  });
});

for (const rejected of [false, true]) {
  test(`dynamic empty Select preserves slot content, registry navigation, and ${rejected ? 'rejected' : 'accepted'} payload`, async () => {
    await withStory(`inputs-select--${rejected ? 'rejected-empty' : 'dynamic-empty'}`, async page => {
      const trigger = page.getByRole('combobox', { name: 'Dynamic workspace' });
      const list = page.getByRole('listbox', { name: 'Dynamic workspace' });
      const empty = page.getByTestId('forwarded-empty');
      await empty.waitFor();
      const id = await empty.getAttribute('id');
      assert.ok(id);
      assert.equal(await empty.textContent(), 'No workspaces');
      assert.equal(await empty.getAttribute('aria-label'), 'No workspaces available');
      assert.equal(await empty.getAttribute('role'), 'option');
      await trigger.press('n');
      assert.equal(await trigger.getAttribute('aria-activedescendant'), null);
      assert.equal(await page.getByLabel('Selection history').textContent(), '[]');
      await page.getByRole('button', { name: 'Toggle options' }).click();
      await list.getByRole('option', { name: 'Apple', exact: true }).waitFor();
      assert.equal(await empty.count(), 0);
      await trigger.press('Home');
      assert.equal(await trigger.evaluate(node => document.getElementById(node.getAttribute('aria-activedescendant'))?.textContent), 'Apple');
      await trigger.press('End');
      await trigger.press('Enter');
      assert.equal(await page.getByLabel('Selection history').textContent(), '["cherry"]');
      assert.equal(await trigger.textContent(), rejected ? 'Choose a workspace' : 'Cherry');
      assert.equal(await page.locator('form').evaluate(form => new FormData(form).get('workspace')), rejected ? 'missing' : 'cherry');
      await page.getByRole('button', { name: 'Toggle options' }).click();
      await empty.waitFor();
      assert.equal(await empty.getAttribute('id'), id);
      await trigger.press('Home');
      assert.equal(await trigger.getAttribute('aria-activedescendant'), null);
      assert.equal(await page.getByLabel('Selection history').textContent(), '["cherry"]');
    });
  });
}

async function escapeEvents(page) {
  return JSON.parse(await page.getByLabel('Escape events').textContent());
}

for (const child of ['Fruit', 'Search fruit', 'Fruit actions']) {
  test(`native Dialog handles trusted ${child} Escape before parent cancellation`, async () => {
    await withStory('surfaces-dialog--child-escape', async page => {
      const opener = page.getByRole('button', { name: 'Open child Escape dialog' });
      await opener.click();
      const dialog = page.getByRole('dialog', { name: 'Child Escape dialog' });
      const trigger = child === 'Fruit actions' ? dialog.getByRole('button', { name: child }) : dialog.getByRole('combobox', { name: child, exact: true });
      await trigger.click();
      if (child === 'Search fruit') await trigger.press('ArrowDown');
      const popup = child === 'Fruit actions' ? page.getByRole('menu') : page.getByRole('listbox', { name: child, exact: true });
      await popup.waitFor();
      await page.keyboard.press('Escape');
      await popup.waitFor({ state: 'hidden' });
      assert.ok(await dialog.evaluate(node => node.open));
      assert.ok(await trigger.evaluate(node => node === document.activeElement));
      assert.deepEqual((await escapeEvents(page)).filter(event => event.startsWith('parent:')), ['parent:true']);
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('dialog')?.open);
      assert.ok(await opener.evaluate(node => node === document.activeElement));
      await page.waitForFunction(() => JSON.parse(document.querySelector('[aria-label="Escape events"]').textContent).includes('close'));
      const events = await escapeEvents(page);
      assert.deepEqual(events.filter(event => event.startsWith('cancel:')), ['cancel:true', 'cancel:false']);
      assert.deepEqual(events.filter(event => event.startsWith('parent:')), ['parent:true', 'parent:false']);
      assert.equal(events.filter(event => event === 'close').length, 1);
      if (child === 'Fruit') assert.deepEqual(events, ['parent:true', 'child:true', 'child:false', 'cancel:true', 'cancel:false', 'parent:false', 'close']);
    });
  });
}

test('native Dialog deepest child precedes popover and parent; focus and backward traversal stay contained', async () => {
  await withStory('surfaces-dialog--child-escape', async page => {
    const opener = page.getByRole('button', { name: 'Open child Escape dialog' });
    await opener.click();
    const dialog = page.getByRole('dialog', { name: 'Child Escape dialog' });
    const more = dialog.getByRole('button', { name: 'More fruit', exact: true });
    await more.click();
    const popover = page.getByRole('dialog', { name: 'More fruit', exact: true });
    const nested = popover.getByRole('combobox', { name: 'Nested fruit' });
    await nested.click();
    await page.getByRole('listbox', { name: 'Nested fruit' }).waitFor();
    await nested.press('Escape');
    assert.ok(await nested.evaluate(node => node === document.activeElement));
    assert.ok(await popover.isVisible());
    assert.ok(await dialog.evaluate(node => node.open));
    await nested.press('Escape');
    await popover.waitFor({ state: 'hidden' });
    assert.ok(await more.evaluate(node => node === document.activeElement));
    for (const key of ['Tab', 'Shift+Tab', 'Shift+Tab', 'Tab']) {
      await page.keyboard.press(key);
      assert.ok(await dialog.evaluate(node => node.contains(document.activeElement)));
    }
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('dialog')?.open);
    assert.ok(await opener.evaluate(node => node === document.activeElement));
    assert.deepEqual((await escapeEvents(page)).filter(event => event.startsWith('parent:')), ['parent:true', 'parent:false']);
  });
});

for (const mode of ['child-escape-rejected', 'parent-escape-rejected', 'child-escape-cancel-veto']) {
  test(`native Dialog keeps ${mode} truthful across trusted Escape requests`, async () => {
    await withStory(`surfaces-dialog--${mode}`, async page => {
      await page.getByRole('button', { name: 'Open child Escape dialog' }).click();
      const dialog = page.getByRole('dialog', { name: 'Child Escape dialog' });
      const trigger = dialog.getByRole('combobox', { name: 'Fruit', exact: true });
      await trigger.click();
      await page.getByRole('listbox', { name: 'Fruit', exact: true }).waitFor();
      await trigger.press('Escape');
      assert.ok(await dialog.evaluate(node => node.open));
      assert.equal(await trigger.getAttribute('aria-expanded'), mode === 'child-escape-rejected' ? 'true' : 'false');
      await trigger.press('Escape');
      assert.ok(await dialog.evaluate(node => node.open));
      const events = await escapeEvents(page);
      assert.equal(events.filter(event => event === 'close').length, 0);
      assert.deepEqual(events.filter(event => event.startsWith('parent:')), mode === 'parent-escape-rejected' ? ['parent:true', 'parent:false'] : ['parent:true']);
      assert.deepEqual(events.filter(event => event.startsWith('cancel:')), mode === 'child-escape-rejected' ? ['cancel:true', 'cancel:true'] : ['cancel:true', 'cancel:false']);
    });
  });
}

test('native Dialog ignores closed persistent portals and preserves pointer dismissal and explicit native requests', async () => {
  await withStory('surfaces-dialog--child-escape', async page => {
    const opener = page.getByRole('button', { name: 'Open child Escape dialog' });
    await opener.click();
    const dialog = page.getByRole('dialog', { name: 'Child Escape dialog' });
    const trigger = dialog.getByRole('combobox', { name: 'Fruit', exact: true });
    await trigger.click();
    await page.getByRole('option', { name: 'Cherry', exact: true }).click();
    assert.equal(await trigger.textContent(), 'Cherry');
    assert.ok(await dialog.evaluate(node => node.open));
    await trigger.click();
    await dialog.getByRole('textbox', { name: 'Parent field' }).click();
    assert.equal(await trigger.getAttribute('aria-expanded'), 'false');
    assert.ok(await dialog.evaluate(node => node.open));
    await dialog.getByRole('textbox', { name: 'Parent field' }).press('Escape');
    await page.waitForFunction(() => !document.querySelector('dialog')?.open);
    assert.ok(await opener.evaluate(node => node === document.activeElement));
    await opener.click();
    await dialog.getByRole('button', { name: 'Close parent', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('dialog')?.open);
    assert.ok(await opener.evaluate(node => node === document.activeElement));
  });
});

test('native Dialog leaves composition Escape to its input before ordinary child and parent dismissal', async () => {
  await withStory('surfaces-dialog--child-escape', async page => {
    await page.getByRole('button', { name: 'Open child Escape dialog' }).click();
    const dialog = page.getByRole('dialog', { name: 'Child Escape dialog' });
    const input = dialog.getByRole('combobox', { name: 'Search fruit' });
    await input.click();
    await input.press('ArrowDown');
    await page.getByRole('listbox', { name: 'Search fruit' }).waitFor();
    await input.dispatchEvent('compositionstart');
    await input.press('Escape');
    assert.equal(await input.getAttribute('aria-expanded'), 'true');
    assert.ok(await dialog.evaluate(node => node.open));
    await input.dispatchEvent('compositionend');
    await input.press('Escape');
    assert.equal(await input.getAttribute('aria-expanded'), 'false');
    assert.ok(await dialog.evaluate(node => node.open));
    await input.press('Escape');
    await page.waitForFunction(() => !document.querySelector('dialog')?.open);
  });
});

for (const contained of [false, true]) {
  test(`DialogStack ${contained ? 'contained' : 'native'} pops only after its child trusted Escape`, async () => {
    await withStory(`surfaces-dialogstack--nested-popover${contained ? '-contained' : ''}`, async page => {
      const opener = page.getByRole('button', { name: 'Settings', exact: true });
      await opener.click();
      const shell = page.getByRole('dialog', { name: 'Settings', exact: true });
      const member = shell.getByRole('button', { name: 'Member options' });
      await member.click();
      const popover = page.getByRole('dialog', { name: 'Member options', exact: true });
      await popover.waitFor();
      await page.keyboard.press('Escape');
      await popover.waitFor({ state: 'hidden' });
      assert.ok(await shell.isVisible());
      assert.ok(await member.evaluate(node => node === document.activeElement));
      await page.keyboard.press('Escape');
      await shell.waitFor({ state: 'hidden' });
      assert.ok(await opener.evaluate(node => node === document.activeElement));
    }, { width: 768, height: 900 });
  });
}

test('native Dialog does not assign another Escape to an inert retained floating exit', async () => {
  await withStory('surfaces-dialog--child-escape', async page => {
    const opener = page.getByRole('button', { name: 'Open child Escape dialog' });
    await opener.click();
    const dialog = page.getByRole('dialog', { name: 'Child Escape dialog' });
    const trigger = dialog.getByRole('button', { name: 'Fruit details' });
    await trigger.click();
    await page.getByRole('dialog', { name: 'Fruit details' }).evaluate(async node => {
      node.getBoundingClientRect();
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      await Promise.allSettled(node.getAnimations({ subtree: true }).map(animation => animation.finished));
    });
    await page.keyboard.press('Escape');
    const retained = page.locator('[data-ui="morph-surface"]');
    assert.equal(await retained.getAttribute('data-state'), 'closing');
    assert.ok(await retained.evaluate(node => node.inert));
    assert.ok(await dialog.evaluate(node => node.open));
    assert.ok(await trigger.evaluate(node => node === document.activeElement));
    await trigger.press('Escape');
    await page.waitForFunction(() => !document.querySelector('dialog')?.open);
    assert.ok(await opener.evaluate(node => node === document.activeElement));
  }, { width: 390, height: 844 }, 'no-preference');
});

test('native Dialog preserves a rejected sibling popup after the focused menu Escape', async () => {
  await withStory('surfaces-dialog--child-escape-rejected', async page => {
    await page.getByRole('button', { name: 'Open child Escape dialog' }).click();
    const dialog = page.getByRole('dialog', { name: 'Child Escape dialog' });
    const select = dialog.getByRole('combobox', { name: 'Fruit', exact: true });
    await select.click();
    await dialog.getByRole('button', { name: 'Fruit actions' }).click();
    await page.getByRole('menu').waitFor();
    assert.equal(await select.getAttribute('aria-expanded'), 'true');
    await page.keyboard.press('Escape');
    await page.getByRole('menu').waitFor({ state: 'hidden' });
    assert.equal(await select.getAttribute('aria-expanded'), 'true');
    assert.ok(await dialog.evaluate(node => node.open));
    assert.deepEqual((await escapeEvents(page)).filter(event => event.startsWith('parent:')), ['parent:true']);
  });
});

test('DialogStack trusted nested native cancellation closes only its own modal then permits a stack pop', async () => {
  await withStory('surfaces-dialogstack--nested-dialog', async page => {
    const opener = page.getByRole('button', { name: 'Settings', exact: true });
    await opener.click();
    const shell = page.getByRole('dialog', { name: 'Settings', exact: true });
    const nestedTrigger = shell.getByRole('button', { name: 'Reset workspace', exact: true });
    await nestedTrigger.click();
    const nested = page.getByRole('dialog', { name: 'Reset workspace?', exact: true });
    await nested.waitFor();
    await page.keyboard.press('Escape');
    await nested.waitFor({ state: 'hidden' });
    assert.ok(await shell.evaluate(node => node.open));
    assert.ok(await nestedTrigger.evaluate(node => node === document.activeElement));
    await page.keyboard.press('Escape');
    await shell.waitFor({ state: 'hidden' });
    assert.ok(await opener.evaluate(node => node === document.activeElement));
  }, { width: 768, height: 900 });
});

async function retainedEvents(page) {
  return JSON.parse(await page.getByLabel('Retained child events').textContent());
}

async function observeRetainedNativeEvents(page) {
  await page.evaluate(() => {
    window.retainedNativeEvents = [];
    for (const type of ['cancel', 'close']) document.addEventListener(type, event => {
      const owner = event.target.getAttribute('data-escape-owner');
      setTimeout(() => window.retainedNativeEvents.push({ type, owner, trusted: event.isTrusted, prevented: event.defaultPrevented }), 0);
    }, true);
  });
}

test('a retained controlled-open Select inside a closed native dialog cannot veto outer trusted Escape', async () => {
  await withStory('surfaces-dialog--retained-native-child-escape', async page => {
    await observeRetainedNativeEvents(page);
    const opener = page.getByRole('button', { name: 'Open outer', exact: true });
    const outer = page.locator('dialog[data-escape-owner="outer"]');
    await page.waitForFunction(() => document.querySelector('dialog[data-escape-owner="outer"]')?.open);
    await outer.getByRole('button', { name: 'Open inner', exact: true }).click();
    const inner = page.locator('dialog[data-escape-owner="inner"]');
    const select = inner.getByRole('combobox', { name: 'Retained fruit', exact: true });
    await select.click();
    await select.press('Escape');
    await page.waitForFunction(() => window.retainedNativeEvents.some(e => e.owner === 'inner' && e.type === 'cancel'));
    assert.ok(await inner.evaluate(node => node.open));
    assert.ok(await outer.evaluate(node => node.open));
    assert.equal(await select.getAttribute('aria-expanded'), 'true');
    assert.ok((await retainedEvents(page)).some(event => event.type === 'select-request' && event.open === false && event.accepted === false));
    assert.equal((await retainedEvents(page)).filter(event => event.type === 'inner-request' && event.open === false).length, 0);
    await inner.getByRole('button', { name: 'Close inner', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('dialog[data-escape-owner="inner"]').open);
    assert.ok(await outer.getByRole('button', { name: 'Open inner', exact: true }).evaluate(node => node === document.activeElement));
    const branch = await inner.evaluate(node => {
      const trigger = node.querySelector('[role="combobox"]'), popup = node.querySelector('[role="listbox"]');
      return { open: node.open, display: getComputedStyle(node).display, hidden: node.hidden, inert: node.inert,
        expanded: trigger.getAttribute('aria-expanded'), triggerRects: trigger.getClientRects().length,
        popupRects: popup.getClientRects().length, containsPopup: node.contains(popup) };
    });
    assert.deepEqual(branch, { open: false, display: 'none', hidden: false, inert: false, expanded: 'true', triggerRects: 0, popupRects: 0, containsPopup: true });
    const action = outer.getByRole('button', { name: 'Outer action', exact: true });
    await action.click();
    assert.ok(await action.evaluate(node => node === document.activeElement));
    await action.press('Escape');
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.waitForFunction(() => document.querySelector('dialog[data-escape-owner="outer"]').getAttribute('data-state') !== 'closing');
    assert.equal(await outer.evaluate(node => node.open), false, 'inactive retained child must not veto the outer close request');
    assert.ok(await outer.evaluate(node => !node.contains(document.activeElement)));
    await page.waitForFunction(() => window.retainedNativeEvents.some(e => e.owner === 'outer' && e.type === 'close'));
    const events = await retainedEvents(page);
    assert.equal(events.filter(event => event.type === 'outer-request' && event.open === false).length, 1);
    assert.equal(events.filter(event => event.type === 'close' && event.owner === 'outer' && event.own).length, 1);
    assert.deepEqual(events.filter(event => event.type === 'cancel' && event.owner === 'outer' && event.own).map(event => event.prevented), [false]);
    assert.deepEqual((await page.evaluate(() => window.retainedNativeEvents)).filter(event => event.owner === 'outer').map(({ type, trusted }) => ({ type, trusted })), [
      { type: 'cancel', trusted: true }, { type: 'close', trusted: true },
    ]);
    await opener.click();
    await outer.getByRole('button', { name: 'Close outer', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('dialog[data-escape-owner="outer"]').open);
    assert.ok(await opener.evaluate(node => node === document.activeElement));
  }, { width: 1024, height: 900 });
});

for (const branch of ['hidden-branch-child', 'outer-alone']) {
  test(`${branch} permits outer trusted Escape and normal focus return`, async () => {
    await withStory(`surfaces-dialog--${branch}-escape`, async page => {
      await observeRetainedNativeEvents(page);
      const opener = page.getByRole('button', { name: 'Open outer', exact: true });
      const outer = page.locator('dialog[data-escape-owner="outer"]');
      await page.waitForFunction(() => document.querySelector('dialog[data-escape-owner="outer"]')?.open);
      if (branch === 'hidden-branch-child') {
        const select = outer.getByRole('combobox', { name: 'Retained fruit' });
        await select.click();
        await select.press('Escape');
        assert.equal(await select.getAttribute('aria-expanded'), 'true');
        assert.ok(await outer.evaluate(node => node.open));
        const hide = outer.getByRole('button', { name: 'Hide retained child' });
        assert.ok(await hide.evaluate(node => {
          const action = node.getBoundingClientRect();
          const popup = node.closest('dialog').querySelector('[role="listbox"]').getBoundingClientRect();
          return action.bottom <= popup.top || action.top >= popup.bottom
            || action.right <= popup.left || action.left >= popup.right;
        }), 'the retained popup must not cover the fixture action');
        await hide.click();
        assert.deepEqual(await outer.locator('[role="combobox"]').evaluate(node => ({ expanded: node.getAttribute('aria-expanded'), hidden: Boolean(node.closest('[hidden]')), rects: node.getClientRects().length })), { expanded: 'true', hidden: true, rects: 0 });
      }
      const priorRequests = (await retainedEvents(page)).filter(event => event.type === 'outer-request' && event.open === false).length;
      await outer.getByRole('button', { name: 'Outer action', exact: true }).click();
      await page.keyboard.press('Escape');
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await page.waitForFunction(() => document.querySelector('dialog[data-escape-owner="outer"]').getAttribute('data-state') !== 'closing');
      assert.equal(await outer.evaluate(node => node.open), false);
      assert.ok(await outer.evaluate(node => !node.contains(document.activeElement)));
      assert.equal((await retainedEvents(page)).filter(event => event.type === 'outer-request' && event.open === false).length, priorRequests + 1);
      assert.ok((await page.evaluate(() => window.retainedNativeEvents)).some(event => event.owner === 'outer' && event.type === 'cancel' && event.trusted));
    }, { width: 1024, height: 900 });
  });
}

async function settleCss(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await new Promise(resolve => setTimeout(resolve, 0));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

test('raw authored CSS maximum stays reactive to ancestor-variable changes without resize or reopening', async () => {
  await withStory('inputs-select--sticky-list', async page => {
    const rule = '[data-ui="select-listbox"] { max-block-size: var(--qa-popup-max); }';
    const stylesheet = await page.addStyleTag({ content: rule });
    await page.evaluate(() => {
      document.documentElement.style.setProperty('--qa-popup-max', '240px');
      window.qaPanel = document.querySelector('[data-ui="select-listbox"]');
      window.qaClassName = window.qaPanel.className;
      window.qaResizeEvents = 0;
      addEventListener('resize', () => window.qaResizeEvents++);
    });
    const panel = page.locator('[data-ui="select-listbox"]');
    assert.equal(await panel.evaluate(node => node.style.maxBlockSize), '');
    assert.equal(await panel.evaluate(node => getComputedStyle(node).maxBlockSize), '240px');
    const trigger = page.getByRole('combobox');
    await trigger.press('ArrowDown');
    await page.getByRole('listbox').waitFor();
    await settleCss(page);
    const reference = await trigger.boundingBox();
    const scroll = await page.evaluate(() => [scrollX, scrollY]);
    assert.equal((await adjacentGeometry(page)).active.text, 'Option 720');
    for (const height of [240, 96, 360, 240]) {
      await page.evaluate(value => document.documentElement.style.setProperty('--qa-popup-max', `${value}px`), height);
      await settleCss(page);
      const geometry = await adjacentGeometry(page);
      assert.ok(Math.abs(geometry.panel.height - height) <= 1, `Expected used height ${height}, got ${geometry.panel.height}`);
      assertAdjacent(geometry);
      assert.equal(await trigger.getAttribute('aria-expanded'), 'true');
      assert.deepEqual(await trigger.boundingBox(), reference);
      assert.deepEqual(await page.evaluate(() => [scrollX, scrollY]), scroll);
      assert.equal(await panel.evaluate(node => node === window.qaPanel && node.className === window.qaClassName), true);
      assert.equal(await page.evaluate(() => window.qaResizeEvents), 0);
    }
    assert.equal(await stylesheet.textContent(), rule);
    assert.equal(await panel.evaluate(node => node.style.maxBlockSize), '');
    for (const key of ['Home', 'End']) {
      await trigger.press(key);
      assertAdjacent(await adjacentGeometry(page));
    }
    await trigger.press('Enter');
    assert.equal(await trigger.textContent(), 'Option 1439');
    assert.ok(await trigger.evaluate(node => node === document.activeElement));
  }, { width: 844, height: 900 });
});

async function assertAvailableHeightData(page) {
  const geometry = await adjacentGeometry(page);
  const value = await page.getByRole('listbox').evaluate(node => node.style.getPropertyValue('--select-available-height'));
  assert.match(value, /^\d+(?:\.\d+)?px$/);
  const height = Number.parseFloat(value);
  const viewportPadding = 8;
  const adjacent = geometry.panel.top >= geometry.anchor.bottom - 1
    ? geometry.viewport.height - viewportPadding - geometry.panel.top
    : geometry.panel.bottom - viewportPadding;
  assert.ok(Math.abs(height - adjacent) <= 1, JSON.stringify({ value, adjacent, geometry }));
  assertAdjacent(geometry);
  return { geometry, height };
}

for (const enlarged of [false, true]) {
  test(`composed CSS maximum bounds live variable/calc limits and grows again (${enlarged ? '200% RTL' : 'normal'})`, async () => {
    await withStory('inputs-select--sticky-list', async page => {
      const expression = 'min(calc(var(--qa-popup-unit) * var(--qa-popup-count)), var(--select-available-height, 100vh))';
      const rule = `[data-ui="select-listbox"] { max-block-size: ${expression} !important; }`;
      const stylesheet = await page.addStyleTag({ content: rule });
      await page.evaluate(rtl => {
        document.documentElement.dir = rtl ? 'rtl' : 'ltr';
        document.documentElement.style.setProperty('--qa-popup-unit', '48px');
        document.documentElement.style.setProperty('--qa-popup-count', '10');
        window.qaComposedPanel = document.querySelector('[data-ui="select-listbox"]');
        window.qaComposedResizes = 0;
        addEventListener('resize', () => window.qaComposedResizes++);
      }, enlarged);
      if (enlarged) await doubleText(page);
      const trigger = page.getByRole('combobox');
      await trigger.click();
      if (enlarged) await doubleText(page);
      await settleCss(page);
      const initial = await assertAvailableHeightData(page);
      assert.equal(initial.geometry.active.text, 'Option 720');
      assert.ok(initial.height < 480);
      assert.ok(Math.abs(initial.geometry.panel.height - initial.height) <= 1);
      for (const count of [enlarged ? 3 : 2, 8]) {
        await page.evaluate(value => document.documentElement.style.setProperty('--qa-popup-count', String(value)), count);
        await settleCss(page);
        const current = await assertAvailableHeightData(page);
        assert.ok(Math.abs(current.geometry.panel.height - Math.min(48 * count, current.height)) <= 1);
        assert.equal(await page.evaluate(() => window.qaComposedResizes), 0);
        assert.equal(await page.getByRole('listbox').evaluate(node => node === window.qaComposedPanel), true);
      }
      assert.equal(await stylesheet.textContent(), rule);
      const declared = await page.getByRole('listbox').evaluate((node, maximum) => {
        node.style.setProperty('max-block-size', maximum, 'important');
        node.style.setProperty('letter-spacing', '0.25px');
        return { maximum: node.style.getPropertyValue('max-block-size'), priority: node.style.getPropertyPriority('max-block-size'), spacing: node.style.letterSpacing };
      }, expression);
      await page.evaluate(() => document.documentElement.style.setProperty('--qa-popup-count', '10'));
      await page.setViewportSize({ width: 844, height: 900 });
      await settleCss(page);
      const grown = await assertAvailableHeightData(page);
      assert.ok(grown.geometry.panel.height > initial.geometry.panel.height + 1);
      assert.ok(Math.abs(grown.geometry.panel.height - Math.min(480, grown.height)) <= 1);
      assert.deepEqual(await page.getByRole('listbox').evaluate(node => ({ maximum: node.style.getPropertyValue('max-block-size'), priority: node.style.getPropertyPriority('max-block-size'), spacing: node.style.letterSpacing })), declared);
      for (const key of ['Home', 'End']) {
        await trigger.press(key);
        assertAdjacent(await adjacentGeometry(page));
      }
      await trigger.press('Enter');
      assert.equal(await trigger.textContent(), 'Option 1439');
      assert.ok(await trigger.evaluate(node => node === document.activeElement));
      assert.deepEqual(await page.locator('[data-ui="select-listbox"]').evaluate(node => ({ maximum: node.style.getPropertyValue('max-block-size'), priority: node.style.getPropertyPriority('max-block-size'), spacing: node.style.letterSpacing })), declared);
      assert.equal(await page.locator('[data-ui="select-listbox"]').evaluate(node => node.style.getPropertyValue('--select-available-height')), '');
    }, { width: 844, height: 390 });
  });
}

test('available-height data stays on the public Content ref and is cleared on close, morph, and unmount', async () => {
  await withStory('inputs-select--content-sizing-lifecycle', async page => {
    await page.evaluate(() => document.documentElement.style.setProperty('--select-available-height', '1px'));
    const content = page.getByTestId('sizing-content');
    await content.waitFor({ state: 'attached' });
    assert.equal(await page.getByLabel('Content ref').textContent(), 'sizing-content');
    assert.equal(await content.evaluate(node => node.style.getPropertyValue('--select-available-height')), '');
    assert.equal(await content.evaluate(node => getComputedStyle(node).getPropertyValue('--select-available-height').trim()), '');
    await page.getByRole('button', { name: 'Open popup', exact: true }).click();
    await settleCss(page);
    assert.ok(Number.parseFloat(await content.evaluate(node => node.style.getPropertyValue('--select-available-height'))) > 1);
    assert.ok((await content.boundingBox()).height < 280, 'short content must not stretch to its maximum');
    assert.equal(await content.evaluate(node => node.style.letterSpacing), '0.25px');
    assert.equal(await content.evaluate(node => node.style.maxBlockSize), '');
    const handle = await content.elementHandle();
    await page.getByRole('button', { name: 'Change presentation' }).click();
    await settleCss(page);
    assert.equal(await content.evaluate((node, original) => node === original, handle), true);
    assert.equal(await content.getAttribute('data-variant'), 'morph');
    assert.equal(await content.evaluate(node => node.style.getPropertyValue('--select-available-height')), '');
    assert.equal(await content.evaluate(node => getComputedStyle(node).getPropertyValue('--select-available-height').trim()), '');
    assert.ok((await content.boundingBox()).height > 1, 'morph must not inherit an adjacent cap');
    await page.getByRole('button', { name: 'Change presentation' }).click();
    await settleCss(page);
    assert.ok(Number.parseFloat(await content.evaluate(node => node.style.getPropertyValue('--select-available-height'))) > 1);
    await page.getByRole('button', { name: 'Close popup', exact: true }).click();
    await settleCss(page);
    assert.equal(await content.evaluate(node => node.style.getPropertyValue('--select-available-height')), '');
    assert.equal(await content.evaluate(node => node.style.letterSpacing), '0.25px');
    await page.getByRole('button', { name: 'Open popup', exact: true }).click();
    await settleCss(page);
    await page.getByRole('button', { name: 'Unmount picker' }).click();
    assert.equal(await handle.evaluate(node => node.isConnected), false);
    assert.equal(await handle.evaluate(node => node.style.getPropertyValue('--select-available-height')), '');
    assert.equal(await page.getByLabel('Content ref').textContent(), 'none');
  });
});

async function drawerOwnerEvents(page) {
  return JSON.parse(await page.getByLabel('Drawer owner events').textContent());
}

async function assertDrawerActionReachable(control) {
  const geometry = await control.evaluate(node => {
    const rect = node.getBoundingClientRect(), x = rect.x + rect.width / 2, y = rect.y + rect.height / 2;
    const hit = document.elementFromPoint(x, y);
    return { text: node.textContent, top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right,
      width: rect.width, height: rect.height, viewport: { width: innerWidth, height: innerHeight }, hit: hit === node || node.contains(hit) };
  });
  assert.ok(geometry.top >= 0 && geometry.bottom <= geometry.viewport.height && geometry.left >= 0 && geometry.right <= geometry.viewport.width && geometry.hit, JSON.stringify(geometry));
}

for (const { child, width, enlarged } of [
  { child: true, width: 390, enlarged: false },
  { child: false, width: 390, enlarged: false },
  { child: true, width: 320, enlarged: true },
]) {
  test(`native Drawer ${child ? 'ignores a retained hidden child' : 'alone accepts closure'} after trusted Escape${enlarged ? ' at 320px with 200% text' : ''}`, async () => {
    await withStory(`surfaces-drawer--${child ? 'hidden-native-owner' : 'native-owner-alone'}`, async page => {
      await observeRetainedNativeEvents(page);
      const opener = page.getByRole('button', { name: 'Open owner drawer', exact: true });
      await settleCss(page);
      await opener.press('Enter');
      const drawer = page.locator('dialog[data-escape-owner="drawer"]');
      await settleCss(page);
      assert.ok(await drawer.evaluate(node => node.open), JSON.stringify(await drawerOwnerEvents(page)));
      await page.waitForFunction(() => document.querySelector('dialog[data-escape-owner="drawer"]')?.open);
      if (enlarged) {
        await doubleText(page);
        await settleCss(page);
      }
      if (child) {
        const select = drawer.getByRole('combobox', { name: 'Drawer fruit' });
        await assertDrawerActionReachable(select);
        await select.click();
        await select.press('Escape');
        await page.waitForFunction(() => window.retainedNativeEvents.some(event => event.type === 'cancel'));
        await settleCss(page);
        assert.equal(await select.getAttribute('aria-expanded'), 'true');
        assert.ok(await drawer.evaluate(node => node.open));
        assert.ok((await drawerOwnerEvents(page)).some(event => event.type === 'select-request' && event.open === false && event.accepted === false));
        assert.equal((await drawerOwnerEvents(page)).filter(event => event.type === 'drawer-request' && event.open === false).length, 0);
        assert.equal((await drawerOwnerEvents(page)).filter(event => event.type === 'key-up' && event.trusted).length, 1);
        const hide = drawer.getByRole('button', { name: 'Hide branch', exact: true });
        await assertDrawerActionReachable(hide);
        await hide.click();
        assert.deepEqual(await page.getByTestId('retained-owner-branch').evaluate(node => {
          const trigger = node.querySelector('[role="combobox"]'), popup = node.querySelector('[role="listbox"]');
          return { hidden: node.hidden, display: getComputedStyle(node).display, expanded: trigger.getAttribute('aria-expanded'), triggerRects: trigger.getClientRects().length, popupRects: popup.getClientRects().length, containsPopup: node.contains(popup) };
        }), { hidden: true, display: 'none', expanded: 'true', triggerRects: 0, popupRects: 0, containsPopup: true });
      }
      const before = await drawerOwnerEvents(page);
      await assertDrawerActionReachable(drawer.getByRole('button', { name: 'Drawer action', exact: true }));
      await drawer.getByRole('button', { name: 'Drawer action', exact: true }).click();
      assert.ok(await drawer.getByRole('button', { name: 'Drawer action', exact: true }).evaluate(node => node === document.activeElement));
      await page.keyboard.press('Escape');
      await settleCss(page);
      await page.waitForFunction(() => document.querySelector('dialog[data-escape-owner="drawer"]').getAttribute('data-state') !== 'closing');
      assert.equal(await drawer.evaluate(node => node.open), false, 'inactive child must not veto native Drawer closure');
      await page.waitForFunction(() => JSON.parse(document.querySelector('[aria-label="Drawer owner events"]').textContent).some(event => event.type === 'close' && event.own));
      assert.ok(await opener.evaluate(node => node === document.activeElement));
      const after = await drawerOwnerEvents(page), delta = after.slice(before.length);
      assert.deepEqual(before.filter(event => event.type === 'cancel' && event.own).map(event => event.prevented), child ? [true] : []);
      assert.equal(delta.filter(event => event.type === 'drawer-request' && event.open === false).length, 1);
      assert.equal(delta.filter(event => event.type === 'close' && event.own).length, 1);
      assert.deepEqual(delta.filter(event => event.type === 'cancel' && event.own).map(event => ({ prevented: event.prevented, trusted: event.trusted })), [{ prevented: false, trusted: true }]);
      assert.equal(delta.filter(event => event.type === 'key-capture' && event.trusted).length, 1);
      assert.equal(delta.filter(event => event.type === 'key-up' && event.trusted).length, 0);
      assert.ok((await page.evaluate(() => window.retainedNativeEvents)).some(event => event.type === 'cancel' && event.owner === 'drawer' && event.trusted));
      await settleCss(page);
      await opener.click();
      assert.ok(await drawer.evaluate(node => node.open), JSON.stringify(await drawerOwnerEvents(page)));
      await drawer.getByRole('button', { name: 'Close', exact: true }).click();
      await page.waitForFunction(() => !document.querySelector('dialog[data-escape-owner="drawer"]').open);
      assert.ok(await opener.evaluate(node => node === document.activeElement));
      if (enlarged) await assertViewportText(page);
    }, { width, height: 844 });
  });
}

for (const enlarged of [false, true]) {
  test(`native Drawer keeps the public own cancel veto for Escape and Close until the consumer permits closure${enlarged ? ' at 390px with 200% text' : ''}`, async () => {
    await withStory('surfaces-drawer--native-owner-veto', async page => {
      await observeRetainedNativeEvents(page);
      const opener = page.getByRole('button', { name: 'Open owner drawer' });
      await opener.click();
      const drawer = page.locator('dialog[data-escape-owner="drawer"]');
      if (enlarged) {
        await doubleText(page);
        await settleCss(page);
      } else await drawer.getByRole('button', { name: 'Drawer action' }).click();
      await page.keyboard.press('Escape');
      await settleCss(page);
      assert.ok(await drawer.evaluate(node => node.open));
      assert.equal((await drawerOwnerEvents(page)).filter(event => event.type === 'cancel' && event.own).length, 1);
      await assertDrawerActionReachable(drawer.getByRole('button', { name: 'Close', exact: true }));
      await drawer.getByRole('button', { name: 'Close', exact: true }).click();
      await settleCss(page);
      assert.ok(await drawer.evaluate(node => node.open));
      const blocked = await drawerOwnerEvents(page);
      assert.equal(blocked.filter(event => event.type === 'cancel' && event.own && event.veto).length, 2);
      assert.equal(blocked.filter(event => event.type === 'drawer-request' && event.open === false).length, 0);
      assert.equal(blocked.filter(event => event.type === 'close' && event.own).length, 0);
      const allow = drawer.getByRole('button', { name: 'Allow close' });
      if (enlarged) {
        for (let count = 0; count < 5 && !await allow.evaluate(node => node === document.activeElement); count++) await page.keyboard.press('Tab');
        assert.ok(await allow.evaluate(node => node === document.activeElement));
      }
      await assertDrawerActionReachable(allow);
      await allow.click();
      await drawer.getByRole('button', { name: 'Close', exact: true }).click();
      await page.waitForFunction(() => !document.querySelector('dialog[data-escape-owner="drawer"]').open);
      await page.waitForFunction(() => JSON.parse(document.querySelector('[aria-label="Drawer owner events"]').textContent).some(event => event.type === 'close' && event.own));
      const accepted = await drawerOwnerEvents(page);
      assert.equal(accepted.filter(event => event.type === 'drawer-request' && event.open === false).length, 1);
      assert.equal(accepted.filter(event => event.type === 'close' && event.own).length, 1);
      assert.ok(await opener.evaluate(node => node === document.activeElement));
      if (enlarged) await assertViewportText(page);
    });
  });
}
