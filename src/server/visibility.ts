import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { sites, visibilityChecks, visibilityPrompts } from "@/db/schema";
import { chat } from "./ai";
import { UserError } from "./errors";
import { enqueue } from "./jobs";
import { getSettings } from "./settings";
import { getSite } from "./sites";

export const addPromptInput = z.object({ siteId: z.string().uuid(), text: z.string().trim().min(3, "Enter a question").max(300) }).strict();
export const idInput = z.object({ id: z.string().uuid() }).strict();
export const siteIdInput = z.object({ siteId: z.string().uuid() }).strict();

export async function addPrompt(ownerId: string, input: z.infer<typeof addPromptInput>) {
  await getSite(ownerId, input.siteId);
  const count = (await db.select({ id: visibilityPrompts.id }).from(visibilityPrompts).where(eq(visibilityPrompts.siteId, input.siteId))).length;
  if (count >= 50) throw new UserError("A site tracks at most 50 questions");
  const id = crypto.randomUUID();
  await db.insert(visibilityPrompts).values({ id, siteId: input.siteId, ownerId, text: input.text });
  return { id };
}

export async function deletePrompt(ownerId: string, id: string) {
  const prompt = await db.query.visibilityPrompts.findFirst({ where: and(eq(visibilityPrompts.id, id), eq(visibilityPrompts.ownerId, ownerId)) });
  if (!prompt) throw new UserError("Question not found");
  await db.batch([
    db.delete(visibilityChecks).where(eq(visibilityChecks.promptId, id)),
    db.delete(visibilityPrompts).where(and(eq(visibilityPrompts.id, id), eq(visibilityPrompts.ownerId, ownerId))),
  ]);
  return { id };
}

export async function requestRun(ownerId: string, siteId: string) {
  await getSite(ownerId, siteId);
  const prompts = await db.select({ id: visibilityPrompts.id }).from(visibilityPrompts).where(eq(visibilityPrompts.siteId, siteId));
  if (!prompts.length) throw new UserError("Add a question first");
  const runId = crypto.randomUUID();
  await enqueue({ kind: "visibility", siteId, runId });
  return { runId };
}

/** The daily run: every site with questions. */
export async function enqueueDaily() {
  const rows = await db.selectDistinct({ siteId: visibilityPrompts.siteId }).from(visibilityPrompts);
  for (const { siteId } of rows) await enqueue({ kind: "visibility", siteId, runId: crypto.randomUUID() });
}

const BRANDS_LINE = /^\s*BRANDS:\s*(.*)$/im;

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export function analyzeAnswer(answer: string, brandName: string, origin: string) {
  const brandsLine = BRANDS_LINE.exec(answer)?.[1] ?? "";
  const body = answer.replace(BRANDS_LINE, "").trim();
  const host = new URL(origin).host.replace(/^www\./, "");
  const brand = normalize(brandName);
  const mentioned = brand.length > 0 && ` ${normalize(body)} `.includes(` ${brand} `);
  const cited = body.toLowerCase().includes(host.toLowerCase());
  const named = brandsLine.split(",").map((b) => normalize(b)).filter(Boolean);
  const index = named.findIndex((b) => b === brand || b.includes(brand) || (brand.includes(b) && b.length > 3));
  const at = mentioned ? normalize(body).indexOf(brand) : -1;
  let excerpt = body.slice(0, 280);
  if (mentioned) {
    const raw = body.toLowerCase().indexOf(brandName.toLowerCase());
    const start = Math.max(0, (raw >= 0 ? raw : at) - 80);
    excerpt = `${start > 0 ? "…" : ""}${body.slice(start, start + 280)}`;
  }
  return { mentioned, cited, position: index >= 0 ? index + 1 : null, excerpt: excerpt.trim() };
}

export async function runVisibility(siteId: string, runId: string): Promise<void> {
  const site = await db.query.sites.findFirst({ where: eq(sites.id, siteId) });
  if (!site) return;
  const prompts = await db.select().from(visibilityPrompts).where(eq(visibilityPrompts.siteId, siteId));
  const { visibilityModels } = await getSettings(site.orgId);
  const day = new Date().toISOString().slice(0, 10);
  const callFor = { background: true as const, organizationId: site.orgId };
  const rows: (typeof visibilityChecks.$inferInsert)[] = [];
  for (const prompt of prompts) {
    await Promise.all(
      visibilityModels.map(async (model) => {
        const result = await chat(
          site.orgId,
          {
            model,
            maxTokens: 700,
            messages: [
              { role: "system", content: "Answer the question the way you would for any user. After the answer, add one final line starting with BRANDS: listing every brand, company or product you named, in the order you named them, separated by commas." },
              { role: "user", content: prompt.text },
            ],
          },
          callFor,
        );
        if (!result.ok) {
          rows.push({ id: crypto.randomUUID(), promptId: prompt.id, siteId, runId, day, model, mentioned: false, cited: false, position: null, excerpt: "", error: result.message });
          return;
        }
        rows.push({ id: crypto.randomUUID(), promptId: prompt.id, siteId, runId, day, model, ...analyzeAnswer(result.text, site.brandName, site.origin), error: null });
      }),
    );
  }
  for (let i = 0; i < rows.length; i += 8) await db.insert(visibilityChecks).values(rows.slice(i, i + 8));
}

/** The latest result per question and model, the score, and one point per day. */
export async function getVisibility(ownerId: string, siteId: string) {
  await getSite(ownerId, siteId);
  const prompts = await db.select().from(visibilityPrompts).where(eq(visibilityPrompts.siteId, siteId)).orderBy(asc(visibilityPrompts.createdAt), asc(visibilityPrompts.text));
  const checks = prompts.length
    ? await db.select().from(visibilityChecks).where(and(eq(visibilityChecks.siteId, siteId), inArray(visibilityChecks.promptId, prompts.map((p) => p.id)))).orderBy(desc(visibilityChecks.checkedAt))
    : [];
  const latestRun = new Map<string, string>();
  const latest = new Map<string, (typeof checks)[number]>();
  for (const check of checks) {
    const key = `${check.promptId}|${check.model}`;
    if (!latest.has(key)) latest.set(key, check);
    if (!latestRun.has(check.promptId)) latestRun.set(check.promptId, check.runId);
  }
  const results = prompts.map((prompt) => ({
    id: prompt.id,
    text: prompt.text,
    models: [...latest.values()].filter((c) => c.promptId === prompt.id && !c.error).sort((a, b) => a.model.localeCompare(b.model)),
    errors: [...latest.values()].filter((c) => c.promptId === prompt.id && c.error).map((c) => ({ model: c.model, error: c.error! })),
  }));
  const answered = results.filter((r) => r.models.length);
  const appears = (models: { mentioned: boolean; cited: boolean }[]) => models.some((m) => m.mentioned || m.cited);
  const score = answered.length ? Math.round((100 * answered.filter((r) => appears(r.models)).length) / answered.length) : null;
  const byDay = new Map<string, Map<string, boolean>>();
  for (const check of checks) {
    if (check.error) continue;
    const day = byDay.get(check.day) ?? new Map<string, boolean>();
    day.set(check.promptId, (day.get(check.promptId) ?? false) || check.mentioned || check.cited);
    byDay.set(check.day, day);
  }
  const trend = [...byDay]
    .map(([day, found]) => ({ day, score: Math.round((100 * [...found.values()].filter(Boolean).length) / found.size) }))
    .sort((a, b) => a.day.localeCompare(b.day))
    .slice(-30);
  return { results, score, trend, lastChecked: checks[0]?.checkedAt ?? null };
}
