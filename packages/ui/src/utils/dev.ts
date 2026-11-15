// One owner for development-only diagnostics. Bundlers replace `process.env.NODE_ENV`
// in consumer builds, so a production build keeps every call silent; the guard lives
// here instead of being repeated at each call site.
declare const process: { env: { NODE_ENV?: string } };

/** True while the package runs outside a production build. */
export const isDev = process.env.NODE_ENV !== 'production';

/** Reports developer misuse. Silent in production builds. */
export function devWarn(message: string, ...rest: unknown[]): void {
  if (isDev) console.warn(message, ...rest);
}

/** Reports a broken invariant that the component already degrades gracefully. Silent in production builds. */
export function devError(message: string, ...rest: unknown[]): void {
  if (isDev) console.error(message, ...rest);
}
