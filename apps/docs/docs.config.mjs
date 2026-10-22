/**
 * jfrader/ui's documentation front: a configuration for @jfrader/react-storydocs.
 * The tool lives in its own repository (jfrader/react-storydocs) and knows nothing about
 * this component library; everything it needs to know is the file below.
 */
export default {
  site: {
    title: 'jfrader/ui',
    mark: 'j',
    tagline:
      'React component library based on Emotion and CSS custom properties. Navigation and examples come from the library’s Storybook stories; the API comes from the component sources.',
    links: [
      { label: 'Storybook', href: '/storybook/' },
      { label: 'GitHub', href: 'https://github.com/jfrader/jfrader-ui' },
    ],
  },
  guidance: {
    dir: './guidance',
  },
  stories: {
    from: '@jfrader/ui',
    pattern: 'src/components/*/*.stories.tsx',
  },
  api: {
    module: './src/api-table.tsx',
  },
  groups: {
    rename: { Data: 'Data display', 'Data Display': 'Data display' },
    order: [
      'Foundations',
      'Theme',
      'Actions',
      'Forms',
      'Inputs',
      'Data display',
      'Feedback',
      'Navigation',
      'Surfaces',
      'Pickers',
      'Layout',
      'Components',
      'Showcase',
    ],
  },
  // The token reference is authored in jfrader-ui as the Theme pages (palette, typography,
  // spacing and shape, elevation and motion). The engine's generated token listings duplicated
  // them with raw var() strings and no values, so they stay off.
  pages: {
    color: false,
    typography: false,
    spacing: false,
    effects: false,
  },
  theme: {
    attribute: 'data-theme',
    values: ['dark', 'light'],
    vars: {
      bg: 'var(--ui-color-bg)',
      surface: 'var(--ui-color-surface)',
      surfaceRaised: 'var(--ui-color-surface-raised)',
      surfaceHover: 'var(--ui-color-surface-hover)',
      border: 'var(--ui-color-border)',
      borderSubtle: 'var(--ui-color-border-subtle)',
      text: 'var(--ui-color-text)',
      textMuted: 'var(--ui-color-text-muted)',
      textSubtle: 'var(--ui-color-text-subtle)',
      accent: 'var(--ui-color-accent)',
      accentText: 'var(--ui-color-accent-text)',
      accentSoft: 'var(--ui-color-accent-soft)',
      accentContrast: 'var(--ui-color-accent-contrast)',
      danger: 'var(--ui-color-danger)',
      focusRing: 'var(--ui-color-focus-ring)',
    },
  },
  tokens: {
    varsModule: '@jfrader/tokens/vars',
    varsExport: 'vars',
    css: ['@jfrader/tokens/tokens.css', '@jfrader/tokens/base.css'],
  },
  // The library's own code block, with its shiki highlighter, for every code sample the docs show.
  code: {
    module: './src/code.tsx',
  },
};
