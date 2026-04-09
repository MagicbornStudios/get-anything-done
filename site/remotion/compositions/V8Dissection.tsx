"use client";

import { AbsoluteFill, interpolate, Sequence, useCurrentFrame, useVideoConfig } from "remotion";

/**
 * Placeholder composition — the "v8 dissection" video.
 *
 * This is the pattern everyone else follows: cinematic passthrough, 20s total,
 * narrative built from scenes wrapped in <Sequence>. Each scene reuses site
 * React components so the video stays in lockstep with the live data.
 *
 * Replace the scene content with final authored frames when the video is
 * ready to publish. The structure (title → formula → tracing-gap reveal →
 * callback) stays.
 */

function fade(frame: number, from: number, to: number): number {
  return interpolate(frame, [from, to], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

function TitleScene() {
  const frame = useCurrentFrame();
  const opacity = fade(frame, 0, 20);
  const y = interpolate(frame, [0, 30], [20, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%)",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'IBM Plex Sans', 'Inter', sans-serif",
        color: "#e0b378",
      }}
    >
      <div style={{ opacity, transform: `translateY(${y}px)`, textAlign: "center" }}>
        <p
          style={{
            fontSize: 18,
            textTransform: "uppercase",
            letterSpacing: "0.2em",
            color: "#c88d4c",
            marginBottom: 16,
          }}
        >
          Case study
        </p>
        <h1
          style={{
            fontSize: 64,
            fontWeight: 600,
            lineHeight: 1.05,
            margin: 0,
            color: "#fafafa",
          }}
        >
          Escape the Dungeon <span style={{ color: "#e0b378" }}>v8</span>
        </h1>
        <p
          style={{
            fontSize: 24,
            marginTop: 20,
            color: "#a8a29e",
            fontWeight: 400,
          }}
        >
          How process metrics rated a broken game at 0.18
        </p>
      </div>
    </AbsoluteFill>
  );
}

function FormulaScene() {
  const frame = useCurrentFrame();
  const opacity = fade(frame, 0, 15);
  const dims = [
    { label: "requirement_coverage", weight: 0.15, score: 0.33, colour: "#38bdf8" },
    { label: "planning_quality", weight: 0.15, score: 0.0, colour: "#94a3b8" },
    { label: "per_task_discipline", weight: 0.15, score: 0.0, colour: "#94a3b8" },
    { label: "skill_accuracy", weight: 0.1, score: 0.17, colour: "#f59e0b" },
    { label: "time_efficiency", weight: 0.05, score: 0.967, colour: "#34d399" },
    { label: "human_review", weight: 0.3, score: 0.2, colour: "#fb7185" },
  ];
  return (
    <AbsoluteFill
      style={{
        background: "#0a0a0f",
        padding: 80,
        fontFamily: "'IBM Plex Sans', 'Inter', sans-serif",
        color: "#fafafa",
        opacity,
      }}
    >
      <p
        style={{
          fontSize: 14,
          textTransform: "uppercase",
          letterSpacing: "0.18em",
          color: "#c88d4c",
          marginBottom: 12,
        }}
      >
        Composite formula
      </p>
      <h2 style={{ fontSize: 40, fontWeight: 600, margin: 0, marginBottom: 32 }}>
        0.177 = Σ (score × weight)
      </h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {dims.map((d, i) => {
          const rowOpacity = fade(frame, 25 + i * 8, 40 + i * 8);
          const barWidth = interpolate(
            frame,
            [35 + i * 8, 70 + i * 8],
            [0, d.score * d.weight * 1500],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          );
          return (
            <div
              key={d.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                opacity: rowOpacity,
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 16,
              }}
            >
              <div style={{ width: 240, color: "#a8a29e" }}>{d.label}</div>
              <div style={{ width: 60, color: "#a8a29e", fontSize: 13 }}>
                {d.score.toFixed(2)}
              </div>
              <div style={{ width: 60, color: "#a8a29e", fontSize: 13 }}>
                × {d.weight.toFixed(2)}
              </div>
              <div
                style={{
                  height: 6,
                  width: barWidth,
                  background: d.colour,
                  borderRadius: 3,
                }}
              />
              <div style={{ color: "#e0b378", fontSize: 14 }}>
                = {(d.score * d.weight).toFixed(4)}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}

function TracingGapScene() {
  const frame = useCurrentFrame();
  const opacity = fade(frame, 0, 20);
  const scale = interpolate(frame, [0, 40], [0.9, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill
      style={{
        background: "radial-gradient(circle at center, rgba(239,68,68,0.15), #0a0a0f 70%)",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'IBM Plex Sans', 'Inter', sans-serif",
        color: "#fafafa",
        padding: 80,
      }}
    >
      <div
        style={{
          opacity,
          transform: `scale(${scale})`,
          textAlign: "center",
          maxWidth: 900,
        }}
      >
        <p
          style={{
            fontSize: 14,
            textTransform: "uppercase",
            letterSpacing: "0.18em",
            color: "#f87171",
            marginBottom: 16,
          }}
        >
          The real problem
        </p>
        <h2 style={{ fontSize: 48, fontWeight: 600, margin: 0, lineHeight: 1.1 }}>
          <span style={{ color: "#f87171" }}>skill_accuracy: 0.17</span>
          <br />
          with no breakdown
        </h2>
        <p
          style={{
            fontSize: 20,
            marginTop: 28,
            color: "#a8a29e",
            lineHeight: 1.6,
          }}
        >
          The trace recorded only the aggregate. Which of the six expected skills fired?
          Which missed? We can&apos;t tell. Phase 25 fixes this.
        </p>
      </div>
    </AbsoluteFill>
  );
}

export function V8DissectionComposition() {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: "#0a0a0f" }}>
      <Sequence from={0} durationInFrames={5 * fps}>
        <TitleScene />
      </Sequence>
      <Sequence from={5 * fps} durationInFrames={10 * fps}>
        <FormulaScene />
      </Sequence>
      <Sequence from={15 * fps} durationInFrames={5 * fps}>
        <TracingGapScene />
      </Sequence>
    </AbsoluteFill>
  );
}
