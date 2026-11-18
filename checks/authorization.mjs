// Members only, each member's objects private, admin-only settings, and no
// sign-in of the app's own.
import { startRuntime, expect } from "/home/user/oss-new/control/runtime/index.mjs";
import { startFixtureSite } from "./fixture-site.mjs";
import { addSite, addVoice, createBrief } from "./helpers.mjs";

const site = await startFixtureSite();
const runtime = await startRuntime();
try {
  await runtime.assertPrivateAccess(["/", "/briefs", "/sites", "/voices", "/settings", "/health"]);

  // The Gateway signs people in: no login, sign-up or logout page here.
  for (const path of ["/login", "/signin", "/signup", "/logout", "/register", "/auth/login", "/account/password"]) {
    const response = await runtime.fetch(path, { role: "member" });
    expect(response.status, path).toBe(404);
    expect(await response.text()).not.toMatch(/type="password"/);
  }
  for (const role of [undefined, "outsider"]) {
    for (const path of ["/", "/sites", "/documents/x", "/briefs/x", "/audits/x"]) {
      const response = await runtime.fetch(path, role ? { role } : {});
      expect([401, 403], `${role ?? "anonymous"} ${path}`).toContain(response.status);
    }
  }

  // The owner's objects
  const owner = await (await runtime.context("owner")).newPage();
  const siteId = await addSite(owner, { name: "Ember Roasters", domain: site.origin, brand: "Ember Roasters" });
  await addVoice(owner, { name: "Owner voice", banned: "leverage" });
  const briefId = await createBrief(owner, { query: "cold brew ratio", urls: [`${site.origin}/guides/cold-brew`] });
  await owner.getByTestId("brief-to-doc").click();
  await expect(owner.getByTestId("editor")).toBeVisible();
  const docId = owner.url().split("/documents/")[1];
  await owner.goto(`/sites/${siteId}`);
  await owner.getByTestId("run-audit").click();
  await expect(owner.getByTestId("audit-row").first()).toContainText("Done", { timeout: 60000 });
  const auditHref = await owner.getByTestId("audit-row").first().getByRole("link").getAttribute("href");

  // Another member sees none of it
  const member = await (await runtime.context("member")).newPage();
  for (const [path, list, testId] of [["/sites", "/sites", "site-row"], ["/voices", "/voices", "voice-row"], ["/briefs", "/briefs", "brief-row"], ["/", "/", "doc-row"]]) {
    await member.goto(list);
    await expect(member.getByTestId(testId), path).toHaveCount(0);
  }
  for (const path of [`/sites/${siteId}`, `/briefs/${briefId}`, `/documents/${docId}`, auditHref]) {
    await member.goto(path);
    await expect(member.getByTestId("not-found"), path).toBeVisible();
    await expect(member.locator("body")).not.toContainText("Ember Roasters");
  }
  await member.goto("/briefs");
  await expect(member.getByTestId("brief-site").locator("option", { hasText: "Ember Roasters" })).toHaveCount(0);

  // A member replaying the owner's own requests changes nothing.
  const db = await runtime.database();
  const bodyOf = async () => (await db.prepare("select body from documents where id = ?").bind(docId).first()).body;
  await owner.goto(`/documents/${docId}`);
  await owner.getByTestId("editor").fill("Edited by its owner");
  const save = await captured(owner, () => owner.getByTestId("doc-save").click());
  await replay(save, "member");
  expect(await bodyOf()).not.toContain("Edited by its owner");
  await replay(save, "owner");
  expect(await bodyOf()).toContain("Edited by its owner");

  await owner.goto(`/sites/${siteId}`);
  await owner.getByRole("tab", { name: "Details" }).click();
  await owner.getByTestId("delete-site").click();
  const remove = await captured(owner, () => owner.getByRole("button", { name: "Delete site" }).click());
  await replay(remove, "member");
  expect((await db.prepare("select count(*) as n from sites where id = ?").bind(siteId).first()).n).toBe(1);

  await owner.goto(`/sites/${siteId}`);
  const audit = await captured(owner, () => owner.getByTestId("run-audit").click());
  const auditsBefore = (await db.prepare("select count(*) as n from audits").first()).n;
  await replay(audit, "member");
  expect((await db.prepare("select count(*) as n from audits").first()).n).toBe(auditsBefore);

  // Workspace settings: admins change them, members only read them.
  await member.goto("/settings");
  await expect(member.getByTestId("settings-page-cap")).toBeDisabled();
  await expect(member.getByTestId("settings-save")).toHaveCount(0);
  await owner.goto("/settings");
  await owner.getByTestId("settings-page-cap").fill("12");
  const settings = await captured(owner, () => owner.getByTestId("settings-save").click());
  const cap = async () => (await db.prepare("select audit_page_cap as cap from workspace_settings").first())?.cap ?? 50;
  await replay(settings, "member");
  expect(await cap()).toBe(50);
  await replay(settings, "owner");
  expect(await cap()).toBe(12);
} finally {
  await runtime.close();
  await site.close();
}

/** The next server-function POST the action sends, held back from the server. */
async function captured(page, action) {
  let request;
  await page.route("**/_serverFn/**", async (route) => {
    if (route.request().method() !== "POST" || request) return route.continue();
    request = route.request();
    await route.abort();
  });
  await action();
  await expect.poll(() => Boolean(request)).toBe(true);
  await page.unrouteAll({ behavior: "ignoreErrors" });
  const headers = Object.fromEntries(Object.entries(request.headers()).filter(([name]) => !["cookie", "host", "content-length"].includes(name)));
  return { path: new URL(request.url()).pathname + new URL(request.url()).search, headers, body: request.postData() };
}

async function replay({ path, headers, body }, role) {
  const response = await runtime.fetch(path, { role, method: "POST", headers, body });
  await response.text();
  return response.status;
}
