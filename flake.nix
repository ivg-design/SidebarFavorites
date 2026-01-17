{
  description = "SidebarFavorites - Add custom folders to macOS Finder's sidebar with custom SF Symbol icons";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachSystem [ "aarch64-darwin" "x86_64-darwin" ] (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
        sidebarfavorites = pkgs.callPackage ./nix/default.nix { };
      in
      {
        packages = {
          default = sidebarfavorites;
          sidebarfavorites = sidebarfavorites;
        };

        apps.default = {
          type = "app";
          program = "${sidebarfavorites}/Applications/SidebarFavorites Manager.app/Contents/MacOS/SidebarFavorites Manager";
        };
      }
    );
}
