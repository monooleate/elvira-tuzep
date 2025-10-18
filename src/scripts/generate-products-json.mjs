// ───────────────────────────────────────────────
// ✅ Build script: Generate products.json
// Uses Medusa adapter's fetchCategoriesWithProducts()
// Falls back to existing products.json or products_safe.json
// ───────────────────────────────────────────────

import fs from "fs"
import path from "path"
import { fetchCategoriesWithProducts } from "../lib/medusa-adapter-build.js"

// Fájl elérési utak
const OUT_PATH = path.resolve("src/data/products.json")
const SAFE_PATH = path.resolve("src/data/products_safe.json")

// Helper: biztonságos fájlbeolvasás
function readFallback(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, "utf-8")
      return JSON.parse(data)
    }
  } catch (err) {
    console.warn(`⚠️ Nem sikerült beolvasni: ${filePath} → ${err.message}`)
  }
  return null
}

async function main() {
  console.log("🛠️ Termékadatok frissítése Medusából...")

  console.log("ENV CHECK", {
  PUBLIC_USE_API: process.env.PUBLIC_USE_API,
  PUBLIC_API_BASE: process.env.PUBLIC_API_BASE,
  SECRET_API: process.env.SECRET_API ? "***" : "missing"
})

  // 1️⃣ Próbáljuk Medusa API-ról
  try {
    const categories = await fetchCategoriesWithProducts()
    fs.writeFileSync(OUT_PATH, JSON.stringify(categories, null, 2))
    console.log(`✅ ${categories.length} kategória sikeresen mentve → products.json`)
    return
  } catch (err) {
    console.warn("⚠️ Medusa letöltés sikertelen:", err.message)
  }

  // 2️⃣ Fallback: meglévő products.json
  const prev = readFallback(OUT_PATH)
  if (prev) {
    console.warn("⚠️ A meglévő products.json marad változatlanul.")
    return
  }

  // 3️⃣ Végső fallback: products_safe.json
  const safe = readFallback(SAFE_PATH)
  if (safe) {
    fs.writeFileSync(OUT_PATH, JSON.stringify(safe, null, 2))
    console.warn("⚠️ products_safe.json használva vészhelyzeti adatforrásként.")
    return
  }

  // 4️⃣ Semmi sem elérhető → build error
  console.error("❌ Nincs elérhető adat. Build megszakítva.")
  process.exit(1)
}

await main()
