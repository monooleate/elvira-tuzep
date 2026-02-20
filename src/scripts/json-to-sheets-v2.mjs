// scripts/json-to-sheets-v2.mjs
// Upload current local JSON data (categories, products, variants) to Google Sheets.
// Reads from the split JSON files in src/data/ (NOT from the old monolithic products.json).
// Writes to the same 3-sheet structure (Categories, Products, Variants)
// used by sheets-to-json.mjs, using GOOGLE_SHEET_ID_UPLOADER.

import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { GoogleSpreadsheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";

/* ================= ENV + AUTH ================= */

const ROOT = process.cwd();
const DATA = path.join(ROOT, "src", "data");

const SHEET_ID = process.env.GOOGLE_SHEET_ID_UPLOADER;
const SA_B64 = process.env.GOOGLE_SA_JSON_BASE64;

if (!SHEET_ID) throw new Error("Missing env GOOGLE_SHEET_ID_UPLOADER");
if (!SA_B64) throw new Error("Missing env GOOGLE_SA_JSON_BASE64");

const SA_JSON = JSON.parse(Buffer.from(SA_B64, "base64").toString("utf8"));
const fixedKey = String(SA_JSON.private_key || "").replace(/\\n/g, "\n");

const auth = new JWT({
  email: SA_JSON.client_email,
  key: fixedKey,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

/* ================= SHEET DEFINITION ================= */

const SHEETS = {
  Categories: {
    title: "Categories",
    headers: [
      "categorySlug",
      "maincategory",
      "categoryName",
      "metaTitle",
      "metaDescription",
      "metaImage",
      "description",
      "faqDesc",
      "faq",
    ],
  },
  Products: {
    title: "Products",
    headers: [
      "productSlug",
      "categorySlug",
      "name",
      "sku",
      "image",
      "images",
      "metaTitle",
      "metaDescription",
      "metaImage",
      "description",
      "longDescription1",
      "longDescription2",
      "longDescription3",
      "material",
      "audience",
      "blogtags",
      "specs",
      "shipping",
      "aggregateRating",
    ],
  },
  Variants: {
    title: "Variants",
    headers: [
      "variantId",
      "productSlug",
      "title",
      "sku",
      "variant_rank",
      "price",
      "mprice",
      "m2price",
      "m3price",
      "palprice",
      "inventory",
      "discountPrice",
      "discountPercent",
      "discountValidUntil",
      "weight",
      "length",
      "width",
      "height",
    ],
  },
};

/* ================= HELPERS (same format as json-to-sheets.mjs) ================= */

function toCsv(arr) {
  if (!Array.isArray(arr)) return "";
  return arr.map((x) => String(x ?? "").trim()).filter(Boolean).join(",");
}

function numOrBlank(v) {
  return typeof v === "number" && Number.isFinite(v) ? v : "";
}

function imagesCell(images) {
  if (!Array.isArray(images) || images.length === 0) return "";
  return images
    .map((img) => {
      if (!img || !img.src) return "";
      const alt = typeof img.alt === "string" ? img.alt : "";
      return `${img.src} ; ${alt}`;
    })
    .filter(Boolean)
    .join("\n");
}

function faqCell(faqArr) {
  if (!Array.isArray(faqArr)) return "";
  const blocks = [];
  for (const f of faqArr) {
    const q = String(f?.question ?? "").trim();
    const a = String(f?.answer ?? "").trim();
    if (!q || !a) continue;
    const id = f?.id ?? "";
    blocks.push(`Q: ${q}\nA: ${a}\nID: ${id}`.trim());
  }
  return blocks.join("\n\n");
}

function specsCell(specs) {
  if (!specs || typeof specs !== "object") return "";
  const lines = [];
  for (const key of Object.keys(specs)) {
    const s = specs[key];
    if (!s) continue;
    const order = s.order === null || s.order === undefined ? "" : String(s.order);
    const label = String(s.label ?? key).trim();
    const value = String(s.value ?? "").trim();
    if (!label && !value) continue;
    lines.push(`${order} :: ${label} = ${value}`.trim());
  }
  lines.sort((a, b) => {
    const oa = parseInt(a.split("::")[0].trim(), 10);
    const ob = parseInt(b.split("::")[0].trim(), 10);
    const na = Number.isFinite(oa) ? oa : 9999;
    const nb = Number.isFinite(ob) ? ob : 9999;
    if (na !== nb) return na - nb;
    return a.localeCompare(b, "hu");
  });
  return lines.join("\n");
}

function shippingCell(sh) {
  if (!sh || typeof sh !== "object") return "";
  const lines = [];
  for (const k of Object.keys(sh)) {
    const v = sh[k];
    if (v === null || v === undefined || v === "") continue;
    lines.push(`${k}=${v}`);
  }
  return lines.join("\n");
}

function ratingCell(agg) {
  const rv = agg?.ratingValue ?? "";
  const rc = agg?.reviewCount ?? "";
  const lines = [];
  if (rv !== null && rv !== undefined && rv !== "") lines.push(`ratingValue=${rv}`);
  if (rc !== null && rc !== undefined && rc !== "") lines.push(`reviewCount=${rc}`);
  return lines.join("\n");
}

/* ================= SHEET OPS ================= */

async function getOrCreateSheet(doc, title, headers) {
  let sheet = doc.sheetsByTitle[title];
  if (!sheet) {
    sheet = await doc.addSheet({ title, headerValues: headers });
    return sheet;
  }
  // loadHeaderRow may fail if sheet was cleared – in that case just set headers
  try {
    await sheet.loadHeaderRow();
    const existing = sheet.headerValues ?? [];
    const same = headers.length === existing.length && headers.every((h, i) => h === existing[i]);
    if (!same) {
      await sheet.setHeaderRow(headers);
    }
  } catch {
    await sheet.setHeaderRow(headers);
  }
  return sheet;
}

async function wipeAllRows(sheet, headers) {
  // clear() is a single API call vs per-row delete (avoids rate limits)
  await sheet.clear();
  await sheet.setHeaderRow(headers);
}

async function addRowsInChunks(sheet, rows, chunkSize = 200) {
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    await sheet.addRows(chunk);
  }
}

/* ================= READ LOCAL JSON FILES ================= */

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

async function readAllCategories() {
  const catDir = path.join(DATA, "categories");
  const files = (await fs.readdir(catDir)).filter((f) => f.endsWith(".json"));
  const categories = [];
  for (const file of files) {
    const cat = await readJson(path.join(catDir, file));
    categories.push(cat);
  }
  // Sort by slug for stable ordering
  categories.sort((a, b) => (a.slug ?? "").localeCompare(b.slug ?? "", "hu"));
  return categories;
}

async function readAllProducts() {
  const prodDir = path.join(DATA, "products");
  const files = (await fs.readdir(prodDir)).filter((f) => f.endsWith(".json"));
  const products = [];
  for (const file of files) {
    const prod = await readJson(path.join(prodDir, file));
    products.push(prod);
  }
  // Sort by categorySlug then slug
  products.sort((a, b) => {
    const c = (a.categorySlug ?? "").localeCompare(b.categorySlug ?? "", "hu");
    if (c !== 0) return c;
    return (a.slug ?? "").localeCompare(b.slug ?? "", "hu");
  });
  return products;
}

/* ================= MAIN ================= */

async function main() {
  console.log("🔧 JSON → Sheets v2 (from split JSON files)");
  console.log("Data dir:", DATA);

  const categories = await readAllCategories();
  const products = await readAllProducts();

  console.log(`📂 Found ${categories.length} categories, ${products.length} products`);

  // Build category rows
  const catRows = [];
  for (const cat of categories) {
    const maincategory = Array.isArray(cat.maincategory)
      ? cat.maincategory.join("\n")
      : String(cat.maincategory ?? "").trim();

    catRows.push({
      categorySlug: String(cat.slug ?? "").trim(),
      maincategory,
      categoryName: String(cat.category ?? "").trim(),
      metaTitle: String(cat.meta?.title ?? "").trim(),
      metaDescription: String(cat.meta?.description ?? "").trim(),
      metaImage: String(cat.meta?.image ?? "").trim(),
      description: String(cat.description ?? "").trim(),
      faqDesc: String(cat.faqdesc ?? "").trim(),
      faq: faqCell(cat.faq),
    });
  }

  // Build product + variant rows
  const productRows = [];
  const variantRows = [];

  for (const p of products) {
    const productSlug = String(p.slug ?? "").trim();
    if (!productSlug) continue;

    const sku = p.variants?.[0]?.sku ?? productSlug;

    productRows.push({
      productSlug,
      categorySlug: String(p.categorySlug ?? "").trim(),
      name: String(p.name ?? "").trim(),
      sku: String(sku).trim(),
      image: String(p.image ?? "").trim(),
      images: imagesCell(p.images),
      metaTitle: String(p.meta?.title ?? "").trim(),
      metaDescription: String(p.meta?.description ?? "").trim(),
      metaImage: String(p.meta?.image ?? "").trim(),
      description: String(p.description ?? "").trim(),
      longDescription1: String(p.longDescription ?? "").trim(),
      longDescription2: String(p.longDescription2 ?? "").trim(),
      longDescription3: String(p.longDescription3 ?? "").trim(),
      material: String(p.material ?? "").trim(),
      audience: toCsv(p.audience),
      blogtags: toCsv(p.blogtags),
      specs: specsCell(p.specs),
      shipping: shippingCell(p.shippingDetails),
      aggregateRating: ratingCell(p.aggregateRating),
    });

    // Variants
    const variants = Array.isArray(p.variants) ? p.variants : [];
    for (const v of variants) {
      variantRows.push({
        variantId: String(v.id ?? "").trim(),
        productSlug,
        title: String(v.title ?? "Alap").trim(),
        sku: String(v.sku ?? productSlug).trim(),
        variant_rank: numOrBlank(v.variant_rank),
        price: numOrBlank(v.price),
        mprice: numOrBlank(v.mprice),
        m2price: numOrBlank(v.m2price),
        m3price: numOrBlank(v.m3price),
        palprice: numOrBlank(v.palprice),
        inventory: numOrBlank(v.stock ?? v.inventory ?? 0),
        discountPrice: numOrBlank(v.discountPrice),
        discountPercent: numOrBlank(v.discountPercent),
        discountValidUntil: String(v.discountValidUntil ?? "").trim(),
        weight: numOrBlank(v.weight),
        length: numOrBlank(v.length),
        width: numOrBlank(v.width),
        height: numOrBlank(v.height),
      });
    }
  }

  console.log(`📊 Rows: Categories=${catRows.length}, Products=${productRows.length}, Variants=${variantRows.length}`);

  // Connect to Google Sheets
  console.log("🔗 Connecting to Google Sheets...");
  const doc = new GoogleSpreadsheet(SHEET_ID, auth);
  await doc.loadInfo();
  console.log(`📄 Sheet: "${doc.title}"`);

  const shCategories = await getOrCreateSheet(doc, SHEETS.Categories.title, SHEETS.Categories.headers);
  const shProducts = await getOrCreateSheet(doc, SHEETS.Products.title, SHEETS.Products.headers);
  const shVariants = await getOrCreateSheet(doc, SHEETS.Variants.title, SHEETS.Variants.headers);

  // Wipe existing data
  console.log("🧹 Wiping existing rows...");
  await wipeAllRows(shCategories, SHEETS.Categories.headers);
  await wipeAllRows(shProducts, SHEETS.Products.headers);
  await wipeAllRows(shVariants, SHEETS.Variants.headers);

  // Upload
  console.log("📤 Uploading rows...");
  await addRowsInChunks(shCategories, catRows, 200);
  console.log(`  ✅ Categories: ${catRows.length} rows`);

  await addRowsInChunks(shProducts, productRows, 200);
  console.log(`  ✅ Products: ${productRows.length} rows`);

  await addRowsInChunks(shVariants, variantRows, 300);
  console.log(`  ✅ Variants: ${variantRows.length} rows`);

  console.log("✅ JSON → Sheets v2 upload kész!");
}

main().catch((e) => {
  console.error("❌ json-to-sheets-v2 failed:", e);
  process.exit(1);
});
