// Search results and the questions people ask, through the Gateway's
// DataForSEO capability. Off when the Gateway holds no key.
import { env } from "cloudflare:workers";
import { ConfigurationError, gatewayRefusal, integrationFetch, integrationStatus } from "@every-app/sdk/server";
import { COUNTRIES } from "@/shared/locales";
import { UserError } from "./errors";

export async function searchDataReady(): Promise<boolean> {
  try {
    return (await integrationStatus({ env, provider: "dataforseo" })).ready;
  } catch (error) {
    if (error instanceof ConfigurationError) return false;
    throw error;
  }
}

export interface SearchResults {
  urls: string[];
  questions: string[];
}

export async function topResults(query: string, language: string, country: string): Promise<SearchResults> {
  let call: typeof fetch;
  try {
    call = integrationFetch({ env, provider: "dataforseo" });
  } catch (error) {
    if (error instanceof ConfigurationError) throw new UserError("Search data isn't set up. Paste the result URLs instead.");
    throw error;
  }
  const location = COUNTRIES.find((c) => c.code === country)?.location ?? 2840;
  const response = await call("https://api.dataforseo.com/v3/serp/google/organic/live/advanced", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify([{ keyword: query, language_code: language, location_code: location, depth: 10 }]),
  });
  const refusal = await gatewayRefusal(response.clone());
  if (refusal) throw new UserError(refusal.setup ?? "Search data isn't set up. Paste the result URLs instead.");
  if (!response.ok) throw new UserError(`Search data answered ${response.status}. Paste the result URLs instead.`);
  type Item = { type?: string; url?: string; rank_group?: number; title?: string; items?: { title?: string }[] };
  const body = (await response.json()) as { tasks?: { status_message?: string; result?: { items?: Item[] }[] }[] };
  const items = body.tasks?.[0]?.result?.[0]?.items ?? [];
  const urls = items
    .filter((i) => i.type === "organic" && i.url)
    .sort((a, b) => (a.rank_group ?? 0) - (b.rank_group ?? 0))
    .map((i) => i.url!)
    .slice(0, 10);
  const questions = items
    .filter((i) => i.type === "people_also_ask")
    .flatMap((i) => i.items ?? [])
    .map((q) => q.title?.trim() ?? "")
    .filter(Boolean);
  if (!urls.length) throw new UserError(body.tasks?.[0]?.status_message ?? "Search returned no results for that query.");
  return { urls, questions };
}
