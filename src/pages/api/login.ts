export const prerender = false;

import type { APIRoute } from "astro";

const VALID_USERNAME = "admin";
const VALID_PASSWORD = "titkosjelszo";

export const POST: APIRoute = async ({ request, redirect }) => {
  const form = await request.formData();
  const username = form.get("username");
  const password = form.get("password");

  if (username === VALID_USERNAME && password === VALID_PASSWORD) {
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
