export function findConditionalStyle(element: Element, condition: string, property: string) {
  for (const sheet of Array.from(element.ownerDocument.styleSheets)) {
    for (const rule of Array.from(sheet.cssRules)) {
      if (!(rule instanceof CSSMediaRule) || !rule.conditionText.includes(condition)) continue;
      for (const inner of Array.from(rule.cssRules)) {
        if (!(inner instanceof CSSStyleRule)) continue;
        const matches = Array.from(element.classList).some((name) =>
          inner.selectorText.split(',').some((selector) => selector.trim() === `.${name}`),
        );
        const value = inner.style.getPropertyValue(property);
        if (matches && value) return value;
      }
    }
  }
  return undefined;
}
