import type { Metadata } from "next";
import DocsShell from "@/components/docs/DocsShell";
import { docIndex } from "@/content/docs";
import "./docs.css";

export const metadata: Metadata = { robots: { index: true, follow: true } };

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return <DocsShell index={docIndex}>{children}</DocsShell>;
}
