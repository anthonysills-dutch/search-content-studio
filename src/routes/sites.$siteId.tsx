import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { Play, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/client/components/AppShell";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { ScoreBars } from "@/client/components/ScoreBars";
import { SiteForm } from "@/client/components/SiteForm";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/client/components/ui/card";
import { Input } from "@/client/components/ui/input";
import { Table, TableBody, TableCard, TableCell, TableHead, TableHeader, TableRow } from "@/client/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/client/components/ui/tabs";
import { messageOf, orNotFound } from "@/client/lib/errors";
import { addPrompt, deletePrompt, deleteSite, getSitePage, recheckAi, runVisibility, startAudit, updateSite } from "@/serverFunctions/sites";

export const Route = createFileRoute("/sites/$siteId")({
  loader: ({ params }) => orNotFound(() => getSitePage({ data: { id: params.siteId } })),
  head: ({ loaderData }) => ({ meta: loaderData ? [{ title: loaderData.site.name }] : [] }),
  component: SitePage,
});

const STATUS: Record<string, { label: string; variant: "secondary" | "info" | "success" | "destructive" }> = {
  queued: { label: "Queued", variant: "secondary" },
  running: { label: "Running", variant: "info" },
  done: { label: "Done", variant: "success" },
  failed: { label: "Failed", variant: "destructive" },
};

function when(value: string) {
  return new Date(value.includes("T") ? value : `${value.replace(" ", "T")}Z`).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function SitePage() {
  const data = Route.useLoaderData();
  const { site } = data;
  const router = useRouter();
  const [waitingSince, setWaitingSince] = useState<string | null>(null);
  const auditActive = data.audits.some((a) => a.status === "queued" || a.status === "running");
  const visibilityPending = waitingSince !== null && (data.visibility.lastChecked ?? "") <= waitingSince;

  useEffect(() => {
    if (!auditActive && !visibilityPending) return;
    const timer = setInterval(() => void router.invalidate(), 1500);
    const stop = setTimeout(() => setWaitingSince(null), 120_000);
    return () => {
      clearInterval(timer);
      clearTimeout(stop);
    };
  }, [auditActive, visibilityPending, router]);

  async function act(work: () => Promise<unknown>) {
    try {
      await work();
      await router.invalidate();
    } catch (error) {
      toast.error(messageOf(error));
    }
  }

  return (
    <AppShell>
      <PageHeader title={site.name} description={`${site.origin.replace(/^https:\/\//, "")} · ${site.brandName}`} />
      <Tabs defaultValue="audits">
        <TabsList>
          <TabsTrigger value="audits">Audits</TabsTrigger>
          <TabsTrigger value="visibility">AI visibility</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>
        <TabsContent value="audits" className="space-y-4 pt-4">
          <div className="flex items-center justify-between gap-3">
            <ScoreBars
              label="Health score by audit"
              testId="health-trend-bar"
              points={[...data.audits].reverse().filter((a) => a.status === "done").map((a) => ({ key: a.id, value: a.healthScore ?? 0, title: `${a.healthScore} on ${when(a.createdAt)}` }))}
            />
            <Button data-testid="run-audit" disabled={auditActive} onClick={() => act(() => startAudit({ data: { siteId: site.id } }))}>
              <Play /> Run audit
            </Button>
          </div>
          {data.audits.length === 0 ? (
            <EmptyState title="No audits yet" description="An audit crawls the site and lists what to fix, most important first." />
          ) : (
            <TableCard>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Started</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Pages</TableHead>
                    <TableHead className="text-right">Health</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.audits.map((audit) => (
                    <TableRow key={audit.id} data-testid="audit-row">
                      <TableCell>
                        <Link to="/audits/$auditId" params={{ auditId: audit.id }} className="font-medium hover:underline">
                          {when(audit.createdAt)}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS[audit.status]?.variant ?? "secondary"}>{STATUS[audit.status]?.label ?? audit.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{audit.status === "done" ? audit.pagesChecked : "–"}</TableCell>
                      <TableCell className="text-right tabular-nums">{audit.healthScore ?? "–"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableCard>
          )}
        </TabsContent>
        <TabsContent value="visibility" className="space-y-4 pt-4">
          <Visibility data={data} act={act} pending={visibilityPending} onRun={() => setWaitingSince(new Date().toISOString().replace("T", " ").slice(0, 19))} />
        </TabsContent>
        <TabsContent value="details" className="pt-4">
          <Details data={data} />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

type PageData = Awaited<ReturnType<typeof getSitePage>>;

function Visibility({ data, act, pending, onRun }: { data: PageData; act: (work: () => Promise<unknown>) => Promise<void>; pending: boolean; onRun: () => void }) {
  const [text, setText] = useState("");
  const { visibility, ai, site } = data;
  return (
    <>
      {!ai.ready && (
        <Alert data-testid="ai-unavailable">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>{ai.message ?? "AI isn't set up on this workspace's Gateway."}</span>
            <Button size="sm" variant="outline" onClick={() => act(() => recheckAi())}>
              Check again
            </Button>
          </AlertDescription>
        </Alert>
      )}
      <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
        <Card size="sm">
          <CardHeader>
            <CardDescription>Visibility</CardDescription>
            <CardTitle className="text-3xl tabular-nums" data-testid="visibility-score">
              {visibility.score === null ? "–" : `${visibility.score}%`}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">of questions where {site.brandName} appears</CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>Daily trend</CardDescription>
          </CardHeader>
          <CardContent>
            {visibility.trend.length ? (
              <ScoreBars label="Visibility by day" testId="visibility-trend-bar" points={visibility.trend.map((p) => ({ key: p.day, value: p.score, title: `${p.score}% on ${p.day}` }))} />
            ) : (
              <p className="text-sm text-muted-foreground">Questions are checked every day.</p>
            )}
          </CardContent>
        </Card>
      </div>
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const value = text.trim();
          if (!value) return;
          void act(async () => {
            await addPrompt({ data: { siteId: site.id, text: value } });
            setText("");
          });
        }}
      >
        <Input data-testid="prompt-text" aria-label="Question" placeholder="A question buyers ask AI assistants" value={text} onChange={(e) => setText(e.target.value)} />
        <Button type="submit" variant="outline" data-testid="add-prompt">
          Add
        </Button>
        <Button
          type="button"
          data-testid="run-visibility"
          disabled={!ai.ready || pending || visibility.results.length === 0}
          onClick={() =>
            act(async () => {
              await runVisibility({ data: { siteId: site.id } });
              onRun();
            })
          }
        >
          <Play /> {pending ? "Checking…" : "Check now"}
        </Button>
      </form>
      {visibility.results.length === 0 ? (
        <EmptyState title="No questions yet" description="Add the questions buyers ask AI assistants about what you sell." />
      ) : (
        <div className="space-y-3">
          {visibility.results.map((result) => (
            <Card key={result.id} size="sm" data-testid="prompt-row">
              <CardHeader className="flex flex-row items-start justify-between gap-2">
                <CardTitle className="text-sm">{result.text}</CardTitle>
                <Button size="icon-sm" variant="ghost" aria-label="Delete question" onClick={() => act(() => deletePrompt({ data: { id: result.id } }))}>
                  <Trash2 />
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {result.models.length === 0 && result.errors.length === 0 ? <p className="text-sm text-muted-foreground">Not checked yet.</p> : null}
                {result.models.map((check) => (
                  <div key={check.id} data-testid="visibility-result" className="space-y-1 border-t border-border pt-2 first:border-t-0 first:pt-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-medium">{check.model}</span>
                      <Badge variant={check.mentioned ? "success" : "secondary"}>{check.mentioned ? "Mentioned" : "Not mentioned"}</Badge>
                      <Badge variant={check.cited ? "success" : "secondary"}>{check.cited ? "Cited" : "Not cited"}</Badge>
                      {check.position ? <Badge variant="outline">#{check.position} of brands named</Badge> : null}
                    </div>
                    {check.excerpt ? <p className="text-sm text-muted-foreground">{check.excerpt}</p> : null}
                  </div>
                ))}
                {result.errors.map((e) => (
                  <p key={e.model} className="text-xs text-destructive">
                    {e.model}: {e.error}
                  </p>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

function Details({ data }: { data: PageData }) {
  const { site, voices } = data;
  const router = useRouter();
  const navigate = useNavigate();
  const [saved, setSaved] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  return (
    <div className="space-y-8">
      <SiteForm
        initial={{ name: site.name, domain: site.origin, brandName: site.brandName, language: site.language, country: site.country, voiceProfileId: site.voiceProfileId }}
        voices={voices}
        submitLabel="Save"
        onSubmit={async (values) => {
          setSaved(false);
          try {
            await updateSite({ data: { id: site.id, ...values } });
            await router.invalidate();
            setSaved(true);
          } catch (error) {
            toast.error(messageOf(error));
          }
        }}
      />
      {saved ? (
        <p data-testid="site-saved" className="text-sm text-muted-foreground">
          Saved
        </p>
      ) : null}
      <div className="border-t border-border pt-6">
        <Button variant="destructive" data-testid="delete-site" onClick={() => setConfirming(true)}>
          <Trash2 /> Delete this site
        </Button>
      </div>
      {confirming ? (
        <ConfirmDialog
          title={`Delete ${site.name}?`}
          confirmLabel="Delete site"
          destructive
          pending={deleting}
          onClose={() => setConfirming(false)}
          onConfirm={async () => {
            setDeleting(true);
            try {
              await deleteSite({ data: { id: site.id } });
              await navigate({ to: "/sites" });
            } catch (error) {
              toast.error(messageOf(error));
              setDeleting(false);
              setConfirming(false);
            }
          }}
        >
          Its audits and tracked questions are deleted too.
        </ConfirmDialog>
      ) : null}
    </div>
  );
}
