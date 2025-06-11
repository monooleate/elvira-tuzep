import type { APIRoute } from 'astro';
import { escape } from 'html-escaper';
import { appendOfferToSheet } from '../../lib/googleSheets';

export const prerender = false;

// ... rate limiting, sanitizeInput, validateEmail, validatePhone – ezek maradhatnak

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

    const offer = {
      name,
      email,
      phone,
      message,
      quantity: body.quantity || 1,
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