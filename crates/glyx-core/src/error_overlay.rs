//! What the dev error overlay needs besides drawing: where in the app's own source an error happened, a few lines of that source around it,
//! and the command that opens that place in the developer's editor.
//!
//! Everything here is plain functions over strings, so it is tested without a window. The overlay itself (`dev_mode::draw_error_overlay`) and its
//! input handling (Enter or a click opens the editor, Escape dismisses) call into it. Dev builds only.

use std::path::{Path, PathBuf};

/// A place in a source file: 1-based line and column (`col` is 0 when the stack gave none).
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct Location {
    pub file: String,
    pub line: u32,
    pub col: u32,
}

/// Whether `path` is the app's own code rather than a library or the runtime's polyfills (the same test the overlay colours frames with).
pub(crate) fn is_user_file(path: &str) -> bool {
    path.contains(".jsx")
        || path.contains(".tsx")
        || (path.contains(".ts") && !path.contains("node_modules"))
        || (path.contains(".js") && !path.contains("node_modules") && !path.contains("polyfills") && !path.contains("chunk-"))
}

/// `at fn (file:line:col)`, `at file:line:col` or `at fn (file:line)`, as V8 and QuickJS print them. Takes the location out, handling a
/// Windows drive letter's colon and a `file:///` URL.
pub(crate) fn parse_frame(line: &str) -> Option<Location> {
    let t = line.trim();
    let rest = t.strip_prefix("at ")?;
    // The location is what is inside the last parentheses, or the whole remainder when there are none.
    let loc = match (rest.rfind('('), rest.ends_with(')')) {
        (Some(open), true) => &rest[open + 1..rest.len() - 1],
        _ => rest,
    };
    // Numbers from the right: `…:line:col` or `…:line`.
    let mut parts = loc.rsplitn(3, ':');
    let last = parts.next()?;
    let (file, line_no, col) = match (last.parse::<u32>(), parts.next().map(str::parse::<u32>)) {
        (Ok(col), Some(Ok(line_no))) => (parts.next()?.to_string(), line_no, col),
        (Ok(line_no), Some(_)) => {
            // Only a line: what the second piece held is the start of the path (a drive letter, say).
            let tail = loc.rsplit_once(':').map(|(head, _)| head)?;
            (tail.to_string(), line_no, 0)
        }
        _ => return None,
    };
    let file = file.trim_start_matches("file:///").to_string();
    (!file.is_empty() && line_no > 0).then_some(Location { file, line: line_no, col })
}

/// The first frame of `error` that is in the app's own source.
pub(crate) fn first_user_location(error: &str) -> Option<Location> {
    error.lines().filter_map(parse_frame).find(|l| is_user_file(&l.file))
}

/// What the overlay shows of one error besides its text: the stack with the bundle's positions turned into the app's own files, where the
/// error is in those, and the lines around it. Built once per error (it reads the file), kept until a different error arrives.
#[derive(Clone, Debug)]
pub(crate) struct ErrorView {
    /// The error as the engine reported it (what Ctrl+C copies).
    pub err: String,
    /// `err` with every frame in the generated bundle replaced by the file, line and column it came from, where the source map knows it.
    pub shown: String,
    pub loc: Option<Location>,
    pub excerpt: Option<Excerpt>,
}

/// Lexically cleans a path: drops `.` and folds `..` into what comes before, so `dist/../src/app.jsx` reads `src/app.jsx`.
pub(crate) fn normalize(path: &str) -> String {
    let sep = if path.contains('\\') { '\\' } else { '/' };
    let mut out: Vec<&str> = Vec::new();
    for part in path.split(['/', '\\']) {
        match part {
            "." => {}
            ".." if out.last().map_or(false, |l| *l != ".." && !l.ends_with(':') && !l.is_empty()) => { out.pop(); }
            p => out.push(p),
        }
    }
    out.join(&sep.to_string())
}

