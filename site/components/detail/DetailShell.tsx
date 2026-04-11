import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import Nav from "@/components/landing/nav/Nav";
import Footer from "@/components/landing/Footer";

const REPO = "https://github.com/MagicbornStudios/get-anything-done";

export interface DetailShellProps {
  kind: "skill" | "subagent" | "command" | "finding";
  backHref: string;
  backLabel: string;
  name: string;
  subtitle?: string;
  description?: string;
  badges?: Array<{ label: string; variant?: "default" | "outline" | "success" | "danger" }>;
  meta?: Array<{ label: string; value: ReactNode }>;
  sourcePath?: string;
  bodyHtml: string;
  sidebar?: ReactNode;
}

const KIND_LABELS: Record<DetailShellProps["kind"], string> = {
  skill: "Skill",
  subagent: "Subagent",
  command: "Command",
  finding: "Finding",
};

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
          <Link
            href={backHref}
            className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft size={14} aria-hidden />
            {backLabel}
          </Link>

          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="default">{KIND_LABELS[kind]}</Badge>
            {badges?.map((b) => (
              <Badge key={b.label} variant={b.variant ?? "outline"}>
                {b.label}
              </Badge>
            ))}
          </div>

          <h1 className="mt-5 font-mono text-3xl font-semibold tracking-tight text-accent md:text-4xl">
            {name}
          </h1>
          {subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}
          {description && (
            <p className="mt-5 max-w-3xl text-lg leading-8 text-foreground">{description}</p>
          )}

          <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]">
            <div>
              {meta && meta.length > 0 && (
                <dl className="mb-8 grid grid-cols-2 gap-x-6 gap-y-4 rounded-2xl border border-border/70 bg-card/40 p-5 md:grid-cols-3">
                  {meta.map((m) => (
                    <div key={m.label}>
                      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {m.label}
                      </dt>
                      <dd className="mt-1 text-sm font-medium text-foreground">{m.value}</dd>
                    </div>
                  ))}
                </dl>
              )}

              <article
                className="prose-content"
                dangerouslySetInnerHTML={{ __html: bodyHtml }}
              />

              {sourcePath && (
                <div className="mt-10 border-t border-border/60 pt-6">
                  <a
                    href={`${REPO}/blob/main/${sourcePath}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm font-semibold text-accent hover:underline"
                  >
                    Source on GitHub
                    <ExternalLink size={12} aria-hidden />
                  </a>
                  <p className="mt-2 font-mono text-xs text-muted-foreground">{sourcePath}</p>
                </div>
              )}
            </div>
            {sidebar && <aside className="space-y-5">{sidebar}</aside>}
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
}
