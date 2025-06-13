import type { APIRoute } from 'astro';
import { escape } from 'html-escaper';
import { appendOfferToSheet } from '../../lib/googleSheets';

export const prerender = false;

// Rate limiting beállítások
const requestTimestamps = new Map<string, number[]>();
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  if (!requestTimestamps.has(ip)) requestTimestamps.set(ip, []);
  const timestamps = requestTimestamps.get(ip)!.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  timestamps.push(now);
  requestTimestamps.set(ip, timestamps);
  return timestamps.length > RATE_LIMIT_MAX;
}

// Bemenet tisztítása
function sanitizeInput(input: string): string {
  return escape(input.trim());
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePhone(phone: string): boolean {
  return /^[+0-9\s-]*$/.test(phone);
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const ip = request.headers.get('x-forwarded-for') || 'unknown';

    if (isRateLimited(ip)) {
      return new Response(JSON.stringify({ success: false, error: 'Túl sok kérés, próbáld később.' }), { status: 429 });
    }

    const body = await request.json();
    if (!body || !body.name || !body.email || !body.product) {
      return new Response(JSON.stringify({ success: false, error: 'Hiányzó mezők.' }), { status: 400 });
    }

    const name = sanitizeInput(body.name);
    const email = sanitizeInput(body.email);
    const phone = body.phone ? sanitizeInput(body.phone) : '';
    const message = body.message ? sanitizeInput(body.message) : '';

    if (!validateEmail(email)) {
      return new Response(JSON.stringify({ success: false, error: 'Érvénytelen email.' }), { status: 400 });
    }

    if (phone && !validatePhone(phone)) {
      return new Response(JSON.stringify({ success: false, error: 'Érvénytelen telefonszám.' }), { status: 400 });
    }

    if (message && message.length < 5) {
      return new Response(JSON.stringify({ success: false, error: 'A megjegyzés túl rövid.' }), { status: 400 });
    }

    const offer = {
      name,
      email,
      phone,
      message,
      quantity: body.quantity || 1,
      unit: body.unit,
      product: body.product,
      contacted: false,
      orderRecorded: false,
      orderCompleted: false,
    };

    await appendOfferToSheet(offer);

    return new Response(JSON.stringify({ success: true, message: 'Ajánlatkérés mentve a Google Sheetbe.' }), { status: 200 });

  } catch (err: any) {
    console.error('Hiba:', err);
    return new Response(JSON.stringify({ success: false, error: 'Szerverhiba: ' + err.message }), { status: 500 });
  }
};
