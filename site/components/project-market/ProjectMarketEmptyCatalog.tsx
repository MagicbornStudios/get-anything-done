"use client";

import Link from "next/link";

export function ProjectMarketEmptyCatalog() {
  return (
    <div className="py-12 text-center">
      <p className="text-lg font-semibold text-muted-foreground">
        No published projects yet
      </p>
      <p className="mt-2 text-sm text-muted-foreground/70">
        Browse drafts in the editor and publish them to the marketplace.
      </p>
      <Link
        href="/projects/edit"
        className="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Open Project Editor
      </Link>
    </div>
  );
}
