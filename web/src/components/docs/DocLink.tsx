import { asset } from "@/lib/config";
import { docUrl } from "@/content/docs/types";

/** Link to another docs page (optionally a section): <DocLink to="install" hash="homebrew">Install</DocLink>. */
export default function DocLink({ to, hash, children }: { to: string; hash?: string; children: React.ReactNode }) {
  return <a href={`${asset(docUrl(to))}${hash ? `#${hash}` : ""}`}>{children}</a>;
}
