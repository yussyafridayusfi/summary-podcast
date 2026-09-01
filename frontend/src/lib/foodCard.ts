/**
 * Food-review card scaffolds for the IMG export.
 *
 * Unlike the podcast sketchnote — where the model writes the HTML — these three
 * layouts are composed here from a small set of text slots the model fills in
 * (see FoodCardContent). The reference designs these copy are precise about
 * where things sit, and a model asked to place absolutely-positioned callouts
 * over a photo it cannot see produces a different layout every run.
 *
 * html2canvas constraint: it rasterises <img> but renders NOTHING for CSS
 * background-image or gradients, so every piece of artwork below is a real
 * <img> with an inline SVG data URI. Solid background-color is fine.
 */

import { SKETCH_H, SKETCH_W } from "./sketch";

export type FoodCardStyle = "sketchy" | "editorial" | "search";

export const FOOD_CARD_STYLES: {
  key: FoodCardStyle;
  label: string;
  hint: string;
}[] = [
  { key: "sketchy", label: "Sketchy", hint: "Hand-drawn doodles and callouts over your photo" },
  { key: "editorial", label: "Editorial", hint: "Clean serif headline, muted magazine layout" },
  { key: "search", label: "Search", hint: "Search-bar mockup framing the dish" },
];

/** The text slots the model fills in. Every field is optional at runtime. */
export interface FoodCardContent {
  title: string;
  tagline: string;
  /** 2-4 short callouts, used by the sketchy style. */
  labels: string[];
  /** 2-3 sentences, used by the editorial style. */
  body: string;
  /** Search-style phrasing, used by the search style. */
  query: string;
  suggestion: string;
}

export const EMPTY_CARD: FoodCardContent = {
  title: "",
  tagline: "",
  labels: [],
  body: "",
  query: "",
  suggestion: "",
};

const FONTS =
  "@import url('https://fonts.googleapis.com/css2?" +
  "family=Caveat:wght@500;600;700&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400" +
  "&family=Jost:wght@300;400;500&display=swap');";

const SERIF = `'Cormorant Garamond', Georgia, 'Times New Roman', serif`;
const SANS = `'Jost', 'Helvetica Neue', Arial, sans-serif`;
const HAND = `'Caveat', 'Bradley Hand', 'Marker Felt', cursive`;

