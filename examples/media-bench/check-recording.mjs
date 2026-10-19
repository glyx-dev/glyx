// Checks a recording (picture and sound): node check-recording.mjs <file.mp4> [contact-sheet.png]
// Needs ffmpeg and ffprobe on the PATH. Prints what is in the file, whether it decodes cleanly, how loud the audio is and how far apart the
// two tracks start, and writes a contact sheet of frames across the recording that you can open to look at the picture.
import { spawnSync } from 'node:child_process';

const [file, sheet = file.replace(/\.[^.]+$/, '') + '-sheet.png'] = process.argv.slice(2);
if (!file) { console.error('usage: node check-recording.mjs <file.mp4> [contact-sheet.png]'); process.exit(2); }
const run = (cmd, args) => spawnSync(cmd, args, { encoding: 'utf8' });

const probe = JSON.parse(run('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file]).stdout || '{}');
const video = (probe.streams || []).find((s) => s.codec_type === 'video');
const audio = (probe.streams || []).find((s) => s.codec_type === 'audio');
if (!probe.streams) { console.log('FAIL: ffprobe cannot read the file (an unfinished recording from before the fragmented format would look like this)'); process.exit(1); }

console.log(`container  ${probe.format.format_name}, ${(Number(probe.format.size) / 1e6).toFixed(2)} MB, ${Number(probe.format.duration).toFixed(2)} s`);
console.log(video ? `video      ${video.codec_name} ${video.width}x${video.height}, ${(Number(video.bit_rate) / 1e6).toFixed(2)} Mbps, ${video.duration} s, starts at ${video.start_time}` : 'video      NONE');
console.log(audio ? `audio      ${audio.codec_name} ${audio.channels} ch ${audio.sample_rate} Hz, ${audio.duration} s, starts at ${audio.start_time}` : 'audio      none (the app needs the microphone capability, and not { audio: false })');

const decode = run('ffmpeg', ['-v', 'error', '-i', file, '-f', 'null', '-']).stderr.trim();
console.log(decode ? `decoding   ERRORS:\n${decode}` : 'decoding   clean');

if (audio) {
  const vol = run('ffmpeg', ['-hide_banner', '-i', file, '-vn', '-af', 'volumedetect', '-f', 'null', '-']).stderr;
  const mean = /mean_volume: (-?[\d.]+) dB/.exec(vol)?.[1], max = /max_volume: (-?[\d.]+) dB/.exec(vol)?.[1];
  console.log(`sound      mean ${mean} dB, peak ${max} dB ${Number(mean) < -60 ? ' (SILENT: nothing was recorded)' : ''}`);
  if (video) console.log(`sync       the tracks start ${Math.abs(Number(audio.start_time) - Number(video.start_time)) * 1000 | 0} ms apart, and end ${Math.abs(Number(audio.duration) - Number(video.duration)) * 1000 | 0} ms apart`);
}

if (video) {
  const secs = Number(probe.format.duration);
  // Six frames spread across the recording, side by side, a third of the size.
  const fps = 6 / Math.max(secs, 1);
  const r = run('ffmpeg', ['-v', 'error', '-y', '-i', file, '-vf', `fps=${fps},scale=iw/3:-1,tile=6x1`, '-frames:v', '1', sheet]);
  console.log(r.status === 0 ? `picture    contact sheet written to ${sheet}: open it to look` : `picture    could not make the contact sheet: ${r.stderr}`);
}
