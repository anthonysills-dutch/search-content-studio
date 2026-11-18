import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import * as audits from "@/server/audits";
import * as sites from "@/server/sites";
import * as visibility from "@/server/visibility";
import { listVoices } from "@/server/voices";
import { aiAvailability } from "@/server/ai";
import { memberMiddleware } from "./member";

const idInput = z.object({ id: z.string().uuid() }).strict();

export const getSites = createServerFn()
  .middleware([memberMiddleware])
  .handler(async ({ context: { user } }) => {
    const [list, voices] = await Promise.all([sites.listSites(user.id), listVoices(user.id)]);
    return { sites: list, voices: voices.map((v) => ({ id: v.id, name: v.name })) };
  });

export const getSitePage = createServerFn()
  .middleware([memberMiddleware])
  .validator((data: unknown) => idInput.parse(data))
  .handler(async ({ data, context: { user } }) => {
    const site = await sites.getSite(user.id, data.id);
    const [auditList, vis, voices, ai] = await Promise.all([
      audits.listAudits(user.id, site.id),
      visibility.getVisibility(user.id, site.id),
      listVoices(user.id),
      aiAvailability(user.orgId),
    ]);
    return { site, audits: auditList, visibility: vis, voices: voices.map((v) => ({ id: v.id, name: v.name })), ai };
  });

export const createSite = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((data: unknown) => sites.siteInput.parse(data))
  .handler(({ data, context: { user } }) => sites.createSite(user.id, user.orgId, data));

export const updateSite = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((data: unknown) => sites.updateSiteInput.parse(data))
  .handler(({ data, context: { user } }) => sites.updateSite(user.id, data));

export const deleteSite = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((data: unknown) => idInput.parse(data))
  .handler(({ data, context: { user } }) => sites.deleteSite(user.id, data.id));

export const startAudit = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((data: unknown) => audits.siteIdInput.parse(data))
  .handler(({ data, context: { user } }) => audits.startAudit(user.id, data.siteId));

export const getAudit = createServerFn()
  .middleware([memberMiddleware])
  .validator((data: unknown) => idInput.parse(data))
  .handler(({ data, context: { user } }) => audits.getAudit(user.id, data.id));

export const addPrompt = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((data: unknown) => visibility.addPromptInput.parse(data))
  .handler(({ data, context: { user } }) => visibility.addPrompt(user.id, data));

export const deletePrompt = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((data: unknown) => idInput.parse(data))
  .handler(({ data, context: { user } }) => visibility.deletePrompt(user.id, data.id));

export const runVisibility = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((data: unknown) => visibility.siteIdInput.parse(data))
  .handler(async ({ data, context: { user } }) => {
    const ai = await aiAvailability(user.orgId);
    if (!ai.ready) throw new Error(ai.message ?? "AI isn't set up");
    return visibility.requestRun(user.id, data.siteId);
  });

export const recheckAi = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .handler(({ context: { user } }) => aiAvailability(user.orgId, true));
