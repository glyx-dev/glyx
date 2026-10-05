# @glyx-dev/charts

GPU-rendered charts for Glyx — built on Canvas 2D path primitives. No DOM, no SVG.

Full docs: [glyx.dev](https://glyx.dev)

## Install

```sh
bun add @glyx-dev/charts
# or npm install @glyx-dev/charts
```

## Usage

```jsx
import { LineChart, BarChart, PieChart, AreaChart, Legend } from '@glyx-dev/charts';

function Dashboard() {
  return (
    <LineChart
      data={[{ x: 'Jan', y: 10 }, { x: 'Feb', y: 24 }, { x: 'Mar', y: 18 }]}
      width={600}
      height={300}
    />
  );
}
```

Charts are drawn with the Canvas path API (fill/stroke/arc + fillText) and only redraw when their props change — not on every frame — so they cost nothing while idle.

## API

- `LineChart(props)` — line chart component.
- `AreaChart(props)` — filled area chart component.
- `BarChart(props)` — bar chart component; `series` + `stacked` for grouped and stacked bars.
- `PieChart(props)` — pie/donut chart component.
- `ScatterChart(props)` — scatter plot; points with a `size` make a bubble chart.
- `CandlestickChart(props)` — OHLC candles.
- `Sparkline(props)` — a small axis-less line.
- `useChartStream(options)` — a fixed-length window over a live feed.

`width`/`height` accept a percentage string (`'100%'`) to follow the container. `AreaChart` takes `stacked`; `zoomPan` charts also zoom with Ctrl + wheel.
- `Legend({ items, onToggle, disabled, style })` — standalone legend, with optional series toggling (`onToggle`) and a `disabled` list to grey out hidden series.

All chart components take `data`, `width`, and `height` at minimum; consult each component's props in `src/index.js` for series-specific options (colors, axis formatting, hover/tooltip behavior).
