import type { Metadata } from "next";
import { MarketingShell } from "@/components/site";
import ProjectMarket from "@/components/project-market/ProjectMarket";

export const metadata: Metadata = {
  title: "Project Market - GAD",
  description:
    "Browse all eval projects: games, video, software, and tooling. Play any scored build in your browser.",
};

export default function ProjectMarketPage() {
  return (
    <MarketingShell>
      <ProjectMarket />
    </MarketingShell>
  );
}
