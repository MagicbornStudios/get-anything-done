import type { ReactNode } from "react";

export function FormulasFormula({ children }: { children: ReactNode }) {
  return (
    <code className="block rounded-lg border border-border/60 bg-card/40 px-4 py-3 font-mono text-sm text-foreground">
      {children}
    </code>
  );
}
