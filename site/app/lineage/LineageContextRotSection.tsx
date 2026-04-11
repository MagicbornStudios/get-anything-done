import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function LineageContextRotSection() {
  return (
    <section className="border-b border-border/60 bg-card/20">
      <div className="section-shell">
        <div className="mb-2 flex items-center gap-2">
          <AlertTriangle size={18} className="text-accent" aria-hidden />
          <p className="section-kicker !mb-0">The problem</p>
        </div>
        <h2 className="max-w-3xl text-3xl font-semibold tracking-tight md:text-4xl">
          Context rot in three symptoms
        </h2>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Decision drift</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-sm leading-6 text-muted-foreground">
                Something the agent decided at minute 5 gets quietly contradicted at minute 45.
                Neither version is wrong in isolation, but together they&apos;re inconsistent.
                Without a durable record of why the first call was made, the agent has no way to
                know it should stay consistent.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Invisible in-flight work</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-sm leading-6 text-muted-foreground">
                Half-done tasks disappear from the agent&apos;s working set as soon as something more
                urgent arrives. Three sessions later, the user has to remember what was in flight —
                the agent certainly doesn&apos;t. Context windows aren&apos;t memory, they&apos;re a
                rolling window.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Requirements slippage</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-sm leading-6 text-muted-foreground">
                The original ask gets refactored in the agent&apos;s head as the conversation evolves.
                By the end of a long session the code satisfies something related to but not exactly
                what was originally requested. Without a committed spec in the repo, there&apos;s no
                authority to hold the drift accountable against.
              </p>
            </CardContent>
          </Card>
        </div>
        <p className="mt-8 max-w-3xl text-sm text-muted-foreground">
          All three symptoms have the same root cause:{" "}
          <strong className="text-foreground">
            the agent&apos;s memory is ephemeral but the work is persistent
          </strong>
          . The fix every framework in this space converges on is the same: put the context in the
          repo, not in the session.
        </p>
      </div>
    </section>
  );
}
