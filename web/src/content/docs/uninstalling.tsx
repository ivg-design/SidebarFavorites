import type { DocMeta } from "./types";
import Callout from "@/components/docs/Callout";
import { H2 } from "@/components/docs/Headings";

export const meta: DocMeta = {
  slug: "uninstalling",
  title: "Uninstalling",
  group: "Reference",
  description: "How to remove SidebarFavorites cleanly. The order matters if you used Both icons mode.",
  keywords: ["uninstall", "remove", "delete", "trash", "remove all sidebar icons", "helpers", "login items", "application support", "cleanup"],
  excerpt: "Delete your favorites in the app first, then drag SidebarFavorites Manager to the Trash. Do not skip the first step if you used Both icons.",
  sections: [
    { id: "steps", title: "The three steps" },
    { id: "order", title: "Why the order matters" },
  ],
};

export function Body() {
  return (
    <>
      <H2 id="steps">The three steps</H2>
      <ol>
        <li>In the app, delete your favorites. This removes the sidebar rows the app added and restores the original icon on rows you added yourself. (Settings → <strong>Remove All Sidebar Icons</strong> does the same in one step, and also deletes the helper bundle and any Both-icons helpers. It tells you exactly what it will do first.)</li>
        <li>Drag <strong>SidebarFavorites Manager</strong> to the Trash.</li>
        <li>Optionally delete <code>~/Library/Application Support/SidebarFavorites</code>.</li>
      </ol>
      <H2 id="order">Why the order matters</H2>
      <Callout kind="warn" title="Order matters.">Do step 1 before step 2 if you used <strong>Both icons</strong> mode.</Callout>
      <p>Dragging the app to the Trash runs none of its code, so its helpers stay registered and keep appearing in System Settings until you remove them there or delete <code>~/Library/Application Support/SidebarFavorites</code>. Each one says in its description that it is safe to disable if SidebarFavorites is gone.</p>
    </>
  );
}
