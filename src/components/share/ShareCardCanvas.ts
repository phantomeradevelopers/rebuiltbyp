/**
 * Client-side share card renderer. No PII unless caller passes it in.
 * Track-aware: REBUILT (gold) vs REBUILT Angels (rose-gold).
 */
import type { Track } from "@/lib/track";

export const SHARE_W = 1080;
export const SHARE_H = 1350;

const BG = "#0B0B0E";
const FG = "#FFFFFF";
const MUTED = "rgba(255,255,255,0.62)";
const HAIRLINE = "rgba(255,255,255,0.18)";
const GOLD_MEN = "#D4AF6A";
const GOLD_ANGELS = "#E8B4B8";

function accent(track: Track) {
  return track === "angels" ? GOLD_ANGELS : GOLD_MEN;
}

function drawBg(ctx: CanvasRenderingContext2D, track: Track) {
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, SHARE_W, SHARE_H);
  // subtle radial vignette
  const g = ctx.createRadialGradient(SHARE_W / 2, 220, 60, SHARE_W / 2, 220, 900);
  g.addColorStop(0, `${accent(track)}22`);
  g.addColorStop(1, "transparent");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, SHARE_W, SHARE_H);
}

function drawWordmark(ctx: CanvasRenderingContext2D, track: Track, y = 140) {
  const main = "REBUILT";
  ctx.fillStyle = FG;
  ctx.font = "700 56px ui-sans-serif, system-ui, -apple-system, 'Helvetica Neue', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.letterSpacing = "8px" as unknown as string;
  if (track === "angels") {
    // approximate the logo: REBUILT — ANGELS
    const mainW = ctx.measureText(main).width;
    const suffix = "ANGELS";
    ctx.font = "500 22px ui-sans-serif, system-ui, sans-serif";
    const sufW = ctx.measureText(suffix).width;
    const gap = 24;
    const dash = 18;
    const totalW = mainW + gap + dash + gap + sufW;
    const startX = SHARE_W / 2 - totalW / 2;
    ctx.textAlign = "left";
    ctx.font = "700 56px ui-sans-serif, system-ui, sans-serif";
    ctx.fillStyle = FG;
    ctx.fillText(main, startX, y);
    ctx.strokeStyle = accent(track);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(startX + mainW + gap, y - 14);
    ctx.lineTo(startX + mainW + gap + dash, y - 14);
    ctx.stroke();
    ctx.fillStyle = accent(track);
    ctx.font = "600 22px ui-sans-serif, system-ui, sans-serif";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(suffix, startX + mainW + gap + dash + gap, y - 6);
  } else {
    ctx.fillText(main, SHARE_W / 2, y);
  }
  ctx.textAlign = "left";
}

function drawHairline(ctx: CanvasRenderingContext2D, y: number, w = 140) {
  ctx.strokeStyle = HAIRLINE;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(SHARE_W / 2 - w / 2, y);
  ctx.lineTo(SHARE_W / 2 + w / 2, y);
  ctx.stroke();
}

