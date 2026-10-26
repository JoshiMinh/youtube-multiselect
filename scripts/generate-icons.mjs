// Generates public/icon/*.png (a check-list glyph on a rounded tile) without
// image dependencies. Run: node scripts/generate-icons.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const SIZES = [16, 32, 48, 96, 128];
const BG = [6, 95, 212];
const FG = [255, 255, 255];
const SS = 4; // supersampling factor

function inRoundedRect(x, y, x0, y0, x1, y1, r) {
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Shape in unit coordinates: returns 0 = transparent, 1 = tile, 2 = glyph. */
function shape(u, v) {
  if (!inRoundedRect(u, v, 0, 0, 1, 1, 0.22)) return 0;
  const stroke = 0.075;
  // Three rows: a checkmark followed by a line.
  for (const [i, y] of [0.3, 0.52, 0.74].entries()) {
    const checked = i < 2;
    if (checked) {
      if (distToSegment(u, v, 0.16, y, 0.23, y + 0.07) < stroke / 1.6) return 2;
      if (distToSegment(u, v, 0.23, y + 0.07, 0.37, y - 0.08) < stroke / 1.6) return 2;
    } else if (inRoundedRect(u, v, 0.15, y - 0.08, 0.37, y + 0.08, 0.03) && !inRoundedRect(u, v, 0.19, y - 0.04, 0.33, y + 0.04, 0.01)) {
      return 2;
    }
    if (distToSegment(u, v, 0.47, y, 0.84, y) < stroke / 1.4) return 2;
  }
  return 1;
}

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (const byte of buf) {
    c = (crc ^ byte) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let tile = 0, glyph = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const s = shape((x + (sx + 0.5) / SS) / size, (y + (sy + 0.5) / SS) / size);
          if (s >= 1) tile++;
          if (s === 2) glyph++;
        }
      }
      const n = SS * SS;
      const g = tile ? glyph / tile : 0;
      const o = y * (size * 4 + 1) + 1 + x * 4;
      for (let c = 0; c < 3; c++) raw[o + c] = Math.round(BG[c] * (1 - g) + FG[c] * g);
      raw[o + 3] = Math.round((tile / n) * 255);
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const outDir = new URL('../public/icon/', import.meta.url);
mkdirSync(outDir, { recursive: true });
for (const size of SIZES) writeFileSync(new URL(`${size}.png`, outDir), png(size));
console.log(`Wrote ${SIZES.map((s) => `${s}.png`).join(', ')}`);
