import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { FileText, Plus } from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/client/components/AppShell";
import { EmptyState } from "@/client/components/EmptyState";
import { Field } from "@/client/components/Field";
import { PageHeader } from "@/client/components/PageHeader";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Button } from "@/client/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/client/components/ui/dialog";
import { Input } from "@/client/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/client/components/ui/native-select";
import { Table, TableBody, TableCard, TableCell, TableHead, TableHeader, TableRow } from "@/client/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/client/components/ui/tabs";
import { messageOf } from "@/client/lib/errors";
import { createDocument, getDocuments } from "@/serverFunctions/documents";

export const Route = createFileRoute("/")({
  loader: () => getDocuments(),
  head: () => ({ meta: [{ title: "Documents" }] }),
  component: DocumentsPage,
});

function DocumentsPage() {
  const { documents, briefs } = Route.useLoaderData();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState<"blank" | "brief" | "url">("blank");
  const [title, setTitle] = useState("");
  const [briefId, setBriefId] = useState("");
  const [url, setUrl] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const newButton = (
    <Button data-testid="new-doc" onClick={() => setOpen(true)}>
      <Plus /> New document
    </Button>
  );
  async function create() {
    setPending(true);
    setError(null);
    try {
      const data = from === "blank" ? { from, title } : from === "brief" ? { from, briefId } : { from, url };
      const { id } = await createDocument({ data });
      await navigate({ to: "/documents/$docId", params: { docId: id } });
    } catch (cause) {
      setError(messageOf(cause));
      setPending(false);
    }
  }
  return (
    <AppShell>
      <PageHeader title="Documents" actions={documents.length ? newButton : null} />
      {documents.length === 0 ? (
        <EmptyState icon={FileText} title="No documents yet" description="Start blank, from a brief, or by importing a published page to score it." action={newButton} />
      ) : (
        <TableCard>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead className="text-right">SEO</TableHead>
                <TableHead className="text-right">GEO</TableHead>
                <TableHead className="hidden sm:table-cell">Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((doc) => (
                <TableRow key={doc.id} data-testid="doc-row">
                  <TableCell className="max-w-xs whitespace-normal">
                    <Link to="/documents/$docId" params={{ docId: doc.id }} className="font-medium hover:underline">
                      {doc.title}
                    </Link>
                    {doc.briefQuery ? <div className="text-xs text-muted-foreground">Brief: {doc.briefQuery}</div> : null}
                  </TableCell>
                  <TableCell className="text-right tabular-nums" data-testid="doc-seo">
                    {doc.seoScore}
                  </TableCell>
                  <TableCell className="text-right tabular-nums" data-testid="doc-geo">
                    {doc.geoScore}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">{doc.updatedAt.slice(0, 10)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableCard>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New document</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void create();
            }}
          >
            <Tabs value={from} onValueChange={(value) => setFrom(value as typeof from)}>
              <TabsList>
                <TabsTrigger value="blank">Blank</TabsTrigger>
                <TabsTrigger value="brief">From brief</TabsTrigger>
                <TabsTrigger value="url">Import URL</TabsTrigger>
              </TabsList>
              <TabsContent value="blank" className="pt-3">
                <Field label="Title" htmlFor="doc-title">
                  <Input id="doc-title" data-testid="doc-title" required={from === "blank"} value={title} onChange={(e) => setTitle(e.target.value)} />
                </Field>
              </TabsContent>
              <TabsContent value="brief" className="pt-3">
                {briefs.length ? (
                  <Field label="Brief" htmlFor="doc-brief">
                    <NativeSelect id="doc-brief" data-testid="doc-brief" className="w-full" required={from === "brief"} value={briefId} onChange={(e) => setBriefId(e.target.value)}>
                      <NativeSelectOption value="">Choose a brief</NativeSelectOption>
                      {briefs.map((b) => (
                        <NativeSelectOption key={b.id} value={b.id}>
                          {b.query}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </Field>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No briefs yet. <Link to="/briefs" className="text-primary hover:underline">Research one</Link>.
                  </p>
                )}
              </TabsContent>
              <TabsContent value="url" className="pt-3">
                <Field label="Page URL" htmlFor="doc-import-url">
                  <Input id="doc-import-url" data-testid="doc-import-url" type="url" required={from === "url"} placeholder="https://" value={url} onChange={(e) => setUrl(e.target.value)} />
                </Field>
              </TabsContent>
            </Tabs>
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            <Button type="submit" data-testid="doc-create" disabled={pending}>
              Create
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
