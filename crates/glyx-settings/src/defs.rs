//! The definitions: one entry per setting, the only place a setting's name, range, default and documentation are written down.
//!
//! To add one: add a row here (with its legacy environment variable and config key if it has them), read it with
//! `glyx_settings::global().bool("...")` (or `int`, `string`) where it is used, and the DevTools list, `glyx.settings` and the generated
//! documentation pick it up. A [`Scope::Live`] setting must be re-read when it is used, or its owner must listen with `on_change`.

use crate::{DefaultValue, Def, Kind, Safety, Scope, Value};

/// `GLYX_REDUCE_MOTION` meant "on unless it is `0`"; the registry also reads the words.
fn parse_reduce_motion(text: &str) -> Option<Value> {
    match text.to_ascii_lowercase().as_str() {
        "" => None,
        "auto" => Some(Value::Str("auto".into())),
        "0" | "off" | "false" | "no" => Some(Value::Str("off".into())),
        _ => Some(Value::Str("on".into())),
    }
}

fn is_false_word(text: &str) -> bool {
    matches!(text.to_ascii_lowercase().as_str(), "0" | "false" | "off" | "no")
}

/// Variables that used to switch a feature off by being set at all (`GLYX_FULL_CANVAS_DAMAGE=1`, or just `GLYX_FULL_CANVAS_DAMAGE=`): the
/// setting is the positive form, so any value but a false word turns it off.
fn off_when_set(text: &str) -> Option<Value> {
    (!is_false_word(text)).then_some(Value::Bool(false))
}

/// The variables that were only read when exactly `1` (`GLYX_NO_SOFT_PRESENT=1`).
fn off_when_one(text: &str) -> Option<Value> {
    (text == "1").then_some(Value::Bool(false))
}

/// A variable that switched a feature on by being set at all (`GLYX_VELLO_FIXED_BUFFERS`).
fn on_when_set(text: &str) -> Option<Value> {
    (!is_false_word(text)).then_some(Value::Bool(true))
}

