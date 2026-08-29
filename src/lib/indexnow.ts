import { absoluteUrl, siteUrl } from "@/lib/site";

/**
 * Pings IndexNow (Bing, Copilot, Yandex, Seznam) so freshly published score
 * pages are indexed within minutes instead of weeks. No-ops without a key.
 */
export async function submitToIndexNow(paths: string[]): Promise<{ submitted: number; status?: number }> {
  const key = process.env.INDEXNOW_KEY;
  if (!key || paths.length === 0) return { submitted: 0 };
  const host = new URL(siteUrl()).host;
  try {
    const response = await fetch("https://api.indexnow.org/IndexNow", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        host,
        key,
        keyLocation: absoluteUrl(`/${key}.txt`),
        urlList: paths.map((path) => absoluteUrl(path)),
      }),
    });
    return { submitted: paths.length, status: response.status };
  } catch {
    return { submitted: 0 };
  }
}
