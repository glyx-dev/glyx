# Realtime chart

A line chart and an area chart fed by a stream that you can speed up to 1000 values per second. It shows how `useChartStream` keeps a live chart smooth: values are pushed as fast as they arrive, the charts update at most 30 times a second, and the fixed-length window lets the native transition ease from one update to the next instead of redrawing with a jump. At this rate the charts glide over the gap between updates, so they stay in step with the data.

The counter under the title shows the two rates side by side: values in per second, and chart updates per second.

**Mode:** JS-only dev (runs on the prebuilt `glyx-runner` — no Rust compile).

## Run it

```bash
cd examples/realtime-chart
glyx dev
```
