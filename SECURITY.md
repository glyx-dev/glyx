# Security Policy

## Reporting a vulnerability

Please **do not open a public issue** for security vulnerabilities.

Report privately via
[GitHub Security Advisories](https://github.com/glyx-dev/glyx/security/advisories/new),
or email **adelabutobi@gmail.com** with:

- A description of the issue and its impact
- Steps to reproduce or a proof of concept
- The commit or version affected

You'll get an acknowledgment within a few days. Since Glyx is pre-release,
fixes ship in the next release rather than as backported patches.

## Scope

Especially interested in:

- **Capability system bypasses** — any way for app JS to reach the
  filesystem, network, env, or system APIs without the corresponding
  capability declared in `glyx.config.json`
- **V8 sandbox escapes** through the `__glyx_*` native bindings
- **Path traversal** in fs capability scoping
- Unsafe deserialization in the binary canvas protocol or IPC surfaces

## Supported versions

Pre-1.0, only the latest release receives security fixes.
