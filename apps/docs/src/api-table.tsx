import { ApiTable, type ApiPropDoc, type ApiTypeRef } from '@jfrader/ui';
import type { ApiRendererProps } from '@jfrader/react-storydocs';

/**
 * The design system's own API section. The engine extracts props, overloads and type parameters;
 * `signature` tells a prop which overload it belongs to, which this side names as a mode.
 */

type EngineRef = { name: string; slug?: string; href?: string };
type EngineTypeRef = { name: string; source?: { file: string; line: number } };
const UI_SOURCE = 'packages/ui/src/';

/** Platform types have no declaration in this repository; point readers at the primary docs. */
const EXTERNAL_TYPE_URLS: Record<string, string> = {
  NumberFormatOptions: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat/NumberFormat#options',
  DateTimeFormatOptions: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/DateTimeFormat#options',
  LocalesArgument: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl#locales_argument',
  ReactNode: 'https://react.dev/reference/react/ReactNode',
  ComponentType: 'https://react.dev/learn/typescript#typing-component-props',
  Ref: 'https://react.dev/reference/react/useRef',
  CSSProperties: 'https://developer.mozilla.org/en-US/docs/Web/CSS',
};

/** Public types point at their declaration in the UI package. */
function sourceHref(ref: EngineTypeRef): ApiTypeRef | undefined {
  const index = ref.source?.file.indexOf(UI_SOURCE) ?? -1;
  if (!ref.source || index < 0) return undefined;
  const file = ref.source.file.slice(index + UI_SOURCE.length);
  return { name: ref.name, href: `https://github.com/jfrader/jfrader-ui/blob/master/packages/ui/src/${file}#L${ref.source.line}` };
}

function externalTypeRefs(type: string): ApiTypeRef[] {
  return [...new Set([...type.matchAll(/\b[A-Z][A-Za-z0-9_$]*\b/g)].map((match) => match[0]))]
    .flatMap((name) => (EXTERNAL_TYPE_URLS[name] ? [{ name, href: EXTERNAL_TYPE_URLS[name] }] : []));
}

function withTypeRefs(type: string, refs: readonly EngineTypeRef[] | undefined): ApiTypeRef[] | undefined {
  const byName = new Map<string, ApiTypeRef>();
  for (const ref of (refs ?? []).map(sourceHref)) if (ref) byName.set(ref.name, ref);
  for (const ref of externalTypeRefs(type)) if (!byName.has(ref.name)) byName.set(ref.name, ref);
  return byName.size ? [...byName.values()] : undefined;
}

function withHref(ref: EngineRef | undefined): ApiTypeRef | undefined {
  if (!ref) return undefined;
  return { name: ref.name, href: ref.href ?? (ref.slug ? `#/components/${ref.slug}` : undefined) };
}

/** Resolve the engine's catalog slugs to docs links at the adapter boundary. */
function withLinks(prop: ApiPropDoc): ApiPropDoc {
  return {
    ...prop,
    typeRefs: withTypeRefs(prop.type, prop.typeRefs as readonly EngineTypeRef[] | undefined),
    component: withHref(prop.component as EngineRef | undefined),
    inheritedComponent: withHref(prop.inheritedComponent as EngineRef | undefined),
    members: prop.members?.map(withLinks),
    element: prop.element ? { ...prop.element, typeRefs: withTypeRefs(prop.element.type, prop.element.typeRefs as readonly EngineTypeRef[] | undefined), members: prop.element.members.map(withLinks) } : undefined,
    signatures: prop.signatures?.map((signature) => ({
      ...signature,
      typeRefs: withTypeRefs(signature.type, signature.typeRefs as readonly EngineTypeRef[] | undefined),
      parameters: signature.parameters.map((parameter) => ({
        ...parameter,
        typeRefs: withTypeRefs(parameter.type, parameter.typeRefs as readonly EngineTypeRef[] | undefined),
        members: parameter.members?.map(withLinks),
      })),
    })),
  };
}

export default function Api({ components }: ApiRendererProps) {
  if (!components) return null;
  return (
    <div style={{ marginBlock: '24px 32px' }}>
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
    </div>
  );
}
