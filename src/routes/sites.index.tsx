import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { Globe, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/client/components/AppShell";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { SiteForm } from "@/client/components/SiteForm";
import { Button } from "@/client/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/client/components/ui/dialog";
import { Table, TableBody, TableCard, TableCell, TableHead, TableHeader, TableRow } from "@/client/components/ui/table";
import { messageOf } from "@/client/lib/errors";
import { countryName, languageName } from "@/shared/locales";
import { createSite, getSites } from "@/serverFunctions/sites";

export const Route = createFileRoute("/sites/")({
  loader: () => getSites(),
  head: () => ({ meta: [{ title: "Sites" }] }),
  component: SitesPage,
});

function SitesPage() {
  const { sites, voices } = Route.useLoaderData();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const addButton = (
    <Button data-testid="add-site" onClick={() => setOpen(true)}>
      <Plus /> Add site
    </Button>
  );
  return (
    <AppShell>
      <PageHeader title="Sites" actions={sites.length ? addButton : null} />
      {sites.length === 0 ? (
        <EmptyState icon={Globe} title="No sites yet" description="Add a site to audit it and track whether AI answers mention it." action={addButton} />
      ) : (
        <TableCard>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Site</TableHead>
                <TableHead>Brand</TableHead>
                <TableHead>Market</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sites.map((site) => (
                <TableRow key={site.id} data-testid="site-row">
                  <TableCell>
                    <Link to="/sites/$siteId" params={{ siteId: site.id }} className="font-medium hover:underline">
                      {site.name}
                    </Link>
                    <div className="text-xs text-muted-foreground">{site.origin.replace(/^https:\/\//, "")}</div>
                  </TableCell>
                  <TableCell>{site.brandName}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {languageName(site.language)}, {countryName(site.country)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableCard>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Add site</DialogTitle>
          </DialogHeader>
          <SiteForm
            voices={voices}
            submitLabel="Add site"
            onSubmit={async (values) => {
              try {
                await createSite({ data: values });
                setOpen(false);
                await router.invalidate();
              } catch (error) {
                toast.error(messageOf(error));
              }
            }}
          />
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
