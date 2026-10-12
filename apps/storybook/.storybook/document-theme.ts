export const THEMES = ['dark', 'light'];
export const DEFAULT_THEME = 'dark';

// Runs in the preview <head> before the stylesheets and the first paint: applies the theme
// requested by the iframe URL (`globals=theme:light`), so the page never paints the default
// theme first. The decorators stay the runtime source of truth and set the same value on mount.
export const documentThemeScript = `<script>
(() => {
  const themes = ${JSON.stringify(THEMES)};
  const globals = new URLSearchParams(location.search).get('globals') ?? '';
  const requested = globals.split(';').map((entry) => entry.split(':')).find(([key]) => key === 'theme')?.[1];
  document.documentElement.dataset.theme = themes.includes(requested) ? requested : ${JSON.stringify(DEFAULT_THEME)};
})();
</script>`;
