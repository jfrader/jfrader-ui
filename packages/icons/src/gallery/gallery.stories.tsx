import { useEffect, useId, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import * as icons from '../generated/index';
import metadata from '../../icons.json';
import { componentName } from '../name';
import './gallery.css';

const SIZES = [16, 20, 24, 32] as const;
const THEMES = ['light', 'dark'] as const;
const COPY_NOTICE_DURATION = 2000;
const categories = [...new Set(metadata.map((entry) => entry.category))].sort();
const components = new Map(Object.entries(icons));

function IconBrowser() {
  const id = useId();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [variant, setVariant] = useState('line');
  const [size, setSize] = useState<number>(24);
  const [theme, setTheme] = useState('light');
  const [announcement, setAnnouncement] = useState({ text: '', sequence: 0 });
  useEffect(() => {
    if (!announcement.text) return;
    const timeout = window.setTimeout(() => {
      setAnnouncement((previous) => ({ ...previous, text: '' }));
    }, COPY_NOTICE_DURATION);
    return () => window.clearTimeout(timeout);
  }, [announcement.text, announcement.sequence]);
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const filtered = metadata.filter((entry) => {
    const searchable = [entry.name, componentName(entry.name), ...entry.tags, ...entry.aliases].join(' ').toLowerCase();
    return (!category || entry.category === category)
      && entry.variants.includes(variant)
      && terms.every((term) => searchable.includes(term));
  });
  const grouped = !category && terms.length === 0;
  const groups = grouped
    ? categories.map((name) => ({ name, entries: filtered.filter((entry) => entry.category === name) }))
    : [{ name: 'Results', entries: filtered }];

  async function copy(name: string) {
    try {
      await navigator.clipboard.writeText(`import { ${name} } from '@jfrader/icons'`);
      setAnnouncement((previous) => ({ text: `Copied ${name} import.`, sequence: previous.sequence + 1 }));
    } catch {
      setAnnouncement((previous) => ({ text: `Could not copy ${name}. Try again with clipboard access enabled.`, sequence: previous.sequence + 1 }));
    }
  }

  return (
    <div className="icon-browser">
      <div className="icon-browser-controls">
        <label className="icon-browser-search" htmlFor={`${id}-search`}>
          Search icons
          <input id={`${id}-search`} type="search" placeholder="Name, tag, alias" value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <label htmlFor={`${id}-category`}>
          Category
          <select id={`${id}-category`} value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="">All categories</option>
            {categories.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
        <label htmlFor={`${id}-variant`}>
          Style
          <select id={`${id}-variant`} value={variant} onChange={(event) => setVariant(event.target.value)}>
            <option value="line">Line</option>
            <option value="solid">Solid</option>
          </select>
        </label>
        <label htmlFor={`${id}-size`}>
          Size
          <select id={`${id}-size`} value={size} onChange={(event) => setSize(Number(event.target.value))}>
            {SIZES.map((value) => <option key={value} value={value}>{value}px</option>)}
          </select>
        </label>
        <label htmlFor={`${id}-theme`}>
          Preview theme
          <select id={`${id}-theme`} value={theme} onChange={(event) => setTheme(event.target.value)}>
            {THEMES.map((value) => <option key={value} value={value}>{value === 'light' ? 'Light' : 'Dark'}</option>)}
          </select>
        </label>
      </div>
      <div className="icon-browser-summary">
        <p>{filtered.length} icons · {variant === 'line' ? 'Line' : 'Solid'} · {size}px</p>
        <p role="status" aria-live="polite" aria-atomic="true"><span key={announcement.sequence}>{announcement.text}</span></p>
      </div>
      <div className="icon-browser-preview" data-theme={theme}>
        {filtered.length === 0 ? <p>No icons found.</p> : groups.map(({ name, entries }) => entries.length > 0 && (
          <section key={name} aria-label={name}>
            <h3>{name}</h3>
            <ul className="icon-browser-grid">
              {entries.map((entry) => {
                const name = componentName(entry.name) + (variant === 'solid' ? 'Solid' : '');
                const Glyph = components.get(name);
                if (!Glyph) throw new Error(`Missing generated icon ${name}`);
                return (
                  <li key={entry.name}>
                    <button type="button" aria-label={`Copy ${name} import`} onClick={() => void copy(name)}>
                      <span className="icon-browser-glyph"><Glyph size={size} decorative /></span>
                      <span className="icon-browser-name">{name}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

const meta = {
  title: 'Icons/All icons',
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: { component: 'Find an icon and copy its import.' },
    },
  },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Gallery: Story = {
  name: 'Icon browser',
  parameters: { docs: { source: { code: "import { Search } from '@jfrader/icons';\n\n<Search size={24} decorative />" } } },
  render: () => <IconBrowser />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const notice = canvas.getByRole('status');
    await expect(notice.textContent).toBe('');
    await expect(notice).toHaveAttribute('aria-live', 'polite');
    await expect(notice).toHaveAttribute('aria-atomic', 'true');
    const search = canvas.getByRole('searchbox', { name: 'Search icons' });
    const initialCount = canvas.getAllByRole('button', { name: /^Copy .+ import$/ }).length;
    await userEvent.type(search, 'search');
    await expect(canvas.getAllByRole('button', { name: /^Copy .+ import$/ }).length).toBeLessThan(initialCount);
    await expect(canvas.queryByRole('button', { name: 'Copy Accessibility import' })).not.toBeInTheDocument();
    const navigator = canvasElement.ownerDocument.defaultView!.navigator;
    const descriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    const write = fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: write } });
    try {
      await userEvent.click(canvas.getByRole('button', { name: 'Copy Search import' }));
      await expect(write).toHaveBeenLastCalledWith("import { Search } from '@jfrader/icons'");
      await expect(notice).toHaveTextContent('Copied Search import.');
      await userEvent.clear(search);
      await userEvent.type(search, 'hearts');
      await expect(canvas.getByRole('button', { name: 'Copy Heart import' })).toBeVisible();
      await userEvent.selectOptions(canvas.getByLabelText('Style'), 'solid');
      await userEvent.click(canvas.getByRole('button', { name: 'Copy HeartSolid import' }));
      await expect(write).toHaveBeenLastCalledWith("import { HeartSolid } from '@jfrader/icons'");
      await expect(notice).toHaveTextContent('Copied HeartSolid import.');
      await waitFor(() => expect(notice.textContent).toBe(''), { timeout: COPY_NOTICE_DURATION + 1000 });
      await userEvent.clear(search);
      await userEvent.type(search, 'no-such-icon-123');
      await expect(canvas.getByText('No icons found.')).toBeVisible();
    } finally {
      if (descriptor) Object.defineProperty(navigator, 'clipboard', descriptor);
      else Reflect.deleteProperty(navigator, 'clipboard');
      await userEvent.clear(search);
      await userEvent.selectOptions(canvas.getByLabelText('Style'), 'line');
    }
  },
};
