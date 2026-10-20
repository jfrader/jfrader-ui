#!/usr/bin/env node
/**
 * Documentation coverage audit for the published docs front.
 *
 * Crawls every component page, opens each example's Code panel and records the examples that
 * render without a code sample. It also records the page sections and the API parts so the
 * sweep can be tracked per component.
 *
 * Usage:
 *   DOCS_URL=https://ui.jfrader.com pnpm --filter @jfrader/storybook audit:docs
 *   ... audit:docs --only carousel,card-stack
 *   ... audit:docs --check            # exits 2 when an example has no code
 *   ... audit:docs --out /tmp/docs-audit.json
 *
 * Defaults to the deployed site. Point DOCS_URL at a local build to audit before publishing.
 */
import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const option = (name, fallback = undefined) => {
  const index = args.indexOf(name);
  return index === -1 ? fallback : args[index + 1];
};
const only = new Set((option('--only', '') ?? '').split(',').map((value) => value.trim()).filter(Boolean));
const check = args.includes('--check');
const base = (process.env.DOCS_URL ?? 'https://ui.jfrader.com').replace(/\/$/, '');
const out = option('--out', 'docs-audit.json');
const timeout = Number(option('--timeout', '30000'));

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

try {
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout });
  await page.waitForFunction(() => document.querySelector('a[href^="#/components/"]'), { timeout });
  const entries = await page.evaluate(() => [...document.querySelectorAll('a[href^="#/components/"]')]
    .map((link) => ({
      slug: link.getAttribute('href').replace('#/components/', ''),
      name: link.textContent.trim(),
    }))
    .filter((entry, index, all) => all.findIndex((other) => other.slug === entry.slug) === index)
    .sort((a, b) => a.slug.localeCompare(b.slug)));

  const selected = entries.filter((entry) => only.size === 0 || only.has(entry.slug));
  if (selected.length === 0) throw new Error(`No component links matched ${[...only].join(', ') || 'the page'}`);
  process.stderr.write(`auditing ${selected.length} component pages at ${base}\n`);

  const components = [];
  for (const entry of selected) {
    try {
      await page.evaluate((slug) => { window.location.hash = `#/components/${slug}`; }, entry.slug);
      await page.waitForFunction((slug) => window.location.hash.includes(`/components/${slug}`)
        && !document.querySelector('.main[data-page-ready="pending"]')
        && Boolean(document.querySelector('.main h1')), entry.slug, { timeout });
      await page.waitForTimeout(250);
      const pageData = await page.evaluate(() => new Promise((resolve) => {
        for (const details of document.querySelectorAll('.frame .code-toggle')) {
          if (!details.open) {
            details.open = true;
            details.dispatchEvent(new Event('toggle'));
          }
        }
        // React renders the code panel on the toggle event; measure after it settles.
        setTimeout(() => {
          const frames = [...document.querySelectorAll('.frame')].map((frame) => {
            const toggle = frame.querySelector('.code-toggle');
            const code = toggle?.querySelector('.sd-demo-code pre, .sd-demo-code code')?.textContent ?? '';
            return {
              story: frame.dataset.story ?? frame.querySelector('header span')?.textContent ?? '',
              noCode: Boolean(toggle?.querySelector('.sd-demo-code p')),
              codeLength: code.length,
            };
          });
          const api = document.querySelector('#section-api, #section-props');
          resolve({
            title: document.querySelector('.main h1')?.textContent?.trim() ?? '',
            sections: [...document.querySelectorAll('.main h2')]
              .filter((heading) => !heading.closest('.frame') && !heading.closest('.story-lane'))
              .map((heading) => heading.textContent.trim()),
            apiParts: api ? [...api.parentElement.querySelectorAll('h3')].map((heading) => heading.textContent.trim()) : [],
            frames,
          });
        }, 400);
      }));
      const missing = pageData.frames.filter((frame) => frame.noCode).map((frame) => frame.story);
      components.push({ slug: entry.slug, ...pageData, missing, error: null });
      process.stderr.write(`${entry.slug}: ${pageData.frames.length} examples, ${missing.length} without code\n`);
    } catch (error) {
      components.push({ slug: entry.slug, title: entry.name, sections: [], apiParts: [], frames: [], missing: [], error: String(error).slice(0, 240) });
      process.stderr.write(`${entry.slug}: failed (${String(error).slice(0, 120)})\n`);
    }
  }

  const pages = components.filter((component) => !component.error);
  const summary = {
    base,
    auditedAt: new Date().toISOString(),
    components: components.length,
    pages: pages.length,
    examples: pages.reduce((total, component) => total + component.frames.length, 0),
    withoutCode: components.reduce((total, component) => total + component.missing.length, 0),
    componentsWithoutCode: components.filter((component) => component.missing.length > 0).length,
    errors: components.filter((component) => component.error).length,
  };
  writeFileSync(out, JSON.stringify({ summary, components }, null, 1));

  const rows = components
    .filter((component) => component.missing.length > 0)
    .sort((a, b) => b.missing.length - a.missing.length);
  process.stdout.write(`\n${summary.withoutCode} of ${summary.examples} examples have no code `
    + `across ${summary.componentsWithoutCode} of ${summary.components} components `
    + `(${summary.errors} pages failed). Report: ${out}\n`);
  for (const component of rows) {
    process.stdout.write(`  ${component.slug.padEnd(24)} ${String(component.missing.length).padStart(3)}  ${component.missing.join(', ')}\n`);
  }
  if (check && summary.withoutCode > 0) process.exitCode = 2;
} finally {
  await browser.close();
}
