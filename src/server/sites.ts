import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { auditIssues, audits, briefs, sites, visibilityChecks, visibilityPrompts } from "@/db/schema";
import { countryCodes, languageCodes } from "@/shared/locales";
import { notFound, UserError } from "./errors";
import { normalizeOrigin } from "./fetchPage";
import { ownVoiceId } from "./voices";

export const siteInput = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(80),
    domain: z.string().trim().min(1, "Domain is required").max(200),
    brandName: z.string().trim().min(1, "Brand name is required").max(80),
    language: z.enum(languageCodes),
    country: z.enum(countryCodes),
    voiceProfileId: z.string().uuid().nullable(),
  })
  .strict();
export const updateSiteInput = siteInput.extend({ id: z.string().uuid() }).strict();

export type Site = typeof sites.$inferSelect;

function origin(domain: string): string {
  try {
    return normalizeOrigin(domain);
  } catch {
    throw new UserError("Enter a domain such as example.com");
  }
}

export function listSites(ownerId: string): Promise<Site[]> {
  return db.select().from(sites).where(eq(sites.ownerId, ownerId)).orderBy(asc(sites.name));
}

export async function getSite(ownerId: string, id: string): Promise<Site> {
  const site = await db.query.sites.findFirst({ where: and(eq(sites.id, id), eq(sites.ownerId, ownerId)) });
  return site ?? notFound("Site");
}

export async function createSite(ownerId: string, orgId: string, input: z.infer<typeof siteInput>) {
  const id = crypto.randomUUID();
  const voiceProfileId = await ownVoiceId(ownerId, input.voiceProfileId);
  await db.insert(sites).values({ id, ownerId, orgId, name: input.name, origin: origin(input.domain), brandName: input.brandName, language: input.language, country: input.country, voiceProfileId });
  return { id };
}

export async function updateSite(ownerId: string, { id, ...input }: z.infer<typeof updateSiteInput>) {
  await getSite(ownerId, id);
  const voiceProfileId = await ownVoiceId(ownerId, input.voiceProfileId);
  await db
    .update(sites)
    .set({ name: input.name, origin: origin(input.domain), brandName: input.brandName, language: input.language, country: input.country, voiceProfileId })
    .where(and(eq(sites.id, id), eq(sites.ownerId, ownerId)));
  return { id };
}

/** The site, its audits and its prompts, in one batch. Briefs keep their research. */
export async function deleteSite(ownerId: string, id: string) {
  await getSite(ownerId, id);
  const auditIds = (await db.select({ id: audits.id }).from(audits).where(eq(audits.siteId, id))).map((a) => a.id);
  await db.batch([
    db.delete(audits).where(eq(audits.siteId, id)),
    ...(auditIds.length ? [db.delete(auditIssues).where(inArray(auditIssues.auditId, auditIds))] : []),
    db.delete(visibilityChecks).where(eq(visibilityChecks.siteId, id)),
    db.delete(visibilityPrompts).where(eq(visibilityPrompts.siteId, id)),
    db.update(briefs).set({ siteId: null }).where(and(eq(briefs.siteId, id), eq(briefs.ownerId, ownerId))),
    db.delete(sites).where(and(eq(sites.id, id), eq(sites.ownerId, ownerId))),
  ]);
  return { id };
}
