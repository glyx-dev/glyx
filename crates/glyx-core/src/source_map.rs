//! A source map reader, for the dev error overlay: it turns a position in the generated bundle (`bundle.js:24478:34`, what the engine's stack
//! traces name) into the file, line and column in the app's own source, and hands back that file's text when the map carries it
//! (`sourcesContent`, which the bundler embeds). Only the parts of the format the overlay needs: `sources`, `sourcesContent`, `sourceRoot` and
//! `mappings` (base64 VLQ). Dev builds only.

use base64::Engine as _;

/// One mapped segment of a generated line.
#[derive(Clone, Copy, Debug)]
struct Seg {
    /// 0-based column in the generated line.
    gen_col: u32,
    /// Index into `sources`.
    src: u32,
    /// 0-based line and column in that source.
    line: u32,
    col: u32,
}

#[derive(Debug)]
pub(crate) struct SourceMap {
    sources: Vec<String>,
    contents: Vec<Option<String>>,
    /// Segments per generated line, in column order.
    lines: Vec<Vec<Seg>>,
}

/// Where a generated position comes from: the source path as the map names it, and 1-based line and column.
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct Origin {
    pub source: String,
    pub line: u32,
    pub col: u32,
}

impl SourceMap {
    /// From the base64 text after `//# sourceMappingURL=data:application/json;base64,`.
    pub fn from_base64(b64: &str) -> Option<SourceMap> {
        let bytes = base64::engine::general_purpose::STANDARD.decode(b64.trim().as_bytes()).ok()?;
        Self::from_json(&bytes)
    }

    pub fn from_json(json: &[u8]) -> Option<SourceMap> {
        let v: serde_json::Value = serde_json::from_slice(json).ok()?;
        let root = v["sourceRoot"].as_str().unwrap_or("");
        let sources: Vec<String> = v["sources"].as_array()?.iter()
            .map(|s| format!("{root}{}", s.as_str().unwrap_or("")))
            .collect();
        let contents = (0..sources.len())
            .map(|i| v["sourcesContent"].get(i).and_then(|c| c.as_str()).map(String::from))
            .collect();
        let lines = decode_mappings(v["mappings"].as_str()?)?;
        Some(SourceMap { sources, contents, lines })
    }

    /// The origin of generated 1-based `line` and `col`: the last mapped segment at or before that column on its line.
    pub fn lookup(&self, line: u32, col: u32) -> Option<Origin> {
        let segs = self.lines.get((line as usize).checked_sub(1)?)?;
        let col0 = col.checked_sub(1)?;
        let seg = segs.iter().rev().find(|s| s.gen_col <= col0)?;
        Some(Origin { source: self.sources.get(seg.src as usize)?.clone(), line: seg.line + 1, col: seg.col + 1 })
    }

    /// The text of a source file the map embeds, by the path `lookup` gave.
    pub fn content_of(&self, source: &str) -> Option<&str> {
        let i = self.sources.iter().position(|s| s == source)?;
        self.contents.get(i)?.as_deref()
    }
}

fn b64_value(c: u8) -> Option<u32> {
    Some(match c {
        b'A'..=b'Z' => (c - b'A') as u32,
        b'a'..=b'z' => (c - b'a') as u32 + 26,
        b'0'..=b'9' => (c - b'0') as u32 + 52,
        b'+' => 62,
        b'/' => 63,
        _ => return None,
    })
}

/// The base64 VLQ numbers of one segment (1, 4 or 5 of them), or `None` if the text is not VLQ.
fn decode_segment(seg: &str) -> Option<Vec<i64>> {
    let mut out = Vec::with_capacity(5);
    let (mut value, mut shift) = (0i64, 0u32);
    for c in seg.bytes() {
        let d = b64_value(c)?;
        value |= ((d & 31) as i64) << shift;
        if d & 32 != 0 {
            shift += 5;
            if shift > 60 { return None; }
        } else {
            let negative = value & 1 == 1;
            let n = value >> 1;
            out.push(if negative { -n } else { n });
            value = 0;
            shift = 0;
        }
    }
    (shift == 0).then_some(out)
}

