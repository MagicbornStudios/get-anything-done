import { MarketingShell, SiteSection, SiteSectionHeading } from "@/components/site";
import { platformUrl } from "@/lib/platform-url";

export const metadata = {
  title: "Marketplace moved to platform — GAD",
  description:
    "The project marketplace moved to the platform app. The vendor site stays as framework dev/landing; run the platform app locally to browse and launch projects.",
};

const RUN_CMD = "pnpm --filter @portfolio/platform dev";
const MARKETPLACE_URL = platformUrl('/marketplace');

export default function ProjectMarketDeprecatedPage() {
  return (
    <MarketingShell>
      <SiteSection cid="project-market-deprecated-stub">
        <div className="max-w-3xl space-y-6 py-16">
          <SiteSectionHeading
            kicker="moved"
            title="The marketplace has moved."
            preset="hero-compact"
            as="h1"
          />

          <p className="text-base text-muted-foreground">
            The project marketplace is now part of the platform app (
            <code className="font-mono">apps/platform</code>). The vendor site
            hosts framework dev tooling and the public landing only — it no
            longer serves marketplace UI. Spin up the platform app locally to
            browse and launch projects.
          </p>

          <div
            data-cid="project-market-deprecated-run"
            className="rounded-md border border-border/60 bg-card/30 p-5"
          >
            <p className="mb-3 text-sm font-medium">Run the platform app</p>
            <pre className="overflow-x-auto rounded bg-background/60 p-3 font-mono text-xs">
              <code>{RUN_CMD}</code>
            </pre>
            <p className="mt-4 mb-2 text-sm font-medium">
              Open the marketplace (port{" "}
              <code className="font-mono">3002</code>)
            </p>
            <a
              href={MARKETPLACE_URL}
              className="inline-flex items-center gap-2 text-sm text-accent underline-offset-2 hover:underline"
            >
              Open marketplace
            </a>
          </div>

          <p className="text-xs text-muted-foreground">
            This stub ships per decision gad-261. Route will be removed in the
            next release cycle once consumers have migrated.
          </p>
        </div>
      </SiteSection>
    </MarketingShell>
  );
}
