// Media Player — a Glyx example app.
//
// Music + video playback from local files, with a playlist (persisted in the
// bundled SQLite db) and per-track favorites.
//
// Notes:
//  - Audio uses the `audio` API (rodio + symphonia). Video uses the `<Video>`
//    component, which needs the glyx-media DLL (`glyx runtime build`). Music
//    works out of the box; video requires that one-time download.
//  - All files are addressed by absolute path returned from `dialog.openFile`.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, Video,
  render, audio, dialog, db, useWindowSize,
} from '@glyx-dev/react';
import { ThemeProvider, ToastProvider, useToast, WindowControls } from '@glyx-dev/design';

// ── Palette (sleek dark) ───────────────────────────────────────────────────────
const P = {
  bg:          '#0B0B0F',
  surface:     '#15151C',
  elevated:    '#1E1E28',
  border:      '#2A2A36',
  borderFaint: '#20202A',
  text:        '#F5F5F7',
  muted:       '#A1A1AA',
  faint:       '#6B6B78',
  accent:      '#7C5CFF',
  accentHover: '#8F72FF',
  fav:         '#FBBF24',
};

const AUDIO_EXT = ['mp3', 'flac', 'wav', 'ogg', 'm4a', 'aac', 'opus'];
const VIDEO_EXT = ['mp4', 'mkv', 'mov', 'webm', 'avi'];

function extOf(p)   { const m = p.match(/\.([^.]+)$/); return m ? m[1].toLowerCase() : ''; }
function isVideo(p) { return VIDEO_EXT.includes(extOf(p)); }
function baseName(p){ return p.split(/[\\/]/).pop().replace(/\.[^.]+$/, ''); }