function drawFooter(ctx: CanvasRenderingContext2D, track: Track, referralLink?: string) {
  ctx.textAlign = "center";
  ctx.fillStyle = MUTED;
  ctx.font = "500 22px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText(referralLink || "rebuilt.app", SHARE_W / 2, SHARE_H - 70);
  ctx.fillStyle = accent(track);
  ctx.font = "600 14px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.fillText(track === "angels" ? "REBUILT · ANGELS" : "REBUILT", SHARE_W / 2, SHARE_H - 110);
  if (referralLink) {
    ctx.fillStyle = MUTED;
    ctx.font = "500 16px ui-sans-serif, system-ui, sans-serif";
    ctx.fillText("Join me — link above is my invite.", SHARE_W / 2, SHARE_H - 40);
  }
  ctx.textAlign = "left";
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? cur + " " + w : w;
    if (ctx.measureText(test).width > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

export type WinCardInput = {
  track: Track;
  title: string;
  tagline?: string;
  customLine?: string;
  referralLink?: string;
};

export function drawWinCard(canvas: HTMLCanvasElement, input: WinCardInput) {
  canvas.width = SHARE_W;
  canvas.height = SHARE_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  drawBg(ctx, input.track);
  drawWordmark(ctx, input.track, 150);
  drawHairline(ctx, 200);

  // small "TROPHY UNLOCKED" eyebrow
  ctx.textAlign = "center";
  ctx.fillStyle = accent(input.track);
  ctx.font = "600 22px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.fillText("TROPHY UNLOCKED", SHARE_W / 2, 270);

  // medallion ring
  const cx = SHARE_W / 2;
  const cy = 500;
  ctx.beginPath();
  ctx.arc(cx, cy, 130, 0, Math.PI * 2);
  ctx.strokeStyle = accent(input.track);
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, 110, 0, Math.PI * 2);
  ctx.strokeStyle = HAIRLINE;
  ctx.lineWidth = 1;
  ctx.stroke();
  // trophy glyph
  ctx.font = "120px serif";
  ctx.textBaseline = "middle";
  ctx.fillStyle = accent(input.track);
  ctx.fillText("🏆", cx, cy + 6);
  ctx.textBaseline = "alphabetic";

  // title
  ctx.fillStyle = FG;
  ctx.font = "700 64px ui-sans-serif, system-ui, sans-serif";
  const titleLines = wrap(ctx, input.title, SHARE_W - 160);
  let ty = 740;
  for (const l of titleLines.slice(0, 2)) {
    ctx.fillText(l, SHARE_W / 2, ty);
    ty += 76;
  }

  // tagline / generic
  if (input.tagline) {
    ctx.fillStyle = MUTED;
    ctx.font = "400 30px ui-sans-serif, system-ui, sans-serif";
    const lines = wrap(ctx, input.tagline, SHARE_W - 220);
    let y = ty + 30;
    for (const l of lines.slice(0, 3)) {
      ctx.fillText(l, SHARE_W / 2, y);
      y += 40;
    }
  }

  // optional user line — only if non-empty
  const custom = (input.customLine || "").trim();
  if (custom) {
    ctx.fillStyle = FG;
    ctx.font = "italic 500 28px ui-serif, Georgia, serif";
    const lines = wrap(ctx, `"${custom}"`, SHARE_W - 220);
    let y = SHARE_H - 230;
    for (const l of lines.slice(0, 2)) {
      ctx.fillText(l, SHARE_W / 2, y);
      y += 38;
    }
  }

  drawFooter(ctx, input.track, input.referralLink);
  ctx.textAlign = "left";
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}

function drawCovered(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const ir = img.width / img.height;
  const tr = w / h;
  let sx = 0, sy = 0, sw = img.width, sh = img.height;
  if (ir > tr) {
    sw = img.height * tr;
    sx = (img.width - sw) / 2;
  } else {
    sh = img.width / tr;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function drawDiagonalWatermark(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  text: string,
) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(-Math.PI / 6);
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.font = "700 44px ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let row = -2; row <= 2; row++) {
    for (let col = -2; col <= 2; col++) {
      ctx.fillText(text, col * 360, row * 200);
    }
  }
  ctx.restore();
}

export type ProgressCardInput = {
  track: Track;
  beforeUrl: string;
  afterUrl: string;
  beforeDate: string;
  afterDate: string;
};

export async function drawProgressCard(
  canvas: HTMLCanvasElement,
  input: ProgressCardInput,
) {
  canvas.width = SHARE_W;
  canvas.height = SHARE_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  drawBg(ctx, input.track);
  drawWordmark(ctx, input.track, 130);
  drawHairline(ctx, 175);

  const spanDays = Math.max(
    0,
    Math.round(
      (new Date(input.afterDate).getTime() - new Date(input.beforeDate).getTime()) /
        86_400_000,
    ),
  );

  ctx.textAlign = "center";
  ctx.fillStyle = accent(input.track);
  ctx.font = "600 22px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.fillText(`DAY 0  →  DAY ${spanDays}`, SHARE_W / 2, 230);
  ctx.textAlign = "left";

  const [before, after] = await Promise.all([
    loadImage(input.beforeUrl),
    loadImage(input.afterUrl),
  ]);

  const pad = 50;
  const gap = 24;
  const cellW = (SHARE_W - pad * 2 - gap) / 2;
  const cellH = 820;
  const top = 280;

  // panel borders
  ctx.fillStyle = "#15151A";
  ctx.fillRect(pad, top, cellW, cellH);
  ctx.fillRect(pad + cellW + gap, top, cellW, cellH);

  drawCovered(ctx, before, pad, top, cellW, cellH);
  drawCovered(ctx, after, pad + cellW + gap, top, cellW, cellH);

  // watermarks per photo so screenshots stay attributable
  drawDiagonalWatermark(ctx, pad, top, cellW, cellH, "REBUILT");
  drawDiagonalWatermark(ctx, pad + cellW + gap, top, cellW, cellH, "REBUILT");

  // labels
  ctx.fillStyle = "rgba(0,0,0,0.65)";
  ctx.fillRect(pad + 12, top + 12, 150, 36);
  ctx.fillRect(pad + cellW + gap + 12, top + 12, 150, 36);
  ctx.fillStyle = FG;
  ctx.font = "600 18px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.fillText("BEFORE", pad + 26, top + 36);
  ctx.fillText("NOW", pad + cellW + gap + 26, top + 36);

  // hairline between
  ctx.strokeStyle = accent(input.track);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(SHARE_W / 2, top);
  ctx.lineTo(SHARE_W / 2, top + cellH);
  ctx.stroke();

  drawFooter(ctx, input.track);
}

export async function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((res, rej) => {
    canvas.toBlob((b) => (b ? res(b) : rej(new Error("toBlob failed"))), "image/png", 0.95);
  });
}

export async function shareOrDownload(blob: Blob, filename: string, title: string) {
  const file = new File([blob], filename, { type: "image/png" });
  const nav = navigator as Navigator & {
    canShare?: (d: { files?: File[] }) => boolean;
    share?: (d: { files?: File[]; title?: string; text?: string }) => Promise<void>;
  };
  if (nav.share && nav.canShare && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file], title });
      return "shared";
    } catch {
      // fall through to download
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return "downloaded";
}
