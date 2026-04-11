import fs from "node:fs";
import path from "node:path";
import { marked } from "marked";
import Nav from "@/components/landing/nav/Nav";
import Footer from "@/components/landing/Footer";

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
    <main className="min-h-screen bg-background text-foreground">
      <Nav />
      <div className="section-shell">
        <div className="prose-content" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
      <Footer />
    </main>
  );
}
