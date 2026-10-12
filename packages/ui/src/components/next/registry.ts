// The framework-free half of `@jfrader/ui/next`: an Emotion cache that records which styles were
// inserted since the last flush, and the grouping of those styles into `<style data-emotion>`
// payloads. `EmotionRegistry` wires both to Next's `useServerInsertedHTML`; neither is public API.
import createCache, { type EmotionCache } from '@emotion/cache';

export interface PendingStyle {
  name: string;
  isGlobal: boolean;
}

export interface CollectedStyles {
  globals: { name: string; styles: string }[];
  names: string[];
  styles: string;
}

export interface EmotionRegistryCache {
  cache: EmotionCache;
  /** Returns the styles inserted since the previous call and forgets them. */
  flush: () => PendingStyle[];
}

export function createEmotionRegistry(key: string): EmotionRegistryCache {
  const cache = createCache({ key });
  // Compat mode keeps the server-rendered rules on `cache.inserted` so the flush can emit them.
  cache.compat = true;
  const insert = cache.insert;
  let pending: PendingStyle[] = [];
  cache.insert = (...args) => {
    const [selector, serialized] = args;
    if (cache.inserted[serialized.name] === undefined) {
      pending.push({ name: serialized.name, isGlobal: !selector });
    }
    return insert(...args);
  };
  const flush = () => {
    const names = pending;
    pending = [];
    return names;
  };
  return { cache, flush };
}

/** Splits flushed styles into one payload per global and one shared payload for scoped rules. */
export function collectStyles(pending: readonly PendingStyle[], inserted: EmotionCache['inserted']): CollectedStyles {
  const globals: CollectedStyles['globals'] = [];
  const names: string[] = [];
  let styles = '';
  for (const { name, isGlobal } of pending) {
    const style = inserted[name];
    if (typeof style !== 'string') continue;
    if (isGlobal) {
      globals.push({ name, styles: style });
    } else {
      names.push(name);
      styles += style;
    }
  }
  return { globals, names, styles };
}
