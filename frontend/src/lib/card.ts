/**
 * Share-card renderer. Draws an AI illustration plus our own typography onto
 * a canvas so the result is crisp, brand-consistent, and exportable as PNG.
 */

export type Aspect = "square" | "story" | "wide";

export const ASPECTS: Record<Aspect, { label: string; w: number; h: number; hint: string }> = {
  square: { label: "Square", w: 1080, h: 1080, hint: "Feed post" },
  story: { label: "Story", w: 1080, h: 1920, hint: "Stories / Reels" },
  wide: { label: "Wide", w: 1600, h: 900, hint: "X / LinkedIn" },
};

export interface CardData {
  podcastName: string;
  headline: string;
  takeaways: string[];
  tags: string[];
  mood?: string | null;
  footer?: string;
  /** Small top-left label, e.g. "EPISODE NOTES". */
  badge?: string;
}

export interface CardTheme {
  /** Overlay gradient stops (top to bottom). */
  overlay: [string, string];
  text: string;
  accent: string;
  chipBg: string;
  chipFg: string;
}

export const THEMES: Record<string, CardTheme> = {
  playful: {
    overlay: ["rgba(20,10,60,0)", "rgba(20,10,60,0.92)"],
    text: "#ffffff",
    accent: "#ffd166",
    chipBg: "rgba(255,255,255,0.18)",
    chipFg: "#ffffff",
  },
  doodle: {
    overlay: ["rgba(255,255,255,0)", "rgba(255,255,255,0.96)"],
    text: "#1a1a2e",
    accent: "#ff6bcb",
    chipBg: "rgba(26,26,46,0.08)",
    chipFg: "#1a1a2e",
  },
  retro: {
    overlay: ["rgba(60,25,5,0)", "rgba(60,25,5,0.92)"],
    text: "#fff4e0",
    accent: "#f6b042",
    chipBg: "rgba(255,244,224,0.18)",
    chipFg: "#fff4e0",
  },
  neon: {
    overlay: ["rgba(5,0,25,0)", "rgba(5,0,25,0.94)"],
    text: "#ffffff",
    accent: "#00f0ff",
    chipBg: "rgba(255,0,200,0.25)",
    chipFg: "#ffffff",
  },
  paper: {
    overlay: ["rgba(50,30,20,0)", "rgba(50,30,20,0.9)"],
    text: "#fff8f0",
    accent: "#ffb347",
    chipBg: "rgba(255,248,240,0.18)",
    chipFg: "#fff8f0",
  },
  minimal: {
    overlay: ["rgba(10,10,20,0)", "rgba(10,10,20,0.9)"],
    text: "#ffffff",
    accent: "#a8ffdc",
    chipBg: "rgba(255,255,255,0.16)",
    chipFg: "#ffffff",
  },
};

const FONT = '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load the illustration."));
    img.src = src;
  });
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width <= maxW || !line) {
      line = test;
    } else {
      lines.push(line);
      line = w;
      if (lines.length === maxLines) break;
    }
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines) {
    // Ellipsize if we truncated.
    const used = lines.join(" ").split(/\s+/).length;
    if (used < words.length) {
      let last = lines[maxLines - 1];
      while (last && ctx.measureText(`${last}…`).width > maxW) {
        last = last.replace(/\s*\S+$/, "");
      }
      lines[maxLines - 1] = `${last}…`;
    }
  }
  return lines;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Draw image "cover"-style into the given box. */
function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  w: number,
  h: number,
  fallback: CardTheme,
) {
  if (!img) {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, "#6d4aff");
    g.addColorStop(0.55, "#ff6bcb");
    g.addColorStop(1, "#ffb347");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // playful blobs
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = fallback.text;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.arc(((i * 197) % w) + w * 0.1, ((i * 331) % h) + h * 0.05, w * 0.12 + i * 12, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    return;
  }
  const s = Math.max(w / img.width, h / img.height);
  const dw = img.width * s;
  const dh = img.height * s;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2 - (h - dh) * 0.15, dw, dh);
}

export interface RenderOptions {
  aspect: Aspect;
  style: string;
  image: HTMLImageElement | null;
  data: CardData;
}

