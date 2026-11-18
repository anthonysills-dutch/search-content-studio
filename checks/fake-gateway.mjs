// A local stand-in for a Gateway that has search data and an AI provider
// configured. It answers the paths the SDK sends over EVERY_APP_GATEWAY.
export function fakeGateway(siteOrigin) {
  const source = `
const SITE = ${JSON.stringify(siteOrigin)};
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
export default { async fetch(request) {
  const url = new URL(request.url);
  if (url.pathname === "/api/integrations/dataforseo") return json({ requested: true, configured: true, ready: true });
  if (url.pathname.includes("/dataforseo/") && url.pathname.endsWith("/serp/google/organic/live/advanced")) {
    return json({ status_code: 20000, tasks: [{ status_code: 20000, result: [{ items: [
      { type: "organic", rank_group: 1, url: SITE + "/guides/cold-brew", title: "How to make cold brew coffee at home" },
      { type: "people_also_ask", items: [ { title: "Is cold brew stronger than hot coffee?" }, { title: "Do you dilute cold brew concentrate?" } ] },
      { type: "organic", rank_group: 2, url: SITE + "/guides/grind-size", title: "Coffee grind size chart" },
      { type: "organic", rank_group: 3, url: SITE + "/recipes/concentrate", title: "Cold brew concentrate recipe" },
    ] }] }] });
  }
  if (url.pathname.endsWith("/chat/completions")) {
    const body = await request.json();
    const text = body.messages.map((m) => m.content).join("\\n");
    let content;
    if (body.max_tokens === 1) content = "ok";
    else if (/BRANDS:/.test(text)) content = "Good picks for cold brew beans include Northside Coffee, Ember Roasters and Bean Lab. Ember Roasters sells a coarse ground blend made for steeping.\\nBRANDS: Northside Coffee, Ember Roasters, Bean Lab";
    else if (/Task: outline/.test(text)) content = "## What is cold brew coffee?\\n## What ratio of coffee to water should I use?\\n## How long should cold brew steep?";
    else content = "## What is cold brew coffee?\\n\\nCold brew is coffee steeped in cold water for 16 hours. We leverage a coarse grind and a 1:8 ratio for a smooth cup.\\n\\n## How long should cold brew steep?\\n\\nSteep it for 16 to 20 hours, then filter.\\n\\n- Use a coarse grind\\n- Filter twice";
    return json({ id: "c1", object: "chat.completion", model: body.model, choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content } }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } });
  }
  return json({ error: "Not found", code: "not_found" }, 404);
} };`;
  return {
    bindings: { EVERY_APP_GATEWAY: { type: "worker", worker: "fake-gateway" } },
    workers: [{ config: { name: "fake-gateway", compatibilityDate: "2026-06-01", manifest: { mainModule: "gateway.mjs", modules: { "gateway.mjs": { type: "esm", contents: source } } } } }],
  };
}
