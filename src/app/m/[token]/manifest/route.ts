// Per-move web manifest. Same look as the global one, but scoped to the
// move so installing from /m/<token> gives you a PWA that opens straight
// to that move.
export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const base = `/m/${token}`;
  const manifest = {
    name: "Tasks with Reminders",
    short_name: "Move Tasks",
    description: "A shared checklist for moving out — tasks, reminders, and inventory.",
    start_url: base,
    scope: base,
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0f172a",
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
  return new Response(JSON.stringify(manifest), {
    headers: {
      "Content-Type": "application/manifest+json",
      // Manifests should update reasonably often but not on every request.
      "Cache-Control": "public, max-age=60, s-maxage=60",
    },
  });
}
