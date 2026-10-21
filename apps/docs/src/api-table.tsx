import { ApiTable, type ApiPropDoc, type ApiTypeRef } from '@jfrader/ui';
import type { ApiRendererProps } from '@jfrader/react-storydocs';

/**
 * The design system's own API section. The engine extracts props, overloads and type parameters;
 * `signature` tells a prop which overload it belongs to, which this side names as a mode.
 */

type EngineRef = { name: string; slug?: string; href?: string };

function withHref(ref: EngineRef | undefined): ApiTypeRef | undefined {
  if (!ref) return undefined;
  return { name: ref.name, href: ref.href ?? (ref.slug ? `#/components/${ref.slug}` : undefined) };
}

/** Resolve the engine's catalog slugs to docs links at the adapter boundary. */
function withLinks(prop: ApiPropDoc): ApiPropDoc {
  return {
    ...prop,
    component: withHref(prop.component as EngineRef | undefined),
    inheritedComponent: withHref(prop.inheritedComponent as EngineRef | undefined),
    members: prop.members?.map(withLinks),
    element: prop.element ? { ...prop.element, members: prop.element.members.map(withLinks) } : undefined,
    signatures: prop.signatures?.map((signature) => ({
      ...signature,
      parameters: signature.parameters.map((parameter) => ({
        ...parameter,
        members: parameter.members?.map(withLinks),
      })),
    })),
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
        props: props.map(({ signature, ...prop }) => withLinks({
          ...prop,
          mode: signature === 0 ? 'shorthand' : signature === 1 ? 'composed' : undefined,
        })),
      }))}
    />
  );
}
