import Link from "next/link";
import { CURRENT_REQUIREMENTS, REQUIREMENTS_HISTORY } from "@/lib/catalog.generated";
import { REPO } from "@/app/requirements/requirements-shared";

export function RequirementsHero() {
  return (
    <section className="border-b border-border/60">
      <div className="section-shell">
        <p className="section-kicker">Requirements</p>
        <h1 className="max-w-3xl text-5xl font-semibold tracking-tight md:text-6xl">
          Every spec, every version.{" "}
          <span className="gradient-text">Every R-v5.XX has a permalink.</span>
        </h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-muted-foreground">
          This page renders every greenfield escape-the-dungeon project&apos;s current{" "}
          <code className="rounded bg-card/60 px-1 py-0.5 text-sm">REQUIREMENTS.xml</code>: the v4
          pressure-oriented base plus the v5 addendum with 21 playtest-driven additions. Each
          requirement has a stable anchor so other pages can link to individual rules (e.g.{" "}
          <Link href="#R-v5.13" className="text-accent underline decoration-dotted">
            R-v5.13
          </Link>{" "}
          for the rule-based-combat choice).
        </p>
        <p className="mt-4 max-w-3xl text-sm text-muted-foreground">
          All three templates carry the same spec — the difference between the three projects is
          workflow (GAD / Bare / Emergent), not requirements. Full version history:{" "}
          <Link href="#history" className="text-accent underline decoration-dotted">
            see timeline below
          </Link>{" "}
          or read the{" "}
          <a
            href={`${REPO}/blob/main/evals/REQUIREMENTS-VERSIONS.md`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent underline decoration-dotted"
          >
            REQUIREMENTS-VERSIONS.md narrative
          </a>{" "}
          on GitHub.
        </p>

        <div className="mt-8 flex flex-wrap gap-4 text-sm text-muted-foreground">
          <div>
            <span className="text-2xl font-semibold tabular-nums text-foreground">
              {CURRENT_REQUIREMENTS.length}
            </span>{" "}
            template files
          </div>
          <div>
            <span className="text-2xl font-semibold tabular-nums text-foreground">
              {REQUIREMENTS_HISTORY.length}
            </span>{" "}
            versions in history
          </div>
        </div>
      </div>
    </section>
  );
}
