import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

function crc32(buf: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const len = new Uint8Array(4);
  const view = new DataView(len.buffer);
  view.setUint32(0, data.length, false);
  const typeBytes = new Uint8Array(type.length);
  for (let i = 0; i < type.length; i++) typeBytes[i] = type.charCodeAt(i);
  const crcBuf = new Uint8Array(typeBytes.length + data.length);
  crcBuf.set(typeBytes, 0);
  crcBuf.set(data, typeBytes.length);
  const crcNum = crc32(crcBuf);
  const crc = new Uint8Array(4);
  new DataView(crc.buffer).setUint32(0, crcNum, false);
  const out = new Uint8Array(len.length + typeBytes.length + data.length + crc.length);
  out.set(len, 0);
  out.set(typeBytes, len.length);
  out.set(data, len.length + typeBytes.length);
  out.set(crc, len.length + typeBytes.length + data.length);
  return out;
}

function makePng(size: number, rgb: [number, number, number]): Uint8Array {
  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = new Uint8Array(13);
  const ihdrView = new DataView(ihdr.buffer);
  ihdrView.setUint32(0, size, false);
  ihdrView.setUint32(4, size, false);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const rowBytes = 1 + size * 4;
  const raw = new Uint8Array(rowBytes * size);
  const cx = size / 2;
  const cy = size / 2;
  const rCircle = size * 0.32;
  const rLetter = size * 0.18;

  for (let y = 0; y < size; y++) {
    raw[y * rowBytes] = 0;
    for (let x = 0; x < size; x++) {
      const i = y * rowBytes + 1 + x * 4;
      const dx = x - cx + 0.5;
      const dy = y - cy + 0.5;
      const d2 = dx * dx + dy * dy;
      const inCircle = d2 <= rCircle * rCircle;
      const letterL =
        y > size / 2 - rLetter &&
        y < size / 2 + rLetter &&
        x > size / 2 - rLetter * 0.9 &&
        x < size / 2 - rLetter * 0.2
          ? true
          : y > size / 2 + rLetter * 0.05 &&
            y < size / 2 + rLetter &&
            x > size / 2 - rLetter * 0.9 &&
            x < size / 2 + rLetter * 0.6;

      if (letterL) {
        raw[i] = 15;
        raw[i + 1] = 23;
        raw[i + 2] = 42;
        raw[i + 3] = 255;
      } else if (inCircle) {
        raw[i] = 244;
        raw[i + 1] = 63;
        raw[i + 2] = 94;
        raw[i + 3] = 255;
      } else {
        raw[i] = rgb[0];
        raw[i + 1] = rgb[1];
        raw[i + 2] = rgb[2];
        raw[i + 3] = 255;
      }
    }
  }

  const idatData = deflateSync(raw);
  const file = new Uint8Array(
    sig.length + chunk("IHDR", ihdr).length + chunk("IDAT", idatData).length + 12,
  );
  let o = 0;
  file.set(sig, o);
  o += sig.length;
  const c1 = chunk("IHDR", ihdr);
  file.set(c1, o);
  o += c1.length;
  const c2 = chunk("IDAT", idatData);
  file.set(c2, o);
  o += c2.length;
  const c3 = chunk("IEND", new Uint8Array(0));
  file.set(c3, o);
  return file;
}

const outDir = process.argv[2] ?? process.cwd();
const sizes = [
  { name: "icon-192.png", size: 192 },
  { name: "icon-512.png", size: 512 },
  { name: "apple-touch-icon.png", size: 180 },
];
const bg: [number, number, number] = [15, 23, 42];

for (const s of sizes) {
  const buf = makePng(s.size, bg);
  writeFileSync(join(outDir, s.name), buf);
  console.log(`Wrote ${s.name} (${buf.length} bytes, ${s.size}x${s.size})`);
}
