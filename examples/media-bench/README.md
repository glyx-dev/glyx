# media-bench

Plays one video on a loop, to measure what playback costs: CPU, memory and frame time. It is a measuring tool, not a demo (see `media-player` for that).

1. Make a test video, for instance
   `ffmpeg -f lavfi -i testsrc2=size=1920x1080:rate=30 -f lavfi -i sine=frequency=440 -t 20 -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest v1080p.mp4`
2. Set `VIDEO` in `src/app.jsx` to its path (`SHOW` is `'fit'`, scaled to the window width, or `'native'`).
3. `glyx dev --devtools`, and read CPU and memory in the Task Manager or sample the process; the DevTools frame stream (`Performance.frame`) has the render and present time of each frame.

Numbers from this machine are in `extra_perf.md` (media section) in the repository root.
