import Nav from "@/components/landing/Nav";
import Hero from "@/components/landing/Hero";
import WhatItIs from "@/components/landing/WhatItIs";
import Lineage from "@/components/landing/Lineage";
import Framework from "@/components/landing/Framework";
import Results from "@/components/landing/Results";
import Playable from "@/components/landing/Playable";
import Templates from "@/components/landing/Templates";
import RunIt from "@/components/landing/RunIt";
import Footer from "@/components/landing/Footer";

export default function Page() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <Nav />
      <Hero />
      <WhatItIs />
      <Lineage />
      <Framework />
      <Results />
      <Playable />
      <Templates />
      <RunIt />
      <Footer />
    </main>
  );
}
