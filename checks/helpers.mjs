import { expect } from "/home/user/oss-new/control/runtime/index.mjs";

export async function addSite(page, { name, domain, brand }) {
  await page.goto("/sites");
  await page.getByTestId("add-site").click();
  await page.getByTestId("site-name").fill(name);
  await page.getByTestId("site-domain").fill(domain);
  await page.getByTestId("site-brand").fill(brand);
  await page.getByTestId("site-language").selectOption("en");
  await page.getByTestId("site-country").selectOption("US");
  await page.getByTestId("site-save").click();
  const row = page.getByTestId("site-row").filter({ hasText: name });
  await expect(row).toBeVisible();
  await row.getByRole("link").first().click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  return page.url().split("/sites/")[1];
}

export async function addVoice(page, { name, banned, preferred = "", isDefault = true }) {
  await page.goto("/voices");
  await page.getByTestId("add-voice").click();
  await page.getByTestId("voice-name").fill(name);
  await page.getByTestId("voice-tone").fill("Warm, practical, confident");
  await page.getByTestId("voice-formality").selectOption("conversational");
  await page.getByTestId("voice-audience").fill("Home baristas who want better coffee without fancy gear");
  await page.getByTestId("voice-context").fill("A small roaster that ships fresh beans weekly.");
  await page.getByTestId("voice-samples").fill("Grab a jar, add the grounds, pour cold water and walk away. Tomorrow you have coffee.");
  await page.getByTestId("voice-preferred").fill(preferred);
  await page.getByTestId("voice-banned").fill(banned);
  if (isDefault) await page.getByTestId("voice-default").check();
  await page.getByTestId("voice-save").click();
  await expect(page.getByTestId("voice-row").filter({ hasText: name })).toBeVisible();
}

export async function createBrief(page, { query, urls = [], siteName }) {
  await page.goto("/briefs");
  await page.getByTestId("brief-query").fill(query);
  await page.getByTestId("brief-language").selectOption("en");
  await page.getByTestId("brief-country").selectOption("US");
  if (siteName) await page.getByTestId("brief-site").selectOption({ label: siteName });
  if (urls.length) await page.getByTestId("brief-urls").fill(urls.join("\n"));
  await page.getByTestId("brief-create").click();
  await expect(page.getByRole("heading", { level: 1, name: query })).toBeVisible({ timeout: 30000 });
  return page.url().split("/briefs/")[1];
}

export const ARTICLE = `## What is cold brew coffee?

Cold brew coffee is coffee steeped in cold water for 16 hours. It tastes smooth and keeps for two weeks.

## What ratio of coffee to water should I use?

Use a coarse grind and a 1:8 ratio of coffee to water. For a concentrate, use 1:4.

- 100 grams of coarse ground coffee
- 800 ml of cold filtered water

## How long should cold brew steep?

Steep for 16 hours at room temperature, then filter through a paper filter.
`;
