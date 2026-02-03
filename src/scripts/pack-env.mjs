// pack-env.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { deflateSync, inflateSync } from "node:zlib";

function normalizeInput(s) {
  // kiszedi a sortöréseket és a fölös whitespace-t a végekről
  return s.replace(/\r?\n/g, "").trim();
}

function compressToBase64(inputStr) {
  const compressed = deflateSync(Buffer.from(inputStr, "utf8"), { level: 9 });
  return compressed.toString("base64");
}

function decompressFromBase64(b64) {
  const buf = Buffer.from(b64, "base64");
  return inflateSync(buf).toString("utf8");
}

const mode = process.argv[2];            // "compress" | "decompress"
const inPath = process.argv[3];          // pl. "env.txt"
const outPath = process.argv[4];         // pl. "env.zlib.b64.txt"

if (!mode || !inPath || !outPath) {
  console.error("Használat:");
  console.error("  node pack-env.mjs compress   env.txt   env.zlib.b64.txt");
  console.error("  node pack-env.mjs decompress env.zlib.b64.txt restored.txt");
  process.exit(1);
}

const raw = readFileSync(inPath, "utf8");
const normalized = normalizeInput(raw);

if (!normalized) {
  console.error("Hiba: a bemeneti fájl üres (vagy csak whitespace).");
  process.exit(1);
}

if (mode === "compress") {
  const b64 = compressToBase64(normalized);
  // fontos: egy sorba írjuk, \n nélkül
  writeFileSync(outPath, b64, "utf8");

  console.log("OK: tömörítve.");
  console.log("Input chars :", normalized.length);
  console.log("Output chars:", b64.length);
} else if (mode === "decompress") {
  const restored = decompressFromBase64(normalized);
  writeFileSync(outPath, restored, "utf8");
  console.log("OK: visszafejtve.");
} else {
  console.error('Hiba: mode csak "compress" vagy "decompress" lehet.');
  process.exit(1);
}
