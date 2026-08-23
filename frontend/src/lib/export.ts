/**
 * Composition, rasterisation and download helpers for the generated artefacts.
 *
 * AI-authored HTML is always rendered inside a sandboxed same-origin iframe:
 * that keeps its CSS from leaking into the app (a stray `body { background }`
 * rule would otherwise repaint the whole page) while still letting html2canvas
 * read computed styles for the capture.
 */
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import {
  DOODLE_URI,
  PAPER_URI,
  SCENE_DIMS,
  SCENE_URI,
  SKETCH_H,
  SKETCH_W,
  composeSketchDocument,
} from "./sketch";

export { SKETCH_H, SKETCH_W, composeSketchDocument };

const BASE_RESET = `
  *, *::before, *::after { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  img { max-width: 100%; }
`;

/** Wraps generated markup in a standalone document for preview/download. */
export function composeDocument(aiHtml: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>${BASE_RESET}
  body { background: #ffffff; }
</style>
</head>
<body>
${aiHtml}
</body>
</html>`;
}


/**
 * Turns the model's lightweight placeholders into real <img> elements.
 *
 * html2canvas rasterises <img> but renders nothing at all for CSS
 * background-image or gradients, so every piece of artwork — paper texture,
 * doodles, scene diagrams — has to exist as an actual element by capture time.
 * Idempotent, so calling it for the preview and again before capture is safe.
 */
export function materialiseSketch(doc: Document): void {
  const stage = doc.getElementById("stage");
  if (!stage) return;

  if (!doc.getElementById("paper")) {
    const paper = doc.createElement("img");
    paper.id = "paper";
    paper.src = PAPER_URI;
    paper.alt = "";
    stage.insertBefore(paper, stage.firstChild);
  }

  // <i class="dd dd-bulb"> -> <img class="dd dd-bulb" src="...">
  doc.querySelectorAll("i.dd, span.dd").forEach((el) => {
    const name = [...el.classList]
      .filter((c) => c.startsWith("dd-"))
      .map((c) => c.slice(3))
      .find((k) => k in DOODLE_URI);
    const img = doc.createElement("img");
    img.className = el.className;
    img.src = name ? DOODLE_URI[name] : DOODLE_URI.star;
    img.alt = "";
    // Explicit width/height attributes are required: html2canvas draws nothing
    // for an SVG <img> that is sized only by CSS.
    const px = el.classList.contains("dd-lg")
      ? 76
      : el.classList.contains("dd-sm")
        ? 42
        : 58;
    img.setAttribute("width", String(px));
    img.setAttribute("height", String(px));
    el.replaceWith(img);
  });

  doc.querySelectorAll(".scene").forEach((el) => {
    if (el.querySelector("img.scene-art")) return;
    const key = [...el.classList]
      .filter((c) => c.startsWith("scene-"))
      .map((c) => c.slice(6))
      .find((k) => k in SCENE_URI);
    if (!key) return;
    const img = doc.createElement("img");
    img.className = "scene-art";
    img.src = SCENE_URI[key];
    img.alt = "";
    const [w, h] = SCENE_DIMS[key] ?? [400, 170];
    img.setAttribute("width", String(w));
    img.setAttribute("height", String(h));
    el.insertBefore(img, el.firstChild);
  });
}

/**
 * Scales the sketchnote's content down when the model writes more than fits the
 * fixed 1080x1350 page. Without this the overflow is simply cropped out of the
 * capture, silently losing the end of the notes.
 */
export function autoFitSketch(doc: Document): number {
  const stage = doc.getElementById("stage");
  const fit = doc.getElementById("fit");
  if (!stage || !fit) return 1;

  fit.style.transform = "";
  const available =
    stage.clientHeight -
    (parseFloat(getComputedStyle(stage).paddingTop) +
      parseFloat(getComputedStyle(stage).paddingBottom));
  const needed = fit.scrollHeight;
  if (needed <= available) return 1;

  // Floor the shrink: past this the handwriting stops being readable in a feed,
  // and it's better to let the layout be tight than illegible.
  const ratio = Math.max(available / needed, 0.62);
  fit.style.transform = `scale(${ratio})`;
  fit.style.width = `${100 / ratio}%`;
  fit.style.marginLeft = `${-((100 / ratio - 100) / 2)}%`;
  return ratio;
}

/** Waits for the iframe document (and its images/fonts) to settle. */
export async function waitForFrame(iframe: HTMLIFrameElement): Promise<Document> {
  const doc = iframe.contentDocument;
  if (!doc) throw new Error("preview frame is not accessible");

  if (doc.readyState !== "complete") {
    await new Promise<void>((resolve) => {
      const done = () => resolve();
      iframe.addEventListener("load", done, { once: true });
      // srcdoc frames can already be complete by the time we attach.
      if (doc.readyState === "complete") {
        iframe.removeEventListener("load", done);
        resolve();
      }
    });
  }

  const images = Array.from(doc.images);
  await Promise.all(
    images.map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            img.addEventListener("load", () => resolve(), { once: true });
            img.addEventListener("error", () => resolve(), { once: true });
          }),
    ),
  );

  if (doc.fonts?.ready) {
    await doc.fonts.ready.catch(() => undefined);
  }

  // Artwork must exist before measuring, and fonts before that again.
  materialiseSketch(doc);
  autoFitSketch(doc);

  return doc;
}

interface CaptureOptions {
  width?: number;
  height?: number;
  scale?: number;
}

async function captureCanvas(
  iframe: HTMLIFrameElement,
  opts: CaptureOptions = {},
): Promise<HTMLCanvasElement> {
  const doc = await waitForFrame(iframe);
  const target = (doc.getElementById("stage") ?? doc.body) as HTMLElement;

  const width = opts.width ?? target.scrollWidth;
  const height = opts.height ?? target.scrollHeight;

  return html2canvas(target, {
    backgroundColor: "#ffffff",
    scale: opts.scale ?? 2,
    width,
    height,
    windowWidth: width,
    windowHeight: height,
    useCORS: true,
    logging: false,
  });
}

export function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "summary"
  );
}

function triggerDownload(href: string, filename: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Rasterises the sketchnote card and downloads it as a PNG. */
export async function downloadPng(
  iframe: HTMLIFrameElement,
  filename: string,
): Promise<void> {
  const canvas = await captureCanvas(iframe, {
    width: SKETCH_W,
    height: SKETCH_H,
    // 2x keeps the handwriting crisp when Instagram re-compresses it.
    scale: 2,
  });
  triggerDownload(canvas.toDataURL("image/png"), `${filename}.png`);
}

/**
 * Rasterises the document and lays it into an A4 PDF, paginating when the
 * capture is taller than a single page so nothing gets silently cut off.
 */
export async function downloadPdf(
  iframe: HTMLIFrameElement,
  filename: string,
): Promise<void> {
  const canvas = await captureCanvas(iframe, { scale: 2 });

  const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  // Source pixels that map onto one PDF page at full page width.
  const scale = pageWidth / canvas.width;
  const sliceHeightPx = Math.floor(pageHeight / scale);

  // JPEG rather than PNG: lossless slices of a full-page render push a handful
  // of pages into the tens of megabytes, which is unusable for sharing.
  const JPEG_QUALITY = 0.92;

  if (canvas.height <= sliceHeightPx) {
    pdf.addImage(
      canvas.toDataURL("image/jpeg", JPEG_QUALITY),
      "JPEG",
      0,
      0,
      pageWidth,
      canvas.height * scale,
    );
  } else {
    let offset = 0;
    let page = 0;
    while (offset < canvas.height) {
      const h = Math.min(sliceHeightPx, canvas.height - offset);
      const slice = document.createElement("canvas");
      slice.width = canvas.width;
      slice.height = h;
      const ctx = slice.getContext("2d");
      if (!ctx) throw new Error("could not create PDF page canvas");
      // JPEG has no alpha, so lay the slice on white to avoid black fringing.
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, slice.width, slice.height);
      ctx.drawImage(canvas, 0, offset, canvas.width, h, 0, 0, canvas.width, h);

      if (page > 0) pdf.addPage();
      pdf.addImage(
        slice.toDataURL("image/jpeg", JPEG_QUALITY),
        "JPEG",
        0,
        0,
        pageWidth,
        h * scale,
      );

      offset += h;
      page += 1;
    }
  }

  pdf.save(`${filename}.pdf`);
}

/** Downloads the composed document as a standalone .html file. */
export function downloadHtml(html: string, filename: string): void {
  const url = URL.createObjectURL(
    new Blob([html], { type: "text/html;charset=utf-8" }),
  );
  triggerDownload(url, `${filename}.html`);
  // Give the click a tick to be handled before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
