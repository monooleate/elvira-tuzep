// scripts/sheets-to-json.mjs
import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { GoogleSpreadsheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";

/* ================= ENV + AUTH ================= */

const ROOT = process.cwd();
const OUT = path.join(ROOT, "src", "data");

const SHEET_ID = process.env.GOOGLE_SHEET_ID_UPLOADER;
const SA_B64 = process.env.GOOGLE_SA_JSON_BASE64;

if (!SHEET_ID) throw new Error("Missing env GOOGLE_SHEET_ID");
if (!SA_B64) throw new Error("Missing env GOOGLE_SA_JSON_BASE64");

const SA_JSON = JSON.parse(Buffer.from(SA_B64, "base64").toString("utf8"));
const fixedKey = String(SA_JSON.private_key || "").replace(/\\n/g, "\n");

const auth = new JWT({
  email: SA_JSON.client_email,
  key: fixedKey,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const doc = new GoogleSpreadsheet(SHEET_ID, auth);
await doc.loadInfo();

/* ================= HELPERS ================= */

function ensureDir(p) {
  return fs.mkdir(p, { recursive: true });
}

function writeJson(p, data) {
  return fs.writeFile(p, JSON.stringify(data, null, 2) + "\n");
}

function cell(row, header) {
  if (!row) return "";
  if (typeof row.get === "function") return String(row.get(header) ?? "").trim();
  return String(row?.[header] ?? "").trim();
}

function parseMultiLine(cellStr) {
  if (!cellStr || typeof cellStr !== "string") return [];
  return cellStr
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function num(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;

  const s = String(v).trim();
  if (!s) return null;

  const cleaned = s.replace(/\s+/g, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function nullableStr(v) {
  const s = String(v ?? "").trim();
  return s ? s : null;
}

// images cell: ENTER + "src ; alt"
function parseImages(cellStr) {
  if (!cellStr || typeof cellStr !== "string") return [];
  return cellStr
    .split(/\r?\n/)
    .map((line) => {
      const [src, alt] = line.split(";").map((s) => s?.trim());
      if (!src) return null;
      return { src, alt: alt || "" };
    })
    .filter(Boolean);
}

// FAQ cell: Q:/A:/ID: blocks separated by blank lines
function parseFAQ(cellStr) {
  if (!cellStr || typeof cellStr !== "string") return [];
  const blocks = cellStr
    .split(/\r?\n\r?\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  const out = [];
  let autoId = 1;

  for (const b of blocks) {
    const lines = b.split(/\r?\n/);
    let q = "";
    let a = "";
    let id = "";

    for (const ln of lines) {
      const s = ln.trim();
      if (s.startsWith("Q:")) q = s.slice(2).trim();
      else if (s.startsWith("A:")) a = s.slice(2).trim();
      else if (s.startsWith("ID:")) id = s.slice(3).trim();
    }

    if (!q || !a) continue;
    out.push({
      id: id || String(autoId++),
      question: q,
      answer: a,
    });
  }
  return out;
}

// specs cell: "order :: label = value" (stable hash keys)
function parseSpecs(cellStr) {
  if (!cellStr || typeof cellStr !== "string") return null;

  const lines = cellStr
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (!lines.length) return null;

  const specs = {};
  let i = 0;

  for (const ln of lines) {
    const [left, right] = ln.split("::").map((s) => s?.trim());
    if (!right) continue;

    const order = num(left) ?? null;

    const eqIdx = right.indexOf("=");
    const label = (eqIdx >= 0 ? right.slice(0, eqIdx) : right).trim();
    const value = (eqIdx >= 0 ? right.slice(eqIdx + 1) : "").trim();

    if (!label && !value) continue;

    i += 1;
    const key = crypto
      .createHash("sha1")
      .update(`${order ?? ""}::${label}::${value}::${i}`)
      .digest("hex")
      .slice(0, 10);

    specs[key] = { label, order, value };
  }

  return Object.keys(specs).length ? specs : null;
}

// shipping cell: "key=value" lines
function parseShipping(cellStr) {
  if (!cellStr || typeof cellStr !== "string") return null;

  const lines = cellStr
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (!lines.length) return null;

  const sh = {};
  for (const ln of lines) {
    const [k, ...rest] = ln.split("=");
    const key = String(k ?? "").trim();
    const val = rest.join("=").trim();
    if (!key || !val) continue;

    const n = num(val);
    sh[key] = n !== null ? n : val;
  }

  return Object.keys(sh).length ? sh : null;
}

// aggregateRating cell: "ratingValue=4.7" "reviewCount=12"
function parseRating(cellStr) {
  if (!cellStr || typeof cellStr !== "string") return null;

  const lines = cellStr
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  let ratingValue = null;
  let reviewCount = null;

  for (const ln of lines) {
    const [k, v] = ln.split("=").map((s) => s?.trim());
    if (k === "ratingValue") ratingValue = num(v);
    if (k === "reviewCount") reviewCount = num(v);
  }

  if (ratingValue === null && reviewCount === null) return null;

  const out = { "@type": "AggregateRating" };
  if (ratingValue !== null) out.ratingValue = ratingValue;
  if (reviewCount !== null) out.reviewCount = reviewCount;
  return out;
}

function autoVariantId(productSlug, title, sku) {
  const key = `${productSlug}::${title ?? ""}::${sku ?? ""}`;
  return "v_" + crypto.createHash("sha1").update(key).digest("hex").slice(0, 16);
}

/**
 * Discount aggregation from variants (ACTIVE only):
 * - hasDiscount: true if any variant has discountPercent>0 AND validUntil is in the future
 * - discountPercent: max discountPercent among ACTIVE variants
 * - discountValidUntil: earliest validUntil among ACTIVE variants
 */
function discountInfoFromVariants(variants) {
  if (!Array.isArray(variants) || variants.length === 0) {
    return { discountPercent: null, discountValidUntil: null, hasDiscount: false };
  }

  // Parse YYYY-MM-DD as LOCAL end-of-day, otherwise Date(s)
  function parseValidUntil(s) {
    const raw = String(s ?? "").trim();
    if (!raw) return null;

    const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) {
      const y = Number(m[1]);
      const mo = Number(m[2]) - 1;
      const d = Number(m[3]);
      // end of day local time
      const dt = new Date(y, mo, d, 23, 59, 59, 999);
      return Number.isNaN(dt.getTime()) ? null : dt;
    }

    const dt = new Date(raw);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  const now = Date.now();

  const activePercents = [];
  const activeDates = []; // store as original string for output + as Date for compare

  for (const v of variants) {
    const p = num(v?.discountPercent);
    if (p === null || p <= 0) continue;

    const untilStr = nullableStr(v?.discountValidUntil);
    if (!untilStr) continue;

    const untilDate = parseValidUntil(untilStr);
    if (!untilDate) continue;

    if (untilDate.getTime() > now) {
      activePercents.push(p);
      activeDates.push({ untilStr, untilMs: untilDate.getTime() });
    }
  }

  if (activePercents.length === 0) {
    return { discountPercent: null, discountValidUntil: null, hasDiscount: false };
  }

  const discountPercent = Math.max(...activePercents);

  // Earliest expiry among ACTIVE variants
  activeDates.sort((a, b) => a.untilMs - b.untilMs);
  const discountValidUntil = activeDates[0]?.untilStr ?? null;

  return { discountPercent, discountValidUntil, hasDiscount: true };
}


/* ================= READ SHEETS ================= */

const shCategories = doc.sheetsByTitle["Categories"];
const shProducts = doc.sheetsByTitle["Products"];
const shVariants = doc.sheetsByTitle["Variants"];

if (!shCategories) throw new Error('Missing sheet "Categories"');
if (!shProducts) throw new Error('Missing sheet "Products"');
if (!shVariants) throw new Error('Missing sheet "Variants"');

await shCategories.loadHeaderRow();
await shProducts.loadHeaderRow();
await shVariants.loadHeaderRow();

const categoriesRows = await shCategories.getRows();
const productsRows = await shProducts.getRows();
const variantsRows = await shVariants.getRows();

/* ================= INDEX VARIANTS BY PRODUCT ================= */

const variantsByProduct = {};
for (const v of variantsRows) {
  const productSlug = cell(v, "productSlug");
  if (!productSlug) continue;

  const title = cell(v, "title") || "Alap";
  const sku = cell(v, "sku") || productSlug;

  const variantId = cell(v, "variantId") || autoVariantId(productSlug, title, sku);

  const variant = {
    id: variantId,
    title,
    sku,
    variant_rank: num(cell(v, "variant_rank")) ?? 0,

    price: num(cell(v, "price")),
    mprice: num(cell(v, "mprice")),
    m2price: num(cell(v, "m2price")),
    m3price: num(cell(v, "m3price")),
    palprice: num(cell(v, "palprice")),

    discountPrice: num(cell(v, "discountPrice")),
    discountPercent: num(cell(v, "discountPercent")),
    discountValidUntil: nullableStr(cell(v, "discountValidUntil")),

    // NOTE: your sheet header is "inventory" (not stock). If you really want "stock" in JSON, keep it.
    stock: num(cell(v, "stock")) ?? num(cell(v, "inventory")) ?? 0,

    weight: num(cell(v, "weight")),
    length: num(cell(v, "length")),
    width: num(cell(v, "width")),
    height: num(cell(v, "height")),
  };

  if (!variantsByProduct[productSlug]) variantsByProduct[productSlug] = [];
  variantsByProduct[productSlug].push(variant);
}

// sort variants by rank
for (const k of Object.keys(variantsByProduct)) {
  variantsByProduct[k].sort((a, b) => (a.variant_rank ?? 0) - (b.variant_rank ?? 0));
}

/* ================= GENERATE JSON ================= */

await ensureDir(path.join(OUT, "categories"));
await ensureDir(path.join(OUT, "category-products"));
await ensureDir(path.join(OUT, "products"));
await ensureDir(path.join(OUT, "index"));

const globalIndex = [];

let writtenCategories = 0;
let writtenProducts = 0;

for (const c of categoriesRows) {
  const categorySlug = cell(c, "categorySlug");
  if (!categorySlug) continue;

  // maincategory: 1 line -> string, multiple lines -> array, empty -> null
  const maincats = parseMultiLine(cell(c, "maincategory"));
  let maincategory = null;
  if (maincats.length === 1) maincategory = maincats[0];
  else if (maincats.length > 1) maincategory = maincats;

  const categoryJson = {
    maincategory,
    category: cell(c, "categoryName"),
    slug: categorySlug,
    meta: {
      title: cell(c, "metaTitle"),
      description: cell(c, "metaDescription"),
      image: cell(c, "metaImage"),
    },
    description: cell(c, "description"),
    faqdesc: cell(c, "faqDesc"),
    faq: parseFAQ(cell(c, "faq")),
  };

  await writeJson(path.join(OUT, "categories", `${categorySlug}.json`), categoryJson);
  writtenCategories += 1;

  // products for category
  const products = productsRows.filter((p) => cell(p, "categorySlug") === categorySlug);
  const listItems = [];

  for (const p of products) {
    const productSlug = cell(p, "productSlug");
    if (!productSlug) continue;

    const images = parseImages(cell(p, "images"));
    const image = nullableStr(cell(p, "image"));

    const variants =
      variantsByProduct[productSlug] ??
      [
        {
          id: autoVariantId(productSlug, "Alap", cell(p, "sku") || productSlug),
          title: "Alap",
          sku: cell(p, "sku") || productSlug,
          variant_rank: 0,
          price: null,
          mprice: null,
          m2price: null,
          m3price: null,
          palprice: null,
          discountPrice: null,
          discountPercent: null,
          discountValidUntil: null,
          stock: 0,
          weight: null,
          length: null,
          width: null,
          height: null,
        },
      ];

    const stock = variants.reduce((s, v) => s + (num(v?.stock) ?? 0), 0);

    const prices = variants.map((v) => num(v.price)).filter((x) => x !== null);
    const priceFrom = prices.length ? Math.min(...prices) : null;
    const priceTo = prices.length ? Math.max(...prices) : null;

    // ✅ NEW: per-product discount info aggregated from variants
    const discountInfo = discountInfoFromVariants(variants);

    const productJson = {
      categorySlug,
      name: cell(p, "name"),
      slug: productSlug,

      meta: {
        title: cell(p, "metaTitle") || cell(p, "name"),
        description: cell(p, "metaDescription") || "",
        image: cell(p, "metaImage") || "",
      },

      description: cell(p, "description"),

      longDescription: cell(p, "longDescription1"),
      longDescription2: cell(p, "longDescription2"),
      longDescription3: cell(p, "longDescription3"),

      material: nullableStr(cell(p, "material")),
      audience: cell(p, "audience")
        ? cell(p, "audience").split(",").map((x) => x.trim()).filter(Boolean)
        : [],
      blogtags: cell(p, "blogtags")
        ? cell(p, "blogtags").split(",").map((x) => x.trim()).filter(Boolean)
        : [],

      specs: parseSpecs(cell(p, "specs")),
      shippingDetails: parseShipping(cell(p, "shipping")),
      aggregateRating: parseRating(cell(p, "aggregateRating")),

      image,
      images,

      variants,
      stock,
      priceFrom,
      priceTo: priceTo !== null && priceFrom !== null && priceTo !== priceFrom ? priceTo : null,

      // optional: keep also on product.json (harmless, useful for UI)
      ...discountInfo,
    };

    await writeJson(path.join(OUT, "products", `${productSlug}.json`), productJson);
    writtenProducts += 1;

    // list item (category list + global index)
    const item = {
      slug: productSlug,
      categorySlug,
      name: productJson.name,
      description: productJson.description || "",
      sku: nullableStr(cell(p, "sku")),

      image,
      images,

      priceFrom,
      priceTo: productJson.priceTo,
      stock,

      // ✅ NEW: needed in category-products list items
      discountPercent: discountInfo.discountPercent,
      discountValidUntil: discountInfo.discountValidUntil,
      hasDiscount: discountInfo.hasDiscount,

      variantTitles: variants.map((v) => v.title).filter(Boolean),
      variantSkus: variants.map((v) => v.sku).filter(Boolean),
    };

    listItems.push(item);
    globalIndex.push(item);
  }

  await writeJson(
    path.join(OUT, "category-products", `${categorySlug}.list.json`),
    { categorySlug, items: listItems }
  );
}

await writeJson(path.join(OUT, "index", "products.index.json"), globalIndex);

console.log("✅ Sheets → JSON build completed");
console.log("Written categories:", writtenCategories);
console.log("Written products:  ", writtenProducts);
console.log("Index items:       ", globalIndex.length);
