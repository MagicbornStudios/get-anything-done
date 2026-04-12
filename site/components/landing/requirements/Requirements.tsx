import { RequirementsDownloads } from "@/components/landing/requirements/RequirementsDownloads";
import { RequirementsHistory } from "@/components/landing/requirements/RequirementsHistory";
import { RequirementsIntro } from "@/components/landing/requirements/RequirementsIntro";
import { SiteSection } from "@/components/site";

export default function Requirements() {
  return (
    <SiteSection id="requirements" className="border-t border-border/60">
      <RequirementsIntro />
      <RequirementsHistory />
      <RequirementsDownloads />
    </SiteSection>
  );
}
