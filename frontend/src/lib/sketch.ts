/**
 * Sketchnote ("visual notes") document scaffold for the IMG export.
 *
 * The hand-drawn look comes entirely from CSS and inline SVG, never from a
 * diffusion image: every word on the card has to stay crisp, and image models
 * render lettering as unreadable scribble.
 *
 * The class names below are a contract with the design prompt in
 * backend/src/routes/ai.ts — if you rename one, update that brief too.
 */

/** Instagram portrait (4:5), which fits far more notes than a square. */
export const SKETCH_W = 1080;
export const SKETCH_H = 1350;

/**
 * Handwriting faces, loaded from Google Fonts with macOS/Windows handwriting
 * fallbacks so the card still looks hand-drawn offline. `waitForFrame` awaits
 * document.fonts.ready, so the capture never races the webfont load.
 */
const FONT_IMPORT =
  "@import url('https://fonts.googleapis.com/css2?" +
  "family=Caveat:wght@500;600;700&family=Patrick+Hand&family=Kalam:wght@300;400;700" +
  "&display=swap');";

const HAND = `'Patrick Hand', 'Bradley Hand', 'Marker Felt', 'Comic Sans MS', cursive`;
const HAND_TITLE = `'Caveat', 'Bradley Hand', 'Marker Felt', 'Comic Sans MS', cursive`;
const HAND_BODY = `'Kalam', 'Patrick Hand', 'Bradley Hand', 'Comic Sans MS', cursive`;

export function composeSketchDocument(aiHtml: string, photoDataUri?: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<style>
${FONT_IMPORT}

*, *::before, *::after { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }

body {
  width: ${SKETCH_W}px;
  height: ${SKETCH_H}px;
  overflow: hidden;
}

#stage {
  position: relative;
  width: ${SKETCH_W}px;
  height: ${SKETCH_H}px;
  overflow: hidden;
  /* Warm paper + the faint dot grid that reads as a bullet-journal page. */
  background-color: #fdfbf4;
  font-family: ${HAND_BODY};
  color: #2b2b2b;
  padding: 54px 58px;
  font-size: 25px;
  line-height: 1.5;
  /* html2canvas under-measures spaces with webfonts, which runs words
     together in the export; a nudge keeps them separated. */
  word-spacing: 0.14em;
}

/* Holds the flowing content. autoFitSketch() scales this down when the model
   writes more than fits, so the card is never silently clipped. */
#fit {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  transform-origin: top center;
}

.food-photo { display: block; width: 100%; max-height: 720px; object-fit: cover; border-radius: 28px; margin: 16px 0 24px; }

/* Pins the final element to the bottom of the page. */
.push-bottom { margin-top: auto; }

