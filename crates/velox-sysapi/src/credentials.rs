// ── OS Credential Store ───────────────────────────────────────────────────────
//
// Delegates to the platform-native secret storage:
//   Windows  — Credential Manager (DPAPI-encrypted, per-user)
//   macOS    — Keychain
//   Linux    — Secret Service (libsecret / GNOME Keyring / KWallet)
//
// Data is tied to the OS user account — other processes and other users cannot
// read it.  Survives app restarts.  Never touches disk as plaintext.

/// Store a secret under `service` + `key`.
///
/// `service` namespaces the credential (e.g. your app name).
/// `key` identifies the specific secret (e.g. "auth_token", "session_id").
/// Calling this again with the same service+key replaces the existing value.
pub fn credentials_set(service: &str, key: &str, value: &str) -> Result<(), String> {
    keyring::Entry::new(service, key)
        .map_err(|e| format!("keyring entry: {e}"))?
        .set_password(value)
        .map_err(|e| format!("keyring set: {e}"))
}

/// Retrieve a secret.  Returns `None` if no entry exists for `service` + `key`.
pub fn credentials_get(service: &str, key: &str) -> Result<Option<String>, String> {
    let entry = keyring::Entry::new(service, key)
        .map_err(|e| format!("keyring entry: {e}"))?;
    match entry.get_password() {
        Ok(val)                        => Ok(Some(val)),
        Err(keyring::Error::NoEntry)   => Ok(None),
        Err(e)                         => Err(format!("keyring get: {e}")),
    }
}

/// Delete a secret.  A no-op (not an error) if the entry does not exist.
pub fn credentials_delete(service: &str, key: &str) -> Result<(), String> {
    let entry = keyring::Entry::new(service, key)
        .map_err(|e| format!("keyring entry: {e}"))?;
    match entry.delete_credential() {
        Ok(())                       => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),   // already gone — not an error
        Err(e)                       => Err(format!("keyring delete: {e}")),
    }
}
