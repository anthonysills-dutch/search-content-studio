// The little Markdown the editor writes: headings, paragraphs, lists, quotes,
// bold, italics, links and inline code.

export interface Section {
  heading: string;
  level: number;
  /** Lines of the section, its heading line included. */
  start: number;
  end: number;
  body: string;
}

export function sections(markdown: string): Section[] {
  const lines = markdown.split("\n");
  const found: Section[] = [];
  lines.forEach((line, i) => {
    const match = /^(#{1,6})\s+(.*)$/.exec(line);
    if (match) found.push({ heading: match[2]!.trim(), level: match[1]!.length, start: i, end: lines.length, body: "" });
  });
  found.forEach((section, i) => {
    const next = found.slice(i + 1).find((s) => s.level <= section.level);
    section.end = next ? next.start : lines.length;
    section.body = lines.slice(section.start + 1, section.end).join("\n").trim();
  });
  return found;
}

/** `markdown` with one section (heading included) replaced by `replacement`. */
export function replaceSection(markdown: string, section: Section, replacement: string): string {
  const lines = markdown.split("\n");
  return [...lines.slice(0, section.start), replacement.trimEnd(), "", ...lines.slice(section.end)].join("\n").replace(/\n{3,}/g, "\n\n");
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function inline(text: string): string {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2">$1</a>');
}

export function markdownToHtml(markdown: string): string {
  const out: string[] = [];
  let list: "ul" | "ol" | null = null;
  let paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length) out.push(`<p>${inline(paragraph.join(" "))}</p>`);
    paragraph = [];
  };
  const closeList = () => {
    if (list) out.push(`</${list}>`);
    list = null;
  };
  for (const raw of markdown.split("\n")) {
    const line = raw.trimEnd();
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    const bullet = /^\s*[-*+]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (heading) {
      flush();
      closeList();
      const level = heading[1]!.length;
      out.push(`<h${level}>${inline(heading[2]!.trim())}</h${level}>`);
    } else if (bullet || numbered) {
      flush();
      const kind = bullet ? "ul" : "ol";
      if (list !== kind) {
        closeList();
        out.push(`<${kind}>`);
        list = kind;
      }
      out.push(`<li>${inline((bullet ?? numbered)![1]!)}</li>`);
    } else if (line.startsWith(">")) {
      flush();
      closeList();
      out.push(`<blockquote>${inline(line.replace(/^>\s?/, ""))}</blockquote>`);
    } else if (line.trim() === "") {
      flush();
      closeList();
    } else {
      closeList();
      paragraph.push(line.trim());
    }
  }
  flush();
  closeList();
  return out.join("\n") + "\n";
}

/** Plain text of the Markdown, for counting words. */
export function markdownText(markdown: string): string {
  return markdown
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*([-*+]|\d+[.)])\s+/gm, "")
    .replace(/[*_`>#]/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
}
