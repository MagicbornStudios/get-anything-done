import { ImageResponse } from "next/og";

/**
 * Task 45-17: default OG image — evolutionary theme.
 * Layout: glyph left (large helix), wordmark + tagline right. Background
 * uses the same warm-radial treatment as the apple icon so social
 * unfurls feel like one product, not three different sites.
 *
 * Per-page metadata can override this by exporting its own
 * opengraph-image.tsx in the route folder.
 */

export const alt = "Get Anything Done — measurable AI agent workflows";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "flex-start",
          padding: "80px 96px",
          gap: 64,
          background:
            "radial-gradient(circle at 25% 30%, #2a1f15 0%, #0a0a0c 65%)",
          color: "#f5efe6",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <svg
          width="280"
          height="280"
          viewBox="0 0 28 28"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M6 3 C 18 8, 18 16, 6 21 C 18 23, 18 25, 22 25"
            stroke="#5fa3a0"
            strokeWidth="2.2"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M22 3 C 10 8, 10 16, 22 21 C 10 23, 10 25, 6 25"
            stroke="#9a7fc8"
            strokeWidth="2.2"
            strokeLinecap="round"
            fill="none"
          />
          <line x1="9" y1="7" x2="19" y2="7" stroke="#d49a5b" strokeWidth="1.4" strokeLinecap="round" />
          <line x1="9" y1="14" x2="19" y2="14" stroke="#d49a5b" strokeWidth="1.4" strokeLinecap="round" />
          <line x1="9" y1="21" x2="19" y2="21" stroke="#d49a5b" strokeWidth="1.4" strokeLinecap="round" />
        </svg>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 18,
            maxWidth: 720,
          }}
        >
          <div
            style={{
              fontSize: 22,
              letterSpacing: 4,
              textTransform: "uppercase",
              color: "#d49a5b",
              fontFamily: "ui-monospace, SFMono-Regular, monospace",
            }}
          >
            Get Anything Done
          </div>
          <div
            style={{
              fontSize: 76,
              lineHeight: 1.05,
              fontWeight: 700,
              letterSpacing: "-0.02em",
            }}
          >
            Measurable AI agent workflows.
          </div>
          <div
            style={{
              fontSize: 28,
              lineHeight: 1.35,
              color: "#b8b0a3",
            }}
          >
            Species, generations, conformance scores. Measured, not vibed.
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
