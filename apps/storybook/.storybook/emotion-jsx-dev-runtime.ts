// Dev-mode JSX runtime shim.
// The dependency optimizer's CJS interop mangles Emotion's real jsx-dev-runtime inside
// the Storybook/Vitest pipeline (jsxDEV resolves to undefined), so we route dev JSX to
// Emotion's production runtimes, which bundle cleanly. isStaticChildren is honored so
// React keeps static-children semantics (jsxs); only dev-only source info is lost.
import { jsx, jsxs } from '@emotion/react/jsx-runtime';

export { Fragment } from '@emotion/react/jsx-runtime';

export const jsxDEV = ((type, props, key, isStaticChildren) =>
  isStaticChildren ? jsxs(type, props, key) : jsx(type, props, key)) as typeof jsx;
