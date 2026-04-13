import type { ReactNode } from "react";
import Nav from "@/components/landing/nav/Nav";
import Footer from "@/components/landing/Footer";
import { Identified } from "@/components/devid/Identified";

export function MarketingShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <Identified as="SiteNav">
        <Nav />
      </Identified>
      {children}
      <Identified as="SiteFooter">
        <Footer />
      </Identified>
    </main>
  );
}
