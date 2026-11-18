// Fetches a page of someone's site the way a crawler would.

export interface Fetched {
  url: string;
  status: number;
  ms: number;
  html: string;
  contentType: string;
}

const MAX_BYTES = 2_000_000;

export function normalizeOrigin(value: string): string {
  const raw = value.trim();
  const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Use a web address");
  return url.origin;
}

export async function fetchPage(url: string, timeoutMs = 10000): Promise<Fetched> {
  const started = Date.now();
  const response = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(timeoutMs),
    headers: { accept: "text/html,application/xhtml+xml,text/plain;q=0.8,*/*;q=0.5", "user-agent": "Mozilla/5.0 (compatible; ContentStudioBot/1.0)" },
  });
  const contentType = response.headers.get("content-type") ?? "";
  let html = "";
  if (response.body && /html|xml|text/i.test(contentType || "text/html")) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let bytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      html += decoder.decode(value, { stream: true });
      if (bytes > MAX_BYTES) {
        await reader.cancel();
        break;
      }
    }
  } else {
    await response.body?.cancel();
  }
  return { url: response.url || url, status: response.status, ms: Date.now() - started, html, contentType };
}
