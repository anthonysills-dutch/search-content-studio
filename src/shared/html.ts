// Reads what the app needs out of a web page's HTML, without a DOM.

export interface Heading {
  level: number;
  text: string;
}

export interface PageFacts {
  title: string;
  metaDescription: string;
  h1Count: number;
  headings: Heading[];
  text: string;
  wordCount: number;
  links: string[];
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  "#39": "'",
};

export function decodeEntities(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
      String.fromCodePoint(parseInt(code, 16)),
    )
    .replace(/&([a-z0-9#]+);/gi, (match, name: string) => ENTITIES[name.toLowerCase()] ?? match);
}

function stripTags(value: string): string {
  return decodeEntities(value.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

/** The page without scripts, styles, comments and other non-content. */
function contentHtml(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|template|iframe)\b[\s\S]*?<\/\1>/gi, " ");
}

function bodyHtml(html: string): string {
  const match = /<body\b[^>]*>([\s\S]*)<\/body>/i.exec(html);
  return match ? match[1]! : html;
}

export function countWords(text: string): number {
  return text.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
}

function attribute(tag: string, name: string): string | null {
  const match = new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i").exec(tag);
  if (!match) return null;
  return decodeEntities(match[2] ?? match[3] ?? match[4] ?? "");
}

export function extractPage(html: string, pageUrl: string): PageFacts {
  const clean = contentHtml(html);
  const title = stripTags(/<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(clean)?.[1] ?? "");
  let metaDescription = "";
  for (const tag of clean.match(/<meta\b[^>]*>/gi) ?? []) {
    if ((attribute(tag, "name") ?? "").toLowerCase() === "description") {
      metaDescription = (attribute(tag, "content") ?? "").trim();
    }
  }
  const body = bodyHtml(clean);
  const headings: Heading[] = [];
  for (const match of body.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)) {
    const text = stripTags(match[2]!);
    if (text) headings.push({ level: Number(match[1]), text });
  }
  const links = new Set<string>();
  for (const tag of body.match(/<a\b[^>]*>/gi) ?? []) {
    const href = attribute(tag, "href");
    if (!href || /^(mailto|tel|javascript):/i.test(href)) continue;
    try {
      const url = new URL(href, pageUrl);
      url.hash = "";
      links.add(url.toString());
    } catch {
      // Not a URL.
    }
  }
  const text = stripTags(body);
  return {
    title,
    metaDescription,
    h1Count: headings.filter((h) => h.level === 1).length,
    headings,
    text,
    wordCount: countWords(text),
    links: [...links],
  };
}

/** The page's main content as Markdown: headings, paragraphs and lists. */
export function htmlToMarkdown(html: string): string {
  let body = bodyHtml(contentHtml(html));
  const main = /<(main|article)\b[^>]*>([\s\S]*?)<\/\1>/i.exec(body);
  if (main) body = main[2]!;
  body = body.replace(/<(nav|header|footer|aside|form)\b[\s\S]*?<\/\1>/gi, " ");
  const blocks: string[] = [];
  const pattern = /<(h[1-6]|p|li|blockquote)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  for (const match of body.matchAll(pattern)) {
    const tag = match[1]!.toLowerCase();
    const text = stripTags(match[2]!);
    if (!text) continue;
    if (tag.startsWith("h")) blocks.push(`${"#".repeat(Number(tag[1]))} ${text}`);
    else if (tag === "li") blocks.push(`- ${text}`);
    else if (tag === "blockquote") blocks.push(`> ${text}`);
    else blocks.push(text);
  }
  // Consecutive list items stay together; everything else is its own block.
  let out = "";
  blocks.forEach((block, i) => {
    const prev = blocks[i - 1];
    if (i > 0) out += block.startsWith("- ") && prev?.startsWith("- ") ? "\n" : "\n\n";
    out += block;
  });
  return out.trim() + "\n";
}
