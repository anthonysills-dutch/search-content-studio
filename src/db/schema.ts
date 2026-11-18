import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

const createdAt = () =>
  text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`);

/** A member, keyed by the Gateway's user id, made the first time they open the app. */
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  orgId: text("org_id").notNull(),
  createdAt: createdAt(),
});

export const voiceProfiles = sqliteTable(
  "voice_profiles",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    name: text("name").notNull(),
    tone: text("tone").notNull().default(""),
    formality: text("formality").notNull().default("neutral"),
    audience: text("audience").notNull().default(""),
    context: text("context").notNull().default(""),
    samples: text("samples").notNull().default(""),
    preferredWords: text("preferred_words").notNull().default(""),
    bannedWords: text("banned_words").notNull().default(""),
    isDefault: integer("is_default", { mode: "boolean" })
      .notNull()
      .default(false),
    createdAt: createdAt(),
  },
  (t) => [index("voice_profiles_owner").on(t.ownerId)],
);

export const sites = sqliteTable(
  "sites",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    orgId: text("org_id").notNull(),
    name: text("name").notNull(),
    /** The site's origin, such as https://example.com. */
    origin: text("origin").notNull(),
    brandName: text("brand_name").notNull(),
    language: text("language").notNull(),
    country: text("country").notNull(),
    voiceProfileId: text("voice_profile_id"),
    createdAt: createdAt(),
  },
  (t) => [index("sites_owner").on(t.ownerId)],
);

export const briefs = sqliteTable(
  "briefs",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    siteId: text("site_id"),
    query: text("query").notNull(),
    language: text("language").notNull(),
    country: text("country").notNull(),
    /** "search" when the results came from search data, "pasted" otherwise. */
    sourceMode: text("source_mode").notNull(),
    /** Questions people ask: JSON string[]. */
    questions: text("questions").notNull().default("[]"),
    /** The outline the member builds: JSON Outline. */
    outline: text("outline").notNull().default("{}"),
    createdAt: createdAt(),
    updatedAt: createdAt(),
  },
  (t) => [index("briefs_owner").on(t.ownerId)],
);

export const briefSources = sqliteTable(
  "brief_sources",
  {
    id: text("id").primaryKey(),
    briefId: text("brief_id").notNull(),
    position: integer("position").notNull(),
    url: text("url").notNull(),
    title: text("title").notNull().default(""),
    wordCount: integer("word_count").notNull().default(0),
    /** JSON { level, text }[] */
    headings: text("headings").notNull().default("[]"),
    /** JSON { term, count }[] */
    terms: text("terms").notNull().default("[]"),
    error: text("error"),
  },
  (t) => [index("brief_sources_brief").on(t.briefId)],
);

export const documents = sqliteTable(
  "documents",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    briefId: text("brief_id"),
    voiceProfileId: text("voice_profile_id"),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    seoScore: integer("seo_score").notNull().default(0),
    geoScore: integer("geo_score").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: createdAt(),
  },
  (t) => [index("documents_owner").on(t.ownerId)],
);

export const audits = sqliteTable(
  "audits",
  {
    id: text("id").primaryKey(),
    siteId: text("site_id").notNull(),
    ownerId: text("owner_id").notNull(),
    /** queued, running, done or failed */
    status: text("status").notNull().default("queued"),
    pagesChecked: integer("pages_checked").notNull().default(0),
    healthScore: integer("health_score"),
    error: text("error"),
    createdAt: createdAt(),
    finishedAt: text("finished_at"),
  },
  (t) => [index("audits_site").on(t.siteId)],
);

export const auditIssues = sqliteTable(
  "audit_issues",
  {
    id: text("id").primaryKey(),
    auditId: text("audit_id").notNull(),
    type: text("type").notNull(),
    /** The page, or the file for a site-wide issue. */
    url: text("url").notNull(),
    detail: text("detail").notNull().default(""),
  },
  (t) => [index("audit_issues_audit").on(t.auditId)],
);

export const visibilityPrompts = sqliteTable(
  "visibility_prompts",
  {
    id: text("id").primaryKey(),
    siteId: text("site_id").notNull(),
    ownerId: text("owner_id").notNull(),
    text: text("text").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("visibility_prompts_site").on(t.siteId)],
);

export const visibilityChecks = sqliteTable(
  "visibility_checks",
  {
    id: text("id").primaryKey(),
    promptId: text("prompt_id").notNull(),
    siteId: text("site_id").notNull(),
    runId: text("run_id").notNull(),
    day: text("day").notNull(),
    model: text("model").notNull(),
    mentioned: integer("mentioned", { mode: "boolean" }).notNull(),
    cited: integer("cited", { mode: "boolean" }).notNull(),
    position: integer("position"),
    excerpt: text("excerpt").notNull().default(""),
    error: text("error"),
    checkedAt: createdAt(),
  },
  (t) => [index("visibility_checks_site").on(t.siteId, t.day)],
);

/** One row per organization: what admins set for everyone. */
export const workspaceSettings = sqliteTable("workspace_settings", {
  orgId: text("org_id").primaryKey(),
  auditPageCap: integer("audit_page_cap").notNull().default(50),
  /** JSON string[] of model ids asked for AI visibility. */
  visibilityModels: text("visibility_models").notNull(),
  draftModel: text("draft_model").notNull(),
  /** Whether the last AI call went through: unknown, ready or off. */
  aiState: text("ai_state").notNull().default("unknown"),
  aiMessage: text("ai_message"),
  aiCheckedAt: text("ai_checked_at"),
});
