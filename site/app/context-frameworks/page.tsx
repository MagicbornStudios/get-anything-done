import Link from "next/link";
import { MarketingShell, SiteSection } from "@/components/site";
import { Identified } from "@/components/devid/Identified";
import { Badge } from "@/components/ui/badge";
import { CONTEXT_FRAMEWORKS } from "@/lib/catalog.generated";

export const metadata = {
  title: "Context frameworks — GAD",
  description:
    "Context frameworks are installable bundles of skills, agents, and workflows that wrap a project. GAD is one of several — bare, GSD, GAD, and custom — catalogued side by side so you can swap them per project.",
};

/**
 * /context-frameworks — index page for the context framework catalog
 * (decision gad-179). Each framework is a bundle that references existing
 * catalog items by slug, parallel to skills/agents/workflows/tech-stacks.
 */
export default function ContextFrameworksIndexPage() {
  const frameworks = [...CONTEXT_FRAMEWORKS].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <MarketingShell>
      <SiteSection cid="context-frameworks-page-site-section">
        <Identified as="ContextFrameworksIntro">
          <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
            Context frameworks
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground">
            A context framework is a bundle of skills, agents, and workflows that
            wraps a project — it decides what methodology the agent follows, what
            planning artifacts exist, and what the standard loop looks like. GAD
            is one of several context frameworks catalogued here, alongside{" "}
            <strong>bare</strong> (the no-framework control) and{" "}
            <strong>GSD</strong> (the upstream framework GAD forked from).
            Projects declare their context framework as a dependency the same way
            they declare a tech stack — and the Brood Editor lets you swap it on
            a per-project basis.
          </p>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
            Frameworks are bundles <em>by reference</em>: they list other catalog
            slugs (skills, agents, workflows) instead of duplicating content. A
            framework update propagates automatically to every project on it.
            Frameworks can also <code className="text-foreground/80">extend</code>{" "}
            other frameworks to inherit and override their bundle.
          </p>
        </Identified>

        {frameworks.length === 0 ? (
          <Identified
            as="ContextFrameworksEmpty"
            tag="p"
            className="mt-8 text-sm text-muted-foreground"
          >
            No frameworks registered. Add source files to{" "}
            <code>.planning/context-frameworks/</code>.
          </Identified>
        ) : (
          <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {frameworks.map((f) => (
              <Link
                key={f.slug}
                href={`/context-frameworks/${f.slug}`}
                className="group rounded-xl border border-border/70 bg-card/40 p-6 transition-colors hover:border-sky-500/50 hover:bg-card/60"
              >
                <Identified as={`ContextFrameworkCard-${f.slug}`} className="contents">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] font-mono">
                      v{f.version}
                    </Badge>
                    {f.extends && (
                      <Badge variant="outline" className="text-[10px]">
                        extends {f.extends}
                      </Badge>
                    )}
                  </div>
                  <h2 className="mt-3 text-2xl font-semibold text-foreground group-hover:text-sky-200">
                    {f.name}
                  </h2>
                  <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">
                    {f.description}
                  </p>
                  <dl className="mt-4 grid grid-cols-3 gap-2 text-[11px]">
                    <div className="rounded-md border border-border/50 bg-muted/20 px-2 py-1.5">
                      <dt className="uppercase tracking-wider text-muted-foreground">skills</dt>
                      <dd className="mt-0.5 tabular-nums text-foreground">
                        {f.skills.length}
                      </dd>
                    </div>
                    <div className="rounded-md border border-border/50 bg-muted/20 px-2 py-1.5">
                      <dt className="uppercase tracking-wider text-muted-foreground">agents</dt>
                      <dd className="mt-0.5 tabular-nums text-foreground">
                        {f.agents.length}
                      </dd>
                    </div>
                    <div className="rounded-md border border-border/50 bg-muted/20 px-2 py-1.5">
                      <dt className="uppercase tracking-wider text-muted-foreground">workflows</dt>
                      <dd className="mt-0.5 tabular-nums text-foreground">
                        {f.workflows.length}
                      </dd>
                    </div>
                  </dl>
                  {f.canonicalProjects.length > 0 && (
                    <p className="mt-3 text-[11px] text-muted-foreground">
                      Canonical project:{" "}
                      <code className="text-foreground/80">{f.canonicalProjects[0]}</code>
                      {f.canonicalProjects.length > 1 && ` +${f.canonicalProjects.length - 1}`}
                    </p>
                  )}
                </Identified>
              </Link>
            ))}
          </div>
        )}
      </SiteSection>
    </MarketingShell>
  );
}

