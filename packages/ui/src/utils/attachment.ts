import { numberFormatter } from './intl';

/**
 * Sanitizes and validates a URL for use in attachment links and images.
 * Only http:, https:, and blob: protocols are permitted. Unsafe characters,
 * spaces, backslashes, and other protocols (such as javascript:) return undefined.
 */
export function safeUrl(url: string | undefined): string | undefined {
  if (!url || /[\u0000-\u0020\u007f\\]/u.test(url)) return undefined;
  try {
    return ['http:', 'https:', 'blob:'].includes(new URL(url, 'https://attachments.invalid/').protocol)
      ? url
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Formats a byte count into a localized human-readable file size string (B, kB, MB).
 */
export function fileSize(size: number, locale?: Intl.LocalesArgument): string {
  const safeSize = Math.max(0, Number.isFinite(size) ? size : 0);
  const units =
    safeSize >= 1_000_000
      ? { size: 1_000_000, unit: 'megabyte' }
      : safeSize >= 1_000
      ? { size: 1_000, unit: 'kilobyte' }
      : { size: 1, unit: 'byte' };
  return numberFormatter(locale, {
    style: 'unit',
    unit: units.unit,
    maximumFractionDigits: 1,
  }).format(safeSize / units.size);
}

/**
 * Checks whether a File matches an HTML accept filter string (e.g. '.pdf,image/*,image/png').
 */
export function acceptsFile(file: File, accept: string | undefined): boolean {
  if (!accept?.trim()) return true;
  return accept.split(',').some((part) => {
    const rule = part.trim().toLowerCase();
    if (rule.startsWith('.')) return file.name.toLowerCase().endsWith(rule);
    if (rule.endsWith('/*')) return file.type.toLowerCase().startsWith(rule.slice(0, -1));
    return file.type.toLowerCase() === rule;
  });
}
