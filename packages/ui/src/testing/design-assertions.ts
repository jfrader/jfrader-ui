import { vars } from '@jfrader/tokens/vars';

export const designAuditFamilies = [
  'photo-grid', 'control-center', 'share-access', 'voice-recorder', 'booking-pill',
  'logo-orbit', 'radial-menu', 'action-button', 'action-morph',
  'multi-region-failover', 'payment-flow', 'card-stack',
  'article', 'article-section', 'article-list', 'article-kicker', 'article-meta',
] as const;

const colorProperties = ['color', 'background-color', 'border-top-color', 'border-right-color',
  'border-bottom-color', 'border-left-color'] as const;
const radiusProperties = ['border-top-left-radius', 'border-top-right-radius',
  'border-bottom-left-radius', 'border-bottom-right-radius'] as const;
const UA_CONTROL_FONT_SIZE = 13.3333;
const FONT_SIZE_TOLERANCE = 0.01;

function tokenExpression(value: string) {
  return value.includes('var(--ui-color-') && !value
    .replace(/var\(--ui-color-[\w-]+\)/g, '')
    .replace(/color-mix|in|oklab|oklch|srgb|transparent|currentcolor/gi, '')
    .replace(/[\d.%,()\s-]/g, '');
}

function styleRules(document: Document): CSSStyleRule[] {
  const visit = (rules: CSSRuleList): CSSStyleRule[] => Array.from(rules).flatMap((rule) => {
    if (rule instanceof CSSStyleRule) return [rule];
    if (rule instanceof CSSMediaRule && !document.defaultView!.matchMedia(rule.conditionText).matches) return [];
    return 'cssRules' in rule ? visit((rule as CSSGroupingRule).cssRules) : [];
  });
  return Array.from(document.styleSheets).flatMap((sheet) => {
    try { return visit(sheet.cssRules); } catch { return []; }
  });
}

/** Audits rendered library roots, including portaled roots, without needing a Storybook server. */
export function auditDesign(document: Document, roots?: readonly Element[]): string[] {
  const view = document.defaultView!;
  const selected = roots ?? Array.from(document.querySelectorAll('[data-ui]')).filter((element) =>
    element.getAttribute('data-ui')!.split(/\s+/).some((token) =>
      designAuditFamilies.some((family) => token === family || token.startsWith(`${family}-`))),
  );
  const elements = new Set(selected.flatMap((root) => [root, ...root.querySelectorAll('*')]));
  if (!elements.size) return [];
  const failures: string[] = [];
  const rules = styleRules(document);
  const probe = document.createElement('span');
  probe.style.setProperty('display', 'none', 'important');
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const context = canvas.getContext('2d', { willReadFrequently: true })!;
  const colors = new Map<string, string>();
  const colorKey = (value: string) => {
    const cached = colors.get(value);
    if (cached) return cached;
    context.clearRect(0, 0, 1, 1);
    context.fillStyle = value;
    context.fillRect(0, 0, 1, 1);
    const key = [...context.getImageData(0, 0, 1, 1).data].join(',');
    colors.set(value, key);
    return key;
  };
  const propertyName = (reference: string) => reference.slice(4, -1);
  const tokenColors = Object.values(vars.color).map(propertyName);
  const tokenRadii = Object.values(vars.radius).map(propertyName);
  try {
    for (const element of elements) {
      if (!(element instanceof view.HTMLElement) || element === probe) continue;
      const style = view.getComputedStyle(element);
      const label = element.getAttribute('data-ui') ?? `${element.tagName.toLowerCase()}.${element.className}`;
      if (element.matches('button, input:not([type="hidden"]), select, textarea')) {
        if (Math.abs(Number.parseFloat(style.fontSize) - UA_CONTROL_FONT_SIZE) < FONT_SIZE_TOLERANCE) {
          failures.push(`${label}: native control uses UA font size ${style.fontSize}`);
        }
        const families = [vars.font.sans, vars.font.mono].map((font) => {
          probe.style.fontFamily = font;
          element.parentElement!.append(probe);
          return view.getComputedStyle(probe).fontFamily;
        });
        if (!families.includes(style.fontFamily)) failures.push(`${label}: non-token control font ${style.fontFamily}`);
      }
      if (!element.getClientRects().length || style.visibility === 'hidden' || Number(style.opacity) === 0) continue;
      element.parentElement!.append(probe);
      const palette = new Set(['0,0,0,0']);
      for (const color of tokenColors) {
        const value = style.getPropertyValue(color).trim();
        if (value) palette.add(colorKey(value));
        probe.style.setProperty(color, value);
      }
      const matchedRules = rules.filter((rule) => {
        try { return element.matches(rule.selectorText); } catch { return false; }
      });
      const derivations = [...matchedRules.map((rule) => rule.style), element.style]
        .flatMap((declarations) => [...colorProperties, 'background'].map((property) => declarations.getPropertyValue(property)))
        .filter(tokenExpression);
      for (const color of derivations) {
        probe.style.color = color;
        palette.add(colorKey(view.getComputedStyle(probe).color));
      }
      for (const property of colorProperties) {
        if (property.startsWith('border-')) {
          const side = property.replace('-color', '');
          if (style.getPropertyValue(`${side}-style`) === 'none' || Number.parseFloat(style.getPropertyValue(`${side}-width`)) === 0) continue;
        }
        const color = style.getPropertyValue(property);
        if (!palette.has(colorKey(color))) failures.push(`${label}: ${property} ${color} is outside the token palette`);
      }
      const radii = new Set(['0px', '50%']);
      for (const radius of tokenRadii) {
        const value = style.getPropertyValue(radius).trim();
        if (value) radii.add(value);
      }
      for (const property of radiusProperties) {
        const radius = style.getPropertyValue(property);
        if (!radii.has(radius)) failures.push(`${label}: ${property} ${radius} is outside the token scale`);
      }
    }
  } finally {
    probe.remove();
  }
  return [...new Set(failures)];
}
