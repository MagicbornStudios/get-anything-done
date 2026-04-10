import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";

/**
 * GAD Explainer — 30-second composition.
 *
 * Placeholder implementation. The eval agent will replace this with the
 * actual production composition. This stub renders the 4 mandatory gate
 * frames so the scaffold is verifiable.
 *
 * Sections (at 30fps):
 *   0-210   (0-7s)   — Thesis frame
 *   210-420 (7-14s)  — Three-condition split
 *   420-630 (14-21s) — Skeptic disclosure
 *   630-900 (21-30s) — CTA hook
 */
export const GadExplainer: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const section =
    frame < 210 ? "thesis" :
    frame < 420 ? "conditions" :
    frame < 630 ? "skeptic" :
    "hook";

  const sectionProgress = interpolate(
    frame,
    section === "thesis" ? [0, 210] :
    section === "conditions" ? [210, 420] :
    section === "skeptic" ? [420, 630] :
    [630, 900],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const fadeIn = interpolate(sectionProgress, [0, 0.15], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: section === "skeptic"
          ? "linear-gradient(135deg, #1a0a0a 0%, #2a1010 100%)"
          : "linear-gradient(135deg, #0a0a1a 0%, #101020 100%)",
        fontFamily: "system-ui, -apple-system, sans-serif",
        color: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: fadeIn,
      }}
    >
      {section === "thesis" && (
        <div style={{ textAlign: "center", padding: "0 120px", maxWidth: 1400 }}>
          <div style={{ fontSize: 32, color: "#666", letterSpacing: 8, marginBottom: 40, textTransform: "uppercase" }}>
            get-anything-done
          </div>
          <div style={{ fontSize: 56, fontWeight: 700, lineHeight: 1.2, letterSpacing: -1 }}>
            A system for evaluating and evolving agents through real tasks,{" "}
            <span style={{ color: "#38bdf8" }}>measurable pressure</span>, and iteration.
          </div>
        </div>
      )}

      {section === "conditions" && (
        <div style={{ display: "flex", gap: 40, padding: "0 80px", width: "100%" }}>
          {[
            { label: "Bare", color: "#34d399", desc: "No framework. Just requirements.", skills: "2 bootstrap skills" },
            { label: "GAD", color: "#38bdf8", desc: "Full planning + 10 skills.", skills: ".planning/ + CLI" },
            { label: "Emergent", color: "#fbbf24", desc: "Inherited + evolving skills.", skills: "6 compounding skills" },
          ].map((c, i) => (
            <div
              key={c.label}
              style={{
                flex: 1,
                background: `${c.color}15`,
                border: `2px solid ${c.color}40`,
                borderRadius: 20,
                padding: 40,
                opacity: interpolate(sectionProgress, [0.1 + i * 0.15, 0.25 + i * 0.15], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
              }}
            >
              <div style={{ fontSize: 42, fontWeight: 700, color: c.color, marginBottom: 16 }}>
                {c.label}
              </div>
              <div style={{ fontSize: 24, color: "#ccc", marginBottom: 12 }}>{c.desc}</div>
              <div style={{ fontSize: 18, color: "#888" }}>{c.skills}</div>
            </div>
          ))}
        </div>
      )}

      {section === "skeptic" && (
        <div style={{ textAlign: "center", padding: "0 120px", maxWidth: 1200 }}>
          <div style={{ fontSize: 28, color: "#f87171", letterSpacing: 4, marginBottom: 32, textTransform: "uppercase" }}>
            honest disclosure
          </div>
          <div style={{ fontSize: 44, fontWeight: 600, lineHeight: 1.4, color: "#fca5a5" }}>
            N=2-5 runs per condition. One reviewer. Exploratory analysis, not proven findings.
          </div>
        </div>
      )}

      {section === "hook" && (
        <div style={{ textAlign: "center", padding: "0 80px" }}>
          <div style={{ fontSize: 48, fontWeight: 700, marginBottom: 40 }}>
            Play the builds. Read the research. Fork the repo.
          </div>
          <div style={{ fontSize: 36, color: "#38bdf8", fontWeight: 600 }}>
            get-anything-done.vercel.app
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
