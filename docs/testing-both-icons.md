# Testing Both icons on Intel and Apple silicon

The Manager launches a generated host app; Finder loads the extension inside that host. A Universal Manager alone does not establish that either helper works. Check the packaged binaries, then use Finder to check registration and rendering on the target OS.

## Check a DMG without changing Finder

From the repository root on a Mac with the Xcode command line tools, run:

```sh
scripts/verify-dmg.py /path/to/SidebarFavorites.dmg
```

This mounts the image read-only, reports the Mach-O platform and minimum OS for the `arm64` and `x86_64` slices of the Manager, host, extension and spacer, then ejects it. The published 1.3.0 DMG is a useful negative control: its host and extension lack Intel slices and require macOS 26. The release build runs the same check on its finished DMG.

For a second check, mount the candidate image and pass the path to the Manager **on the mounted volume**. On Apple silicon with Rosetta installed:

```sh
xcrun swift scripts/test-helper-launch.swift "/Volumes/SidebarFavorites/SidebarFavorites Manager.app" arm64 x86_64
```

On Intel, pass only `x86_64`. The probe asks macOS to start each selected helper slice suspended, verifies the CPU architecture, and terminates the process before it executes helper code. This tests executable loading; it does not run the extension, register it with Finder, or change any favorites.

With the same DMG mounted, exercise the upgrade using a disposable favorite and a temporary helper directory:

```sh
scripts/test-helper-upgrade.sh "/Volumes/SidebarFavorites/SidebarFavorites Manager.app"
```

This fixture uses the generator from the source checkout and the template executables from the candidate. It builds and signs the generated helper. Registration is simulated here; use the Finder test below to verify real macOS registration and rendering.

## Test the upgrade in Finder

Use a disposable macOS account or a VM snapshot. For [#27](https://github.com/ivg-design/SidebarFavorites/issues/27), use Sequoia (15); for [#29](https://github.com/ivg-design/SidebarFavorites/issues/29), use an Intel Mac. A native Intel Mac running Sequoia covers both the Intel architecture and the pre-Tahoe launch case in one pass. Ventura (13) is the separate minimum-OS check. A supported Apple silicon VM can cover the older OS; Rosetta on a newer OS cannot. Record the actual OS/build, CPU and app build with each result.

1. Open the published 1.3.0 Manager in the test account. Give a disposable local folder its own custom Finder icon. Add it as a favorite with a visibly different SF Symbol, such as `star.fill`, and choose **Keep both icons**. Quit the Manager. On an affected system the old helper may already fail here; keep the favorite and the generated helper in place for the upgrade.
2. Record the generated `SBF-….app` path under `~/Library/Application Support/SidebarFavorites/AdvancedApps`, its bundle identifier and build number. Replace **only the Manager** with the candidate. Open it and wait for setup to finish. Do not edit or recreate the favorite. The same favorite should have one helper at the same path and bundle ID, with the new build number.
3. In System Settings, find the `SBF-…` Finder extension and enable it if macOS requests approval. Open the parent folder and confirm the folder's own custom icon still appears there, while its Favorites row shows the selected SF Symbol. Neither the host nor the extension should produce a macOS incompatibility alert. On a system reporting an error, save the exact message and the Manager's **Settings → Copy Diagnostics** output.
4. Quit and reopen the candidate. Both icons should still appear. The helper should not be replaced on this second launch. Check the bundle's directory inode and executable modification time before and after relaunch; then switch the favorite back to regular mode and confirm the disposable helper goes away.

For a read-only check of one generated helper, substitute its exact path below. Compare this output after step 1, after upgrade and after relaunch:

```sh
helper='/path/to/generated/SBF-Test-12345678.app'
/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$helper/Contents/Info.plist"
/usr/libexec/PlistBuddy -c 'Print :CFBundleVersion' "$helper/Contents/Info.plist"
stat -f '%i %m %N' "$helper" "$helper"/Contents/MacOS/*
for binary in "$helper"/Contents/MacOS/* "$helper"/Contents/PlugIns/*.appex/Contents/MacOS/*; do
  lipo -archs "$binary"
  xcrun vtool -show-build "$binary"
done
codesign --verify --all-architectures --deep --strict "$helper"
```
