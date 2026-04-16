import Link from "next/link";

export function HeroCalloutDisclosure() {
  return (
    <p className="mt-4 max-w-2xl rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 text-[13px] leading-6 text-rose-200">
      <strong className="font-semibold text-rose-100">Honest disclosure:</strong>{" "}
      N=2-5 runs per condition. One human reviewer. One task domain. The
      &quot;hypotheses&quot; on this site are exploratory observations, not
      tested claims. We hold every claim to its strongest critique on{" "}

      &mdash; read it before trusting any number on this site.
    </p>
  );
}

