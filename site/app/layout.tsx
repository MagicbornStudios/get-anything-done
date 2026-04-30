import type { Metadata } from "next";
import "./globals.css";
import { ClientDebugShell } from "@/components/debug/ClientDebugShell";
import { DevIdProvider } from "gad-visual-context";
import { KeyboardShortcutsProvider } from "gad-visual-context";
import { GlobalScrollbarBehavior } from "@/components/layout/GlobalScrollbarBehavior";
import { ProjectProvider } from "@/components/ProjectContext";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "Get Anything Done — measurable AI agent workflows",
  description:
    "GAD is an evolutionary framework for AI coding agents — species, generations, and measurable pressure. We measure whether structured workflows actually beat unstructured ones with reproducible benchmarks, not vibes.",
  metadataBase: new URL("https://get-anything-done.vercel.app"),
  openGraph: {
    title: "Get Anything Done",
    description:
      "Evolutionary framework for AI coding agents. Species, generations, measurable pressure. Measured, not vibed.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>
        <GlobalScrollbarBehavior />
        <DevIdProvider>
          <ProjectProvider>
            <ClientDebugShell>{children}</ClientDebugShell>
          </ProjectProvider>
          <KeyboardShortcutsProvider />
          <Toaster />
        </DevIdProvider>
      </body>
    </html>
  );
}
