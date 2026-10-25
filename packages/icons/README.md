# Icons

`@jfrader/icons` owns `SvgIcon` and `createSvgIcon`. It builds on `@jfrader/styling` and
`@jfrader/tokens`, below the `@jfrader/ui` components package. Both helpers remain available from
`@jfrader/ui` and `@jfrader/ui/svg-icon`, and are also exported from `@jfrader/icons/svg-icon`.

`src/icons/*.svg` and `src/icons/solid/*.svg` are hand-written sources. `src/metadata.ts` holds
search metadata. Components in `src/generated/` and `icons.json` are generated; do not edit them.

- `pnpm generate` regenerates components and metadata from the repository root.
- `pnpm verify:icons` checks the sources, generated output, exports, and verifier fixtures.
