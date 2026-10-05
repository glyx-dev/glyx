#!/usr/bin/env python3
"""
sign_manifest.py — generate a manifest.json + manifest.sig for a glyx-media DLL.

Usage:
  python3 sign_manifest.py <dll_path> <platform> <arch> <version> [--ffmpeg-archive <tar.gz>]

Reads GLYX_MEDIA_SIGN_KEY from the environment (hex-encoded 64-byte Ed25519 seed).
Writes {stem}.manifest.json and {stem}.manifest.sig alongside the DLL.

With --ffmpeg-archive, the manifest also lists the FFmpeg libraries in that
archive (name -> SHA-256) and the archive itself. The signature covers all of
it, so the loader refuses a swapped FFmpeg library just like a swapped DLL, and
the CLI downloads and checks the archive against the same manifest.

Without a signing key (or without the `cryptography` package) the signature is
all zeros: fine for a local dev build, useless for a release. Set
GLYX_MEDIA_REQUIRE_SIGNATURE=1 (the release workflow does on tag builds) to
fail instead of writing one.

The Ed25519 signing key (GLYX_MEDIA_SIGN_KEY) is stored as a GitHub repository secret.
The corresponding 32-byte public key is compiled into glyx-media's verify.rs as PUBKEY.
"""

import hashlib
import json
import os
import posixpath
import re
import sys
import tarfile

RELEASE_BASE = "https://github.com/glyx-dev/glyx/releases/download"

# The FFmpeg runtime libraries glyx-media links to:
#   avcodec-63.dll, libavcodec.63.dylib, libavcodec.so.63 ...
LIB_NAME = re.compile(r"^(lib)?(avformat|avcodec|avutil|swscale|swresample)[-.](so\.)?\d")


def sha256_hex(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


def archive_libs(archive_path):
    """name -> sha256 of every FFmpeg library file in the archive."""
    libs = {}
    with tarfile.open(archive_path, "r:gz") as tar:
        for member in tar.getmembers():
            if not member.isfile():
                continue
            name = posixpath.normpath(member.name)
            # Only plain files at the top of the archive ("./libavcodec.63.dylib").
            if "/" in name or name in (".", "..") or not LIB_NAME.match(name):
                continue
            h = hashlib.sha256()
            f = tar.extractfile(member)
            while chunk := f.read(65536):
                h.update(chunk)
            libs[name] = h.hexdigest()
    return libs


def main():
    args = sys.argv[1:]
    archive_path = None
    if "--ffmpeg-archive" in args:
        i = args.index("--ffmpeg-archive")
        if i + 1 >= len(args):
            print("--ffmpeg-archive needs a file")
            sys.exit(1)
        archive_path = args[i + 1]
        del args[i:i + 2]
    if len(args) != 4:
        print(f"Usage: {sys.argv[0]} <dll_path> <platform> <arch> <version> [--ffmpeg-archive <tar.gz>]")
        sys.exit(1)

    dll_path, platform, arch, version = args
    require = os.environ.get("GLYX_MEDIA_REQUIRE_SIGNATURE") == "1"

    # Try to import cryptography; fall back to stub for local dev without signing.
    private_key = None
    try:
        from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
        sign_key_hex = os.environ.get("GLYX_MEDIA_SIGN_KEY", "")
        if not sign_key_hex:
            if require:
                print("::error::GLYX_MEDIA_SIGN_KEY is not set; refusing to publish an unsigned glyx-media")
                sys.exit(1)
            print("Warning: GLYX_MEDIA_SIGN_KEY not set — using zero key (not for production)")
            sign_key_hex = "0" * 128  # 64 zero bytes
        sign_key_bytes = bytes.fromhex(sign_key_hex)
        private_key = Ed25519PrivateKey.from_private_bytes(sign_key_bytes[:32])
    except ImportError:
        if require:
            print("::error::the 'cryptography' package is not installed; refusing to publish an unsigned glyx-media")
            sys.exit(1)
        print("Warning: 'cryptography' package not installed — signature will be zeroed")

    stem = os.path.splitext(dll_path)[0]
    dll_name = os.path.basename(dll_path)
    dll_hash = sha256_hex(dll_path)

    # The release asset the CLI downloads (see crates/glyx-media/src/download.rs).
    manifest = {
        "version": version,
        "url":     f"{RELEASE_BASE}/v{version}/{dll_name}",
        "sha256":  dll_hash,
    }

    if archive_path:
        libs = archive_libs(archive_path)
        if not libs:
            print(f"::error::no FFmpeg libraries found in {archive_path}")
            sys.exit(1)
        manifest["libs"] = dict(sorted(libs.items()))
        manifest["ffmpeg_archive"] = {
            "name":   os.path.basename(archive_path),
            "sha256": sha256_hex(archive_path),
        }
        print(f"FFmpeg libraries: {', '.join(sorted(libs))}")

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
