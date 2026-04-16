import { EVAL_TEMPLATES } from "@/lib/eval-data";
import { TemplateEvalCard } from "@/components/landing/templates/TemplateEvalCard";

export function TemplatesEvalSection() {
  return (
    <>
      <h3 className="mt-16 text-2xl font-semibold tracking-tight">Species templates</h3>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
        Each zip contains the <code className="rounded bg-card/60 px-1.5 py-0.5 text-xs">template/</code>{" "}
        directory for one species — REQUIREMENTS.xml, AGENTS.md, source design docs, and
        (for emergent species) the inherited skills library. These are the starting states an
        agent sees before spawning a generation.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {EVAL_TEMPLATES.map((tpl) => (
          <TemplateEvalCard key={tpl.project} template={tpl} />
        ))}
      </div>
    </>
  );
}
