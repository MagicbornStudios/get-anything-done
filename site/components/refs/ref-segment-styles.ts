export const REF_KIND_TINT: Record<string, string> = {
  decision: "border-accent/40 bg-accent/5 text-accent hover:bg-accent/15",
  task: "border-sky-500/40 bg-sky-500/5 text-sky-300 hover:bg-sky-500/15",
  phase: "border-purple-500/40 bg-purple-500/5 text-purple-300 hover:bg-purple-500/15",
  requirement: "border-amber-500/40 bg-amber-500/5 text-amber-300 hover:bg-amber-500/15",
  question: "border-emerald-500/40 bg-emerald-500/5 text-emerald-300 hover:bg-emerald-500/15",
  bug: "border-rose-500/40 bg-rose-500/5 text-rose-300 hover:bg-rose-500/15",
  unknown: "border-zinc-500/40 bg-zinc-500/5 text-zinc-400",
};

/** Color per segment type for the color-coded ID display */
export const REF_SEGMENT_COLORS: Record<string, string> = {
  namespace: "text-accent",
  D: "text-amber-400",
  T: "text-sky-400",
  P: "text-purple-400",
  R: "text-emerald-400",
  B: "text-rose-400",
  S: "text-cyan-400",
  Q: "text-teal-400",
  number: "text-foreground",
};
