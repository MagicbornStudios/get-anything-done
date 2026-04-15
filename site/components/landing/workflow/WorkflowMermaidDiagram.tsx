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

function cleanupMermaidArtifacts(renderId: string) {
  if (typeof document === "undefined") return;

  // Mermaid may leave temporary nodes in <body> when parsing/rendering fails.
  const direct = document.getElementById(renderId);
  if (direct && !direct.closest("[data-mermaid-host='true']")) direct.remove();

  const prefixed = document.getElementById(`d${renderId}`);
  if (prefixed && !prefixed.closest("[data-mermaid-host='true']")) prefixed.remove();

  const leakedErrors = Array.from(document.querySelectorAll("body *")).filter((el) => {
    const text = el.textContent?.toLowerCase() ?? "";
    return text.includes("syntax error in text") && text.includes("mermaid");
  });
  leakedErrors.forEach((el) => {
    if (!el.closest("[data-mermaid-host='true']")) el.remove();
  });
}

type Props = {
  diagram: string;
  id: string;
};

export function WorkflowMermaidDiagram({ diagram, id }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let renderId = "";
    (async () => {
      try {
        const m = await loadMermaid();
        if (cancelled || !ref.current) return;
        renderId = `mmd-${id.replace(/[^a-zA-Z0-9_-]/g, "-")}-${Date.now()}`;
        const { svg } = await m.render(renderId, diagram);
        if (!cancelled && ref.current) ref.current.innerHTML = svg;
      } catch (err) {
        console.error("mermaid render failed", err);
      } finally {
        if (renderId) cleanupMermaidArtifacts(renderId);
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
      data-mermaid-host="true"
      className="flex w-full items-center justify-center overflow-x-auto [&_svg]:max-w-full"
    />
  );
}
