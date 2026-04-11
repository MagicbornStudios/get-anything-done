import Nav from "@/components/landing/nav/Nav";
import Footer from "@/components/landing/Footer";
import type { DetailShellProps } from "./detail-shell-shared";
import DetailShellBackLink from "./DetailShellBackLink";
import DetailShellKindBadges from "./DetailShellKindBadges";
import DetailShellTitleBlock from "./DetailShellTitleBlock";
import DetailShellMetaGrid from "./DetailShellMetaGrid";
import DetailShellProseArticle from "./DetailShellProseArticle";
import DetailShellSourceBlock from "./DetailShellSourceBlock";

export type { DetailShellProps } from "./detail-shell-shared";

export default function DetailShell({
  kind,
  backHref,
  backLabel,
  name,
  subtitle,
  description,
  badges,
  meta,
  sourcePath,
  bodyHtml,
  sidebar,
}: DetailShellProps) {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <Nav />
      <section className="border-b border-border/60">
        <div className="section-shell">
          <DetailShellBackLink backHref={backHref} backLabel={backLabel} />
          <DetailShellKindBadges kind={kind} badges={badges} />
          <DetailShellTitleBlock name={name} subtitle={subtitle} description={description} />

          <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]">
            <div>
              {meta && meta.length > 0 && <DetailShellMetaGrid meta={meta} />}
              <DetailShellProseArticle bodyHtml={bodyHtml} />
              {sourcePath && <DetailShellSourceBlock sourcePath={sourcePath} />}
            </div>
            {sidebar && <aside className="space-y-5">{sidebar}</aside>}
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
}
