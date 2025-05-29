import type { APIRoute } from "astro";

export const GET: APIRoute = () => {
  return new Response(null, {
    status: 302,
    headers: {
      "Set-Cookie": "session=; Path=/; Max-Age=0",
      Location: "/admin",
    },
  });
};
