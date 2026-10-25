import * as icons from './generated/index';
import metadata from '../icons.json';
import { componentName } from './name';
import './gallery.css';

const SIZES = [16, 20, 24, 32] as const;
const THEMES = ['light', 'dark'] as const;
const components = new Map(Object.entries(icons));

const meta = {
  title: 'Icons/Gallery',
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: { description: { component: 'Line and solid icons at 16, 20, 24, and 32px.' } },
  },
};
export default meta;

export const Gallery = {
  name: 'All icons',
  render: () => (
    <div className="icon-gallery">
      {THEMES.map((theme) => (
        <section key={theme} data-theme={theme} className="icon-gallery-theme" aria-label={`${theme} icons`}>
          <h2>{theme === 'light' ? 'Light' : 'Dark'}</h2>
          <table>
            <thead><tr><th scope="col">Icon</th>{SIZES.map((size) => <th key={size} scope="col">{size}px</th>)}</tr></thead>
            <tbody>
              {metadata.flatMap((entry) => entry.variants.map((variant) => {
                const name = componentName(entry.name) + (variant === 'solid' ? 'Solid' : '');
                const Glyph = components.get(name);
                if (!Glyph) throw new Error(`Missing generated icon ${name}`);
                return (
                  <tr key={`${entry.name}-${variant}`}>
                    <th scope="row">{entry.name}{variant === 'solid' ? ' (solid)' : ''}</th>
                    {SIZES.map((size) => <td key={size}><Glyph size={size} /></td>)}
                  </tr>
                );
              }))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  ),
};
