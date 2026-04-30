import { Activity, Beaker, FileText, PackageCheck, Scissors } from "lucide-react";
import { Identified } from "gad-visual-context";
import {
  LandingEvolutionLoopStepCard,
  type LoopStep,
} from "./LandingEvolutionLoopStepCard";

const LOOP_STEPS: LoopStep[] = [
  {
    key: "detect",
    kicker: "1. Detect",
    title: "Pressure surfaces a pattern",
    blurb:
      "Self-eval walks the task registry and decisions and flags any phase that clears the threshold from the P = T + Cₐwc + Clwl + D·wd + (D/T)·wr formula.",
    artifact: ".planning/self-eval.json",
    icon: Activity,
    command: "gad self-eval",
  },
  {
    key: "candidate",
    kicker: "2. Candidate",
    title: "Raw phase dump, not a curated brief",
    blurb:
      "Each high-pressure phase gets a CANDIDATE.md — tasks, decisions, crosscuts, file refs. No pre-digestion; the drafter decides what matters.",
    artifact: ".planning/candidates/<slug>/CANDIDATE.md",
    icon: FileText,
  },
  {
    key: "proto",
    kicker: "3. Draft",
    title: "Proto-skill lands in a lock-marked bundle",
    blurb:
      "create-proto-skill writes PROVENANCE.md first, then workflow.md, then a sub-200-line SKILL.md. Crash-resumable, one slug at a time.",
    artifact: ".planning/proto-skills/<slug>/SKILL.md",
    icon: Beaker,
    command: "gad evolution evolve",
  },
  {
    key: "install",
    kicker: "4. Install",
    title: "Promote or equip the skill",
    blurb:
      "Validator adds advisory notes. You promote into skills/, merge into a sibling, or equip per-project with gad skill promote.",
    artifact: "skills/<skill-name>/SKILL.md",
    icon: PackageCheck,
    command: "gad evolution install <slug>",
  },
  {
    key: "shed",
    kicker: "5. Shed",
    title: "Drop what the next generation won't need",
    blurb:
      "Epigenetic skills build once and uninstall. Species DNA tracks active / epigenetic / shed so the load stays honest (decision gad-221).",
    artifact: "species.json activeSkills ⇢ shedSkills",
    icon: Scissors,
  },
];

/**
 * Grid of five loop-step cards. `Identified as="LandingEvolutionLoopSteps"`
 * is the band-level grep target for "the strip of step cards as a whole".
 */
export function LandingEvolutionLoopSteps() {
  return (
    <Identified
      as="LandingEvolutionLoopSteps"
      className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-5 lg:gap-6"
    >
      {LOOP_STEPS.map((step, index) => (
        <LandingEvolutionLoopStepCard
          key={step.key}
          step={step}
          index={index}
          total={LOOP_STEPS.length}
        />
      ))}
    </Identified>
  );
}
