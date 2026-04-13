import fs from "node:fs";
import path from "node:path";
import { marked } from "marked";
import { Identified } from "@/components/devid/Identified";
import { MarketingShell, SiteSection } from "@/components/site";

export const metadata = {
  title: "Quick Start — GAD in 5 minutes",
  description: "Install a coding agent, install GAD, and run your first eval in 5 minutes.",
};

function getContent() {
  const docsDir = path.resolve(process.cwd(), "..", "docs");
  const filePath = path.join(docsDir, "quick-start.md");
  if (!fs.existsSync(filePath)) return "<p>Quick start guide not found.</p>";
  const md = fs.readFileSync(filePath, "utf8");
  return marked.parse(md, { async: false }) as string;
}

export default function QuickStartPage() {
  const html = getContent();

  return (
    <MarketingShell>
      <SiteSection>
        <Identified as="QuickstartProse" className="prose-content">
          <div dangerouslySetInnerHTML={{ __html: html }} />
        </Identified>
      </SiteSection>
    </MarketingShell>
  );
}
