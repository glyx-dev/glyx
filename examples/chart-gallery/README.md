# chart-gallery

One of every `@glyx-dev/charts` type, in a scrolling page:

- sparklines in stat cards
- grouped and stacked bars (`series`, `stacked`)
- stacked area (`AreaChart stacked`)
- scatter and bubble (`ScatterChart`, points with a `size`)
- candlestick (`CandlestickChart`)
- a zoomable line chart: Ctrl + wheel, a trackpad pinch, or the buttons

Every chart except the sparklines is sized `width="100%"`, so it measures its panel and follows it when the window is resized.

```sh
cd examples/chart-gallery
glyx dev --devtools
```

Screenshots are in [`screenshots/`](./screenshots).