export function renderCard(canvas: HTMLCanvasElement, opts: RenderOptions): void {
  const { w, h } = ASPECTS[opts.aspect];
  const theme = THEMES[opts.style] ?? THEMES.playful;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Scale factor keeps type proportional across aspect ratios.
  const u = Math.min(w, h) / 1080;
  const pad = 72 * u;

  drawCover(ctx, opts.image, w, h, theme);

  // Readability overlay
  const g = ctx.createLinearGradient(0, h * 0.25, 0, h);
  g.addColorStop(0, theme.overlay[0]);
  g.addColorStop(1, theme.overlay[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // Layout bottom-up so content hugs the base regardless of aspect.
  let y = h - pad;

  // Footer
  ctx.textBaseline = "alphabetic";
  ctx.font = `600 ${26 * u}px ${FONT}`;
  ctx.fillStyle = theme.text;
  ctx.globalAlpha = 0.7;
  const footer = opts.data.footer ?? "made with Summary Hub";
  ctx.fillText(`🎙  ${footer}`, pad, y);
  ctx.globalAlpha = 1;
  y -= 44 * u;

  // Tags
  const tags = opts.data.tags.slice(0, 4);
  if (tags.length) {
    ctx.font = `600 ${24 * u}px ${FONT}`;
    let x = pad;
    const th = 44 * u;
    for (const t of tags) {
      const label = `#${t}`;
      const tw = ctx.measureText(label).width + 30 * u;
      if (x + tw > w - pad) break;
      ctx.fillStyle = theme.chipBg;
      roundRect(ctx, x, y - th + 6 * u, tw, th, th / 2);
      ctx.fill();
      ctx.fillStyle = theme.chipFg;
      ctx.fillText(label, x + 15 * u, y - 8 * u);
      x += tw + 12 * u;
    }
    y -= th + 26 * u;
  }

  // Takeaways (max 3, or 4 on story)
  const maxTake = opts.aspect === "story" ? 4 : opts.aspect === "wide" ? 2 : 3;
  const takeaways = opts.data.takeaways.slice(0, maxTake);
  if (takeaways.length) {
    const size = 30 * u;
    const lh = size * 1.32;
    ctx.font = `500 ${size}px ${FONT}`;
    const blocks = takeaways.map((t) => wrap(ctx, t, w - pad * 2 - 44 * u, 2));
    const total = blocks.reduce((n, b) => n + b.length * lh + 16 * u, 0);
    let ty = y - total + lh;
    for (const lines of blocks) {
      // bullet
      ctx.fillStyle = theme.accent;
      ctx.beginPath();
      ctx.arc(pad + 10 * u, ty - size * 0.35, 8 * u, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = theme.text;
      for (const line of lines) {
        ctx.fillText(line, pad + 44 * u, ty);
        ty += lh;
      }
      ty += 16 * u;
    }
    y -= total + 22 * u;
  }

  // Headline
  const hlSize = opts.aspect === "wide" ? 60 * u : 68 * u;
  ctx.font = `800 ${hlSize}px ${FONT}`;
  const hlLines = wrap(ctx, opts.data.headline, w - pad * 2, opts.aspect === "wide" ? 2 : 3);
  const hlLh = hlSize * 1.1;
  let hy = y - (hlLines.length - 1) * hlLh;
  ctx.fillStyle = theme.text;
  ctx.shadowColor = "rgba(0,0,0,0.25)";
  ctx.shadowBlur = 12 * u;
  for (const line of hlLines) {
    ctx.fillText(line, pad, hy);
    hy += hlLh;
  }
  ctx.shadowBlur = 0;
  y -= hlLines.length * hlLh + 8 * u;

  // Podcast name + mood, small caps above the headline
  ctx.font = `700 ${26 * u}px ${FONT}`;
  ctx.fillStyle = theme.accent;
  const kicker = [opts.data.podcastName.toUpperCase(), opts.data.mood ? `· ${opts.data.mood}` : ""]
    .join(" ")
    .trim();
  ctx.fillText(wrap(ctx, kicker, w - pad * 2, 1)[0] ?? "", pad, y);

  // Top-left accent badge
  ctx.font = `700 ${24 * u}px ${FONT}`;
  const badge = opts.data.badge ?? "NOTES";
  const bw = ctx.measureText(badge).width + 36 * u;
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  roundRect(ctx, pad, pad, bw, 48 * u, 24 * u);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.fillText(badge, pad + 18 * u, pad + 33 * u);
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = "image/png"): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Export failed"))), type, 0.95);
  });
}

export function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
