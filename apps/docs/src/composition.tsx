import type { ReactNode } from 'react';
import { Surface } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

interface CatalogRef {
  name: string;
  slug: string;
}

interface PropMember {
  name: string;
  description?: string;
  component?: CatalogRef;
  members?: PropMember[];
}

interface ComponentDoc {
  name: string;
  props: PropMember[];
}

export interface CompositionProps {
  entry: { slug: string; name: string; group: string };
  components: ComponentDoc[] | null;
  uses: CatalogRef[];
}

interface SlotRow {
  name: string;
  description: string;
  component?: CatalogRef;
}

const panelStyle = {
  display: 'grid',
  gap: vars.space['3'],
  padding: vars.space['4'],
  '& a': {
    color: vars.color.accentText,
    textUnderlineOffset: '0.15em',
  },
  '& a:focus-visible': {
    outline: `2px solid ${vars.color.focusRing}`,
    outlineOffset: '2px',
  },
  '& dl, & ul': {
    display: 'grid',
    gap: vars.space['2'],
    margin: 0,
    padding: 0,
    listStyle: 'none',
  },
  '& dt': { fontWeight: vars.fontWeight.medium },
  '& dd': {
    margin: 0,
    color: vars.color.textMuted,
  },
} as const;

function collectSlots(components: ComponentDoc[]): SlotRow[] {
  const rows = new Map<string, SlotRow>();
  for (const component of components) {
    for (const prop of component.props) {
      if (prop.name !== 'slots' && prop.name !== 'slotProps') continue;
      for (const member of prop.members ?? []) {
        const previous = rows.get(member.name);
        rows.set(member.name, {
          name: member.name,
          description: member.description || previous?.description || '',
          component: member.component ?? previous?.component,
        });
      }
    }
  }
  return [...rows.values()].sort((a, b) => Number(b.name === 'root') - Number(a.name === 'root') || a.name.localeCompare(b.name));
}

function ComponentLink({ component }: { component: CatalogRef }) {
  return <a href={`#/components/${component.slug}`}>{component.name}</a>;
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2>{title}</h2>
      <Surface variant="flat" sx={panelStyle}>{children}</Surface>
    </section>
  );
}

export default function Composition({ entry, components, uses }: CompositionProps) {
  if (!components) return null;
  const slots = collectSlots(components).map((slot) => (
    slot.component?.slug === entry.slug ? { ...slot, component: undefined } : slot
  ));
  const related = uses.filter((item) => item.slug !== entry.slug);
  if (slots.length === 0 && related.length === 0) return null;
  return (
    <>
      {slots.length > 0 ? (
        <Panel title="Slots">
          <dl>
            {slots.map((slot) => (
              <div key={slot.name}>
                <dt><code>{slot.name}</code></dt>
                <dd>
                  {slot.description ? <span>{slot.description} </span> : null}
                  {slot.component ? <ComponentLink component={slot.component} /> : null}
                </dd>
              </div>
            ))}
          </dl>
        </Panel>
      ) : null}
      {related.length > 0 ? (
        <Panel title="Uses">
          <ul>
            {related.map((item) => (
              <li key={item.slug}><ComponentLink component={item} /></li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </>
  );
}
