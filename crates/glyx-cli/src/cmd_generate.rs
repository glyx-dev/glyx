use anyhow::{bail, Result};
use std::path::PathBuf;

use super::{GenerateCommands, is_native_project};

pub(super) fn cmd_generate(cmd: GenerateCommands) -> Result<()> {
    match cmd {
        GenerateCommands::Command { name } => cmd_generate_command(&name),
        GenerateCommands::Plugin  { name } => cmd_generate_plugin(&name),
    }
}

/// The exact `src/main.rs` template `cmd_create_native` writes for a fresh
/// project (see `cmd_create.rs`) — used to detect whether it's still
/// pristine and therefore safe to auto-patch with extension wiring below.
/// If a project's main.rs doesn't match this exactly (already customized,
/// or already patched by a previous `generate command` run), we print
/// manual instructions instead of risking clobbering real edits.
const PRISTINE_MAIN_RS: &str = "#![cfg_attr(all(target_os = \"windows\", not(debug_assertions)), windows_subsystem = \"windows\")]\n\nfn main() {\n    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or(\"info\"))\n        .format_timestamp(None)\n        .format_module_path(false)\n        .init();\n    glyx_core::run(glyx_core::AppConfig::from_config());\n}\n";

pub(super) fn cmd_generate_command(name: &str) -> Result<()> {
    // Accept both camelCase and snake_case inputs.
    let snake = camel_to_snake(name);
    let camel = snake_to_camel(&snake);

    if !is_native_project() {
        bail!(
            "glyx generate command requires a native project (Cargo.toml not found).\n\
             Run `glyx create --native <name>` to create one, or run this command from \
             the project root."
        );
    }

    // Under src/ (not a separate src-glyx/ tree) so `mod commands;` in
    // main.rs resolves it the normal way — no #[path] tricks needed.
    let dir = PathBuf::from("src").join("commands");
    std::fs::create_dir_all(&dir)?;

    let file_path = dir.join(format!("{snake}.rs"));
    if file_path.exists() {
        bail!("'{}' already exists", file_path.display());
    }

    let content = format!(
        r#"//! Backend command: `{camel}`
//!
//! Called from JS as:
//!   const result = await backend.{camel}({{ /* args */ }});

use glyx_core::BackendRegistryBuilder;

/// Register this command with the backend registry.
pub fn register(cmds: &mut BackendRegistryBuilder) {{
    cmds.add("{camel}", handler);
}}

/// Handler for the `{camel}` command.
///
/// `args_json` is the JSON-serialised object passed from JS.
/// Return a JSON string to resolve the Promise, or an Err string to reject it.
async fn handler(args_json: String) -> Result<String, String> {{
    let _args: serde_json::Value = serde_json::from_str(&args_json)
        .map_err(|e| e.to_string())?;

    // TODO: implement {camel}
    Ok("null".to_string())
}}
"#
    );

    std::fs::write(&file_path, content)?;

    // The handler stub uses serde_json::Value, but a native project's
    // Cargo.toml (cmd_create_native's template) never declares it — only
    // glyx-core/glyx-shell/env_logger. Add it once, idempotently.
    if let Ok(cargo_toml) = std::fs::read_to_string("Cargo.toml") {
        if !cargo_toml.contains("serde_json") {
            std::fs::write("Cargo.toml", cargo_toml + "serde_json = \"1\"\n")?;
        }
    }

    // Declare the new module in src/commands/mod.rs (create it, or append
    // to it if other commands already exist).
    let mod_rs_path = dir.join("mod.rs");
    let mod_line = format!("pub mod {snake};\n");
    match std::fs::read_to_string(&mod_rs_path) {
        Ok(existing) if !existing.contains(&mod_line) => {
            std::fs::write(&mod_rs_path, existing + &mod_line)?;
        }
        Ok(_) => {} // already declared (shouldn't happen given the exists() check above)
        Err(_) => std::fs::write(&mod_rs_path, &mod_line)?,
    }

    // Create (or extend) src/extension.rs — the GlyxExtension impl that
    // actually registers every generated command. Idempotent: re-running
    // this for a second command inserts one more register() call into the
    // existing impl instead of overwriting it.
    let extension_path = PathBuf::from("src").join("extension.rs");
    let register_call = format!("        commands::{snake}::register(cmds);\n");
    match std::fs::read_to_string(&extension_path) {
        Ok(existing) if !existing.contains(&register_call) => {
            // Insert the new register() call just before the impl's closing
            // brace pair (`    }\n}`), which sits right after the last call.
            if let Some(insert_at) = existing.rfind("    }\n}") {
                let mut patched = existing.clone();
                patched.insert_str(insert_at, &register_call);
                std::fs::write(&extension_path, patched)?;
            } else {
                // Unexpected shape (hand-edited) — don't guess, leave it alone.
                println!(
                    "Note: {} doesn't match the expected generated shape — \
                     add `commands::{snake}::register(cmds);` to its \
                     register_commands() body yourself.",
                    extension_path.display()
                );
            }
        }
        Ok(_) => {} // already registered
        Err(_) => {
            let content = format!(
                r#"//! Native extension — registers every `src/commands/*` backend command.
//! Generated by `glyx generate command`; re-running it for a new command
//! adds one more `register()` call here rather than overwriting this file.

use glyx_core::{{GlyxExtension, BackendRegistryBuilder}};

use crate::commands;

pub struct AppExtension;

impl GlyxExtension for AppExtension {{
    fn name(&self) -> &str {{ "app" }}

    fn register_commands(&self, cmds: &mut BackendRegistryBuilder) {{
{register_call}    }}
}}
"#
            );
            std::fs::write(&extension_path, content)?;
        }
    }

    // Wire main.rs — only if it's still the pristine `create --native`
    // template (safe to rewrite deterministically); otherwise leave it
    // alone and tell the developer what to add by hand.
    let main_rs_path = PathBuf::from("src").join("main.rs");
    let mut main_wired = false;
    if let Ok(main_src) = std::fs::read_to_string(&main_rs_path) {
        if main_src == PRISTINE_MAIN_RS {
            let patched = main_src.replacen(
                "fn main() {\n",
                "mod commands;\nmod extension;\n\nfn main() {\n",
                1,
            ).replacen(
                "glyx_core::run(glyx_core::AppConfig::from_config());\n",
                "let mut config = glyx_core::AppConfig::from_config();\n    \
                 config.extensions = vec![Box::new(extension::AppExtension)];\n    \
                 glyx_core::run(config);\n",
                1,
            );
            std::fs::write(&main_rs_path, patched)?;
            main_wired = true;
        } else if main_src.contains("mod commands;") {
            main_wired = true; // already wired by an earlier `generate command` run
        }
    }

    println!("Created {}", file_path.display());
    println!();
    if main_wired {
        println!("Wired automatically — src/main.rs now registers AppExtension.");
        println!("Next steps:");
        println!("  1. Implement the handler in {}", file_path.display());
        println!("  2. Call from JS:");
        println!("       import {{ backend }} from '@glyx-dev/react';");
        println!("       const result = await backend.{camel}({{ /* args */ }});");
    } else {
        println!("src/main.rs has custom edits — wire it up by hand:");
        println!("  1. Implement the handler in {}", file_path.display());
        println!("  2. Add near the top of src/main.rs:");
        println!("       mod commands;");
        println!("       mod extension;");
        println!("  3. In main(), before glyx_core::run(...):");
        println!("       let mut config = glyx_core::AppConfig::from_config();");
        println!("       config.extensions = vec![Box::new(extension::AppExtension)];");
        println!("       glyx_core::run(config);");
        println!("  4. Call from JS:");
        println!("       import {{ backend }} from '@glyx-dev/react';");
        println!("       const result = await backend.{camel}({{ /* args */ }});");
    }

    Ok(())
}

