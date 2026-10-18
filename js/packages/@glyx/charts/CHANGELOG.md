# Changelog

## [Unreleased]

### Added
- **Finer drawing from the complete 2D canvas.** The tooltip crosshair is now a real dashed line (`setLineDash`), not a row of short strokes, so it stays crisp at any scale. New opt-in props, all off by default so existing charts look the same: `gridDash` (dashed gridlines, `true` or your own `[on, off]` lengths; the zero line stays solid), `labelRotation` (turn the x labels by a number of degrees, or `'auto'` to turn them 45 degrees only when they would overlap; the plot makes room below), `glow` on `LineChart` / `AreaChart` (a soft shadow of the line's colour), `shade="radial"` on `PieChart` (each slice lighter towards the middle), and `exportRef` on every chart (a ref or callback that receives the canvas, so `await ref.current.toPNG()` saves the chart as a PNG). Rotated labels ease with the rest of a chart's animation.
- **Hovering a line or area chart no longer redraws the whole chart.** The crosshair and the point dots now live in their own narrow canvas that glides sideways with the tooltip card (a native transform transition), so the chart's own canvas is left alone: a hover step used to redraw the chart and ease through about nine more full-chart frames. The chart's drawing data is also kept between renders, so a hover (a state change) no longer looks like new data to the canvas.
- **Written in TypeScript.** The source is now TypeScript (`src/index.ts`), strictly type-checked, and the package ships its declarations (`types/`), so TypeScript apps get types for the whole public API.
- **Typed props for every chart** (`LineChartProps`, `BarChartProps`, `PieChartProps`, `ScatterChartProps`, `CandlestickChartProps`, `SparklineProps`, `LegendProps`), the point shapes (`ChartPoint`, `PieSlice`, `ScatterPoint`, `Candle`), and `useChartStream` returns a typed `ChartStream`. `width`/`height` accept a number or a percentage such as `'100%'`.

## [0.2.0] - 2026-10-05

### Added (chart types and sizing)
- **Grouped and stacked bars:** `BarChart` takes `series`; several series sit side by side, or pile up with `stacked`. Stacked areas too: `AreaChart stacked`.
- **New charts:** `ScatterChart` (bubbles when points have a `size`), `CandlestickChart`, `Sparkline`.
- **Charts can follow their container:** `width="100%"` / `height="100%"` (any percentage string) measures the container and redraws at its size. Numeric sizes behave as before.
- **Wheel zoom:** with `zoomPan`, Ctrl + wheel (or a trackpad pinch) zooms about the pointer; a plain wheel still scrolls the page.
- `examples/chart-gallery` shows all of them.

### Added (motion and realtime)
- **Charts ease to new data.** Each update draws the final chart once and the native engine moves the previous drawing toward it (`<Canvas transition>`), with no JavaScript per frame. A resized chart redraws instantly. `animate={false}` turns it off.
- **A gliding tooltip.** One persistent tooltip card moves between points on a spring and fades in and out. `tooltipMotion={false}` makes it appear and disappear at each point as before.
- **`useChartStream({ capacity, maxHz, initial })`** keeps a fixed-length window over a live feed and hands it to the charts at most `maxHz` times a second, so the UI does the same work whether 20 or 1000 values arrive per second. A window that keeps its length is what lets the chart ease between updates. `examples/realtime-chart` shows it.
- Curves use about one segment per pixel instead of twenty per point (roughly a third less stroke cost, no visible change), and pie arcs use a fixed segment count so a slice keeps its point count while it eases.

### Fixed
- `PieChart` ignored a percentage `width`/`height`, the one chart that didn't follow its container. It now does, like the others.
- Axis and legend labels are a little brighter in the dark theme (they measured 4.06:1 against a card, below the 4.5:1 WCAG AA asks for).

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
