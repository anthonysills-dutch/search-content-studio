import { notFound } from "@tanstack/react-router";

export function messageOf(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  // A validation failure arrives as zod's JSON list of issues.
  try {
    const issues = JSON.parse(message) as { message?: string }[];
    if (Array.isArray(issues) && issues[0]?.message) return issues[0].message;
  } catch {
    // Plain text.
  }
  return message || "That didn't work";
}

/** Runs a loader's server call; a missing or someone else's object is the not-found page. */
export async function orNotFound<T>(load: () => Promise<T>): Promise<T> {
  try {
    return await load();
  } catch (error) {
    if (/not found$/i.test(messageOf(error))) throw notFound();
    throw error;
  }
}
