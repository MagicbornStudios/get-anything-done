export function HeroLead() {
  return (
    <p className="mt-7 max-w-2xl text-lg leading-8 text-muted-foreground">
      <strong className="font-semibold text-foreground">Get Anything Done</strong> is a
      planning + evaluation framework for AI coding agents. We give agents real
      implementation tasks, measure the{" "}
      <abbr
        className="cursor-help underline decoration-dotted decoration-accent/60 underline-offset-2 hover:decoration-accent hover:text-accent"
        title="Pressure = requirement complexity + ambiguity + constraint density + iteration budget + failure cost. Decision gad-75."
      >
        pressure
      </abbr>{" "}
      the requirements apply, and score the outcome across rounds. The goal isn&apos;t
      to ship a framework for faster software — the goal is to find out what works,
      why, and under what conditions. Every decision lives in the repo.
    </p>
  );
}
