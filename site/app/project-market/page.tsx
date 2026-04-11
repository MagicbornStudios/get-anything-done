import type { Metadata } from "next";
import Nav from "@/components/landing/nav/Nav";
import ProjectMarket from "@/components/project-market/ProjectMarket";
import Footer from "@/components/landing/Footer";

export const metadata: Metadata = {
  title: "Project Market - GAD",
  description:
    "Browse all eval projects: games, video, software, and tooling. Play any scored build in your browser.",
};

export default function ProjectMarketPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <Nav />
      <ProjectMarket />
      <Footer />
    </main>
  );
}
