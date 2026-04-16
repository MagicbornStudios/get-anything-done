"use client";

import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { toast } from "sonner";
import { persistVcExportDirectoryHandle } from "./vc-export-persist";
import {
  ensureVcDirectoryWritable,
  pickVcScreenshotFolder,
  resolveVcExportDirectory,
} from "./vc-screenshot";
import { mergeUniqueMediaPaths } from "./vcMediaPaths";

const TOAST_PERMISSION =
  "Export folder needs permission again, or clear it with Ctrl+Shift+click Delete on the panel.";

/**
 * Writable export folder for PNG / media: revalidates handle, or opens folder picker,
 * persists first pick, toast on success.
 */
export async function ensureVcExportFolderForSession(
  dirRef: MutableRefObject<FileSystemDirectoryHandle | null>,
): Promise<FileSystemDirectoryHandle | null> {
  const cur = dirRef.current;
  if (cur) {
    const ok = await ensureVcDirectoryWritable(cur);
    if (!ok) {
      toast.error(TOAST_PERMISSION);
      dirRef.current = null;
      return null;
    }
    return cur;
  }
  const dir = await pickVcScreenshotFolder();
  if (!dir) return null;
  dirRef.current = dir;
  try {
    await persistVcExportDirectoryHandle(dir);
  } catch {
    /* ignore */
  }
  toast.success("Export folder set (remembered for this site in this browser).");
  return dir;
}

/**
 * Panel “Alt+Update” flow: resolve folder (no toast if already had dir), persist only on first grant.
 */
export async function resolveVcExportForPanelMediaPick(
  dirRef: MutableRefObject<FileSystemDirectoryHandle | null>,
): Promise<FileSystemDirectoryHandle | null> {
  const hadExportDir = Boolean(dirRef.current);
  const dir = await resolveVcExportDirectory(dirRef);
  if (!dir) return null;
  if (!hadExportDir) {
    try {
      await persistVcExportDirectoryHandle(dir);
      toast.success("Export folder set (remembered for this site).");
    } catch {
      /* ignore */
    }
  }
  return dir;
}

/** Ctrl+Shift screenshot: pick new folder, assign ref, persist, toast. */
export async function changeVcExportFolder(
  dirRef: MutableRefObject<FileSystemDirectoryHandle | null>,
): Promise<FileSystemDirectoryHandle | null> {
  const next = await pickVcScreenshotFolder(dirRef.current);
  if (!next) return null;
  dirRef.current = next;
  try {
    await persistVcExportDirectoryHandle(next);
  } catch {
    /* ignore */
  }
  toast.success("Export folder updated (saved for this site).");
  return next;
}

export function appendUpdateMediaPaths(
  setUpdatePromptMediaRefs: Dispatch<SetStateAction<string[]>>,
  paths: string[],
  toastLabel: "screenshot" | "panel" = "screenshot",
): void {
  if (paths.length === 0) return;
  setUpdatePromptMediaRefs((prev) => mergeUniqueMediaPaths(prev, paths));
  if (toastLabel === "panel") return;
  toast.success(
    paths.length === 1
      ? `Added to update handoff media: ${paths[0]}`
      : `Added ${paths.length} image path(s) to update handoff media.`,
  );
}
