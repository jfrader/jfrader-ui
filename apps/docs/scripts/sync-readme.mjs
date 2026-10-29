import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../../');
const readmePath = path.join(repoRoot, 'README.md');
const guidanceDir = path.join(__dirname, '../guidance');
const targetPath = path.join(guidanceDir, 'index.md');
const showcasePagePath = path.join(guidanceDir, 'showcase.md');
const showcaseSection = /^## Showcase\n+([\s\S]*?)(?=^## |(?![\s\S]))/m;
const showcaseSource = path.join(repoRoot, 'docs/showcase');
const showcaseTarget = path.join(__dirname, '../public/showcase');

function writeIfChanged(target, content) {
  if (!existsSync(target) || readFileSync(target, 'utf8') !== content) {
    writeFileSync(target, content, 'utf8');
  }
}

function syncShowcase() {
  mkdirSync(showcaseTarget, { recursive: true });
  const names = new Set(readdirSync(showcaseSource));
  for (const name of readdirSync(showcaseTarget)) {
    if (!names.has(name)) rmSync(path.join(showcaseTarget, name), { recursive: true, force: true });
  }
  for (const name of names) {
    const source = readFileSync(path.join(showcaseSource, name));
    const target = path.join(showcaseTarget, name);
    if (!existsSync(target) || !readFileSync(target).equals(source)) {
      writeFileSync(target, source);
    }
  }
}

/**
 * Copies the repository README.md to apps/docs/guidance/index.md for the docs front overview.
 *
 * README.md remains the single source of truth. When copying:
 * 1. Strips the redundant top-level H1 (`# jfrader-ui`) because the overview page shell
 *    already renders `<h1>{site.title}</h1>` and `site.tagline`.
 * 2. Rewrites `docs/showcase/*` image paths to `/showcase/*` and mirrors `docs/showcase/` into
 *    apps/docs/public/showcase/, so the images resolve in local development and production.
 * 3. Links the icon guide to its docs page and rewrites other relative `docs/*.md` links
 *    to full GitHub URLs.
 * 4. Rewrites `https://ui.jfrader.com/` links to `/` so navigation to the docs pages and the
 *    workbench stays on the current site in both local development and production.
 * 5. Moves the `## Showcase` section out of the overview into its own `showcase.md` page, and
 *    removes that page when the README has no such section.
 */
export function syncReadme() {
  if (!existsSync(readmePath)) {
    throw new Error(`README.md not found at ${readmePath}`);
  }

  let content = readFileSync(readmePath, 'utf8');

  // Strip leading top-level header (# jfrader-ui)
  content = content.replace(/^#\s+[^\n]+\n+/, '');

  content = content.replace(/\(docs\/showcase\/([^)]+)\)/g, '(/showcase/$1)');
  syncShowcase();

  content = content.replace(/\(docs\/icons\.md\)/g, '(#/components/gallery)');

  // Rewrite relative docs/*.md links to GitHub
  content = content.replace(/\(docs\/([^)]+)\)/g, '(https://github.com/jfrader/jfrader-ui/blob/master/docs/$1)');

  // Rewrite https://ui.jfrader.com/ to / so site links stay on the current origin
  content = content.replace(/https:\/\/ui\.jfrader\.com\//g, '/');

  mkdirSync(guidanceDir, { recursive: true });

  const showcase = content.match(showcaseSection);
  if (showcase) {
    content = content.replace(showcaseSection, '');
    writeIfChanged(showcasePagePath, `---\ntitle: Showcase\ngroup: Showcase\n---\n\n${showcase[1]}`);
  } else {
    rmSync(showcasePagePath, { force: true });
  }

  writeIfChanged(targetPath, content);
  const flightsSource = readFileSync(path.join(repoRoot, 'docs/flights.md'), 'utf8').replace(/^#\s+[^\n]+\n+/, '');
  writeIfChanged(path.join(guidanceDir, 'flights.md'), flightsSource);
  rmSync(path.join(guidanceDir, 'gallery.md'), { force: true });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  syncReadme();
}
