# Changelog

## Unreleased

### Added

- `EditableDetails`: nested labelled details with independent app-owned editors, controlled disclosure, draft preservation on collapse, and keyboard focus recovery. Includes native form, React Action, React Hook Form, and overlay examples.

### Improved

- `ToastStack` keeps a `contained` stack inside its host when consumer styles add padding to it.
- `ToastStack` casts a single shadow for a collapsed pile, so the cards behind it stay white instead of turning grey on light surfaces.
- `EditableDetails` uses aligned headings, quieter labels and separators only between rows. Nested sections no longer stack empty divider lines.
