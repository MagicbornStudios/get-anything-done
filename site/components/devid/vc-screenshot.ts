/**
 * Client-only: capture a DOM subtree as PNG and write to a user-picked folder via the
 * File System Access API. Folder handle is not persisted; callers keep it in memory for the session.
 */

type WindowWithDirPicker = Window &
  typeof globalThis & {
    showDirectoryPicker?: (options?: { mode?: "read" | "readwrite" }) => Promise<FileSystemDirectoryHandle>;
  };

function getWindowWithPicker(): WindowWithDirPicker | null {
  return typeof window !== "undefined" ? (window as WindowWithDirPicker) : null;
}

export function supportsVcLocalFolder(): boolean {
  const w = getWindowWithPicker();
  return Boolean(w && typeof w.showDirectoryPicker === "function");
}

export async function pickVcScreenshotFolder(): Promise<FileSystemDirectoryHandle | null> {
  const w = getWindowWithPicker();
  if (!w?.showDirectoryPicker) return null;
  try {
    return await w.showDirectoryPicker({ mode: "readwrite" });
  } catch {
    return null;
  }
}

export function safeVcFilenamePart(cid: string): string {
  const s = cid.replace(/[^a-zA-Z0-9._-]+/g, "_");
  return s.length > 80 ? s.slice(0, 80) : s;
}

export async function captureElementToPngBlob(el: HTMLElement): Promise<Blob> {
  const { default: html2canvas } = await import("html2canvas");
  const canvas = await html2canvas(el, {
    scale: Math.min(2, typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1),
    useCORS: true,
    logging: false,
    allowTaint: true,
    backgroundColor: null,
  });
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error("PNG encoding failed"));
      },
      "image/png",
      0.92,
    );
  });
}

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
