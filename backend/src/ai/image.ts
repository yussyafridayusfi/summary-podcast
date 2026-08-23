/**
 * Illustrated background generation via Pollinations.
 *
 * Pollinations needs no API key, which is why it's used for imagery even when
 * text generation runs through a different provider.
 *
 * The bytes are proxied through this server and returned as a data: URI on
 * purpose: the frontend rasterises the finished card with html2canvas, and a
 * cross-origin <img> would taint the canvas and make toDataURL() throw.
 */

const TIMEOUT_MS = 120_000;

export interface GeneratedImage {
  dataUri: string;
  bytes: number;
  contentType: string;
}

export async function generateBackgroundImage(
  prompt: string,
  opts: { width?: number; height?: number; seed?: number } = {},
): Promise<GeneratedImage> {
  const width = opts.width ?? 1080;
  const height = opts.height ?? 1080;

  const url = new URL(
    `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}`,
  );
  url.searchParams.set("width", String(width));
  url.searchParams.set("height", String(height));
  url.searchParams.set("nologo", "true");
  if (opts.seed !== undefined) url.searchParams.set("seed", String(opts.seed));

  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) {
    throw new Error(`image provider returned ${res.status}`);
  }

  const contentType = res.headers.get("content-type") ?? "image/jpeg";
  if (!contentType.startsWith("image/")) {
    throw new Error(`image provider returned non-image (${contentType})`);
  }

  const buf = Buffer.from(await res.arrayBuffer());
  return {
    dataUri: `data:${contentType};base64,${buf.toString("base64")}`,
    bytes: buf.byteLength,
    contentType,
  };
}
