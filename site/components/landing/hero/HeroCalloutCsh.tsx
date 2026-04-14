import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function HeroCalloutCsh() {
  return (
    <p className="mt-10 max-w-2xl rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-[13px] leading-6 text-amber-200">
      <strong className="font-semibold text-amber-100">New this round:</strong>{" "}
      <abbr
        className="cursor-help underline decoration-dotted decoration-amber-300/60 underline-offset-2 hover:text-amber-100"
        title="CSH = compound-skills hypothesis"
      >
        CSH
      </abbr>
      -testing via the Emergent workflow. Evolution 4&apos;s Emergent v4 scored{" "}
      <strong className="font-semibold text-amber-100">0.885</strong> after
      authoring two new skills and deprecating one — the first observed full
      skill-ratcheting cycle.{" "}
      <Link
        href="/skeptic"
        className="underline decoration-amber-300 underline-offset-2 hover:text-amber-100"
      >
        See the evidence <ArrowRight size={11} className="inline" aria-hidden />
      </Link>
    </p>
  );
}
