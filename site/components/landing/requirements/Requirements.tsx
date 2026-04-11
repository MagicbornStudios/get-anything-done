import { RequirementsDownloads } from "@/components/landing/requirements/RequirementsDownloads";
import { RequirementsHistory } from "@/components/landing/requirements/RequirementsHistory";
import { RequirementsIntro } from "@/components/landing/requirements/RequirementsIntro";

export default function Requirements() {
  return (
    <section id="requirements" className="border-t border-border/60">
      <div className="section-shell">
        <RequirementsIntro />
        <RequirementsHistory />
        <RequirementsDownloads />
      </div>
    </section>
  );
}
