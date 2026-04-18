"use client";

import { AbsoluteFill, interpolate, Sequence, useCurrentFrame, useVideoConfig } from "remotion";

/**
 * VCS Explainer — 30s (900 frames @ 30fps).
 *
 * Narrative: the Visual Context System is a UX pattern that lets an agent
 * connect a visible region of a UI back to its source code with zero guessing.
 * It is framework-agnostic — same invariants work in React, Unity, Blender,
 * or any GUI system.
 *
 * Scenes:
 *   0-6s    Title — "Visual Context System"
 *   6-14s   Invariants — cid / as / data-cid as source-searchable literals
 *   14-22s  Landmarks — SiteSection + Identified wrap regions and components
 *   22-30s  Skill stack — the four skills that install this pattern anywhere
 */

const PALETTE = {
  bg0: "#0a0a0f",
  bg1: "#1a1a2e",
  fg: "#fafafa",
  muted: "#a8a29e",
  accent: "#e0b378",
  accentDeep: "#c88d4c",
  code: "#38bdf8",
  codeDim: "#64748b",
  ok: "#34d399",
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
  const underlineWidth = interpolate(frame, [35, 90], [0, 220], {
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
      <div style={{ opacity, transform: `translateY(${y}px)`, textAlign: "center", maxWidth: 1000 }}>
        <p
          style={{
            fontSize: 16,
            textTransform: "uppercase",
            letterSpacing: "0.28em",
            color: PALETTE.accentDeep,
            marginBottom: 20,
          }}
        >
          Skill · gad-visual-context-system
        </p>
        <h1
          style={{
            fontSize: 72,
            fontWeight: 600,
            lineHeight: 1.05,
            margin: 0,
            color: PALETTE.fg,
          }}
        >
          Visual context <span style={{ color: PALETTE.accent }}>anywhere</span>.
        </h1>
        <div
          style={{
            width: underlineWidth,
            height: 3,
            background: PALETTE.accent,
            margin: "28px auto 0",
            borderRadius: 2,
          }}
        />
        <p
          style={{
            fontSize: 24,
            marginTop: 28,
            color: PALETTE.muted,
            lineHeight: 1.45,
          }}
        >
          One UX pattern, source-searchable identities — drops into any GUI
          an agent has to reason about.
        </p>
      </div>
    </AbsoluteFill>
  );
}

function InvariantsScene() {
  const frame = useCurrentFrame();
  const opacity = fade(frame, 0, 15);

  const lines = [
    { t: 'data-cid="evolution-site-section"', label: "addressable region (cid)" },
    { t: 'as="LandingEvolutionBand"', label: "landmark name (as)" },
    { t: 'grep -r "evolution-site-section" .', label: "agent ⇄ code, no LLM guessing" },
  ];

  return (
    <AbsoluteFill
      style={{
        background: PALETTE.bg0,
        padding: "80px 100px",
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
          marginBottom: 12,
        }}
      >
        Core invariant
      </p>
      <h2 style={{ fontSize: 46, fontWeight: 600, margin: 0, marginBottom: 40, lineHeight: 1.1 }}>
        Every visible region carries a literal <span style={{ color: PALETTE.accent }}>you can grep</span>.
      </h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {lines.map((line, i) => {
          const rowOpacity = fade(frame, 30 + i * 20, 55 + i * 20);
          const dx = interpolate(frame, [30 + i * 20, 55 + i * 20], [-40, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          return (
            <div
              key={line.t}
              style={{
                opacity: rowOpacity,
                transform: `translateX(${dx}px)`,
                display: "flex",
                alignItems: "center",
                gap: 20,
              }}
            >
              <div
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 26,
                  padding: "14px 22px",
                  border: `1px solid ${PALETTE.code}40`,
                  borderRadius: 10,
                  background: `${PALETTE.code}10`,
                  color: PALETTE.code,
                  minWidth: 640,
                }}
              >
                {line.t}
              </div>
              <div style={{ fontSize: 18, color: PALETTE.muted }}>{line.label}</div>
            </div>
          );
        })}
      </div>
      <p
        style={{
          marginTop: 44,
          fontSize: 18,
          color: PALETTE.muted,
          maxWidth: 900,
          lineHeight: 1.55,
        }}
      >
        No generated IDs. No hash keys. Literals chosen by humans, embedded in the
        DOM and the source file, so any CLI or agent can walk from the rendered
        surface back to the code that produced it.
      </p>
    </AbsoluteFill>
  );
}

function LandmarksScene() {
  const frame = useCurrentFrame();
  const opacity = fade(frame, 0, 15);

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(180deg, ${PALETTE.bg0} 0%, ${PALETTE.bg1} 100%)`,
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
          marginBottom: 12,
        }}
      >
        Two landmark kinds
      </p>
      <h2 style={{ fontSize: 44, fontWeight: 600, margin: 0, marginBottom: 32, lineHeight: 1.1 }}>
        A region wrapper and a component tag. That&apos;s all.
      </h2>

      <div style={{ display: "flex", gap: 24 }}>
        {[
          {
            name: "SiteSection",
            desc: "Wraps a page-level band. Carries cid, tone, layout slot.",
            code: `<SiteSection
  cid="evolution-site-section"
  tone="default"
>`,
            color: PALETTE.accent,
            delay: 0,
          },
          {
            name: "Identified",
            desc: "Wraps a component or subtree. Carries a named landmark.",
            code: `<Identified
  as="LandingEvolutionBand"
  className="flex ..."
>`,
            color: PALETTE.ok,
            delay: 25,
          },
        ].map((card) => {
          const cardOpacity = fade(frame, 20 + card.delay, 50 + card.delay);
          const y = interpolate(frame, [20 + card.delay, 50 + card.delay], [24, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          return (
            <div
              key={card.name}
              style={{
                flex: 1,
                opacity: cardOpacity,
                transform: `translateY(${y}px)`,
                border: `1px solid ${card.color}55`,
                borderRadius: 18,
                padding: 32,
                background: `${card.color}0d`,
              }}
            >
              <div
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 22,
                  color: card.color,
                  marginBottom: 10,
                }}
              >
                {`<${card.name} />`}
              </div>
              <div style={{ fontSize: 20, color: PALETTE.muted, marginBottom: 22 }}>
                {card.desc}
              </div>
              <pre
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 18,
                  lineHeight: 1.5,
                  color: PALETTE.fg,
                  background: `${PALETTE.bg0}d0`,
                  padding: "16px 20px",
                  borderRadius: 10,
                  margin: 0,
                  border: `1px solid ${PALETTE.codeDim}40`,
                }}
              >
                {card.code}
              </pre>
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
          lineHeight: 1.5,
        }}
      >
        Same two primitives ship into React, Next, Vue, Svelte — or any
        GUI where you can attach a data attribute and pick a literal.
      </p>
    </AbsoluteFill>
  );
}

function SkillStackScene() {
  const frame = useCurrentFrame();
  const opacity = fade(frame, 0, 18);

  const skills = [
    {
      id: "gad-visual-context-system",
      role: "The workflow",
      blurb: "Greenfield design & build, brownfield maintenance & rollout.",
    },
    {
      id: "gad-visual-context-panel-identities",
      role: "The naming",
      blurb: "Panel-level cid conventions that stay stable across refactors.",
    },
    {
      id: "scaffold-visual-context-surface",
      role: "The scaffold",
      blurb: "One command: wrap a new section with SiteSection + Identified.",
    },
    {
      id: "portfolio-sync",
      role: "The sync",
      blurb: "Keeps filesystem truth aligned with the site after every change.",
    },
  ];

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at center, ${PALETTE.accent}12, ${PALETTE.bg0} 65%)`,
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
        The skill stack
      </p>
      <h2 style={{ fontSize: 42, fontWeight: 600, margin: 0, marginBottom: 32, lineHeight: 1.1 }}>
        Four skills install VCS into <span style={{ color: PALETTE.accent }}>any GUI project</span>.
      </h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: 22,
        }}
      >
        {skills.map((skill, i) => {
          const rowOpacity = fade(frame, 25 + i * 22, 60 + i * 22);
          const y = interpolate(frame, [25 + i * 22, 60 + i * 22], [18, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          return (
            <div
              key={skill.id}
              style={{
                opacity: rowOpacity,
                transform: `translateY(${y}px)`,
                padding: "22px 26px",
                borderRadius: 14,
                border: `1px solid ${PALETTE.accent}3a`,
                background: `${PALETTE.bg0}b0`,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    fontFamily: FONT_MONO,
                    fontSize: 22,
                    color: PALETTE.accent,
                  }}
                >
                  {skill.id}
                </div>
                <div
                  style={{
                    fontSize: 14,
                    textTransform: "uppercase",
                    letterSpacing: "0.18em",
                    color: PALETTE.codeDim,
                  }}
                >
                  {skill.role}
                </div>
              </div>
              <div style={{ fontSize: 19, color: PALETTE.muted, lineHeight: 1.45 }}>
                {skill.blurb}
              </div>
            </div>
          );
        })}
      </div>

      <p
        style={{
          marginTop: 36,
          fontSize: 19,
          color: PALETTE.fg,
          maxWidth: 1100,
          lineHeight: 1.5,
          borderLeft: `3px solid ${PALETTE.accent}`,
          paddingLeft: 18,
        }}
      >
        Install the four, let your agent rewire your surfaces, then grep any pixel back to source.
      </p>
    </AbsoluteFill>
  );
}

export function VcsExplainerComposition() {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: PALETTE.bg0 }}>
      <Sequence from={0} durationInFrames={6 * fps}>
        <TitleScene />
      </Sequence>
      <Sequence from={6 * fps} durationInFrames={8 * fps}>
        <InvariantsScene />
      </Sequence>
      <Sequence from={14 * fps} durationInFrames={8 * fps}>
        <LandmarksScene />
      </Sequence>
      <Sequence from={22 * fps} durationInFrames={8 * fps}>
        <SkillStackScene />
      </Sequence>
    </AbsoluteFill>
  );
}
