import { ImageResponse } from "next/og";

/**
 * Task 45-17: favicon — evolutionary theme.
 * Glyph: stylized DNA double-helix in two crossing strands with three rungs.
 * Strands use the species/generation level colors so the glyph reads as
 * "two lineages crossing" — the same metaphor the marketplace UI uses.
 */

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0c",
          borderRadius: 6,
        }}
      >
        <svg
          width="28"
          height="28"
          viewBox="0 0 28 28"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* species strand (teal) */}
          <path
            d="M6 3 C 18 8, 18 16, 6 21 C 18 23, 18 25, 22 25"
            stroke="#5fa3a0"
            strokeWidth="2.4"
            strokeLinecap="round"
            fill="none"
          />
          {/* generation strand (violet) */}
          <path
            d="M22 3 C 10 8, 10 16, 22 21 C 10 23, 10 25, 6 25"
            stroke="#9a7fc8"
            strokeWidth="2.4"
            strokeLinecap="round"
            fill="none"
          />
          {/* rungs (project gold) */}
          <line x1="9" y1="7" x2="19" y2="7" stroke="#d49a5b" strokeWidth="1.6" strokeLinecap="round" />
          <line x1="9" y1="14" x2="19" y2="14" stroke="#d49a5b" strokeWidth="1.6" strokeLinecap="round" />
          <line x1="9" y1="21" x2="19" y2="21" stroke="#d49a5b" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
