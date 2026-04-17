import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import { MarketingShell } from "@/components/site";

type Tip = {
  id: string;
  title: string;
  category: string;
  difficulty: "intro" | "beginner" | "intermediate" | "advanced";
  tags: string[];
  source: "static" | "generated";
  date: string;
  path: string;
};

type TeachingsIndex = {
  schemaVersion: number;
  tips: Tip[];
};

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Teachings — Get Anything Done",
  description:
    "Daily tips from building a coding agent stack from scratch — tokenization, attention, context engineering, and the GAD framework itself.",
};

function loadTeachings(): TeachingsIndex {
  const indexPath = path.resolve(
    process.cwd(),
    "..",
    "teachings",
    "index.json"
  );
  try {
    return JSON.parse(fs.readFileSync(indexPath, "utf8"));
  } catch {
    return { schemaVersion: 0, tips: [] };
  }
}

const DIFFICULTY_ORDER: Record<string, number> = {
  intro: 0,
  beginner: 1,
  intermediate: 2,
  advanced: 3,
};

export default function TeachingsPage() {
  const { tips } = loadTeachings();

  const categories = Array.from(new Set(tips.map((t) => t.category))).sort();
  const grouped = categories.map((cat) => ({
    category: cat,
    tips: tips
      .filter((t) => t.category === cat)
      .sort(
        (a, b) =>
          (DIFFICULTY_ORDER[a.difficulty] ?? 9) -
            (DIFFICULTY_ORDER[b.difficulty] ?? 9) ||
          a.title.localeCompare(b.title)
      ),
  }));

  return (
    <MarketingShell>
      <section
        data-cid="teachings-site-section"
        className="mx-auto w-full max-w-6xl px-6 py-12"
      >
        <h1 className="mb-2 text-3xl font-bold tracking-tight text-foreground">
          Teachings
        </h1>
        <p className="mb-10 max-w-3xl text-sm text-muted-foreground">
          Short lessons from the trenches of building a coding-agent stack from
          scratch. Some come from the <code>llm-from-scratch</code> project
          (tokenizers, attention, training loops). Others come from operating
          the GAD framework itself (snapshot discipline, skill design, context
          engineering). Every tip is a reflection on a real implementation
          session — no synthetic how-tos.
        </p>

        {tips.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No tips found. The teachings index at
            <code className="mx-1">teachings/index.json</code> is empty or
            unreadable.
          </p>
        ) : (
          <div className="space-y-12">
            {grouped.map(({ category, tips: catTips }) => (
              <div key={category} data-cid={`teachings-category-${category}`}>
                <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {category.replace(/-/g, " ")} &middot; {catTips.length}
                </h2>
                <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {catTips.map((tip) => (
                    <li
                      key={tip.id}
                      data-cid={`teachings-card-${tip.id}`}
                      className="rounded border border-border bg-card p-4 transition-colors hover:border-primary/50"
                    >
                      <Link
                        href={`/teachings/${encodeURIComponent(tip.id)}`}
                        className="block"
                      >
                        <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                          <span>{tip.difficulty}</span>
                          <span>&middot;</span>
                          <span>{tip.date}</span>
                        </div>
                        <h3 className="mb-2 text-base font-semibold text-foreground">
                          {tip.title}
                        </h3>
                        {tip.tags?.length ? (
                          <div className="flex flex-wrap gap-1">
                            {tip.tags.slice(0, 4).map((t) => (
                              <span
                                key={t}
                                className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </MarketingShell>
  );
}
