// Background work goes through the JOBS queue: one message per audit or
// visibility run, consumed by the app's own Worker.
import { env } from "cloudflare:workers";

export type Job = { kind: "audit"; auditId: string } | { kind: "visibility"; siteId: string; runId: string };

export async function enqueue(job: Job): Promise<void> {
  await env.JOBS.send(job);
}
