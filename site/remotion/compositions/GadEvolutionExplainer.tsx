"use client";

import { AbsoluteFill, interpolate, Sequence, useCurrentFrame, useVideoConfig } from "remotion";

/**
 * GAD Evolution Explainer — 30s (900 frames @ 30fps).
 *
 * Narrative: the get-anything-done framework is evolutionary. New skills are
 * not designed in a meeting; they emerge from high-pressure phases detected
 * by the Pressure v3 formula (decision gad-222). This composition walks the
 * pressure → candidate → proto-skill → install → shed loop in 30 seconds.
 *
 * Scenes:
 *   0-6s    Title — "Skills born from pressure"
 *   6-14s   Pressure formula — P = T + Cₐwc + Clwl + D·wd + (D/T)·wr
 *   14-24s  Five-step loop — detect → candidate → draft → install → shed
 *   24-30s  CTA — every skill on this site was born this way
 */

const PALETTE = {
  bg0: "#0a0a0f",
  bg1: "#1a1a2e",
  fg: "#fafafa",
  muted: "#a8a29e",
  accent: "#e0b378",
  accentDeep: "#c88d4c",
  pressure: "#f97316",
  cyan: "#38bdf8",
  green: "#34d399",
  rose: "#fb7185",
  violet: "#a78bfa",
} as const;

const FONT_SANS = "'IBM Plex Sans', 'Inter', system-ui, sans-serif";
const FONT_MONO = "'IBM Plex Mono', 'JetBrains Mono', ui-monospace, monospace";

