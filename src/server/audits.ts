import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { auditIssues, audits, sites } from "@/db/schema";
import { blockedAiCrawlers, healthOf, ISSUE_TYPES, locsIn, SLOW_MS, sitemapsIn, THIN_WORDS, type IssueType } from "@/shared/audit";
import { extractPage } from "@/shared/html";
import { notFound, UserError } from "./errors";
import { fetchPage } from "./fetchPage";
import { enqueue } from "./jobs";
import { getSettings } from "./settings";
import { getSite } from "./sites";

export const siteIdInput = z.object({ siteId: z.string().uuid() }).strict();
export const idInput = z.object({ id: z.string().uuid() }).strict();

export async function listAudits(ownerId: string, siteId: string) {
  await getSite(ownerId, siteId);
  return db
    .select({ id: audits.id, status: audits.status, pagesChecked: audits.pagesChecked, healthScore: audits.healthScore, error: audits.error, createdAt: audits.createdAt, finishedAt: audits.finishedAt })
    .from(audits)
    .where(eq(audits.siteId, siteId))
    .orderBy(desc(audits.createdAt), desc(audits.id));
}

export async function startAudit(ownerId: string, siteId: string) {
  await getSite(ownerId, siteId);
  const active = await db.query.audits.findFirst({ where: and(eq(audits.siteId, siteId), inArray(audits.status, ["queued", "running"])) });
  if (active) throw new UserError("An audit of this site is already running");
  const id = crypto.randomUUID();
  await db.insert(audits).values({ id, siteId, ownerId, status: "queued", createdAt: new Date().toISOString() });
  await enqueue({ kind: "audit", auditId: id });
  return { id };
}

export async function getAudit(ownerId: string, id: string) {
  const audit = await db.query.audits.findFirst({ where: and(eq(audits.id, id), eq(audits.ownerId, ownerId)) });
  if (!audit) notFound("Audit");
  const site = await getSite(ownerId, audit.siteId);
  const issues = await db.select().from(auditIssues).where(eq(auditIssues.auditId, id)).orderBy(asc(auditIssues.url));
  const typed = issues.map((i) => ({ ...i, type: i.type as IssueType }));
  const { impact } = healthOf(audit.pagesChecked, typed);
  const groups = (Object.keys(ISSUE_TYPES) as IssueType[])
    .map((type) => ({
      type,
      ...ISSUE_TYPES[type],
      impact: impact[type] ?? 0,
      pages: typed.filter((i) => i.type === type).map((i) => ({ url: i.url, detail: i.detail })),
    }))
    .filter((g) => g.pages.length)
    .sort((a, b) => b.impact - a.impact);
  return { audit, site: { id: site.id, name: site.name, origin: site.origin }, groups };
}

// The crawl, run by the queue consumer.

type Found = { type: IssueType; url: string; detail?: string };

async function text(url: string): Promise<{ status: number; body: string } | null> {
  try {
    const page = await fetchPage(url, 8000);
    return { status: page.status, body: page.html };
  } catch {
    return null;
  }
}

