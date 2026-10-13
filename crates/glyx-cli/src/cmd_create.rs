use anyhow::Result;
use std::path::{Path, PathBuf};

use super::{
    glyx_home, relpath, write_file, copy_glyx_mark_to, pm,
};

pub(super) fn cmd_create(name: &str, native: bool, template: &str, typescript: bool, p: pm::Pm) -> Result<()> {
    let dest = PathBuf::from(name);
    if dest.exists() { anyhow::bail!("directory '{}' already exists", name); }

    let valid_templates = ["blank", "notes", "dashboard", "settings"];
    if !valid_templates.contains(&template) {
        anyhow::bail!(
            "Unknown template '{}'. Valid options: {}",
            template,
            valid_templates.join(", ")
        );
    }

    // Workspace checkout → wire local path/file deps (contributor fast-iteration),
    // but only for a project made inside that checkout (or when asked with
    // GLYX_LINK_LOCAL=1): a CLI built from the source on a developer's machine must
    // not write `file:` paths into projects made anywhere else.
    // Standalone CLI → npm versions + git deps pinned to this CLI's release tag.
    let glyx_home = glyx_home().ok().filter(|home| {
        links_to_checkout(&dest, home, std::env::var("GLYX_LINK_LOCAL").as_deref() == Ok("1"))
    });

    if native {
        println!("Creating Glyx project (native): {name}/");
        println!("  Template: {template}  |  Includes Cargo.toml + src/main.rs{}", if typescript { "  |  TypeScript" } else { "" });
        cmd_create_native(name, &dest, glyx_home.as_deref(), template, typescript)?;
    } else {
        println!("Creating Glyx project: {name}/");
        println!("  Template: {template}  |  {}  |  JS-only mode — no Rust toolchain required.", if typescript { "TypeScript" } else { "JavaScript" });
        cmd_create_js(name, &dest, glyx_home.as_deref(), template, typescript)?;
    }

    println!();
    println!("Created {name}/  [template: {template}]");
    println!();
    println!("Next steps:");
    println!("  cd {name}");
    println!("  {} install", p.name());
    if typescript {
        println!("  glyx check    # type-check (TypeScript)");
    }
    if native {
        println!("  glyx dev      # hot-reload dev server (requires Rust toolchain)");
    } else {
        println!("  glyx dev      # hot-reload dev server (no Rust required)");
    }
    Ok(())
}

/// Whether a new project at `dest` links to the packages in the glyx checkout at
/// `home` (`file:` dependencies): when it is made inside the checkout, or `force`.
fn links_to_checkout(dest: &Path, home: &Path, force: bool) -> bool {
    if force {
        return true;
    }
    // `dest` doesn't exist yet: resolve its folder and add its name back.
    let abs = |p: &Path| -> Option<PathBuf> {
        let p = if p.is_absolute() { p.to_path_buf() } else { std::env::current_dir().ok()?.join(p) };
        let name = p.file_name()?.to_owned();
        Some(p.parent()?.canonicalize().ok()?.join(name))
    };
    match (abs(dest), home.canonicalize().ok()) {
        (Some(dest), Some(home)) => dest.starts_with(home),
        _ => false,
    }
}

/// npm/file dep specifiers for the four @glyx JS packages.
/// Workspace checkout → `file:` links; standalone CLI → npm versions matching
/// this CLI's release.
fn js_dep_specs(dest: &Path, glyx_home: Option<&Path>) -> (String, String, String, String) {
    match glyx_home {
        Some(h) => (
            format!("file:{}", relpath(dest, &h.join("js/packages/@glyx/react"))),
            format!("file:{}", relpath(dest, &h.join("js/packages/@glyx/router"))),
            format!("file:{}", relpath(dest, &h.join("js/packages/@glyx/design"))),
            format!("file:{}", relpath(dest, &h.join("js/packages/@glyx/config"))),
        ),
        None => {
            let v = format!("^{}", env!("CARGO_PKG_VERSION"));
            (v.clone(), v.clone(), v.clone(), v)
        }
    }
}

