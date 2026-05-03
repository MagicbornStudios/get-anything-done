import { SiteSection } from "gad-visual-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const metadata = {
  title: "Enterprise — {{SITE_NAME}}",
};

export default function EnterprisePage() {
  return (
    <SiteSection cid="enterprise-page" className="py-24">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-primary/80">
          Enterprise
        </p>
        <h1 className="mt-3 font-display text-4xl font-medium tracking-tight text-foreground sm:text-5xl">
          Scale with confidence.
        </h1>
        <p className="mt-6 text-base leading-relaxed text-muted-foreground">
          Custom infrastructure, advanced security, and dedicated support for your organization.
        </p>
      </div>

      <div className="mx-auto mt-20 max-w-6xl px-6 grid grid-cols-1 lg:grid-cols-2 gap-12">
        <div>
          <h2 className="font-display text-3xl font-medium mb-6">Built for the most demanding teams.</h2>
          <ul className="space-y-6">
            {[
              { title: "Net 30 / Net 90 Invoicing", body: "Procurement-friendly billing that matches your business cycle." },
              { title: "99.95% Uptime SLA", body: "Contractual guarantees for availability and response times." },
              { title: "SSO & SCIM", body: "Manage access via Okta, Azure AD, or your preferred IdP." },
              { title: "Audit Log Streaming", body: "Real-time visibility into every action taken on the platform." },
            ].map((f) => (
              <li key={f.title}>
                <h3 className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary mb-1">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.body}</p>
              </li>
            ))}
          </ul>
        </div>

        <Card className="bg-card/40">
          <CardHeader>
            <CardTitle className="font-display">Contact Sales</CardTitle>
            <CardDescription className="font-mono text-[10px] uppercase tracking-[0.22em]">
              Two business day response time
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name">First Name</Label>
                  <Input id="first_name" placeholder="Jane" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">Last Name</Label>
                  <Input id="last_name" placeholder="Doe" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Work Email</Label>
                <Input id="email" type="email" placeholder="jane@company.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="message">How can we help?</Label>
                <Textarea id="message" rows={4} />
              </div>
              <Button className="w-full font-mono text-[11px] uppercase tracking-[0.22em]">
                Submit Request
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </SiteSection>
  );
}
