// AI drafting: every request carries the document's voice profile and the
// brief's terms and questions, and comes back as a proposal.
import { z } from "zod";
import type { VoiceProfile } from "./voices";
import { getVoice, wordList } from "./voices";
import { chat } from "./ai";
import { getDocument } from "./documents";
import { getSettings } from "./settings";
import { UserError } from "./errors";

export const draftInput = z
  .object({
    id: z.string().uuid(),
    action: z.enum(["outline", "draft", "expand", "rewrite"]),
    body: z.string().max(200_000),
    section: z.string().max(300).nullable(),
    instruction: z.string().trim().max(300).nullable(),
  })
  .strict();

function voiceRules(voice: VoiceProfile | null): string {
  if (!voice) return "Write in a clear, direct, helpful voice.";
  const lines = [`Write in the voice "${voice.name}".`];
  if (voice.tone) lines.push(`Tone: ${voice.tone}.`);
  lines.push(`Formality: ${voice.formality}.`);
  if (voice.audience) lines.push(`Audience: ${voice.audience}.`);
  if (voice.context) lines.push(`About the brand: ${voice.context}`);
  const preferred = wordList(voice.preferredWords);
  if (preferred.length) lines.push(`Prefer these words: ${preferred.join(", ")}.`);
  const banned = wordList(voice.bannedWords);
  if (banned.length) lines.push(`Never use these words: ${banned.join(", ")}.`);
  if (voice.samples) lines.push(`Match the style of these samples:\n"""\n${voice.samples.slice(0, 4000)}\n"""`);
  return lines.join("\n");
}

/** The banned words the text uses, as written in the profile. */
export function bannedMatches(text: string, banned: string): string[] {
  return wordList(banned).filter((word) => new RegExp(`(^|[^\\p{L}\\p{N}])${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^\\p{L}\\p{N}]|$)`, "iu").test(text));
}

export async function draft(ownerId: string, orgId: string, input: z.infer<typeof draftInput>) {
  const { doc, brief, scoring, voice } = await getDocument(ownerId, input.id);
  const profile = voice ? await getVoice(ownerId, voice.id) : null;
  const settings = await getSettings(orgId);
  const topic = brief?.query ?? doc.title;
  const context = [
    `Topic: ${topic}`,
    scoring?.terms.length ? `Terms to cover: ${scoring.terms.map((t) => t.term).join(", ")}` : "",
    scoring?.questions.length ? `Questions to answer: ${scoring.questions.join(" | ")}` : "",
    scoring?.headings.length ? `Planned headings: ${scoring.headings.join(" | ")}` : "",
    scoring?.targetWords ? `Ranking pages average ${scoring.targetWords} words.` : "",
  ]
    .filter(Boolean)
    .join("\n");
  const section = input.section?.trim() || null;
  let task: string;
  switch (input.action) {
    case "outline":
      task = "Task: outline. Write an outline in Markdown: one H2 (##) per section, H3 where useful, phrased as the questions readers ask where it fits. Headings only.";
      break;
    case "draft":
      task = `Task: draft. Write the full article in Markdown. Open each section with a direct answer in one or two short sentences, use lists for steps and options, include specific figures, and cover the terms and questions.${input.body.trim() ? `\nFollow this outline and keep its headings:\n${input.body}` : ""}`;
      break;
    case "expand":
      if (!section) throw new UserError("Choose a section to expand");
      task = `Task: expand. Rewrite and expand the section "${section}" of the article below into a fuller section in Markdown, starting with its heading line. Return only that section.\n\nArticle:\n${input.body}`;
      break;
    case "rewrite":
      if (!input.instruction) throw new UserError("Say how to rewrite it");
      task = `Task: rewrite. ${input.instruction}.\nRewrite ${section ? `only the section "${section}", starting with its heading line,` : "the whole article"} in Markdown and return only the rewritten text.\n\nArticle:\n${input.body}`;
      break;
  }
  const result = await chat(orgId, {
    model: settings.draftModel,
    messages: [
      { role: "system", content: `You write web content that ranks in search and gets quoted by AI assistants.\n${voiceRules(profile)}\nReturn Markdown only, with no preamble.` },
      { role: "user", content: `${context}\n\n${task}` },
    ],
  });
  if (!result.ok) throw new UserError(result.message);
  const text = result.text.replace(/^```(?:markdown|md)?\n([\s\S]*?)\n```$/i, "$1").trim();
  return { text, bannedMatches: profile ? bannedMatches(text, profile.bannedWords) : [], voice: profile?.name ?? null };
}
