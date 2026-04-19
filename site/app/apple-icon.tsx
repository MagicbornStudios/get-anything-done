import { ImageResponse } from "next/og";

/**
 * Task 45-17: apple-touch-icon — same evolutionary glyph as the favicon
 * scaled up. Larger canvas lets us add a subtle warm-radial glow that
 * matches the landing-page hero treatment.
 */

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "radial-gradient(circle at 50% 30%, #2a1f15 0%, #0a0a0c 70%)",
          borderRadius: 36,
        }}
      >
        <svg
          width="140"
          height="140"
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
      </div>
    ),
    { ...size },
  );
}
