import { gsdUpstreamPlanningTalkWatchUrl } from "@/components/landing/gsd-upstream-media";

/** Editorial asset: terminal handoff (Claude Code) — same paste works in Cursor, Codex, or any agent session. */
const CLAUDE_CODE_HANDOFF_IMG =
  "https://storage.ghost.io/c/57/9b/579b6dca-f48a-4307-844f-f0533595d058/content/images/2025/10/Chatting-with-Claude-Code.png";

export function AgentHandoffCycleMedia() {
  return (
    <div className="w-full">
      <figure className="overflow-hidden rounded-2xl border border-border/70 bg-background shadow-2xl shadow-black/40">
        {/* eslint-disable-next-line @next/next/no-img-element -- remote Ghost CDN; no stable Next image domain pin */}
        <img
          src={CLAUDE_CODE_HANDOFF_IMG}
          width={1200}
          height={675}
          alt="Claude Code terminal: operator pastes a structured site handoff into a local project session."
          className="h-auto w-full object-cover object-top"
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer-when-downgrade"
        />
        <figcaption className="border-t border-border/60 bg-muted/20 px-4 py-3 text-center text-xs text-muted-foreground">
          Same loop in Cursor, Codex, or any coding agent: paste the panel output, run the brief, return to the site with
          dev IDs still pointing at the same <code className="rounded bg-card/60 px-1 font-mono text-[10px]">cid</code>{" "}
          tokens.
        </figcaption>
      </figure>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        <a
          href={gsdUpstreamPlanningTalkWatchUrl()}
          className="underline-offset-2 hover:underline"
          rel="noopener noreferrer"
          target="_blank"
        >
          GSD upstream — creator talk on structured planning (YouTube) ↗
        </a>
      </p>
    </div>
  );
}
