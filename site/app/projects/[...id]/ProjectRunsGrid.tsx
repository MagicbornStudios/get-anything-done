"use client";

import { Identified } from "gad-visual-context";
import type { EvalRunRecord } from "@/lib/eval-data";
import { ProjectRunCard } from "./ProjectRunCard";

export function ProjectRunsGrid({ runs }: { runs: EvalRunRecord[] }) {
  return (
    <Identified as="ProjectRunsGrid" className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
      {runs.map((run) => (
        <ProjectRunCard key={run.version} run={run} />
      ))}
    </Identified>
  );
}
