# Changelog

## [Unreleased]

### Fixed
- **Nothing was ever actually stored.** The native credential layer uses the `keyring` crate, which enables no OS backend by default and silently falls back to an in-memory mock store. `set` appeared to succeed, but the next `get` found nothing, and nothing ever reached Windows Credential Manager, the macOS Keychain or the Linux Secret Service. The real OS store is now selected for each platform. Linux builds now need `libdbus-1-dev`.
- `get` returned the stored JSON text instead of the value: `'"abc"'` with quotes for strings, and strings instead of objects. The package's test mocked the native binding without the JSON envelope the real binding adds, so it passed for the wrong reason. The mock now matches the real binding, and `get` decodes what `set` encoded. A plain, non-JSON value written by other code is returned as-is.

## [0.1.0] - 2026-08-07

- Initial public release.
