/**
 * Webhook endpoint: Medusa → Astro újraépítés
 */

import type { APIRoute } from "astro"

export const GET: APIRoute = async () => {
  return new Response("🔧 Rebuild endpoint aktív – csak POST-ot fogad el", {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  })
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json()
    console.log("📦 Medusa webhook event:", body.event ?? "unknown")

    const hookUrl = import.meta.env.BUILD_HOOK_URL
    if (!hookUrl) return new Response("No hook URL", { status: 500 })

    const resp = await fetch(hookUrl, { method: "POST" })
    if (!resp.ok) {
      console.error("❌ Build hook sikertelen:", resp.statusText)
      return new Response("Hook failed", { status: 500 })
    }

    console.log("✅ Netlify build újraindítva.")
    return new Response("Build triggered", { status: 200 })
  } catch (err: any) {
    console.error("⚠️ Webhook error:", err.message)
    return new Response("Error", { status: 500 })
  }
}
