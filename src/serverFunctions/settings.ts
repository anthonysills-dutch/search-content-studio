import { createServerFn } from "@tanstack/react-start";
import { isAdmin } from "@every-app/sdk/server";
import * as settings from "@/server/settings";
import { memberMiddleware } from "./member";

export const getSettings = createServerFn()
  .middleware([memberMiddleware])
  .handler(async ({ context: { user } }) => ({ settings: await settings.getSettings(user.orgId), isAdmin: isAdmin(user) }));

export const updateSettings = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((data: unknown) => settings.updateSettingsInput.parse(data))
  .handler(({ data, context: { user } }) => {
    if (!isAdmin(user)) throw new Error("Only workspace admins can change these settings");
    return settings.updateSettings(user.orgId, data);
  });
