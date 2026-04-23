import { HeroBadges } from "@/components/landing/hero/HeroBadges";
import { HeroCalloutCsh } from "@/components/landing/hero/HeroCalloutCsh";
import { HeroCalloutDisclosure } from "@/components/landing/hero/HeroCalloutDisclosure";
import { HeroCtaRow } from "@/components/landing/hero/HeroCtaRow";
import { HeroHeadline } from "@/components/landing/hero/HeroHeadline";
import { HeroLead } from "@/components/landing/hero/HeroLead";
import { HeroStatsGrid } from "@/components/landing/hero/HeroStatsGrid";
import { getHeroStats } from "@/components/landing/hero/hero-stats";
import { Identified } from "@portfolio/visual-context";

/**
 * Hero rewrite 2026-04-09 per decisions gad-74, gad-75, gad-76.
 *
 * New framing: "A system for evaluating and evolving agents through real
 * tasks, measurable pressure, and iteration." Primary audience is coding-agent
 * researchers (A); secondary is indie devs (C) who land via Play and stay
 * for the research transparency. Pressure is the new first-class concept.
 *
 * Primary CTA: Play an eval (B). Priority stack below: Methodology, Findings,
 * Hypothesis, Fork.
 */
export default function Hero() {
  const stats = getHeroStats();

  return (
    <Identified as="LandingHero">
      <div className="section-shell relative pb-10 md:pb-14">
        <div className="max-w-3xl">
        <Identified as="HeroBadges">
          <HeroBadges currentRequirementsVersion={stats.currentRequirementsVersion} />
        </Identified>

        <Identified as="HeroHeadline">
          <HeroHeadline />
        </Identified>

        <Identified as="HeroLead">
          <HeroLead />
        </Identified>

        <Identified as="HeroCtaRow">
          <HeroCtaRow />
        </Identified>

        <Identified as="HeroStatsGrid">
          <HeroStatsGrid
            playableCount={stats.playableCount}
            runsScored={stats.runsScored}
            decisionsLogged={stats.decisionsLogged}
            currentRequirementsVersion={stats.currentRequirementsVersion}
          />
        </Identified>

        <Identified as="HeroCalloutCsh">
          <HeroCalloutCsh />
        </Identified>

        <Identified as="HeroCalloutDisclosure">
          <HeroCalloutDisclosure />
        </Identified>
        </div>
      </div>
    </Identified>
  );
}
