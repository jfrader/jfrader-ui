# Changelog

## Unreleased

### Added

- `Pattern`: decorative SVG tiles (`stripes`, `diagonal`, `checks`, `dots`, `waves`, `chevron`) with continuous tile edges, token inks, tile sizes and scaling, including custom flipped-card artwork. Forced colors hides the pattern and preserves the enclosing surface and border.
- `GameHand`: card fans with keyboard selection and an explicit play action, plus count-only hidden opponent hands.
- `EditableDetails`: nested labelled details with independent app-owned editors, controlled disclosure, draft preservation on collapse, and keyboard focus recovery. Includes native form, React Action, React Hook Form, and overlay examples.

### Improved

- `ToastStack` keeps a `contained` stack inside its host when consumer styles add padding to it.
- `ToastStack` casts a single shadow for a collapsed pile, so the cards behind it stay white instead of turning grey on light surfaces.
- `EditableDetails` uses aligned headings, quieter labels and separators only between rows. Nested sections no longer stack empty divider lines.
- Storybook groups `EditableDetails` form and picker examples under one Showcase entry.

### Changed

- Face-down GameCards use red-and-paper diagonal stripes in both themes.

### Fixed

- Face-down GameCards no longer show a pale strip or pale corners through their ink border.
