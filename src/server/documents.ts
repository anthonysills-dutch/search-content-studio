import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { briefs, documents } from "@/db/schema";
import { extractPage, htmlToMarkdown } from "@/shared/html";
import { scoreDocument } from "@/shared/scoring";
import { getBrief, outlineMarkdown, scoringBriefOf } from "./briefs";
import { notFound, UserError } from "./errors";
import { fetchPage } from "./fetchPage";
import { getSite } from "./sites";
import { defaultVoice, getVoice, ownVoiceId } from "./voices";

export const createDocumentInput = z.discriminatedUnion("from", [
  z.object({ from: z.literal("blank"), title: z.string().trim().min(1, "Title is required").max(200) }).strict(),
  z.object({ from: z.literal("brief"), briefId: z.string().uuid() }).strict(),
  z.object({ from: z.literal("url"), url: z.string().trim().url("Enter a full URL") }).strict(),
]);
export const saveDocumentInput = z
  .object({
    id: z.string().uuid(),
    title: z.string().trim().min(1, "Title is required").max(200),
    body: z.string().max(200_000),
  })
  .strict();
export const setVoiceInput = z.object({ id: z.string().uuid(), voiceProfileId: z.string().uuid().nullable() }).strict();
export const idInput = z.object({ id: z.string().uuid() }).strict();

export function listDocuments(ownerId: string) {
  return db
    .select({ id: documents.id, title: documents.title, seoScore: documents.seoScore, geoScore: documents.geoScore, updatedAt: documents.updatedAt, briefQuery: briefs.query })
    .from(documents)
    .leftJoin(briefs, and(eq(briefs.id, documents.briefId), eq(briefs.ownerId, ownerId)))
    .where(eq(documents.ownerId, ownerId))
    .orderBy(desc(documents.updatedAt));
}

async function ownDocument(ownerId: string, id: string) {
  const doc = await db.query.documents.findFirst({ where: and(eq(documents.id, id), eq(documents.ownerId, ownerId)) });
  return doc ?? notFound("Document");
}

/** The document, the brief it is scored against, and the voice AI drafting uses. */
export async function getDocument(ownerId: string, id: string) {
  const doc = await ownDocument(ownerId, id);
  const brief = doc.briefId ? await getBrief(ownerId, doc.briefId).catch(() => null) : null;
  const site = brief?.siteId ? await getSite(ownerId, brief.siteId).catch(() => null) : null;
  const voice =
    (doc.voiceProfileId ? await getVoice(ownerId, doc.voiceProfileId) : null) ??
    (site?.voiceProfileId ? await getVoice(ownerId, site.voiceProfileId) : null) ??
    (await defaultVoice(ownerId));
  return {
    doc,
    brief: brief ? { id: brief.id, query: brief.query, questions: brief.outline.questions, terms: scoringBriefOf(brief).terms.map((t) => t.term) } : null,
    scoring: brief ? scoringBriefOf(brief) : null,
    voice: voice ? { id: voice.id, name: voice.name, bannedWords: voice.bannedWords, assigned: doc.voiceProfileId === voice.id, from: doc.voiceProfileId === voice.id ? "document" : site?.voiceProfileId === voice.id ? "site" : "default" } : null,
  };
}

async function scoresFor(ownerId: string, briefId: string | null, body: string) {
  const brief = briefId ? await getBrief(ownerId, briefId).catch(() => null) : null;
  const { seo, geo } = scoreDocument(body, brief ? scoringBriefOf(brief) : null);
  return { seoScore: seo, geoScore: geo };
}

export async function createDocument(ownerId: string, input: z.infer<typeof createDocumentInput>) {
  const id = crypto.randomUUID();
  let values: { title: string; body: string; briefId: string | null };
  if (input.from === "blank") {
    values = { title: input.title, body: "", briefId: null };
  } else if (input.from === "brief") {
    const brief = await getBrief(ownerId, input.briefId);
    values = { title: brief.query, body: outlineMarkdown(brief), briefId: brief.id };
  } else {
    let page;
    try {
      page = await fetchPage(input.url);
    } catch {
      throw new UserError("That page couldn't be fetched");
    }
    if (page.status >= 400) throw new UserError(`That page answered ${page.status}`);
    const facts = extractPage(page.html, page.url);
    values = { title: facts.title || input.url, body: htmlToMarkdown(page.html), briefId: null };
  }
  await db.insert(documents).values({ id, ownerId, ...values, ...(await scoresFor(ownerId, values.briefId, values.body)) });
  return { id };
}

export async function saveDocument(ownerId: string, input: z.infer<typeof saveDocumentInput>) {
  const doc = await ownDocument(ownerId, input.id);
  const scores = await scoresFor(ownerId, doc.briefId, input.body);
  await db
    .update(documents)
    .set({ title: input.title, body: input.body, ...scores, updatedAt: new Date().toISOString() })
    .where(and(eq(documents.id, input.id), eq(documents.ownerId, ownerId)));
  return { id: input.id, ...scores };
}

export async function setDocumentVoice(ownerId: string, input: z.infer<typeof setVoiceInput>) {
  await ownDocument(ownerId, input.id);
  const voiceProfileId = await ownVoiceId(ownerId, input.voiceProfileId);
  await db.update(documents).set({ voiceProfileId }).where(and(eq(documents.id, input.id), eq(documents.ownerId, ownerId)));
  return { id: input.id };
}

export async function deleteDocument(ownerId: string, id: string) {
  await ownDocument(ownerId, id);
  await db.delete(documents).where(and(eq(documents.id, id), eq(documents.ownerId, ownerId)));
  return { id };
}
