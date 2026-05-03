import { Button } from "@/components/ui/button";

export function CTASection() {
  return (
    <section className="py-24 bg-primary/5 border-b border-border/40">
      <div className="mx-auto max-w-4xl px-6 text-center">
        <h2 className="font-display text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
          Ready to start your journey?
        </h2>
        <p className="mt-6 text-base leading-relaxed text-muted-foreground">
          Join the hundreds of companies building on {{SITE_NAME}}. Get your project up and running in minutes.
        </p>
        <div className="mt-10">
          <Button size="lg" className="font-mono text-[11px] uppercase tracking-[0.22em] px-8">
            Bootstrap your site now
          </Button>
        </div>
      </div>
    </section>
  );
}
