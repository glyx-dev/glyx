//! glyx-verify — Ed25519 signature verification for Glyx trust chain.
//!
//! Two embedded public keys anchor all trust in signed artifacts:
//!
//! - [`CAP_PUBKEY`]    — verifies capability DLL signatures (`.sig` sidecars)
//! - [`UPDATE_PUBKEY`] — verifies app update binaries and JS bundle manifests
//!
//! Private keys are stored only in CI secrets and never committed to the repo.
//! See `RELEASING.md` for the signing workflow.

use std::path::Path;

use ed25519_dalek::{Signature, VerifyingKey, Verifier};
use thiserror::Error;

// ── Embedded public keys ──────────────────────────────────────────────────────

// OpenSSL DER-encodes Ed25519 pubkeys as SubjectPublicKeyInfo (44 bytes).
// The actual 32-byte key material is the last 32 bytes of that structure.
// We strip the 12-byte ASN.1 header at compile time via a const fn so callers
// get a plain [u8; 32] with no runtime allocation or parsing.

const fn strip_spki_header(der: &[u8]) -> [u8; 32] {
    assert!(der.len() == 44, "expected 44-byte Ed25519 DER public key");
    let mut out = [0u8; 32];
    let mut i = 0;
    while i < 32 {
        out[i] = der[12 + i];
        i += 1;
    }
    out
}

/// Ed25519 public key for verifying **capability DLL** signatures.
///
/// Each `glyx_cap_*.dll` ships alongside a `.sig` file produced by CI using
/// the corresponding private key (`CAP_SIGNING_KEY` secret).
pub const CAP_PUBKEY: [u8; 32] =
    strip_spki_header(include_bytes!("../keys/cap.pub"));

/// Ed25519 public key for verifying **app update** binaries and JS manifests.
///
/// Used by the auto-updater to verify release binaries and signed
/// `{version, sha256}` manifests before applying any update.
pub const UPDATE_PUBKEY: [u8; 32] =
    strip_spki_header(include_bytes!("../keys/update.pub"));

// ── Error type ────────────────────────────────────────────────────────────────

