import type { Metadata } from "next";

// A per-move manifest so that installing the PWA from a move page yields
// an installed app that opens directly to that move's URL, rather than
// the shared start_url from the global manifest.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  return {
    manifest: `/m/${token}/manifest`,
  };
}

export default function MoveLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
