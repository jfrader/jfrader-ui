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
  /** Sets the Emotion class name prefix and `data-emotion` cache key. Defaults to `'css'`. */
  cacheKey?: string;
  children?: ReactNode;
}

/**
 * Shares one Emotion cache and emits new styles on each App Router server render pass.
 * Without it, Emotion inserts inline `<style>` nodes during SSR that cause hydration mismatches.
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
