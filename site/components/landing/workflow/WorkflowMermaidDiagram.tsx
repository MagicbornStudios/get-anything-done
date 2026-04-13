"use client";

import { useEffect, useRef } from "react";

type MermaidModule = {
  initialize: (cfg: Record<string, unknown>) => void;
  render: (id: string, text: string) => Promise<{ svg: string }>;
};

let mermaidPromise: Promise<MermaidModule> | null = null;
function loadMermaid(): Promise<MermaidModule> {
  if (!mermaidPromise) {
    mermaidPromise = import("mermaid").then((mod) => {
      const m = mod.default as unknown as MermaidModule;
      m.initialize({
        startOnLoad: false,
        theme: "dark",
        themeVariables: {
          background: "transparent",
          primaryColor: "#1e3a5f",
          primaryBorderColor: "#6f88a3",
          primaryTextColor: "#e0b378",
          lineColor: "#6f88a3",
          fontFamily: "inherit",
        },
        securityLevel: "loose",
      });
      return m;
    });
  }
  return mermaidPromise;
}

type Props = {
  diagram: string;
  id: string;
};

export function WorkflowMermaidDiagram({ diagram, id }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const m = await loadMermaid();
        if (cancelled || !ref.current) return;
        const safeId = `mmd-${id.replace(/[^a-zA-Z0-9_-]/g, "-")}-${Date.now()}`;
        const { svg } = await m.render(safeId, diagram);
        if (!cancelled && ref.current) ref.current.innerHTML = svg;
      } catch (err) {
        console.error("mermaid render failed", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [diagram, id]);

  return (
    <div
      ref={ref}
      id={id}
      className="flex w-full items-center justify-center overflow-x-auto [&_svg]:max-w-full"
    />
  );
}
