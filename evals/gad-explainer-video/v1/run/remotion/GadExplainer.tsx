import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Sequence,
} from "remotion";

/* ── Color palette ────────────────────────────────────────── */
const COLORS = {
  bg: "#0f172a", // slate-900
  emerald: "#10b981",
  sky: "#0ea5e9",
  amber: "#f59e0b",
  rose: "#f43f5e",
  white: "#f8fafc",
  muted: "#94a3b8",
  bgCard: "rgba(15,23,42,0.85)",
};

/* ── Reusable animated text ───────────────────────────────── */
const FadeSlideIn: React.FC<{
  children: React.ReactNode;
  delay: number;
  direction?: "up" | "down" | "left" | "right";
  style?: React.CSSProperties;
}> = ({ children, delay, direction = "up", style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({ frame: frame - delay, fps, config: { damping: 18, mass: 0.8 } });
  const axis = direction === "up" || direction === "down" ? "Y" : "X";
  const sign =
    direction === "down" || direction === "right" ? -1 : 1;
  const offset = interpolate(progress, [0, 1], [40 * sign, 0]);
  return (
    <div
      style={{
        opacity: interpolate(progress, [0, 1], [0, 1]),
        transform:
          axis === "Y"
            ? `translateY(${offset}px)`
            : `translateX(${offset}px)`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/* ── Section 1: Thesis (frames 0-210) ────────────────────── */
const ThesisSection: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const planningFiles = [
    { name: "STATE.xml", color: COLORS.sky, delay: 20 },
    { name: "ROADMAP.xml", color: COLORS.emerald, delay: 35 },
    { name: "TASK-REGISTRY.xml", color: COLORS.amber, delay: 50 },
    { name: "DECISIONS.xml", color: COLORS.rose, delay: 65 },
  ];

  const folderOpen = spring({ frame: frame - 10, fps, config: { damping: 14 } });
  const folderScale = interpolate(folderOpen, [0, 1], [0.8, 1]);
  const folderOpacity = interpolate(folderOpen, [0, 1], [0, 1]);

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at 50% 40%, #1e293b 0%, ${COLORS.bg} 70%)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 80,
      }}
    >
      {/* Thesis text — visible from ~frame 5 to 210 = 6.8 seconds (>3s gate) */}
      <FadeSlideIn delay={5} style={{ maxWidth: 1400, textAlign: "center", marginBottom: 60 }}>
        <h1
          style={{
            fontSize: 56,
            fontFamily: "Inter, system-ui, sans-serif",
            fontWeight: 700,
            color: COLORS.white,
            lineHeight: 1.3,
            letterSpacing: -1,
          }}
        >
          A system for evaluating and evolving agents through{" "}
          <span style={{ color: COLORS.sky }}>real tasks</span>,{" "}
          <span style={{ color: COLORS.amber }}>measurable pressure</span>, and{" "}
          <span style={{ color: COLORS.emerald }}>iteration</span>.
        </h1>
      </FadeSlideIn>

      {/* .planning/ folder cascade */}
      <div
        style={{
          opacity: folderOpacity,
          transform: `scale(${folderScale})`,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          alignItems: "flex-start",
        }}
      >
        {/* Folder header */}
        <FadeSlideIn delay={12} direction="left">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              fontSize: 28,
              fontFamily: "JetBrains Mono, monospace",
              color: COLORS.muted,
            }}
          >
            <span style={{ fontSize: 32 }}>📁</span> .planning/
          </div>
        </FadeSlideIn>

        {/* XML files cascading in */}
        {planningFiles.map((file) => {
          const fileSpring = spring({
            frame: frame - file.delay,
            fps,
            config: { damping: 12, stiffness: 120 },
          });
          const xOffset = interpolate(fileSpring, [0, 1], [-60, 0]);
          const opacity = interpolate(fileSpring, [0, 1], [0, 1]);
          return (
            <div
              key={file.name}
              style={{
                opacity,
                transform: `translateX(${xOffset}px)`,
                display: "flex",
                alignItems: "center",
                gap: 10,
                paddingLeft: 40,
                fontSize: 24,
                fontFamily: "JetBrains Mono, monospace",
                color: file.color,
              }}
            >
              <span style={{ color: COLORS.muted }}>├──</span>
              <span
                style={{
                  background: `${file.color}18`,
                  border: `1px solid ${file.color}40`,
                  borderRadius: 6,
                  padding: "4px 14px",
                }}
              >
                {file.name}
              </span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/* ── Section 2: Three Conditions (frames 210-420) ─────────── */
const ConditionCard: React.FC<{
  title: string;
  color: string;
  subtitle: string;
  detail: string;
  delay: number;
}> = ({ title, color, subtitle, detail, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const prog = spring({ frame: frame - delay, fps, config: { damping: 16 } });
  const scale = interpolate(prog, [0, 1], [0.7, 1]);
  const y = interpolate(prog, [0, 1], [80, 0]);

  return (
    <div
      style={{
        opacity: interpolate(prog, [0, 1], [0, 1]),
        transform: `translateY(${y}px) scale(${scale})`,
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        background: `${color}10`,
        border: `2px solid ${color}50`,
        borderRadius: 20,
        padding: "48px 32px",
        margin: "0 16px",
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: "50%",
          background: `${color}30`,
          border: `3px solid ${color}`,
          marginBottom: 20,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: "50%",
            background: color,
          }}
        />
      </div>
      <h2
        style={{
          fontSize: 36,
          fontFamily: "Inter, system-ui, sans-serif",
          fontWeight: 700,
          color,
          marginBottom: 12,
        }}
      >
        {title}
      </h2>
      <p
        style={{
          fontSize: 22,
          fontFamily: "Inter, system-ui, sans-serif",
          color: COLORS.white,
          textAlign: "center",
          marginBottom: 16,
          fontStyle: "italic",
        }}
      >
        "{subtitle}"
      </p>
      <p
        style={{
          fontSize: 18,
          fontFamily: "JetBrains Mono, monospace",
          color: COLORS.muted,
          textAlign: "center",
        }}
      >
        {detail}
      </p>
    </div>
  );
};

const ThreeConditionsSection: React.FC = () => {
  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(135deg, #0f172a 0%, #1a1a2e 100%)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "60px 80px",
      }}
    >
      <FadeSlideIn delay={0} style={{ marginBottom: 50 }}>
        <h2
          style={{
            fontSize: 42,
            fontFamily: "Inter, system-ui, sans-serif",
            fontWeight: 600,
            color: COLORS.white,
            textAlign: "center",
          }}
        >
          Three experimental conditions
        </h2>
      </FadeSlideIn>

      <div
        style={{
          display: "flex",
          width: "100%",
          maxWidth: 1600,
          justifyContent: "center",
        }}
      >
        <ConditionCard
          title="Bare"
          color={COLORS.emerald}
          subtitle="No framework. Just requirements."
          detail="2 skills"
          delay={15}
        />
        <ConditionCard
          title="GAD"
          color={COLORS.sky}
          subtitle="Full planning + 10 skills."
          detail=".planning/ + CLI"
          delay={30}
        />
        <ConditionCard
          title="Emergent"
          color={COLORS.amber}
          subtitle="Inherited + evolving skills."
          detail="6 compounding skills"
          delay={45}
        />
      </div>
    </AbsoluteFill>
  );
};

/* ── Section 3: Skeptic Disclosure (frames 420-630) ───────── */
const SkepticSection: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Pulse border glow
  const pulse = Math.sin(frame * 0.08) * 0.3 + 0.7;

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at 50% 50%, ${COLORS.rose}15, ${COLORS.bg} 70%)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 100,
      }}
    >
      <FadeSlideIn delay={5}>
        <div
          style={{
            border: `3px solid ${COLORS.rose}`,
            borderRadius: 24,
            padding: "60px 80px",
            maxWidth: 1300,
            background: COLORS.bgCard,
            boxShadow: `0 0 ${40 * pulse}px ${COLORS.rose}30`,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              marginBottom: 30,
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                background: COLORS.rose,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 24,
                color: COLORS.white,
                fontWeight: 700,
              }}
            >
              !
            </div>
            <h2
              style={{
                fontSize: 36,
                fontFamily: "Inter, system-ui, sans-serif",
                fontWeight: 700,
                color: COLORS.rose,
              }}
            >
              Honest disclosure
            </h2>
          </div>
          {/* This text visible from ~frame 425 to 630 = ~6.8s (>5s gate) */}
          <p
            style={{
              fontSize: 32,
              fontFamily: "Inter, system-ui, sans-serif",
              fontWeight: 400,
              color: COLORS.white,
              lineHeight: 1.7,
            }}
          >
            N=2-5 runs per condition. One reviewer.
            <br />
            <span style={{ color: COLORS.muted }}>
              Exploratory analysis, not proven findings.
            </span>
          </p>
        </div>
      </FadeSlideIn>
    </AbsoluteFill>
  );
};

