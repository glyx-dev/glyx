//! `__glyx_print_*` — list printers, find the default, and print a file.
//! See `crate::print` for the engine-neutral logic and capability check —
//! this file is just the V8 argument-marshalling wrapper around it,
//! mirroring `bind_shell.rs`'s shape exactly.

use super::*;

/// `__glyx_print_listPrinters() -> Promise<string[]>` (JSON array)
pub fn print_list_printers_callback(
    scope: &mut v8::PinScope<'_, '_, v8::Context>,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let ctx = scope.get_current_context();
    let scope = &mut v8::ContextScope::new(scope, ctx);
    let data  = args.data();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let (resolver, promise, queue_clone, redraw) = make_promise(scope, state);
    rv.set(promise.into());

    state.tokio.spawn(async move {
        let result: Result<String, String> = async {
            let names = crate::print::list_printers().await?;
            serde_json::to_string(&names).map_err(|e| e.to_string())
        }
        .await;
        enqueue_completion(&queue_clone, redraw.as_ref(), Completion { resolver_ptr: resolver, result });
    });
}

/// `__glyx_print_getDefaultPrinter() -> Promise<string | null>` (JSON)
pub fn print_get_default_printer_callback(
    scope: &mut v8::PinScope<'_, '_, v8::Context>,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let ctx = scope.get_current_context();
    let scope = &mut v8::ContextScope::new(scope, ctx);
    let data  = args.data();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let (resolver, promise, queue_clone, redraw) = make_promise(scope, state);
    rv.set(promise.into());

    state.tokio.spawn(async move {
        let result: Result<String, String> = async {
            let name = crate::print::default_printer().await?;
            serde_json::to_string(&name).map_err(|e| e.to_string())
        }
        .await;
        enqueue_completion(&queue_clone, redraw.as_ref(), Completion { resolver_ptr: resolver, result });
    });
}

/// `__glyx_print_file(path, printer) -> Promise<void>`
///
/// `printer`: empty string means "use the default printer".
pub fn print_file_callback(
    scope: &mut v8::PinScope<'_, '_, v8::Context>,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let ctx = scope.get_current_context();
    let scope = &mut v8::ContextScope::new(scope, ctx);
    let path    = v8_arg_to_string(scope, &args, 0);
    let printer = v8_arg_to_string(scope, &args, 1);

    let data  = args.data();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let (resolver, promise, queue_clone, redraw) = make_promise(scope, state);
    rv.set(promise.into());

    state.tokio.spawn(async move {
        let printer_ref = if printer.is_empty() { None } else { Some(printer.as_str()) };
        let result: Result<String, String> = crate::print::print_file(&path, printer_ref)
            .await
            .map(|()| String::new());
        enqueue_completion(&queue_clone, redraw.as_ref(), Completion { resolver_ptr: resolver, result });
    });
}
