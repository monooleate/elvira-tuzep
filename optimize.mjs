// optimize.mjs
import fs from "fs";
import path from "path";
import sharp from "sharp";

const IN = "src_images";
const OUT = "public/images/products";
const TARGET_WIDTHS = [500, 1200];

if (!fs.existsSync(IN)) {
  console.error(`❌ A bemeneti mappa nem létezik: ${IN}`);
  process.exit(1);
}
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

for (const file of fs.readdirSync(IN)) {
  const input = path.join(IN, file);
  const stat = fs.statSync(input);
  if (!stat.isFile()) continue;

  const ext = path.extname(file).toLowerCase();
  if (![".jpg", ".jpeg", ".png", ".webp"].includes(ext)) continue;

  const name = path.basename(file, ext);

  const meta = await sharp(input).metadata();
  const origW = meta.width ?? 0;
  if (!origW) {
    console.warn(`⚠️  Nem olvasható szélesség, kihagyva: ${file}`);
    continue;
  }

  // csak az eredetinél nem nagyobb célméretek
  let widths = TARGET_WIDTHS.filter((w) => w > 0 && w <= origW);
    if (widths.length === 0 && origW > 0) {
    widths = [500]; // fájlnév suffix marad -500
    }

  for (const w of widths) {
    const base = sharp(input)
      .rotate()
      .resize({
        width: Math.min(w, origW),
        fit: "inside",
        withoutEnlargement: true,
      })
      .toColorspace("srgb") // egységes színtér
      .withMetadata(false);

    // JPEG (progresszív + mozjpeg)
    await base
      .clone()
      .jpeg({ quality: 74, mozjpeg: true, progressive: true })
      .toFile(`${OUT}/${name}-${w}.jpg`);

    // WebP
    await base
      .clone()
      .webp({ quality: 74, effort: 4 }) // effort 0–6; 4 jó kompromisszum
      .toFile(`${OUT}/${name}-${w}.webp`);

    // AVIF
    await base
      .clone()
      .avif({ quality: 38, effort: 4 }) // effort 0–10; 4-5 ok
      .toFile(`${OUT}/${name}-${w}.avif`);
  }
}

console.log("✅ Képek optimalizálva, upscaling nélkül!");
