import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { documents, sites, voiceProfiles } from "@/db/schema";
import { notFound } from "./errors";

export const FORMALITIES = ["casual", "conversational", "neutral", "professional", "formal"] as const;

const text = (max: number) => z.string().trim().max(max);

export const voiceInput = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(80),
    tone: text(200),
    formality: z.enum(FORMALITIES),
    audience: text(300),
    context: text(2000),
    samples: text(8000),
    preferredWords: text(1000),
    bannedWords: text(1000),
    isDefault: z.boolean(),
  })
  .strict();
export const updateVoiceInput = voiceInput.extend({ id: z.string().uuid() }).strict();
export const idInput = z.object({ id: z.string().uuid() }).strict();

export type VoiceProfile = typeof voiceProfiles.$inferSelect;

export function wordList(value: string): string[] {
  return value
    .split(/[,\n]/)
    .map((w) => w.trim())
    .filter(Boolean);
}

export function listVoices(ownerId: string): Promise<VoiceProfile[]> {
  return db.select().from(voiceProfiles).where(eq(voiceProfiles.ownerId, ownerId)).orderBy(asc(voiceProfiles.createdAt), asc(voiceProfiles.name));
}

export async function getVoice(ownerId: string, id: string): Promise<VoiceProfile | null> {
  return (await db.query.voiceProfiles.findFirst({ where: and(eq(voiceProfiles.id, id), eq(voiceProfiles.ownerId, ownerId)) })) ?? null;
}

export async function defaultVoice(ownerId: string): Promise<VoiceProfile | null> {
  return (await db.query.voiceProfiles.findFirst({ where: and(eq(voiceProfiles.ownerId, ownerId), eq(voiceProfiles.isDefault, true)) })) ?? null;
}

/** A voice id the member may assign: theirs, or nothing. */
export async function ownVoiceId(ownerId: string, id: string | null | undefined): Promise<string | null> {
  if (!id) return null;
  return (await getVoice(ownerId, id)) ? id : notFound("Voice profile");
}

export async function createVoice(ownerId: string, input: z.infer<typeof voiceInput>) {
  const id = crypto.randomUUID();
  const existing = await listVoices(ownerId);
  const isDefault = input.isDefault || existing.length === 0;
  const insert = db.insert(voiceProfiles).values({ ...input, id, ownerId, isDefault });
  if (isDefault) {
    await db.batch([db.update(voiceProfiles).set({ isDefault: false }).where(eq(voiceProfiles.ownerId, ownerId)), insert]);
  } else {
    await insert;
  }
  return { id };
}

export async function updateVoice(ownerId: string, { id, ...input }: z.infer<typeof updateVoiceInput>) {
  if (!(await getVoice(ownerId, id))) notFound("Voice profile");
  const update = db.update(voiceProfiles).set(input).where(and(eq(voiceProfiles.id, id), eq(voiceProfiles.ownerId, ownerId)));
  if (input.isDefault) {
    await db.batch([db.update(voiceProfiles).set({ isDefault: false }).where(eq(voiceProfiles.ownerId, ownerId)), update]);
  } else {
    await update;
  }
  return { id };
}

export async function makeDefault(ownerId: string, id: string) {
  if (!(await getVoice(ownerId, id))) notFound("Voice profile");
  await db.batch([
    db.update(voiceProfiles).set({ isDefault: false }).where(eq(voiceProfiles.ownerId, ownerId)),
    db.update(voiceProfiles).set({ isDefault: true }).where(and(eq(voiceProfiles.id, id), eq(voiceProfiles.ownerId, ownerId))),
  ]);
  return { id };
}

export async function deleteVoice(ownerId: string, id: string) {
  if (!(await getVoice(ownerId, id))) notFound("Voice profile");
  await db.batch([
    db.update(sites).set({ voiceProfileId: null }).where(and(eq(sites.ownerId, ownerId), eq(sites.voiceProfileId, id))),
    db.update(documents).set({ voiceProfileId: null }).where(and(eq(documents.ownerId, ownerId), eq(documents.voiceProfileId, id))),
    db.delete(voiceProfiles).where(and(eq(voiceProfiles.id, id), eq(voiceProfiles.ownerId, ownerId))),
  ]);
  return { id };
}
