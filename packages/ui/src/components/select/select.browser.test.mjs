import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createBrowserWorkbench } from '../../../../../apps/storybook/scripts/browser-workbench.mjs';

let workbench;
before(async () => { workbench = await createBrowserWorkbench(); });
after(async () => workbench?.close());

async function withStory(id, run, viewport = { width: 390, height: 844 }) {
  const context = await workbench.browser.newContext({ viewport, reducedMotion: 'reduce' });
  try {
    const page = await context.newPage();
    await page.goto(`${workbench.baseURL}/iframe.html?id=${id}&viewMode=story&embed=true`);
    await page.locator('#storybook-root input, [data-ui="select-trigger"]').first().waitFor();
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

function assertAdjacent(geometry) {
  const { panel, anchor, viewport, active, stickyInset } = geometry;
  assert.ok(panel.bottom <= anchor.top + 1 || panel.top >= anchor.bottom - 1, JSON.stringify(geometry));
  assert.ok(panel.top >= 0 && panel.bottom <= viewport.height + 1, JSON.stringify(geometry));
  assert.ok(panel.left >= 0 && panel.right <= viewport.width + 1, JSON.stringify(geometry));
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

test('ordinary Select respects a smaller authored maximum and enlarged RTL text', async () => {
  await withStory('inputs-select--sticky-list', async page => {
    await page.addStyleTag({ content: '[data-ui="select-listbox"] { max-block-size: 144px; }' });
    await page.evaluate(() => { document.documentElement.dir = 'rtl'; });
    await doubleText(page);
    const trigger = page.getByRole('combobox');
    await trigger.click();
    await page.waitForFunction(() => document.querySelector('[role="listbox"]')?.scrollTop > 0);
    const short = await adjacentGeometry(page);
    assertAdjacent(short);
    assert.ok(short.panel.height <= 145);
    await page.setViewportSize({ width: 844, height: 900 });
    await page.waitForFunction(() => document.querySelector('[role="listbox"]').getBoundingClientRect().bottom <= innerHeight);
    const tall = await adjacentGeometry(page);
    assertAdjacent(tall);
    assert.ok(tall.panel.height <= 145);
    await page.getByRole('listbox').evaluate(element => { element.style.maxBlockSize = '112px'; });
    await page.waitForFunction(() => document.querySelector('[role="listbox"]').getBoundingClientRect().height <= 113);
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
