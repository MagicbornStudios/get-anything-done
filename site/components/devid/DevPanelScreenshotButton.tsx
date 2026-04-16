"use client";

import { useCallback, useRef, useState } from "react";
import { Camera, FolderOpen } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DevChromeHoverHint, type VcPanelCorner } from "@/components/devid/DevChromeHoverHint";
import { queryByCid } from "./devid-dom-scan";
import { useDevId } from "./DevIdProvider";
import { persistVcExportDirectoryHandle } from "./vc-export-persist";
import {
  captureElementToPngBlob,
  ensureVcDirectoryWritable,
  pickImageFromSessionFolder,
  pickVcScreenshotFolder,
  safeVcFilenamePart,
  supportsVcLocalFolder,
  supportsVcOpenFilePicker,
  writePngToSessionFolder,
} from "./vc-screenshot";
import { useVcChordPreview } from "./useVcChordPreview";

type HintMode = "png" | "open-export" | "upd-media";

function resolveHintMode(mod: { alt: boolean; ctrl: boolean }): HintMode {
  if (mod.ctrl && !mod.alt) return "open-export";
  if (mod.alt && !mod.ctrl) return "upd-media";
  return "png";
}

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
  const { vcExportDirHandleRef, setUpdatePromptMediaRefs } = useDevId();
  const [busy, setBusy] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const chromeHintScopeIdRef = useRef<string | null>(null);
  if (!chromeHintScopeIdRef.current) {
    chromeHintScopeIdRef.current = `vcch-${Math.random().toString(36).slice(2, 11)}`;
  }

  const mod = useVcChordPreview(buttonRef, chromeHintScopeIdRef.current);
  const hintMode = resolveHintMode(mod);

  const ensureSessionDir = useCallback(async () => {
    const cur = vcExportDirHandleRef.current;
    if (cur) {
      const ok = await ensureVcDirectoryWritable(cur);
      if (!ok) {
        toast.error(
          "Export folder needs permission again, or clear it with Ctrl+click Delete on the panel.",
        );
        vcExportDirHandleRef.current = null;
        return null;
      }
      return cur;
    }
    const dir = await pickVcScreenshotFolder();
    if (!dir) return null;
    vcExportDirHandleRef.current = dir;
    try {
      await persistVcExportDirectoryHandle(dir);
    } catch {
      // still usable this session
    }
    toast.success("Export folder set (remembered for this site in this browser).");
    return dir;
  }, [vcExportDirHandleRef]);

  const appendUpdateMediaPath = useCallback(
    (displayPath: string) => {
      setUpdatePromptMediaRefs((prev) => (prev.includes(displayPath) ? prev : [...prev, displayPath]));
      toast.success(`Added to update handoff media: ${displayPath}`);
    },
    [setUpdatePromptMediaRefs],
  );

  const onClick = useCallback(
    async (e: React.MouseEvent<HTMLButtonElement>) => {
      const ctrl = e.ctrlKey || e.metaKey;
      const alt = e.altKey;
      const openExport = (ctrl && !alt) || (ctrl && alt);
      const mediaUpdate = alt && !ctrl;

      if (openExport) {
        if (!supportsVcLocalFolder()) {
          toast.error("Opening a folder needs a Chromium-based browser (Chrome, Edge, Brave).");
          return;
        }
        setBusy(true);
        try {
          const next = await pickVcScreenshotFolder(vcExportDirHandleRef.current);
          if (!next) {
            toast.message("Folder dialog cancelled.");
            return;
          }
          vcExportDirHandleRef.current = next;
          try {
            await persistVcExportDirectoryHandle(next);
          } catch {
            /* ignore persist failure */
          }
          toast.success("Export folder updated (saved for this site).");
        } catch (err) {
          console.error(err);
          toast.error(err instanceof Error ? err.message : "Could not open folder picker.");
        } finally {
          setBusy(false);
        }
        return;
      }

      if (mediaUpdate) {
        if (!firstAltLaneCid) {
          toast.error("Select an Alt-lane target first (panel row or Alt+click a landmark).");
          return;
        }
        if (!supportsVcLocalFolder() || !supportsVcOpenFilePicker()) {
          toast.error("Picking media needs a Chromium browser with folder + file picker support.");
          return;
        }
        setBusy(true);
        try {
          const dir = await ensureSessionDir();
          if (!dir) {
            toast.message("Choose an export folder first, or cancel.");
            return;
          }
          const picked = await pickImageFromSessionFolder(dir);
          if (!picked) {
            toast.message("No image selected.");
            return;
          }
          appendUpdateMediaPath(picked.displayPath);
        } catch (err) {
          console.error(err);
          toast.error(err instanceof Error ? err.message : "Media pick failed.");
        } finally {
          setBusy(false);
        }
        return;
      }

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
        const dir = await ensureSessionDir();
        if (!dir) {
          toast.message("Folder selection cancelled.");
          return;
        }
        const el = queryByCid(firstAltLaneCid);
        if (!el) {
          toast.error("Could not find that landmark on the page.");
          return;
        }
        const blob = await captureElementToPngBlob(el);
        const base = `vc-${safeVcFilenamePart(firstAltLaneCid)}`;
        const name = e.shiftKey ? `${base}-${Date.now()}.png` : `${base}.png`;
        await writePngToSessionFolder(dir, name, blob);
        toast.success(e.shiftKey ? `Saved ${name}` : `Updated ${name}`);
      } catch (err) {
        console.error(err);
        toast.error(err instanceof Error ? err.message : "Screenshot failed.");
      } finally {
        setBusy(false);
      }
    },
    [firstAltLaneCid, ensureSessionDir, appendUpdateMediaPath, vcExportDirHandleRef],
  );

  const iconSize = size === "band" ? 11 : 12;
  const isFolder = hintMode !== "png";
  const label = hintMode === "png" ? "PNG" : hintMode === "open-export" ? "Open" : "Upd";

  const hoverBody =
    hintMode === "png" ? (
      <p>
        Click: capture the first Alt-lane landmark as a PNG. Each landmark reuses{" "}
        <code className="rounded bg-muted px-0.5">vc-&lt;cid&gt;.png</code> (overwrite); Shift+click adds a
        timestamped copy. The export folder is remembered for this site in this browser (IndexedDB). Ctrl/Cmd
        + hover: Open — re-open the folder picker starting from the saved folder. Alt+hover: pick an image for
        the update handoff.
      </p>
    ) : hintMode === "open-export" ? (
      <p>
        Ctrl/Cmd+click: open the system folder dialog starting from your saved VC export folder so you can browse
        files or switch to another folder (choice is saved again).
      </p>
    ) : (
      <p>
        Alt+click: pick an image inside the export folder; its path is appended to the update handoff. Requires
        a saved export folder (PNG once, or Open with Ctrl).
      </p>
    );

  return (
    <DevChromeHoverHint
      dockCorner={dockCorner}
      body={hoverBody}
      chromeHintScopeId={chromeHintScopeIdRef.current}
    >
      <Button
        ref={buttonRef}
        type="button"
        variant="outline"
        size="sm"
        onClick={onClick}
        disabled={busy}
        className={
          size === "band"
            ? "h-6 gap-1 px-1.5 text-[10px]"
            : "h-6 gap-1 px-2 text-[10px] font-semibold uppercase tracking-wide"
        }
        aria-busy={busy}
        aria-label={
          hintMode === "png"
            ? "Save PNG screenshot to VC export folder"
            : hintMode === "open-export"
              ? "Open or change VC export folder"
              : "Pick image for update handoff media paths"
        }
      >
        {isFolder ? (
          <FolderOpen size={iconSize} aria-hidden />
        ) : (
          <Camera size={iconSize} aria-hidden />
        )}
        {label}
      </Button>
    </DevChromeHoverHint>
  );
}
