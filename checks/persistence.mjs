// What members write survives a restart of the Workers.
import { startRuntime, expect } from "/home/user/oss-new/control/runtime/index.mjs";
import { startFixtureSite } from "./fixture-site.mjs";
import { addSite, addVoice, createBrief, ARTICLE } from "./helpers.mjs";

const site = await startFixtureSite();
const runtime = await startRuntime();
try {
  let page = await (await runtime.context("owner")).newPage();
  const siteId = await addSite(page, { name: "Ember Roasters", domain: site.origin, brand: "Ember Roasters" });
  await addVoice(page, { name: "Friendly expert", banned: "leverage" });
  const briefId = await createBrief(page, { query: "cold brew at home", urls: [`${site.origin}/guides/cold-brew`] });
  await page.getByTestId("add-section").click();
  await page.getByTestId("section-heading").last().fill("Why cold brew tastes smoother");
  await page.getByTestId("save-outline").click();
  await expect(page.getByTestId("outline-saved")).toBeVisible();
  await page.getByTestId("brief-to-doc").click();
  await page.getByTestId("editor").fill(ARTICLE);
  await page.getByTestId("doc-save").click();
  await expect(page.getByTestId("doc-saved")).toBeVisible();
  const docUrl = new URL(page.url()).pathname;
  await page.goto(`/sites/${siteId}`);
  await page.getByTestId("run-audit").click();
  await expect(page.getByTestId("audit-row").first()).toContainText("Done", { timeout: 60000 });
  await page.getByRole("tab", { name: "AI visibility" }).click();
  await page.getByTestId("prompt-text").fill("best coffee beans for cold brew");
  await page.getByTestId("add-prompt").click();
  await expect(page.getByTestId("prompt-row")).toHaveCount(1);

  await runtime.restart();

  page = await (await runtime.context("owner")).newPage();
  await page.goto("/sites");
  await expect(page.getByTestId("site-row").filter({ hasText: "Ember Roasters" })).toBeVisible();
  await page.goto(`/sites/${siteId}`);
  await expect(page.getByTestId("audit-row").first()).toContainText("Done");
  await page.getByRole("tab", { name: "AI visibility" }).click();
  await expect(page.getByTestId("prompt-row").filter({ hasText: "best coffee beans for cold brew" })).toBeVisible();
  await page.goto("/voices");
  await expect(page.getByTestId("voice-row").filter({ hasText: "Friendly expert" })).toBeVisible();
  await page.goto(`/briefs/${briefId}`);
  await expect(page.getByTestId("source-row")).toHaveCount(1);
  await expect(page.getByTestId("section-heading").last()).toHaveValue("Why cold brew tastes smoother");
  await page.goto(docUrl);
  await expect(page.getByTestId("editor")).toHaveValue(/What ratio of coffee to water should I use\?/);
} finally {
  await runtime.close();
  await site.close();
}
