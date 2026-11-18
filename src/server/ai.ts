// Model calls through the Gateway's AI provider. Each call either answers or
// says why it can't; a Gateway that has no provider set is a state, not a crash.
import { env } from "cloudflare:workers";
import { aiBaseUrl, createGatewayFetch, gatewayRefusal } from "@every-app/sdk/server";
import { getSettings, recordAiState } from "./settings";

export const AI_PROVIDER = "openrouter";

type CallFor = Parameters<typeof createGatewayFetch>[0]["for"];

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export type ChatResult = { ok: true; text: string } | { ok: false; off: boolean; message: string };

const OFF_MESSAGE = "AI isn't set up on this workspace's Gateway. An admin adds an OpenRouter key with `pnpm everyapp provider add openrouter`.";

export async function chat(
  orgId: string,
  { model, messages, maxTokens = 1800 }: { model: string; messages: ChatMessage[]; maxTokens?: number },
  callFor?: CallFor,
): Promise<ChatResult> {
  let response: Response;
  try {
    const gatewayFetch = createGatewayFetch({ env, ...(callFor ? { for: callFor } : {}) });
    response = await gatewayFetch(`${aiBaseUrl(AI_PROVIDER)}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature: maxTokens === 1 ? 0 : 0.7 }),
    });
  } catch (error) {
    await recordAiState(orgId, "off", OFF_MESSAGE);
    console.warn("[ai] no gateway", error);
    return { ok: false, off: true, message: OFF_MESSAGE };
  }
  const refusal = await gatewayRefusal(response.clone());
  if (refusal) {
    const off = /not_configured|not_requested|provider/.test(refusal.code);
    const message = off ? (refusal.setup ?? OFF_MESSAGE) : refusal.message;
    if (off) await recordAiState(orgId, "off", message);
    return { ok: false, off, message };
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    return { ok: false, off: false, message: `The model answered ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ""}` };
  }
  const body = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  await recordAiState(orgId, "ready", null);
  return { ok: true, text: body.choices?.[0]?.message?.content?.trim() ?? "" };
}

const RECHECK_MS = 10 * 60 * 1000;

/** Whether AI calls go through, checked with a one-token call at most every ten minutes. */
export async function aiAvailability(orgId: string, force = false): Promise<{ ready: boolean; message: string | null }> {
  const settings = await getSettings(orgId);
  const fresh = settings.aiCheckedAt && Date.now() - Date.parse(settings.aiCheckedAt) < RECHECK_MS;
  if (!force && fresh && settings.aiState !== "unknown") {
    return { ready: settings.aiState === "ready", message: settings.aiMessage };
  }
  const result = await chat(orgId, { model: settings.draftModel, messages: [{ role: "user", content: "Reply with ok." }], maxTokens: 1 });
  if (result.ok) return { ready: true, message: null };
  return { ready: !result.off, message: result.off ? result.message : null };
}
