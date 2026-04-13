import { Identified } from "@/components/devid/Identified";
import { MarketingShell } from "@/components/site";
import { SecurityHeroSection } from "./SecurityHeroSection";
import { SecurityOperationalStatusSection } from "./SecurityOperationalStatusSection";
import { SecurityAttackSurfacesSection } from "./SecurityAttackSurfacesSection";
import { SecurityMitigationsSection } from "./SecurityMitigationsSection";
import { SecurityCertificationSection } from "./SecurityCertificationSection";
import { SecurityFurtherReadingSection } from "./SecurityFurtherReadingSection";

export const metadata = {
  title: "Security - GAD",
  description:
    "Operational security telemetry, coding-agent attack surfaces, and where GAD's eval-driven certification model is headed.",
};

export default function SecurityPage() {
  return (
    <MarketingShell>
      <Identified as="SecurityHeroSection">
        <SecurityHeroSection />
      </Identified>
      <Identified as="SecurityOperationalStatusSection">
        <SecurityOperationalStatusSection />
      </Identified>
      <Identified as="SecurityAttackSurfacesSection">
        <SecurityAttackSurfacesSection />
      </Identified>
      <Identified as="SecurityMitigationsSection">
        <SecurityMitigationsSection />
      </Identified>
      <Identified as="SecurityCertificationSection">
        <SecurityCertificationSection />
      </Identified>
      <Identified as="SecurityFurtherReadingSection">
        <SecurityFurtherReadingSection />
      </Identified>
    </MarketingShell>
  );
}
