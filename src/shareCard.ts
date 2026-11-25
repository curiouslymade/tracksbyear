/**
 * The share image: a 1080 by 1440 card. 3:4 is the tallest shape that an Instagram
 * post shows in full, in the feed and on the profile grid. Drawn on a canvas with the
 * page's own colours and fonts. The footer gives the address, because a picture on
 * Instagram cannot hold a link.
 */
import type { SongWithEstimate } from './estimate';
import { genreInfo, NO_GENRE_ACCENT, NO_GENRE_BACKDROP } from './genres';
import { songGenre } from './road';
import { genreBreakdown } from './stats';

const CARD_W = 1080;
export const CARD_H = 1440;
const MAX_ROWS = 10;

/**
 * Up to `max` songs in timeline order. With more songs, picks them evenly
 * across the timeline, always with the first and the last.
 */
export function pickRows(items: SongWithEstimate[], max = MAX_ROWS): SongWithEstimate[] {
  const sorted = [...items].sort((a, b) => a.estimate.likely.getTime() - b.estimate.likely.getTime());
  if (sorted.length <= max) return sorted;
  const picks = new Set<number>();
  for (let i = 0; i < max; i++) picks.add(Math.round((i * (sorted.length - 1)) / (max - 1)));
  return [...picks].map((i) => sorted[i]);
}

/** A one-line summary, for example "11 songs · 1994 to 2019 · mostly Indie & alternative". */
export function cardSummary(items: SongWithEstimate[]): string {
  const years = items.map((i) => i.estimate.likely.getUTCFullYear());
  const from = Math.min(...years);
  const to = Math.max(...years);
  const parts = [`${items.length} song${items.length === 1 ? '' : 's'}`, from === to ? String(from) : `${from} to ${to}`];
  const top = genreBreakdown(items).find((s) => s.id !== 'other' && s.id !== 'unknown');
  if (top && top.share >= 0.3) parts.push(`mostly ${top.label}`);
  return parts.join(' · ');
}

function fit(ctx: CanvasRenderingContext2D, text: string, width: number): string {
  if (ctx.measureText(text).width <= width) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > width) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > width && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/** The footer text: where to make your own. */
export function cardFooter(host: string): [lead: string, address: string] {
  return ['Make your own at ', host];
}

/** Draws the card and returns it as a PNG. `host` is the address in the footer. */
export async function drawShareCard(items: SongWithEstimate[], title: string, theme: 'day' | 'night', host: string): Promise<Blob> {
  await Promise.all([
    document.fonts.load('400 80px "Poiret One"'),
    document.fonts.load('400 30px Jost'),
    document.fonts.load('500 36px Jost'),
    document.fonts.load('600 30px Jost'),
  ]);
  const css = getComputedStyle(document.documentElement);
  const token = (name: string) => css.getPropertyValue(name).trim();
  const ground = token('--ground');
  const ink = token('--ink');
  const muted = token('--ink-muted');
  const heading = token('--heading-ink');
  const line = token('--line-strong');

  const canvas = document.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = ground;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  const left = 96;
  const width = CARD_W - left * 2;

  ctx.fillStyle = heading;
  ctx.font = '400 80px "Poiret One"';
  let y = 190;
  for (const l of wrap(ctx, title, width).slice(0, 2)) {
    ctx.fillText(l, left, y);
    y += 88;
  }

  ctx.fillStyle = muted;
  ctx.font = '400 30px Jost';
  ctx.fillText(fit(ctx, cardSummary(items), width), left, y + 4);

  // The timeline: a vertical line, a year and a dot for each song.
  const rows = pickRows(items);
  const more = items.length - rows.length;
  const first = y + 88;
  // Leave room for the "and N more" line and the footer.
  const bottom = CARD_H - (more > 0 ? 250 : 190);
  const step = Math.min(110, (bottom - first) / Math.max(1, rows.length));
  // Centre a short list between the summary and the footer, so the card has no big gap.
  const used = step * rows.length;
  const top = first + Math.max(0, (bottom - first - used) / 2);
  const lineX = left + 120;
  ctx.strokeStyle = line;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(lineX, top - 12);
  ctx.lineTo(lineX, top + step * (rows.length - 1) + 40);
  ctx.stroke();

  rows.forEach(({ song, estimate }, i) => {
    const cy = top + i * step + 20;
    const g = genreInfo(songGenre(song));
    ctx.fillStyle = muted;
    ctx.font = '600 30px Jost';
    ctx.textAlign = 'right';
    ctx.fillText(String(estimate.likely.getUTCFullYear()), lineX - 28, cy + 10);
    ctx.textAlign = 'left';

    ctx.beginPath();
    ctx.arc(lineX, cy, 11, 0, Math.PI * 2);
    ctx.fillStyle = theme === 'day' ? (g?.backdrop ?? NO_GENRE_BACKDROP) : (g?.accent ?? NO_GENRE_ACCENT);
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = ground;
    ctx.stroke();

    const textX = lineX + 36;
    const textW = CARD_W - left - textX;
    ctx.fillStyle = ink;
    ctx.font = '500 34px Jost';
    ctx.fillText(fit(ctx, song.title, textW), textX, cy + 4);
    ctx.fillStyle = muted;
    ctx.font = '400 26px Jost';
    ctx.fillText(fit(ctx, song.artist, textW), textX, cy + 38);
  });

  if (more > 0) {
    ctx.fillStyle = muted;
    ctx.font = '400 28px Jost';
    ctx.fillText(`and ${more} more`, lineX + 36, top + step * (rows.length - 1) + 110);
  }

  // Footer: the Two Moons mark and the name of the app.
  const fy = CARD_H - 96;
  ctx.fillStyle = token('--sand');
  ctx.beginPath();
  ctx.arc(left + 10, fy - 9, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = token('--lilac');
  ctx.beginPath();
  ctx.arc(left + 36, fy - 9, 10, 0, Math.PI * 2);
  ctx.fill();
  const [lead, address] = cardFooter(host);
  ctx.fillStyle = muted;
  ctx.font = '400 28px Jost';
  ctx.fillText(lead, left + 64, fy);
  const leadW = ctx.measureText(lead).width;
  ctx.fillStyle = ink;
  ctx.font = '600 28px Jost';
  ctx.fillText(fit(ctx, address, width - 64 - leadW), left + 64 + leadW, fy);

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('The image could not be made.'))), 'image/png'));
}
