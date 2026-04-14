import { Identified } from "@/components/devid/Identified";
import { MarketingShell, SiteSection } from "@/components/site";
import featureRequestsData from "@/../data/feature-requests.json";
import { FeatureRequestCard, type FeatureRequestRecord } from "./FeatureRequestCard";
import { FeatureRequestsHeroSection } from "./FeatureRequestsHeroSection";

export const metadata = {
  title: "Feature requests — GAD",
  description: "Public record of feature requests submitted to external projects that GAD depends on.",
};

export default function FeatureRequestsPage() {
  const requests = featureRequestsData.requests as FeatureRequestRecord[];

  return (
    <MarketingShell>
      <Identified as="FeatureRequestsHeroSection">
        <FeatureRequestsHeroSection />
      </Identified>

      <SiteSection cid="page-site-section" tone="muted">
        <Identified as="FeatureRequestsList" className="space-y-4">
          {requests.map((req) => (
            <Identified key={req.id} as={`FeatureRequestCard-${req.id}`}>
              <FeatureRequestCard req={req} />
            </Identified>
          ))}
        </Identified>
      </SiteSection>
    </MarketingShell>
  );
}