function esc(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function svgUri(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * materialiseSketch() injects the podcast dot-grid paper into any #stage that
 * has no #paper child. These layouts supply their own, so it stays out.
 */
const TRANSPARENT_PAPER =
  "data:image/svg+xml;utf8," +
  encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='1' height='1'/>");

// ---------------------------------------------------------------------------
// Hand-drawn artwork (sketchy style)
// ---------------------------------------------------------------------------

const INK = "#ffffff";

/** Loose squiggle used along the top and bottom edges. */
const SQUIGGLE = svgUri(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 40' fill='none' stroke='${INK}' stroke-width='3' stroke-linecap='round'>` +
    `<path d='M6 24c14-16 28 12 42-2s28 10 42-4 28 12 42-2 28 10 42-4 28 12 42-2 28 10 42-4 28 12 42-2'/>` +
    `</svg>`,
);

/** Dashed connector from a label to the dish, with an arrowhead at the dish end. */
function connector(flip: boolean): string {
  const d = flip
    ? "M214 10C150 10 96 40 16 78"
    : "M6 10c64 0 118 30 198 68";
  const head = flip
    ? "M16 78l26-7M16 78l7-25"
    : "M204 78l-26-7M204 78l-7-25";
  return svgUri(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 220 88' fill='none' stroke='${INK}' stroke-width='3.5' stroke-linecap='round'>` +
      `<path d='${d}' stroke-dasharray='9 11'/><path d='${head}'/>` +
      `</svg>`,
  );
}

const CONNECTOR_R = connector(false);
const CONNECTOR_L = connector(true);

/** Small stars/sparkles scattered over the photo. */
const SPARKLE = svgUri(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40' fill='none' stroke='${INK}' stroke-width='2.5' stroke-linecap='round'>` +
    `<path d='M20 5v30M5 20h30M9 9l22 22M31 9L9 31'/>` +
    `</svg>`,
);

/** Rough hand-drawn ring, used to circle the dish. */
const RING = svgUri(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 600' fill='none' stroke='${INK}' stroke-width='4' stroke-linecap='round'>` +
    `<path d='M300 26c150 0 274 122 274 272 0 152-124 276-274 276S26 450 26 298C26 148 150 26 300 26'` +
    ` stroke-dasharray='0 0' opacity='.95'/>` +
    `<path d='M300 40c142 6 258 118 258 258' opacity='.5'/>` +
    `</svg>`,
);

const HEAD_DOTS = svgUri(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 90 20' fill='${INK}'>` +
    `<circle cx='12' cy='10' r='6'/><circle cx='45' cy='10' r='6'/><circle cx='78' cy='10' r='6'/></svg>`,
);

// ---------------------------------------------------------------------------

function shell(css: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<style>
${FONTS}
*, *::before, *::after { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body { width: ${SKETCH_W}px; height: ${SKETCH_H}px; overflow: hidden; }
#stage {
  position: relative;
  width: ${SKETCH_W}px;
  height: ${SKETCH_H}px;
  overflow: hidden;
  background-color: #efece6;
}
/* Kept so materialiseSketch() does not add the podcast dot-grid on top. */
#paper { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; }
${css}
</style>
</head>
<body>
<div id="stage">
<img id="paper" src="${TRANSPARENT_PAPER}" alt="">
${bodyHtml}
</div>
</body>
</html>`;
}

/** Placeholder when no photo was uploaded, so the layouts never show a gap. */
const NO_PHOTO = svgUri(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 108 135'>` +
    `<rect width='108' height='135' fill='#ddd8ce'/>` +
    `<path d='M30 86l18-22 14 17 10-12 16 21z' fill='#c3bcae'/>` +
    `<circle cx='40' cy='48' r='9' fill='#c3bcae'/></svg>`,
);

/**
 * Title size stepped down by length.
 *
 * The AI is asked for at most four words, but "my own words" puts the raw
 * description in the title — and a long one at the display size wraps onto
 * three lines and collides with whatever sits under it. Stepping the size down
 * keeps any length inside its block.
 */
function titleSize(text: string, biggest: number): number {
  const n = text.trim().length;
  if (n <= 18) return biggest;
  if (n <= 30) return Math.round(biggest * 0.8);
  if (n <= 45) return Math.round(biggest * 0.64);
  return Math.round(biggest * 0.52);
}

/**
 * How many arrangements each style offers. "Regenerate" steps through these, so
 * one style plus one set of words yields several different designs without
 * spending another model call.
 *
 * A variant only ever REARRANGES the card. None of them hides a slot: the user
 * typed those words, and having a callout silently vanish because they shuffled
 * the layout would be worse than a crowded card.
 */
export const VARIANTS_PER_STYLE = 4;

const SKETCHY_VARIANTS: string[] = [
  // 0 — title above a ringed dish, callouts down both sides.
  "",
  // 1 — title low, no ring, callouts clustered high.
  `
#ring { display: none; }
#shade { background-color: rgba(28,22,18,.38); }
#title { top: auto; bottom: 330px; }
.note-l0 { top: 168px; }
.note-r0 { top: 268px; }
.note-l1 { top: 430px; }
.note-r1 { top: 540px; }
.sp0 { left: 120px; top: 760px; }
.sp1 { right: 140px; top: 700px; }
.sp2 { left: 500px; top: 880px; }
`,
  // 2 — title flush left, dish ringed off-centre, callouts staggered lower.
  `
#title { text-align: left; padding-left: 78px; padding-right: 300px; top: 150px; }
.t-sub { transform: rotate(-2deg); }
#ring { left: 63%; top: 52%; width: 620px; height: 620px; opacity: .32; }
#shade { background-color: rgba(28,22,18,.34); }
.note-l0 { top: 470px; }
.note-l1 { top: 900px; }
.note-r0 { top: 660px; }
.note-r1 { top: 1090px; }
.edge-t { display: none; }
#foot { text-align: left; }
`,
  // 3 — centred title on a soft panel, callouts pulled in around the dish.
  `
#title {
  top: 232px;
  padding: 26px 70px 30px;
  background-color: rgba(24,19,16,.34);
}
#ring { top: 60%; width: 640px; height: 640px; }
.edge-t, .edge-b { display: none; }
.note-l0 { left: 40px; top: 566px; }
.note-r0 { right: 40px; top: 720px; }
.note-l1 { left: 40px; top: 980px; }
.note-r1 { right: 40px; top: 1104px; }
.sp0 { left: 96px; top: 430px; }
.sp1 { right: 110px; top: 470px; }
.sp2 { left: 520px; top: 1258px; }
`,
];

const EDITORIAL_VARIANTS: string[] = [
  // 0 — copy on the wall, photo along the base.
  "",
  // 1 — photo across the top, copy beneath it.
  `
#photo { top: 0; bottom: auto; height: 600px; }
#copy { top: 660px; }
.corner { top: auto; bottom: 90px; }
.stamp { bottom: auto; top: 150px; }
.stamp-rule { bottom: auto; top: 300px; }
`,
  // 2 — photo down the right edge, copy in the left column.
  `
#photo { left: 552px; top: 0; bottom: auto; width: 528px; height: 1350px; }
#copy { right: 590px; top: 120px; }
.ed-title { font-size: 84px; max-width: 440px; }
.ed-body { font-size: 26px; max-width: 430px; }
.corner { right: auto; left: 96px; top: auto; bottom: 110px; text-align: left; }
.stamp { right: 36px; bottom: 90px; }
.stamp-rule { right: 46px; bottom: 240px; height: 90px; }
`,
  // 3 — centred copy, a shallower photo band.
  `
#stage { background-color: #eeeae2; }
#photo { height: 430px; }
#copy { top: 150px; text-align: center; }
.kicker { letter-spacing: 8px; }
.ed-title { margin-left: auto; margin-right: auto; }
.ed-body { margin-left: auto; margin-right: auto; }
.ed-rule { margin-left: auto; margin-right: auto; }
.corner { display: none; }
.stamp { bottom: 60px; }
.stamp-rule { bottom: 190px; height: 80px; }
`,
];

const SEARCH_VARIANTS: string[] = [
  // 0 — name, search bar, then the dish on a card.
  "",
  // 1 — bar high, dish bleeding off the bottom edge.
  `
#brand { top: 58px; }
#bar { top: 196px; }
#photo { left: 0; top: 430px; width: 1080px; height: 920px; border-radius: 0; }
#caption { bottom: 44px; }
`,
  // 2 — dish fills the frame, bar sits low over it.
  `
#bg { display: none; }
#photo { left: 0; top: 0; width: 1080px; height: 1350px; border-radius: 0; box-shadow: none; }
#veil { background-color: rgba(20,18,16,.34); }
#brand { top: 88px; }
#bar { top: 1000px; }
#caption { bottom: 36px; }
`,
  // 3 — name low, dish framed tighter, bar beneath it.
  `
#brand { top: 150px; }
#photo { left: 150px; top: 360px; width: 780px; height: 590px; }
#bar { left: 120px; right: 120px; top: 1010px; }
.q { padding: 24px 32px; }
.q span { font-size: 29px; }
#caption { bottom: 52px; }
`,
];

// ---------------------------------------------------------------------------
// Style 1 — Sketchy: full-bleed photo with hand-drawn callouts over it.
// ---------------------------------------------------------------------------

function sketchy(c: FoodCardContent, photo: string, v: number): string {
  // Two callouts on the left, two on the right, at fixed slots — the connectors
  // are drawn to match these positions, so the count is capped at four.
  const labels = c.labels.filter((l) => l && l.trim()).slice(0, 4);
  const left = labels.filter((_, i) => i % 2 === 0);
  const right = labels.filter((_, i) => i % 2 === 1);

  const callout = (text: string, side: "l" | "r", idx: number) => `
    <div class="note note-${side} note-${side}${idx}">
      <span class="note-text">${esc(text)}</span>
      <img class="note-line" src="${side === "l" ? CONNECTOR_R : CONNECTOR_L}" alt="">
    </div>`;

  return shell(
    `
#photo { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
#shade { position: absolute; inset: 0; background-color: rgba(28,22,18,.30); }
/* Sits below the title block so the ring never cuts through the lettering. */
#ring {
  position: absolute; left: 50%; top: 56%;
  width: 700px; height: 700px; transform: translate(-50%,-50%) rotate(-6deg);
  opacity: .5;
}
.edge { position: absolute; left: 40px; width: 1000px; height: 40px; opacity: .85; }
.edge-t { top: 34px; }
.edge-b { bottom: 34px; transform: scaleY(-1); }

#title {
  position: absolute; left: 0; right: 0; top: 186px;
  text-align: center; color: #fff; padding: 0 70px;
}
/* Two shadows, not one: a tight dark halo keeps white lettering legible on a
   bright dish (a white plate is a common food photo), and the wide soft one
   gives it depth. A gradient scrim would be the usual fix, but html2canvas
   renders nothing for gradients, so the export would lose it. */
.t-main {
  font-family: ${SERIF};
  font-size: ${titleSize(c.title, 108)}px; font-weight: 300; line-height: .98;
  letter-spacing: 1px;
  text-shadow: 0 2px 5px rgba(0,0,0,.75), 0 3px 26px rgba(0,0,0,.55);
  margin: 0;
}
.t-sub {
  font-family: ${HAND};
  font-size: 62px; font-weight: 600;
  margin: -6px 0 0; transform: rotate(-3deg);
  text-shadow: 0 2px 5px rgba(0,0,0,.75), 0 3px 20px rgba(0,0,0,.55);
}

/* Four fixed slots flanking the dish; connector() is drawn to match them. */
.note { position: absolute; width: 300px; color: #fff; }
.note-text {
  display: inline-block;
  font-family: ${HAND}; font-size: 44px; line-height: 1.1;
  text-shadow: 0 2px 14px rgba(0,0,0,.6);
}
.note-line { display: block; width: 220px; height: 88px; opacity: .95; }
.note-l { left: 54px; text-align: left; }
.note-r { right: 54px; text-align: right; }
.note-r .note-line { margin-left: auto; }
.note-l0 { top: 392px; }
.note-l1 { top: 866px; }
.note-r0 { top: 612px; }
.note-r1 { top: 1046px; }

.sparkle { position: absolute; width: 40px; height: 40px; opacity: .85; }
.sp0 { left: 150px; top: 560px; }
.sp1 { right: 190px; top: 400px; }
.sp2 { left: 250px; top: 1150px; }

#foot {
  position: absolute; left: 70px; right: 70px; bottom: 110px;
  color: #fff; text-align: center;
}
#foot img { width: 90px; height: 20px; opacity: .9; }
#foot p {
  font-family: ${SANS}; font-weight: 300;
  font-size: 30px; line-height: 1.35; margin: 16px 0 0;
  text-shadow: 0 2px 14px rgba(0,0,0,.5);
}
${SKETCHY_VARIANTS[v] ?? ""}
`,
    `
<img id="photo" src="${photo}" alt="">
<div id="shade"></div>
<img id="ring" src="${RING}" alt="">
<img class="edge edge-t" src="${SQUIGGLE}" alt="">
<img class="edge edge-b" src="${SQUIGGLE}" alt="">
<img class="sparkle sp0" src="${SPARKLE}" alt="">
<img class="sparkle sp1" src="${SPARKLE}" alt="">
<img class="sparkle sp2" src="${SPARKLE}" alt="">
${left.map((t, i) => callout(t, "l", i)).join("")}
${right.map((t, i) => callout(t, "r", i)).join("")}
<div id="title">
  <p class="t-main">${esc(c.title)}</p>
  ${c.tagline ? `<p class="t-sub">${esc(c.tagline)}</p>` : ""}
</div>
<div id="foot">
  <img src="${HEAD_DOTS}" alt="">
  ${c.body ? `<p>${esc(c.body)}</p>` : ""}
</div>`,
  );
}

// ---------------------------------------------------------------------------
// Style 2 — Editorial: serif headline over a muted wall, photo filling the base.
// ---------------------------------------------------------------------------

function editorial(c: FoodCardContent, photo: string, meta: string, v: number): string {
  return shell(
    `
#stage { background-color: #e8e4dd; }
/* Explicit stack for the same reason as the search layout. */
#photo { z-index: 0; }
#copy, .corner, .stamp, .stamp-rule { z-index: 1; }
#copy { position: absolute; left: 96px; right: 96px; top: 96px; color: #3b3730; }
.kicker {
  font-family: ${SANS}; font-size: 22px; font-weight: 400;
  letter-spacing: 6px; text-transform: uppercase; color: #6d675d;
  margin: 0 0 26px;
}
.corner {
  position: absolute; right: 96px; top: 96px;
  font-family: ${SANS}; font-size: 22px; line-height: 1.35;
  text-align: right; color: #6d675d; letter-spacing: 1px;
}
.ed-title {
  font-family: ${SERIF}; font-weight: 300;
  font-size: ${titleSize(c.title, 122)}px; line-height: .95; letter-spacing: 1px;
  margin: 0 0 34px; max-width: 780px; color: #2f2b25;
}
.ed-body {
  font-family: ${SANS}; font-weight: 300;
  font-size: 30px; line-height: 1.5; max-width: 690px;
  margin: 0 0 22px; color: #4a453d;
}
.ed-rule { width: 62px; height: 2px; background-color: #8d8579; border: 0; margin: 34px 0 0; }
#photo {
  position: absolute; left: 0; bottom: 0;
  width: 100%; height: 620px; object-fit: cover;
}
.stamp {
  position: absolute; right: 40px; bottom: 150px;
  font-family: ${SANS}; font-size: 22px; letter-spacing: 3px; color: #fff;
  writing-mode: vertical-rl;
  text-shadow: 0 2px 10px rgba(0,0,0,.45);
}
.stamp-rule {
  position: absolute; right: 50px; bottom: 300px;
  width: 2px; height: 120px; background-color: rgba(255,255,255,.75);
}
${EDITORIAL_VARIANTS[v] ?? ""}
`,
    `
<div id="copy">
  <p class="kicker">About &amp; Food</p>
  <h1 class="ed-title">${esc(c.title)}</h1>
  ${c.body ? `<p class="ed-body">${esc(c.body)}</p>` : ""}
  ${c.tagline ? `<p class="ed-body">${esc(c.tagline)}</p>` : ""}
  <hr class="ed-rule">
</div>
<p class="corner">Food<br>review</p>
<img id="photo" src="${photo}" alt="">
<div class="stamp-rule"></div>
${meta ? `<p class="stamp">${esc(meta)}</p>` : ""}`,
  );
}

// ---------------------------------------------------------------------------
// Style 3 — Search: a generic search-bar mockup framing the dish.
//
// Deliberately unbranded: no real search engine's wordmark or colours, since
// these cards get posted publicly and must not read as that company's post.
// ---------------------------------------------------------------------------

const SEARCH_ICON = svgUri(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='#6b7280' stroke-width='2' stroke-linecap='round'>` +
    `<circle cx='11' cy='11' r='7'/><path d='M16.5 16.5L21 21'/></svg>`,
);

function search(c: FoodCardContent, photo: string, v: number): string {
  return shell(
    `
#stage { background-color: #1d1b19; }
/* No CSS filter here on purpose: html2canvas ignores filters, so a blurred
   backdrop would look right in the preview and sharp in the downloaded PNG.
   A dimmed, scaled copy of the photo reads the same in both. */
#bg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; transform: scale(1.2); opacity: .35; z-index: 0; }
#veil { position: absolute; inset: 0; background-color: rgba(20,18,16,.55); z-index: 0; }
/* Explicit stack: #photo sits after the chrome in DOM order, so a variant that
   makes it full-bleed would otherwise paint straight over the search bar. */
#photo { z-index: 1; }
#brand, #bar, #caption { z-index: 2; }

#brand {
  position: absolute; left: 70px; right: 70px; top: 96px;
  text-align: center;
  font-family: ${SERIF}; font-weight: 300;
  font-size: ${titleSize(c.title, 78)}px; line-height: 1.05; letter-spacing: 2px; color: #fff;
  margin: 0;
  text-shadow: 0 3px 20px rgba(0,0,0,.5);
}
#bar {
  position: absolute; left: 88px; right: 88px; top: 268px;
  background-color: #fff; border-radius: 34px; overflow: hidden;
  box-shadow: 0 12px 34px rgba(0,0,0,.32);
}
.q { display: flex; align-items: center; gap: 26px; padding: 30px 36px; }
.q img { width: 34px; height: 34px; flex: 0 0 auto; }
.q span {
  font-family: ${SANS}; font-weight: 400; font-size: 33px; color: #2b2b2b;
  overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
}
.q-divider { height: 1px; background-color: #e3e3e3; margin: 0 36px; }
.q-suggest span { color: #5f6368; }

#photo {
  position: absolute; left: 88px; top: 486px;
  width: 904px; height: 690px; object-fit: cover;
  border-radius: 20px;
  box-shadow: 0 22px 50px rgba(0,0,0,.45);
}
#caption {
  position: absolute; left: 90px; right: 90px; bottom: 62px;
  text-align: center; color: #fff;
  font-family: ${HAND}; font-size: 48px;
  margin: 0;
  text-shadow: 0 2px 14px rgba(0,0,0,.5);
}
${SEARCH_VARIANTS[v] ?? ""}
`,
    `
<img id="bg" src="${photo}" alt="">
<div id="veil"></div>
<p id="brand">${esc(c.title)}</p>
<div id="bar">
  <div class="q"><img src="${SEARCH_ICON}" alt=""><span>${esc(c.query)}</span></div>
  ${
    c.suggestion
      ? `<div class="q-divider"></div><div class="q q-suggest"><img src="${SEARCH_ICON}" alt=""><span>${esc(c.suggestion)}</span></div>`
      : ""
  }
</div>
<img id="photo" src="${photo}" alt="">
${c.tagline ? `<p id="caption">${esc(c.tagline)}</p>` : ""}`,
  );
}

// ---------------------------------------------------------------------------

/** The review fields `cardFromReview` reads. */
export interface ReviewWords {
  restoName?: string;
  description?: string | null;
  location?: string | null;
  dateVisit?: string | null;
  /** Notes HTML. */
  content?: string;
}

function plainText(html: string): string {
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/** First `max` sentences of a block of prose. */
function sentences(text: string, max: number): string {
  const parts = text.match(/[^.!?]+[.!?]*/g) ?? [];
  // Each captured part keeps its trailing space, so joining with another would
  // double it up on the card.
  return parts.slice(0, max).join(" ").replace(/\s+/g, " ").trim();
}

/**
 * Fills the card from the review's own wording — no model involved.
 *
 * For people who would rather see their own words on the card than a rewrite.
 * Nothing here invents phrasing: every slot is either copied from a field or
 * left empty for the user to type into.
 */
export function cardFromReview(r: ReviewWords): FoodCardContent {
  const desc = (r.description ?? "").trim();
  const resto = (r.restoName ?? "").trim();
  const place = (r.location ?? "").trim();
  const notes = plainText(r.content ?? "");

  return {
    // The dish is the headline; the restaurant is the fallback when it is blank.
    title: desc || resto,
    // Deliberately the place, not a slogan — a raw card should not fake a
    // creative line the user never wrote.
    tagline: desc && resto ? resto : place,
    // Comma-separated descriptions read as a natural callout list
    // ("bakso urat, kuah bening"); otherwise leave it for the user.
    labels: desc.includes(",")
      ? desc.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 4)
      : [],
    body: sentences(notes, 2).slice(0, 240),
    query: [desc || resto, place].filter(Boolean).join(" "),
    suggestion: resto,
  };
}

/**
 * Builds the complete 1080x1350 document for one style. `meta` is the small
 * vertical stamp on the editorial layout (a date or place).
 */
export function composeFoodCard(
  style: FoodCardStyle,
  content: FoodCardContent,
  photoDataUri?: string | null,
  meta = "",
  variant = 0,
): string {
  const photo = photoDataUri || NO_PHOTO;
  const c: FoodCardContent = { ...EMPTY_CARD, ...content };
  // Wraps, so callers can just keep incrementing to walk the arrangements.
  const v = ((variant % VARIANTS_PER_STYLE) + VARIANTS_PER_STYLE) % VARIANTS_PER_STYLE;
  if (style === "editorial") return editorial(c, photo, meta, v);
  if (style === "search") return search(c, photo, v);
  return sketchy(c, photo, v);
}
