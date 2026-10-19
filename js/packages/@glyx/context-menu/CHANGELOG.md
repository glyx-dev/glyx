# Changelog

## [Unreleased]

### Fixed
- **The menu opened in the wrong place and could be covered.** It was positioned inside the wrapper it came from but with the pointer's window coordinates, so it appeared away from the pointer, and later siblings (the next row of a list) were drawn over it, so its items could not be clicked. It now opens in the app's root popover layer (`openPopover`), at the pointer in window coordinates, never clipped or covered, and flipped above near the bottom edge.

### Added
- **Submenus, icons, shortcut labels and check marks.** An item can have `children` (a submenu, to any depth; it opens on hover or with Right, and goes to the left of its parent near the right edge of the window), an `icon` (a glyph or emoji, or any element), a `shortcut` or `accelerator` label at the right edge, and `checked` (a check mark; the item's `action` is passed the new state).
- **`native`: the operating system's own menu.** With `native`, Windows shows its own popup menu (submenus, check marks and accelerator labels in the system's look and behaviour) and the drawn menu is the fallback where there is none (macOS and Linux for now) or if the system menu cannot be shown. A native menu has no icons or red destructive items. The popup needs no capability.
- **Keyboard:** the arrow keys move through the items (skipping separators and disabled ones), Enter chooses, Escape closes. The row under the pointer is highlighted. Right-clicking elsewhere closes the menu too.
- **Written in TypeScript.** The source is now TypeScript (`src/index.ts`), strictly type-checked, and the package ships its declarations (`types/`), so TypeScript apps get types for the whole public API.

## [0.2.0] - 2026-10-05

- No changes in this package; released alongside Glyx 0.2.0.

## [0.1.0] - 2026-08-07

- Initial public release.
