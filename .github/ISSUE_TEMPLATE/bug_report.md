---
name: Bug report
about: Something broke, rendered wrong, or crashed
title: ''
labels: bug
assignees: ''
---

## What happened

A clear description of the bug — what you saw vs. what you expected.

## Reproduction

The smallest way to trigger it. Ideally:

```bash
npx glyx-cli create repro
# then the minimal app.jsx below
```

```jsx
// minimal app.jsx that shows the problem
```

Steps:
1.
2.
3.

## Environment

- **Glyx version / commit:**
- **OS:** (e.g. Windows 11, macOS 14.5, Ubuntu 24.04)
- **GPU:** (e.g. Intel UHD 620, NVIDIA RTX 3060, Apple M2)
- **Renderer backend:** (skia / vello / auto — printed at startup)
- **Node / Bun version:**

## Logs

Console output, panic message, or `glyx dev` output. For rendering issues a
screenshot helps a lot.

```
paste logs here
```

## Anything else

Workarounds you found, whether it regressed from an earlier version, etc.
