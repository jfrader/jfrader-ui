import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../../');
const readmePath = path.join(repoRoot, 'README.md');
const guidanceDir = path.join(__dirname, '../guidance');
const targetPath = path.join(guidanceDir, 'index.md');

/**
 * Copies the repository README.md to apps/docs/guidance/index.md for the docs front overview.
 *
 * README.md remains the single source of truth. When copying:
 * 1. Strips the redundant top-level H1 (`# jfrader-ui`) because the overview page shell
 *    already renders `<h1>{site.title}</h1>` and `site.tagline`.
 * 2. Rewrites relative `docs/*.md` links to full GitHub URLs so clicking them from the docs
 *    site navigates to the repository docs instead of 404ing on the docs domain.
 * 3. Rewrites `https://ui.jfrader.com/storybook/` to `/storybook/` so navigation to the
 *    workbench works seamlessly in both local development and production.
 */
export function syncReadme() {
  if (!existsSync(readmePath)) {
    throw new Error(`README.md not found at ${readmePath}`);
  }

  let content = readFileSync(readmePath, 'utf8');

  // Strip leading top-level header (# jfrader-ui)
  content = content.replace(/^#\s+[^\n]+\n+/, '');

  // Rewrite relative docs/*.md links to GitHub
  content = content.replace(/\(docs\/([^)]+)\)/g, '(https://github.com/jfrader/jfrader-ui/blob/master/docs/$1)');

  // Rewrite https://ui.jfrader.com/storybook/ to /storybook/
  content = content.replace(/https:\/\/ui\.jfrader\.com\/storybook\//g, '/storybook/');

  mkdirSync(guidanceDir, { recursive: true });

  const existing = existsSync(targetPath) ? readFileSync(targetPath, 'utf8') : null;
  if (existing !== content) {
    writeFileSync(targetPath, content, 'utf8');
  }
  const flightsSource = readFileSync(path.join(repoRoot, 'docs/flights.md'), 'utf8').replace(/^#\s+[^\n]+\n+/, '');
  const flightsTarget = path.join(guidanceDir, 'flights.md');
  if (!existsSync(flightsTarget) || readFileSync(flightsTarget, 'utf8') !== flightsSource) {
    writeFileSync(flightsTarget, flightsSource, 'utf8');
  }
  const iconsSource = readFileSync(path.join(repoRoot, 'docs/icons.md'), 'utf8').replace(/^#\s+[^\n]+\n+/, '');
  const iconsTarget = path.join(guidanceDir, 'gallery.md');
  if (!existsSync(iconsTarget) || readFileSync(iconsTarget, 'utf8') !== iconsSource) {
    writeFileSync(iconsTarget, iconsSource, 'utf8');
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  syncReadme();
}
