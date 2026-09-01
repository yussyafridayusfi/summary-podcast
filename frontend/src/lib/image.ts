/**
 * Client-side image handling.
 *
 * Images are stored inline as base64 data URIs — in the food review's photo
 * column, and inside the notes HTML for editor uploads. Base64 adds ~33% on top
 * of the file size and every copy travels in each request, so nothing is stored
 * at its original resolution.
 */

/** Longest edge, in pixels, of an image stored as a data URI. */
export const PHOTO_MAX_EDGE = 1600;

/** Notes can hold several images, so they are held to a tighter budget. */
export const NOTE_IMAGE_MAX_EDGE = 1200;

export class ImageReadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageReadError";
  }
}

/**
 * Re-encodes an image file to a JPEG data URI no larger than `maxEdge` on its
 * long side. Returns the original dimensions so callers can report what changed.
 */
export function downscaleImage(
  file: File,
  maxEdge: number,
  quality = 0.85,
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new ImageReadError("that file is not an image"));
      return;
    }

    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new ImageReadError("could not read the image"));
        return;
      }
      // JPEG has no alpha; without this, transparent PNGs rasterise onto black.
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new ImageReadError("that file could not be read as an image"));
    };

    img.src = url;
  });
}

/**
 * First embedded image in a block of notes HTML, if there is one.
 *
 * The export needs a photo, and people reasonably drop one into the notes with
 * the editor's image button rather than into the dedicated photo field — so the
 * notes are used as a fallback source.
 *
 * Only `data:` images qualify: remote URLs would have to survive html2canvas's
 * CORS fetch at capture time, and a broken box in a downloaded card is worse
 * than the placeholder. Parsing is done with DOMParser, which builds an inert
 * document — no scripts run and no resources load.
 */
export function firstImageInHtml(html: string): string | null {
  if (!html || !html.includes("<img")) return null;
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    for (const img of Array.from(doc.querySelectorAll("img"))) {
      const src = img.getAttribute("src") ?? "";
      if (src.startsWith("data:image/")) return src;
    }
  } catch {
    // Malformed markup — fall through to "no image".
  }
  return null;
}

/** Opens the OS file picker and resolves with the chosen file, or null. */
export function pickImageFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.style.display = "none";
    document.body.appendChild(input);

    // `change` never fires when the picker is dismissed, so the element would
    // leak; `cancel` is fired by modern browsers for exactly that case.
    const cleanup = () => input.remove();
    input.addEventListener("change", () => {
      const file = input.files?.[0] ?? null;
      cleanup();
      resolve(file);
    });
    input.addEventListener("cancel", () => {
      cleanup();
      resolve(null);
    });

    input.click();
  });
}
