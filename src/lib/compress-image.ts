/**
 * Compress an image File client-side to fit under a target byte size.
 * Returns { dataUrl, base64, mime, blob } where base64 has no data: prefix.
 */
export async function compressImage(
  file: File,
  opts: { maxSide?: number; quality?: number; maxBytes?: number } = {},
): Promise<{ dataUrl: string; base64: string; mime: string; blob: Blob }> {
  const maxSide = opts.maxSide ?? 1600;
  const maxBytes = opts.maxBytes ?? 1_000_000;
  let quality = opts.quality ?? 0.82;

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  const mime = "image/jpeg";
  let blob = await canvasToBlob(canvas, mime, quality);
  // Step down quality until under maxBytes
  while (blob.size > maxBytes && quality > 0.35) {
    quality -= 0.12;
    blob = await canvasToBlob(canvas, mime, quality);
  }

  const base64 = await blobToBase64(blob);
  return { dataUrl: `data:${mime};base64,${base64}`, base64, mime, blob };
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Compression failed"))),
      type,
      quality,
    ),
  );
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const r = String(reader.result ?? "");
      const i = r.indexOf(",");
      resolve(i >= 0 ? r.slice(i + 1) : r);
    };
    reader.readAsDataURL(blob);
  });
}
