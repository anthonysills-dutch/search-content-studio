// Main path of every retained feature, first with nothing configured on the
// Gateway, then with search data and an AI provider configured.
import { readFile } from "node:fs/promises";
import { startRuntime, expect } from "/home/user/oss-new/control/runtime/index.mjs";
import { startFixtureSite } from "./fixture-site.mjs";
import { fakeGateway } from "./fake-gateway.mjs";
import { addSite, addVoice, createBrief, ARTICLE } from "./helpers.mjs";

const site = await startFixtureSite();
try {
  await unconfigured();
  await configured();
} finally {
  await site.close();
}

async function unconfigured() {
  const runtime = await startRuntime();
  try {
    const health = await runtime.fetch("/health", { role: "member" });
    expect(health.status).toBe(200);
    expect((await health.json()).ok).toBe(true);

    const page = await (await runtime.context("owner")).newPage();
    await page.goto("/");
    await runtime.assertBackLink(page);

    // F001 Sites
    const siteId = await addSite(page, { name: "Ember Roasters", domain: site.origin, brand: "Ember Roasters" });
    await page.getByRole("tab", { name: "Details" }).click();
    await page.getByTestId("site-brand").fill("Ember Roasters Coffee");
    await page.getByTestId("site-save").click();
    await expect(page.getByTestId("site-saved")).toBeVisible();
    await page.reload();
    await page.getByRole("tab", { name: "Details" }).click();
    await expect(page.getByTestId("site-brand")).toHaveValue("Ember Roasters Coffee");

    // F005 Voice profiles
    await addVoice(page, { name: "Friendly expert", banned: "leverage, synergy", preferred: "brew, steep" });
    await addVoice(page, { name: "Wholesale formal", banned: "awesome", isDefault: false });
    await expect(page.getByTestId("voice-row").filter({ hasText: "Friendly expert" })).toContainText("Default");
    await page.getByTestId("voice-row").filter({ hasText: "Wholesale formal" }).getByTestId("voice-make-default").click();
    await expect(page.getByTestId("voice-row").filter({ hasText: "Wholesale formal" })).toContainText("Default");
    await expect(page.getByTestId("voice-row").filter({ hasText: "Friendly expert" })).not.toContainText("Default");

    // F002 Research briefs, pasted URLs
    await page.goto("/briefs");
    await expect(page.getByTestId("search-data-off")).toBeVisible();
    const briefId = await createBrief(page, {
      query: "how to make cold brew",
      siteName: "Ember Roasters",
      urls: [`${site.origin}/guides/cold-brew`, `${site.origin}/guides/grind-size`, `${site.origin}/recipes/concentrate`],
    });
    await expect(page.getByTestId("source-row")).toHaveCount(3);
    await expect(page.getByTestId("source-row").first()).toContainText("How to make cold brew coffee at home");
    await expect(page.getByTestId("avg-words")).toHaveText(/\d+/);
    await expect(page.getByTestId("question-item").filter({ hasText: "What ratio of coffee to water should I use?" })).toBeVisible();
    await expect(page.getByTestId("term-row").filter({ hasText: "cold brew" }).first()).toBeVisible();
    await expect(page.getByTestId("gap-badge").first()).toBeVisible();
    // Build the outline
    await page.getByTestId("question-item").filter({ hasText: "What ratio of coffee to water should I use?" }).getByTestId("pin-question").click();
    await page.getByTestId("add-section").click();
    await page.getByTestId("section-heading").last().fill("How long should cold brew steep?");
    await page.getByTestId("add-section").click();
    await page.getByTestId("section-heading").last().fill("What is cold brew coffee?");
    await page.getByTestId("section-up").last().click();
    await page.getByTestId("save-outline").click();
    await expect(page.getByTestId("outline-saved")).toBeVisible();
    await page.reload();
    await expect(page.getByTestId("section-heading").first()).toHaveValue("What is cold brew coffee?");
    await expect(page.getByTestId("pinned-question")).toContainText("What ratio of coffee to water should I use?");
    await page.goto("/briefs");
    await expect(page.getByTestId("brief-row").filter({ hasText: "how to make cold brew" })).toBeVisible();
    await page.goto(`/briefs/${briefId}`);
    await page.getByTestId("brief-to-doc").click();

    // F003 Editor with scores
    await expect(page.getByTestId("editor")).toBeVisible();
    await expect(page.getByTestId("editor")).toContainText("What is cold brew coffee?");
    const seoBefore = Number(await page.getByTestId("seo-score").textContent());
    await page.getByTestId("editor").fill(ARTICLE);
    await expect.poll(async () => Number(await page.getByTestId("seo-score").textContent())).toBeGreaterThan(seoBefore);
    await expect(page.getByTestId("geo-score")).toHaveText(/^\d+$/);
    await expect(page.getByTestId("suggestion-item").first()).toBeVisible();
    await expect(page.getByTestId("missing-term").first()).toBeVisible();
    await expect(page.getByTestId("active-voice")).toContainText("Wholesale formal");
    // F004 without a provider
    await expect(page.getByTestId("ai-unavailable")).toBeVisible();
    await expect(page.getByTestId("ai-draft")).toBeDisabled();
    await page.getByTestId("doc-save").click();
    await expect(page.getByTestId("doc-saved")).toBeVisible();
    const [markdown] = await Promise.all([page.waitForEvent("download"), page.getByTestId("export-md").click()]);
    expect(await readFile(await markdown.path(), "utf8")).toContain("## What ratio of coffee to water should I use?");
    const [html] = await Promise.all([page.waitForEvent("download"), page.getByTestId("export-html").click()]);
    expect(await readFile(await html.path(), "utf8")).toContain("<h2>What ratio of coffee to water should I use?</h2>");
    await page.goto("/");
    const docRow = page.getByTestId("doc-row").filter({ hasText: "how to make cold brew" });
    await expect(docRow).toBeVisible();
    await expect(docRow.getByTestId("doc-seo")).toHaveText(/^\d+$/);

    // Import from a live URL
    await page.getByTestId("new-doc").click();
    await page.getByRole("tab", { name: "Import URL" }).click();
    await page.getByTestId("doc-import-url").fill(`${site.origin}/guides/grind-size`);
    await page.getByTestId("doc-create").click();
    await expect(page.getByTestId("editor")).toContainText("## Best grind for cold brew");

    // F006 Site audit
    await page.goto(`/sites/${siteId}`);
    await page.getByTestId("run-audit").click();
    const auditRow = page.getByTestId("audit-row").first();
    await expect(auditRow).toContainText("Done", { timeout: 60000 });
    await auditRow.getByRole("link").click();
    await expect(page.getByTestId("audit-health")).toHaveText(/^\d+$/);
    await expect(page.getByTestId("audit-pages")).toHaveText("7");
    for (const type of ["broken", "duplicate_title", "missing_meta_description", "missing_h1", "multiple_h1", "thin_content", "orphan_page", "ai_crawlers_blocked", "missing_llms_txt"]) {
      await expect(page.locator(`[data-testid="issue-group"][data-issue-type="${type}"]`)).toBeVisible();
    }
    await expect(page.locator('[data-issue-type="ai_crawlers_blocked"]')).toContainText("GPTBot");
    await expect(page.locator('[data-issue-type="broken"]')).toContainText("/old-page");
    await page.goto(`/sites/${siteId}`);
    await page.getByTestId("run-audit").click();
    await expect(page.getByTestId("audit-row")).toHaveCount(2);
    await expect(page.getByTestId("audit-row").first()).toContainText("Done", { timeout: 60000 });
    await expect(page.getByTestId("health-trend-bar")).toHaveCount(2);

    // F007 without a provider
    await page.getByRole("tab", { name: "AI visibility" }).click();
    await page.getByTestId("prompt-text").fill("best coffee beans for cold brew");
    await page.getByTestId("add-prompt").click();
    await expect(page.getByTestId("prompt-row").filter({ hasText: "best coffee beans for cold brew" })).toBeVisible();
    await expect(page.getByTestId("ai-unavailable")).toBeVisible();
    await expect(page.getByTestId("run-visibility")).toBeDisabled();

    // Deleting a site removes its audits and prompts
    const db = await runtime.database();
    await page.getByRole("tab", { name: "Details" }).click();
    await page.getByTestId("delete-site").click();
    await page.getByRole("button", { name: "Delete site" }).click();
    await expect(page).toHaveURL(/\/sites$/);
    await expect(page.getByTestId("site-row")).toHaveCount(0);
    expect((await db.prepare("select count(*) as n from audits").first()).n).toBe(0);
    expect((await db.prepare("select count(*) as n from visibility_prompts").first()).n).toBe(0);

    // Phone-sized smoke
    const phone = await (await runtime.context("member", { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
    await phone.goto("/");
    await expect(phone.getByRole("heading", { level: 1, name: "Documents" })).toBeVisible();
    await expect(phone.getByTestId("new-doc")).toBeVisible();
    await phone.goto("/briefs");
    await expect(phone.getByTestId("brief-query")).toBeVisible();
  } finally {
    await runtime.close();
  }
}

async function configured() {
  const runtime = await startRuntime(fakeGateway(site.origin));
  try {
    const page = await (await runtime.context("member")).newPage();
    await page.goto("/");
    await runtime.assertBackLink(page);
    const siteId = await addSite(page, { name: "Ember Roasters", domain: site.origin, brand: "Ember Roasters" });
    await addVoice(page, { name: "Friendly expert", banned: "leverage, synergy" });

    // F007 AI visibility, on demand and daily
    await page.goto(`/sites/${siteId}`);
    await page.getByRole("tab", { name: "AI visibility" }).click();
    await page.getByTestId("prompt-text").fill("best coffee beans for cold brew");
    await page.getByTestId("add-prompt").click();
    await page.getByTestId("run-visibility").click();
    const result = page.getByTestId("visibility-result").first();
    await expect(result).toContainText("Mentioned", { timeout: 60000 });
    await expect(result).toContainText("#2");
    await expect(result).toContainText("Ember Roasters sells a coarse ground blend");
    await expect(page.getByTestId("visibility-score")).toHaveText("100%");
    await expect(page.getByTestId("visibility-trend-bar")).toHaveCount(1);
    const db = await runtime.database();
    const before = (await db.prepare("select count(*) as n from visibility_checks").first()).n;
    await runtime.scheduled("0 6 * * *");
    await expect.poll(async () => (await db.prepare("select count(*) as n from visibility_checks").first()).n, { timeout: 30000 }).toBeGreaterThan(before);

    // F002 with search data: results and questions come from the search
    await page.goto("/briefs");
    await expect(page.getByTestId("search-data-off")).toHaveCount(0);
    await createBrief(page, { query: "cold brew coffee", siteName: "Ember Roasters" });
    await expect(page.getByTestId("source-row")).toHaveCount(3);
    await expect(page.getByTestId("question-item").filter({ hasText: "Is cold brew stronger than hot coffee?" })).toBeVisible();
    await page.getByTestId("question-item").filter({ hasText: "Do you dilute cold brew concentrate?" }).getByTestId("pin-question").click();
    await page.getByTestId("save-outline").click();
    await expect(page.getByTestId("outline-saved")).toBeVisible();
    await page.getByTestId("brief-to-doc").click();

    // F004 AI drafting in a voice
    await expect(page.getByTestId("active-voice")).toContainText("Friendly expert");
    await expect(page.getByTestId("ai-unavailable")).toHaveCount(0);
    const original = await page.getByTestId("editor").inputValue();
    await page.getByTestId("ai-outline").click();
    await expect(page.getByTestId("ai-proposal")).toContainText("How long should cold brew steep?");
    await page.getByTestId("ai-discard").click();
    await expect(page.getByTestId("ai-proposal")).toHaveCount(0);
    await expect(page.getByTestId("editor")).toHaveValue(original);
    await page.getByTestId("ai-draft").click();
    await expect(page.getByTestId("ai-proposal")).toContainText("Cold brew is coffee steeped in cold water");
    await expect(page.getByTestId("banned-match")).toContainText("leverage");
    await page.getByTestId("ai-accept").click();
    await expect(page.getByTestId("editor")).toHaveValue(/Cold brew is coffee steeped in cold water/);
    await page.getByTestId("ai-section").selectOption({ label: "How long should cold brew steep?" });
    await page.getByTestId("ai-expand").click();
    await expect(page.getByTestId("ai-proposal")).toBeVisible();
    await page.getByTestId("ai-discard").click();
    await page.getByTestId("ai-instruction").fill("Make it shorter and friendlier");
    await page.getByTestId("ai-rewrite").click();
    await expect(page.getByTestId("ai-proposal")).toBeVisible();
    await page.getByTestId("ai-accept").click();
    await page.getByTestId("editor").fill(ARTICLE + "\nPour over ice and add milk if you like. A jar of concentrate makes about 8 drinks.\n");
    await page.getByTestId("doc-save").click();
    await expect(page.getByTestId("doc-saved")).toBeVisible();
    await expect(page.getByTestId("seo-score")).toHaveText(/^\d+$/);
    await expect(page.getByTestId("suggestion-item").first()).toBeVisible();
    await runtime.screenshot(page);
  } finally {
    await runtime.close();
  }
}
