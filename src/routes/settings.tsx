import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/client/components/AppShell";
import { Field } from "@/client/components/Field";
import { PageHeader } from "@/client/components/PageHeader";
import { Button } from "@/client/components/ui/button";
import { Card, CardContent } from "@/client/components/ui/card";
import { Input } from "@/client/components/ui/input";
import { Textarea } from "@/client/components/ui/textarea";
import { messageOf } from "@/client/lib/errors";
import { getSettings, updateSettings } from "@/serverFunctions/settings";

export const Route = createFileRoute("/settings")({
  loader: () => getSettings(),
  head: () => ({ meta: [{ title: "Settings" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { settings, isAdmin } = Route.useLoaderData();
  const router = useRouter();
  const [cap, setCap] = useState(String(settings.auditPageCap));
  const [models, setModels] = useState(settings.visibilityModels.join("\n"));
  const [draftModel, setDraftModel] = useState(settings.draftModel);
  const [pending, setPending] = useState(false);
  return (
    <AppShell>
      <PageHeader title="Settings" description={isAdmin ? "These apply to everyone in the workspace." : "Only workspace admins can change these."} />
      <Card>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={async (event) => {
              event.preventDefault();
              setPending(true);
              try {
                await updateSettings({ data: { auditPageCap: Number(cap), visibilityModels: models.split(/[\s,]+/).filter(Boolean), draftModel: draftModel.trim() } });
                await router.invalidate();
                toast.success("Settings saved");
              } catch (error) {
                toast.error(messageOf(error));
              } finally {
                setPending(false);
              }
            }}
          >
            <Field label="Pages per audit" htmlFor="settings-page-cap">
              <Input id="settings-page-cap" data-testid="settings-page-cap" type="number" min={1} max={500} disabled={!isAdmin} value={cap} onChange={(e) => setCap(e.target.value)} className="max-w-32" />
            </Field>
            <Field label="Models asked for AI visibility, one per line" htmlFor="settings-models">
              <Textarea id="settings-models" data-testid="settings-models" rows={4} disabled={!isAdmin} value={models} onChange={(e) => setModels(e.target.value)} className="font-mono text-sm" />
            </Field>
            <Field label="Drafting model" htmlFor="settings-draft-model">
              <Input id="settings-draft-model" data-testid="settings-draft-model" disabled={!isAdmin} value={draftModel} onChange={(e) => setDraftModel(e.target.value)} className="font-mono text-sm" />
            </Field>
            {isAdmin ? (
              <Button type="submit" data-testid="settings-save" disabled={pending}>
                Save
              </Button>
            ) : null}
          </form>
        </CardContent>
      </Card>
    </AppShell>
  );
}
