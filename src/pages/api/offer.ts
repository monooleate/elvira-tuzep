import type { APIRoute } from 'astro';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export const prerender = false; // Szükséges a POST működéshez

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const offersFile = path.resolve(__dirname, '../../data/offers.json');

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();

    if (!body || !body.name || !body.email || !body.product) {
      return new Response(
        JSON.stringify({ success: false, error: "Hiányzó mezők a kérésben" }),
        { status: 400 }
      );
    }

    // Olvasd be az eddigi ajánlatokat (ha van)
    let existingOffers: any[] = [];

    if (fs.existsSync(offersFile)) {
      const content = fs.readFileSync(offersFile, 'utf-8');
      existingOffers = JSON.parse(content);
    }

    // Adjunk hozzá timestampet
    const newOffer = {
      ...body,
      receivedAt: new Date().toISOString(),
    };

    existingOffers.push(newOffer);

    // Írjuk vissza a frissített tömböt
    fs.writeFileSync(offersFile, JSON.stringify(existingOffers, null, 2), 'utf-8');

    return new Response(
      JSON.stringify({ success: true, message: "Ajánlatkérés mentve." }),
      { status: 200 }
    );
  } catch (err) {
    console.error("Mentési hiba:", err);
    return new Response(
      JSON.stringify({ success: false, error: "Szerveroldali hiba: " + err.message }),
      { status: 500 }
    );
  }
};
