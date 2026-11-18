import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/client/components/AppShell";
import { EmptyState } from "@/client/components/EmptyState";
import { Field } from "@/client/components/Field";
import { PageHeader } from "@/client/components/PageHeader";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Button } from "@/client/components/ui/button";
import { Card, CardContent } from "@/client/components/ui/card";
import { Input } from "@/client/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/client/components/ui/native-select";
import { Table, TableBody, TableCard, TableCell, TableHead, TableHeader, TableRow } from "@/client/components/ui/table";
import { Textarea } from "@/client/components/ui/textarea";
import { messageOf } from "@/client/lib/errors";
import { COUNTRIES, countryName, LANGUAGES, languageName } from "@/shared/locales";
import { createBrief, getBriefs } from "@/serverFunctions/briefs";

export const Route = createFileRoute("/briefs/")({
  loader: () => getBriefs(),
  head: () => ({ meta: [{ title: "Briefs" }] }),
  component: BriefsPage,
});

function BriefsPage() {
  const { briefs, sites, searchReady } = Route.useLoaderData();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [language, setLanguage] = useState("en");
  const [country, setCountry] = useState("US");
  const [siteId, setSiteId] = useState("");
  const [urls, setUrls] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <AppShell>
      <PageHeader title="Briefs" />
      <Card>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={async (event) => {
              event.preventDefault();
              setPending(true);
              setError(null);
              try {
                const list = urls.split(/\s+/).map((u) => u.trim()).filter(Boolean);
                const { id } = await createBrief({ data: { query, language, country, siteId: siteId || null, urls: list } });
                await navigate({ to: "/briefs/$briefId", params: { briefId: id } });
              } catch (cause) {
                setError(messageOf(cause));
                setPending(false);
              }
            }}
          >
            <Field label="Search query" htmlFor="brief-query">
              <Input id="brief-query" data-testid="brief-query" required placeholder="how to make cold brew" value={query} onChange={(e) => setQuery(e.target.value)} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Language" htmlFor="brief-language">
                <NativeSelect id="brief-language" data-testid="brief-language" className="w-full" value={language} onChange={(e) => setLanguage(e.target.value)}>
                  {LANGUAGES.map((l) => (
                    <NativeSelectOption key={l.code} value={l.code}>
                      {l.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Country" htmlFor="brief-country">
                <NativeSelect id="brief-country" data-testid="brief-country" className="w-full" value={country} onChange={(e) => setCountry(e.target.value)}>
                  {COUNTRIES.map((c) => (
                    <NativeSelectOption key={c.code} value={c.code}>
                      {c.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Site" htmlFor="brief-site">
                <NativeSelect
                  id="brief-site"
                  data-testid="brief-site"
                  className="w-full"
                  value={siteId}
                  onChange={(e) => {
                    setSiteId(e.target.value);
                    const site = sites.find((s) => s.id === e.target.value);
                    if (site) {
                      setLanguage(site.language);
                      setCountry(site.country);
                    }
                  }}
                >
                  <NativeSelectOption value="">None</NativeSelectOption>
                  {sites.map((s) => (
                    <NativeSelectOption key={s.id} value={s.id}>
                      {s.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
            </div>
            <Field label={searchReady ? "Result URLs (optional, one per line)" : "Result URLs, one per line"} htmlFor="brief-urls">
              <Textarea id="brief-urls" data-testid="brief-urls" rows={3} placeholder="https://" value={urls} onChange={(e) => setUrls(e.target.value)} />
            </Field>
            {!searchReady ? (
              <p data-testid="search-data-off" className="text-sm text-muted-foreground">
                Search data isn't set up, so paste the pages that rank for the query.
              </p>
            ) : null}
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            <Button type="submit" data-testid="brief-create" disabled={pending}>
              {pending ? "Reading pages…" : "Research"}
            </Button>
          </form>
        </CardContent>
      </Card>
      {briefs.length === 0 ? (
        <EmptyState title="No briefs yet" description="A brief compares the pages that rank for a query and becomes the outline you write from." />
      ) : (
        <TableCard>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Query</TableHead>
                <TableHead>Market</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {briefs.map((brief) => (
                <TableRow key={brief.id} data-testid="brief-row">
                  <TableCell>
                    <Link to="/briefs/$briefId" params={{ briefId: brief.id }} className="font-medium hover:underline">
                      {brief.query}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {languageName(brief.language)}, {countryName(brief.country)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{brief.createdAt.slice(0, 10)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableCard>
      )}
    </AppShell>
  );
}