/* ---- type ---------------------------------------------------------- */
.sk-title {
  font-family: ${HAND_TITLE};
  font-size: 68px;
  font-weight: 700;
  line-height: 1.05;
  margin: 0 0 6px;
  letter-spacing: .5px;
}
.sk-sub {
  font-family: ${HAND};
  font-size: 30px;
  color: #5d5a52;
  margin: 0 0 22px;
}
.sk-h {
  font-family: ${HAND};
  font-size: 34px;
  font-weight: 400;
  margin: 0 0 10px;
  letter-spacing: .3px;
}
.sk-small { font-size: 21px; color: #5d5a52; }

/* ---- marker highlighter (sits behind the words) -------------------- */
.mk {
  padding: 1px 8px 2px;
  border-radius: 4px;
  box-decoration-break: clone;
  -webkit-box-decoration-break: clone;
}
.mk-pink   { background: #fcd3de; }
.mk-yellow { background: #fdeaa8; }
.mk-blue   { background: #cfe4f7; }
.mk-green  { background: #cdebd0; }
.mk-purple { background: #e0d6f5; }

/* ---- hand-drawn underlines ----------------------------------------
   text-decoration rather than border-bottom: models often put .ul on a block
   (or a flex child, where display:inline is blockified), and a border there
   rules across the whole page instead of underlining the words. */
.ul {
  text-decoration-line: underline;
  text-decoration-thickness: 3px;
  text-underline-offset: 5px;
  text-decoration-color: #e0607d;
  -webkit-text-decoration-color: #e0607d;
}
.ul-red    { text-decoration-color: #e0607d; -webkit-text-decoration-color: #e0607d; }
.ul-blue   { text-decoration-color: #4f8fc0; -webkit-text-decoration-color: #4f8fc0; }
.ul-green  { text-decoration-color: #5aa966; -webkit-text-decoration-color: #5aa966; }
.ul-orange { text-decoration-color: #e2954b; -webkit-text-decoration-color: #e2954b; }

/* ---- numbered / lettered markers ---------------------------------- */
.num {
  font-family: ${HAND};
  font-weight: 700;
  font-size: 1.15em;
  margin-right: 6px;
}
.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 46px; height: 46px;
  border: 2.5px solid #3a3a3a;
  border-radius: 50%;
  font-family: ${HAND};
  font-size: 27px;
  flex: 0 0 auto;
  /* Slight tilt so the circles read as drawn, not printed. */
  transform: rotate(-4deg);
}
.badge-pink   { background: #fcd3de; }
.badge-blue   { background: #cfe4f7; }
.badge-green  { background: #cdebd0; }
.badge-yellow { background: #fdeaa8; }

/* ---- panels & layout ---------------------------------------------- */
.panel {
  position: relative;
  border: 3px solid #4f8fc0;
  border-radius: 8px;
  padding: 18px 22px;
  background: rgba(255,255,255,.45);
}
.panel-dashed { border-style: dashed; border-color: #8a8578; }
.cols { display: flex; gap: 30px; }
.col { flex: 1 1 0; min-width: 0; }
.row { display: flex; gap: 14px; align-items: center; margin: 4px 0; }
.rule { border: 0; border-top: 2.5px dashed #b9b4a4; margin: 20px 0; }

ul.sk { list-style: none; margin: 6px 0; padding: 0; }
ul.sk > li {
  position: relative;
  padding-left: 26px;
  margin: 7px 0;
}
ul.sk > li::before {
  content: "";
  position: absolute;
  left: 6px; top: .55em;
  width: 9px; height: 9px;
  background: #3a3a3a;
  border-radius: 50%;
}



/* ---- scene diagrams -------------------------------------------------
   Artwork is injected as real <img> elements by materialiseSketch(); these
   rules only size the box and place the labels. html2canvas renders 0 pixels
   for CSS background-image, so backgrounds must not be used for artwork. */
.scene {
  position: relative;
  width: 100%;
  margin: 10px auto 6px;
  font-family: 'Patrick Hand', 'Bradley Hand', 'Comic Sans MS', cursive;
}
.scene > img.scene-art {
  display: block;
  width: 100%;
  height: auto;
}
.scene .lbl {
  position: absolute;
  font-size: 19px;
  line-height: 1.15;
  text-align: center;
  letter-spacing: .4px;
  text-transform: uppercase;
  color: #4a4a4a;
}
.scene .mid {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  font-size: 26px;
  font-weight: 700;
  color: #2b2b2b;
}
.scene-gap { max-width: 620px; }
.scene-stairs { max-width: 400px; }
.scene-people { max-width: 460px; }
.scene-signpost { max-width: 400px; }

.scene-gap .lbl-l { left: 0;  top: 0; width: 34%; }
.scene-gap .lbl-r { right: 0; top: 0; width: 34%; }
.scene-gap .mid   { bottom: 6%; }
.scene-stairs .lbl-r { right: 0; top: 0;    width: 44%; }
.scene-stairs .lbl-l { left: 0;  bottom: 0; width: 40%; }
.scene-people .mid { bottom: -2%; }
.scene-signpost .lbl-l { left: 0;  top: 22%; width: 32%; }
.scene-signpost .lbl-r { right: 0; top: 58%; width: 32%; }

/* ---- doodles --------------------------------------------------------
   The model writes <i class="dd dd-bulb"></i>; materialiseSketch() swaps in a
   real <img>, which is what html2canvas can actually rasterise. */
.dd {
  display: inline-block;
  width: 58px;
  height: 58px;
  flex: 0 0 auto;
  vertical-align: middle;
}
.dd-sm { width: 42px; height: 42px; }
.dd-lg { width: 76px; height: 76px; }

/* Paper texture layer, injected behind the content. */
#paper {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
}
#fit { position: relative; z-index: 1; }
</style>
</head>
<body>
<div id="stage">
<div id="fit">
${photoDataUri ? `<img class="food-photo" src="${photoDataUri}" alt="Uploaded food" />` : ""}
${aiHtml}
</div>
</div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Artwork sources. Kept as raw SVG so both the CSS-free <img> injection and any
// future use share one definition.
// ---------------------------------------------------------------------------

const STROKE = "stroke='#3a3a3a' fill='none' stroke-linecap='round' stroke-linejoin='round'";

function uri(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function icon(d: string): string {
  return uri(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' width='24' height='24' ${STROKE} stroke-width='1.9'><path d='${d}'/></svg>`,
  );
}

/** Small inline doodles, keyed by the dd-NAME the prompt advertises. */
export const DOODLE_URI: Record<string, string> = {
  bulb: icon('M9 18.5h6M10 21.5h4M12 2.5a6.5 6.5 0 00-4 11.6v2.4h8v-2.4a6.5 6.5 0 00-4-11.6z'),
  moon: icon('M20.5 14.2A8.6 8.6 0 0110 3.4 8.6 8.6 0 1020.5 14.2z'),
  coffee: icon('M4 8h12v6.2A4 4 0 0112 18.2H8A4 4 0 014 14.2V8zM16 9.2h1.9a2.1 2.1 0 010 4.2H16M4.6 21h12.8'),
  clock: icon('M12 21a9 9 0 100-18 9 9 0 000 18zM12 7.2v5.1l3.2 2'),
  star: icon('M12 3l2.6 5.6 6.1.8-4.5 4.2 1.2 6-5.4-3.1-5.4 3.1 1.2-6L3.3 9.4l6.1-.8z'),
  arrow: icon('M3.2 12h15.4M13.8 6.8l5 5.2-5 5.2'),
  swirl: icon('M3.5 17.5c4.5-9.5 11.5-9.5 15.5-4.5M14.6 13.4l4.6-.6-.8 4.6'),
  person: icon('M12 7.4a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM12 10v6.6M7.6 20.8l4.4-4.6 4.4 4.6M8 12.6h8'),
  search: icon('M10.4 16.6a6.2 6.2 0 100-12.4 6.2 6.2 0 000 12.4zM15.2 15.4l5 5'),
  cloud: icon('M7.2 17.4h9.6a4.1 4.1 0 00.2-8.2 5.6 5.6 0 00-10.6 1.6 3.3 3.3 0 00.8 6.6z'),
  heart: icon('M12 20.4S4.8 15.6 4.8 10.8A4.1 4.1 0 0112 8a4.1 4.1 0 017.2 2.8c0 4.8-7.2 9.6-7.2 9.6z'),
  target: icon('M12 21a9 9 0 100-18 9 9 0 000 18zM12 17.2a5.2 5.2 0 100-10.4 5.2 5.2 0 000 10.4zM12 13.4a1.4 1.4 0 100-2.8 1.4 1.4 0 000 2.8z'),
  scales: icon('M12 4.2v14M6 21h12M4 9.4h16M4 9.4l-2 4.2a3 3 0 006 0zM20 9.4l2 4.2a3 3 0 01-6 0z'),
  globe: icon('M12 21a9 9 0 100-18 9 9 0 000 18zM3.2 12h17.6M12 3.2a13.5 13.5 0 000 17.6 13.5 13.5 0 000-17.6z'),
  bolt: icon('M13.4 2.8L6 14.2h5.2l-1 7 7.4-11.6h-5.2z'),
  check: icon('M4 13.2l5.2 5.4L20 6.2'),
  book: icon('M4 4.6h7.8v15H4zM12.2 4.6H20v15h-7.8M12 4.6v15'),
  sign: icon('M12 21V5.4M5 7.2h9.4l3-2.2-3-2.2H5zM19 13.4H9.6l-3-2.2 3-2.2H19z'),
};

function scene(vb: string, body: string): string {
  const [, , w, h] = vb.split(" ");
  return uri(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='${vb}' width='${w}' height='${h}' ${STROKE} stroke-width='2.2'>${body}</svg>`,
  );
}

const hatchL = Array.from({ length: 8 }, (_, i) => `<path d='M${20 + i * 14} 116 l-8 14'/>`).join("");
const hatchR = Array.from({ length: 8 }, (_, i) => `<path d='M${278 + i * 14} 116 l-8 14'/>`).join("");
const stick = (x: number) =>
  `<circle cx='${x}' cy='78' r='8'/><path d='M${x} 86v18M${x - 11} 93h22M${x} 104l-8 13M${x} 104l8 13'/>`;

/** Full conceptual diagrams, keyed by the scene-NAME the prompt advertises. */
export const SCENE_URI: Record<string, string> = {
  gap: scene(
    "0 0 400 170",
    `<path d='M12 112h124v5H12z'/>${hatchL}<path d='M270 112h118v5H270z'/>${hatchR}` +
      "<circle cx='96' cy='78' r='7'/><path d='M96 85v16M87 92h18M96 101l-7 11M96 101l7 11'/>" +
      "<path d='M300 112V74'/><path d='M300 74l20 7-20 7z'/>" +
      "<path stroke-dasharray='7 7' d='M140 104Q205 46 266 104'/><path d='M258 96l9 9-11 3'/>",
  ),
  stairs: scene(
    "0 0 280 170",
    "<path d='M16 150h48v-28h48V94h48V66h48V38'/>" +
      "<circle cx='196' cy='22' r='7'/><path d='M196 29v15M188 35h16M196 44l-7 10M196 44l7 10'/>" +
      "<path stroke-dasharray='6 6' d='M30 128C90 120 150 92 214 24'/>",
  ),
  people: scene(
    "0 0 300 140",
    stick(60) + stick(150) + stick(240) +
      "<path d='M92 34h44a8 8 0 018 8v14a8 8 0 01-8 8h-30l-10 9v-9a8 8 0 01-4-8V42a8 8 0 010-8z'/>" +
      "<path d='M176 22h44a8 8 0 018 8v14a8 8 0 01-8 8h-30l-10 9v-9a8 8 0 01-4-8V30a8 8 0 010-8z'/>",
  ),
  signpost: scene(
    "0 0 280 160",
    "<path d='M140 150V26'/><path d='M132 50H44l-18 14 18 14h88z'/>" +
      "<path d='M148 92h88l18 14-18 14h-88z'/><path d='M120 150h40'/>",
  ),
};

/** Intrinsic pixel size of each scene's artwork, used to size the <img>. */
export const SCENE_DIMS: Record<string, [number, number]> = {
  gap: [400, 170],
  stairs: [280, 170],
  people: [300, 140],
  signpost: [280, 160],
};

/** Cream page with the bullet-journal dot grid, as a rasterisable image. */
export const PAPER_URI = uri(
  `<svg xmlns='http://www.w3.org/2000/svg' width='${SKETCH_W}' height='${SKETCH_H}'>` +
    "<defs><pattern id='p' width='24' height='24' patternUnits='userSpaceOnUse'>" +
    "<circle cx='3' cy='3' r='1.4' fill='#d9d5c4'/></pattern></defs>" +
    "<rect width='100%' height='100%' fill='#fdfbf4'/>" +
    "<rect width='100%' height='100%' fill='url(#p)'/></svg>",
);