fn decode_mappings(mappings: &str) -> Option<Vec<Vec<Seg>>> {
    // The source, line and column deltas run across the whole map; the generated column restarts on every line.
    let (mut src, mut line, mut col) = (0i64, 0i64, 0i64);
    let mut lines = Vec::new();
    for gen_line in mappings.split(';') {
        let mut gen_col = 0i64;
        let mut segs = Vec::new();
        for seg in gen_line.split(',').filter(|s| !s.is_empty()) {
            let n = decode_segment(seg)?;
            gen_col += *n.first()?;
            if n.len() >= 4 {
                src += n[1];
                line += n[2];
                col += n[3];
                if gen_col < 0 || src < 0 || line < 0 || col < 0 { return None; }
                segs.push(Seg { gen_col: gen_col as u32, src: src as u32, line: line as u32, col: col as u32 });
            }
        }
        lines.push(segs);
    }
    Some(lines)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn vlq_numbers_decode_with_signs_and_continuations() {
        assert_eq!(decode_segment("AAAA"), Some(vec![0, 0, 0, 0]));
        assert_eq!(decode_segment("EAAE"), Some(vec![2, 0, 0, 2]));
        assert_eq!(decode_segment("D"), Some(vec![-1]), "the low bit is the sign");
        assert_eq!(decode_segment("gB"), Some(vec![16]), "a continuation digit carries on into the next");
        assert_eq!(decode_segment("3H"), Some(vec![-123]));
        assert_eq!(decode_segment("2H"), Some(vec![123]));
        assert_eq!(decode_segment("g"), None, "an unfinished number");
        assert_eq!(decode_segment("A!"), None, "not base64");
    }

    #[test]
    fn a_position_maps_to_the_last_segment_at_or_before_its_column() {
        // Line 1: a segment at column 0 -> app.jsx 1:1, another at column 2 -> app.jsx 1:3. Line 2 (a new generated line, the
        // source line moved on by one): column 0 -> app.jsx 2:1. Line 3: nothing mapped.
        let json = br#"{"version":3,"sources":["../src/app.jsx","../src/other.jsx"],"sourcesContent":["one\ntwo\n",null],
                        "mappings":"AAAA,EAAE;AACF;"}"#;
        let m = SourceMap::from_json(json).expect("a map");
        assert_eq!(m.lookup(1, 1), Some(Origin { source: "../src/app.jsx".into(), line: 1, col: 1 }));
        assert_eq!(m.lookup(1, 2), Some(Origin { source: "../src/app.jsx".into(), line: 1, col: 1 }), "still the first segment");
        assert_eq!(m.lookup(1, 3), Some(Origin { source: "../src/app.jsx".into(), line: 1, col: 3 }));
        assert_eq!(m.lookup(1, 40), Some(Origin { source: "../src/app.jsx".into(), line: 1, col: 3 }), "the rest of the line");
        assert_eq!(m.lookup(2, 1), Some(Origin { source: "../src/app.jsx".into(), line: 2, col: 1 }));
        assert_eq!(m.lookup(3, 1), None, "nothing mapped on that line");
        assert_eq!(m.lookup(9, 1), None, "past the map");
        assert_eq!(m.lookup(0, 1), None);
        assert_eq!(m.content_of("../src/app.jsx"), Some("one\ntwo\n"));
        assert_eq!(m.content_of("../src/other.jsx"), None, "the map did not carry that file's text");
    }

    #[test]
    fn deltas_run_across_lines_and_the_source_index_switches_files() {
        // Segment 1 in file 0 at 3:5; segment 2 on the next generated line switches to file 1 (index delta +1) at 1:1
        // (line delta -2, column delta -4).
        let json = br#"{"version":3,"sources":["a.js","b.js"],"mappings":"AAEI;ACFJ"}"#;
        let m = SourceMap::from_json(json).unwrap();
        assert_eq!(m.lookup(1, 1), Some(Origin { source: "a.js".into(), line: 3, col: 5 }));
        assert_eq!(m.lookup(2, 1), Some(Origin { source: "b.js".into(), line: 1, col: 1 }));
    }

    #[test]
    fn the_base64_wrapper_and_a_bad_map_are_handled() {
        let json = r#"{"version":3,"sources":["x.jsx"],"mappings":"AAAA"}"#;
        let b64 = base64::engine::general_purpose::STANDARD.encode(json);
        assert_eq!(SourceMap::from_base64(&b64).unwrap().lookup(1, 1).unwrap().source, "x.jsx");
        assert!(SourceMap::from_base64("not base64 !!").is_none());
        assert!(SourceMap::from_json(b"{\"mappings\":\"AAAA\"}").is_none(), "no sources");
        assert!(SourceMap::from_json(br#"{"sources":["a"],"mappings":"A!AA"}"#).is_none());
    }
}
