import { Ref } from "@/components/refs/Ref";
import { Identified } from "@/components/devid/Identified";
import { SiteProse, SiteSection, SiteSectionHeading } from "@/components/site";

export default function StandardsNameCollisionSection() {
  return (
    <SiteSection cid="standards-name-collision-section-site-section">
      <Identified as="StandardsNameCollisionSection">
      <SiteSectionHeading kicker="Name collision handling" />
      <SiteProse size="sm" className="mt-4">
        Per the standard, when two skills share the same{" "}
        <code className="rounded bg-card/60 px-1 py-0.5 text-xs">name</code> field:{" "}
        <strong className="text-foreground">project-level skills override user-level skills.</strong>{" "}
        Within the same scope, first-found or last-found is acceptable but the choice must be
        consistent and collisions must be logged so the user knows a skill was shadowed. GAD adds a
        stronger requirement per <Ref id="gad-81" />: skills must answer &quot;what can this do that
        no other skill can?&quot; — if the answer is unclear, they are merge candidates rather than
        collisions. A skill-collision detection scan is queued as task 22-49 to catch overlapping
        trigger descriptions before they manifest as ambiguous routing at runtime.
      </SiteProse>
      </Identified>
    </SiteSection>
  );
}

