import type { Metadata } from "next";
import "./globals.css";
import { ClientDebugShell } from "@/components/debug/ClientDebugShell";
import { DevIdProvider } from "@/components/devid/DevIdProvider";
import { KeyboardShortcutsProvider } from "@/components/devid/KeyboardShortcuts";

export const metadata: Metadata = {
  title: "Get Anything Done — measurable AI agent workflows",
  description:
    "GAD is a planning + evaluation framework for AI coding agents. We measure whether structured workflows actually beat unstructured ones — with reproducible benchmarks, not vibes.",
  metadataBase: new URL("https://get-anything-done.vercel.app"),
  openGraph: {
    title: "Get Anything Done",
    description:
      "A planning + evaluation framework for AI coding agents. Measured, not vibed.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>
        <DevIdProvider>
          <ClientDebugShell>{children}</ClientDebugShell>
          <KeyboardShortcutsProvider />
        </DevIdProvider>
      </body>
    </html>
  );
}
