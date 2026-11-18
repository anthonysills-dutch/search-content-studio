import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, FileText, Pin, PinOff, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/client/components/AppShell";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { PageHeader } from "@/client/components/PageHeader";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/client/components/ui/card";
import { Checkbox } from "@/client/components/ui/checkbox";
import { Input } from "@/client/components/ui/input";
import { Table, TableBody, TableCard, TableCell, TableHead, TableHeader, TableRow } from "@/client/components/ui/table";
import { Textarea } from "@/client/components/ui/textarea";
import { messageOf, orNotFound } from "@/client/lib/errors";
import { countryName, languageName } from "@/shared/locales";
import { deleteBrief, getBrief, updateOutline } from "@/serverFunctions/briefs";
import { createDocument } from "@/serverFunctions/documents";

export const Route = createFileRoute("/briefs/$briefId")({
  loader: ({ params }) => orNotFound(() => getBrief({ data: { id: params.briefId } })),
  head: ({ loaderData }) => ({ meta: loaderData ? [{ title: loaderData.query }] : [] }),
  component: BriefPage,
});

function BriefPage() {
  const brief = Route.useLoaderData();
  const router = useRouter();
  const navigate = useNavigate();
  const [outline, setOutline] = useState(brief.outline);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const change = (next: typeof outline) => {
    setOutline(next);
    setDirty(true);
    setSaved(false);
  };
  const sections = outline.sections;
  const move = (index: number, by: number) => {
    const next = [...sections];
    const [item] = next.splice(index, 1);
    next.splice(index + by, 0, item!);
    change({ ...outline, sections: next });
  };
  const toggle = (list: string[], value: string) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  async function save() {
    await updateOutline({ data: { id: brief.id, outline } });
    setDirty(false);
    setSaved(true);
  }
  const usable = brief.sources.filter((s) => !s.error);

  return (
    <AppShell wide>
      <PageHeader
        title={brief.query}
        description={`${languageName(brief.language)}, ${countryName(brief.country)}${brief.siteName ? ` · ${brief.siteName}` : ""}`}
        actions={
          <>
            <Button variant="ghost" size="icon" aria-label="Delete brief" onClick={() => setConfirming(true)}>
              <Trash2 />
            </Button>
            <Button
              data-testid="brief-to-doc"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  if (dirty) await save();
                  const { id } = await createDocument({ data: { from: "brief", briefId: brief.id } });
                  await navigate({ to: "/documents/$docId", params: { docId: id } });
                } catch (error) {
                  toast.error(messageOf(error));
                  setBusy(false);
                }
              }}
            >
              <FileText /> Write document
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card size="sm">
          <CardHeader>
            <CardDescription>Average length</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              <span data-testid="avg-words">{brief.averageWords ?? "–"}</span> <span className="text-sm font-normal text-muted-foreground">words</span>
            </CardTitle>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>Pages read</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {usable.length} of {brief.sources.length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>Questions</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{brief.questions.length}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Ranking pages</h2>
        <TableCard>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">#</TableHead>
                <TableHead>Page</TableHead>
                <TableHead className="text-right">Words</TableHead>
                <TableHead className="text-right">Headings</TableHead>
                <TableHead>Top terms</TableHead>
                <TableHead className="w-8">Cover</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {brief.sources.map((source, i) => (
                <TableRow key={source.url} data-testid="source-row" className="align-top">
                  <TableCell className="tabular-nums">{i + 1}</TableCell>
                  <TableCell className="max-w-xs whitespace-normal">
                    <div className="font-medium">{source.title || source.url}</div>
                    <a href={source.url} target="_blank" rel="noreferrer" className="block truncate text-xs text-muted-foreground hover:underline">
                      {source.url}
                    </a>
                    {source.error ? <div className="text-xs text-destructive">{source.error}</div> : null}
                    {source.headings.length ? (
                      <details className="mt-1 text-xs">
                        <summary className="cursor-pointer text-muted-foreground">Outline</summary>
                        <ul className="mt-1 space-y-0.5">
                          {source.headings.map((h, j) => (
                            <li key={j} style={{ paddingLeft: `${(h.level - 1) * 0.75}rem` }}>
                              <span className="text-muted-foreground">H{h.level}</span> {h.text}
                            </li>
                          ))}
                        </ul>
                      </details>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{source.error ? "–" : source.wordCount}</TableCell>
                  <TableCell className="text-right tabular-nums">{source.headings.length}</TableCell>
                  <TableCell className="max-w-xs whitespace-normal text-xs text-muted-foreground">
                    {source.terms.slice(0, 6).map((t) => t.term).join(", ")}
                  </TableCell>
                  <TableCell>
                    <Checkbox aria-label="Cover this source" checked={outline.sources.includes(source.url)} onCheckedChange={() => change({ ...outline, sources: toggle(outline.sources, source.url) })} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableCard>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Questions</h2>
          {brief.questions.length === 0 ? <p className="text-sm text-muted-foreground">None found.</p> : null}
          <ul className="space-y-1">
            {brief.questions.map((question) => {
              const pinned = outline.questions.includes(question);
              return (
                <li key={question} data-testid="question-item" className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-1.5 text-sm">
                  <span>{question}</span>
                  <Button size="icon-sm" variant="ghost" data-testid="pin-question" aria-label={pinned ? "Unpin" : "Pin to brief"} onClick={() => change({ ...outline, questions: toggle(outline.questions, question) })}>
                    {pinned ? <PinOff /> : <Pin />}
                  </Button>
                </li>
              );
            })}
          </ul>
        </section>
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Topic terms</h2>
          <TableCard>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Term</TableHead>
                  <TableHead className="text-right">Pages</TableHead>
                  <TableHead className="text-right">Avg uses</TableHead>
                  <TableHead className="w-8">Cover</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {brief.terms.slice(0, 40).map((term) => (
                  <TableRow key={term.term} data-testid="term-row">
                    <TableCell>
                      {term.term}{" "}
                      {term.gap ? (
                        <Badge variant="info" size="sm" data-testid="gap-badge">
                          Gap
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {term.sources}/{usable.length}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{term.average}</TableCell>
                    <TableCell>
                      <Checkbox aria-label={`Cover ${term.term}`} checked={outline.terms.includes(term.term)} onCheckedChange={() => change({ ...outline, terms: toggle(outline.terms, term.term) })} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableCard>
        </section>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Outline</h2>
          <div className="flex items-center gap-2">
            {saved ? (
              <span data-testid="outline-saved" className="text-sm text-muted-foreground">
                Saved
              </span>
            ) : null}
            <Button
              data-testid="save-outline"
              disabled={!dirty}
              onClick={() => save().then(() => router.invalidate()).catch((error) => toast.error(messageOf(error)))}
            >
              Save outline
            </Button>
          </div>
        </div>
        <ol className="space-y-2">
          {sections.map((section, i) => (
            <li key={section.id} data-testid="outline-section" className="space-y-2 rounded-lg border border-border bg-card p-3">
              <div className="flex items-center gap-1">
                <Input
                  data-testid="section-heading"
                  aria-label="Heading"
                  placeholder="Heading"
                  value={section.heading}
                  onChange={(e) => change({ ...outline, sections: sections.map((s) => (s.id === section.id ? { ...s, heading: e.target.value } : s)) })}
                />
                <Button size="icon-sm" variant="ghost" data-testid="section-up" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                  <ArrowUp />
                </Button>
                <Button size="icon-sm" variant="ghost" aria-label="Move down" disabled={i === sections.length - 1} onClick={() => move(i, 1)}>
                  <ArrowDown />
                </Button>
                <Button size="icon-sm" variant="ghost" aria-label="Remove section" onClick={() => change({ ...outline, sections: sections.filter((s) => s.id !== section.id) })}>
                  <X />
                </Button>
              </div>
              <Textarea
                aria-label="Notes"
                placeholder="What this section covers"
                rows={2}
                value={section.notes}
                onChange={(e) => change({ ...outline, sections: sections.map((s) => (s.id === section.id ? { ...s, notes: e.target.value } : s)) })}
              />
            </li>
          ))}
        </ol>
        <Button variant="outline" data-testid="add-section" onClick={() => change({ ...outline, sections: [...sections, { id: crypto.randomUUID().slice(0, 8), heading: "", notes: "" }] })}>
          <Plus /> Add section
        </Button>
        {outline.questions.length ? (
          <div className="space-y-1">
            <h3 className="text-sm font-medium">Pinned questions</h3>
            <ul className="space-y-1 text-sm">
              {outline.questions.map((q) => (
                <li key={q} data-testid="pinned-question">
                  {q}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {outline.terms.length ? <p className="text-sm text-muted-foreground">Terms to cover: {outline.terms.join(", ")}</p> : null}
        {outline.sources.length ? <p className="text-sm text-muted-foreground">Sources to cite: {outline.sources.length}</p> : null}
      </section>

      {confirming ? (
        <ConfirmDialog
          title="Delete this brief?"
          confirmLabel="Delete"
          destructive
          onClose={() => setConfirming(false)}
          onConfirm={async () => {
            try {
              await deleteBrief({ data: { id: brief.id } });
              await navigate({ to: "/briefs" });
            } catch (error) {
              toast.error(messageOf(error));
            }
          }}
        >
          Documents written from it keep their text.
        </ConfirmDialog>
      ) : null}
    </AppShell>
  );
}
