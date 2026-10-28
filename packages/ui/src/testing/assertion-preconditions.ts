export function requireNonEmpty<T>(items: Iterable<T>, label: string): T[] {
  const values = Array.from(items);
  if (values.length === 0) throw new Error(`${label}: expected a nonempty collection`);
  return values;
}

export function requireElement<T extends Element>(element: T | null | undefined, label: string): T {
  if (element == null) throw new Error(`${label}: expected an element`);
  return element;
}
