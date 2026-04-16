/**
 * Client-only: capture a DOM subtree as PNG and write to a user-picked folder via the
 * File System Access API. Folder handle is not persisted; callers keep it in memory for the session.
 */

type WindowWithDirPicker = Window &
  typeof globalThis & {
    showDirectoryPicker?: (options?: { mode?: "read" | "readwrite" }) => Promise<FileSystemDirectoryHandle>;
    showOpenFilePicker?: (options?: {
      multiple?: boolean;
      startIn?: FileSystemDirectoryHandle;
      types?: Array<{ description?: string; accept: Record<string, string[]> }>;
    }) => Promise<FileSystemFileHandle[]>;
  };

function getWindowWithPicker(): WindowWithDirPicker | null {
  return typeof window !== "undefined" ? (window as WindowWithDirPicker) : null;
}

export function supportsVcLocalFolder(): boolean {
  const w = getWindowWithPicker();
  return Boolean(w && typeof w.showDirectoryPicker === "function");
}

export function supportsVcOpenFilePicker(): boolean {
  const w = getWindowWithPicker();
  return Boolean(w && typeof w.showOpenFilePicker === "function");
}

export async function ensureVcDirectoryWritable(handle: FileSystemDirectoryHandle): Promise<boolean> {
  try {
    let perm = await handle.queryPermission({ mode: "readwrite" });
    if (perm === "granted") return true;
    perm = await handle.requestPermission({ mode: "readwrite" });
    return perm === "granted";
  } catch {
    return false;
  }
}

export async function pickVcScreenshotFolder(
  startIn?: FileSystemDirectoryHandle | null,
): Promise<FileSystemDirectoryHandle | null> {
  const w = getWindowWithPicker();
  if (!w?.showDirectoryPicker) return null;
  try {
    return await w.showDirectoryPicker({
      mode: "readwrite",
      id: "gad-vc-export",
      ...(startIn ? { startIn } : {}),
    });
  } catch {
    return null;
  }
}

export function safeVcFilenamePart(cid: string): string {
  const s = cid.replace(/[^a-zA-Z0-9._-]+/g, "_");
  return s.length > 80 ? s.slice(0, 80) : s;
}

export async function captureElementToPngBlob(el: HTMLElement): Promise<Blob> {
  /**
   * `html2canvas` parses stylesheet colors and throws on Tailwind v4 `lab()` tokens.
   * `modern-screenshot` rasterizes via a path that tolerates modern color functions.
   */
  const { domToBlob } = await import("modern-screenshot");
  const scale = Math.min(2, typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1);
  const blob = await domToBlob(el, { scale });
  if (!blob) throw new Error("Screenshot produced empty image");
  return blob;
}

/** Writes PNG bytes; same `filename` replaces the previous file (truncate-on-write). */
export async function writePngToSessionFolder(
  dir: FileSystemDirectoryHandle,
  filename: string,
  blob: Blob,
): Promise<void> {
  const fileHandle = await dir.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();
}

/** Picks one image inside `dir` (same session export folder). Returns a display path, not a host filesystem path. */
export async function pickImageFromSessionFolder(
  dir: FileSystemDirectoryHandle,
): Promise<{ displayPath: string } | null> {
  const w = getWindowWithPicker();
  if (!w?.showOpenFilePicker) return null;
  try {
    const handles = await w.showOpenFilePicker({
      multiple: false,
      startIn: dir,
      types: [
        {
          description: "Images",
          accept: {
            "image/*": [".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".avif"],
          },
        },
      ],
    });
    const fh = handles[0];
    if (!fh) return null;
    const file = await fh.getFile();
    const displayPath = `${dir.name}/${file.name}`;
    return { displayPath };
  } catch {
    return null;
  }
}
