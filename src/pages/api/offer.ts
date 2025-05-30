import type { APIRoute } from 'astro';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { escape } from 'html-escaper';

export const prerender = false;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const offersFile = path.resolve(__dirname, '../../data/offers.json');

// Egyszerű rate limiting: IP alapú tároló (fejleszthető pl Redis-szel)
const requestTimestamps = new Map<string, number[]>();
const RATE_LIMIT_MAX = 5; // max kérések időablakonként
const RATE_LIMIT_WINDOW_MS = 60000; // 1 perc

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  if (!requestTimestamps.has(ip)) requestTimestamps.set(ip, []);
  const timestamps = requestTimestamps.get(ip)!.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  timestamps.push(now);
  requestTimestamps.set(ip, timestamps);
  return timestamps.length > RATE_LIMIT_MAX;
}

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
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('remote_addr') || 'unknown';

    if (isRateLimited(ip)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Túl sok kérés, próbáld később.' }),
        { status: 429 }
      );
    }

    const body = await request.json();

    if (!body || !body.name || !body.email || !body.product) {
      return new Response(
        JSON.stringify({ success: false, error: 'Hiányzó mezők a kérésben.' }),
        { status: 400 }
      );
    }

    // Szerveroldali sanitizálás és validáció
    const name = sanitizeInput(body.name);
    const email = sanitizeInput(body.email);
    const phone = body.phone ? sanitizeInput(body.phone) : '';
    const message = body.message ? sanitizeInput(body.message) : '';

    if (!validateEmail(email)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Érvénytelen email cím.' }),
        { status: 400 }
      );
    }

    if (phone && !validatePhone(phone)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Érvénytelen telefonszám.' }),
        { status: 400 }
      );
    }

    // Minimális hossz a megjegyzésnek, ha megvan adva
    if (message && message.length < 5) {
      return new Response(
        JSON.stringify({ success: false, error: 'A megjegyzés túl rövid.' }),
        { status: 400 }
      );
    }

    // Olvasd be az eddigi ajánlatokat (ha van)
    let existingOffers: any[] = [];

    if (fs.existsSync(offersFile)) {
      const content = fs.readFileSync(offersFile, 'utf-8');
      existingOffers = JSON.parse(content);
    }

    // Új ajánlat timestamp-tel
const timestamp = new Date().toISOString();

const newOffer = {
  id: timestamp,
  name,
  email,
  phone,
  message,
  quantity: body.quantity || 1,
  product: body.product,
  contacted: false,
  orderRecorded: false,
  orderCompleted: false,
  receivedAt: timestamp,
};


    existingOffers.push(newOffer);

    // Írjuk vissza
    fs.writeFileSync(offersFile, JSON.stringify(existingOffers, null, 2), 'utf-8');

    return new Response(
      JSON.stringify({ success: true, message: 'Ajánlatkérés mentve.' }),
      { status: 200 }
    );
  } catch (err) {
    console.error('Mentési hiba:', err);
    return new Response(
      JSON.stringify({ success: false, error: 'Szerveroldali hiba: ' + err.message }),
      { status: 500 }
    );
  }
};
