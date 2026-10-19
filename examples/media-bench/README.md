# media-bench

Plays one video on a loop, or shows the camera and records it, to measure what that costs: CPU, memory and frame time. It is a measuring tool, not a demo (see `media-player` for that).

1. Make a test video, for instance
   `ffmpeg -f lavfi -i testsrc2=size=1920x1080:rate=30 -f lavfi -i sine=frequency=440 -t 20 -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest v1080p.mp4`
2. Set `VIDEO` in `src/app.jsx` to its path (`SHOW` is `'fit'`, scaled to the window width, or `'native'`). `MODE` is `'video'`, `'camera'` (the first camera, drawn 960 x 540) or `'record'` (the camera, recorded to `RECORD_TO` for `RECORD_SECS` seconds after three).
   The camera needs the runner built with glyx-core's `camera` feature (see the note in `extra_perf.md`, section 12): the prebuilt JS-only runner does not have it.
3. `glyx dev --devtools`, and read CPU and memory in the Task Manager or sample the process; the DevTools frame stream (`Performance.frame`) has the render and present time of each frame.

Numbers from this machine are in `extra_perf.md` (media section) in the repository root.

## Checking a recording (picture and sound)

Set `MODE = 'record'` and `RECORD_TO` in `src/app.jsx` and run `glyx dev`: the app shows the camera, records it for `RECORD_SECS` seconds after three and saves the file (the app has the `microphone` capability, so the sound is recorded too).

- **Look and listen:** open the file in any player (VLC, Windows Media Player, or the `media-player` example). Speak while it records, and clap once to check that the picture and sound line up.
- **Check it with numbers:** `node check-recording.mjs <file.mp4>` (needs `ffmpeg` and `ffprobe` on the PATH) prints the codecs, sizes and durations, whether the file decodes cleanly, how loud the sound is (a silent track shows as about -91 dB), how far apart the two tracks start, and writes a contact sheet of six frames across the recording (`<file>-sheet.png`) to look at.
- **Crash test:** kill the app (`taskkill /F /IM glyx-runner.exe`) while it is recording and check the file: it should still play, up to its last second.
