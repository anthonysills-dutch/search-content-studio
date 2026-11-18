import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { useEffect } from "react";
import { AppShell } from "@/client/components/AppShell";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Badge } from "@/client/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/client/components/ui/card";
import { orNotFound } from "@/client/lib/errors";
import { getAudit } from "@/serverFunctions/sites";

export const Route = createFileRoute("/audits/$auditId")({
  loader: ({ params }) => orNotFound(() => getAudit({ data: { id: params.auditId } })),
  head: ({ loaderData }) => ({ meta: loaderData ? [{ title: `Audit of ${loaderData.site.name}` }] : [] }),
  component: AuditPage,
});

const SEVERITY = { high: "destructive", medium: "warning", low: "secondary" } as const;

function AuditPage() {
  const { audit, site, groups } = Route.useLoaderData();
  const router = useRouter();
  const active = audit.status === "queued" || audit.status === "running";
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => void router.invalidate(), 1500);
    return () => clearInterval(timer);
  }, [active, router]);
  const path = (url: string) => {
    try {
      const u = new URL(url);
      return u.origin === site.origin ? `${u.pathname}${u.search}` : url;
    } catch {
      return url;
    }
  };
  return (
    <AppShell>
      <PageHeader
        title={`Audit of ${site.name}`}
        description={new Date(audit.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
        backLink={
          <Link to="/sites/$siteId" params={{ siteId: site.id }} className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground">
            <ChevronLeft className="size-4" aria-hidden /> {site.name}
          </Link>
        }
      />
      {active ? <Alert><AlertDescription>The crawl is {audit.status}.</AlertDescription></Alert> : null}
      {audit.status === "failed" ? (
        <Alert variant="destructive">
          <AlertDescription>{audit.error}</AlertDescription>
        </Alert>
      ) : null}
      {audit.status === "done" ? (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Card size="sm">
              <CardHeader>
                <CardDescription>Health</CardDescription>
                <CardTitle className="text-3xl tabular-nums" data-testid="audit-health">
                  {audit.healthScore}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">out of 100</CardContent>
            </Card>
            <Card size="sm">
              <CardHeader>
                <CardDescription>Pages checked</CardDescription>
                <CardTitle className="text-3xl tabular-nums" data-testid="audit-pages">
                  {audit.pagesChecked}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card size="sm">
              <CardHeader>
                <CardDescription>Issue types</CardDescription>
                <CardTitle className="text-3xl tabular-nums">{groups.length}</CardTitle>
              </CardHeader>
            </Card>
          </div>
          {groups.length === 0 ? (
            <EmptyState title="No issues found" />
          ) : (
            <div className="space-y-3">
              {groups.map((group) => (
                <Card key={group.type} size="sm" data-testid="issue-group" data-issue-type={group.type}>
                  <CardHeader>
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle>{group.label}</CardTitle>
                      <Badge variant={SEVERITY[group.severity]}>{group.severity}</Badge>
                      <Badge variant="outline">
                        {group.pages.length} {group.pages.length === 1 ? "page" : "pages"}
                      </Badge>
                      <span className="ml-auto text-xs text-muted-foreground tabular-nums">+{group.impact} health if fixed</span>
                    </div>
                    <CardDescription>{group.fix}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-1 text-sm">
                      {group.pages.slice(0, 25).map((page) => (
                        <li key={page.url} className="flex flex-wrap justify-between gap-2">
                          <span className="min-w-0 truncate">{path(page.url)}</span>
                          {page.detail ? <span className="text-muted-foreground">{page.detail}</span> : null}
                        </li>
                      ))}
                      {group.pages.length > 25 ? <li className="text-muted-foreground">and {group.pages.length - 25} more</li> : null}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      ) : null}
    </AppShell>
  );
}