export async function runAudit(auditId: string): Promise<void> {
  const audit = await db.query.audits.findFirst({ where: eq(audits.id, auditId) });
  if (!audit || audit.status !== "queued") return;
  const site = await db.query.sites.findFirst({ where: eq(sites.id, audit.siteId) });
  if (!site) return;
  await db.update(audits).set({ status: "running" }).where(eq(audits.id, auditId));
  try {
    const { auditPageCap } = await getSettings(site.orgId);
    const origin = new URL(site.origin);
    const sameHost = (url: string) => {
      try {
        const u = new URL(url);
        return u.host === origin.host && (u.protocol === "http:" || u.protocol === "https:");
      } catch {
        return false;
      }
    };
    const clean = (url: string) => {
      const u = new URL(url);
      u.hash = "";
      return u.toString();
    };
    const issues: Found[] = [];

    const robots = await text(`${site.origin}/robots.txt`);
    const robotsBody = robots && robots.status < 400 ? robots.body : "";
    const blocked = blockedAiCrawlers(robotsBody);
    if (blocked.length) issues.push({ type: "ai_crawlers_blocked", url: `${site.origin}/robots.txt`, detail: blocked.join(", ") });
    const llms = await text(`${site.origin}/llms.txt`);
    if (!llms || llms.status >= 400 || !llms.body.trim() || /<html/i.test(llms.body)) issues.push({ type: "missing_llms_txt", url: `${site.origin}/llms.txt` });

    const sitemapUrls = new Set<string>();
    const sitemapQueue = sitemapsIn(robotsBody).filter(sameHost);
    if (!sitemapQueue.length) sitemapQueue.push(`${site.origin}/sitemap.xml`);
    for (let i = 0; i < sitemapQueue.length && i < 5; i++) {
      const sitemap = await text(sitemapQueue[i]!);
      if (!sitemap || sitemap.status >= 400) continue;
      for (const loc of locsIn(sitemap.body)) {
        if (!sameHost(loc)) continue;
        if (/\.xml($|\?)/i.test(loc)) sitemapQueue.push(loc);
        else if (sitemapUrls.size < auditPageCap) sitemapUrls.add(clean(loc));
      }
    }

    const home = clean(`${site.origin}/`);
    const queue = [home, ...[...sitemapUrls].filter((u) => u !== home)];
    const seen = new Set(queue);
    const linkedTo = new Set<string>([home]);
    const titles = new Map<string, string[]>();
    let checked = 0;
    while (queue.length && checked < auditPageCap) {
      const batch = queue.splice(0, Math.min(5, auditPageCap - checked));
      const results = await Promise.all(batch.map(async (url) => ({ url, page: await fetchPage(url, 10000).catch(() => null) })));
      for (const { url, page } of results) {
        checked += 1;
        if (!page || page.status >= 400) {
          issues.push({ type: "broken", url, detail: page ? `Status ${page.status}` : "No response" });
          continue;
        }
        if (page.ms > SLOW_MS) issues.push({ type: "slow_response", url, detail: `${page.ms} ms` });
        if (!/html/i.test(page.contentType)) continue;
        const facts = extractPage(page.html, page.url);
        if (!facts.title) issues.push({ type: "missing_title", url });
        else titles.set(facts.title, [...(titles.get(facts.title) ?? []), url]);
        if (!facts.metaDescription) issues.push({ type: "missing_meta_description", url });
        if (facts.h1Count === 0) issues.push({ type: "missing_h1", url });
        if (facts.h1Count > 1) issues.push({ type: "multiple_h1", url, detail: `${facts.h1Count} H1s` });
        if (facts.wordCount < THIN_WORDS) issues.push({ type: "thin_content", url, detail: `${facts.wordCount} words` });
        for (const link of facts.links) {
          if (!sameHost(link)) continue;
          const target = clean(link);
          if (target !== url) linkedTo.add(target);
          if (!seen.has(target) && seen.size < auditPageCap * 3) {
            seen.add(target);
            queue.push(target);
          }
        }
      }
    }
    for (const [title, urls] of titles) {
      if (urls.length > 1) for (const url of urls) issues.push({ type: "duplicate_title", url, detail: title });
    }
    for (const url of sitemapUrls) {
      if (!linkedTo.has(url)) issues.push({ type: "orphan_page", url, detail: "In the sitemap, linked from no checked page" });
    }
    const { score } = healthOf(checked, issues);
    await db.batch([
      db.delete(auditIssues).where(eq(auditIssues.auditId, auditId)),
      ...chunks(issues, 19).map((part) => db.insert(auditIssues).values(part.map((issue) => ({ id: crypto.randomUUID(), auditId, type: issue.type, url: issue.url, detail: issue.detail ?? "" })))),
      db.update(audits).set({ status: "done", pagesChecked: checked, healthScore: score, finishedAt: new Date().toISOString() }).where(eq(audits.id, auditId)),
    ]);
  } catch (error) {
    console.error("[audit] failed", error);
    await db.update(audits).set({ status: "failed", error: "The crawl stopped before it finished", finishedAt: new Date().toISOString() }).where(eq(audits.id, auditId));
  }
}

/** D1 binds at most 100 values per statement: rows go in groups. */
function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
