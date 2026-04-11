export function QuestionsEmptyState() {
  return (
    <section className="border-b border-border/60">
      <div className="section-shell">
        <p className="text-muted-foreground">
          No open questions yet. Add entries to <code>data/open-questions.json</code> and re-run
          prebuild.
        </p>
      </div>
    </section>
  );
}
