use anyhow::{bail, Result};
use std::path::PathBuf;

use super::{GenerateCommands, is_native_project};

pub(super) fn cmd_generate(cmd: GenerateCommands) -> Result<()> {
    match cmd {
        GenerateCommands::Command { name } => cmd_generate_command(&name),
        GenerateCommands::Plugin  { name } => cmd_generate_plugin(&name),
    }
}

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

    let dir = PathBuf::from("src-glyx").join("commands");
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
//!
//! Register this command in your GlyxExtension:
//!   fn register_commands(&self, cmds: &mut glyx_runtime::BackendRegistryBuilder) {{
//!       cmds.add("{camel}", {snake});
//!   }}

use glyx_runtime::BackendRegistryBuilder;

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

    println!("Created {}", file_path.display());
    println!();
    println!("Next steps:");
    println!("  1. Implement the handler in {}", file_path.display());
    println!("  2. In your GlyxExtension impl, add:");
    println!("       fn register_commands(&self, cmds: &mut BackendRegistryBuilder) {{");
    println!("           crate::commands::{snake}::register(cmds);");
    println!("       }}");
    println!("  3. Call from JS:");
    println!("       import {{ backend }} from '@glyx/react';");
    println!("       const result = await backend.{camel}({{ /* args */ }});");

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

import {{ db }} from '@glyx/react';

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
    println!("  import {{ backend }} from '@glyx/react';");
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
