// The SEO and GEO scores the editor shows as the member types.
import { countWords } from "./html";
import { markdownText, sections } from "./markdown";
import { countTerm, words } from "./terms";

export interface ScoringBrief {
  /** Terms to cover, with how often ranking pages use them. */
  terms: { term: string; target: number }[];
  /** Outline headings to cover. */
  headings: string[];
  questions: string[];
  /** Average words of the ranking pages; null without sources. */
  targetWords: number | null;
}

export interface Suggestion {
  text: string;
  /** Points the score would gain. */
  gain: number;
  score: "SEO" | "GEO";
}

export interface MissingTerm {
  term: string;
  used: number;
  target: number;
}

export interface Scores {
  seo: number;
  geo: number;
  words: number;
  suggestions: Suggestion[];
  missingTerms: MissingTerm[];
}

const DEFAULT_WORDS = 1200;

/** True when `text` covers most of the content words of `phrase`. */
function covers(text: string, phrase: string): boolean {
  const wanted = words(phrase).filter((w) => w.length > 3);
  if (wanted.length === 0) return true;
  const have = new Set(words(text));
  return wanted.filter((w) => have.has(w)).length / wanted.length >= 0.7;
}

function sentencesOf(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => countWords(s) >= 3);
}

export function scoreDocument(markdown: string, brief: ScoringBrief | null): Scores {
  const text = markdownText(markdown);
  const wordCount = countWords(text);
  const parts = sections(markdown);
  const headingText = parts.map((s) => s.heading).join("\n");
  const suggestions: Suggestion[] = [];

  // SEO: terms 50, headings and questions 25, length 25.
  const terms = brief?.terms ?? [];
  const missingTerms: MissingTerm[] = [];
  let termPoints = 50;
  if (terms.length) {
    let covered = 0;
    for (const { term, target } of terms) {
      const used = countTerm(text, term);
      covered += Math.min(1, used / Math.max(1, target));
      if (used < target) missingTerms.push({ term, used, target });
    }
    termPoints = (50 * covered) / terms.length;
    missingTerms.sort((a, b) => a.used / a.target - b.used / b.target || b.target - a.target);
    if (missingTerms.length) {
      const top = missingTerms.slice(0, 3).map((m) => `“${m.term}”`).join(", ");
      suggestions.push({ text: `Use ${top} more often`, gain: Math.round(50 - termPoints) || 1, score: "SEO" });
    }
  }

  const topics = [...(brief?.headings ?? []), ...(brief?.questions ?? [])];
  let topicPoints = 25;
  if (topics.length) {
    const missing = topics.filter((t) => !covers(headingText, t) && !covers(text, t));
    topicPoints = (25 * (topics.length - missing.length)) / topics.length;
    for (const topic of missing.slice(0, 4)) {
      suggestions.push({ text: `Add a section on “${topic}”`, gain: Math.max(1, Math.round(25 / topics.length)), score: "SEO" });
    }
  } else if (parts.length < 2) {
    topicPoints = parts.length ? 15 : 5;
    suggestions.push({ text: "Break the text into sections with headings", gain: 25 - topicPoints, score: "SEO" });
  }

  const target = brief?.targetWords ?? DEFAULT_WORDS;
  const lengthRatio = Math.min(1, wordCount / Math.max(1, target));
  const lengthPoints = 25 * lengthRatio;
  if (lengthRatio < 0.9) {
    suggestions.push({ text: `Write about ${Math.max(0, Math.round(target * 0.9 - wordCount))} more words (ranking pages average ${target})`, gain: Math.max(1, Math.round(25 - lengthPoints)), score: "SEO" });
  }
  const seo = Math.round(termPoints + topicPoints + lengthPoints);

  // GEO: answer-first 30, question headings 20, lists 15, short sentences 20, facts 15.
  const body = parts.filter((s) => s.level >= 2);
  let answerFirst = 0;
  for (const section of body) {
    const first = section.body.split(/\n\s*\n/)[0] ?? "";
    const firstWords = countWords(first);
    if (firstWords > 0 && firstWords <= 60 && !/^\s*[-*+]/.test(first)) answerFirst += 1;
  }
  const answerPoints = body.length ? (30 * answerFirst) / body.length : 0;
  if (!body.length) suggestions.push({ text: "Add sections with headings that each open with a direct answer", gain: 30, score: "GEO" });
  else if (answerFirst < body.length) suggestions.push({ text: `Open ${body.length - answerFirst} section${body.length - answerFirst === 1 ? "" : "s"} with a direct answer of 60 words or fewer`, gain: Math.max(1, Math.round(30 - answerPoints)), score: "GEO" });

  const questionHeadings = body.filter((s) => s.heading.trim().endsWith("?")).length;
  const questionPoints = body.length ? Math.min(20, (20 * questionHeadings) / Math.max(1, Math.ceil(body.length / 2))) : 0;
  if (questionPoints < 20) suggestions.push({ text: "Phrase more headings as the questions people ask", gain: Math.max(1, Math.round(20 - questionPoints)), score: "GEO" });

  const hasList = /^\s*([-*+]|\d+[.)])\s+/m.test(markdown);
  const listPoints = hasList ? 15 : 0;
  if (!hasList) suggestions.push({ text: "Add a list for steps, options or key facts", gain: 15, score: "GEO" });

  const sentences = sentencesOf(text);
  const shortShare = sentences.length ? sentences.filter((s) => countWords(s) <= 25).length / sentences.length : 0;
  const sentencePoints = 20 * shortShare;
  if (shortShare < 0.8 && sentences.length) suggestions.push({ text: "Split long sentences: keep most under 25 words", gain: Math.max(1, Math.round(20 - sentencePoints)), score: "GEO" });

  const facts = sentences.filter((s) => /\d/.test(s)).length;
  const factPoints = Math.min(15, facts * 5);
  if (factPoints < 15) suggestions.push({ text: "Add specific figures: amounts, times, dates or prices", gain: 15 - factPoints, score: "GEO" });

  const geo = wordCount === 0 ? 0 : Math.round(answerPoints + questionPoints + listPoints + sentencePoints + factPoints);

  suggestions.sort((a, b) => b.gain - a.gain);
  return {
    seo: wordCount === 0 ? 0 : Math.min(100, seo),
    geo: Math.min(100, geo),
    words: wordCount,
    suggestions,
    missingTerms,
  };
}
