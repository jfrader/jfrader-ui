import type { CatalogEntry } from '../catalog.generated';
import { StoryView, useStoryModule } from '../story-view';

const STORYBOOK_ORIGIN = 'https://ui.jfrader.com';

const kebab = (value: string) =>
  value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();

function formatValue(value: unknown): string {
  if (value === undefined) return '—';
  if (typeof value === 'function') return 'fn()';
  if (typeof value === 'string') return value.length > 40 ? `${value.slice(0, 37)}…` : value;
  if (typeof value === 'object' && value !== null) {
    if ('$$typeof' in (value as object)) return '<ReactNode>';
    if (Array.isArray(value)) return `[${value.length}]`;
    return '{…}';
  }
  return String(value);
}

interface MetaShape {
  argTypes?: Record<string, { control?: unknown; options?: unknown[]; description?: string }>;
  args?: Record<string, unknown>;
  parameters?: { docs?: { description?: { component?: string } } };
}

export function ComponentPage({ entry }: { entry: CatalogEntry }) {
  const { module, error } = useStoryModule(entry);
  const meta = ((module?.default ?? {}) as MetaShape) ?? {};
  const argTypes = meta.argTypes ?? {};
  const defaultArgs = meta.args ?? {};
  const description = meta.parameters?.docs?.description?.component;
  const preview = entry.stories.filter((name) => name !== 'Default').slice(0, 3);
  const previewList = preview.length > 0 ? preview : entry.stories.slice(0, 1);

  return (
    <>
      <div className="crumb">
        Components / {entry.group} / {entry.name}
      </div>
      <h1>{entry.name}</h1>
      <div className="summary-row">
        <span className="chip">{entry.stories.length} stories</span>
        <span className="chip">{Object.keys(argTypes).length} documented props</span>
        <span className="chip">story module reuse</span>
        <a className="tool" href={`${STORYBOOK_ORIGIN}/?path=/docs/${entry.storybookId}--docs`}>
          Open in Storybook ↗
        </a>
      </div>
      <p className="lede">
        {description ??
          `Live examples below are rendered from ${entry.storybookTitle} — the same story module Storybook serves.`}
      </p>

      {error ? <div className="story-failed">Could not load the story module: {error}</div> : null}
      {!module && !error ? <p>Loading stories…</p> : null}

      {module
        ? previewList.map((story) => (
            <div className="frame" key={story}>
              <header>
                <span>{story}</span>
                <span className="sp" />
                <a href={`${STORYBOOK_ORIGIN}/?path=/story/${entry.storybookId}--${kebab(story)}`}>
                  open in Storybook ↗
                </a>
              </header>
              <div className="shot">
                <StoryView module={module} story={story} />
              </div>
            </div>
          ))
        : null}

      <h2>API</h2>
      {Object.keys(argTypes).length > 0 ? (
        <table>
          <thead>
            <tr>
              <th>Prop</th>
              <th>Control</th>
              <th>Options</th>
              <th>Default</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(argTypes).map(([prop, definition]) => (
              <tr key={prop}>
                <td>
                  <code>{prop}</code>
                </td>
                <td>{formatValue(definition.control)}</td>
                <td>{definition.options ? formatValue(definition.options) : '—'}</td>
                <td>{formatValue(defaultArgs[prop])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>This story module declares no argTypes; the props live in the component source.</p>
      )}

      <h2>Stories</h2>
      <ul>
        {entry.stories.map((story) => (
          <li key={story}>
            <a href={`${STORYBOOK_ORIGIN}/?path=/story/${entry.storybookId}--${kebab(story)}`}>{story}</a>
          </li>
        ))}
      </ul>

      <h2>Guidance</h2>
      <p>
        Editorial guidance (when to use it, do/don&apos;t, accessibility notes) belongs on this page next to the
        examples. That prose is the one thing Storybook cannot generate — it is written once here and stays in the repo.
      </p>
    </>
  );
}
