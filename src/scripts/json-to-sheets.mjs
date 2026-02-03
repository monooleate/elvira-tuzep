// scripts/json-to-sheets.mjs
import "dotenv/config";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import { GoogleSpreadsheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";

const INPUT_PATH = process.argv.find((a) => a.startsWith("--input="))?.split("=")[1]
  ?? "src/data/products.json";

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const SA_B64 = process.env.GOOGLE_SA_JSON_BASE64;

if (!SHEET_ID) throw new Error("Missing env GOOGLE_SHEET_ID");
if (!SA_B64) throw new Error("Missing env GOOGLE_SA_JSON_BASE64");

const SA_JSON = JSON.parse(Buffer.from(SA_B64, "base64").toString("utf8"));

// ---------------------------
// Sheet names + headers
// ---------------------------
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

// ---------------------------
// Helpers
// ---------------------------
function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

function toCsv(arr) {
  if (!Array.isArray(arr)) return "";
  return arr.map((x) => String(x ?? "").trim()).filter(Boolean).join(",");
}

function sha1(s) {
  return crypto.createHash("sha1").update(s).digest("hex").slice(0, 16);
}

// Stable variantId generation (deterministic)
function makeVariantId(productSlug, title, sku) {
  const key = `${productSlug}::${title ?? ""}::${sku ?? ""}`;
  return `v_${sha1(key)}`;
}

function normalizeImageString(v) {
  // Rule: Products.image should be string if string, else empty => later treated as null
  return isNonEmptyString(v) ? v.trim() : "";
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
    .join("\n"); // 👈 ENTER-rel elválasztva
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
  // specs is object: { key: { label, order, value } }
  if (!specs || typeof specs !== "object") return "";
  const lines = [];
  for (const key of Object.keys(specs)) {
    const s = specs[key];
    if (!s) continue;
    const order = (s.order === null || s.order === undefined) ? "" : String(s.order);
    const label = String(s.label ?? key).trim();
    const value = String(s.value ?? "").trim();
    if (!label && !value) continue;
    lines.push(`${order} :: ${label} = ${value}`.trim());
  }
  // stable sort by numeric order then label
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
  // shippingDetails: { weight, length, width, height } or other keys
  if (!sh || typeof sh !== "object") return "";
  const keys = Object.keys(sh);
  const lines = [];
  for (const k of keys) {
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

function numOrBlank(v) {
  // Keep numeric or blank string (Sheet friendly)
  return (typeof v === "number" && Number.isFinite(v)) ? v : "";
}

// ---------------------------
// Sheet ops
// ---------------------------
async function getOrCreateSheet(doc, title, headers) {
  let sheet = doc.sheetsByTitle[title];
  if (!sheet) {
    sheet = await doc.addSheet({ title, headerValues: headers });
    return sheet;
  }

  await sheet.loadHeaderRow();
  const existing = sheet.headerValues ?? [];
  const same = headers.length === existing.length && headers.every((h, i) => h === existing[i]);

  if (!same) {
    // If header differs, overwrite header row
    // NOTE: This does not delete data; we wipe rows below anyway
    await sheet.setHeaderRow(headers);
  }

  return sheet;
}

async function wipeAllRows(sheet) {
  // delete all rows (keeps header)
  const rows = await sheet.getRows();
  // delete from bottom to top to be safe
  for (let i = rows.length - 1; i >= 0; i--) {
    await rows[i].delete();
  }
}

async function addRowsInChunks(sheet, rows, chunkSize = 300) {
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    // eslint-disable-next-line no-await-in-loop
    await sheet.addRows(chunk);
  }
}

// ---------------------------
// Main
// ---------------------------
async function main() {
  console.log("🔧 JSON → Sheets import");
  console.log("Input:", INPUT_PATH);

  const raw = await fs.readFile(INPUT_PATH, "utf8");
  const categories = JSON.parse(raw);

  if (!Array.isArray(categories)) {
    throw new Error("Input products.json must be an array of categories");
  }

 const rawKey = SA_JSON.private_key;
// gyakori: env-ből jön \\n formában, ezt vissza kell alakítani
const fixedKey = typeof rawKey === "string" ? rawKey.replace(/\\n/g, "\n") : rawKey;

const auth = new JWT({
  email: SA_JSON.client_email,
  key: fixedKey,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const doc = new GoogleSpreadsheet(SHEET_ID, auth);
  await doc.loadInfo();

  const shCategories = await getOrCreateSheet(doc, SHEETS.Categories.title, SHEETS.Categories.headers);
  const shProducts = await getOrCreateSheet(doc, SHEETS.Products.title, SHEETS.Products.headers);
  const shVariants = await getOrCreateSheet(doc, SHEETS.Variants.title, SHEETS.Variants.headers);

  // Wipe existing data
  console.log("🧹 Wiping existing rows...");
  await wipeAllRows(shCategories);
  await wipeAllRows(shProducts);
  await wipeAllRows(shVariants);

  const catRows = [];
  const productRows = [];
  const variantRows = [];

  const seenCategorySlugs = new Set();
  const seenProductSlugs = new Set();
  const seenVariantIds = new Set();

  for (const cat of categories) {
    const categorySlug = String(cat?.slug ?? "").trim();
    if (!categorySlug) continue;

    if (seenCategorySlugs.has(categorySlug)) {
      console.warn("⚠️ Duplicate categorySlug in input:", categorySlug);
    }
    seenCategorySlugs.add(categorySlug);

    catRows.push({
      categorySlug,
      maincategory: String(cat?.maincategory ?? "").trim(),
      categoryName: String(cat?.category ?? "").trim(),
      metaTitle: String(cat?.meta?.title ?? "").trim(),
      metaDescription: String(cat?.meta?.description ?? "").trim(),
      metaImage: String(cat?.meta?.image ?? "").trim(),
      description: String(cat?.description ?? "").trim(),
      faqDesc: String(cat?.faqdesc ?? "").trim(),
      faq: faqCell(cat?.faq),
    });

    const products = Array.isArray(cat?.products) ? cat.products : [];
    for (const p of products) {
      const productSlug = String(p?.slug ?? "").trim();
      if (!productSlug) continue;

      if (seenProductSlugs.has(productSlug)) {
        console.warn("⚠️ Duplicate productSlug across categories:", productSlug);
      }
      seenProductSlugs.add(productSlug);

      const image =
        normalizeImageString(p?.meta?.image) ||
        normalizeImageString(p?.image) ||
        "";

      productRows.push({
        productSlug,
        categorySlug,
        name: String(p?.name ?? "").trim(),
        sku: String(p?.sku ?? "").trim(),
        image, // if empty => treated as null by generator later
        images: imagesCell(p?.images),

        metaTitle: String(p?.meta?.title ?? "").trim(),
        metaDescription: String(p?.meta?.description ?? "").trim(),
        metaImage: String(p?.meta?.image ?? "").trim(),

        description: String(p?.description ?? "").trim(),

        longDescription1: String(p?.longDescription ?? "").trim(),
        longDescription2: String(p?.longDescription2 ?? "").trim(),
        longDescription3: String(p?.longDescription3 ?? "").trim(), // HTML allowed

        material: String(p?.material ?? "").trim(),
        audience: toCsv(p?.audience),
        blogtags: toCsv(p?.blogtags),

        specs: specsCell(p?.specs),
        shipping: shippingCell(p?.shippingDetails),
        aggregateRating: ratingCell(p?.aggregateRating),
      });

      // -------- Variants import --------
      const vlist = Array.isArray(p?.variants) ? p.variants : null;

      const legacyProductPrices = {
        price: p?.price,
        mprice: p?.mprice,
        m2price: p?.m2price,
        m3price: p?.m3price,
        palprice: p?.palprice,
      };

      const legacyDiscount = {
        discountPrice: p?.discountPrice,
        discountPercent: p?.discountPercent,
        discountValidUntil: p?.discountValidUntil,
      };

      if (vlist && vlist.length > 0) {
        for (const v of vlist) {
          const title = String(v?.title ?? "Alap").trim() || "Alap";
          const sku = String(v?.sku ?? p?.sku ?? productSlug).trim();

          let variantId = String(v?.id ?? "").trim();
          if (!variantId) variantId = makeVariantId(productSlug, title, sku);

          if (seenVariantIds.has(variantId)) {
            // extremely rare; stabilize by suffix
            variantId = `${variantId}_${sha1(`${variantId}::${Math.random()}`)}`;
          }
          seenVariantIds.add(variantId);

          // inventory in legacy variants: v.metadata.inventory preferred
          const inv = v?.metadata?.inventory ?? v?.inventory ?? v?.stock ?? p?.stock ?? 0;

          // If unit prices are not variant-specific in legacy, inherit from product
          variantRows.push({
            variantId,
            productSlug,
            title,
            sku,
            variant_rank: (v?.variant_rank ?? 0),

            price: numOrBlank(v?.price ?? legacyProductPrices.price),
            mprice: numOrBlank(legacyProductPrices.mprice),
            m2price: numOrBlank(legacyProductPrices.m2price),
            m3price: numOrBlank(legacyProductPrices.m3price),
            palprice: numOrBlank(legacyProductPrices.palprice),

            inventory: numOrBlank(inv),

            discountPrice: numOrBlank(legacyDiscount.discountPrice),
            discountPercent: numOrBlank(legacyDiscount.discountPercent),
            discountValidUntil: String(legacyDiscount.discountValidUntil ?? "").trim(),

            weight: numOrBlank(v?.weight),
            length: numOrBlank(v?.length),
            width: numOrBlank(v?.width),
            height: numOrBlank(v?.height),
          });
        }
      } else {
        // No variants => create 1 "Alap" variant and move pricing/stock/discount from product into it
        const title = "Alap";
        const sku = String(p?.sku ?? productSlug).trim();
        let variantId = makeVariantId(productSlug, title, sku);
        if (seenVariantIds.has(variantId)) {
          variantId = `${variantId}_${sha1(`${variantId}::${Math.random()}`)}`;
        }
        seenVariantIds.add(variantId);

        variantRows.push({
          variantId,
          productSlug,
          title,
          sku,
          variant_rank: 0,

          price: numOrBlank(legacyProductPrices.price),
          mprice: numOrBlank(legacyProductPrices.mprice),
          m2price: numOrBlank(legacyProductPrices.m2price),
          m3price: numOrBlank(legacyProductPrices.m3price),
          palprice: numOrBlank(legacyProductPrices.palprice),

          inventory: numOrBlank(p?.stock ?? 0),

          discountPrice: numOrBlank(legacyDiscount.discountPrice),
          discountPercent: numOrBlank(legacyDiscount.discountPercent),
          discountValidUntil: String(legacyDiscount.discountValidUntil ?? "").trim(),

          weight: "",
          length: "",
          width: "",
          height: "",
        });
      }
    }
  }

  console.log("📤 Uploading rows...");
  console.log("Categories:", catRows.length);
  console.log("Products:  ", productRows.length);
  console.log("Variants:  ", variantRows.length);

  await addRowsInChunks(shCategories, catRows, 200);
  await addRowsInChunks(shProducts, productRows, 200);
  await addRowsInChunks(shVariants, variantRows, 300);

  console.log("✅ JSON → Sheets import kész.");
  console.log("Sheet:", doc.title);
}

main().catch((e) => {
  console.error("❌ json-to-sheets failed:", e);
  process.exit(1);
});
