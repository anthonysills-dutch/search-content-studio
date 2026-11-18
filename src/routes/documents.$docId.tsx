import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { Check, ChevronLeft, Download, Sparkles, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/client/components/AppShell";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { PageHeader } from "@/client/components/PageHeader";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/client/components/ui/card";
import { Input } from "@/client/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/client/components/ui/native-select";
import { Progress } from "@/client/components/ui/progress";
import { Textarea } from "@/client/components/ui/textarea";
import { messageOf, orNotFound } from "@/client/lib/errors";
import { markdownToHtml, replaceSection, sections } from "@/shared/markdown";
import { scoreDocument } from "@/shared/scoring";
import { deleteDocument, draftWithAi, getEditor, saveDocument, setDocumentVoice } from "@/serverFunctions/documents";
import { recheckAi } from "@/serverFunctions/sites";

export const Route = createFileRoute("/documents/$docId")({
  loader: ({ params }) => orNotFound(() => getEditor({ data: { id: params.docId } })),
  head: ({ loaderData }) => ({ meta: loaderData ? [{ title: loaderData.doc.title }] : [] }),
  component: EditorPage,
});

type Action = "outline" | "draft" | "expand" | "rewrite";
interface Proposal {
  action: Action;
  section: string | null;
  text: string;
  bannedMatches: string[];
}

function download(name: string, type: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function fileName(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "document";
}

function EditorPage() {
  const data = Route.useLoaderData();
  const { doc, scoring, voice, voices, ai, brief } = data;
  const router = useRouter();
  const navigate = useNavigate();
  const [title, setTitle] = useState(doc.title);
  const [body, setBody] = useState(doc.body);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [section, setSection] = useState("");
  const [instruction, setInstruction] = useState("");
  const [working, setWorking] = useState<Action | null>(null);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [confirming, setConfirming] = useState(false);
  const scores = useMemo(() => scoreDocument(body, scoring), [body, scoring]);
  const headings = sections(body).filter((s) => s.level >= 2);

  const edit = (next: string) => {
    setBody(next);
    setSaved(false);
  };

  async function generate(action: Action) {
    setWorking(action);
    try {
      const target = action === "expand" || action === "rewrite" ? section || null : null;
      const result = await draftWithAi({ data: { id: doc.id, action, body, section: target, instruction: action === "rewrite" ? instruction : null } });
      setProposal({ action, section: target, text: result.text, bannedMatches: result.bannedMatches });
    } catch (error) {
      toast.error(messageOf(error));
      await router.invalidate();
    } finally {
      setWorking(null);
    }
  }

  function accept() {
    if (!proposal) return;
    const target = proposal.section ? sections(body).find((s) => s.heading === proposal.section) : null;
    edit(target ? replaceSection(body, target, proposal.text) : proposal.text + "\n");
    setProposal(null);
  }

  return (
    <AppShell wide>
      <PageHeader
        title={
          <Input aria-label="Title" value={title} onChange={(e) => { setTitle(e.target.value); setSaved(false); }} className="h-auto border-none px-0 text-2xl font-semibold shadow-none focus-visible:ring-0 md:text-2xl dark:bg-transparent" />
        }
        backLink={
          <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground">
            <ChevronLeft className="size-4" aria-hidden /> Documents
          </Link>
        }
        description={brief ? <>Brief: <Link to="/briefs/$briefId" params={{ briefId: brief.id }} className="hover:underline">{brief.query}</Link></> : null}
        actions={
          <>
            {saved ? (
              <span data-testid="doc-saved" className="text-sm text-muted-foreground">
                Saved
              </span>
            ) : null}
            <Button variant="outline" size="sm" data-testid="export-md" onClick={() => download(`${fileName(title)}.md`, "text/markdown", body)}>
              <Download /> Markdown
            </Button>
            <Button variant="outline" size="sm" data-testid="export-html" onClick={() => download(`${fileName(title)}.html`, "text/html", markdownToHtml(body))}>
              <Download /> HTML
            </Button>
            <Button size="icon-sm" variant="ghost" aria-label="Delete document" onClick={() => setConfirming(true)}>
              <Trash2 />
            </Button>
            <Button
              size="sm"
              data-testid="doc-save"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                try {
                  await saveDocument({ data: { id: doc.id, title, body } });
                  setSaved(true);
                } catch (error) {
                  toast.error(messageOf(error));
                } finally {
                  setSaving(false);
                }
              }}
            >
              Save
            </Button>
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-4">
          {proposal ? (
            <Card data-testid="ai-proposal">
              <CardHeader>
                <CardTitle>
                  {proposal.action === "outline" ? "Proposed outline" : proposal.action === "draft" ? "Proposed draft" : proposal.action === "expand" ? `Expanded: ${proposal.section}` : `Rewrite${proposal.section ? `: ${proposal.section}` : ""}`}
                </CardTitle>
                {proposal.bannedMatches.length ? (
                  <CardDescription className="flex flex-wrap items-center gap-1 text-destructive">
                    Uses banned words:
                    {proposal.bannedMatches.map((word) => (
                      <Badge key={word} variant="destructive" data-testid="banned-match">
                        {word}
                      </Badge>
                    ))}
                  </CardDescription>
                ) : null}
              </CardHeader>
              <CardContent className="space-y-3">
                <pre className="max-h-80 overflow-y-auto rounded-md bg-muted p-3 text-sm whitespace-pre-wrap">{proposal.text}</pre>
                <div className="flex gap-2">
                  <Button size="sm" data-testid="ai-accept" onClick={accept}>
                    <Check /> {proposal.section ? "Replace section" : "Replace document"}
                  </Button>
                  <Button size="sm" variant="outline" data-testid="ai-discard" onClick={() => setProposal(null)}>
                    <X /> Discard
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}
          <Textarea
            data-testid="editor"
            aria-label="Document, in Markdown"
            className="min-h-[60dvh] font-mono text-sm"
            value={body}
            placeholder={"## A question your reader asks?\n\nAnswer it in the first sentence."}
            onChange={(e) => edit(e.target.value)}
          />
          <p className="text-xs text-muted-foreground tabular-nums">{scores.words} words</p>
        </div>
        <aside className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <ScoreCard label="SEO" value={scores.seo} testId="seo-score" />
            <ScoreCard label="GEO" value={scores.geo} testId="geo-score" />
          </div>
          <Card size="sm">
            <CardHeader>
              <CardTitle>Next changes</CardTitle>
            </CardHeader>
            <CardContent>
              {scores.suggestions.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing left to fix.</p>
              ) : (
                <ol className="space-y-2 text-sm">
                  {scores.suggestions.slice(0, 8).map((s) => (
                    <li key={s.text} data-testid="suggestion-item" className="flex justify-between gap-2">
                      <span>{s.text}</span>
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                        {s.score} +{s.gain}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
          {scores.missingTerms.length ? (
            <Card size="sm">
              <CardHeader>
                <CardTitle>Missing terms</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1 text-sm">
                  {scores.missingTerms.slice(0, 15).map((t) => (
                    <li key={t.term} data-testid="missing-term" className="flex justify-between gap-2">
                      <span>{t.term}</span>
                      <span className="text-muted-foreground tabular-nums">
                        {t.used}/{t.target}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
          <Card size="sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="size-4" /> AI drafting
              </CardTitle>
              <CardDescription data-testid="active-voice">
                {voice ? `Voice: ${voice.name}${voice.from === "site" ? " (from the site)" : voice.from === "default" ? " (default)" : ""}` : "No voice profile"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <NativeSelect
                aria-label="Voice profile for this document"
                data-testid="doc-voice"
                className="w-full"
                value={voice?.assigned ? voice.id : ""}
                onChange={async (e) => {
                  try {
                    await setDocumentVoice({ data: { id: doc.id, voiceProfileId: e.target.value || null } });
                    await router.invalidate();
                  } catch (error) {
                    toast.error(messageOf(error));
                  }
                }}
              >
                <NativeSelectOption value="">Site or default voice</NativeSelectOption>
                {voices.map((v) => (
                  <NativeSelectOption key={v.id} value={v.id}>
                    {v.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              {!ai.ready ? (
                <Alert data-testid="ai-unavailable">
                  <AlertDescription className="space-y-2">
                    <p>{ai.message ?? "AI isn't set up on this workspace's Gateway."}</p>
                    <Button size="sm" variant="outline" onClick={() => recheckAi().then(() => router.invalidate())}>
                      Check again
                    </Button>
                  </AlertDescription>
                </Alert>
              ) : null}
              <div className="grid grid-cols-2 gap-2">
                <Button size="sm" variant="outline" data-testid="ai-outline" disabled={!ai.ready || working !== null} onClick={() => generate("outline")}>
                  {working === "outline" ? "Writing…" : "Outline"}
                </Button>
                <Button size="sm" variant="outline" data-testid="ai-draft" disabled={!ai.ready || working !== null} onClick={() => generate("draft")}>
                  {working === "draft" ? "Writing…" : "Full draft"}
                </Button>
              </div>
              <NativeSelect aria-label="Section" data-testid="ai-section" className="w-full" value={section} onChange={(e) => setSection(e.target.value)}>
                <NativeSelectOption value="">Whole document</NativeSelectOption>
                {headings.map((h, i) => (
                  <NativeSelectOption key={`${h.heading}-${i}`} value={h.heading}>
                    {h.heading}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <Button size="sm" variant="outline" className="w-full" data-testid="ai-expand" disabled={!ai.ready || working !== null || !section} onClick={() => generate("expand")}>
                {working === "expand" ? "Writing…" : "Expand section"}
              </Button>
              <div className="flex gap-2">
                <Input aria-label="Rewrite instruction" data-testid="ai-instruction" placeholder="Make it shorter" value={instruction} onChange={(e) => setInstruction(e.target.value)} />
                <Button size="sm" variant="outline" data-testid="ai-rewrite" disabled={!ai.ready || working !== null || !instruction.trim()} onClick={() => generate("rewrite")}>
                  {working === "rewrite" ? "Writing…" : "Rewrite"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
      {confirming ? (
        <ConfirmDialog
          title="Delete this document?"
          confirmLabel="Delete"
          destructive
          onClose={() => setConfirming(false)}
          onConfirm={async () => {
            await deleteDocument({ data: { id: doc.id } });
            await navigate({ to: "/" });
          }}
        />
      ) : null}
    </AppShell>
  );
}

function ScoreCard({ label, value, testId }: { label: string; value: number; testId: string }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl tabular-nums" data-testid={testId}>
          {value}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Progress value={value} aria-label={`${label} score`} />
      </CardContent>
    </Card>
  );
}
