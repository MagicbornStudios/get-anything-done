import { SiteSection } from "gad-visual-context";

export const metadata = {
  title: "Pricing — {{SITE_NAME}}",
};

export default function PricingPage() {
  return (
    <SiteSection cid="pricing-page" className="py-24">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-primary/80">
          Pricing
        </p>
        <h1 className="mt-3 font-display text-4xl font-medium tracking-tight text-foreground sm:text-5xl">
          Simple, transparent pricing.
        </h1>
        <p className="mt-6 text-base leading-relaxed text-muted-foreground">
          Choose the plan that's right for you. All plans include the full power of {{SITE_NAME}}.
        </p>
      </div>
      
      <div className="mx-auto mt-16 max-w-6xl px-6">
        <div className="grid gap-8 sm:grid-cols-3">
          {[
            { name: "Starter", price: "$0", features: ["1 Project", "Community Support", "Basic Skills"] },
            { name: "Pro", price: "$29", features: ["Unlimited Projects", "Priority Support", "Advanced Skills"] },
            { name: "Enterprise", price: "Custom", features: ["Custom Infrastructure", "SLA Guarantees", "Dedicated Support"] },
          ].map((plan) => (
            <div key={plan.name} className="flex flex-col border border-border/60 bg-card/40 p-8">
              <h3 className="font-display text-2xl font-medium">{plan.name}</h3>
              <p className="mt-4 text-4xl font-medium text-primary">{plan.price}</p>
              <ul className="mt-8 space-y-4 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="text-sm text-muted-foreground flex items-center gap-2">
                    <span className="h-1 w-1 rounded-full bg-primary/60" />
                    {f}
                  </li>
                ))}
              </ul>
              <button className="mt-8 border border-primary bg-primary py-2 font-mono text-[10px] uppercase tracking-[0.22em] text-primary-foreground">
                Get Started
              </button>
            </div>
          ))}
        </div>
      </div>
    </SiteSection>
  );
}
