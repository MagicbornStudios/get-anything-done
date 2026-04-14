import { SiteProse, SiteSectionHeading } from "@/components/site";

/** Shared copy block: v4 pressure framing (used on Results landing strip and Round Results default state). */
export function Round4PressureCallout() {
  return (
    <div className="mt-12 rounded-2xl border border-accent/40 bg-accent/5 p-6 md:p-8">
      <SiteSectionHeading
        kicker="What we changed for round 4"
        as="h3"
        title="Pressure, not features. Ingenuity, not checklists."
        titleClassName="mt-1 max-w-3xl text-2xl font-semibold tracking-tight md:text-3xl"
      />
      <SiteProse size="md" className="mt-4">
        v4 of the requirements stops asking the agent to build a list of systems and starts asking
        whether the resulting game <em>requires</em> player ingenuity to progress. Authored dungeon,
        floors with mechanical constraints that punish brute-force play, a forge that&apos;s tied to
        the encounter design instead of being a side ornament. The same three workflows will run
        round 4 against v4 to test whether the freedom hypothesis holds when the spec is harder to
        game.
      </SiteProse>
    </div>
  );
}

