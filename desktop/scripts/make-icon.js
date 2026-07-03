// Build build/icon.ico from a 512x512 PNG (path passed as argv[2], defaults to build/icon-512.png).
// Validates the PNG hard (signature, IHDR size, zlib-inflatable IDAT) before converting, since
// the PNG may have travelled through lossy channels.

const { readFileSync, writeFileSync, mkdirSync } = require("node:fs");
const { inflateSync } = require("node:zlib");
const path = require("node:path");
const png2icons = require("png2icons");

const src = process.argv[2] || path.join(__dirname, "..", "build", "icon-512.png");
const png = readFileSync(src);

// signature
if (!png.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
  throw new Error("not a PNG (bad signature)");
}
// IHDR dimensions
const width = png.readUInt32BE(16);
const height = png.readUInt32BE(20);
if (width !== 512 || height !== 512) throw new Error(`unexpected size ${width}x${height}`);
// concatenate IDAT chunks and inflate — catches corrupted payloads
let off = 8;
const idat = [];
while (off < png.length) {
  const len = png.readUInt32BE(off);
  const type = png.toString("ascii", off + 4, off + 8);
  if (type === "IDAT") idat.push(png.subarray(off + 8, off + 8 + len));
  off += 12 + len;
}
inflateSync(Buffer.concat(idat)); // throws on corruption

const ico = png2icons.createICO(png, png2icons.BICUBIC, 0, true);
if (!ico) throw new Error("ICO conversion failed");
mkdirSync(path.join(__dirname, "..", "build"), { recursive: true });
writeFileSync(path.join(__dirname, "..", "build", "icon.ico"), ico);
console.log(`icon.ico written (${ico.length} bytes) from ${width}x${height} PNG`);
