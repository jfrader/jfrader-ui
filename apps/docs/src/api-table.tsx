import { ApiTable, type ApiPropDoc } from '@jfrader/ui';
import type { ApiRendererProps } from '@jfrader/react-storydocs';

/**
 * The design system's own API section. The engine extracts props, overloads and type parameters;
 * `signature` tells a prop which overload it belongs to, which this side names as a mode.
 */

/** The slot descriptions already state the rendered default; lift it into structured metadata. */
function defaultFromDescription(description?: string): Pick<ApiPropDoc, 'component' | 'defaultElement'> {
  const text = description ?? '';
  const component = text.match(/Uses? `([A-Z][\w.]*)` by default/i);
  if (component) return { component: { name: component[1] } };
  const element = text.match(/Renders? (?:an? )?`([a-z][\w-]*)`/i);
  if (element) return { defaultElement: element[1] };
  const explicit = text.match(/Defaults to (?:an? )?`([a-z][\w-]*)`/i);
  if (explicit) return { defaultElement: explicit[1] };
  return {};
}

function withMemberDefaults(prop: ApiPropDoc): ApiPropDoc {
  if (!prop.members?.length) return prop;
  return {
    ...prop,
    members: prop.members.map((member) => {
      const inferred = defaultFromDescription(member.description);
      return {
        ...member,
        component: member.component ?? inferred.component,
        defaultElement: member.defaultElement ?? inferred.defaultElement,
      };
    }),
  };
}

export default function Api({ components }: ApiRendererProps) {
  if (!components) return null;
  return (
    <ApiTable
      components={components.map(({ props, ...component }, index) => ({
        ...component,
        // The page lede already introduces the root; only parts need a second description.
        description: index === 0 ? undefined : component.description,
        props: props.map(({ signature, ...prop }) => ({
          ...prop,
          mode: signature === 0 ? 'shorthand' : signature === 1 ? 'composed' : undefined,
        })),
      }))}
    />
  );
}
