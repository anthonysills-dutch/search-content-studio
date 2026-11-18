import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { workspaceSettings } from "@/db/schema";

export const DEFAULT_SETTINGS = {
  auditPageCap: 50,
  visibilityModels: ["openai/gpt-4o-mini", "anthropic/claude-3.5-haiku", "perplexity/sonar"],
  draftModel: "openai/gpt-4o-mini",
};

const modelId = z.string().trim().regex(/^[a-z0-9._-]+\/[a-z0-9._:-]+$/i, "Use model ids such as openai/gpt-4o-mini");

export const updateSettingsInput = z
  .object({
    auditPageCap: z.number().int().min(1, "At least 1 page").max(500, "At most 500 pages"),
    visibilityModels: z.array(modelId).min(1, "Name at least one model").max(6, "At most 6 models"),
    draftModel: modelId,
  })
  .strict();

export interface Settings {
  auditPageCap: number;
  visibilityModels: string[];
  draftModel: string;
  aiState: string;
  aiMessage: string | null;
  aiCheckedAt: string | null;
}

export async function getSettings(orgId: string): Promise<Settings> {
  const row = await db.query.workspaceSettings.findFirst({ where: eq(workspaceSettings.orgId, orgId) });
  if (!row) return { ...DEFAULT_SETTINGS, aiState: "unknown", aiMessage: null, aiCheckedAt: null };
  return { ...row, visibilityModels: JSON.parse(row.visibilityModels) as string[] };
}

async function ensureRow(orgId: string) {
  await db
    .insert(workspaceSettings)
    .values({ orgId, visibilityModels: JSON.stringify(DEFAULT_SETTINGS.visibilityModels), draftModel: DEFAULT_SETTINGS.draftModel })
    .onConflictDoNothing();
}

/** Admins only: the caller checks isAdmin first. */
export async function updateSettings(orgId: string, input: z.infer<typeof updateSettingsInput>) {
  await ensureRow(orgId);
  await db
    .update(workspaceSettings)
    .set({ auditPageCap: input.auditPageCap, visibilityModels: JSON.stringify(input.visibilityModels), draftModel: input.draftModel })
    .where(eq(workspaceSettings.orgId, orgId));
  return getSettings(orgId);
}

export async function recordAiState(orgId: string, state: "ready" | "off", message: string | null) {
  await ensureRow(orgId);
  await db
    .update(workspaceSettings)
    .set({ aiState: state, aiMessage: message, aiCheckedAt: new Date().toISOString() })
    .where(eq(workspaceSettings.orgId, orgId));
}