/// `at fn (loc)` or `at loc` with `new_loc` in place of the location.
fn replace_location(line: &str, new_loc: &str) -> String {
    let indent = &line[..line.len() - line.trim_start().len()];
    let t = line.trim();
    let rest = t.strip_prefix("at ").unwrap_or(t);
    match (rest.rfind('('), rest.ends_with(')')) {
        (Some(open), true) => format!("{indent}at {}({new_loc})", &rest[..open]),
        _ => format!("{indent}at {new_loc}"),
    }
}

/// A frame in the generated bundle (not in a file of its own).
fn is_bundle_frame(loc: &Location) -> bool { loc.file.contains("bundle.js") || loc.file.ends_with("app.js") && !Path::new(&loc.file).is_absolute() }

impl ErrorView {
    /// `roots`: folders a source path from the map can be relative to (the project, and the bundle's output folder). `map` maps bundle positions.
    pub fn build(err: &str, roots: &[PathBuf], map: Option<&crate::source_map::SourceMap>) -> Self {
        let root = roots.first().cloned().unwrap_or_default();
        // The file a map path names, as the overlay shows and opens it: relative to the project when it is inside it.
        let project = normalize(&root.to_string_lossy());
        let find = |source: &str| -> String {
            let n = normalize(source);
            let found = roots.iter().map(|r| r.join(source)).find(|p| p.exists()).map(|p| normalize(&p.to_string_lossy()));
            let abs = found.unwrap_or_else(|| roots.get(1).or(roots.first()).map_or(n.clone(), |r| normalize(&r.join(source).to_string_lossy())));
            abs.strip_prefix(&project).map(|rest| rest.trim_start_matches(['/', '\\'])).filter(|rest| !rest.is_empty()).map_or(abs.clone(), String::from)
        };
        // Frames in the bundle become frames in the app's files; the map's own copy of that file is kept to read the lines from.
        let mut contents: Vec<(String, String)> = Vec::new();
        let shown: String = err.lines().map(|l| {
            let mapped = map.and_then(|m| {
                let loc = parse_frame(l).filter(is_bundle_frame)?;
                let o = m.lookup(loc.line, loc.col.max(1))?;
                let path = find(&o.source);
                if let Some(text) = m.content_of(&o.source) { contents.push((path.clone(), text.to_string())); }
                Some(replace_location(l, &format!("{path}:{}:{}", o.line, o.col)))
            });
            mapped.unwrap_or_else(|| l.to_string())
        }).collect::<Vec<_>>().join("\n");

        let loc = first_user_location(&shown);
        let excerpt = loc.as_ref().and_then(|l| {
            contents.iter().find(|(p, _)| *p == l.file).and_then(|(_, text)| excerpt_of(text, l.line, 2))
                .or_else(|| read_excerpt(l, &root, 2))
        });
        ErrorView { err: err.to_string(), shown, loc, excerpt }
    }

    /// The location as the overlay prints it: relative to the project when it is inside it.
    pub fn place(&self, root: &Path) -> Option<String> {
        let l = self.loc.as_ref()?;
        let shown = Path::new(&l.file).strip_prefix(root).map(|p| p.to_string_lossy().into_owned()).unwrap_or_else(|_| l.file.clone());
        Some(if l.col > 0 { format!("{shown}:{}:{}", l.line, l.col) } else { format!("{shown}:{}", l.line) })
    }
}

/// A few lines of source around an error, for the overlay to show.
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct Excerpt {
    /// The 1-based line number of `lines[0]`.
    pub first_line: u32,
    pub lines: Vec<String>,
    /// Index into `lines` of the line the error is on.
    pub at: usize,
}

/// `context` lines either side of `loc.line`, read from the file (as given, else relative to `root`). Tabs become two spaces so a caret under a
/// column lines up; very long lines are cut.
pub(crate) fn read_excerpt(loc: &Location, root: &Path, context: usize) -> Option<Excerpt> {
    let path = resolve(&loc.file, root)?;
    let text = std::fs::read_to_string(path).ok()?;
    excerpt_of(&text, loc.line, context)
}

