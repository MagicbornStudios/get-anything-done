import fs from "node:fs";
import path from "node:path";
import { marked } from "marked";
import { MarketingShell, SiteSection } from "@/components/site";

export const metadata = {
  title: "Eval Guide — set up, run, score, and publish evaluations",
  description: "Complete guide to the GAD evaluation framework: domains, tech stacks, skill installation, scoring, and publishing.",
};

function getContent() {
  const docsDir = path.resolve(process.cwd(), "..", "docs");
  const filePath = path.join(docsDir, "eval-guide.md");
  if (!fs.existsSync(filePath)) return "<p>Eval guide not found.</p>";
  const md = fs.readFileSync(filePath, "utf8");
  return marked.parse(md, { async: false }) as string;
}

export default function EvalGuidePage() {
  const html = getContent();

  return (
    <MarketingShell>
      <SiteSection>
        <div className="prose-content" dangerouslySetInnerHTML={{ __html: html }} />
      </SiteSection>
    </MarketingShell>
  );
}
