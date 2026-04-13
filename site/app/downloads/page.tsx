import { MarketingShell } from "@/components/site";
import Templates from "@/components/landing/templates/Templates";

export const metadata = {
  title: "Downloads — GAD",
  description: "Eval templates and planning packs — everything you need to run GAD on your own.",
};

export default function DownloadsPage() {
  return (
    <MarketingShell>
      <Templates />
    </MarketingShell>
  );
}
