// Stand-in for next/server: route handlers return real Response objects in the browser.
export const NextResponse = {
  json(body: unknown, init?: { status?: number }) {
    return new Response(JSON.stringify(body), { status: init?.status ?? 200, headers: { "content-type": "application/json" } });
  },
};