pub(super) fn cmd_generate_plugin(name: &str) -> Result<()> {
    // Sanitize: lowercase, allow alphanumeric + underscore.
    let safe_name: String = name.chars()
        .map(|c| if c.is_alphanumeric() || c == '_' { c.to_ascii_lowercase() } else { '_' })
        .collect();
    if safe_name.is_empty() {
        bail!("plugin name must contain at least one alphanumeric character");
    }

    let dir = PathBuf::from("src").join("plugins");
    std::fs::create_dir_all(&dir)?;

    let file_path = dir.join(format!("{safe_name}.plugin.js"));
    if file_path.exists() {
        bail!("'{}' already exists", file_path.display());
    }

    let content = format!(
r#"/**
 * Glyx JS plugin: {safe_name}
 *
 * This file runs in the same V8 context as your React app.
 * Export async functions — they'll be callable from the React side as:
 *   await backend.{safe_name}.functionName(args)
 *
 * Add to glyx.config.json:
 *   "plugins": [
 *     {{ "entry": "src/plugins/{safe_name}.plugin.js", "name": "{safe_name}" }}
 *   ]
 */

import {{ db }} from '@glyx-dev/react';

/**
 * Example: query all items from a table.
 * @param {{ table: string }} args
 * @returns {{ rows: any[] }}
 */
export async function getAll(args) {{
  const rows = await db.query(`SELECT * FROM ${{args.table ?? 'items'}}`);
  return {{ rows }};
}}

/**
 * Example: insert a row.
 * @param {{ table: string, data: Record<string, any> }} args
 * @returns {{ id: number }}
 */
export async function insert(args) {{
  const cols = Object.keys(args.data).join(', ');
  const vals = Object.values(args.data).map(() => '?').join(', ');
  const id = await db.exec(
    `INSERT INTO ${{args.table}} (${{cols}}) VALUES (${{vals}})`,
    Object.values(args.data),
  );
  return {{ id }};
}}
"#
    );

    std::fs::write(&file_path, content)?;

    println!("Created {}", file_path.display());
    println!();
    println!("Add to glyx.config.json:");
    println!("  \"plugins\": [");
    println!("    {{ \"entry\": \"src/plugins/{safe_name}.plugin.js\", \"name\": \"{safe_name}\" }}");
    println!("  ]");
    println!();
    println!("Then call from any React component:");
    println!("  import {{ backend }} from '@glyx-dev/react';");
    println!("  const {{ rows }} = await backend.{safe_name}.getAll({{ table: 'items' }});");

    Ok(())
}

/// Convert camelCase / PascalCase → snake_case.
pub(super) fn camel_to_snake(s: &str) -> String {
    let mut out = String::new();
    for (i, ch) in s.char_indices() {
        if ch.is_uppercase() && i > 0 { out.push('_'); }
        out.push(ch.to_ascii_lowercase());
    }
    out
}

/// Convert snake_case → camelCase.
pub(super) fn snake_to_camel(s: &str) -> String {
    let mut out = String::new();
    let mut cap_next = false;
    for ch in s.chars() {
        if ch == '_' {
            cap_next = true;
        } else if cap_next {
            out.push(ch.to_ascii_uppercase());
            cap_next = false;
        } else {
            out.push(ch);
        }
    }
    out
}
