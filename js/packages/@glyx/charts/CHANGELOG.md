# Changelog

## [Unreleased]

### Added (chart types and sizing)
- **Grouped and stacked bars:** `BarChart` takes `series`; several series sit side by side, or pile up with `stacked`. Stacked areas too: `AreaChart stacked`.
- **New charts:** `ScatterChart` (bubbles when points have a `size`), `CandlestickChart`, `Sparkline`.
- **Charts can follow their container:** `width="100%"` / `height="100%"` (any percentage string) measures the container and redraws at its size. Numeric sizes behave as before.
- **Wheel zoom:** with `zoomPan`, Ctrl + wheel (or a trackpad pinch) zooms about the pointer; a plain wheel still scrolls the page.
- `examples/chart-gallery` shows all of them.

### Changed
- **A visual redesign of every chart.**
  - Axes use round tick values (0, 500, 1000…) instead of values like 449.5.
  - Labels are measured and aligned, so they never overlap or get clipped at the edges, and gridlines are faint with no heavy axis box.
  - Lines are smooth curves that never overshoot the data.
  - Area fills fade out with a gradient, bars have rounded tops, and donut segments have gaps.
  - Charts fade in when they appear.
- **The tooltip follows the pointer.** It snaps to the nearest point, with a dashed crosshair and ringed markers, where before it only appeared when hovering exactly over a point. It's now a card with series colours.
- **Bars:** hovering one dims the others. **Donuts:** the centre shows the total, or the hovered segment's value and share, and the legend shows percentages.
- Point markers (`showDots`) now default to on only when there are 14 points or fewer.
- `showTooltip={false}` hides the tooltip card only. The chart stays keyboard- and screen-reader-accessible.

### Added
- `series={[{ name, data, color }]}` on `LineChart` and `AreaChart`, for several series with an automatic legend.
- `theme`: `'dark'` (default), `'light'`, or an object of colour overrides. `THEMES` is exported.
- `title`, `formatValue`, `formatLabel`, `smooth`, `palette`; `centerLabel` for donuts. `Legend` items can show a `value`.
- **Accessibility:** every chart is a focusable figure with a spoken summary (range, lowest, highest, latest). Arrow keys move between points and each point is announced, Home/End jump to the ends, Enter activates the point (`onPointPress`), and Escape returns to the summary. `Legend` toggles are switches.

## [0.1.0] - 2026-08-07

- Initial public release.
