//! Procedural macros for the Glyx framework.
//!
//! # `#[glyx_plugin]`
//!
//! Placed on an `impl` block, generates a `GlyxExtension` impl that wires every
//! `#[glyx_command]`-marked async method into the backend command registry.
//!
//! ```ignore
//! use glyx_runtime::glyx_plugin;
//!
//! #[derive(Clone)]
//! pub struct MyPlugin { pub db_url: String }
//!
//! #[glyx_plugin]                     // optional: #[glyx_plugin(name = "my_plugin")]
//! impl MyPlugin {
//!     #[glyx_command]
//!     async fn greet(&self, name: String) -> Result<String, String> {
//!         Ok(format!("Hello, {}!", name))
//!     }
//!
//!     #[glyx_command]
//!     async fn add(&self, a: f64, b: f64) -> Result<f64, String> {
//!         Ok(a + b)
//!     }
//!
//!     fn internal_helper(&self) {}   // not a command — no attribute
//! }
//! ```
//!
//! **Requirements on the struct:**
//! - `Clone + Send + Sync + 'static` (the closure passed to `cmds.add` must be `Send + Sync`).
//!   Add `#[derive(Clone)]` and ensure all fields are `Send + Sync`.
//!
//! **Command method signature:**
//! - Must be `async fn`.
//! - First parameter must be `&self`.
//! - Remaining parameters are deserialized from the JSON args object the JS caller passes.
//!   Parameter names become JSON field names.
//! - Return type must be `Result<T, E>` where `T: serde::Serialize` and `E: Display`.
//!
//! # `#[glyx_command]`
//!
//! Used as a marker attribute inside `#[glyx_plugin]` blocks.  Consumed by `#[glyx_plugin]`
//! and stripped before the impl is emitted.  If used on a free async fn it is a no-op
//! (the fn is emitted unchanged) — standalone commands must be registered via
//! `cmds.add(...)` manually or via `BackendRegistryBuilder`.

use proc_macro::TokenStream;
use proc_macro2::Span;
use quote::{format_ident, quote};
use syn::{
    parse_macro_input, parse::Parse, parse::ParseStream,
    FnArg, ImplItem, ItemImpl, LitStr, Pat, ReturnType, Token, Type,
};

// ── Attribute parser for #[glyx_plugin(name = "...")] ────────────────────────

struct PluginAttr {
    name: Option<String>,
}

impl Parse for PluginAttr {
    fn parse(input: ParseStream) -> syn::Result<Self> {
        if input.is_empty() {
            return Ok(PluginAttr { name: None });
        }
        let ident: syn::Ident = input.parse()?;
        if ident != "name" {
            return Err(syn::Error::new(ident.span(), "expected `name = \"...\"`"));
        }
        input.parse::<Token![=]>()?;
        let lit: LitStr = input.parse()?;
        Ok(PluginAttr { name: Some(lit.value()) })
    }
}

// ── #[glyx_plugin] ───────────────────────────────────────────────────────────

