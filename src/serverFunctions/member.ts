import { createMiddleware } from "@tanstack/react-start";
import { ensureUserMiddleware } from "@every-app/sdk/tanstack-start";
import { ensureMember } from "@/server/users";

/** The Gateway's verified member, recorded the first time they open the app. */
export const memberMiddleware = createMiddleware({ type: "function" })
  .middleware([ensureUserMiddleware])
  .server(async ({ next, context }) => {
    await ensureMember(context.user);
    return next();
  });
