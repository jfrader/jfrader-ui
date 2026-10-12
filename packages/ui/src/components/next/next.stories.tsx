import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { CacheProvider, type SerializedStyles } from '../../styling/css';
import { Button } from '../button';
import { collectStyles, createEmotionRegistry } from './registry';

// EmotionRegistry itself needs Next's server renderer; these stories cover the cache it wraps.
const DEMO_KEY = 'next-demo';
const TEST_KEY = 'next-registry-test';

const scoped = { name: 'scoped', styles: 'color:inherit;' } satisfies SerializedStyles;
const globalRule = { name: 'global', styles: '[data-next-registry-probe]{color:inherit;}' } satisfies SerializedStyles;

function RegistryExample() {
  const [{ cache }] = useState(() => createEmotionRegistry(DEMO_KEY));
  return (
    <CacheProvider value={cache}>
      <Button>Save</Button>
    </CacheProvider>
  );
}
RegistryExample.displayName = 'RegistryExample';

const meta = {
  title: 'Foundations/Next.js',
  tags: ['autodocs'],
  render: () => <RegistryExample />,
  parameters: {
    docs: {
      description: {
        component:
          'Include Emotion styles in server-rendered pages with the Next.js App Router.',
      },
      usage: `### Setup
- Import \`EmotionRegistry\` from \`@jfrader/ui/next\`. Install the optional \`next\` and \`@emotion/cache\` peers.
- Wrap the root layout body contents with \`EmotionRegistry\`. It mounts \`ThemeProvider\` and shares one Emotion cache.
- Each server render pass emits newly inserted styles as \`<style data-emotion>\` tags. Without the registry, Emotion inserts inline style nodes during SSR that cause hydration mismatches.
- \`cacheKey\` sets the class name prefix and \`data-emotion\` cache key. It defaults to \`css\`.

### Limits
- The adapter is for the App Router. Apps that do not import \`@jfrader/ui/next\` do not load or need to install Next.js.
- These examples use the underlying cache. \`EmotionRegistry\` itself requires Next's server renderer.`,
      source: {
        code: `// app/layout.tsx
import { EmotionRegistry } from '@jfrader/ui/next';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark">
      <body>
        <EmotionRegistry>{children}</EmotionRegistry>
      </body>
    </html>
  );
}`,
      },
    },
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    // Components below the registry's CacheProvider take their class names from its cache.
    const button = within(canvasElement).getByRole('button', { name: 'Save' });
    await expect(button.className).toMatch(new RegExp(`\\b${DEMO_KEY}-`));
  },
};

export const FlushesOnlyNewStyles: Story = {
  play: async () => {
    const { cache, flush } = createEmotionRegistry(TEST_KEY);
    try {
      await expect(flush()).toEqual([]);

      cache.insert(`.${TEST_KEY}-${scoped.name}`, scoped, cache.sheet, true);
      cache.insert('', globalRule, cache.sheet, true);
      await expect(flush()).toEqual([
        { name: scoped.name, isGlobal: false },
        { name: globalRule.name, isGlobal: true },
      ]);
      await expect(flush()).toEqual([]);

      // A style already in the cache is not flushed again.
      cache.insert(`.${TEST_KEY}-${scoped.name}`, scoped, cache.sheet, true);
      await expect(flush()).toEqual([]);
    } finally {
      cache.sheet.flush();
    }
  },
};

export const GroupsGlobalsApart: Story = {
  play: async () => {
    const collected = collectStyles(
      [
        { name: 'first', isGlobal: false },
        { name: 'reset', isGlobal: true },
        { name: 'second', isGlobal: false },
        // Client-side caches store `true` instead of the rules: nothing to emit.
        { name: 'client', isGlobal: false },
      ],
      { first: '.css-first{}', reset: 'body{}', second: '.css-second{}', client: true },
    );
    await expect(collected).toEqual({
      globals: [{ name: 'reset', styles: 'body{}' }],
      names: ['first', 'second'],
      styles: '.css-first{}.css-second{}',
    });
    await expect(collectStyles([], {})).toEqual({ globals: [], names: [], styles: '' });
  },
};