#[proc_macro_attribute]
pub fn glyx_plugin(attr: TokenStream, item: TokenStream) -> TokenStream {
    let plugin_attr = parse_macro_input!(attr as PluginAttr);
    let mut impl_block = parse_macro_input!(item as ItemImpl);

    // Derive plugin name: explicit attr > snake_case struct name.
    let plugin_name: String = plugin_attr.name.unwrap_or_else(|| {
        let ty = &impl_block.self_ty;
        // Pull the last path segment and convert to snake_case.
        if let Type::Path(tp) = ty.as_ref() {
            let seg = tp.path.segments.last().unwrap();
            to_snake_case(&seg.ident.to_string())
        } else {
            "plugin".into()
        }
    });

    // Collect #[glyx_command] methods and strip the marker attribute.
    let mut commands: Vec<syn::ImplItemFn> = Vec::new();
    for item in &mut impl_block.items {
        if let ImplItem::Fn(method) = item {
            let has_cmd = method.attrs.iter().any(|a| a.path().is_ident("glyx_command"));
            if has_cmd {
                method.attrs.retain(|a| !a.path().is_ident("glyx_command"));
                commands.push(method.clone());
            }
        }
    }

    if commands.is_empty() {
        // No commands — still emit the impl; GlyxExtension impl has empty register_commands.
    }

    // Build one `cmds.add(...)` statement per command.
    let add_stmts = commands.iter().map(|method| {
        let method_name = &method.sig.ident;
        let cmd_str = method_name.to_string();

        // Collect non-self parameters: (ident, type).
        let params: Vec<(syn::Ident, &Type)> = method.sig.inputs.iter().filter_map(|arg| {
            if let FnArg::Typed(pt) = arg {
                if let Pat::Ident(pi) = pt.pat.as_ref() {
                    return Some((pi.ident.clone(), pt.ty.as_ref()));
                }
            }
            None
        }).collect();

        // Field declarations for the anonymous args struct.
        let field_decls = params.iter().map(|(name, ty)| {
            quote! { #name: #ty }
        });

        // Argument forwarding to the actual method call.
        let arg_forwards = params.iter().map(|(name, _)| {
            quote! { __args.#name }
        });

        // Unique args-struct name (avoids name collisions in the same impl block).
        let args_struct = format_ident!("__GlyxArgs_{}", method_name, span = Span::call_site());

        // Detect whether the return type looks like Result<T, E>.
        let is_result = match &method.sig.output {
            ReturnType::Type(_, ty) => type_is_result(ty),
            ReturnType::Default => false,
        };

        let call_expr = quote! { __self.#method_name(#(#arg_forwards),*).await };

        let result_expr = if is_result {
            quote! {
                #call_expr
                    .map_err(|e| e.to_string())
                    .and_then(|__v| ::serde_json::to_string(&__v).map_err(|e| e.to_string()))
            }
        } else {
            quote! {
                ::serde_json::to_string(&#call_expr).map_err(|e| e.to_string())
            }
        };

        quote! {
            {
                let __self = __self.clone();
                cmds.add(#cmd_str, move |__args_json: ::std::string::String| {
                    let __self = __self.clone();
                    ::std::boxed::Box::pin(async move {
                        #[derive(::serde::Deserialize)]
                        #[allow(non_camel_case_types)]
                        struct #args_struct { #(#field_decls),* }
                        let __args: #args_struct = ::serde_json::from_str(&__args_json)
                            .map_err(|e| format!("{}: bad args: {}", #cmd_str, e))?;
                        #result_expr
                    })
                });
            }
        }
    });

    let self_ty = &impl_block.self_ty;

    quote! {
        #impl_block

        impl ::glyx_runtime::GlyxExtension for #self_ty {
            fn name(&self) -> &str { #plugin_name }

            fn register_commands(&self, cmds: &mut ::glyx_runtime::BackendRegistryBuilder) {
                let __self = ::std::sync::Arc::new(self.clone());
                #(#add_stmts)*
            }
        }
    }
    .into()
}

// ── #[glyx_command] ──────────────────────────────────────────────────────────

/// Marker attribute consumed by `#[glyx_plugin]`.  On a free fn it is a no-op.
#[proc_macro_attribute]
pub fn glyx_command(_attr: TokenStream, item: TokenStream) -> TokenStream {
    item
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn to_snake_case(s: &str) -> String {
    let mut out = String::new();
    for (i, ch) in s.chars().enumerate() {
        if ch.is_uppercase() && i > 0 {
            out.push('_');
        }
        out.extend(ch.to_lowercase());
    }
    out
}

fn type_is_result(ty: &Type) -> bool {
    if let Type::Path(tp) = ty {
        if let Some(seg) = tp.path.segments.last() {
            return seg.ident == "Result";
        }
    }
    false
}
