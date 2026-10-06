#!/usr/bin/env python3
"""
derive_media_pubkey.py — write the public half of the glyx-media signing key
to crates/glyx-media/keys/glyx_media_verify.pub.

The runner verifies every glyx-media manifest against that file (compiled in).
It must be the public key for the secret stored in CI as GLYX_MEDIA_SIGN_KEY;
the repository originally shipped an all-zero placeholder, which a release
build refuses.

Usage (run locally; the secret is read from the environment, never printed):

  PowerShell:  $env:GLYX_MEDIA_SIGN_KEY = "<hex secret>"; python .github/scripts/derive_media_pubkey.py
  bash:        GLYX_MEDIA_SIGN_KEY=<hex secret> python3 .github/scripts/derive_media_pubkey.py

Then rebuild: the key is compiled into the runner, so runners built before the
change cannot verify libraries signed with it.
"""

import os
import sys

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

OUT = os.path.join(os.path.dirname(__file__), "..", "..", "crates", "glyx-media", "keys", "glyx_media_verify.pub")


def main():
    secret = os.environ.get("GLYX_MEDIA_SIGN_KEY", "").strip()
    if not secret:
        sys.exit("GLYX_MEDIA_SIGN_KEY is not set (see the usage at the top of this file)")
    try:
        seed = bytes.fromhex(secret)[:32]
    except ValueError:
        sys.exit("GLYX_MEDIA_SIGN_KEY must be hex")
    if len(seed) != 32 or not any(seed):
        sys.exit("GLYX_MEDIA_SIGN_KEY is not a usable Ed25519 seed (needs 32 non-zero bytes)")

    # The same derivation sign_manifest.py uses: the first 32 bytes are the seed.
    public = Ed25519PrivateKey.from_private_bytes(seed).public_key().public_bytes(
        serialization.Encoding.Raw, serialization.PublicFormat.Raw)
    path = os.path.normpath(OUT)
    with open(path, "wb") as f:
        f.write(public)
    print(f"wrote {len(public)} bytes to {path}")
    print(f"public key: {public.hex()}")


if __name__ == "__main__":
    main()
