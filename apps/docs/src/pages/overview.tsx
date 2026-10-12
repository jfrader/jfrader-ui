import { catalog, stats } from '../catalog.generated';

const START_HERE = ['button', 'text-field', 'dialog', 'alert', 'code-block', 'card'];

export function OverviewPage() {
  return (
    <>
      <div className="crumb">Getting started / Overview</div>
      <h1>jfrader/ui</h1>
      <p className="lede">
        The documentation front door — built from the library&apos;s own Storybook definitions. There is no second
        component list to keep in sync: the navigation is the story index, the examples below are the real stories, and
        the API tables come from the stories&apos; <code>argTypes</code>.
      </p>

      <div className="tiles">
        <div className="card tile">
          <div className="num">{stats.components}</div>
          <b>Components</b>
          <span>Generated from the story files on every dev/build run.</span>
        </div>
        <div className="card tile">
          <div className="num">{stats.stories}</div>
          <b>Stories</b>
          <span>Each one is renderable here and in Storybook — same module, same args.</span>
        </div>
        <div className="card tile">
          <div className="num">0</div>
          <b>Duplicated definitions</b>
          <span>No copied prop tables, no hand-maintained lists, no second source of truth.</span>
        </div>
      </div>

      <h2>How this reuses Storybook</h2>
      <div className="grid2">
        <div className="card">
          <h3>1 · Navigation = the story index</h3>
          <p>
            <code>scripts/generate-catalog.mjs</code> reads every{' '}
            <code>packages/ui/src/components/&lt;name&gt;/&lt;name&gt;.stories.tsx</code>, takes the module&apos;s{' '}
            <code>title</code> and its exported stories, and writes the sidebar you see on the left. Group names are
            normalised while mapping (<code>Data</code>, <code>Data Display</code> and <code>Data display</code> all
            land under one heading) — that mapping lives in the generator, not in hand-written nav files.
          </p>
        </div>
        <div className="card">
          <h3>2 · Examples = the story modules themselves</h3>
          <p>
            Opening a component lazily imports the same story module Storybook renders (a dynamic{' '}
            <code>import()</code> per component) and renders the story with its own <code>component</code>,{' '}
            <code>args</code> and <code>render</code>. What you see is the story definition, evaluated outside
            Storybook — portable stories, without a copy.
          </p>
        </div>
        <div className="card">
          <h3>3 · API tables = argTypes</h3>
          <p>
            The prop table on each component page is derived from the story meta&apos;s <code>argTypes</code> and default{' '}
            <code>args</code> at runtime. Add a control in the story file and the docs page follows.
          </p>
        </div>
        <div className="card">
          <h3>4 · Foundations = the token source</h3>
          <p>
            The <a href="#/foundations/color">Color</a> and <a href="#/foundations/type">Typography</a> pages read{' '}
            <code>@jfrader/tokens/vars</code> directly, so the swatches and scales are the published tokens — and the
            theme toggle in the header restyles this whole site through the library&apos;s own <code>data-theme</code>.
          </p>
        </div>
      </div>

      <h2>Start here</h2>
      <ul>
        {START_HERE.map((slug) => {
          const entry = catalog.find((item) => item.slug === slug);
          if (!entry) return null;
          return (
            <li key={slug}>
              <a href={`#/components/${entry.slug}`}>{entry.name}</a> — {entry.stories.length} stories,{' '}
              {entry.hasComponent ? 'live examples wired' : 'nav only for now'}
            </li>
          );
        })}
      </ul>

      <h2>What is still Storybook-only</h2>
      <ul>
        <li>Play tests, a11y checks, controls and interactions stay in Storybook — this front links out to them.</li>
        <li>Stories that depend on Storybook&apos;s global decorators (theme scope, portals) may need wiring here.</li>
        <li>Search, versioned docs and non-dev authoring are the next OSS pieces — Pagefind, Docusaurus-style
          versioning, TinaCMS — not part of this first pass.</li>
      </ul>
    </>
  );
}
