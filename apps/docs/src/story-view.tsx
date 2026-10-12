import { Component, createElement, useEffect, useState, type ComponentType, type ReactNode } from 'react';
import type { CatalogEntry } from './catalog.generated';

/** The bit of CSF this app needs. Anything richer (decorators, loaders) stays in Storybook. */
interface StoryDefinition {
  render?: (args: Record<string, unknown>, context: unknown) => ReactNode;
  args?: Record<string, unknown>;
}

interface MetaDefinition {
  component?: ComponentType<Record<string, unknown>>;
  args?: Record<string, unknown>;
  argTypes?: Record<string, { control?: unknown; options?: unknown[]; description?: string }>;
  parameters?: { docs?: { description?: { component?: string } } };
}

class StoryBoundary extends Component<{ children: ReactNode; story: string }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed) {
      return (
        <div className="story-failed">
          “{this.props.story}” needs Storybook&apos;s global decorators to render — open it in Storybook.
        </div>
      );
    }
    return this.props.children;
  }
}

/** Renders a story straight from its Storybook module: meta component + merged args, or the story's render. */
export function StoryView({
  module,
  story,
  overrides,
}: {
  module: Record<string, unknown>;
  story: string;
  overrides?: Record<string, unknown>;
}) {
  const meta = (module.default ?? {}) as MetaDefinition;
  const definition = (module[story] ?? {}) as StoryDefinition;
  const args = { ...meta.args, ...definition.args, ...overrides };
  const node =
    typeof definition.render === 'function'
      ? definition.render(args, {})
      : meta.component
        ? createElement(meta.component, args)
        : null;
  if (!node) return <div className="story-failed">Story “{story}” has nothing to render.</div>;
  return <StoryBoundary story={story}>{node}</StoryBoundary>;
}

/** Lazily pulls the same module Storybook loads; the catalog only stores the import thunk. */
export function useStoryModule(entry: CatalogEntry) {
  const [module, setModule] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setModule(null);
    setError(null);
    entry
      .load()
      .then((loaded) => {
        if (alive) setModule(loaded);
      })
      .catch((cause: unknown) => {
        if (alive) setError(cause instanceof Error ? cause.message : String(cause));
      });
    return () => {
      alive = false;
    };
  }, [entry]);
  return { module, error };
}
