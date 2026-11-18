import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { briefSources, briefs, documents } from "@/db/schema";
import { extractPage, type Heading } from "@/shared/html";
import { countryCodes, languageCodes } from "@/shared/locales";
import type { ScoringBrief } from "@/shared/scoring";
import { aggregateTerms, topTerms, type BriefTerm, type TermCount } from "@/shared/terms";
import { notFound, UserError } from "./errors";
import { fetchPage } from "./fetchPage";
import { searchDataReady, topResults } from "./search";
import { getSite } from "./sites";

export const createBriefInput = z
  .object({
    query: z.string().trim().min(2, "Enter a search query").max(200),
    language: z.enum(languageCodes),
    country: z.enum(countryCodes),
    siteId: z.string().uuid().nullable(),
    urls: z.array(z.string().trim().url("Each line must be a full URL")).max(10, "Paste at most 10 URLs"),
  })
  .strict();

const outlineSchema = z
  .object({
    sections: z.array(z.object({ id: z.string().max(40), heading: z.string().trim().max(200), notes: z.string().max(2000) }).strict()).max(40),
    questions: z.array(z.string().trim().max(300)).max(40),
    terms: z.array(z.string().trim().max(80)).max(80),
    sources: z.array(z.string().max(2000)).max(10),
  })
  .strict();
export type Outline = z.infer<typeof outlineSchema>;
export const updateOutlineInput = z.object({ id: z.string().uuid(), outline: outlineSchema }).strict();
export const idInput = z.object({ id: z.string().uuid() }).strict();

const EMPTY_OUTLINE: Outline = { sections: [], questions: [], terms: [], sources: [] };

export interface BriefSource {
  url: string;
  title: string;
  wordCount: number;
  headings: Heading[];
  terms: TermCount[];
  error: string | null;
}

export interface BriefView {
  id: string;
  query: string;
  language: string;
  country: string;
  siteId: string | null;
  siteName: string | null;
  sourceMode: string;
  createdAt: string;
  sources: BriefSource[];
  averageWords: number | null;
  questions: string[];
  terms: BriefTerm[];
  outline: Outline;
}

export async function listBriefs(ownerId: string) {
  return db
    .select({ id: briefs.id, query: briefs.query, language: briefs.language, country: briefs.country, createdAt: briefs.createdAt })
    .from(briefs)
    .where(eq(briefs.ownerId, ownerId))
    .orderBy(desc(briefs.createdAt), asc(briefs.query));
}

async function readSource(url: string): Promise<Omit<BriefSource, "url">> {
  try {
    const page = await fetchPage(url);
    if (page.status >= 400) return { title: "", wordCount: 0, headings: [], terms: [], error: `The page answered ${page.status}` };
    const facts = extractPage(page.html, page.url);
    return { title: facts.title, wordCount: facts.wordCount, headings: facts.headings.filter((h) => h.level <= 3).slice(0, 60), terms: topTerms(facts.text), error: null };
  } catch {
    return { title: "", wordCount: 0, headings: [], terms: [], error: "The page couldn't be fetched" };
  }
}

export async function createBrief(ownerId: string, input: z.infer<typeof createBriefInput>) {
  if (input.siteId) await getSite(ownerId, input.siteId);
  let urls = [...new Set(input.urls)];
  let questions: string[] = [];
  let sourceMode = "pasted";
  if (!urls.length) {
    if (!(await searchDataReady())) throw new UserError("Paste at least one result URL");
    const found = await topResults(input.query, input.language, input.country);
    urls = found.urls;
    questions = found.questions;
    sourceMode = "search";
  }
  const read = await Promise.all(urls.map(async (url) => ({ url, ...(await readSource(url)) })));
  for (const source of read) {
    for (const heading of source.headings) {
      if (heading.text.endsWith("?")) questions.push(heading.text);
    }
  }
  questions = [...new Map(questions.map((q) => [q.toLowerCase(), q])).values()].slice(0, 30);
  const id = crypto.randomUUID();
  await db.batch([
    db.insert(briefs).values({ id, ownerId, siteId: input.siteId, query: input.query, language: input.language, country: input.country, sourceMode, questions: JSON.stringify(questions), outline: JSON.stringify(EMPTY_OUTLINE) }),
    ...read.map((source, position) =>
      db.insert(briefSources).values({ id: crypto.randomUUID(), briefId: id, position, url: source.url, title: source.title, wordCount: source.wordCount, headings: JSON.stringify(source.headings), terms: JSON.stringify(source.terms), error: source.error }),
    ),
  ]);
  return { id };
}

