'use client';

// Next.js App Router adapter, published as `@jfrader/ui/next`. This is the only module that imports
// `next` (an optional peer): apps that never import `@jfrader/ui/next` never load or install it.
import { useServerInsertedHTML } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { CacheProvider } from '../../styling/css';
import { ThemeProvider } from '../theme-provider/theme-provider';
import { collectStyles, createEmotionRegistry } from './registry';

const DEFAULT_CACHE_KEY = 'css';

export interface EmotionRegistryProps {
  /** Emotion cache key: the class name prefix and the `data-emotion` attribute value. */
  cacheKey?: string;
  children?: ReactNode;
}

/**
 * Emotion SSR registry for the App Router: one shared cache and a flush that only
 * sends the styles inserted since the last pass, so the server and client trees
 * match on hydration. Without it, Emotion inserts <style> nodes inline during SSR
 * and the hydration diff mismatches.
 */
export function EmotionRegistry({ cacheKey = DEFAULT_CACHE_KEY, children }: EmotionRegistryProps) {
  const [{ cache, flush }] = useState(() => createEmotionRegistry(cacheKey));

  useServerInsertedHTML(() => {
    const pending = flush();
    if (pending.length === 0) return null;
    const { globals, names, styles } = collectStyles(pending, cache.inserted);
    return (
      <>
        {globals.map(({ name, styles }) => (
          <style key={name} data-emotion={`${cache.key}-global ${name}`} dangerouslySetInnerHTML={{ __html: styles }} />
        ))}
        {names.length > 0 && (
          <style
            key={cache.key}
            data-emotion={`${cache.key} ${names.join(' ')}`}
            dangerouslySetInnerHTML={{ __html: styles }}
          />
        )}
      </>
    );
  });

  return (
    <CacheProvider value={cache}>
      <ThemeProvider>{children}</ThemeProvider>
    </CacheProvider>
  );
}

EmotionRegistry.displayName = 'EmotionRegistry';
