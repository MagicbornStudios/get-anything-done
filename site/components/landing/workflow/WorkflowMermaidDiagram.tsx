"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    mermaid?: {
      initialize: (cfg: Record<string, unknown>) => void;
      run: (cfg?: { nodes?: Element[] }) => Promise<void>;
    };
  }
}

type Props = {
  diagram: string;
  id: string;
};

export function WorkflowMermaidDiagram({ diagram, id }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function render() {
      if (!ref.current) return;
      if (!window.mermaid) {
        const mod = await import("mermaid");
        window.mermaid = mod.default as unknown as Window["mermaid"];
        window.mermaid!.initialize({
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
      }
      if (cancelled) return;
      const node = ref.current;
      if (!node) return;
      node.removeAttribute("data-processed");
      node.innerHTML = diagram;
      try {
        await window.mermaid!.run({ nodes: [node] });
      } catch (err) {
        console.error("mermaid render failed", err);
      }
    }
    render();
    return () => {
      cancelled = true;
    };
  }, [diagram]);

  return (
    <div
      ref={ref}
      id={id}
      className="mermaid flex w-full items-center justify-center overflow-x-auto [&_svg]:max-w-full"
    >
      {diagram}
    </div>
  );
}
