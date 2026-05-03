import { Button } from "@/components/ui/button";

export function HeroBand() {
  return (
    <section className="relative isolate overflow-hidden py-24 sm:py-32 border-b border-border/40">
      <div className="mx-auto max-w-6xl px-6 text-center">
        <h1 className="font-display text-5xl font-medium tracking-tight text-foreground sm:text-7xl">
          Evolve your business with <span className="text-primary">{{SITE_NAME}}</span>.
        </h1>
        <p className="mt-8 text-lg leading-relaxed text-muted-foreground max-w-2xl mx-auto">
          The next generation of site building is here. Integrated planning, autonomous agents, and evolutionary substrates that grow with you.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button size="lg" className="font-mono text-[11px] uppercase tracking-[0.22em] px-8">
            Get Started
          </Button>
          <Button variant="outline" size="lg" className="font-mono text-[11px] uppercase tracking-[0.22em] px-8">
            Learn More
          </Button>
        </div>
      </div>
    </section>
  );
}
