"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

type DevicePreset = "desktop" | "tablet" | "mobile";

const DEVICE_WIDTHS: Record<DevicePreset, string> = {
  desktop: "100%",
  tablet: "768px",
  mobile: "375px",
};

function PlayerContent() {
  const params = useSearchParams();
  const src = params.get("src");
  const [device, setDevice] = useState<DevicePreset>("desktop");

  if (!src) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-muted-foreground">
        <p>No source URL provided. Return to the <Link href="/library" className="underline">Library</Link>.</p>
      </div>
    );
  }

  // Derive a title from the URL: /playable/<project>/<species>/<version>/...
  const segments = src.replace(/^\/playable\//, "").replace(/\/index\.html$/, "").split("/");
  const title = segments.join(" / ");

  return (
    <div
      data-cid="library-player-site-section"
      className="flex h-screen flex-col bg-background"
    >
      {/* Toolbar */}
      <div className="flex h-11 shrink-0 items-center gap-3 border-b border-border/50 bg-card/80 px-4">
        <Link
          href="/library"
          className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          &larr; Back to Library
        </Link>
        <span className="hidden text-xs text-foreground sm:inline">{title}</span>
        <div className="ml-auto flex items-center gap-1.5">
          {(["desktop", "tablet", "mobile"] as const).map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setDevice(preset)}
              className={`rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                device === preset
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-card/60 hover:text-foreground"
              }`}
            >
              {preset}
            </button>
          ))}
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-2 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Open in new tab
          </a>
        </div>
      </div>

      {/* Iframe container */}
      <div className="flex flex-1 items-start justify-center overflow-auto bg-black/20 p-0">
        <iframe
          src={src}
          title={title}
          className="h-full border-0 bg-white transition-[width] duration-200"
          style={{ width: DEVICE_WIDTHS[device] }}
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        />
      </div>
    </div>
  );
}

export default function PlayPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-background text-muted-foreground">
          Loading player...
        </div>
      }
    >
      <PlayerContent />
    </Suspense>
  );
}
