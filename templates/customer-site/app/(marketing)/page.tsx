import { SiteSection, Identified } from "gad-visual-context";
import { HeroBand } from "@/components/marketing/HeroBand";
import { CTASection } from "@/components/marketing/CTASection";

export const metadata = {
  title: "{{SITE_NAME}} — Experience the future.",
  description: "Built with Get Anything Done.",
};

const FEATURES = [
  {
    slug: "modern",
    title: "Modern Stack",
    body: "Next.js, Tailwind, and OKLCH colors for a warm-dark aesthetic that feels premium out of the box.",
  },
  {
    slug: "editable",
    title: "Live Editable",
    body: "Point at any element and describe the change. The platform handles the rest.",
  },
  {
    slug: "scalable",
    title: "Grows with You",
    body: "The evolutionary substrate ensures that as your project grows, your tools get smarter.",
  },
] as const;

export default function MarketingLandingPage() {
  return (
    <>
      <HeroBand />

      <SiteSection
        cid="marketing-features-site-section"
        id="features"
        className="border-b border-border/40 py-24"
      >
        <div className="mx-auto max-w-6xl px-6">
          <p
            data-cid="marketing-features-eyebrow"
            className="font-mono text-[10px] uppercase tracking-[0.32em] text-primary/80"
          >
            Features
          </p>
          <h2
            className="mt-3 max-w-2xl font-display text-3xl font-medium tracking-tight text-foreground sm:text-4xl"
          >
            A solid foundation for {{SITE_NAME}}.
          </h2>
          <div className="mt-12 grid gap-px overflow-hidden rounded-none border border-border/70 bg-border/70 sm:grid-cols-3">
            {FEATURES.map((f) => (
              <Identified
                as="feature"
                key={f.slug}
                cid={`marketing.feature.${f.slug}`}
                className="flex flex-col gap-3 bg-card/40 p-6 transition-colors hover:bg-card/70"
              >
                <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary/80">
                  {f.slug}
                </span>
                <h3
                  className="font-display text-xl font-medium text-foreground"
                >
                  {f.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {f.body}
                </p>
              </Identified>
            ))}
          </div>
        </div>
      </SiteSection>

      <CTASection />
    </>
  );
}
