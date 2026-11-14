import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { test } from "node:test";

const iconSvg = readFileSync(new URL("../app/icon.svg", import.meta.url), "utf8");
const petSvg = readFileSync(
  new URL("../public/pet-assets/pets/cat/sage/no-hat-no-clothes/idle.svg", import.meta.url),
  "utf8",
);

test("the favicon draws the sage cat used for the starter pet", () => {
  assert.match(iconSvg, /fill="#14211a"/);
  assert.doesNotMatch(iconSvg, /#c6ef4a/);
  for (const shape of petSvg.match(/<(?:path|ellipse)\b[^>]*>/g) ?? []) {
    const piece = shape.match(/\b(?:d|cx|fill)="[^"]+"/)?.[0];
    assert.ok(piece, shape);
    assert.match(iconSvg, new RegExp(piece.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("the favicon png is the same sage cat on the ink plate", () => {
  const png = readFileSync(new URL("../app/icon.png", import.meta.url));
  assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  const { width, height, pixels } = decodePng(png);
  assert.equal(width, 256);
  assert.equal(height, 256);
  assert.deepEqual(pixel(pixels, width, 32, 32), [157, 182, 142, 255]);
  assert.deepEqual(pixel(pixels, width, 32, 4), [20, 33, 26, 255]);
  assert.deepEqual(pixel(pixels, width, 22, 20), [231, 178, 169, 255]);
  assert.deepEqual(pixel(pixels, width, 1, 1), [0, 0, 0, 0]);
});

function pixel(pixels: Buffer, width: number, gridX: number, gridY: number) {
  const scale = width / 64;
  const x = gridX * scale;
  const y = gridY * scale;
  const i = (y * width + x) * 4;
  return [pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3]];
}

function decodePng(png: Buffer) {
  let pos = 8;
  let width = 0;
  let height = 0;
  const idat = [];
  while (pos < png.length) {
    const length = png.readUInt32BE(pos);
    pos += 4;
    const type = png.subarray(pos, pos + 4).toString("ascii");
    pos += 4;
    const data = png.subarray(pos, pos + length);
    pos += length + 4;
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      assert.equal(data[8], 8);
      assert.equal(data[9], 6);
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const pixels = Buffer.alloc(height * stride);
  let offset = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[offset++];
    assert.equal(filter, 0);
    raw.copy(pixels, y * stride, offset, offset + stride);
    offset += stride;
  }
  return { width, height, pixels };
}
