// src/pages/api/offer.ts
import type { APIRoute } from 'astro';
import { escape } from 'html-escaper';
import { appendOfferToSheet } from '../../lib/googleSheets';

// ⭐ Ez KRITIKUS - mindig legyen itt!
export const prerender = false;

// Rate limiting
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
  console.log('🔵 POST /api/offer called');
  
  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
  };

  try {
    const ip = request.headers.get('x-forwarded-for') || 
               request.headers.get('x-real-ip') || 
               'unknown';
    
    console.log('IP:', ip);

    if (isRateLimited(ip)) {
      console.log('❌ Rate limited');
      return new Response(
        JSON.stringify({ success: false, error: 'Túl sok kérés, próbáld később.' }), 
        { status: 429, headers }
      );
    }

    let body;
    try {
      body = await request.json();
      console.log('📦 Body received:', JSON.stringify(body, null, 2));
    } catch (parseError) {
      console.error('❌ JSON parse error:', parseError);
      return new Response(
        JSON.stringify({ success: false, error: 'Hibás JSON formátum.' }), 
        { status: 400, headers }
      );
    }

    if (!body || !body.name || !body.email || !body.product) {
      console.log('❌ Missing fields:', { 
        hasName: !!body?.name, 
        hasEmail: !!body?.email, 
        hasProduct: !!body?.product 
      });
      return new Response(
        JSON.stringify({ success: false, error: 'Hiányzó mezők.' }), 
        { status: 400, headers }
      );
    }

    const name = sanitizeInput(body.name);
    const email = sanitizeInput(body.email);
    const phone = body.phone ? sanitizeInput(body.phone) : '';
    const message = body.message ? sanitizeInput(body.message) : '';

    if (!validateEmail(email)) {
      console.log('❌ Invalid email:', email);
      return new Response(
        JSON.stringify({ success: false, error: 'Érvénytelen email.' }), 
        { status: 400, headers }
      );
    }

    if (phone && !validatePhone(phone)) {
      console.log('❌ Invalid phone:', phone);
      return new Response(
        JSON.stringify({ success: false, error: 'Érvénytelen telefonszám.' }), 
        { status: 400, headers }
      );
    }

    if (message && message.length < 5) {
      console.log('❌ Message too short');
      return new Response(
        JSON.stringify({ success: false, error: 'A megjegyzés túl rövid.' }), 
        { status: 400, headers }
      );
    }

    const offer = {
      name,
      email,
      phone,
      message,
      quantity: body.quantity || 1,
      unit: body.unit || '',
      product: body.product,
      contacted: false,
      orderRecorded: false,
      orderCompleted: false,
    };

    console.log('📝 Saving offer:', JSON.stringify(offer, null, 2));
    
    await appendOfferToSheet(offer);
    
    console.log('✅ Offer saved successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Ajánlatkérés sikeresen elmentve!' 
      }), 
      { status: 200, headers }
    );

  } catch (err: any) {
    console.error('❌ Server error:', err);
    console.error('Stack:', err.stack);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Szerverhiba történt. Kérlek próbáld újra később.',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
      }), 
      { status: 500, headers }
    );
  }
};

// ⭐ OPTIONS handler CORS-hoz
export const OPTIONS: APIRoute = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
};