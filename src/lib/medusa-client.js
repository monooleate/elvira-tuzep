// src/lib/medusa-client.js
import Medusa from "@medusajs/js-sdk";

let BASE;
let TOKEN;
const DEBUG = process.env.NODE_ENV === "development";

// --- Környezeti változók kezelése ---
if (process.env.NODE_ENV === "development") {
  BASE =
    process.env.PUBLIC_API_BASE ||
    process.env.PUBLIC_API_URL ||
    "http://localhost:9000";
  TOKEN =
    process.env.PUBLIC_API_KEY ||
    process.env.PUBLIC_PUBLISHABLE_KEY ||
    "";
} else {
  BASE =
    process.env.PUBLIC_API_BASE ||
    process.env.PUBLIC_API_URL ||
    "http://localhost:9000";
  TOKEN =
    process.env.PUBLIC_API_KEY ||
    process.env.PUBLIC_PUBLISHABLE_KEY ||
    "";
}

// --- Validáció ---
if (!BASE)
  console.warn(
    "⚠️ Nincs megadva Medusa BASE URL (PUBLIC_API_BASE / PUBLIC_API_URL)"
  );
if (!TOKEN)
  console.warn(
    "⚠️ Nincs megadva Medusa PUBLISHABLE KEY (PUBLIC_API_KEY / PUBLIC_PUBLISHABLE_KEY)"
  );

// --- SDK példány létrehozása ---
export const sdk = new Medusa({
  baseUrl: BASE || "http://localhost:9000",
  publishableKey: TOKEN || "",
  debug: DEBUG,
});

// --- Fejlesztői log ---
if (DEBUG) {
  console.log("🔍 Medusa SDK konfigurálva:", {
    baseUrl: BASE,
    publishableKey: TOKEN ? "[HIDDEN]" : "❌ missing",
  });
}
