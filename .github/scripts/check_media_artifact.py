#!/usr/bin/env python3
"""
check_media_artifact.py — check a downloaded glyx-media release artifact.

Usage:
  python3 .github/scripts/check_media_artifact.py <folder with the artifact files>

The folder holds what one platform's workflow artifact contains:
  glyx-media-<version>-<platform>-<arch>.<dll|dylib|so>
  glyx-media-<version>-<platform>-<arch>.manifest.json / .manifest.sig
  glyx-ffmpeg-libs-<version>-<platform>-<arch>.tar.gz

Checks the hashes the manifest lists, the Ed25519 signature against the key
compiled into the runner (crates/glyx-media/keys/glyx_media_verify.pub), and,
for the platform you are running on, that the library loads with its bundled
FFmpeg and that FFmpeg reports an LGPL licence. Exits 1 if anything fails.
"""

import ctypes
import glob
import hashlib
import json
import os
import sys
import tarfile

HERE = os.path.dirname(os.path.abspath(__file__))
PUBKEY = os.path.join(HERE, "..", "..", "crates", "glyx-media", "keys", "glyx_media_verify.pub")

ok = True


def check(label, cond, detail=""):
    global ok
    ok &= bool(cond)
    print(("PASS " if cond else "FAIL ") + label + (f"  ({detail})" if detail else ""))


def sha(b):
    return hashlib.sha256(b).hexdigest()


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    folder = sys.argv[1]
    manifests = glob.glob(os.path.join(folder, "glyx-media-*.manifest.json"))
    if len(manifests) != 1:
        sys.exit(f"expected one glyx-media-*.manifest.json in {folder}, found {len(manifests)}")
    stem = os.path.basename(manifests[0])[: -len(".manifest.json")]
    platform = stem.split("-")[3]  # glyx-media-<version>-<platform>-<arch>

    def read(name):
        with open(os.path.join(folder, name), "rb") as f:
            return f.read()

    manifest_bytes = read(stem + ".manifest.json")
    sig = read(stem + ".manifest.sig")
    m = json.loads(manifest_bytes)
    lib_name = next(n for n in os.listdir(folder) if n.startswith(stem + ".") and not n.endswith((".json", ".sig")))

    check("manifest is for this build", m["version"] == stem.split("-")[2], m["version"])
    check("library hash matches the manifest", sha(read(lib_name)) == m["sha256"])
    archive_name = m["ffmpeg_archive"]["name"]
    check("archive hash matches the manifest", sha(read(archive_name)) == m["ffmpeg_archive"]["sha256"])

    tar = tarfile.open(os.path.join(folder, archive_name), "r:gz")
    members = {os.path.normpath(t.name): t for t in tar.getmembers() if t.isfile()}
    for name, want in sorted(m["libs"].items()):
        got = sha(tar.extractfile(members[name]).read()) if name in members else None
        check(f"{name} matches the manifest", got == want)
    check("licence text and source note are in the archive", "LICENSE.txt" in members and "SOURCE.txt" in members)

    # The signature, against the key compiled into the runner.
    pub = open(PUBKEY, "rb").read()
    if not any(pub):
        check("signing key in the repo is a real key", False, "keys/glyx_media_verify.pub is the all-zero placeholder; run derive_media_pubkey.py")
    else:
        try:
            from cryptography.exceptions import InvalidSignature
            from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
            try:
                Ed25519PublicKey.from_public_bytes(pub).verify(sig, manifest_bytes)
                check("Ed25519 signature verifies against the key in the repo", True)
            except InvalidSignature:
                why = "zero signature: CI had no signing key" if not any(sig) else "signed with a different key"
                check("Ed25519 signature verifies against the key in the repo", False, why)
        except ImportError:
            print("SKIP signature check: pip install cryptography")

    # Loading only makes sense on the platform the artifact is for.
    here = {"win32": "windows", "darwin": "macos"}.get(sys.platform, "linux")
    if platform != here:
        print(f"SKIP load check: this is a {platform} artifact and you are on {here}")
    else:
        import tempfile
        work = tempfile.mkdtemp(prefix="glyx-media-check-")
        if sys.version_info >= (3, 12):
            tar.extractall(work, filter="data")  # no absolute paths, links or odd modes
        else:
            tar.extractall(work)
        with open(os.path.join(work, lib_name), "wb") as f:
            f.write(read(lib_name))
        try:
            if platform == "windows":
                lib = ctypes.WinDLL(os.path.join(work, lib_name), winmode=0x8)  # LOAD_WITH_ALTERED_SEARCH_PATH
            else:
                lib = ctypes.CDLL(os.path.join(work, lib_name))
            lib.glyx_media_version.restype = ctypes.c_char_p
            version = lib.glyx_media_version().decode()
            check("the library loads with its bundled FFmpeg", True, f"reports version {version}")
            check("the library reports this release's version", version == m["version"], version)
        except OSError as e:
            check("the library loads with its bundled FFmpeg", False, str(e))
        avcodec = next((n for n in m["libs"] if "avcodec" in n), None)
        try:
            path = os.path.join(work, avcodec)
            av = ctypes.WinDLL(path, winmode=0x8) if platform == "windows" else ctypes.CDLL(path)
            av.avcodec_license.restype = ctypes.c_char_p
            av.avcodec_configuration.restype = ctypes.c_char_p
            lic, conf = av.avcodec_license().decode(), av.avcodec_configuration().decode()
            check("FFmpeg reports an LGPL licence", lic.startswith("LGPL"), lic)
            check("FFmpeg was not configured with --enable-gpl / --enable-nonfree",
                  "--enable-gpl" not in conf and "--enable-nonfree" not in conf)
        except OSError as e:
            check("FFmpeg reports an LGPL licence", False, str(e))

    print("\nRESULT:", "ALL PASS" if ok else "SOME CHECKS FAILED")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
