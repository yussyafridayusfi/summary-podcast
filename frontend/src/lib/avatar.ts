import { api } from "../api/client";

/**
 * Generated profile pictures. Most styles are DiceBear SVGs (deterministic
 * per seed, no key, instant). "ai" routes through our image proxy for a
 * painted portrait; it is slower but fun.
 */
export const AVATAR_STYLES: { id: string; label: string; hint: string }[] = [
  { id: "adventurer", label: "Adventurer", hint: "Illustrated faces" },
  { id: "notionists", label: "Notion", hint: "Minimal line art" },
  { id: "fun-emoji", label: "Emoji", hint: "Round & expressive" },
  { id: "bottts", label: "Bot", hint: "Friendly robots" },
  { id: "pixel-art", label: "Pixel", hint: "8-bit sprites" },
  { id: "thumbs", label: "Thumbs", hint: "Chunky shapes" },
  { id: "ai", label: "AI portrait", hint: "Painted by a model" },
];

export function avatarUrl(style: string, seed: string, size = 128): string {
  if (style === "ai") {
    return api.ai.imageUrl({
      prompt: `a friendly stylised portrait avatar of a person with a warm smile, bust shot, centered, simple background`,
      style: "playful",
      seed: hashSeed(seed),
      w: 512,
      h: 512,
    });
  }
  const q = new URLSearchParams({ seed, size: String(size), radius: "0" });
  return `https://api.dicebear.com/9.x/${encodeURIComponent(style)}/svg?${q}`;
}

function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 2_000_000_000;
}
