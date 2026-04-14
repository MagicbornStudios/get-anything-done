import Link from "next/link";
import { notFound } from "next/navigation";
import { MarketingShell, SiteSection } from "@/components/site";
import { Identified } from "@/components/devid/Identified";
import { Badge } from "@/components/ui/badge";
import { CONTEXT_FRAMEWORKS, SKILLS, AGENTS, WORKFLOWS } from "@/lib/catalog.generated";

export function generateStaticParams() {
  return CONTEXT_FRAMEWORKS.map((f) => ({ slug: f.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  const framework = CONTEXT_FRAMEWORKS.find((f) => f.slug === params.slug);
  if (!framework) return { title: "Framework not found — GAD" };
  return {
    title: `${framework.name} — Context framework — GAD`,
    description: framework.description,
  };
}

/**
 * /context-frameworks/[slug] — detail page for one context framework
 * (decision gad-179). Renders the framework's bundle: skills, agents, and
 * workflows referenced by slug. Bundle-by-reference means each item links
 * to its canonical catalog page (if one exists) so a framework never
 * duplicates content.
 */
export default function ContextFrameworkDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  const framework = CONTEXT_FRAMEWORKS.find((f) => f.slug === params.slug);
  if (!framework) notFound();

  const parent =
    framework.extends != null
      ? CONTEXT_FRAMEWORKS.find((f) => f.slug === framework.extends) ?? null
      : null;

  // Resolve bundle references against the live catalogs so unknown slugs
  // surface as "unresolved" badges — a useful signal that a framework file
  // is out of date relative to the catalog.
  const resolvedSkills = framework.skills.map((slug) => ({
    slug,
    item: SKILLS.find((s) => s.id === slug) || null,
  }));
  const resolvedAgents = framework.agents.map((slug) => ({
    slug,
    item: AGENTS.find((a) => a.id === slug) || null,
  }));
  const resolvedWorkflows = framework.workflows.map((slug) => ({
    slug,
    item: WORKFLOWS.find((w) => w.slug === slug) || null,
  }));

  return (
    <MarketingShell>
      <SiteSection>
        <Identified as="ContextFrameworkDetailBreadcrumb" tag="nav" className="text-xs text-muted-foreground">
          <Link href="/context-frameworks" className="hover:text-foreground">
            ← All context frameworks
          </Link>
        </Identified>

        <Identified as={`ContextFrameworkDetail-${framework.slug}`} className="contents">
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="text-[11px] font-mono">
              v{framework.version}
            </Badge>
            {parent && (
              <Badge variant="outline" className="text-[11px]">
                extends{" "}
                <Link
                  href={`/context-frameworks/${parent.slug}`}
                  className="underline decoration-dotted"
                >
                  {parent.name}
                </Link>
              </Badge>
            )}
            <span className="text-[11px] text-muted-foreground">
              <code className="text-foreground/80">{framework.file}</code>
            </span>
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            {framework.name}
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
            {framework.description}
          </p>
        </Identified>

        <BundleSection
          title="Skills"
          items={resolvedSkills}
          emptyMessage="This framework ships no skills of its own."
          linkBase="/skills"
        />
        <BundleSection
          title="Agents"
          items={resolvedAgents}
          emptyMessage="This framework ships no agents of its own."
          linkBase="/agents"
        />
        <BundleSection
          title="Workflows"
          items={resolvedWorkflows}
          emptyMessage="This framework ships no workflows of its own."
          linkBase="/planning?tab=workflows#workflow"
        />

        {framework.canonicalProjects.length > 0 && (
          <section className="mt-10">
            <h2 className="text-xl font-semibold text-foreground">Canonical projects</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {framework.canonicalProjects.map((slug) => (
                <li key={slug}>
                  <Link
                    href={`/projects/${slug}`}
                    className="rounded-md border border-border/60 bg-muted/20 px-3 py-1.5 text-sm text-foreground hover:bg-muted/40"
                  >
                    {slug}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-12">
          <h2 className="text-xl font-semibold text-foreground">Description</h2>
          <div
            className="prose prose-invert prose-sm mt-4 max-w-none prose-headings:text-foreground prose-a:text-accent"
            dangerouslySetInnerHTML={{ __html: framework.bodyHtml }}
          />
        </section>
      </SiteSection>
    </MarketingShell>
  );
}

interface BundleItem<T> {
  slug: string;
  item: T | null;
}

function BundleSection<T extends { name?: string; description?: string }>({
  title,
  items,
  emptyMessage,
  linkBase,
}: {
  title: string;
  items: BundleItem<T>[];
  emptyMessage: string;
  linkBase: string;
}) {
  return (
    <section className="mt-10">
      <div className="flex items-baseline gap-3">
        <h2 className="text-xl font-semibold text-foreground">{title}</h2>
        <span className="tabular-nums text-sm text-muted-foreground">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <ul className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {items.map(({ slug, item }) => (
            <li
              key={slug}
              className="rounded-md border border-border/60 bg-card/30 px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <code className="text-[11px] text-foreground/90">{slug}</code>
                {!item && (
                  <Badge
                    variant="outline"
                    className="text-[9px] border-amber-500/40 text-amber-200/80"
                    title="Referenced by framework but not found in catalog — the bundle may be stale"
                  >
                    unresolved
                  </Badge>
                )}
              </div>
              {item && item.name && (
                <div className="mt-0.5 text-[10px] text-muted-foreground line-clamp-1">
                  {item.description}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
