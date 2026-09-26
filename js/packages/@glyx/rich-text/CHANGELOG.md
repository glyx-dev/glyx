# Changelog

## [Unreleased]

### Fixed
- Formatting part of the text no longer hides the space before it. A span ending in a space ("Hello " before a bold "world") was laid out without that space, and it only came back after reopening the file. Clicks after such a span also land on the right character now.
- Bolding or un-bolding part of a word no longer leaves a small gap (or overlap) after it. The restyled text is now re-measured (fix in `@glyx-dev/react`'s native layout).
- Clicks and drags in an editor that is partly scrolled out of an enclosing `ScrollView` now land on the right line. Offsets are measured from the editor's real origin instead of the clip edge.
- The editor's vertical scroll limit, caret-follow scrolling and horizontal scrollbar track use the editor's full size, not only the part left visible by an outer scroller.
- Per-span click resolution now uses the same native character-boundary rule as `TextInput` and `SelectableText`, so the same click can't resolve differently depending on which component owns the text.


## [0.1.0] - 2026-08-07

- Initial public release.