pub static DEFS: &[Def] = &[
    Def {
        name: "render.labelCache",
        kind: Kind::Int { min: 0, max: 1_000_000 },
        default: DefaultValue::Int(0),
        scope: Scope::Live,
        safety: Safety::Developer,
        env: Some("GLYX_LABEL_CACHE"),
        parse_env: None,
        config_key: Some("labelCacheEntries"),
        doc: "Shaped-text cache size in entries. 0 lets it size itself (it grows while it thrashes, up to 8 MB, and shrinks when quiet); 16 or more pins it; 1 to 15 count as 0.",
    },
    Def {
        name: "render.canvasCacheMb",
        kind: Kind::Int { min: 0, max: 256 },
        default: DefaultValue::Int(16),
        scope: Scope::Startup,
        safety: Safety::Developer,
        env: Some("GLYX_CANVAS_CACHE_MB"),
        parse_env: None,
        config_key: Some("canvasCacheMb"),
        doc: "Memory the pixel cache for canvases that repaint unchanged may hold, in MB. 0 turns the cache off.",
    },
    Def {
        name: "render.colorEmoji",
        kind: Kind::Bool,
        default: DefaultValue::Bool(true),
        scope: Scope::Startup,
        safety: Safety::Developer,
        env: Some("GLYX_COLOR_EMOJI"),
        parse_env: None,
        config_key: None,
        doc: "Draw emoji in colour. Off draws one-colour shapes in the text colour and leaves the font's colour tables unread.",
    },
    Def {
        name: "render.scrollBlit",
        kind: Kind::Bool,
        default: DefaultValue::Bool(true),
        scope: Scope::Startup,
        safety: Safety::Developer,
        env: Some("GLYX_SCROLL_BLIT"),
        parse_env: None,
        config_key: None,
        doc: "Scroll by moving the pixels already drawn and painting only the strip that appears, instead of repainting the view.",
    },
    Def {
        name: "motion.reduce",
        kind: Kind::Choice(&["auto", "on", "off"]),
        default: DefaultValue::Str("auto"),
        scope: Scope::Live,
        // An app's own "reduce animations" switch is a normal thing to offer; JavaScript can use it once the app's config allows it.
        safety: Safety::App,
        env: Some("GLYX_REDUCE_MOTION"),
        parse_env: Some(parse_reduce_motion),
        config_key: None,
        doc: "Reduced motion: transitions, smooth scroll and canvas easing jump to their end state. auto follows the operating system's animation setting.",
    },
    Def {
        name: "render.cpuRender",
        kind: Kind::Bool,
        default: DefaultValue::Bool(false),
        scope: Scope::Startup,
        safety: Safety::Developer,
        env: Some("GLYX_CPU_RENDER"),
        parse_env: None,
        config_key: None,
        doc: "Force the cheapest CPU renderer, for CI, headless runs and machines without a supported GPU. Auto behaves as if there were no GPU; an explicit GPU mode uses Vello's CPU path.",
    },
    Def {
        name: "render.softPresent",
        kind: Kind::Bool,
        default: DefaultValue::Bool(true),
        scope: Scope::Startup,
        safety: Safety::Developer,
        env: Some("GLYX_NO_SOFT_PRESENT"),
        parse_env: Some(off_when_one),
        config_key: None,
        doc: "Present the CPU renderer's frames through the operating system's software path. Off keeps it on the wgpu present path (an escape hatch). The variable GLYX_NO_SOFT_PRESENT=1 turns it off.",
    },
    Def {
        name: "render.vulloFixedBuffers",
        kind: Kind::Bool,
        default: DefaultValue::Bool(false),
        scope: Scope::Startup,
        safety: Safety::Developer,
        env: Some("GLYX_VELLO_FIXED_BUFFERS"),
        parse_env: Some(on_when_set),
        config_key: None,
        doc: "Give Vello its upstream fixed scratch buffers (about 165 MB) instead of sizing them from the scene. For ruling the adaptive sizing out and for comparing memory.",
    },
    Def {
        name: "render.multiDamageRects",
        kind: Kind::Bool,
        default: DefaultValue::Bool(true),
        scope: Scope::Startup,
        safety: Safety::Developer,
        env: Some("GLYX_SINGLE_DAMAGE_RECT"),
        parse_env: Some(off_when_set),
        config_key: None,
        doc: "Repaint several small rectangles when parts of the window change. Off repaints one box around everything that changed, for ruling it out when something looks stale. The variable GLYX_SINGLE_DAMAGE_RECT turns it off.",
    },
    Def {
        name: "render.canvasPartialRedraw",
        kind: Kind::Bool,
        default: DefaultValue::Bool(true),
        scope: Scope::Startup,
        safety: Safety::Developer,
        env: Some("GLYX_FULL_CANVAS_DAMAGE"),
        parse_env: Some(off_when_set),
        config_key: None,
        doc: "Repaint only the part of a canvas that changed. Off damages the whole canvas each time, for ruling it out when a canvas looks stale. The variable GLYX_FULL_CANVAS_DAMAGE turns it off.",
    },
    Def {
        name: "render.maxFps",
        kind: Kind::Int { min: 0, max: 500 },
        default: DefaultValue::Int(0),
        scope: Scope::Live,
        // An app's own "battery saver" or "low power" switch is a normal thing to offer.
        safety: Safety::App,
        env: None,
        parse_env: None,
        config_key: Some("maxFps"),
        doc: "Upper bound on frames per second for continuous redraws (animation, video, drags). 0 follows the monitor's refresh rate; 60 halves animation cost on a 120 Hz display; 1 to 14 act as 15. Changes at once. Applies to the CPU present path only: the GPU and Direct2D paths present at the display's vsync.",
    },
    Def {
        name: "js.heapMb",
        kind: Kind::Int { min: 0, max: 512 },
        default: DefaultValue::Int(0),
        scope: Scope::Startup,
        safety: Safety::Config,
        env: None,
        parse_env: None,
        config_key: Some("maxJsHeapMb"),
        doc: "Cap on the JavaScript heap, in MB (V8 only). 0 sizes it from the bundle. The config clamps it to 16 to 512. Config only: a heap cap is never changed at run time.",
    },
    Def {
        name: "streams.chunkKb",
        kind: Kind::Int { min: 4, max: 4096 },
        default: DefaultValue::Int(256),
        scope: Scope::Live,
        safety: Safety::Developer,
        env: None,
        parse_env: None,
        config_key: None,
        doc: "Size of one chunk of a file stream, in KiB. Applies to streams opened after the change; a stream can ask for its own size. Smaller chunks cost more calls between JavaScript and Rust, larger ones more memory per open stream.",
    },
    Def {
        name: "streams.queueChunks",
        kind: Kind::Int { min: 1, max: 16 },
        default: DefaultValue::Int(2),
        scope: Scope::Live,
        safety: Safety::Developer,
        env: None,
        parse_env: None,
        config_key: None,
        doc: "How many chunks a stream reads ahead (or accepts from a writer) before it waits for the other side. With the chunk size, this bounds the memory of one open stream: 2 chunks of 256 KiB is about 512 KiB. Applies to streams opened after the change.",
    },
    Def {
        name: "streams.maxOpen",
        kind: Kind::Int { min: 1, max: 1024 },
        default: DefaultValue::Int(64),
        scope: Scope::Live,
        safety: Safety::Developer,
        env: None,
        parse_env: None,
        config_key: None,
        doc: "Most streams the app may have open at once (a stream that is never closed holds a file and its read-ahead). Opening one more is refused with an error that says so.",
    },
    Def {
        name: "text.emojiFont",
        kind: Kind::Bool,
        default: DefaultValue::Bool(true),
        scope: Scope::Startup,
        safety: Safety::Developer,
        env: Some("GLYX_NO_EMOJI_FONT"),
        parse_env: Some(off_when_one),
        config_key: None,
        doc: "Load the system emoji and symbol fonts (Segoe UI Emoji and Symbol on Windows, about 40 MB of memory). Off skips them in memory-critical apps. The variable GLYX_NO_EMOJI_FONT=1 turns it off.",
    },
];