function fade(frame: number, from: number, to: number): number {
  return interpolate(frame, [from, to], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

function TitleScene() {
  const frame = useCurrentFrame();
  const opacity = fade(frame, 0, 20);
  const y = interpolate(frame, [0, 30], [18, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(135deg, ${PALETTE.bg0} 0%, ${PALETTE.bg1} 100%)`,
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONT_SANS,
        color: PALETTE.fg,
        padding: 80,
      }}
    >
      <div style={{ opacity, transform: `translateY(${y}px)`, textAlign: "center", maxWidth: 1100 }}>
        <p
          style={{
            fontSize: 16,
            textTransform: "uppercase",
            letterSpacing: "0.28em",
            color: PALETTE.accentDeep,
            marginBottom: 20,
          }}
        >
          get-anything-done · evolutionary framework
        </p>
        <h1
          style={{
            fontSize: 76,
            fontWeight: 600,
            lineHeight: 1.05,
            margin: 0,
          }}
        >
          Skills <span style={{ color: PALETTE.pressure }}>born</span>{" "}
          from <span style={{ color: PALETTE.accent }}>pressure</span>.
        </h1>
        <p
          style={{
            fontSize: 26,
            marginTop: 32,
            color: PALETTE.muted,
            lineHeight: 1.45,
            maxWidth: 900,
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          Every skill in this repo started as a phase that was too hard.
          We measured why, and the measurement told us what to extract.
        </p>
      </div>
    </AbsoluteFill>
  );
}

function PressureScene() {
  const frame = useCurrentFrame();
  const opacity = fade(frame, 0, 15);

  const legend = [
    { sym: "T", expl: "tasks in the phase", color: PALETTE.cyan },
    { sym: "Cₐ", expl: "anticipated crosscuts", color: PALETTE.green },
    { sym: "Cₗ", expl: "latent crosscuts", color: PALETTE.pressure },
    { sym: "D", expl: "decisions (resolved entropy)", color: PALETTE.violet },
    { sym: "D/T", expl: "direction density", color: PALETTE.accent },
  ];

  return (
    <AbsoluteFill
      style={{
        background: PALETTE.bg0,
        padding: "70px 100px",
        fontFamily: FONT_SANS,
        color: PALETTE.fg,
        opacity,
      }}
    >
      <p
        style={{
          fontSize: 14,
          textTransform: "uppercase",
          letterSpacing: "0.22em",
          color: PALETTE.accentDeep,
          marginBottom: 10,
        }}
      >
        Pressure v3 · decision gad-222
      </p>
      <h2 style={{ fontSize: 42, fontWeight: 600, margin: 0, marginBottom: 30, lineHeight: 1.1 }}>
        The formula that <span style={{ color: PALETTE.pressure }}>names</span> a skill candidate.
      </h2>

      <div
        style={{
          fontFamily: FONT_MONO,
          fontSize: 40,
          padding: "28px 36px",
          borderRadius: 14,
          border: `1px solid ${PALETTE.pressure}50`,
          background: `${PALETTE.pressure}0d`,
          color: PALETTE.fg,
          textAlign: "center",
          marginBottom: 32,
        }}
      >
        P = T + Cₐ·wc + <span style={{ color: PALETTE.pressure }}>Cₗ·wl</span> + D·wd + (D/T)·wr
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: 14,
        }}
      >
        {legend.map((item, i) => {
          const o = fade(frame, 30 + i * 12, 55 + i * 12);
          return (
            <div
              key={item.sym}
              style={{
                opacity: o,
                padding: "14px 16px",
                borderRadius: 10,
                border: `1px solid ${item.color}45`,
                background: `${item.color}0d`,
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 26,
                  color: item.color,
                  marginBottom: 6,
                }}
              >
                {item.sym}
              </div>
              <div style={{ fontSize: 14, color: PALETTE.muted, lineHeight: 1.4 }}>
                {item.expl}
              </div>
            </div>
          );
        })}
      </div>

      <p
        style={{
          marginTop: 36,
          fontSize: 19,
          color: PALETTE.muted,
          maxWidth: 1100,
          lineHeight: 1.55,
          borderLeft: `3px solid ${PALETTE.pressure}80`,
          paddingLeft: 18,
        }}
      >
        Latent crosscuts carry the heaviest weight — the unknown unknowns are where new skills are born.
      </p>
    </AbsoluteFill>
  );
}

function LoopScene() {
  const frame = useCurrentFrame();
  const opacity = fade(frame, 0, 15);

  const steps = [
    { n: "1", label: "Detect", art: "self-eval.json", color: PALETTE.pressure },
    { n: "2", label: "Candidate", art: "CANDIDATE.md", color: PALETTE.cyan },
    { n: "3", label: "Draft", art: "proto-skills/<slug>/", color: PALETTE.accent },
    { n: "4", label: "Install", art: "skills/<name>/", color: PALETTE.green },
    { n: "5", label: "Shed", art: "species.json", color: PALETTE.rose },
  ];

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(180deg, ${PALETTE.bg0} 0%, ${PALETTE.bg1} 100%)`,
        padding: "70px 80px",
        fontFamily: FONT_SANS,
        color: PALETTE.fg,
        opacity,
      }}
    >
      <p
        style={{
          fontSize: 14,
          textTransform: "uppercase",
          letterSpacing: "0.22em",
          color: PALETTE.accentDeep,
          marginBottom: 10,
        }}
      >
        The evolution loop
      </p>
      <h2 style={{ fontSize: 44, fontWeight: 600, margin: 0, marginBottom: 44, lineHeight: 1.1 }}>
        Five files on disk. Five commands. <span style={{ color: PALETTE.accent }}>No curator.</span>
      </h2>

      <div
        style={{
          display: "flex",
          alignItems: "stretch",
          gap: 14,
        }}
      >
        {steps.map((s, i) => {
          const o = fade(frame, 30 + i * 22, 60 + i * 22);
          const y = interpolate(frame, [30 + i * 22, 60 + i * 22], [22, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const isLast = i === steps.length - 1;
          return (
            <div
              key={s.n}
              style={{
                flex: 1,
                opacity: o,
                transform: `translateY(${y}px)`,
                position: "relative",
              }}
            >
              <div
                style={{
                  borderRadius: 14,
                  border: `1px solid ${s.color}4d`,
                  background: `${s.color}0d`,
                  padding: "20px 18px",
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 999,
                      background: s.color,
                      color: PALETTE.bg0,
                      fontWeight: 700,
                      fontSize: 18,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: FONT_MONO,
                    }}
                  >
                    {s.n}
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 600, color: s.color }}>{s.label}</div>
                </div>
                <div
                  style={{
                    fontFamily: FONT_MONO,
                    fontSize: 14,
                    color: PALETTE.muted,
                    marginTop: "auto",
                  }}
                >
                  {s.art}
                </div>
              </div>
              {!isLast ? (
                <div
                  style={{
                    position: "absolute",
                    top: "50%",
                    right: -12,
                    transform: "translateY(-50%)",
                    color: `${PALETTE.accent}a0`,
                    fontSize: 22,
                    fontFamily: FONT_MONO,
                  }}
                >
                  →
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <p
        style={{
          marginTop: 40,
          fontSize: 18,
          color: PALETTE.muted,
          maxWidth: 1100,
          lineHeight: 1.55,
        }}
      >
        Epigenetic skills build once and uninstall — the next generation only carries
        what still earns its cost. (gad-221)
      </p>
    </AbsoluteFill>
  );
}

function HookScene() {
  const frame = useCurrentFrame();
  const opacity = fade(frame, 0, 18);

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at center, ${PALETTE.accent}1a, ${PALETTE.bg0} 65%)`,
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONT_SANS,
        color: PALETTE.fg,
        padding: 80,
        opacity,
      }}
    >
      <div style={{ textAlign: "center", maxWidth: 1100 }}>
        <p
          style={{
            fontSize: 16,
            textTransform: "uppercase",
            letterSpacing: "0.28em",
            color: PALETTE.accentDeep,
            marginBottom: 22,
          }}
        >
          What this means
        </p>
        <h2
          style={{
            fontSize: 56,
            fontWeight: 600,
            lineHeight: 1.15,
            margin: 0,
          }}
        >
          Every skill on this site was{" "}
          <span style={{ color: PALETTE.accent }}>born this way</span>.
        </h2>
        <p
          style={{
            fontSize: 24,
            marginTop: 28,
            color: PALETTE.muted,
            lineHeight: 1.5,
          }}
        >
          The formula, the loop, and the skill catalog are the same system —
          seen from different distances.
        </p>
        <div
          style={{
            marginTop: 40,
            fontFamily: FONT_MONO,
            fontSize: 22,
            color: PALETTE.cyan,
          }}
        >
          gad self-eval  →  gad evolution evolve  →  skills/
        </div>
      </div>
    </AbsoluteFill>
  );
}

export function GadEvolutionExplainerComposition() {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: PALETTE.bg0 }}>
      <Sequence from={0} durationInFrames={6 * fps}>
        <TitleScene />
      </Sequence>
      <Sequence from={6 * fps} durationInFrames={8 * fps}>
        <PressureScene />
      </Sequence>
      <Sequence from={14 * fps} durationInFrames={10 * fps}>
        <LoopScene />
      </Sequence>
      <Sequence from={24 * fps} durationInFrames={6 * fps}>
        <HookScene />
      </Sequence>
    </AbsoluteFill>
  );
}
