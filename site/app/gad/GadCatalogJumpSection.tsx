import Link from "next/link";
import { ArrowRight, Bot, Package, Sparkles } from "lucide-react";
import { Identified } from "@/components/devid/Identified";
import { SiteSection, SiteSectionHeading } from "@/components/site";
import { AGENTS, SKILLS, TEMPLATES } from "@/lib/catalog.generated";

const OFFICIAL_SKILLS = SKILLS.filter((skill) => skill.source === "sdk");

const JUMP_ITEMS = [
  { label: "Skills", count: OFFICIAL_SKILLS.length, href: "/#catalog", icon: Sparkles },
  { label: "Subagents", count: AGENTS.length, href: "/#catalog", icon: Bot },
  { label: "Templates", count: TEMPLATES.length, href: "/#templates", icon: Package },
] as const;

export function GadCatalogJumpSection() {
  return (
    <SiteSection tone="muted">
      <Identified as="GadCatalogJumpHeading">
        <SiteSectionHeading kicker="Jump to" title="Explore the catalog" preset="section" />
      </Identified>
      <div className="mt-8 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {JUMP_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <Identified key={item.label} as={`GadCatalogJumpTile-${item.label.replace(/\s+/g, "")}`}>
            <Link
              href={item.href}
              className="group rounded-2xl border border-border/70 bg-card/40 p-6 transition-colors hover:border-accent/60"
            >
              <Icon size={20} className="mb-3 text-accent" aria-hidden />
              <p className="text-2xl font-semibold tabular-nums text-foreground">{item.count}</p>
              <p className="mt-1 text-sm text-muted-foreground">{item.label}</p>
              <p className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-accent">
                Explore
                <ArrowRight size={11} aria-hidden className="transition-transform group-hover:translate-x-0.5" />
              </p>
            </Link>
            </Identified>
          );
        })}
      </div>
    </SiteSection>
  );
}
