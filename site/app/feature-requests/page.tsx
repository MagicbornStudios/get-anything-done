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
      <FeatureRequestsHeroSection />

      <SiteSection tone="muted">
        <div className="space-y-4">
          {requests.map((req) => (
            <FeatureRequestCard key={req.id} req={req} />
          ))}
        </div>
      </SiteSection>
    </MarketingShell>
  );
}
