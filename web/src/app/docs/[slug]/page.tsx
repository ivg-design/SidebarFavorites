import { notFound } from "next/navigation";
import { docMetadata } from "@/lib/seo";
import { docPages, getDoc } from "@/content/docs";
import DocArticle from "@/components/docs/DocArticle";

export const dynamicParams = false;
export function generateStaticParams() {
  return docPages.filter((p) => p.slug !== "quick-start").map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = getDoc(slug);
  return doc ? docMetadata(doc.slug, doc.title, doc.description) : {};
}

export default async function DocPageRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (slug === "quick-start" || !getDoc(slug)) notFound();
  return <DocArticle slug={slug} />;
}
