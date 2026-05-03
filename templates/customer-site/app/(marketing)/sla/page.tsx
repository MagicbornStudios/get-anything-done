import { SiteSection } from "gad-visual-context";

export const metadata = {
  title: "SLA — {{SITE_NAME}}",
};

export default function SlaPage() {
  return (
    <SiteSection cid="sla-page" className="py-24">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-primary/80">
          SLA
        </p>
        <h1 className="mt-3 font-display text-4xl font-medium tracking-tight text-foreground sm:text-5xl">
          Our commitment to you.
        </h1>
        <p className="mt-6 text-base leading-relaxed text-muted-foreground">
          We stand behind the reliability of {{SITE_NAME}}. Here are our service level commitments.
        </p>
      </div>

      <div className="mx-auto mt-20 max-w-4xl px-6">
        <div className="border border-border/60 bg-card/40 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border/60 bg-muted/30">
                <th className="p-4 font-mono text-[10px] uppercase tracking-[0.22em]">Target</th>
                <th className="p-4 font-mono text-[10px] uppercase tracking-[0.22em]">Commitment</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {[
                { target: "Monthly Uptime", commitment: "99.95%" },
                { target: "P0 Response Time", commitment: "1 Hour" },
                { target: "P1 Response Time", commitment: "4 Hours" },
                { target: "P2 Response Time", commitment: "1 Business Day" },
              ].map((row) => (
                <tr key={row.target} className="border-b border-border/20 last:border-0">
                  <td className="p-4 font-medium">{row.target}</td>
                  <td className="p-4 text-muted-foreground">{row.commitment}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="mt-12 space-y-8">
          <div>
            <h2 className="font-display text-2xl font-medium mb-4">Service Credits</h2>
            <p className="text-muted-foreground leading-relaxed">
              If we fail to meet our uptime commitment, you are eligible for service credits applied to your next billing cycle. We believe in accountability.
            </p>
          </div>
          <div>
            <h2 className="font-display text-2xl font-medium mb-4">Support Channels</h2>
            <p className="text-muted-foreground leading-relaxed">
              Enterprise customers have access to a dedicated Slack channel and 24/7 phone support for P0 incidents.
            </p>
          </div>
        </div>
      </div>
    </SiteSection>
  );
}
