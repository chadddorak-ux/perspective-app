// Reads a pitch PDF in the browser: its text (for the parser), the photos
// embedded in it (for the campaign's cover and gallery) and small page
// previews. pdf.js loads on demand and runs on the main thread, so this works
// the same in the Next app and the single-file build.

export type PdfRead = {
  pages: number;
  text: string;
  /** Embedded photos, largest first, as JPEG data URLs. */
  images: string[];
  /** Small renders of the first pages, for the reading animation and as a cover fallback. */
  thumbs: string[];
};

export type PdfProgress = { stage: "open" | "text" | "images"; page: number; pages: number; found: number };

const MAX_PAGES = 30;
const MAX_IMAGES = 8;
const MIN_SIDE = 220;

type ImageObj = { width: number; height: number; bitmap?: ImageBitmap; data?: Uint8ClampedArray; kind?: number };

async function loadPdfjs() {
  // The legacy build carries polyfills for the newest JS features pdf.js uses, so it runs in every current browser.
  const [pdfjs, worker] = await Promise.all([import("pdfjs-dist/legacy/build/pdf.min.mjs"), import("pdfjs-dist/legacy/build/pdf.worker.min.mjs")]);
  // With the worker module on globalThis, pdf.js runs its "fake worker" in this thread: no worker URL to host.
  (globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = worker;
  return pdfjs;
}

function toJpeg(source: CanvasImageSource, w: number, h: number, maxSide: number, quality = 0.82): string {
  const scale = Math.min(1, maxSide / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", quality);
}

// pdf.js hands images back either as an ImageBitmap or as raw pixels.
function imageToCanvas(img: ImageObj): CanvasImageSource | null {
  if (img.bitmap) return img.bitmap;
  if (!img.data) return null;
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d")!;
  const out = ctx.createImageData(img.width, img.height);
  const px = img.width * img.height;
  const src = img.data;
  if (src.length === px * 4) out.data.set(src);
  else if (src.length === px * 3) {
    for (let i = 0, j = 0; i < px; i++, j += 3) out.data.set([src[j], src[j + 1], src[j + 2], 255], i * 4);
  } else return null;
  ctx.putImageData(out, 0, 0);
  return canvas;
}

type ObjStore = { get(id: string, cb: (obj: unknown) => void): void };

// Images finish decoding after the operator list arrives; wait for each one (briefly).
function resolveObj(store: ObjStore, id: string): Promise<ImageObj | null> {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), 4000);
    store.get(id, (obj) => {
      clearTimeout(t);
      resolve((obj as ImageObj) ?? null);
    });
  });
}

export async function readPdf(file: Blob, onProgress?: (p: PdfProgress) => void): Promise<PdfRead> {
  const pdfjs = await loadPdfjs();
  // Keep pdfjs-dist at 6.2.108 or later: earlier 5.6+/6.x releases could run script from a malicious PDF (GHSA-hq66-cqwq-w95j).
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const doc = await task.promise;
  const pages = Math.min(doc.numPages, MAX_PAGES);
  onProgress?.({ stage: "open", page: 0, pages, found: 0 });

  const lines: string[] = [];
  const found: { url: string; area: number; key: string }[] = [];
  const thumbs: string[] = [];

  for (let n = 1; n <= pages; n++) {
    const page = await doc.getPage(n);

    // Text, keeping line breaks so the parser sees the layout.
    const content = await page.getTextContent();
    let line = "";
    for (const item of content.items) {
      if (!("str" in item)) continue;
      line += item.str;
      if (item.hasEOL) {
        lines.push(line);
        line = "";
      } else if (item.str && !item.str.endsWith(" ")) line += " ";
    }
    if (line.trim()) lines.push(line);
    lines.push("");
    onProgress?.({ stage: "text", page: n, pages, found: found.length });

    // Embedded photos: walk the drawing operations for image paints.
    const ops = await page.getOperatorList();
    for (let i = 0; i < ops.fnArray.length && found.length < MAX_IMAGES * 2; i++) {
      const fn = ops.fnArray[i];
      if (fn !== pdfjs.OPS.paintImageXObject && fn !== pdfjs.OPS.paintImageXObjectRepeat) continue;
      const id = ops.argsArray[i][0] as string;
      const store = id.startsWith("g_") ? page.commonObjs : page.objs;
      const img = await resolveObj(store, id);
      if (!img || img.width < MIN_SIDE || img.height < MIN_SIDE * 0.6) continue;
      const ratio = img.width / img.height;
      if (ratio > 4 || ratio < 0.25) continue; // banners and rules, not photos
      const key = `${img.width}x${img.height}`;
      if (found.some((f) => f.key === key)) continue;
      const src = imageToCanvas(img);
      if (!src) continue;
      found.push({ url: toJpeg(src, img.width, img.height, 1280), area: img.width * img.height, key });
    }
    onProgress?.({ stage: "images", page: n, pages, found: found.length });

    if (n <= 4) {
      const viewport = page.getViewport({ scale: 1 });
      const scale = 520 / viewport.width;
      const vp = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(vp.width);
      canvas.height = Math.round(vp.height);
      await page.render({ canvas, viewport: vp }).promise;
      thumbs.push(canvas.toDataURL("image/jpeg", 0.75));
    }
    page.cleanup();
  }
  await task.destroy();

  return {
    pages,
    text: lines.join("\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim(),
    images: found.sort((a, b) => b.area - a.area).slice(0, MAX_IMAGES).map((f) => f.url),
    thumbs,
  };
}

/** Downscales an image the user picks themselves, to the same size and format as PDF images. */
export async function imageFileToJpeg(file: Blob): Promise<string> {
  const bitmap = await createImageBitmap(file);
  return toJpeg(bitmap, bitmap.width, bitmap.height, 1280);
}
