import { RequirementsVersionCard } from "@/components/landing/requirements/RequirementsVersionCard";
import { REQUIREMENTS_HISTORY } from "@/lib/catalog.generated";

export function RequirementsHistory() {
  return (
    <div className="mt-12 space-y-5">
      {REQUIREMENTS_HISTORY.map((v) => (
        <RequirementsVersionCard key={v.version} version={v} />
      ))}
    </div>
  );
}
