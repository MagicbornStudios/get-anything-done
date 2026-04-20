import Link from "next/link";
import { MarketingShell, SiteSection, SiteSectionHeading } from "@/components/site";
import { platformUrl } from "@/lib/platform-url";

export type PlanningAppRedirectStubProps = {
  surface: string;
  targetPath: string;
  summary: string;
  cid: string;
};

const INSTALL_CMD = "npx -y get-anything-done install";
const SERVE_CMD = "gad planning serve";
const START_CMD = "gad start";

export function PlanningAppRedirectStub({
  surface,
  targetPath,
  summary,
  cid,
}: PlanningAppRedirectStubProps) {
  const targetUrl = platformUrl(targetPath);

  return (
    <MarketingShell>
      <SiteSection cid={cid}>
        <div className="max-w-3xl space-y-6 py-16">
          <SiteSectionHeading
            kicker="moved"
            title={
              <>
                {surface} moved to the planning-app (<code className="font-mono text-2xl">gad planning serve</code>)
              </>
            }
            preset="hero-compact"
            as="h1"
          />

          <p className="text-base text-muted-foreground">{summary}</p>

          <div
            data-cid="planning-app-redirect-install"
            className="rounded-md border border-border/60 bg-card/30 p-5"
          >
            <p className="mb-3 text-sm font-medium">1. Install the GAD binary</p>
            <pre className="overflow-x-auto rounded bg-background/60 p-3 font-mono text-xs">
              <code>{INSTALL_CMD}</code>
            </pre>
            <p className="mt-4 mb-3 text-sm font-medium">
              2. Start the planning-app on <code className="font-mono">:3002</code>
            </p>
            <pre className="overflow-x-auto rounded bg-background/60 p-3 font-mono text-xs">
              <code>{SERVE_CMD}</code>
            </pre>
            <p className="mt-2 text-xs text-muted-foreground">
              Or run <code className="font-mono">{START_CMD}</code> to spawn the server and open
              the dashboard in your default browser.
            </p>
            <p className="mt-4 mb-2 text-sm font-medium">3. Open the view</p>
            <Link
              href={targetUrl}
              className="inline-flex items-center gap-2 text-sm text-accent underline-offset-2 hover:underline"
            >
              {targetUrl}
            </Link>
          </div>

          <p className="text-xs text-muted-foreground">
            This redirect stub ships for one release cycle per decision gad-261, then the
            route is removed. The marketplace view lives on at{" "}
            <Link href="/project-market" className="text-accent hover:underline">
              /project-market
            </Link>
            .
          </p>
        </div>
      </SiteSection>
    </MarketingShell>
  );
}
