"use client";

import { useCallback, useState } from "react";
import { flushSync } from "react-dom";
import { Camera, FolderOpen, ImagePlus, Images } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DevChromeHoverHint, type VcPanelCorner } from "@/components/devid/DevChromeHoverHint";
import { queryByCid } from "./devid-dom-scan";
import { useDevId } from "./DevIdProvider";
import {
  appendUpdateMediaPaths,
  changeVcExportFolder,
  ensureVcExportFolderForSession,
} from "./vc-export-session";
import {
  readChordFromEvent,
  resolveVcScreenshotChordMode,
  usePanelChord,
  type VcScreenshotChordMode,
} from "./vc-chord";
import {
  captureElementToPngBlob,
  pickImagesFromSessionFolder,
  safeVcFilenamePart,
  supportsVcLocalFolder,
  supportsVcOpenFilePicker,
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
  const {
    vcExportDirHandleRef,
    setUpdatePromptMediaRefs,
    setVcIdentifiedRingsSuppressedForPngCapture,
  } = useDevId();
  const { chord: vcChordModifiers } = usePanelChord();
  const [busy, setBusy] = useState(false);
  const hintMode: VcScreenshotChordMode = resolveVcScreenshotChordMode(vcChordModifiers);

  const appendPaths = useCallback(
    (paths: string[]) => appendUpdateMediaPaths(setUpdatePromptMediaRefs, paths, "screenshot"),
    [setUpdatePromptMediaRefs],
  );

  const onClick = useCallback(
    async (e: React.MouseEvent<HTMLButtonElement>) => {
      const chord = readChordFromEvent(e);

      if (chord.ctrl && chord.shift) {
        if (!supportsVcLocalFolder()) {
          toast.error("Changing the export folder needs a Chromium-based browser (Chrome, Edge, Brave).");
          return;
        }
        setBusy(true);
        try {
          const next = await changeVcExportFolder(vcExportDirHandleRef);
          if (!next) {
            toast.message("Folder dialog cancelled.");
          }
        } catch (err) {
          console.error(err);
          toast.error(err instanceof Error ? err.message : "Could not open folder picker.");
        } finally {
          setBusy(false);
        }
        return;
      }

      if ((chord.ctrl && !chord.shift) || (chord.alt && !chord.ctrl)) {
        if (!firstAltLaneCid) {
          toast.error("Select an Alt-lane target first (panel row or Alt+click a landmark).");
          return;
        }
        if (!supportsVcLocalFolder() || !supportsVcOpenFilePicker()) {
          toast.error("Picking images needs a Chromium browser with folder + file picker support.");
          return;
        }
        setBusy(true);
        try {
          const dir = await ensureVcExportFolderForSession(vcExportDirHandleRef);
          if (!dir) {
            toast.message("Choose an export folder first, or cancel.");
            return;
          }
          const paths = await pickImagesFromSessionFolder(dir, { multiple: true });
          if (paths == null) {
            toast.error("Could not open image file picker.");
            return;
          }
          if (paths.length === 0) {
            toast.message("No image(s) selected.");
            return;
          }
          appendPaths(paths);
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
        const dir = await ensureVcExportFolderForSession(vcExportDirHandleRef);
        if (!dir) {
          toast.message("Folder selection cancelled.");
          return;
        }
        const el = queryByCid(firstAltLaneCid);
        if (!el) {
          toast.error("Could not find that landmark on the page.");
          return;
        }
        let blob: Blob;
        flushSync(() => setVcIdentifiedRingsSuppressedForPngCapture(true));
        try {
          blob = await captureElementToPngBlob(el);
        } finally {
          flushSync(() => setVcIdentifiedRingsSuppressedForPngCapture(false));
        }
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
    [firstAltLaneCid, appendPaths, vcExportDirHandleRef, setVcIdentifiedRingsSuppressedForPngCapture],
  );

  const iconSize = size === "band" ? 11 : 12;
  const label =
    hintMode === "png" ? "PNG" : hintMode === "dir" ? "Dir" : hintMode === "media" ? "Pick" : "Upd";

  const hoverBody =
    hintMode === "png" ? (
      <p>
        Click: capture the first Alt-lane landmark as a PNG (VC rings and flash halos are hidden for that frame so
        the bitmap matches ship chrome). Each landmark reuses{" "}
        <code className="rounded bg-muted px-0.5">vc-&lt;cid&gt;.png</code> (overwrite); Shift+click adds a
        timestamped copy. The export folder is remembered (IndexedDB). While modifiers are held: Ctrl/Cmd+Shift
        = Dir (change save folder); Ctrl/Cmd = Pick (open file dialog in that folder — you can select multiple
        images); Alt = Upd (same multi-image pick). Plain click = PNG.
      </p>
    ) : hintMode === "dir" ? (
      <p>
        Ctrl/Cmd+Shift+click: choose a different VC export folder (directory picker). Saved again for this site.
      </p>
    ) : hintMode === "media" ? (
      <p>
        Ctrl/Cmd+click: open the image file picker starting in your export folder so you can see and select one or
        more images; paths are appended to the update handoff.
      </p>
    ) : (
      <p>
        Alt+click: same as Ctrl — pick one or more images from the export folder for the update handoff (requires
        Alt-lane target selected).
      </p>
    );

  const chromeIcon =
    hintMode === "png" ? (
      <Camera size={iconSize} aria-hidden />
    ) : hintMode === "dir" ? (
      <FolderOpen size={iconSize} aria-hidden />
    ) : hintMode === "media" ? (
      <Images size={iconSize} aria-hidden />
    ) : (
      <ImagePlus size={iconSize} aria-hidden />
    );

  return (
    <DevChromeHoverHint dockCorner={dockCorner} body={hoverBody}>
      <Button
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
            : hintMode === "dir"
              ? "Change VC export folder"
              : hintMode === "media"
                ? "Pick one or more images for update handoff"
                : "Pick image(s) for update handoff (Alt)"
        }
      >
        {chromeIcon}
        {label}
      </Button>
    </DevChromeHoverHint>
  );
}
