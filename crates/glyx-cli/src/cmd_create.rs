use anyhow::Result;
use std::path::{Path, PathBuf};

use super::{
    glyx_home, relpath, write_file, copy_glyx_mark_to,
};

pub(super) fn cmd_create(name: &str, native: bool, template: &str) -> Result<()> {
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

    let glyx_home = glyx_home()?;

    if native {
        println!("Creating Glyx project (native): {name}/");
        println!("  Template: {template}  |  Includes Cargo.toml + src/main.rs");
        cmd_create_native(name, &dest, &glyx_home, template)?;
    } else {
        println!("Creating Glyx project: {name}/");
        println!("  Template: {template}  |  JS-only mode — no Rust toolchain required.");
        cmd_create_js(name, &dest, &glyx_home, template)?;
    }

    println!();
    println!("Created {name}/  [template: {template}]");
    println!();
    println!("Next steps:");
    println!("  cd {name}");
    println!("  bun install");
    if native {
        println!("  glyx dev      # hot-reload dev server (requires Rust toolchain)");
    } else {
        println!("  glyx dev      # hot-reload dev server (no Rust required)");
    }
    Ok(())
}

pub(super) fn cmd_create_js(name: &str, dest: &Path, glyx_home: &Path, template: &str) -> Result<()> {
    std::fs::create_dir_all(dest.join("src"))?;
    std::fs::create_dir_all(dest.join("src/components"))?;
    std::fs::create_dir_all(dest.join("public"))?;
    copy_glyx_mark_to(glyx_home, dest, "public");

    let react_path   = relpath(dest, &glyx_home.join("js/packages/@glyx/react"));
    let router_path  = relpath(dest, &glyx_home.join("js/packages/@glyx/router"));
    let design_path  = relpath(dest, &glyx_home.join("js/packages/@glyx/design"));
    let config_path  = relpath(dest, &glyx_home.join("js/packages/@glyx/config"));

    write_file(dest.join("src/app.jsx"), &app_jsx_for_template(name, template))?;
    write_file(dest.join("glyx.config.ts"), &glyx_config_ts_js_template(name))?;
    write_file(dest.join("package.json"), &format!(
        r#"{{
  "name": "{name}",
  "version": "0.1.0",
  "private": true,
  "dependencies": {{
    "react":          "^18",
    "@glyx/react":   "file:{react_path}",
    "@glyx/router":  "file:{router_path}",
    "@glyx/design":  "file:{design_path}"
  }},
  "devDependencies": {{
    "@glyx/config": "file:{config_path}"
  }}
}}
"#))?;
    write_file(dest.join(".gitignore"), "/node_modules\n/dist/\n/target/glyx/glyx.config.resolved.json\n")?;
    Ok(())
}

pub(super) fn cmd_create_native(name: &str, dest: &Path, glyx_home: &Path, template: &str) -> Result<()> {
    std::fs::create_dir_all(dest.join("src"))?;
    std::fs::create_dir_all(dest.join("ui"))?;
    std::fs::create_dir_all(dest.join("ui/components"))?;
    std::fs::create_dir_all(dest.join("public"))?;
    copy_glyx_mark_to(glyx_home, dest, "public");

    let core_path   = relpath(dest, &glyx_home.join("crates/glyx-core"));
    let shell_path  = relpath(dest, &glyx_home.join("crates/glyx-shell"));
    let react_path  = relpath(dest, &glyx_home.join("js/packages/@glyx/react"));
    let router_path = relpath(dest, &glyx_home.join("js/packages/@glyx/router"));
    let design_path = relpath(dest, &glyx_home.join("js/packages/@glyx/design"));
    let config_path = relpath(dest, &glyx_home.join("js/packages/@glyx/config"));

    write_file(dest.join("Cargo.toml"), &format!(
        r#"[package]
name    = "{name}"
version = "0.1.0"
edition = "2021"

[features]
# "dev" gates hot-reload, bun watcher, and dev overlay in glyx-core.
# Production builds (glyx build) use --no-default-features to exclude them.
default = ["dev"]
dev     = ["glyx-core/dev"]

[dependencies]
glyx-core  = {{ path = "{core_path}", default-features = false }}
glyx-shell = {{ path = "{shell_path}" }}
env_logger  = "0.11"
"#))?;
    write_file(dest.join("src/main.rs"), "#![cfg_attr(all(target_os = \"windows\", not(debug_assertions)), windows_subsystem = \"windows\")]\n\nfn main() {\n    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or(\"info\"))\n        .format_timestamp(None)\n        .format_module_path(false)\n        .init();\n    glyx_core::run(glyx_core::AppConfig::from_config());\n}\n")?;
    write_file(dest.join("ui/app.jsx"), &app_jsx_for_template(name, template))?;
    write_file(dest.join("glyx.config.ts"), &glyx_config_ts_native_template(name))?;
    write_file(dest.join("package.json"), &format!(
        r#"{{
  "name": "{name}",
  "version": "0.1.0",
  "private": true,
  "dependencies": {{
    "react":          "^18",
    "@glyx/react":   "file:{react_path}",
    "@glyx/router":  "file:{router_path}",
    "@glyx/design":  "file:{design_path}"
  }},
  "devDependencies": {{
    "@glyx/config": "file:{config_path}"
  }}
}}
"#))?;
    write_file(dest.join(".gitignore"), "/target\n/node_modules\n/dist/\n/target/glyx/glyx.config.resolved.json\n")?;
    Ok(())
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
import {{ View, Text, Image, Pressable, render, useWindowSize }} from '@glyx/react';

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
import {{ View, Text, Pressable, ScrollView, render, useWindowSize }} from '@glyx/react';
import {{ ThemeProvider, useTheme, Button, Card, Label, Heading }} from '@glyx/design';

const NOTES = [
  {{ id: 1, title: 'Welcome', body: 'This is your first note in {name}. Click any note to read it, or press New Note to create one.' }},
  {{ id: 2, title: 'Getting started', body: 'Edit src/app.jsx to customise this template. Import more components from @glyx/react and @glyx/design.' }},
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
import {{ View, Text, Pressable, render, useWindowSize }} from '@glyx/react';
import {{ ThemeProvider, useTheme, Card, Label, Heading, Divider, Badge }} from '@glyx/design';

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
import {{ View, Text, Pressable, Switch, render, useWindowSize }} from '@glyx/react';
import {{ ThemeProvider, useTheme, Card, Label, Heading, Divider, Button }} from '@glyx/design';

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
    format!(r#"import {{ defineConfig }} from '@glyx/config';

export default defineConfig({{
  app: {{
    version:     '1.0.0',
    publisher:   '',        // Company or author name (used in installer)
    description: '',        // Short app description
    website:     '',        // https://yoursite.com
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

pub(super) fn glyx_config_ts_native_template(name: &str) -> String {
    format!(r#"import {{ defineConfig }} from '@glyx/config';

export default defineConfig({{
  app: {{
    version:     '1.0.0',
    publisher:   '',        // Company or author name (used in installer)
    description: '',        // Short app description
    website:     '',        // https://yoursite.com
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