fn excerpt_of(text: &str, line: u32, context: usize) -> Option<Excerpt> {
    let all: Vec<&str> = text.lines().collect();
    let idx = (line as usize).checked_sub(1).filter(|&i| i < all.len())?;
    let from = idx.saturating_sub(context);
    let to = (idx + context + 1).min(all.len());
    let lines = all[from..to].iter().map(|l| {
        let l = l.replace('\t', "  ");
        if l.chars().count() > 200 { l.chars().take(200).collect::<String>() } else { l }
    }).collect();
    Some(Excerpt { first_line: from as u32 + 1, lines, at: idx - from })
}

/// The file a stack frame names, found on disk: as written, or under `root` (the project folder).
pub(crate) fn resolve(file: &str, root: &Path) -> Option<PathBuf> {
    let p = Path::new(file);
    if p.is_absolute() && p.exists() { return Some(p.to_path_buf()); }
    let joined = root.join(file.trim_start_matches("./"));
    joined.exists().then_some(joined)
}

/// How to open `loc` in an editor: a program and its arguments, tried in order until one starts.
///
/// 1. `GLYX_EDITOR`, a command line with `{file}`, `{line}` and `{col}` in it (the only way to name an editor this does not know).
/// 2. `VISUAL` or `EDITOR`, when it is an editor with a window and a known way to take a line: VS Code and its forks, Sublime Text, JetBrains IDEs,
///    Notepad++. (A terminal editor such as vim cannot be started without a terminal, so it is skipped.)
/// 3. VS Code's `code` if there is one.
/// 4. The system's default for the file type.
pub(crate) fn editor_commands(loc: &Location, file: &Path, env: &dyn Fn(&str) -> Option<String>) -> Vec<(String, Vec<String>)> {
    let f = file.to_string_lossy().into_owned();
    let (line, col) = (loc.line.to_string(), loc.col.max(1).to_string());
    let mut out: Vec<(String, Vec<String>)> = Vec::new();

    if let Some(template) = env("GLYX_EDITOR").filter(|t| !t.trim().is_empty()) {
        let mut words = template.split_whitespace().map(|w| w.replace("{file}", &f).replace("{line}", &line).replace("{col}", &col));
        if let Some(program) = words.next() { out.push((program, words.collect())); }
    }
    for var in ["VISUAL", "EDITOR"] {
        let Some(value) = env(var).filter(|v| !v.trim().is_empty()) else { continue };
        let mut words = value.split_whitespace();
        let Some(program) = words.next() else { continue };
        let extra: Vec<String> = words.map(String::from).collect();
        let name = Path::new(program).file_stem().map(|s| s.to_string_lossy().to_ascii_lowercase()).unwrap_or_default();
        let with = |mut a: Vec<String>| { let mut v = extra.clone(); v.append(&mut a); v };
        let args = if ["code", "code-insiders", "codium", "cursor", "windsurf"].contains(&name.as_str()) {
            Some(with(vec!["-g".into(), format!("{f}:{line}:{col}")]))
        } else if ["subl", "sublime_text"].contains(&name.as_str()) {
            Some(with(vec![format!("{f}:{line}:{col}")]))
        } else if ["idea", "idea64", "webstorm", "webstorm64", "rider", "pycharm", "phpstorm", "goland", "clion", "rustrover"].contains(&name.as_str()) {
            Some(with(vec!["--line".into(), line.clone(), f.clone()]))
        } else if ["notepad++"].contains(&name.as_str()) {
            Some(with(vec![format!("-n{line}"), f.clone()]))
        } else {
            None
        };
        if let Some(args) = args { out.push((program.to_string(), args)); }
    }
    #[cfg(target_os = "windows")]
    {
        // `code` is a .cmd script there: it has to go through the shell.
        out.push(("cmd".into(), vec!["/C".into(), "code".into(), "-g".into(), format!("{f}:{line}:{col}")]));
        out.push(("cmd".into(), vec!["/C".into(), "start".into(), "".into(), f.clone()]));
    }
    #[cfg(target_os = "macos")]
    {
        out.push(("code".into(), vec!["-g".into(), format!("{f}:{line}:{col}")]));
        out.push(("open".into(), vec![f.clone()]));
    }
    #[cfg(all(not(target_os = "windows"), not(target_os = "macos")))]
    {
        out.push(("code".into(), vec!["-g".into(), format!("{f}:{line}:{col}")]));
        out.push(("xdg-open".into(), vec![f.clone()]));
    }
    out
}

