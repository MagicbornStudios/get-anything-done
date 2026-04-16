"use client";

import { useCallback, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type DevicePreset = "desktop" | "tablet" | "mobile";

const DEVICE_WIDTHS: Record<DevicePreset, number | null> = {
  desktop: null, // full width
  tablet: 768,
  mobile: 375,
};

const DEVICE_LABELS: Record<DevicePreset, string> = {
  desktop: "Desktop",
  tablet: "Tablet",
  mobile: "Mobile",
};

interface PreviewFrameProps {
  src: string;
  title: string;
  onClose?: () => void;
}

export function PreviewFrame({ src, title, onClose }: PreviewFrameProps) {
  const [device, setDevice] = useState<DevicePreset>("desktop");
  const [loadError, setLoadError] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handleReload = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    setLoadError(false);
    // Force reload by re-setting src
    const currentSrc = iframe.src;
    iframe.src = "about:blank";
    requestAnimationFrame(() => {
      iframe.src = currentSrc;
    });
  }, []);

  const handleOpenNewTab = useCallback(() => {
    window.open(src, "_blank", "noopener");
  }, [src]);

  const width = DEVICE_WIDTHS[device];

  // Extract species/version from URL for fallback message
  const fallbackLabel = title || src;

  return (
    <div
      data-cid="project-editor-preview-frame-site-section"
      className="flex h-full flex-col"
    >
      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b border-border/40 px-3 py-1.5 shrink-0">
        {/* Device selector */}
        <div className="flex items-center gap-0.5">
          {(Object.keys(DEVICE_WIDTHS) as DevicePreset[]).map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setDevice(preset)}
              className={cn(
                "px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors",
                device === preset
                  ? "bg-accent/15 text-accent"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {DEVICE_LABELS[preset]}
            </button>
          ))}
        </div>

        <span className="w-px h-4 bg-border/40" />

        {/* Reload */}
        <button
          type="button"
          onClick={handleReload}
          className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          title="Reload preview"
        >
          Reload
        </button>

        {/* Open in new tab */}
        <button
          type="button"
          onClick={handleOpenNewTab}
          className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          title="Open in new tab"
        >
          New Tab
        </button>

        {/* URL display */}
        <input
          type="text"
          readOnly
          value={src}
          className="flex-1 min-w-0 bg-transparent text-[10px] text-muted-foreground/60 outline-none border-none px-1"
          title={src}
        />

        {/* Close button */}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="ml-auto text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            Close
          </button>
        )}
      </div>

      {/* Frame area */}
      <div className="flex-1 overflow-hidden flex items-start justify-center bg-background/50">
        {loadError ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-6">
            <span className="text-sm font-medium text-muted-foreground">
              No build available
            </span>
            <span className="text-xs text-muted-foreground/60">
              {fallbackLabel}
            </span>
            <span className="text-[10px] text-muted-foreground/40 mt-1">
              Run the eval to produce a preserved build, then reload.
            </span>
          </div>
        ) : (
          <div
            className={cn(
              "h-full transition-[width] duration-200",
              width ? "border-x border-border/30" : "",
            )}
            style={{ width: width ? `${width}px` : "100%", maxWidth: "100%" }}
          >
            <iframe
              ref={iframeRef}
              src={src}
              title={title}
              className="h-full w-full border-0"
              sandbox="allow-scripts allow-same-origin"
              onError={() => setLoadError(true)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
