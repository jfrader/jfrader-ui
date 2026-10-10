/** The DOM id of a value-keyed part; the value is encoded so any string yields a valid id. */
export const partId = (baseId: string, part: string, value: string) =>
  `${baseId}-${part}-${encodeURIComponent(value)}`;
