import tanstackEntry from "@tanstack/react-start/server-entry";
import { everyApp } from "@every-app/sdk/server";
import { consume, daily } from "@/server/consumer";
import type { Job } from "@/server/jobs";

// everyApp() verifies the identity the Gateway sent before any request reaches
// the app (a request from anywhere else is a 401). The queue runs audits and
// visibility checks; the cron starts the daily visibility run.
export default {
  ...everyApp<Env>(async (request) => tanstackEntry.fetch(request)),
  async queue(batch: MessageBatch<Job>) {
    await consume(batch);
  },
  async scheduled(_controller: ScheduledController, _env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(daily());
  },
};
