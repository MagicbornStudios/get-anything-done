import type { ReactNode } from "react";
import Nav from "@/components/landing/nav/Nav";
import Footer from "@/components/landing/Footer";

export function MarketingShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <Nav />
      {children}
      <Footer />
    </main>
  );
}
