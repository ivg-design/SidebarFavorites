import { asset, ISSUES_URL, REPO_URL } from "@/lib/config";

export default function DocsFooter() {
  return (
    <footer className="dx-foot">
      <div className="dx-foot-in">
        <p>© 2026 IVG Design · MIT license · Not affiliated with Apple Inc.</p>
        <nav aria-label="Footer">
          <a href={asset("/")}>Home</a>
          <a href={asset("/changelog")}>Changelog</a>
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer">GitHub</a>
          <a href={ISSUES_URL} target="_blank" rel="noopener noreferrer">Issues</a>
        </nav>
      </div>
    </footer>
  );
}
