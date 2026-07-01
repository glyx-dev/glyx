#!/usr/bin/env python3
"""
sign_manifest.py — generate a manifest.json + manifest.sig for a glyx-media DLL.

Usage:
  python3 sign_manifest.py <dll_path> <platform> <arch> <version>

Reads GLYX_MEDIA_SIGN_KEY from the environment (hex-encoded 64-byte Ed25519 seed).
Writes {stem}.manifest.json and {stem}.manifest.sig alongside the DLL.

The Ed25519 signing key (GLYX_MEDIA_SIGN_KEY) is stored as a GitHub repository secret.
The corresponding 32-byte public key is compiled into glyx-media's verify.rs as PUBKEY.
"""

import hashlib
import json
import os
import sys

def sha256_hex(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()

def main():
    if len(sys.argv) != 5:
        print(f"Usage: {sys.argv[0]} <dll_path> <platform> <arch> <version>")
        sys.exit(1)

    dll_path, platform, arch, version = sys.argv[1:]

    # Try to import cryptography; fall back to stub for local dev without signing.
    try:
        from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
        from cryptography.hazmat.primitives.serialization import (
            Encoding, PublicFormat, PrivateFormat, NoEncryption
        )
        sign_key_hex = os.environ.get("GLYX_MEDIA_SIGN_KEY", "")
        if not sign_key_hex:
            print("Warning: GLYX_MEDIA_SIGN_KEY not set — using zero key (not for production)")
            sign_key_hex = "0" * 128  # 64 zero bytes
        sign_key_bytes = bytes.fromhex(sign_key_hex)
        private_key = Ed25519PrivateKey.from_private_bytes(sign_key_bytes[:32])
    except ImportError:
        print("Warning: 'cryptography' package not installed — signature will be zeroed")
        private_key = None

    stem = os.path.splitext(dll_path)[0]
    ext  = os.path.splitext(dll_path)[1].lstrip(".")

    dll_hash = sha256_hex(dll_path)
    cdn_base = "https://cdn.glyx.dev/media"
    dll_name = os.path.basename(dll_path)
    url = f"{cdn_base}/{version}/{dll_name}"

    manifest = {
        "version": version,
        "url":     url,
        "sha256":  dll_hash,
    }
    manifest_bytes = json.dumps(manifest, separators=(",", ":")).encode()

    manifest_path = f"{stem}.manifest.json"
    with open(manifest_path, "wb") as f:
        f.write(manifest_bytes)
    print(f"Manifest: {manifest_path}")

    if private_key is not None:
        sig_bytes = private_key.sign(manifest_bytes)
    else:
        sig_bytes = b"\x00" * 64

    sig_path = f"{stem}.manifest.sig"
    with open(sig_path, "wb") as f:
        f.write(sig_bytes)
    print(f"Signature: {sig_path}")
    print(f"SHA-256:   {dll_hash}")

if __name__ == "__main__":
    main()
