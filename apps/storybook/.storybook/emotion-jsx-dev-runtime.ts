// Dev-mode JSX runtime shim.
// The dependency optimizer's CJS interop mangles Emotion's real jsx-dev-runtime inside
// the Storybook/Vitest pipeline (jsxDEV resolves to undefined), so we route dev JSX to
// Emotion's production runtime, which bundles cleanly. Test behavior is identical; the
// only loss is dev-only source info on elements.
export { Fragment, jsx as jsxDEV } from '@emotion/react/jsx-runtime';
