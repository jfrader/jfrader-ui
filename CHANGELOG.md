# Changelog

## Unreleased

### Added

- `Pattern`: decorative SVG tiles (`stripes`, `diagonal`, `checks`, `dots`, `waves`, `chevron`) with continuous tile edges, token inks, tile sizes and scaling, including custom flipped-card artwork. Forced colors hides the pattern and preserves the enclosing surface and border.
- `EditableDetails`: nested labelled details with independent app-owned editors, controlled disclosure, draft preservation on collapse, and keyboard focus recovery. Includes native form, React Action, React Hook Form, and overlay examples.

### Improved

- `ToastStack` keeps a `contained` stack inside its host when consumer styles add padding to it.
- `EditableDetails` uses aligned headings, quieter labels and separators only between rows. Nested sections no longer stack empty divider lines.
