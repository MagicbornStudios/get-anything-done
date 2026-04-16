"use client";

import { useCallback, useRef, useState } from "react";
import { Camera } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DevChromeHoverHint, type VcPanelCorner } from "@/components/devid/DevChromeHoverHint";
import { queryByCid } from "./devid-dom-scan";
import {
  captureElementToPngBlob,
  pickVcScreenshotFolder,
  safeVcFilenamePart,
  supportsVcLocalFolder,
  writePngToSessionFolder,
} from "./vc-screenshot";

export function DevPanelScreenshotButton({
  dockCorner,
  firstAltLaneCid,
  size = "section",
}: {
  dockCorner: VcPanelCorner;
  /** First cid in the Alt merge lane, or primary highlight when merge list is empty. */
  firstAltLaneCid: string | null;
  size?: "section" | "band";
}) {
  /** Session-only; cleared when the document unloads. Not written to localStorage. */
  const sessionDirRef = useRef<FileSystemDirectoryHandle | null>(null);
  const [busy, setBusy] = useState(false);

  const onClick = useCallback(async () => {
    if (!firstAltLaneCid) {
      toast.error("Select an Alt-lane target first (panel row or Alt+click a landmark).");
      return;
    }
    if (!supportsVcLocalFolder()) {
      toast.error("Saving to a local folder needs a Chromium-based browser (Chrome, Edge, Brave).");
      return;
    }
    setBusy(true);
    try {
      if (!sessionDirRef.current) {
        const dir = await pickVcScreenshotFolder();
        if (!dir) {
          toast.message("Folder selection cancelled.");
          return;
        }
        sessionDirRef.current = dir;
        toast.success("Screenshot folder set for this visit.");
      }
      const el = queryByCid(firstAltLaneCid);
      if (!el) {
        toast.error("Could not find that landmark on the page.");
        return;
      }
      const blob = await captureElementToPngBlob(el);
      const name = `vc-${safeVcFilenamePart(firstAltLaneCid)}-${Date.now()}.png`;
      await writePngToSessionFolder(sessionDirRef.current, name, blob);
      toast.success(`Saved ${name}`);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Screenshot failed.");
    } finally {
      setBusy(false);
    }
  }, [firstAltLaneCid]);

  const iconSize = size === "band" ? 11 : 12;
  return (
    <DevChromeHoverHint
      dockCorner={dockCorner}
      body={
        <p>
          Capture the first Alt-lane landmark as a PNG into a folder you pick. The first run opens your system
          folder chooser; later captures reuse that folder until you close the tab or leave the site. Nothing is
          stored in localStorage—only this session.
        </p>
      }
    >
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onClick}
        disabled={!firstAltLaneCid || busy}
        className={
          size === "band"
            ? "h-6 gap-1 px-1.5 text-[10px]"
            : "h-6 gap-1 px-2 text-[10px] font-semibold uppercase tracking-wide"
        }
        aria-busy={busy}
      >
        <Camera size={iconSize} aria-hidden />
        PNG
      </Button>
    </DevChromeHoverHint>
  );
}
