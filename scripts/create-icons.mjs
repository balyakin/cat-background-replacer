import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n += 1) {
  let c = n;
  for (let k = 0; k < 8; k += 1) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c >>> 0;
}

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) {
    c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, checksum]);
}

function pointInTriangle(px, py, ax, ay, bx, by, cx, cy) {
  const area = (x1, y1, x2, y2, x3, y3) =>
    Math.abs((x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2)) / 2);
  const a = area(ax, ay, bx, by, cx, cy);
  const a1 = area(px, py, bx, by, cx, cy);
  const a2 = area(ax, ay, px, py, cx, cy);
  const a3 = area(ax, ay, bx, by, px, py);
  return Math.abs(a - (a1 + a2 + a3)) < 0.002;
}

function iconPixels(size) {
  const data = Buffer.alloc(size * size * 4);
  const bg = [232, 93, 42, 255];
  const cream = [255, 248, 240, 255];
  const ink = [28, 25, 23, 255];
  const green = [47, 125, 109, 255];
  const pink = [239, 118, 104, 255];
  const cx = 0.5;
  const cy = 0.52;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const nx = (x + 0.5) / size;
      const ny = (y + 0.5) / size;
      const i = (y * size + x) * 4;
      let color = bg;

      const head = ((nx - cx) / 0.31) ** 2 + ((ny - cy) / 0.28) ** 2 <= 1;
      const leftEar = pointInTriangle(nx, ny, 0.23, 0.35, 0.34, 0.13, 0.44, 0.38);
      const rightEar = pointInTriangle(nx, ny, 0.56, 0.38, 0.66, 0.13, 0.77, 0.35);
      const face = head || leftEar || rightEar;
      if (face) color = cream;

      const leftEye = ((nx - 0.39) / 0.035) ** 2 + ((ny - 0.49) / 0.055) ** 2 <= 1;
      const rightEye = ((nx - 0.61) / 0.035) ** 2 + ((ny - 0.49) / 0.055) ** 2 <= 1;
      const nose = pointInTriangle(nx, ny, 0.48, 0.58, 0.52, 0.58, 0.5, 0.62);
      const mouth = Math.abs(Math.hypot(nx - 0.46, ny - 0.63) - 0.055) < 0.006 && nx > 0.42 && nx < 0.5;
      const mouth2 = Math.abs(Math.hypot(nx - 0.54, ny - 0.63) - 0.055) < 0.006 && nx > 0.5 && nx < 0.58;
      const whisker1 = face && Math.abs(ny - (0.59 - (nx - 0.34) * 0.18)) < 0.006 && nx > 0.18 && nx < 0.43;
      const whisker2 = face && Math.abs(ny - (0.63 - (nx - 0.34) * 0.02)) < 0.006 && nx > 0.18 && nx < 0.43;
      const whisker3 = face && Math.abs(ny - (0.59 + (nx - 0.66) * 0.18)) < 0.006 && nx > 0.57 && nx < 0.82;
      const whisker4 = face && Math.abs(ny - (0.63 + (nx - 0.66) * 0.02)) < 0.006 && nx > 0.57 && nx < 0.82;
      if (leftEye || rightEye || mouth || mouth2 || whisker1 || whisker2 || whisker3 || whisker4) color = ink;
      if (nose) color = pink;

      const leaf = ((nx - 0.74) / 0.07) ** 2 + ((ny - 0.72) / 0.13) ** 2 <= 1 && nx + ny > 1.36;
      if (leaf) color = green;

      data[i] = color[0];
      data[i + 1] = color[1];
      data[i + 2] = color[2];
      data[i + 3] = color[3];
    }
  }
  return data;
}

function writePng(path, size) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const pixels = iconPixels(size);
  for (let y = 0; y < size; y += 1) {
    const rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0;
    pixels.copy(raw, rowStart + 1, y * size * 4, (y + 1) * size * 4);
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const png = Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0))
  ]);
  writeFileSync(path, png);
}

writePng("public/icon-192.png", 192);
writePng("public/icon-512.png", 512);
writePng("public/apple-touch-icon.png", 180);
