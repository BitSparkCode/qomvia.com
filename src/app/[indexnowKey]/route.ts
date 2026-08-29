/**
 * IndexNow requires the API key to be served as `<key>.txt` at the site root,
 * which is what proves ownership of the host when we submit new score pages.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ indexnowKey: string }> }) {
  const { indexnowKey } = await params;
  const key = process.env.INDEXNOW_KEY;
  if (!key || indexnowKey !== `${key}.txt`) return new Response("Not found", { status: 404 });
  return new Response(key, { headers: { "content-type": "text/plain; charset=utf-8" } });
}
