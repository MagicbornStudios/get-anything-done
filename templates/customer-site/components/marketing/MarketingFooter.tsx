import Link from "next/link";

export function MarketingFooter() {
  return (
    <footer className="border-t border-border/40 py-12 bg-muted/30">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="col-span-2">
            <Link href="/" className="font-display text-xl font-medium tracking-tight">
              {{SITE_NAME}}
            </Link>
            <p className="mt-4 text-sm text-muted-foreground max-w-xs">
              Built with Get Anything Done. Harness the power of evolutionary substrates for your business.
            </p>
          </div>
          <div>
            <h4 className="font-mono text-[10px] uppercase tracking-[0.22em] text-foreground mb-4">Platform</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/pricing" className="hover:text-foreground transition-colors">Pricing</Link></li>
              <li><Link href="/enterprise" className="hover:text-foreground transition-colors">Enterprise</Link></li>
              <li><Link href="/sla" className="hover:text-foreground transition-colors">SLA</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-mono text-[10px] uppercase tracking-[0.22em] text-foreground mb-4">Company</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="#" className="hover:text-foreground transition-colors">About</Link></li>
              <li><Link href="#" className="hover:text-foreground transition-colors">Contact</Link></li>
              <li><Link href="#" className="hover:text-foreground transition-colors">Privacy</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-12 pt-8 border-t border-border/20 flex flex-col md:flex-row justify-between items-center gap-4 text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground/60">
          <span>&copy; {new Date().getFullYear()} {{SITE_NAME}} &middot; All rights reserved.</span>
          <span>Tenant ID: {{TENANT_ID}}</span>
        </div>
      </div>
    </footer>
  );
}
