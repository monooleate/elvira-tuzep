export const prerender = false;

import type { APIRoute } from "astro";
import dotenv from 'dotenv';

dotenv.config();

const adminPassword = process.env.ADMIN_PASSWORD;
const adminUsername = process.env.ADMIN_USERNAME;


export const POST: APIRoute = async ({ request, redirect }) => {
  const form = await request.formData();
  const username = form.get("username");
  const password = form.get("password");

 if (username === adminUsername && password === adminPassword) {
    return new Response(null, {
      status: 302,
      headers: {
        "Set-Cookie": `session=valid; Path=/; HttpOnly; SameSite=Lax`,
        Location: "/admin",
      },
    });
  }

  return redirect("/admin?error=1");
};
