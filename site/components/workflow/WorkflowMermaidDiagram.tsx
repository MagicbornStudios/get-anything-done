"use client";

import { useEffect, useId, useRef, useState } from "react";

interface Props {
  source: string;
  slug: string;
}

/**
 * Client-side Mermaid renderer for authored workflow diagrams.
 *
 * Mermaid is dynamic-imported to keep it out of the SSR bundle and to avoid
 * running its browser-only dependencies at build time. Each diagram renders
 * into a unique element via mermaid.render(), which returns a promise of the
 * SVG string. Errors render inline so an invalid diagram doesn't crash the
 * surrounding tab.
 *
 * Authored workflows are intentionally static — Mermaid's SVG output gives
 * us a crisp, low-overhead, non-interactive rendering that is easy to diff
 * against the React Flow "live" view (see WorkflowLiveDiagram).
 */
export function WorkflowMermaidDiagram({ source, slug }: Props) {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const diagramId = useId().replace(/:/g, "");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: "dark",
          securityLevel: "strict",
          flowchart: { htmlLabels: true, curve: "basis" },
          themeVariables: {
            fontFamily: "var(--font-sans, system-ui)",
            fontSize: "13px",
          },
        });
        const { svg: rendered } = await mermaid.render(`mm-${slug}-${diagramId}`, source);
        if (!cancelled) setSvg(rendered);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [source, slug, diagramId]);

  if (error) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
        Mermaid render error: {error}
      </div>
    );
  }

  if (!svg) {
    return (
      <div
        ref={containerRef}
        aria-busy="true"
        className="flex h-40 items-center justify-center rounded-md border border-border/50 bg-muted/30 text-xs text-muted-foreground"
      >
        Rendering diagram…
      </div>
    );
  }

  return (
    <div
      className="mermaid-diagram overflow-x-auto rounded-md border border-border/50 bg-muted/20 p-4 [&_svg]:h-auto [&_svg]:max-w-full"
      aria-label={`Workflow diagram for ${slug}`}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
