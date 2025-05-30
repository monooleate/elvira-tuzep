import type { APIRoute } from 'astro';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export const prerender = false;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const offersFile = path.resolve(__dirname, '../../data/offers.json');

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();

    if (!body || !body.id) {
      return new Response(
        JSON.stringify({ success: false, error: "Hiányzó azonosító" }),
        { status: 400 }
      );
    }

    let existingOffers = [];

    if (fs.existsSync(offersFile)) {
      const content = fs.readFileSync(offersFile, 'utf-8');
      existingOffers = JSON.parse(content);
    }

    const index = existingOffers.findIndex(o => o.id === body.id);

    if (index === -1) {
      return new Response(
        JSON.stringify({ success: false, error: "Ajánlat nem található" }),
        { status: 404 }
      );
    }

    existingOffers[index] = {
      ...existingOffers[index],
      contacted: Boolean(body.contacted),
      orderRecorded: Boolean(body.orderRecorded),
      orderCompleted: Boolean(body.orderCompleted),
    };

    fs.writeFileSync(offersFile, JSON.stringify(existingOffers, null, 2), 'utf-8');

    return new Response(
      JSON.stringify({ success: true, message: "Állapot frissítve." }),
      { status: 200 }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500 }
    );
  }
};
