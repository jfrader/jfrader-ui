# `@jfrader/styling`

The Emotion seam the design system is built on. Apps can import it to use the same `sx` contract and
theme typing as the components.

Use component props and `sx` first. Reach for this package when you build something the components do
not cover and need the same styling conventions. For styling existing components, see
[Styling](https://github.com/jfrader/jfrader-ui/blob/master/docs/styling.md).

## Exports

| Import path | Exports and usage |
| --- | --- |
| `@jfrader/styling` | All exports from the subpaths below. Use the root when you need several of them together. |
| `@jfrader/styling/css` | Emotion's `css`, `keyframes`, `CacheProvider`, `ClassNames`, `EmotionThemeProvider`, and `useEmotionTheme`, plus `ClassNamesContent`, `Interpolation`, `SerializedStyles`, `Theme`, and `JfraderTheme` types. Use it for Emotion styles, animation, cache access, or theme context in your own components. |
| `@jfrader/styling/sx` | `SxProps`, `WithSx`, and `withoutSx`. Use them to accept `sx`, merge styles through `WithSx`'s class-name render callback, and remove `sx` before forwarding props to the DOM. |
| `@jfrader/styling/theme` | `theme`, the token `var()` reference object, and `JfraderTheme`, with Emotion's `Theme` type augmentation. Use it for typed token references and theme callbacks. |
| `@jfrader/styling/media` | `REDUCED_MOTION`, `FORCED_COLORS`, `COARSE_POINTER`, and `REDUCED_TRANSPARENCY` media query strings. Use them for preference and input adaptations in your own styles. |
| `@jfrader/styling/native-scrollbar` | `nativeScrollbarStyle`, a serialized style using the control-border token and automatic colors in forced-colors mode. Use it to match the components' native scrollbar styling. |

## API contract

The listed exports and the `sx` contract are public API. `sx` accepts Emotion interpolations,
including style objects, arrays, serialized styles, and theme callbacks, and applies after component
styles and Emotion classes in `className`. Normal CSS specificity and importance still apply.
See [Styling](https://github.com/jfrader/jfrader-ui/blob/master/docs/styling.md) for usage and provider
requirements.

Internals can change between minor releases. Import only from the listed paths, not from source or
build files.
