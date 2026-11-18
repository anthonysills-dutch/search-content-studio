import type { Job } from "./jobs";
import { runAudit } from "./audits";
import { enqueueDaily, runVisibility } from "./visibility";

export async function consume(batch: MessageBatch<Job>): Promise<void> {
  for (const message of batch.messages) {
    const job = message.body;
    if (job.kind === "audit") await runAudit(job.auditId);
    else if (job.kind === "visibility") await runVisibility(job.siteId, job.runId);
    message.ack();
  }
}

export async function daily(): Promise<void> {
  await enqueueDaily();
}
