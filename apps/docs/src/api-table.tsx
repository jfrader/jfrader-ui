import { ApiTable } from '@jfrader/ui';
import type { ApiRendererProps } from '@jfrader/react-storydocs';

/**
 * The design system's own API section. The engine extracts props, overloads and type parameters;
 * `signature` tells a prop which overload it belongs to, which this side names as a mode.
 */
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