#[derive(Debug, Error)]
pub enum VerifyError {
    #[error("invalid public key bytes: {0}")]
    BadPublicKey(ed25519_dalek::SignatureError),
    #[error("signature is not 64 bytes (got {0})")]
    BadSignatureLength(usize),
    #[error("signature verification failed")]
    Invalid,
    #[error("I/O error reading {path}: {source}")]
    Io { path: String, #[source] source: std::io::Error },
}

// ── Core verify functions ─────────────────────────────────────────────────────

/// Verify an Ed25519 `sig` over `msg` using `pubkey`.
///
/// `pubkey` must be a 32-byte raw Ed25519 public key (not DER/PEM).
/// `sig` must be exactly 64 bytes.
///
/// Returns `Ok(())` on success, `Err(VerifyError)` on any failure.
pub fn verify_ed25519(pubkey: &[u8; 32], msg: &[u8], sig: &[u8]) -> Result<(), VerifyError> {
    let key = VerifyingKey::from_bytes(pubkey)
        .map_err(VerifyError::BadPublicKey)?;

    if sig.len() != 64 {
        return Err(VerifyError::BadSignatureLength(sig.len()));
    }
    let sig_bytes: [u8; 64] = sig.try_into().unwrap();
    let signature = Signature::from_bytes(&sig_bytes);

    key.verify(msg, &signature).map_err(|_| VerifyError::Invalid)
}

/// Read `path` and its `sig_path` sidecar, then verify the file's Ed25519
/// signature using `pubkey`.
///
/// Both files must be readable. The entire file is read into memory for
/// verification — do not use this for very large files (cap DLLs are
/// typically < 10 MB, which is fine).
pub fn verify_signed_file(
    path:     &Path,
    sig_path: &Path,
    pubkey:   &[u8; 32],
) -> Result<(), VerifyError> {
    verify_signed_file_bytes(path, sig_path, pubkey).map(|_| ())
}

/// Like `verify_signed_file` but returns the verified bytes so the caller can
/// use them directly — eliminating the TOCTOU window between verify and re-read.
pub fn verify_signed_file_bytes(
    path:     &Path,
    sig_path: &Path,
    pubkey:   &[u8; 32],
) -> Result<Vec<u8>, VerifyError> {
    let msg = std::fs::read(path).map_err(|e| VerifyError::Io {
        path: path.display().to_string(), source: e,
    })?;
    let sig = std::fs::read(sig_path).map_err(|e| VerifyError::Io {
        path: sig_path.display().to_string(), source: e,
    })?;
    verify_ed25519(pubkey, &msg, &sig)?;
    Ok(msg)
}

// ── Convenience: sign bytes (test/CI use only) ────────────────────────────────

/// Sign `msg` with a raw 32-byte Ed25519 secret key.
///
/// Only available under `#[cfg(test)]` or the `signing` feature so this
/// function cannot be called from production code paths.
#[cfg(any(test, feature = "signing"))]
pub fn sign_ed25519(secret: &[u8; 32], msg: &[u8]) -> [u8; 64] {
    use ed25519_dalek::{SigningKey, Signer};
    let key = SigningKey::from_bytes(secret);
    key.sign(msg).to_bytes()
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use ed25519_dalek::SigningKey;

    fn random_keypair() -> ([u8; 32], [u8; 32]) {
        // Deterministic "random" for tests — just a fixed seed.
        let secret: [u8; 32] = [
            0x9d, 0x61, 0xb1, 0x9d, 0xef, 0xfd, 0x5a, 0x60,
            0xba, 0x84, 0x4a, 0xf4, 0x92, 0xec, 0x2c, 0x44,
            0xda, 0x08, 0x53, 0x99, 0x14, 0x06, 0xb8, 0x96,
            0x85, 0x49, 0x3b, 0x11, 0x82, 0x58, 0x4d, 0xf7,
        ];
        let signing = SigningKey::from_bytes(&secret);
        let pubkey  = signing.verifying_key().to_bytes();
        (secret, pubkey)
    }

    #[test]
    fn roundtrip_sign_verify() {
        let (secret, pubkey) = random_keypair();
        let msg = b"hello glyx-verify";
        let sig = sign_ed25519(&secret, msg);
        assert!(verify_ed25519(&pubkey, msg, &sig).is_ok());
    }

    #[test]
    fn tampered_message_rejected() {
        let (secret, pubkey) = random_keypair();
        let msg = b"original message";
        let sig = sign_ed25519(&secret, msg);
        assert!(verify_ed25519(&pubkey, b"tampered message", &sig).is_err());
    }

    #[test]
    fn tampered_signature_rejected() {
        let (secret, pubkey) = random_keypair();
        let msg = b"message";
        let mut sig = sign_ed25519(&secret, msg);
        sig[0] ^= 0xFF; // flip first byte
        assert!(verify_ed25519(&pubkey, msg, &sig).is_err());
    }

    #[test]
    fn wrong_pubkey_rejected() {
        let (secret, _pubkey) = random_keypair();
        let (_, other_pubkey) = {
            let s: [u8; 32] = [0xAB; 32];
            let k = SigningKey::from_bytes(&s);
            (s, k.verifying_key().to_bytes())
        };
        let msg = b"message";
        let sig = sign_ed25519(&secret, msg);
        assert!(verify_ed25519(&other_pubkey, msg, &sig).is_err());
    }

    #[test]
    fn short_signature_rejected() {
        let (_secret, pubkey) = random_keypair();
        let result = verify_ed25519(&pubkey, b"msg", &[0u8; 32]);
        assert!(matches!(result, Err(VerifyError::BadSignatureLength(32))));
    }

    #[test]
    fn verify_signed_file_roundtrip() {
        let (secret, pubkey) = random_keypair();
        let dir  = std::env::temp_dir();
        let file = dir.join("glyx_verify_test.bin");
        let sig  = dir.join("glyx_verify_test.bin.sig");
        let msg  = b"test file content";
        std::fs::write(&file, msg).unwrap();
        let sig_bytes = sign_ed25519(&secret, msg);
        std::fs::write(&sig, sig_bytes).unwrap();
        assert!(verify_signed_file(&file, &sig, &pubkey).is_ok());
        // Tamper with file.
        std::fs::write(&file, b"tampered").unwrap();
        assert!(verify_signed_file(&file, &sig, &pubkey).is_err());
    }

    #[test]
    fn embedded_pubkeys_are_valid_ed25519_keys() {
        // Ensure the include_bytes! + strip_spki_header produced parseable keys.
        assert!(VerifyingKey::from_bytes(&CAP_PUBKEY).is_ok());
        assert!(VerifyingKey::from_bytes(&UPDATE_PUBKEY).is_ok());
    }

    // R6: forged/missing cap .sig rejection tests.

    #[test]
    fn forged_signature_rejected() {
        let (_secret, pubkey) = random_keypair();
        // A different fixed seed — produces a distinct keypair.
        let bad_secret: [u8; 32] = [
            0x4c, 0xcd, 0x08, 0x9b, 0x28, 0xff, 0x96, 0xda,
            0x9d, 0xb6, 0xc3, 0x46, 0xec, 0x11, 0x40, 0x42,
            0x17, 0x42, 0x19, 0xa8, 0x5a, 0x7e, 0xe9, 0xbb,
            0x23, 0x0b, 0xc3, 0x72, 0x8e, 0x74, 0xda, 0xb3,
        ];
        let bad_sig = sign_ed25519(&bad_secret, b"real content");
        assert!(verify_ed25519(&pubkey, b"real content", &bad_sig).is_err(),
            "signature from a different key must be rejected");
    }

    #[test]
    fn tampered_content_rejected() {
        let (secret, pubkey) = random_keypair();
        let sig = sign_ed25519(&secret, b"original");
        assert!(verify_ed25519(&pubkey, b"tampered", &sig).is_err(),
            "signature must not verify against different content");
    }

    #[test]
    fn missing_sig_file_rejected() {
        let dir  = std::env::temp_dir();
        let file = dir.join("glyx_verify_missing_sig_test.bin");
        let sig  = dir.join("glyx_verify_missing_sig_test.bin.sig");
        std::fs::write(&file, b"content").unwrap();
        let _ = std::fs::remove_file(&sig); // ensure it doesn't exist
        assert!(verify_signed_file(&file, &sig, &CAP_PUBKEY).is_err(),
            "missing signature file must be rejected");
        let _ = std::fs::remove_file(&file);
    }

    #[test]
    fn zero_sig_rejected() {
        let (_secret, pubkey) = random_keypair();
        assert!(verify_ed25519(&pubkey, b"msg", &[0u8; 64]).is_err(),
            "all-zero signature must be rejected");
    }

    // F5: tampered pending.js must be rejected and same bytes returned on success.

    #[test]
    fn pending_js_tampered_rejected() {
        let (secret, pubkey) = random_keypair();
        let dir     = std::env::temp_dir();
        let js_path = dir.join("glyx_f5_pending.js");
        let sig_path = dir.join("glyx_f5_pending.js.sig");
        let original = b"console.log('update v2');";

        // Write file + valid sig.
        std::fs::write(&js_path, original).unwrap();
        let sig = sign_ed25519(&secret, original);
        std::fs::write(&sig_path, sig).unwrap();

        // Tamper with the file AFTER signing.
        std::fs::write(&js_path, b"console.log('malicious');").unwrap();

        assert!(verify_signed_file_bytes(&js_path, &sig_path, &pubkey).is_err(),
            "tampered pending.js must be rejected");

        // Clean up, restore original, verify bytes are returned.
        std::fs::write(&js_path, original).unwrap();
        let sig2 = sign_ed25519(&secret, original);
        std::fs::write(&sig_path, sig2).unwrap();

        let bytes = verify_signed_file_bytes(&js_path, &sig_path, &pubkey)
            .expect("valid pending.js should succeed");
        assert_eq!(bytes, original, "returned bytes must match the signed content");

        let _ = std::fs::remove_file(&js_path);
        let _ = std::fs::remove_file(&sig_path);
    }
}