/* ── Section 4: CTA Hook (frames 630-900) ─────────────────── */
const ArchiveThumbnail: React.FC<{
  label: string;
  color: string;
  score: string;
  delay: number;
  x: number;
}> = ({ label, color, score, delay, x }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const prog = spring({ frame: frame - delay, fps, config: { damping: 14, stiffness: 100 } });
  const y = interpolate(prog, [0, 1], [120, 0]);
  const opacity = interpolate(prog, [0, 1], [0, 1]);
  const rotate = interpolate(prog, [0, 1], [8, 0]);

  return (
    <div
      style={{
        opacity,
        transform: `translateY(${y}px) translateX(${x}px) rotate(${rotate}deg)`,
        width: 220,
        height: 160,
        borderRadius: 16,
        background: `linear-gradient(135deg, ${color}20, ${color}08)`,
        border: `2px solid ${color}60`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        margin: "0 12px",
      }}
    >
      <span
        style={{
          fontSize: 16,
          fontFamily: "JetBrains Mono, monospace",
          color: COLORS.muted,
          marginBottom: 8,
        }}
      >
        {label}
      </span>
      {/* Score badge */}
      <div
        style={{
          position: "absolute",
          top: -12,
          right: -12,
          background: color,
          color: COLORS.bg,
          fontSize: 18,
          fontWeight: 800,
          fontFamily: "Inter, system-ui, sans-serif",
          borderRadius: 10,
          padding: "4px 12px",
        }}
      >
        {score}
      </div>
      {/* Placeholder "screen" */}
      <div
        style={{
          width: "80%",
          height: 70,
          borderRadius: 8,
          background: `${color}15`,
          border: `1px solid ${color}30`,
        }}
      />
    </div>
  );
};

