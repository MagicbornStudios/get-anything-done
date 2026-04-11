"use client";

export function GlobalSearchEmptyHint() {
  return (
    <div className="p-6 text-center text-sm text-muted-foreground">
      <p className="mb-2">Type to search.</p>
      <p className="text-xs">
        Try{" "}
        <code className="rounded bg-card/60 px-1 py-0.5">gad-68</code>,{" "}
        <code className="rounded bg-card/60 px-1 py-0.5">pressure</code>,{" "}
        <code className="rounded bg-card/60 px-1 py-0.5">CSH</code>, or{" "}
        <code className="rounded bg-card/60 px-1 py-0.5">forge</code>.
      </p>
    </div>
  );
}