/// Starts the first of `editor_commands` that launches, without waiting for it. Returns what it ran, for the terminal.
pub(crate) fn open_in_editor(loc: &Location, root: &Path) -> Option<String> {
    let file = resolve(&loc.file, root)?;
    let env = |k: &str| std::env::var(k).ok();
    for (program, args) in editor_commands(loc, &file, &env) {
        let mut cmd = std::process::Command::new(&program);
        cmd.args(&args).stdin(std::process::Stdio::null()).stdout(std::process::Stdio::null()).stderr(std::process::Stdio::null());
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW: no console flashing up for `cmd /C`
        }
        if cmd.spawn().is_ok() { return Some(format!("{program} {}", args.join(" "))); }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn frames_are_read_in_the_shapes_v8_and_quickjs_print() {
        let l = |f: &str, line, col| Some(Location { file: f.into(), line, col });
        assert_eq!(parse_frame("    at App (C:\\proj\\src\\app.jsx:12:5)"), l("C:\\proj\\src\\app.jsx", 12, 5));
        assert_eq!(parse_frame("at C:\\proj\\src\\app.jsx:7:1"), l("C:\\proj\\src\\app.jsx", 7, 1));
        assert_eq!(parse_frame("    at async load (file:///C:/proj/src/data.ts:30:9)"), l("C:/proj/src/data.ts", 30, 9));
        assert_eq!(parse_frame("    at <anonymous> (app.js:12)"), l("app.js", 12, 0));
        assert_eq!(parse_frame("    at render (/home/me/app/src/view.tsx:3:14)"), l("/home/me/app/src/view.tsx", 3, 14));
        assert_eq!(parse_frame("    at Object.<anonymous> (C:\\p\\a.js:1)"), l("C:\\p\\a.js", 1, 0));
        // Not frames.
        assert_eq!(parse_frame("TypeError: x is not a function"), None);
        assert_eq!(parse_frame("    at native"), None);
        assert_eq!(parse_frame("    at f (file.js:0:0)"), None, "line 0 is not a line");
    }

    #[test]
    fn the_first_frame_in_the_apps_own_code_is_the_one_to_show() {
        let err = "TypeError: boom\n    at helper (C:\\proj\\node_modules\\lib\\index.js:5:1)\n    at polyfills (polyfills.js:9:9)\n    \
                   at Card (C:\\proj\\src\\Card.jsx:21:7)\n    at App (C:\\proj\\src\\app.jsx:4:3)";
        let loc = first_user_location(err).expect("a user frame");
        assert_eq!((loc.file.as_str(), loc.line, loc.col), ("C:\\proj\\src\\Card.jsx", 21, 7));
        assert_eq!(first_user_location("Error: nothing here"), None);
        assert_eq!(first_user_location("    at x (C:\\proj\\node_modules\\a\\b.js:1:1)"), None);
    }

    #[test]
    fn an_excerpt_has_context_lines_and_stays_inside_the_file() {
        let src = "one\ntwo\n\tthree\nfour\nfive\n";
        let e = excerpt_of(src, 3, 1).unwrap();
        assert_eq!((e.first_line, e.at), (2, 1));
        assert_eq!(e.lines, vec!["two", "  three", "four"], "a tab becomes two spaces");
        let top = excerpt_of(src, 1, 2).unwrap();
        assert_eq!((top.first_line, top.at, top.lines.len()), (1, 0, 3));
        let end = excerpt_of(src, 5, 2).unwrap();
        assert_eq!((end.first_line, end.at, end.lines.len()), (3, 2, 3));
        assert!(excerpt_of(src, 6, 1).is_none() && excerpt_of(src, 0, 1).is_none(), "outside the file");
        let long = "x".repeat(500);
        assert_eq!(excerpt_of(&long, 1, 0).unwrap().lines[0].chars().count(), 200);
    }

    #[test]
    fn an_error_view_finds_the_place_and_the_lines_and_prints_the_place_relative_to_the_project() {
        let dir = std::env::temp_dir().join(format!("glyx-eov-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(dir.join("src")).unwrap();
        std::fs::write(dir.join("src").join("Card.jsx"), "a\nb\nconst x = y.z;\nd\ne\n").unwrap();
        let file = dir.join("src").join("Card.jsx");
        let err = format!("TypeError: y is undefined\n    at Card ({}:3:11)", file.display());
        let view = ErrorView::build(&err, &[dir.clone()], None);
        let ex = view.excerpt.as_ref().expect("the lines around it");
        assert_eq!((ex.first_line, ex.at, ex.lines.len()), (1, 2, 5));
        assert_eq!(ex.lines[ex.at], "const x = y.z;");
        let shown = view.place(&dir).unwrap();
        assert!(shown.ends_with("Card.jsx:3:11") && !shown.contains(dir.to_str().unwrap()), "{shown}");
        // No frame in the app's own code: nothing to point at.
        let none = ErrorView::build("Error: boom", &[dir.clone()], None);
        assert!(none.loc.is_none() && none.excerpt.is_none() && none.place(&dir).is_none());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn frames_in_the_bundle_are_mapped_to_the_apps_files_and_the_lines_come_from_the_map() {
        // The map says: generated line 5 col 9 is src/app.jsx line 3 col 11, and it carries that file's text.
        let json = br#"{"version":3,"sources":["../src/app.jsx"],"sourcesContent":["a\nb\nconst x = y.z;\nd\ne\n"],
                        "mappings":";;;;QAEU"}"#;
        let map = crate::source_map::SourceMap::from_json(json).expect("a map");
        let root = PathBuf::from("/nonexistent/project");
        let roots = vec![root.clone(), root.join("dist")];
        let err = "TypeError: y is undefined\n    at Card (glyx://app/bundle.js:5:9)\n    at glyx://app/bundle.js:99:1";
        let view = ErrorView::build(err, &roots, Some(&map));
        // dist/../src/app.jsx, cleaned.
        assert!(view.shown.lines().nth(1).unwrap().contains("src/app.jsx:3:11") || view.shown.lines().nth(1).unwrap().contains("src\\app.jsx:3:11"), "{}", view.shown);
        assert!(view.shown.lines().nth(1).unwrap().trim_start().starts_with("at Card ("), "the function name is kept: {}", view.shown);
        assert_eq!(view.shown.lines().nth(2).unwrap(), "    at glyx://app/bundle.js:99:1", "an unmapped frame is left as it was");
        assert_eq!(view.err, err, "the original is kept for copying");
        let loc = view.loc.as_ref().expect("the first frame in the app's own code");
        assert_eq!((loc.line, loc.col), (3, 11));
        let ex = view.excerpt.as_ref().expect("lines taken from the map's embedded source, not from disk");
        assert_eq!(ex.lines[ex.at], "const x = y.z;");
        assert_eq!(ex.first_line, 1);
    }

    #[test]
    fn paths_are_cleaned_lexically() {
        assert_eq!(normalize("/p/dist/../src/app.jsx"), "/p/src/app.jsx");
        assert_eq!(normalize("../src/app.jsx"), "../src/app.jsx", "nothing before it to fold into");
        assert_eq!(normalize("./src/./a.jsx"), "src/a.jsx");
        assert_eq!(normalize("C:\\p\\dist\\..\\src\\a.jsx"), "C:\\p\\src\\a.jsx");
        assert_eq!(replace_location("    at Card (glyx://app/bundle.js:5:9)", "src/a.jsx:3:11"), "    at Card (src/a.jsx:3:11)");
        assert_eq!(replace_location("    at glyx://app/bundle.js:5:9", "src/a.jsx:3:11"), "    at src/a.jsx:3:11");
    }

    #[test]
    fn a_frames_file_is_found_as_written_or_under_the_project() {
        let dir = std::env::temp_dir().join(format!("glyx-eo-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(dir.join("src")).unwrap();
        std::fs::write(dir.join("src").join("a.jsx"), "x").unwrap();
        assert_eq!(resolve("src/a.jsx", &dir), Some(dir.join("src/a.jsx")));
        assert_eq!(resolve("./src/a.jsx", &dir), Some(dir.join("src/a.jsx")));
        let abs = dir.join("src").join("a.jsx");
        assert_eq!(resolve(abs.to_str().unwrap(), Path::new("/elsewhere")), Some(abs));
        assert_eq!(resolve("src/missing.jsx", &dir), None);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn the_editor_command_follows_the_users_settings_then_falls_back() {
        let loc = Location { file: "src/a.jsx".into(), line: 12, col: 5 };
        let file = Path::new("/p/src/a.jsx");
        let env_of = |pairs: &'static [(&'static str, &'static str)]| move |k: &str| pairs.iter().find(|(n, _)| *n == k).map(|(_, v)| v.to_string());

        // GLYX_EDITOR is a template and goes first.
        let cmds = editor_commands(&loc, file, &env_of(&[("GLYX_EDITOR", "myed --at {file}:{line}:{col}"), ("EDITOR", "code")]));
        assert_eq!(cmds[0], ("myed".to_string(), vec!["--at".to_string(), "/p/src/a.jsx:12:5".to_string()]));
        assert_eq!(cmds[1].0, "code", "then EDITOR, which VS Code takes a line from");
        assert_eq!(cmds[1].1, vec!["-g".to_string(), "/p/src/a.jsx:12:5".to_string()]);

        // Others know their own flags; a terminal editor is skipped.
        let jb = editor_commands(&loc, file, &env_of(&[("VISUAL", "webstorm64.exe")]));
        assert_eq!(jb[0], ("webstorm64.exe".to_string(), vec!["--line".to_string(), "12".to_string(), "/p/src/a.jsx".to_string()]));
        let npp = editor_commands(&loc, file, &env_of(&[("EDITOR", "notepad++")]));
        assert_eq!(npp[0].1, vec!["-n12".to_string(), "/p/src/a.jsx".to_string()]);
        let vim = editor_commands(&loc, file, &env_of(&[("EDITOR", "vim")]));
        assert!(vim.iter().all(|(p, _)| p != "vim"), "a terminal editor cannot be started from here");
        // A flag the user put in EDITOR is kept.
        let c = editor_commands(&loc, file, &env_of(&[("EDITOR", "code --reuse-window")]));
        assert_eq!(c[0].1[0], "--reuse-window");

        // Nothing set: VS Code if there is one, then the system default for the file.
        let none = editor_commands(&loc, file, &env_of(&[]));
        assert!(none.len() >= 2 && none.last().unwrap().1.iter().any(|a| a.contains("a.jsx")), "{none:?}");
        assert_eq!(editor_commands(&Location { col: 0, ..loc.clone() }, file, &env_of(&[("EDITOR", "code")]))[0].1[1], "/p/src/a.jsx:12:1", "no column means column 1");
    }
}
