import { Divider, Pill, Surface, styled } from '@jfrader/ui';
import { vars } from '@jfrader/tokens/vars';

interface CatalogRef {
  name: string;
  slug: string;
}

interface PropMember {
  name: string;
  type: string;
  required?: boolean;
  description?: string;
  component?: CatalogRef;
  part?: string;
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
  replaced: boolean;
  component?: CatalogRef;
  part?: string;
  props: PropMember[];
}

const Panel = styled(Surface)({
  display: 'grid',
  gap: vars.space['3'],
  paddingBlock: vars.space['4'],
  paddingInline: vars.space['5'],
});

const Intro = styled.p({
  color: vars.color.textMuted,
  margin: 0,
});

const List = styled.ul({
  display: 'grid',
  gap: vars.space['3'],
  margin: 0,
  padding: 0,
  listStyle: 'none',
});

const Slot = styled.li({
  display: 'grid',
  gap: vars.space['2'],
});

const Head = styled.div({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: vars.space['2'],
});

const Name = styled.code({
  fontFamily: vars.font.mono,
  fontSize: vars.textSize.sm,
  background: vars.color.surfaceInset,
  borderRadius: vars.radius.sm,
  paddingInline: vars.space['1'],
  paddingBlock: '0.1em',
});

const Note = styled.p({
  color: vars.color.textMuted,
  margin: 0,
});

const Missing = styled.p({
  color: vars.color.textSubtle,
  margin: 0,
});

const Contract = styled.details({
  '& summary': {
    color: vars.color.textMuted,
    cursor: 'pointer',
    fontSize: vars.textSize.sm,
  },
  '& dl': {
    display: 'grid',
    gap: vars.space['2'],
    marginBlock: vars.space['2'],
    marginInline: 0,
  },
  '& dt': {
    fontFamily: vars.font.mono,
    fontSize: vars.textSize.sm,
  },
  '& dd': {
    color: vars.color.textMuted,
    fontSize: vars.textSize.sm,
    margin: 0,
  },
});

const Link = styled.a({
  color: vars.color.accentText,
  fontWeight: vars.fontWeight.medium,
  textUnderlineOffset: '0.15em',
  '&:focus-visible': {
    outline: `2px solid ${vars.color.focusRing}`,
    outlineOffset: '2px',
  },
});

/** `slotProps` styles a generated part; `slots` replaces it. Both list the same keys. */
function collectSlots(components: ComponentDoc[]): SlotRow[] {
  const membersOf = (component: ComponentDoc, prop: string) =>
    component.props.find((candidate) => candidate.name === prop)?.members ?? [];
  const rows = new Map<string, SlotRow>();
  for (const component of components) {
    const replaceable = new Set(membersOf(component, 'slots').map((member) => member.name));
    for (const member of [...membersOf(component, 'slotProps'), ...membersOf(component, 'slots')]) {
      const previous = rows.get(member.name);
      rows.set(member.name, {
        name: member.name,
        description: member.description || previous?.description || '',
        replaced: replaceable.has(member.name),
        component: member.component ?? previous?.component,
        part: member.part ?? previous?.part,
        // A part's own contract is nested one level deeper; that is the list worth showing.
        props: member.members?.[0]?.members ?? member.members ?? previous?.props ?? [],
      });
    }
  }
  return [...rows.values()].sort((a, b) => Number(b.name === 'root') - Number(a.name === 'root') || a.name.localeCompare(b.name));
}

function SlotLink({ component }: { component: CatalogRef }) {
  return <Link href={`#/components/${component.slug}`}>{component.name}</Link>;
}

/** A part can be swapped for your component (`slots`) or receive props (`slotProps`). */
function capability(slot: SlotRow): string {
  return slot.replaced ? 'replaceable' : 'props only';
}

/** Says how many parts there are and which of them accept a replacement, without an empty "the rest". */
function summarize(slots: SlotRow[]): string {
  const total = `${slots.length} ${slots.length === 1 ? 'part' : 'parts'}`;
  const replaceable = slots.filter((slot) => slot.replaced).length;
  if (replaceable === 0) return `${total}; every one takes props.`;
  if (replaceable === slots.length) return `${total}; every one can be replaced.`;
  return `${total}; ${replaceable} can be replaced, the rest take props.`;
}

function SlotDefault({ slot }: { slot: SlotRow }) {
  if (slot.component) return <>Default: <SlotLink component={slot.component} /></>;
  if (slot.part) return <>Selector: <Name>{`[data-ui~="${slot.part}"]`}</Name></>;
  return null;
}

function SlotContract({ props }: { props: PropMember[] }) {
  if (props.length === 0) return null;
  return (
    <Contract>
      <summary>{props.length === 1 ? '1 prop' : `${props.length} props`}</summary>
      <dl>
        {props.map((prop) => (
          <div key={prop.name}>
            <dt>{prop.name}{prop.required ? '' : '?'}</dt>
            <dd>{prop.description || prop.type}</dd>
          </div>
        ))}
      </dl>
    </Contract>
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
        <section>
          <h2>Slots</h2>
          <Panel variant="flat">
            <Intro>{summarize(slots)}</Intro>
            <List>
              {slots.map((slot, index) => (
                <Slot key={slot.name}>
                  <Head>
                    <Name>{slot.name}</Name>
                    <Pill tone={slot.replaced ? 'accent' : 'neutral'}>{capability(slot)}</Pill>
                    <Note><SlotDefault slot={slot} /></Note>
                  </Head>
                  {slot.description ? <Note>{slot.description}</Note> : <Missing>No description.</Missing>}
                  <SlotContract props={slot.props} />
                  {index < slots.length - 1 ? <Divider /> : null}
                </Slot>
              ))}
            </List>
          </Panel>
        </section>
      ) : null}
      {related.length > 0 ? (
        <section>
          <h2>Uses</h2>
          <Panel variant="flat">
            <List>
              {related.map((item) => (
                <Slot key={item.slug}><SlotLink component={item} /></Slot>
              ))}
            </List>
          </Panel>
        </section>
      ) : null}
    </>
  );
}
