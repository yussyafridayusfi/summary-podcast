/**
 * The app has several "sections" that share one summary shape but use
 * different words. Everything kind-specific for the UI lives here.
 */
export type Kind = "podcast" | "food";

export interface Section {
  id: Kind;
  label: string;
  icon: string;
  /** Header title for the section. */
  title: string;
  tagline: string;
  /** Field labels mapped onto the shared summary shape. */
  fieldA: string; // podcastName
  fieldAPlaceholder: string;
  fieldB: string; // sessionTitle
  fieldBPlaceholder: string;
  urlLabel: string;
  notesLabel: string;
  notesPlaceholder: string;
  takeawaysLabel: string;
  quotesLabel: string;
  emptyTitle: string;
  emptyHint: string;
  cardBadge: string;
  cardFooter: string;
  defaultStyle: string;
}

export const SECTIONS: Record<Kind, Section> = {
  podcast: {
    id: "podcast",
    label: "Podcast",
    icon: "🎙️",
    title: "Podcast Summary",
    tagline: "Turn episode notes into shareable cards.",
    fieldA: "Podcast",
    fieldAPlaceholder: "e.g. Huberman Lab",
    fieldB: "Episode title",
    fieldBPlaceholder: "e.g. The sleep toolkit",
    urlLabel: "Episode link",
    notesLabel: "Your notes",
    notesPlaceholder:
      "Paste rough notes, timestamps, quotes… anything. The messier the better — AI will tidy it up.",
    takeawaysLabel: "Key takeaways",
    quotesLabel: "Quotes",
    emptyTitle: "No podcast summaries yet",
    emptyHint: "Jot a few notes from an episode and let AI turn them into a shareable card.",
    cardBadge: "EPISODE NOTES",
    cardFooter: "made with Podcast Summary",
    defaultStyle: "playful",
  },
  food: {
    id: "food",
    label: "Food",
    icon: "🍜",
    title: "Food Summary",
    tagline: "Tasting notes, recipes and restaurant finds, summarised.",
    fieldA: "Restaurant / cuisine",
    fieldAPlaceholder: "e.g. Warung Bu Kris, Padang",
    fieldB: "Dish or meal",
    fieldBPlaceholder: "e.g. Rendang with jasmine rice",
    urlLabel: "Menu or recipe link",
    notesLabel: "Tasting notes",
    notesPlaceholder:
      "What did it taste like? Texture, spice, price, portion, who you would bring… or paste a recipe.",
    takeawaysLabel: "Highlights",
    quotesLabel: "One-line verdicts",
    emptyTitle: "No food summaries yet",
    emptyHint: "Describe a dish or paste a recipe and let AI plate it up as a shareable card.",
    cardBadge: "TASTING NOTES",
    cardFooter: "made with Food Summary",
    defaultStyle: "paper",
  },
};

export const SECTION_LIST = Object.values(SECTIONS);

export function isKind(v: unknown): v is Kind {
  return v === "podcast" || v === "food";
}
