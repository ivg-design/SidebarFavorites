#!/usr/bin/env python3
"""Check the Intel and Apple silicon deployment targets in a SidebarFavorites DMG."""

import argparse
from pathlib import Path
import os
import re
import subprocess
import sys
import tempfile


EXECUTABLES = (
    "MacOS/SidebarFavorites Manager",
    "Resources/FinderSyncTemplate/host-bin",
    "Resources/FinderSyncTemplate/appex-bin",
    "Resources/FinderSyncTemplate/spacer-bin",
)


def verify_app(volume):
    contents = volume / "SidebarFavorites Manager.app" / "Contents"
    errors = []
    for name in EXECUTABLES:
        binary = contents / name
        if volume not in binary.resolve().parents or not binary.is_file() or not os.access(binary, os.X_OK):
            errors.append(f"{name}: executable missing from image")
            continue
        archs = subprocess.check_output(["xcrun", "lipo", "-archs", binary], text=True).split()
        for arch in ("arm64", "x86_64"):
            if arch not in archs:
                errors.append(f"{name}: missing {arch} (found {' '.join(archs)})")
                continue
            info = subprocess.check_output(["xcrun", "vtool", "-arch", arch, "-show-build", binary], text=True)
            platform = re.findall(r"^\s*platform\s+(\S+)$", info, re.MULTILINE)
            versions = re.findall(r"^\s*minos\s+(\d+(?:\.\d+){0,2})$", info, re.MULTILINE)
            if platform != ["MACOS"] or len(versions) != 1:
                errors.append(f"{name} [{arch}]: expected one macOS deployment target")
                continue
            min_os = versions[0]
            print(f"{name} [{arch}]: macOS {min_os}", flush=True)
            parts = [int(n) for n in min_os.split(".")]
            if (parts + [0, 0])[:3] > [13, 0, 0]:
                errors.append(f"{name} [{arch}]: requires macOS {min_os}, must run on 13.0")
    return errors


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("dmg", type=Path)
    dmg = parser.parse_args().dmg.resolve(strict=True)
    mount = Path(tempfile.mkdtemp(prefix="sbf-verify-dmg-")).resolve()
    try:
        subprocess.run(["hdiutil", "attach", dmg, "-readonly", "-nobrowse", "-noautoopen",
                        "-mountpoint", mount, "-quiet"], check=True)
        if not mount.is_mount():
            raise RuntimeError(f"DMG did not mount at {mount}")
        errors = verify_app(mount)
    finally:
        if mount.is_mount():
            subprocess.run(["hdiutil", "detach", mount, "-quiet"], check=True)
        if mount.exists():
            mount.rmdir()
    for error in errors:
        print(f"ERROR: {error}", file=sys.stderr)
    if errors:
        return 1
    print(f"Verified all four packaged executables in {dmg.name}.")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (OSError, RuntimeError, subprocess.CalledProcessError) as error:
        sys.exit(f"ERROR: {error}")
