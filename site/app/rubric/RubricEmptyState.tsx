export function RubricEmptyState() {
  return (
    <section className="border-b border-border/60">
      <div className="section-shell">
        <p className="text-muted-foreground">
          No projects have a human review rubric defined yet. Add a{" "}
          <code>human_review_rubric</code> block to a project&apos;s <code>gad.json</code> and
          regenerate site data.
        </p>
      </div>
    </section>
  );
}
