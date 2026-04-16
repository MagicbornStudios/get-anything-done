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

const VC_IMAGE_FILE_TYPES: Array<{ description: string; accept: Record<string, string[]> }> = [
  {
    description: "Images",
    accept: {
      "image/*": [".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".avif"],
    },
  },
];

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

/** Resolve or pick the VC export directory; mutates `dirRef` when a new folder is chosen. No persistence — caller may persist. */
export async function resolveVcExportDirectory(dirRef: {
  current: FileSystemDirectoryHandle | null;
}): Promise<FileSystemDirectoryHandle | null> {
  const cur = dirRef.current;
  if (cur) {
    const ok = await ensureVcDirectoryWritable(cur);
    if (!ok) {
      dirRef.current = null;
      return null;
    }
    return cur;
  }
  const dir = await pickVcScreenshotFolder();
  if (!dir) return null;
  dirRef.current = dir;
  return dir;
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

/**
 * Opens the native file picker (lists image files; `startIn` is the VC export folder).
 * Use this instead of `showDirectoryPicker` when you need to see and select image file(s).
 * Returns display paths `folderName/file.png`; `null` if API missing or dialog error; `[]` if cancelled/empty.
 */
export async function pickImagesFromSessionFolder(
  dir: FileSystemDirectoryHandle,
  options?: { multiple?: boolean },
): Promise<string[] | null> {
  const w = getWindowWithPicker();
  if (!w?.showOpenFilePicker) return null;
  const multiple = options?.multiple !== false;
  try {
    const handles = await w.showOpenFilePicker({
      multiple,
      startIn: dir,
      types: VC_IMAGE_FILE_TYPES,
    });
    if (!handles?.length) return [];
    const out: string[] = [];
    for (const fh of handles) {
      const file = await fh.getFile();
      out.push(`${dir.name}/${file.name}`);
    }
    return out;
  } catch {
    return null;
  }
}

/** @deprecated Prefer `pickImagesFromSessionFolder` with `multiple: false`. */
export async function pickImageFromSessionFolder(
  dir: FileSystemDirectoryHandle,
): Promise<{ displayPath: string } | null> {
  const paths = await pickImagesFromSessionFolder(dir, { multiple: false });
  if (paths == null) return null;
  const first = paths[0];
  return first ? { displayPath: first } : null;
}
