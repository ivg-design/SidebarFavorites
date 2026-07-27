{
  lib,
  stdenvNoCC,
  fetchurl,
  _7zz,
  nix-update-script,
}:

stdenvNoCC.mkDerivation (finalAttrs: {
  pname = "sidebarfavorites";
  version = "1.0.2";

  src = fetchurl {
    url = "https://github.com/ivg-design/SidebarFavorites/releases/download/v${finalAttrs.version}/SidebarFavorites-${finalAttrs.version}.dmg";
    hash = "sha256-NbCyhQPZjPOpnNfZJgAwrl8LQrDChH3SsFfiHkf/0zo=";
  };

  nativeBuildInputs = [ _7zz ];
  sourceRoot = ".";

  unpackPhase = ''
    runHook preUnpack
    7zz x -snld "$src"
    runHook postUnpack
  '';

  installPhase = ''
    runHook preInstall
    mkdir -p "$out/Applications"
    cp -R "SidebarFavorites Manager.app" "$out/Applications/"
    runHook postInstall
  '';

  dontBuild = true;
  dontFixup = true;

  passthru.updateScript = nix-update-script { };

  meta = {
    description = "Add custom folders to macOS Finder's sidebar with custom SF Symbol icons";
    homepage = "https://github.com/ivg-design/SidebarFavorites";
    changelog = "https://github.com/ivg-design/SidebarFavorites/releases/tag/v${finalAttrs.version}";
    license = lib.licenses.mit;
    # For nixpkgs submission, add yourself to nixpkgs maintainers list first
    # then use: maintainers = with lib.maintainers; [ ivg-design ];
    maintainers = [ ];
    platforms = lib.platforms.darwin;
    mainProgram = "SidebarFavorites Manager";
    sourceProvenance = with lib.sourceTypes; [ binaryNativeCode ];
  };
})
