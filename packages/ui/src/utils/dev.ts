// One owner for development-only diagnostics. Bundlers replace `process.env.NODE_ENV`
// in consumer builds, so `isDev` folds to false and every call is silent in production.
// Guard a call site that builds a message (`if (isDev) devWarn(...)`) so a consumer
// build can drop the branch and its string. The helpers gate too, so a missed call-site
// guard cannot leak output.
declare const process: { env: { NODE_ENV?: string } };

/** True while the package runs outside a production build. */
export const isDev = process.env.NODE_ENV !== 'production';

/** Reports developer misuse. Gated here as well, so a missed call-site guard stays silent. */
export function devWarn(message: string, ...rest: unknown[]): void {
  if (isDev) console.warn(message, ...rest);
}

/** Reports a broken invariant that the component already degrades gracefully. Gated here as well. */
export function devError(message: string, ...rest: unknown[]): void {
  if (isDev) console.error(message, ...rest);
}
