import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import { notFound } from "next/navigation";
import { marked } from "marked";
import { MarketingShell } from "@/components/site";

const DIFFICULTY_CLASSES: Record<string, string> = {
  intro: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  beginner: "bg-sky-500/15 text-sky-300 ring-sky-500/30",
  intermediate: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  advanced: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
};

function DifficultyBadge({ level }: { level: string }) {
  const cls =
    DIFFICULTY_CLASSES[level] ??
    "bg-muted text-muted-foreground ring-border";
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ring-1 ring-inset ${cls}`}
    >
      {level}
    </span>
  );
}

type Tip = {
  id: string;
  title: string;
  category: string;
  difficulty: string;
  tags: string[];
  source: string;
  date: string;
  path: string;
  implementation?: string[] | string;
  decisions?: string[] | string;
  phases?: string[] | string;
  related?: string[] | string;
};

type TeachingsIndex = {
  schemaVersion: number;
  tips: Tip[];
};

export const dynamic = "force-dynamic";

function teachingsRoot(): string {
  return path.resolve(process.cwd(), "..", "teachings");
}

function loadIndex(): TeachingsIndex {
  try {
    return JSON.parse(
      fs.readFileSync(path.join(teachingsRoot(), "index.json"), "utf8")
    );
  } catch {
    return { schemaVersion: 0, tips: [] };
  }
}

function stripFrontmatter(raw: string): string {
  if (!raw.startsWith("---")) return raw;
  const end = raw.indexOf("\n---", 3);
  if (end === -1) return raw;
  return raw.slice(end + 4).replace(/^\n+/, "");
}

function toArr(v: string[] | string | undefined): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  return String(v)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { tips } = loadIndex();
  const tip = tips.find((t) => t.id === slug);
  if (!tip) return { title: "Teaching not found" };
  return {
    title: `${tip.title} — Teachings`,
    description: `Tip in ${tip.category} · ${tip.difficulty}`,
  };
}

export default async function TeachingDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { tips } = loadIndex();
  const tip = tips.find((t) => t.id === slug);
  if (!tip) notFound();

  const bodyPath = path.join(teachingsRoot(), tip.path);
  let html = "";
  try {
    const raw = fs.readFileSync(bodyPath, "utf8");
    const stripped = stripFrontmatter(raw);
    html = marked.parse(stripped, { async: false }) as string;
  } catch {
    html = "<p><em>Tip body could not be loaded.</em></p>";
  }

  const impls = toArr(tip.implementation);
  const decisions = toArr(tip.decisions);
  const phases = toArr(tip.phases);
  const related = toArr(tip.related);

  return (
    <MarketingShell>
      <article
        data-cid={`teachings-article-${tip.id}`}
        className="mx-auto w-full max-w-3xl px-6 py-12"
      >
        <nav className="mb-8 text-xs text-muted-foreground">
          <Link href="/teachings" className="hover:text-foreground">
            ← All teachings
          </Link>
        </nav>

        <header className="mb-8 border-b border-border pb-6">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <DifficultyBadge level={tip.difficulty} />
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
              {tip.category.replace(/-/g, " ")}
            </span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {tip.date}
            </span>
            {tip.source === "generated" && (
              <span className="rounded bg-violet-500/15 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-violet-300 ring-1 ring-inset ring-violet-500/30">
                generated
              </span>
            )}
          </div>
          <h1 className="mb-3 text-3xl font-bold tracking-tight text-foreground">
            {tip.title}
          </h1>
          {tip.tags?.length ? (
            <div className="flex flex-wrap gap-1">
              {tip.tags.map((t) => (
                <span
                  key={t}
                  className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                >
                  {t}
                </span>
              ))}
            </div>
          ) : null}
        </header>

        <div
          data-cid={`teachings-body-${tip.id}`}
          className="prose prose-invert max-w-none prose-headings:font-semibold prose-h2:text-xl prose-h2:mt-8 prose-h3:text-base prose-h3:mt-6 prose-code:rounded prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:text-[0.875em] prose-code:before:content-[''] prose-code:after:content-[''] prose-pre:bg-muted prose-pre:text-foreground"
          dangerouslySetInnerHTML={{ __html: html }}
        />

        {(impls.length ||
          decisions.length ||
          phases.length ||
          related.length) && (
          <aside
            data-cid={`teachings-backrefs-${tip.id}`}
            className="mt-12 grid gap-4 border-t border-border pt-6 text-xs text-muted-foreground sm:grid-cols-2"
          >
            {impls.length > 0 && (
              <div>
                <div className="mb-1 font-semibold uppercase tracking-wider">
                  Implementation
                </div>
                <ul className="space-y-1">
                  {impls.map((p) => (
                    <li key={p}>
                      <code className="text-[11px]">{p}</code>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {decisions.length > 0 && (
              <div>
                <div className="mb-1 font-semibold uppercase tracking-wider">
                  Decisions
                </div>
                <ul className="space-y-1">
                  {decisions.map((d) => (
                    <li key={d}>
                      <code className="text-[11px]">{d}</code>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {phases.length > 0 && (
              <div>
                <div className="mb-1 font-semibold uppercase tracking-wider">
                  Phases
                </div>
                <ul className="space-y-1">
                  {phases.map((p) => (
                    <li key={p}>
                      <code className="text-[11px]">{p}</code>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {related.length > 0 && (
              <div>
                <div className="mb-1 font-semibold uppercase tracking-wider">
                  Related
                </div>
                <ul className="space-y-1">
                  {related.map((r) => (
                    <li key={r}>
                      <Link
                        href={`/teachings/${encodeURIComponent(r)}`}
                        className="hover:text-foreground"
                      >
                        <code className="text-[11px]">{r}</code>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </aside>
        )}
      </article>
    </MarketingShell>
  );
}
