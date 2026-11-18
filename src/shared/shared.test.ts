import { describe, expect, it } from "vitest";
import { blockedAiCrawlers, healthOf } from "./audit";
import { extractPage, htmlToMarkdown } from "./html";
import { markdownToHtml } from "./markdown";
import { scoreDocument } from "./scoring";
import { aggregateTerms, topTerms } from "./terms";

describe("pages", () => {
  it("reads title, headings and links", () => {
    const facts = extractPage('<html><head><title>Cold brew</title></head><body><h1>A</h1><h2>Why?</h2><p>steep steep coffee</p><a href="/x">x</a></body></html>', "https://a.test/");
    expect(facts.title).toBe("Cold brew");
    expect(facts.h1Count).toBe(1);
    expect(facts.links).toEqual(["https://a.test/x"]);
    expect(htmlToMarkdown("<body><h2>Why?</h2><p>Because.</p></body>")).toBe("## Why?\n\nBecause.\n");
  });
});

describe("terms and scores", () => {
  it("flags gaps and scores coverage", () => {
    const a = topTerms("cold brew cold brew coffee coffee ratio ratio");
    const b = topTerms("cold brew cold brew espresso espresso");
    const terms = aggregateTerms([a, b, topTerms("cold brew cold brew water water")]);
    expect(terms.find((t) => t.term === "cold brew")?.gap).toBe(false);
    expect(terms.find((t) => t.term === "espresso")?.gap).toBe(true);
    const brief = { terms: [{ term: "cold brew", target: 2 }], headings: [], questions: ["How long to steep?"], targetWords: 50 };
    const empty = scoreDocument("", brief);
    const written = scoreDocument("## How long to steep cold brew?\n\nSteep cold brew for 16 hours.\n\n- Use 100 grams\n", brief);
    expect(written.seo).toBeGreaterThan(empty.seo);
    expect(written.geo).toBeGreaterThan(50);
    expect(markdownToHtml("## Hi\n\n- a\n- b")).toBe("<h2>Hi</h2>\n<ul>\n<li>a</li>\n<li>b</li>\n</ul>\n");
  });
});

describe("audit", () => {
  it("reads robots rules and scores health", () => {
    expect(blockedAiCrawlers("User-agent: GPTBot\nDisallow: /\n\nUser-agent: *\nAllow: /")).toEqual(["GPTBot"]);
    expect(healthOf(2, []).score).toBe(100);
    expect(healthOf(2, [{ type: "broken", url: "a" }]).score).toBeLessThan(100);
  });
});
