import { Badge } from "@/components/ui/badge";

const YOUTUBE_ID = "958hJe-AcvU";
const YOUTUBE_START_SEC = 610;
const GSD_UPSTREAM = "https://github.com/gsd-build/get-shit-done";

export default function Lineage() {
  const embedSrc = `https://www.youtube-nocookie.com/embed/${YOUTUBE_ID}?start=${YOUTUBE_START_SEC}`;

  return (
    <section id="lineage" className="border-t border-border/60 bg-card/20">
      <div className="section-shell">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.95fr)] lg:items-start lg:gap-16">
          <div>
            <p className="section-kicker">Lineage</p>
            <h2 className="max-w-2xl text-4xl font-semibold tracking-tight md:text-5xl">
              Built on the GSD principles, built to be measured.
            </h2>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
              GAD is downstream of{" "}
              <a
                href={GSD_UPSTREAM}
                className="text-accent underline-offset-4 hover:underline"
                rel="noopener noreferrer"
                target="_blank"
              >
                Get Shit Done
              </a>
              — small loops, visible state, executable specs. The talk is the creator&apos;s
              perspective on why tight planning loops beat ad-hoc prompting alone. We took those
              principles, wrote the CLI to make them cheap, and then bolted on an eval harness so
              drift and regressions show up in benchmarks instead of vibes.
            </p>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
              The video starts at the segment where the structured-planning argument lands.
              The full talk is worth watching if you&apos;ve ever wondered why your agent is
              confidently producing the wrong code.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Badge variant="outline">Originated by gsd-build</Badge>
              <Badge variant="outline">Adapted for measurement</Badge>
              <Badge variant="outline">Eval-first since v1.0</Badge>
            </div>
          </div>

          <div className="w-full">
            <div className="overflow-hidden rounded-2xl border border-border/70 bg-background shadow-2xl shadow-black/40">
              <div className="aspect-video w-full">
                <iframe
                  title="Get Shit Done — creator perspective on structured planning"
                  className="h-full w-full"
                  src={embedSrc}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              </div>
            </div>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              <a
                href={`https://www.youtube.com/watch?v=${YOUTUBE_ID}&t=${YOUTUBE_START_SEC}s`}
                className="underline-offset-2 hover:underline"
                rel="noopener noreferrer"
                target="_blank"
              >
                Open on YouTube ↗
              </a>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
