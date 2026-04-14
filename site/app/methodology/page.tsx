import { MarketingShell } from "@/components/site";
import { MethodologyPageBody } from "@/app/methodology/MethodologyPageBody";
import { pickWorkedExamples } from "@/app/methodology/methodology-shared";

export const metadata = {
  title: "Methodology — how we score GAD evals",
  description:
    "Composite formulas, per-project weights, low-score caps, gate logic, data pipeline, and worked examples — the numbers behind the site.",
};

export default function MethodologyPage() {
  const worked = pickWorkedExamples();

  return (
    <MarketingShell>
      <MethodologyPageBody worked={worked} />
    </MarketingShell>
  );
}
