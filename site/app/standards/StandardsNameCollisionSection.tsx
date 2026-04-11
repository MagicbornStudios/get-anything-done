import { Ref } from "@/components/refs/Ref";

export default function StandardsNameCollisionSection() {
  return (
    <section className="border-b border-border/60">
      <div className="section-shell">
        <p className="section-kicker">Name collision handling</p>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          Per the standard, when two skills share the same{" "}
          <code className="rounded bg-card/60 px-1 py-0.5 text-xs">name</code>{" "}
          field:{" "}
          <strong className="text-foreground">
            project-level skills override user-level skills.
          </strong>{" "}
          Within the same scope, first-found or last-found is acceptable but
          the choice must be consistent and collisions must be logged so the
          user knows a skill was shadowed. GAD adds a stronger requirement
          per <Ref id="gad-81" />: skills must answer &quot;what can this do
          that no other skill can?&quot; — if the answer is unclear, they
          are merge candidates rather than collisions. A skill-collision
          detection scan is queued as task 22-49 to catch overlapping trigger
          descriptions before they manifest as ambiguous routing at runtime.
        </p>
      </div>
    </section>
  );
}
