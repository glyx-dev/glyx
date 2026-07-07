//! Integration test (own process) for the OnceLock init/get lifecycle.
//! Kept out of unit tests because the store is process-global.

use glyx_security::{get, init, is_initialized, Capabilities};

#[test]
fn uninitialized_process_fails_closed_and_locks() {
    // Before anything: not initialized.
    assert!(!is_initialized());

    // get() before init() → zero permissions...
    let caps = get();
    assert!(!caps.can_read_fs());
    assert!(!caps.can_write_fs());
    assert!(!caps.can_network("api.example.com"));
    assert!(!caps.can_get_env("PATH"));

    // ...and that default is now locked in: a late init() is ignored,
    // so a binding racing ahead of startup can never widen permissions.
    assert!(is_initialized());
    let wide: Capabilities = serde_json::from_str(
        r#"{ "network": { "allow": ["*"] }, "db": true }"#,
    ).unwrap();
    init(wide);
    assert!(!get().can_network("api.example.com"));
    assert!(!get().db);
}
