import { createServerFn } from "@tanstack/react-start";
import * as briefs from "@/server/briefs";
import { searchDataReady } from "@/server/search";
import { listSites } from "@/server/sites";
import { memberMiddleware } from "./member";

export const getBriefs = createServerFn()
  .middleware([memberMiddleware])
  .handler(async ({ context: { user } }) => {
    const [list, sites, searchReady] = await Promise.all([briefs.listBriefs(user.id), listSites(user.id), searchDataReady()]);
    return { briefs: list, sites: sites.map((s) => ({ id: s.id, name: s.name, language: s.language, country: s.country })), searchReady };
  });

export const getBrief = createServerFn()
  .middleware([memberMiddleware])
  .validator((data: unknown) => briefs.idInput.parse(data))
  .handler(({ data, context: { user } }) => briefs.getBrief(user.id, data.id));

export const createBrief = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((data: unknown) => briefs.createBriefInput.parse(data))
  .handler(({ data, context: { user } }) => briefs.createBrief(user.id, data));

export const updateOutline = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((data: unknown) => briefs.updateOutlineInput.parse(data))
  .handler(({ data, context: { user } }) => briefs.updateOutline(user.id, data));

export const deleteBrief = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((data: unknown) => briefs.idInput.parse(data))
  .handler(({ data, context: { user } }) => briefs.deleteBrief(user.id, data.id));
