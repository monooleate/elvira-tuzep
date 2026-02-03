// compress-env.js
import { deflateSync, inflateSync } from "node:zlib";

export function compressToBase64(inputStr) {
  const compressed = deflateSync(Buffer.from(inputStr, "utf8"), { level: 9 });
  return compressed.toString("base64");
}

export function decompressFromBase64(b64) {
  const buf = Buffer.from(b64, "base64");
  return inflateSync(buf).toString("utf8");
}

// Példa használat:
if (process.argv[2] === "compress") {
  const text = process.argv.slice(3).join(" ");
  console.log(compressToBase64(text));
}

if (process.argv[2] === "decompress") {
  const b64 = process.argv[3];
  console.log(decompressFromBase64(b64));
}