export async function getBrief(ownerId: string, id: string): Promise<BriefView> {
  const brief = await db.query.briefs.findFirst({ where: and(eq(briefs.id, id), eq(briefs.ownerId, ownerId)) });
  if (!brief) notFound("Brief");
  const rows = await db.select().from(briefSources).where(eq(briefSources.briefId, id)).orderBy(asc(briefSources.position));
  const sources: BriefSource[] = rows.map((r) => ({ url: r.url, title: r.title, wordCount: r.wordCount, headings: JSON.parse(r.headings), terms: JSON.parse(r.terms), error: r.error }));
  const read = sources.filter((s) => !s.error);
  const site = brief.siteId ? await getSite(ownerId, brief.siteId).catch(() => null) : null;
  return {
    id: brief.id,
    query: brief.query,
    language: brief.language,
    country: brief.country,
    siteId: site?.id ?? null,
    siteName: site?.name ?? null,
    sourceMode: brief.sourceMode,
    createdAt: brief.createdAt,
    sources,
    averageWords: read.length ? Math.round(read.reduce((sum, s) => sum + s.wordCount, 0) / read.length) : null,
    questions: JSON.parse(brief.questions),
    terms: aggregateTerms(read.map((s) => s.terms)),
    outline: { ...EMPTY_OUTLINE, ...JSON.parse(brief.outline) },
  };
}

export async function updateOutline(ownerId: string, { id, outline }: z.infer<typeof updateOutlineInput>) {
  await getBrief(ownerId, id);
  await db.update(briefs).set({ outline: JSON.stringify(outline), updatedAt: new Date().toISOString() }).where(and(eq(briefs.id, id), eq(briefs.ownerId, ownerId)));
  return { id };
}

/** The brief and its sources; documents written from it keep their text. */
export async function deleteBrief(ownerId: string, id: string) {
  await getBrief(ownerId, id);
  await db.batch([
    db.update(documents).set({ briefId: null }).where(and(eq(documents.briefId, id), eq(documents.ownerId, ownerId))),
    db.delete(briefSources).where(eq(briefSources.briefId, id)),
    db.delete(briefs).where(and(eq(briefs.id, id), eq(briefs.ownerId, ownerId))),
  ]);
  return { id };
}

/** What the editor scores a document against. */
export function scoringBriefOf(brief: BriefView): ScoringBrief {
  const multi = brief.sources.filter((s) => !s.error).length > 1;
  const chosen = brief.outline.terms.length
    ? brief.terms.filter((t) => brief.outline.terms.includes(t.term)).concat(
        brief.outline.terms.filter((term) => !brief.terms.some((t) => t.term === term)).map((term) => ({ term, sources: 0, average: 1, gap: false })),
      )
    : brief.terms.filter((t) => !t.gap && (!multi || t.sources > 1)).slice(0, 20);
  return {
    terms: chosen.map((t) => ({ term: t.term, target: Math.min(t.average, 8) })),
    headings: brief.outline.sections.map((s) => s.heading).filter(Boolean),
    questions: brief.outline.questions,
    targetWords: brief.averageWords,
  };
}

export function outlineMarkdown(brief: BriefView): string {
  const lines = [`# ${brief.query.charAt(0).toUpperCase()}${brief.query.slice(1)}`, ""];
  for (const section of brief.outline.sections) {
    if (!section.heading) continue;
    lines.push(`## ${section.heading}`, "");
    if (section.notes.trim()) lines.push(section.notes.trim(), "");
  }
  for (const question of brief.outline.questions) {
    if (brief.outline.sections.some((s) => s.heading === question)) continue;
    lines.push(`## ${question}`, "");
  }
  return lines.join("\n");
}
