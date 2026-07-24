import { ImageResponse } from "next/og";

// PNG icons at arbitrary sizes for the web manifest. Chrome's desktop
// installability check requires 192x192 and 512x512 rasters.
// Route: /icons/192  /icons/512  (etc.)
const ALLOWED = new Set([192, 256, 384, 512]);

export async function GET(
  _request: Request,
  context: { params: Promise<{ size: string }> },
) {
  const { size: raw } = await context.params;
  const size = Number.parseInt(raw, 10);
  if (!ALLOWED.has(size)) {
    return new Response("size not supported", { status: 400 });
  }

  const strokeWidth = Math.round(size * 0.1);
  const cornerRadius = Math.round(size * 0.19);
  const glyphSize = Math.round(size * 0.6);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#0f172a",
          borderRadius: cornerRadius,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg
          width={glyphSize}
          height={glyphSize}
          viewBox="0 0 512 512"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M138 262 L226 350 L374 172"
            stroke="#ffffff"
            strokeWidth={strokeWidth * 5}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
}