pub(super) fn cmd_create_js(name: &str, dest: &Path, glyx_home: Option<&Path>, template: &str, typescript: bool) -> Result<()> {
    std::fs::create_dir_all(dest.join("src"))?;
    std::fs::create_dir_all(dest.join("src/components"))?;
    std::fs::create_dir_all(dest.join("public"))?;
    copy_glyx_mark_to(glyx_home, dest, "public");

    let (react_dep, router_dep, design_dep, config_dep) = js_dep_specs(dest, glyx_home);

    write_app_files(name, dest, template, "src", glyx_config_ts_js_template(name), typescript,
                    (&react_dep, &router_dep, &design_dep, &config_dep))?;
    // target/ holds generated files, including target/glyx/devtools.json
    // (the DevTools token): never commit it.
    write_file(dest.join(".gitignore"), "/node_modules\n/dist/\n/target/\n")?;
    write_file(dest.join(".claude/SKILLS.md"), &skills_md_template())?;
    Ok(())
}

pub(super) fn cmd_create_native(name: &str, dest: &Path, glyx_home: Option<&Path>, template: &str, typescript: bool) -> Result<()> {
    std::fs::create_dir_all(dest.join("src"))?;
    std::fs::create_dir_all(dest.join("ui"))?;
    std::fs::create_dir_all(dest.join("ui/components"))?;
    std::fs::create_dir_all(dest.join("public"))?;
    copy_glyx_mark_to(glyx_home, dest, "public");

    // Rust dependency block:
    //   Workspace checkout → path deps (contributors iterate on the framework).
    //   Standalone CLI     → git deps pinned to this CLI's release tag, PLUS the
    //   [patch.crates-io] entries so the vendored forks (vello pool cap,
    //   mimalloc static-CRT) apply to the user's
    //   build graph — patch tables do NOT propagate through dependencies.
    let rust_deps = match glyx_home {
        Some(h) => {
            let core_path  = relpath(dest, &h.join("crates/glyx-core"));
            let shell_path = relpath(dest, &h.join("crates/glyx-shell"));
            let vello_path = relpath(dest, &h.join("vendor/vello"));
            let mimalloc_path = relpath(dest, &h.join("vendor/libmimalloc-sys"));
            format!(
                r#"glyx-core  = {{ path = "{core_path}", default-features = false }}
glyx-shell = {{ path = "{shell_path}" }}
env_logger  = "0.11"

# Same as the git-deps branch below — patch tables do NOT propagate through
# path dependencies either, so a project outside the workspace still needs
# its own copy of this to get Glyx's vendored vello/mimalloc fixes instead
# of upstream crates.io behavior (large GPU-buffer pools, CRT link errors).
[patch.crates-io]
vello           = {{ path = "{vello_path}" }}
libmimalloc-sys = {{ path = "{mimalloc_path}" }}
"#)
        }
        None => {
            let tag = format!("v{}", env!("CARGO_PKG_VERSION"));
            format!(
                r#"glyx-core  = {{ git = "https://github.com/glyx-dev/glyx", tag = "{tag}", default-features = false }}
glyx-shell = {{ git = "https://github.com/glyx-dev/glyx", tag = "{tag}" }}
env_logger  = "0.11"

# Glyx's memory fixes live in vendored forks inside the glyx repo.  These
# patches make YOUR build use them too — do not remove, or you get upstream
# vello/mimalloc behavior back (large GPU-buffer pools, CRT link errors).
[patch.crates-io]
vello           = {{ git = "https://github.com/glyx-dev/glyx", tag = "{tag}" }}
libmimalloc-sys = {{ git = "https://github.com/glyx-dev/glyx", tag = "{tag}" }}
"#)
        }
    };

    let (react_dep, router_dep, design_dep, config_dep) = js_dep_specs(dest, glyx_home);

    write_file(dest.join("Cargo.toml"), &format!(
        r#"[package]
name    = "{name}"
version = "0.1.0"
edition = "2021"

[features]
# "dev" gates hot-reload, bun watcher, and dev overlay in glyx-core.
# Production builds (glyx build) use --no-default-features, then re-add just
# the engine feature (v8 or quickjs) to exclude dev-only tooling.
# glyx-core is pulled in below with default-features = false, so an engine
# must be selected explicitly — v8 is the desktop default; switch to
# quickjs for a mobile or lightweight-desktop build (mutually exclusive,
# never both).
default = ["dev", "v8"]
dev     = ["glyx-core/dev"]
v8      = ["glyx-core/v8"]
quickjs = ["glyx-core/quickjs"]

[dependencies]
{rust_deps}"#))?;
    write_file(dest.join("src/main.rs"), "#![cfg_attr(all(target_os = \"windows\", not(debug_assertions)), windows_subsystem = \"windows\")]\n\nfn main() {\n    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or(\"info\"))\n        .format_timestamp(None)\n        .format_module_path(false)\n        .init();\n    glyx_core::run(glyx_core::AppConfig::from_config());\n}\n")?;
    write_app_files(name, dest, template, "ui", glyx_config_ts_native_template(name), typescript,
                    (&react_dep, &router_dep, &design_dep, &config_dep))?;
    write_file(dest.join(".gitignore"), "/target\n/node_modules\n/dist/\n/target/glyx/glyx.config.resolved.json\n")?;
    write_file(dest.join(".claude/SKILLS.md"), &skills_md_template())?;
    Ok(())
}

/// The files both project kinds share: the app source, `glyx.config.ts`,
/// `package.json` and, for TypeScript, `tsconfig.json`. `ui` is the source folder.
fn write_app_files(
    name: &str,
    dest: &Path,
    template: &str,
    ui: &str,
    config_ts: String,
    typescript: bool,
    (react_dep, router_dep, design_dep, config_dep): (&str, &str, &str, &str),
) -> Result<()> {
    let ext = if typescript { "tsx" } else { "jsx" };
    let app = if typescript { app_tsx_for_template(name, template) } else { app_jsx_for_template(name, template) };
    write_file(dest.join(format!("{ui}/app.{ext}")), &app)?;
    // The config names the entry file: point it at the one just written.
    write_file(dest.join("glyx.config.ts"), &config_ts.replace(&format!("{ui}/app.jsx"), &format!("{ui}/app.{ext}")))?;
    // JSX is not set up by a tsconfig for a JavaScript project, and for a
    // TypeScript one the bundler forces the JSX mode itself, so this file is
    // for the editor and `glyx check` only.
    if typescript {
        write_file(dest.join("tsconfig.json"), &tsconfig_template(ui))?;
    }
    let (dev_extra, scripts) = if typescript {
        (
            ",\n    \"typescript\":   \"^5\",\n    \"@types/react\": \"^18\"",
            ",\n  \"scripts\": {\n    \"check\": \"glyx check\"\n  }",
        )
    } else {
        ("", "")
    };
    write_file(dest.join("package.json"), &format!(
        r#"{{
  "name": "{name}",
  "version": "0.1.0",
  "private": true,
  "dependencies": {{
    "react":          "^18",
    "@glyx-dev/react":   "{react_dep}",
    "@glyx-dev/router":  "{router_dep}",
    "@glyx-dev/design":  "{design_dep}"
  }},
  "devDependencies": {{
    "@glyx-dev/config": "{config_dep}"{dev_extra}
  }}{scripts}
}}
"#))?;
    Ok(())
}

/// A TypeScript project's `tsconfig.json`.
pub(super) fn tsconfig_template(ui: &str) -> String {
    format!(r#"{{
  "compilerOptions": {{
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": []
  }},
  "include": ["{ui}", "glyx.config.ts"]
}}
"#)
}

/// The edits that turn a template's JSX into TypeScript: its components' props,
/// and the data they carry, get types. Each `from` must match exactly once (a
/// test checks every template, so changing one without the other is caught).
fn tsx_edits(template: &str) -> &'static [(&'static str, &'static str)] {
    match template {
        "notes" => &[
            ("const NOTES = [",
             "interface Note {\n  id: number;\n  title: string;\n  body: string;\n}\n\nconst NOTES: Note[] = ["),
            ("function Sidebar({ notes, selectedId, onSelect, onNew }) {",
             "function Sidebar({ notes, selectedId, onSelect, onNew }: {\n  notes: Note[];\n  selectedId: number;\n  onSelect: (id: number) => void;\n  onNew: () => void;\n}) {"),
            ("function NoteView({ note }) {",
             "function NoteView({ note }: { note: Note | null }) {"),
        ],
        "dashboard" => &[
            ("const STATS = [",
             "interface Stat {\n  label: string;\n  value: string;\n  delta: string;\n  variant: 'success' | 'warning' | 'error';\n}\n\nconst STATS: Stat[] = ["),
            ("function Sidebar({ active, onSelect }) {",
             "function Sidebar({ active, onSelect }: { active: string; onSelect: (item: string) => void }) {"),
            ("function StatCard({ label, value, delta, variant }) {",
             "function StatCard({ label, value, delta, variant }: Stat) {"),
        ],
        "settings" => &[
            ("function SettingRow({ label, description, children }) {",
             "function SettingRow({ label, description, children }: {\n  label: string;\n  description?: string;\n  children?: React.ReactNode;\n}) {"),
            ("function Section({ title, children }) {",
             "function Section({ title, children }: { title: string; children?: React.ReactNode }) {"),
        ],
        _ => &[],
    }
}

/// The TypeScript (`app.tsx`) version of a template.
pub(super) fn app_tsx_for_template(name: &str, template: &str) -> String {
    let mut src = app_jsx_for_template(name, template);
    for (from, to) in tsx_edits(template) {
        src = src.replacen(from, to, 1);
    }
    src.replace("app.jsx", "app.tsx")
}

pub(super) fn app_jsx_for_template(name: &str, template: &str) -> String {
    match template {
        "notes"     => app_jsx_notes(name),
        "dashboard" => app_jsx_dashboard(name),
        "settings"  => app_jsx_settings(name),
        _           => app_jsx_blank(name),
    }
}

pub(super) fn app_jsx_blank(name: &str) -> String {
    format!(r#"import React, {{ useState }} from 'react';
import {{ View, Text, Image, Pressable, render, useWindowSize }} from '@glyx-dev/react';

function App() {{
  const {{ width, height }} = useWindowSize();
  const [count, setCount] = useState(0);

  return (
    <View
      width={{width}}
      height={{height}}
      style={{{{ backgroundColor: '#0A0A0E', justifyContent: 'center', alignItems: 'center', gap: 20 }}}}
    >
      <Image src="./public/glyx-mark.svg" width={{64}} height={{56}} />
      <Text style={{{{ fontSize: 28, color: '#EDEDF2', fontWeight: '700' }}}}>
        {name}
      </Text>
      <Text style={{{{ fontSize: 16, color: '#A9A9B8' }}}}>
        count: {{count}}
      </Text>
      <Pressable
        onPress={{() => setCount(c => c + 1)}}
        style={{{{ backgroundColor: '#F59E0B', paddingVertical: 10, paddingHorizontal: 24, borderRadius: 8 }}}}
      >
        <Text style={{{{ fontSize: 15, color: '#131318', fontWeight: '600' }}}}>increment</Text>
      </Pressable>
    </View>
  );
}}

render(<App />);
"#)
}

pub(super) fn app_jsx_notes(name: &str) -> String {
    format!(r#"import React, {{ useState }} from 'react';
import {{ View, Text, Pressable, ScrollView, render, useWindowSize }} from '@glyx-dev/react';
import {{ ThemeProvider, useTheme, Button, Card, Label, Heading }} from '@glyx-dev/design';

const NOTES = [
  {{ id: 1, title: 'Welcome', body: 'This is your first note in {name}. Click any note to read it, or press New Note to create one.' }},
  {{ id: 2, title: 'Getting started', body: 'Edit src/app.jsx to customise this template. Import more components from @glyx-dev/react and @glyx-dev/design.' }},
];

function Sidebar({{ notes, selectedId, onSelect, onNew }}) {{
  const {{ colors, space }} = useTheme();
  return (
    <View style={{{{ width: 240, backgroundColor: colors.surface, borderRightWidth: 1, borderRightColor: colors.border }}}}>
      <View style={{{{ padding: space[4], borderBottomWidth: 1, borderBottomColor: colors.border }}}}>
        <Heading level={{2}}>Notes</Heading>
      </View>
      <ScrollView style={{{{ flex: 1 }}}}>
        {{notes.map(n => (
          <Pressable
            key={{n.id}}
            onPress={{() => onSelect(n.id)}}
            style={{{{
              padding: space[3],
              backgroundColor: n.id === selectedId ? colors.primary + '22' : 'transparent',
              borderLeftWidth: 3,
              borderLeftColor: n.id === selectedId ? colors.primary : 'transparent',
            }}}}
          >
            <Label bold={{n.id === selectedId}}>{{n.title}}</Label>
          </Pressable>
        ))}}
      </ScrollView>
      <View style={{{{ padding: space[3] }}}}>
        <Button label="+ New Note" onPress={{onNew}} />
      </View>
    </View>
  );
}}

function NoteView({{ note }}) {{
  const {{ colors, space }} = useTheme();
  if (!note) return (
    <View style={{{{ flex: 1, justifyContent: 'center', alignItems: 'center' }}}}>
      <Label muted>Select a note</Label>
    </View>
  );
  return (
    <ScrollView style={{{{ flex: 1, padding: space[6] }}}}>
      <Heading level={{1}}>{{note.title}}</Heading>
      <View style={{{{ height: space[4] }} }} />
      <Label size="md">{{note.body}}</Label>
    </ScrollView>
  );
}}

function App() {{
  const {{ width, height }} = useWindowSize();
  const [selectedId, setSelectedId] = useState(1);
  const [notes, setNotes] = useState(NOTES);
  const {{ colors }} = useTheme();

  const selected = notes.find(n => n.id === selectedId) ?? null;

  function handleNew() {{
    const id = Math.max(0, ...notes.map(n => n.id)) + 1;
    const note = {{ id, title: 'Untitled', body: '' }};
    setNotes(prev => [...prev, note]);
    setSelectedId(id);
  }}

  return (
    <View width={{width}} height={{height}} style={{{{ backgroundColor: colors.bg, flexDirection: 'row' }}}}>
      <Sidebar notes={{notes}} selectedId={{selectedId}} onSelect={{setSelectedId}} onNew={{handleNew}} />
      <NoteView note={{selected}} />
    </View>
  );
}}

render(
  <ThemeProvider colorScheme="system">
    <App />
  </ThemeProvider>
);
"#)
}

pub(super) fn app_jsx_dashboard(name: &str) -> String {
    format!(r#"import React, {{ useState }} from 'react';
import {{ View, Text, Pressable, render, useWindowSize }} from '@glyx-dev/react';
import {{ ThemeProvider, useTheme, Card, Label, Heading, Divider, Badge }} from '@glyx-dev/design';

const NAV_ITEMS = ['Overview', 'Analytics', 'Users', 'Settings'];

const STATS = [
  {{ label: 'Total Users',    value: '12,480', delta: '+8.2%',  variant: 'success' }},
  {{ label: 'Active Sessions', value: '1,024',  delta: '+3.1%',  variant: 'success' }},
  {{ label: 'Requests / min', value: '4,302',  delta: '-0.4%',  variant: 'warning' }},
  {{ label: 'Error Rate',     value: '0.12%',  delta: '+0.01%', variant: 'error'   }},
];

function Sidebar({{ active, onSelect }}) {{
  const {{ colors, space }} = useTheme();
  return (
    <View style={{{{ width: 200, backgroundColor: colors.surface, borderRightWidth: 1, borderRightColor: colors.border, paddingTop: space[6] }}}}>
      <View style={{{{ paddingHorizontal: space[4], paddingBottom: space[4] }}}}>
        <Heading level={{3}}>{name}</Heading>
      </View>
      <Divider />
      {{NAV_ITEMS.map(item => (
        <Pressable
          key={{item}}
          onPress={{() => onSelect(item)}}
          style={{{{
            paddingHorizontal: space[4],
            paddingVertical:   space[3],
            backgroundColor:   item === active ? colors.primary + '18' : 'transparent',
          }}}}
        >
          <Label bold={{item === active}} style={{{{ color: item === active ? colors.primary : colors.text }}}}>
            {{item}}
          </Label>
        </Pressable>
      ))}}
    </View>
  );
}}

function StatCard({{ label, value, delta, variant }}) {{
  const {{ space }} = useTheme();
  return (
    <Card style={{{{ flex: 1, minWidth: 140, gap: space[2] }}}}>
      <Label muted size="sm">{{label}}</Label>
      <Heading level={{2}}>{{value}}</Heading>
      <Badge label={{delta}} variant={{variant}} />
    </Card>
  );
}}

function Overview() {{
  const {{ colors, space }} = useTheme();
  return (
    <View style={{{{ flex: 1, padding: space[6], gap: space[6] }}}}>
      <Heading level={{1}}>Overview</Heading>
      <View style={{{{ flexDirection: 'row', gap: space[4] }}}}>
        {{STATS.map(s => <StatCard key={{s.label}} {{...s}} />)}}
      </View>
      <Card style={{{{ flex: 1 }}}}>
        <Label muted>Chart placeholder — connect your data source to render a chart here.</Label>
      </Card>
    </View>
  );
}}

function App() {{
  const {{ width, height }} = useWindowSize();
  const [active, setActive] = useState('Overview');
  const {{ colors }} = useTheme();
  return (
    <View width={{width}} height={{height}} style={{{{ backgroundColor: colors.bg, flexDirection: 'row' }}}}>
      <Sidebar active={{active}} onSelect={{setActive}} />
      <Overview />
    </View>
  );
}}

render(
  <ThemeProvider colorScheme="system">
    <App />
  </ThemeProvider>
);"#)
}

pub(super) fn app_jsx_settings(name: &str) -> String {
    format!(r#"import React, {{ useState }} from 'react';
import {{ View, Text, Pressable, Switch, render, useWindowSize }} from '@glyx-dev/react';
import {{ ThemeProvider, useTheme, Card, Label, Heading, Divider, Button }} from '@glyx-dev/design';

function SettingRow({{ label, description, children }}) {{
  const {{ colors, space }} = useTheme();
  return (
    <View style={{{{ flexDirection: 'row', alignItems: 'center', paddingVertical: space[3], gap: space[4] }}}}>
      <View style={{{{ flex: 1 }}}}>
        <Label>{{label}}</Label>
        {{description && <Label muted size="sm">{{description}}</Label>}}
      </View>
      {{children}}
    </View>
  );
}}

function Section({{ title, children }}) {{
  const {{ space }} = useTheme();
  return (
    <Card style={{{{ gap: space[2] }}}}>
      <Heading level={{3}}>{{title}}</Heading>
      <Divider />
      {{children}}
    </Card>
  );
}}

function App() {{
  const {{ width, height }} = useWindowSize();
  const {{ colors, space }} = useTheme();

  const [darkMode,      setDarkMode]      = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [telemetry,     setTelemetry]     = useState(false);
  const [autoUpdate,    setAutoUpdate]    = useState(true);

  return (
    <View width={{width}} height={{height}} style={{{{ backgroundColor: colors.bg }}}}>
      <View style={{{{ maxWidth: 640, alignSelf: 'center', flex: 1, padding: space[6], gap: space[6] }}}}>
        <Heading level={{1}}>Settings</Heading>

        <Section title="Appearance">
          <SettingRow label="Dark mode" description="Switch between light and dark theme">
            <Switch value={{darkMode}} onValueChange={{setDarkMode}} />
          </SettingRow>
        </Section>

        <Section title="Notifications">
          <SettingRow label="Enable notifications" description="Show system notifications for important events">
            <Switch value={{notifications}} onValueChange={{setNotifications}} />
          </SettingRow>
        </Section>

        <Section title="Privacy">
          <SettingRow label="Usage telemetry" description="Help improve {name} by sending anonymous usage data">
            <Switch value={{telemetry}} onValueChange={{setTelemetry}} />
          </SettingRow>
        </Section>

        <Section title="Updates">
          <SettingRow label="Auto-update" description="Automatically install updates when available">
            <Switch value={{autoUpdate}} onValueChange={{setAutoUpdate}} />
          </SettingRow>
          <View style={{{{ alignItems: 'flex-start' }}}}>
            <Button label="Check for updates" variant="secondary" onPress={{() => {{}}}} />
          </View>
        </Section>
      </View>
    </View>
  );
}}

render(
  <ThemeProvider colorScheme="system">
    <App />
  </ThemeProvider>
);
"#)
}

pub(super) fn glyx_config_ts_js_template(name: &str) -> String {
    format!(r#"import {{ defineConfig }} from '@glyx-dev/config';

export default defineConfig({{
  name:    '{name}',
  version: '1.0.0',
  app: {{
    publisher:   '{name}',              // Company or author name (used in installer)
    description: 'A {name} app.',      // Short app description
    website:     'https://example.com', // https://yoursite.com
    license:     'LICENSE.txt',
  }},
  window: {{
    title:       '{name}',
    width:       1280,
    height:      800,
    startupMode: 'windowed',
  }},
  capabilities: {{
    fs:           {{ read: ['public/**'], write: [] }},
    db:           false,
    dialog:       false,
    clipboard:    false,
    notification: false,
  }},
  dev: {{
    entry:  'src/app.jsx',
    output: 'dist/app.js',
    watch:  ['src'],
  }},
}});"#)
}

pub(super) fn skills_md_template() -> String {
    r#"# Project Skills for Claude Code

These skills help Claude work with this Glyx app.

## /add-capability

Add a new capability to this app.

1. Open `glyx.config.ts` and add the capability key to the `capabilities` block
2. For `fs`, add glob patterns to `read`, `write`, or `delete` arrays
3. Import the API in your component: `import { fs, db, clipboard, ... } from '@glyx-dev/react'`
4. Glyx will enforce the capability at runtime — calls outside declared globs throw `CapabilityDenied`

Common capabilities: `fs`, `db`, `dialog`, `clipboard`, `notification`, `audio`, `network`, `credentials`, `storage`, `updater`

## /scaffold-component

Create a new React component for this app.

1. Create the file in `src/components/` (JS-only) or `ui/components/` (native project)
2. Use `@glyx-dev/react` primitives — `View`, `Text`, `Pressable`, `ScrollView`, `TextInput`, `Image`
3. Use `@glyx-dev/design` for themed UI — `Button`, `Card`, `TextField`, `Modal`, `Alert`, `Tabs`
4. Style with object props (React Native-style, not CSS strings)

## /scaffold-plugin

Add a JS plugin to extend this app with custom backend commands.

1. Create `src/plugins/<name>.plugin.js`
2. Export async functions — they become `backend.<name>.<fn>()` in React
3. Register in `glyx.config.ts`: `plugins: [{ entry: 'src/plugins/<name>.plugin.js', name: '<name>', capabilities: [...] }]`
4. Plugins can use any capability their `capabilities` array declares (must be granted to the app too)

```js
// src/plugins/example.plugin.js
import { db } from '@glyx-dev/react'

export async function getAll() {
  return db.query('SELECT * FROM items ORDER BY created_at DESC')
}
```

## /explain-error

Common errors in Glyx apps:

**CapabilityDenied** — the JS code called a gated API but the capability is missing from `glyx.config.ts`.
Fix: add the capability key to the `capabilities` block.

**fs path not allowed** — the `fs.*` call used a path outside the declared globs.
Fix: widen the `read`/`write`/`delete` globs, or use `dialog.showOpenDialog()` (dialog results are pre-authorized).

**plugin capability not granted** — a plugin's `capabilities` array lists something the app hasn't declared.
Fix: add the capability to the app's top-level `capabilities` block first.

**Canvas ctx is null** — `canvasRef.current` is accessed before the `Canvas` mounts.
Fix: guard with `if (!ctx) return` inside the `useEffect`, or use `_veloxOnMount` callback.
"#.to_string()
}

pub(super) fn glyx_config_ts_native_template(name: &str) -> String {
    format!(r#"import {{ defineConfig }} from '@glyx-dev/config';

export default defineConfig({{
  name:    '{name}',
  version: '1.0.0',
  app: {{
    publisher:   '{name}',              // Company or author name (used in installer)
    description: 'A {name} app.',      // Short app description
    website:     'https://example.com', // https://yoursite.com
    license:     'LICENSE.txt',
  }},
  window: {{
    title:       '{name}',
    width:       1280,
    height:      800,
    startupMode: 'windowed',
  }},
  capabilities: {{
    fs:           {{ read: ['public/**'], write: [] }},
    db:           false,
    dialog:       false,
    clipboard:    false,
    notification: false,
  }},
  dev: {{
    entry:  'ui/app.jsx',
    output: 'dist/app.js',
    watch:  ['ui'],
  }},
}});"#)
}

#[cfg(test)]
mod typescript_tests {
    use super::*;

    const TEMPLATES: [&str; 4] = ["blank", "notes", "dashboard", "settings"];

    #[test]
    fn every_typescript_edit_matches_its_template_exactly_once() {
        for t in TEMPLATES {
            let jsx = app_jsx_for_template("demo", t);
            for (from, _) in tsx_edits(t) {
                assert_eq!(jsx.matches(from).count(), 1, "template {t}: `{from}` must appear once");
            }
        }
    }

    #[test]
    fn typescript_templates_have_typed_props_and_no_jsx_leftovers() {
        for t in TEMPLATES {
            let tsx = app_tsx_for_template("demo", t);
            assert!(!tsx.contains("app.jsx"), "template {t} still points at app.jsx");
            assert!(tsx.contains("render("), "template {t}");
            // no component takes destructured props without a type (strict mode rejects them)
            for line in tsx.lines().filter(|l| l.starts_with("function ") && l.contains("({")) {
                assert!(line.contains(": {") || line.contains("}: "), "template {t}: untyped props in `{line}`");
            }
        }
        assert!(app_tsx_for_template("demo", "notes").contains("interface Note"));
        assert!(app_tsx_for_template("demo", "dashboard").contains("variant: 'success' | 'warning' | 'error'"));
        assert!(app_tsx_for_template("demo", "settings").contains("children?: React.ReactNode"));
    }

    #[test]
    fn the_generated_tsconfig_is_json_and_sets_the_standard_jsx_mode() {
        for ui in ["src", "ui"] {
            let v: serde_json::Value = serde_json::from_str(&tsconfig_template(ui)).expect("valid JSON");
            // react-jsx is what editors and `tsc` expect; the bundler forces the build's mode itself.
            assert_eq!(v["compilerOptions"]["jsx"], "react-jsx");
            assert_eq!(v["compilerOptions"]["strict"], true);
            assert_eq!(v["include"][0], ui);
        }
    }

    #[test]
    fn creating_a_typescript_project_writes_the_typescript_files() {
        let root = std::env::temp_dir().join(format!("glyx-create-ts-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&root);
        for (template, ui, native) in [("blank", "src", false), ("notes", "ui", true)] {
            let dest = root.join(format!("{template}-{native}"));
            let cfg = if native { glyx_config_ts_native_template("demo") } else { glyx_config_ts_js_template("demo") };
            write_app_files("demo", &dest, template, ui, cfg, true, ("^0.2.0", "^0.2.0", "^0.2.0", "^0.2.0")).unwrap();
            assert!(dest.join(format!("{ui}/app.tsx")).exists() && !dest.join(format!("{ui}/app.jsx")).exists());
            let config = std::fs::read_to_string(dest.join("glyx.config.ts")).unwrap();
            assert!(config.contains(&format!("entry:  '{ui}/app.tsx'")), "config entry: {config}");
            let pkg: serde_json::Value = serde_json::from_str(&std::fs::read_to_string(dest.join("package.json")).unwrap()).unwrap();
            assert_eq!(pkg["devDependencies"]["typescript"], "^5");
            assert_eq!(pkg["devDependencies"]["@types/react"], "^18");
            assert_eq!(pkg["scripts"]["check"], "glyx check");
            assert!(dest.join("tsconfig.json").exists());
        }
        // a JavaScript project is unchanged: no tsconfig, no TypeScript dependencies
        let js = root.join("js");
        write_app_files("demo", &js, "blank", "src", glyx_config_ts_js_template("demo"), false, ("^0.2.0", "^0.2.0", "^0.2.0", "^0.2.0")).unwrap();
        assert!(js.join("src/app.jsx").exists() && !js.join("tsconfig.json").exists());
        let pkg: serde_json::Value = serde_json::from_str(&std::fs::read_to_string(js.join("package.json")).unwrap()).unwrap();
        assert!(pkg["devDependencies"].get("typescript").is_none() && pkg.get("scripts").is_none());
        let config = std::fs::read_to_string(js.join("glyx.config.ts")).unwrap();
        assert!(config.contains("entry:  'src/app.jsx'"));
        let _ = std::fs::remove_dir_all(&root);
    }
}

#[cfg(test)]
mod link_tests {
    use super::links_to_checkout;

    #[test]
    fn a_project_links_to_the_checkout_only_when_made_inside_it() {
        let root = std::env::temp_dir().join(format!("glyx-link-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&root);
        let home = root.join("glyx");
        let outside = root.join("elsewhere");
        std::fs::create_dir_all(home.join("examples")).unwrap();
        std::fs::create_dir_all(&outside).unwrap();

        assert!(links_to_checkout(&home.join("examples").join("my-app"), &home, false), "inside the checkout");
        assert!(!links_to_checkout(&outside.join("my-app"), &home, false), "anywhere else: published packages");
        assert!(!links_to_checkout(&root.join("glyx-sibling").join("x"), &home, false), "a sibling folder with the same prefix is not inside");
        assert!(links_to_checkout(&outside.join("my-app"), &home, true), "GLYX_LINK_LOCAL=1 asks for it");
        let _ = std::fs::remove_dir_all(&root);
    }
}
