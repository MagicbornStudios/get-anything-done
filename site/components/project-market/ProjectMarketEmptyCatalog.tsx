"use client";

export function ProjectMarketEmptyCatalog() {
  return (
    <div className="py-12 text-center">
      <p className="text-lg font-semibold text-muted-foreground">No projects match your filters</p>
      <p className="mt-2 text-sm text-muted-foreground/70">Try adjusting your search or filters.</p>
    </div>
  );
}