const CTASection: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const urlProg = spring({ frame: frame - 80, fps, config: { damping: 12 } });
  const urlOpacity = interpolate(urlProg, [0, 1], [0, 1]);
  const urlScale = interpolate(urlProg, [0, 1], [0.9, 1]);

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at 50% 60%, #1e293b 0%, ${COLORS.bg} 70%)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 80,
      }}
    >
      <FadeSlideIn delay={5} style={{ marginBottom: 50 }}>
        <h2
          style={{
            fontSize: 38,
            fontFamily: "Inter, system-ui, sans-serif",
            fontWeight: 600,
            color: COLORS.white,
            textAlign: "center",
          }}
        >
          Play the builds. Read the research. Fork the repo.
        </h2>
      </FadeSlideIn>

      {/* Archive thumbnails */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          marginBottom: 60,
        }}
      >
        <ArchiveThumbnail label="bare v3" color={COLORS.emerald} score="0.70" delay={15} x={0} />
        <ArchiveThumbnail label="GAD v8" color={COLORS.sky} score="0.45" delay={30} x={0} />
        <ArchiveThumbnail label="emergent v2" color={COLORS.amber} score="0.50" delay={45} x={0} />
        <ArchiveThumbnail label="bare v5" color={COLORS.emerald} score="0.65" delay={60} x={0} />
      </div>

      {/* URL */}
      <div
        style={{
          opacity: urlOpacity,
          transform: `scale(${urlScale})`,
          background: `linear-gradient(90deg, ${COLORS.sky}20, ${COLORS.emerald}20)`,
          border: `2px solid ${COLORS.sky}50`,
          borderRadius: 16,
          padding: "20px 48px",
        }}
      >
        <span
          style={{
            fontSize: 32,
            fontFamily: "JetBrains Mono, monospace",
            fontWeight: 600,
            color: COLORS.sky,
          }}
        >
          get-anything-done.vercel.app
        </span>
      </div>
    </AbsoluteFill>
  );
};

/* ── Main Composition ─────────────────────────────────────── */
export const GadExplainer: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: COLORS.bg }}>
      {/* Section 1: Thesis (0-7s = frames 0-210) */}
      <Sequence from={0} durationInFrames={210}>
        <ThesisSection />
      </Sequence>

      {/* Section 2: Three Conditions (7-14s = frames 210-420) */}
      <Sequence from={210} durationInFrames={210}>
        <ThreeConditionsSection />
      </Sequence>

      {/* Section 3: Skeptic Disclosure (14-21s = frames 420-630) */}
      <Sequence from={420} durationInFrames={210}>
        <SkepticSection />
      </Sequence>

      {/* Section 4: CTA Hook (21-30s = frames 630-900) */}
      <Sequence from={630} durationInFrames={270}>
        <CTASection />
      </Sequence>
    </AbsoluteFill>
  );
};