function fmtTime(t) {
  if (t == null || !isFinite(t) || t < 0) return '0:00';
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ── Title bar ──────────────────────────────────────────────────────────────────
function TitleBar() {
  return (
    <View
      glyxDraggable
      style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        height: 40, paddingHorizontal: 12,
        backgroundColor: P.surface,
        borderBottomWidth: 1, borderBottomColor: P.border,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{
          width: 16, height: 16, borderRadius: 4,
          backgroundColor: P.accent, alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>▶</Text>
        </View>
        <Text style={{ fontSize: 12, fontWeight: '600', color: P.text, letterSpacing: 0.2 }}>Media Player</Text>
      </View>
      <WindowControls />
    </View>
  );
}

// ── Sidebar ────────────────────────────────────────────────────────────────────
function Sidebar({ filter, onFilter }) {
  const items = [
    { key: 'all',      label: 'All Media' },
    { key: 'audio',    label: 'Music' },
    { key: 'video',    label: 'Video' },
    { key: 'favorites',label: 'Favorites' },
  ];
  return (
    <View style={{
      width: 200, backgroundColor: P.surface,
      borderRightWidth: 1, borderRightColor: P.border,
      paddingTop: 16, paddingHorizontal: 12,
    }}>
      {items.map(it => {
        const active = filter === it.key;
        return (
          <Pressable
            key={it.key}
            onPress={() => onFilter(it.key)}
            style={({ hovered }) => ({
              flexDirection: 'row', alignItems: 'center', gap: 10,
              paddingVertical: 9, paddingHorizontal: 12, borderRadius: 8,
              marginBottom: 4,
              backgroundColor: active ? P.elevated : (hovered ? P.borderFaint : 'transparent'),
            })}
          >
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: active ? P.accent : P.faint }} />
            <Text style={{ fontSize: 13, fontWeight: active ? '600' : '500', color: active ? P.text : P.muted }}>
              {it.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ── Track row ──────────────────────────────────────────────────────────────────
function TrackRow({ track, index, isCurrent, playing, onPlay, onToggleFav }) {
  return (
    <Pressable
      onPress={() => onPlay(track)}
      style={({ hovered }) => ({
        flexDirection: 'row', alignItems: 'center', gap: 12,
        padding: 12, borderRadius: 10, marginBottom: 6,
        backgroundColor: isCurrent ? P.elevated : (hovered ? P.borderFaint : 'transparent'),
      })}
    >
      <View style={{ width: 24, alignItems: 'center' }}>
        {isCurrent && playing
          ? <Text style={{ color: P.accent, fontSize: 12 }}>♪</Text>
          : <Text style={{ color: P.faint, fontSize: 12 }}>{index + 1}</Text>}
      </View>

      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: '500', color: isCurrent ? P.accent : P.text }}>
          {track.title}
        </Text>
        <Text style={{ fontSize: 11, color: P.faint, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {track.kind}
        </Text>
      </View>

      <Pressable
        onPress={() => onToggleFav(track)}
        style={({ hovered }) => ({
          padding: 6, borderRadius: 6,
          backgroundColor: hovered ? P.border : 'transparent',
        })}
      >
        <Text style={{ fontSize: 15, color: track.favorite ? P.fav : P.faint }}>
          {track.favorite ? '★' : '☆'}
        </Text>
      </Pressable>
    </Pressable>
  );
}

// ── Now playing bar ────────────────────────────────────────────────────────────
function NowPlayingBar({
  current, playing, position, duration, volume, muted,
  onToggle, onNext, onPrev, onSeek, onVolume, onToggleMute, onToggleFav,
}) {
  const { width: winW } = useWindowSize();
  const barW = Math.max(160, (winW || 1100) - 460);
  const seekW = Math.max(80, barW - 96);   // barW minus two 38px time labels + gaps
  const volW  = 100;

  if (!current) return null;

  const seekFromEvent = (e) => {
    if (!duration || duration <= 0) return;
    const frac = Math.min(1, Math.max(0, (e.locationX || 0) / seekW));
    onSeek(frac * duration);
  };
  const volFromEvent = (e) => {
    const frac = Math.min(1, Math.max(0, (e.locationX || 0) / volW));
    onVolume(frac);
  };

  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 16,
      height: 72, paddingHorizontal: 20,
      backgroundColor: P.surface, borderTopWidth: 1, borderTopColor: P.border,
    }}>
      {/* Track info */}
      <View style={{ width: 200 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: P.text }} numberOfLines={1}>
          {current.title}
        </Text>
        <Text style={{ fontSize: 11, color: P.faint, marginTop: 2, textTransform: 'uppercase' }}>
          {current.kind}
        </Text>
      </View>

      {/* Transport */}
      <View style={{ flex: 1, alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18, marginBottom: 8 }}>
          <Pressable onPress={onPrev} style={({ hovered }) => pressBtn(hovered)}>
            <Text style={iconSt}>⏮</Text>
          </Pressable>
          <Pressable onPress={onToggle} style={({ hovered }) => ({
            width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
            backgroundColor: hovered ? P.accentHover : P.accent,
          })}>
            <Text style={{ color: '#fff', fontSize: 16 }}>{playing ? '⏸' : '▶'}</Text>
          </Pressable>
          <Pressable onPress={onNext} style={({ hovered }) => pressBtn(hovered)}>
            <Text style={iconSt}>⏭</Text>
          </Pressable>
          <Pressable onPress={() => onToggleFav(current)} style={({ hovered }) => pressBtn(hovered)}>
            <Text style={{ ...iconSt, color: current.favorite ? P.fav : P.muted }}>
              {current.favorite ? '★' : '☆'}
            </Text>
          </Pressable>
        </View>

        {/* Seek bar */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, width: barW }}>
          <Text style={timeSt}>{fmtTime(position)}</Text>
          <Pressable
            onPress={seekFromEvent}
            style={{ width: seekW, height: 16, justifyContent: 'center' }}
          >
            <View style={{ height: 4, borderRadius: 2, backgroundColor: P.border, overflow: 'hidden' }}>
              {duration > 0 ? (
                <View style={{
                  height: 4, borderRadius: 2, backgroundColor: P.accent,
                  width: `${Math.min(100, (position / duration) * 100)}%`,
                }} />
              ) : (
                // Duration unknown (e.g. VBR MP3): show an indeterminate
                // comet that advances with elapsed time instead of a fill.
                <View style={{
                  height: 4, borderRadius: 2, backgroundColor: P.accent,
                  width: '28%', marginLeft: `${((position * 18) % 100)}%`,
                }} />
              )}
            </View>
          </Pressable>
          <Text style={timeSt}>{duration > 0 ? fmtTime(duration) : '--:--'}</Text>
        </View>
      </View>

      {/* Volume */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, width: 150 }}>
        <Pressable onPress={onToggleMute} style={({ hovered }) => pressBtn(hovered)}>
          <Text style={iconSt}>{muted || volume === 0 ? '🔇' : '🔊'}</Text>
        </Pressable>
        <Pressable onPress={volFromEvent} style={{ width: volW, height: 16, justifyContent: 'center' }}>
          <View style={{ height: 4, borderRadius: 2, backgroundColor: P.border }}>
            <View style={{
              height: 4, borderRadius: 2, backgroundColor: P.muted,
              width: `${volume * 100}%`,
            }} />
          </View>
        </Pressable>
      </View>
    </View>
  );
}

const pressBtn = (hovered) => ({
  width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center',
  backgroundColor: hovered ? P.border : 'transparent',
});
const iconSt = { color: P.muted, fontSize: 14 };
const timeSt = { fontSize: 11, color: P.faint, width: 38, textAlign: 'right' };

// ── Main screen ────────────────────────────────────────────────────────────────
function PlayerScreen() {
  const { width: winW } = useWindowSize();
  const { showToast }   = useToast();

  const [tracks,    setTracks]    = useState([]);
  const [filter,    setFilter]    = useState('all');
  const [current,   setCurrent]   = useState(null);
  const [playing,   setPlaying]   = useState(false);
  const [position,  setPosition]  = useState(0);
  const [duration,  setDuration]  = useState(0);
  const [volume,    setVolume]    = useState(0.8);
  const [muted,     setMuted]     = useState(false);
  const [videoAR,   setVideoAR]   = useState(null);

  const audioRef  = useRef(null);
  const videoRef  = useRef(null);
  const _lastVid  = useRef(0);
  const _prevVol  = useRef(0.8);

  const refresh = useCallback(() => {
    db.query('SELECT * FROM media ORDER BY added_at DESC')
      .then(setTracks)
      .catch(console.error);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const visible = tracks.filter(t => {
    if (filter === 'audio')    return t.kind === 'audio';
    if (filter === 'video')    return t.kind === 'video';
    if (filter === 'favorites')return !!t.favorite;
    return true;
  });

  // Poll audio position while playing.
  useEffect(() => {
    if (!playing || !current || current.kind !== 'audio') return;
    const id = setInterval(() => {
      setPosition(audioRef.current?.getTime() ?? 0);
    }, 250);
    return () => clearInterval(id);
  }, [playing, current]);

  const stopAudio = () => {
    if (audioRef.current) { audioRef.current.stop(); audioRef.current = null; }
  };
  const stopVideo = () => {
    if (videoRef.current) { videoRef.current.close(); videoRef.current = null; }
  };

  const playTrack = async (track) => {
    stopAudio();
    stopVideo();
    setCurrent(track);
    setPosition(0);
    setDuration(0);
    setPlaying(true);

    if (track.kind === 'audio') {
      try {
        const p = await audio.play(track.path, {
          volume,
          onEnded: () => playNextFrom(track),
        });
        audioRef.current = p;
        setDuration(await p.getDuration());
      } catch (e) {
        setPlaying(false);
        showToast({ message: 'Could not play audio', variant: 'error' });
      }
    }
    // Video: the <Video> node in the stage handles open/play via its `src` prop.
  };

  const playNextFrom = (track) => {
    const list = tracks.filter(t => {
      if (filter === 'audio')    return t.kind === 'audio';
      if (filter === 'video')    return t.kind === 'video';
      if (filter === 'favorites')return !!t.favorite;
      return true;
    });
    const i = list.findIndex(t => t.id === track.id);
    const next = list[i + 1] || list[0];
    if (next) playTrack(next);
    else { setPlaying(false); setCurrent(null); }
  };

  const playNext = () => { if (current) playNextFrom(current); else if (visible[0]) playTrack(visible[0]); };
  const playPrev = () => {
    if (!current) return;
    const list = visible;
    const i = list.findIndex(t => t.id === current.id);
    const prev = list[i - 1];
    if (prev) playTrack(prev);
  };

  const togglePlay = () => {
    if (!current) { if (visible[0]) playTrack(visible[0]); return; }
    if (current.kind === 'audio') {
      if (playing) { audioRef.current?.pause(); setPlaying(false); }
      else         { audioRef.current?.resume(); setPlaying(true); }
    } else {
      if (playing) { videoRef.current?.pause(); setPlaying(false); }
      else         { videoRef.current?.play(); setPlaying(true); }
    }
  };

  const handleSeek = (secs) => {
    setPosition(secs);
    if (current?.kind === 'audio') audioRef.current?.seek(secs);
    else                            videoRef.current?.seek(secs);
  };

  const handleVolume = (v) => {
    setVolume(v);
    if (v > 0) setMuted(false);
    audioRef.current?.setVolume(v);
    videoRef.current?.setVolume(v);
  };

  const toggleMute = () => {
    if (muted) {
      const v = _prevVol.current > 0 ? _prevVol.current : 0.8;
      setMuted(false);
      setVolume(v);
      audioRef.current?.setVolume(v);
      videoRef.current?.setVolume(v);
    } else {
      _prevVol.current = volume > 0 ? volume : 0.8;
      setMuted(true);
      setVolume(0);
      audioRef.current?.setVolume(0);
      videoRef.current?.setVolume(0);
    }
  };

  const toggleFav = async (track) => {
    const next = !track.favorite;
    await db.run('UPDATE media SET favorite=? WHERE id=?', [next ? 1 : 0, track.id]);
    setTracks(ts => ts.map(t => t.id === track.id ? { ...t, favorite: next } : t));
    if (current?.id === track.id) setCurrent(c => ({ ...c, favorite: next }));
  };

  const addMedia = async () => {
    const paths = await dialog.openFile({
      multiple: true,
      filters: [
        { name: 'Media', extensions: [...AUDIO_EXT, ...VIDEO_EXT] },
        { name: 'Audio', extensions: AUDIO_EXT },
        { name: 'Video', extensions: VIDEO_EXT },
        { name: 'All Files', extensions: ['*'] },
      ],
    });
    if (!paths || paths.length === 0) return;
    for (const p of paths) {
      const kind = isVideo(p) ? 'video' : 'audio';
      await db.run(
        'INSERT OR IGNORE INTO media (title, path, kind, favorite, added_at) VALUES (?,?,?,0,?)',
        [baseName(p), p, kind, Date.now()],
      );
    }
    refresh();
    showToast({ message: `Added ${paths.length} item(s)`, variant: 'success' });
  };

  const hPad = winW ? Math.max(24, Math.min(Math.floor((winW - 760) / 2), 80)) : 48;

  return (
    <View style={{ flex: 1, backgroundColor: P.bg }}>
      <TitleBar />
      <View style={{ flexDirection: 'row', flex: 1 }}>
        <Sidebar filter={filter} onFilter={setFilter} />

        <ScrollView style={{ flex: 1 }}>
          <View style={{ paddingHorizontal: hPad, paddingTop: 32, paddingBottom: 32 }}>

            {/* Video stage (only when a video is current) — letterboxed to the
                video's aspect ratio so it never stretches. */}
            {current?.kind === 'video' && (() => {
              const STAGE_H = 360;
              const stageW = Math.max(240, (winW || 1100) - 200 - hPad * 2);
              let vidW = stageW, vidH = STAGE_H;
              if (videoAR && videoAR > 0) {
                vidH = STAGE_H;
                vidW = STAGE_H * videoAR;
                if (vidW > stageW) { vidW = stageW; vidH = stageW / videoAR; }
              }
              return (
                <View style={{
                  height: vidH, borderRadius: 12, overflow: 'hidden',
                  backgroundColor: '#000', marginBottom: 24,
                  alignItems: 'center', justifyContent: 'center',
                  borderWidth: 1, borderColor: P.border,
                  width: stageW,
                }}>
                  <Video
                    ref={videoRef}
                    src={current.path}
                    autoPlay={playing}
                    style={{ width: vidW, height: vidH }}
                    onMetadata={(m) => {
                      setDuration(m.durationSecs ?? 0);
                      if (m.width && m.height) setVideoAR(m.width / m.height);
                    }}
                    onTimeUpdate={(t) => {
                      // Throttle state updates to ~4 fps.
                      if (Math.abs(t - _lastVid.current) >= 0.25) { _lastVid.current = t; setPosition(t); }
                    }}
                    onEnded={() => playNextFrom(current)}
                  />
                </View>
              );
            })()}

            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <Text style={{ fontSize: 26, fontWeight: '300', color: P.text, letterSpacing: -0.5 }}>
                {filter === 'all' ? 'Library' : filter === 'favorites' ? 'Favorites' : (filter === 'audio' ? 'Music' : 'Video')}
              </Text>
              <Pressable
                onPress={addMedia}
                style={({ hovered }) => ({
                  flexDirection: 'row', alignItems: 'center', gap: 8,
                  paddingHorizontal: 16, paddingVertical: 9, borderRadius: 8,
                  backgroundColor: hovered ? P.accentHover : P.accent,
                })}
              >
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>+ Add Media</Text>
              </Pressable>
            </View>

            {/* Empty state */}
            {visible.length === 0 && (
              <View style={{
                alignItems: 'center', paddingVertical: 56,
                backgroundColor: P.surface, borderRadius: 12, borderWidth: 1, borderColor: P.border,
              }}>
                <Text style={{ fontSize: 30, color: P.faint }}>♪</Text>
                <Text style={{ fontSize: 16, fontWeight: '600', color: P.text, marginTop: 12 }}>
                  Your library is empty
                </Text>
                <Text style={{ fontSize: 13, color: P.muted, marginTop: 4 }}>
                  Click “Add Media” to import local audio and video files.
                </Text>
              </View>
            )}

            {/* List */}
            {visible.map((t, i) => (
              <TrackRow
                key={t.id}
                track={t}
                index={i}
                isCurrent={current?.id === t.id}
                playing={playing}
                onPlay={playTrack}
                onToggleFav={toggleFav}
              />
            ))}

          </View>
        </ScrollView>
      </View>

      <NowPlayingBar
        current={current}
        playing={playing}
        position={position}
        duration={duration}
        volume={volume}
        muted={muted}
        onToggle={togglePlay}
        onNext={playNext}
        onPrev={playPrev}
        onSeek={handleSeek}
        onVolume={handleVolume}
        onToggleMute={toggleMute}
        onToggleFav={toggleFav}
      />
    </View>
  );
}

// ── DB init ────────────────────────────────────────────────────────────────────
function App() {
  const [ready, setReady] = useState(false);
  const [err,   setErr]   = useState(null);

  useEffect(() => {
    db.open('media.db')
      .then(() => db.run(`
        CREATE TABLE IF NOT EXISTS media (
          id        INTEGER PRIMARY KEY AUTOINCREMENT,
          title     TEXT NOT NULL,
          path      TEXT NOT NULL UNIQUE,
          kind      TEXT NOT NULL,
          favorite  INTEGER DEFAULT 0,
          added_at  INTEGER
        )
      `))
      .then(() => setReady(true))
      .catch(e => setErr(String(e?.message ?? e)));
  }, []);

  if (err) return (
    <View style={{ flex: 1, backgroundColor: P.bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#EF4444', fontSize: 14 }}>DB error: {err}</Text>
    </View>
  );
  if (!ready) return (
    <View style={{ flex: 1, backgroundColor: P.bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 22, fontWeight: '300', color: P.muted }}>Loading…</Text>
    </View>
  );

  return <PlayerScreen />;
}

render(
  <ThemeProvider colorScheme="dark">
    <ToastProvider>
      <App />
    </ToastProvider>
  </ThemeProvider>
);
