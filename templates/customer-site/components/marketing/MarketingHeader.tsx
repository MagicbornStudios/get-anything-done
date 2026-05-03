import Link from "next/link";
import { Button } from "@/components/ui/button";

export function MarketingHeader() {
  return (
    <header className="border-b border-border/40 bg-background/80 backdrop-blur sticky top-0 z-50">
      <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
        <Link href="/" className="font-display text-xl font-medium tracking-tight">
          {{SITE_NAME}}
        </Link>
        <nav className="hidden md:flex items-center gap-8 text-sm font-mono uppercase tracking-[0.22em] text-muted-foreground">
          <Link href="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
          <Link href="/enterprise" className="hover:text-foreground transition-colors">Enterprise</Link>
          <Link href="/sla" className="hover:text-foreground transition-colors">SLA</Link>
        </nav>
        <Button variant="outline" size="sm" className="font-mono text-[10px] uppercase tracking-[0.22em]">
          Sign In
        </Button>
      </div>
    </header>
  );
}
