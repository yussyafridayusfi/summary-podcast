import type { ChatMessage } from "./text.ts";

/**
 * Demo-mode "model": builds a plausible summary JSON straight from the notes
 * so the whole UI (generate, review, export) can be tried with zero API keys.
 * Enabled with AI_TEXT_PROVIDER=mock. Never used automatically.
 */
export function mockCompletion(messages: ChatMessage[]): string {
  const user = messages.find((m) => m.role === "user")?.content ?? "";
  const isFood = /^Restaurant/m.test(user);
  const podcast =
    /^(?:Podcast|Restaurant[^:]*):\s*(.+)$/m.exec(user)?.[1]?.trim() ??
    (isFood ? "this place" : "This podcast");
  const episode =
    /^(?:Episode|Dish[^:]*):\s*(.+)$/m.exec(user)?.[1]?.trim() ??
    (isFood ? "this dish" : "this episode");
  const notesBlock = user.split(/## Notes/i)[1]?.split(/## Page context/i)[0] ?? user;

  const sentences = notesBlock
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim().replace(/^[-*•\d.)\s]+/, ""))
    .filter((s) => s.length > 12);

  const takeaways = sentences.slice(0, 5).map((s) => (s.length > 105 ? `${s.slice(0, 102)}…` : s));
  const quote = sentences.find((s) => /quote|"|“/i.test(s))?.replace(/^quote:\s*/i, "").replace(/["“”]/g, "");
  const words = notesBlock
    .toLowerCase()
    .match(/[a-z][a-z-]{4,}/g)
    ?.filter((w) => !STOP.has(w)) ?? [];
  const freq = new Map<string, number>();
  for (const w of words) freq.set(w, (freq.get(w) ?? 0) + 1);
  const tags = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([w]) => w);

  const out = {
    headline: `${episode}: ${takeaways.length} ideas worth stealing`,
    summary: [
      (isFood
        ? `${episode} at ${podcast}: ${sentences[0] ?? ""}`
        : `In this episode of ${podcast}, the conversation circles around ${episode.toLowerCase()}. ${sentences[0] ?? ""}`
      ).trim(),
      sentences.slice(1, 3).join(" "),
      "Demo mode: this text was assembled from your notes without a language model. Add a free API key to get a real AI summary.",
    ].filter(Boolean),
    takeaways,
    quotes: quote ? [quote] : [],
    tags: tags.length ? tags : ["podcast", "notes"],
    mood: "curious",
    coverPrompt: isFood
      ? `a steaming plate of ${episode.toLowerCase()} on a wooden table, fresh herbs, a smiling chef character peeking from behind, warm cozy light`
      : `a cheerful scene inspired by ${episode.toLowerCase()}: a friendly rounded character wearing headphones, ${tags.slice(0, 2).join(" and ")} props, soft pastel sky, floating musical notes`,
    suggestedStyle: "playful",
  };
  return JSON.stringify({ ...out, summary: out.summary.join("\n\n") });
}

const STOP = new Set(
  (
    "about above after again against around because before being below between could doing during " +
    "every first found further having hours minutes other people really should since something their " +
    "there these thing things think those through under until where which while within would quote " +
    "helps matters might maybe often always never little great pretty"
  ).split(" "),
);
