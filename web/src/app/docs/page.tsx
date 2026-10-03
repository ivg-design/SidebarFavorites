import { docMetadata } from "@/lib/seo";
import { getDoc } from "@/content/docs";
import DocArticle from "@/components/docs/DocArticle";

const doc = getDoc("quick-start")!;
export const metadata = docMetadata(doc.slug, doc.title, doc.description);

export default function DocsHome() { return <DocArticle slug="quick-start" />; }
