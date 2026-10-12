import { useEffect, useState } from 'react';
import { catalog, groups, stats, type CatalogEntry } from './catalog.generated';
import { OverviewPage } from './pages/overview';
import { ComponentPage } from './pages/component-page';
import { ColorPage } from './pages/foundations-color';
import { TypePage } from './pages/foundations-type';

const STORYBOOK_ORIGIN = 'https://ui.jfrader.com';

type Route =
  | { kind: 'overview' }
  | { kind: 'component'; slug: string }
  | { kind: 'color' }
  | { kind: 'type' };

function parseRoute(hash: string): Route {
  const path = hash.replace(/^#\/?/, '');
  if (path.startsWith('components/')) {
    const slug = path.slice('components/'.length);
    if (catalog.some((entry) => entry.slug === slug)) return { kind: 'component', slug };
  }
  if (path === 'foundations/color') return { kind: 'color' };
  if (path === 'foundations/type') return { kind: 'type' };
  return { kind: 'overview' };
}

export function App() {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash));
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const onHash = () => {
      setRoute(parseRoute(window.location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const activeSlug = route.kind === 'component' ? route.slug : null;
  const foundations = [
    { href: '#/foundations/color', label: 'Color' },
    { href: '#/foundations/type', label: 'Typography' },
  ];

  return (
    <div className="app">
      <header className="top">
        <span className="mark">j</span>
        <span className="brand">jfrader/ui</span>
        <span className="chip">docs</span>
        <span className="search">Search {stats.components} components… (Pagefind lands later)</span>
        <span className="spacer" />
        <button className="tool" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          {theme === 'dark' ? 'Light' : 'Dark'}
        </button>
        <a className="tool" href={STORYBOOK_ORIGIN}>
          Storybook ↗
        </a>
        <a className="tool" href="https://github.com/jfrader/jfrader-ui">
          GitHub ↗
        </a>
      </header>

      <nav className="nav">
        <a href="#/" className={route.kind === 'overview' ? 'on' : undefined}>
          Overview
        </a>
        <div className="grp">Foundations</div>
        {foundations.map((item) => (
          <a
            key={item.href}
            href={item.href}
            className={route.kind !== 'overview' && item.href.endsWith(route.kind) ? 'on' : undefined}
          >
            {item.label}
          </a>
        ))}
        {groups.map((group) => (
          <div key={group}>
            <div className="grp">{group}</div>
            {catalog
              .filter((entry) => entry.group === group)
              .map((entry) => (
                <a
                  key={entry.slug}
                  href={`#/components/${entry.slug}`}
                  className={activeSlug === entry.slug ? 'on' : undefined}
                >
                  {entry.name}
                </a>
              ))}
          </div>
        ))}
        <div className="nav-note">
          nav + examples generated from the {stats.components} story modules · {stats.stories} stories
        </div>
      </nav>

      <main className="main">
        {route.kind === 'component' ? (
          <ComponentPage entry={catalog.find((entry) => entry.slug === route.slug) as CatalogEntry} />
        ) : route.kind === 'color' ? (
          <ColorPage />
        ) : route.kind === 'type' ? (
          <TypePage />
        ) : (
          <OverviewPage />
        )}
      </main>
    </div>
  );
}
