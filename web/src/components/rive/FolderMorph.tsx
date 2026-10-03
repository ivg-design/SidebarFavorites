"use client";

import { useEffect } from "react";
import { useRive, RuntimeLoader } from "@rive-app/react-canvas";
import { asset } from "@/lib/config";

// Self-hosted wasm (public/rive/rive.wasm, copied from @rive-app/canvas): never fetch unpkg.
if (typeof window !== "undefined") RuntimeLoader.setWasmUrl(asset("/rive/rive.wasm"));

/** ViewModel "Morph" in public/rive/folder-morph.riv: number `target` (0 folder, 1 hammer,
 *  2 note, 3 palette, 4 plane, 5 branch, 6 cloud, 7 camera, 8 document + magnifier) and
 *  boolean `auto` (the file cycles shapes itself after 2.5 s idle). */
type Props = {
  target: number;
  auto?: boolean;
  className?: string;
  onReady?: () => void;
};

/**
 * Rive vector morph between the folder outline and eight glyphs. The canvas renders at once but is
 * transparent until the file has loaded (data-loaded="true"); the parent keeps a fallback underneath. Reduced motion is the
 * parent's call: pass `auto={false}` and a fixed `target` (the file then holds that shape,
 * jumping on change is not instant but settles in about 450 ms).
 */
export default function FolderMorph({ target, auto = true, className, onReady }: Props) {
  const { rive, RiveComponent } = useRive({
    src: asset("/rive/folder-morph.riv"),
    stateMachines: "Morph SM",
    autoplay: true,
    autoBind: true,
    onLoad: onReady,
  });

  useEffect(() => {
    const vmi = rive?.viewModelInstance;
    const t = vmi?.number("target");
    if (t) t.value = target;
  }, [rive, target]);

  useEffect(() => {
    const a = rive?.viewModelInstance?.boolean("auto");
    if (a) a.value = auto;
  }, [rive, auto]);

  // The hook only instantiates Rive once the canvas has mounted, so the canvas must always render;
  // it stays invisible (data-loaded) until the file is in.
  return <RiveComponent className={className} data-loaded={!!rive} />;
}
