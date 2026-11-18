// What an audit checks, how much each issue costs the health score, and the
// robots rules it reads.

export type Severity = "high" | "medium" | "low";

export const ISSUE_TYPES = {
  broken: { label: "Broken page", severity: "high", fix: "Fix the page or remove the links to it." },
  ai_crawlers_blocked: { label: "AI crawlers blocked", severity: "high", fix: "Allow the AI crawlers you want to read the site in robots.txt." },
  missing_title: { label: "Missing title", severity: "high", fix: "Give each page a unique title." },
  missing_h1: { label: "Missing H1", severity: "medium", fix: "Give the page one main heading." },
  duplicate_title: { label: "Duplicate title", severity: "medium", fix: "Make each page's title unique." },
  missing_meta_description: { label: "Missing meta description", severity: "medium", fix: "Write a one-sentence summary for search results." },
  thin_content: { label: "Thin content", severity: "medium", fix: "Expand the page past 300 words or merge it into another." },
  missing_llms_txt: { label: "No llms.txt", severity: "low", fix: "Publish /llms.txt listing the pages AI assistants should read." },
  multiple_h1: { label: "Multiple H1s", severity: "low", fix: "Keep one H1 and make the others H2s." },
  slow_response: { label: "Slow response", severity: "low", fix: "Speed up the page: it took over 1.5 seconds to respond." },
  orphan_page: { label: "Orphan page", severity: "low", fix: "Link to the page from at least one other page." },
} as const satisfies Record<string, { label: string; severity: Severity; fix: string }>;

export type IssueType = keyof typeof ISSUE_TYPES;

/** Points one affected page loses. */
const PAGE_COST: Record<Severity, number> = { high: 30, medium: 12, low: 5 };
/** Points a site-wide issue costs the whole score. */
const SITE_COST: Record<Severity, number> = { high: 15, medium: 8, low: 4 };
export const SITE_WIDE: IssueType[] = ["ai_crawlers_blocked", "missing_llms_txt"];

export const THIN_WORDS = 300;
export const SLOW_MS = 1500;

/**
 * Health out of 100: each page starts at 100 and loses points per issue,
 * the average is taken, and site-wide issues come off the top. The impact
 * of a type is what fixing it everywhere would give back.
 */
export function healthOf(pages: number, issues: { type: IssueType; url: string }[]) {
  const perPage = new Map<string, number>();
  const impact = new Map<IssueType, number>();
  let siteCost = 0;
  for (const issue of issues) {
    const severity = ISSUE_TYPES[issue.type].severity;
    if (SITE_WIDE.includes(issue.type)) {
      siteCost += SITE_COST[severity];
      impact.set(issue.type, (impact.get(issue.type) ?? 0) + SITE_COST[severity]);
    } else {
      perPage.set(issue.url, (perPage.get(issue.url) ?? 0) + PAGE_COST[severity]);
      impact.set(issue.type, (impact.get(issue.type) ?? 0) + PAGE_COST[severity] / Math.max(1, pages));
    }
  }
  let total = 0;
  for (const cost of perPage.values()) total += Math.min(100, cost);
  const average = pages ? 100 - total / pages : 100;
  const score = Math.max(0, Math.min(100, Math.round(average - siteCost)));
  return { score, impact: Object.fromEntries([...impact].map(([type, value]) => [type, Math.max(1, Math.round(value))])) as Partial<Record<IssueType, number>> };
}

export const AI_CRAWLERS = ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "PerplexityBot", "Google-Extended", "CCBot"];

/** The AI crawlers robots.txt keeps off the whole site. */
export function blockedAiCrawlers(robots: string): string[] {
  const groups: { agents: string[]; disallowAll: boolean; allowAll: boolean }[] = [];
  let current: (typeof groups)[number] | null = null;
  let lastWasAgent = false;
  for (const raw of robots.split("\n")) {
    const line = raw.replace(/#.*/, "").trim();
    const match = /^([a-z-]+)\s*:\s*(.*)$/i.exec(line);
    if (!match) continue;
    const field = match[1]!.toLowerCase();
    const value = match[2]!.trim();
    if (field === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], disallowAll: false, allowAll: false };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current) continue;
    if (field === "disallow" && value === "/") current.disallowAll = true;
    if (field === "allow" && value === "/") current.allowAll = true;
  }
  const rule = (agent: string) =>
    groups.find((g) => g.agents.includes(agent.toLowerCase())) ?? groups.find((g) => g.agents.includes("*"));
  return AI_CRAWLERS.filter((agent) => {
    const group = rule(agent);
    return Boolean(group?.disallowAll && !group.allowAll);
  });
}

export function sitemapsIn(robots: string): string[] {
  return [...robots.matchAll(/^\s*sitemap\s*:\s*(\S+)/gim)].map((m) => m[1]!);
}

export function locsIn(sitemap: string): string[] {
  return [...sitemap.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1]!.replace(/&amp;/g, "&"));
}
