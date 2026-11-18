import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Mic, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/client/components/AppShell";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { EmptyState } from "@/client/components/EmptyState";
import { Field } from "@/client/components/Field";
import { PageHeader } from "@/client/components/PageHeader";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/client/components/ui/card";
import { Checkbox } from "@/client/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/client/components/ui/dialog";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/client/components/ui/native-select";
import { Textarea } from "@/client/components/ui/textarea";
import { messageOf } from "@/client/lib/errors";
import { createVoice, deleteVoice, getVoices, makeDefaultVoice, updateVoice } from "@/serverFunctions/voices";

export const Route = createFileRoute("/voices")({
  loader: () => getVoices(),
  head: () => ({ meta: [{ title: "Voice profiles" }] }),
  component: VoicesPage,
});

const FORMALITIES = ["casual", "conversational", "neutral", "professional", "formal"] as const;
type Voice = Awaited<ReturnType<typeof getVoices>>[number];
type Values = Omit<Voice, "id" | "ownerId" | "createdAt">;
const BLANK: Values = { name: "", tone: "", formality: "neutral", audience: "", context: "", samples: "", preferredWords: "", bannedWords: "", isDefault: false };

function VoicesPage() {
  const voices = Route.useLoaderData();
  const router = useRouter();
  const [editing, setEditing] = useState<{ id: string | null; values: Values } | null>(null);
  const [removing, setRemoving] = useState<Voice | null>(null);
  async function act(work: () => Promise<unknown>) {
    try {
      await work();
      await router.invalidate();
      return true;
    } catch (error) {
      toast.error(messageOf(error));
      return false;
    }
  }
  const addButton = (
    <Button data-testid="add-voice" onClick={() => setEditing({ id: null, values: { ...BLANK, isDefault: voices.length === 0 } })}>
      <Plus /> Add voice
    </Button>
  );
  return (
    <AppShell>
      <PageHeader title="Voice profiles" actions={voices.length ? addButton : null} />
      {voices.length === 0 ? (
        <EmptyState icon={Mic} title="No voice profiles yet" description="AI drafting writes in the profile assigned to a document or its site, or in your default." action={addButton} />
      ) : (
        <div className="space-y-3">
          {voices.map((voice) => (
            <Card key={voice.id} size="sm" data-testid="voice-row">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {voice.name}
                  {voice.isDefault ? <Badge variant="soft">Default</Badge> : null}
                </CardTitle>
                <CardDescription>
                  {[voice.tone, voice.formality, voice.audience].filter(Boolean).join(" · ")}
                </CardDescription>
                <CardAction className="flex gap-1">
                  {!voice.isDefault ? (
                    <Button size="sm" variant="ghost" data-testid="voice-make-default" onClick={() => act(() => makeDefaultVoice({ data: { id: voice.id } }))}>
                      Make default
                    </Button>
                  ) : null}
                  <Button size="sm" variant="outline" onClick={() => setEditing({ id: voice.id, values: { ...voice } })}>
                    Edit
                  </Button>
                  <Button size="icon-sm" variant="ghost" aria-label={`Delete ${voice.name}`} onClick={() => setRemoving(voice)}>
                    <Trash2 />
                  </Button>
                </CardAction>
              </CardHeader>
              {voice.bannedWords || voice.preferredWords ? (
                <CardContent className="space-y-1 text-xs text-muted-foreground">
                  {voice.preferredWords ? <p>Prefers: {voice.preferredWords}</p> : null}
                  {voice.bannedWords ? <p>Never: {voice.bannedWords}</p> : null}
                </CardContent>
              ) : null}
            </Card>
          ))}
        </div>
      )}
      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit voice profile" : "Add voice profile"}</DialogTitle>
          </DialogHeader>
          {editing ? (
            <VoiceForm
              initial={editing.values}
              onSubmit={async (values) => {
                const ok = await act(() => (editing.id ? updateVoice({ data: { id: editing.id, ...values } }) : createVoice({ data: values })));
                if (ok) setEditing(null);
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
      {removing ? (
        <ConfirmDialog
          title={`Delete ${removing.name}?`}
          confirmLabel="Delete"
          destructive
          onClose={() => setRemoving(null)}
          onConfirm={async () => {
            await act(() => deleteVoice({ data: { id: removing.id } }));
            setRemoving(null);
          }}
        >
          Sites and documents using it switch to your default.
        </ConfirmDialog>
      ) : null}
    </AppShell>
  );
}

function VoiceForm({ initial, onSubmit }: { initial: Values; onSubmit: (values: Values) => Promise<void> }) {
  const [values, setValues] = useState(initial);
  const [pending, setPending] = useState(false);
  const set = (change: Partial<Values>) => setValues((v) => ({ ...v, ...change }));
  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        await onSubmit(values);
        setPending(false);
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="voice-name">
          <Input id="voice-name" data-testid="voice-name" required value={values.name} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <Field label="Formality" htmlFor="voice-formality">
          <NativeSelect id="voice-formality" data-testid="voice-formality" className="w-full" value={values.formality} onChange={(e) => set({ formality: e.target.value })}>
            {FORMALITIES.map((f) => (
              <NativeSelectOption key={f} value={f}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Tone" htmlFor="voice-tone">
          <Input id="voice-tone" data-testid="voice-tone" placeholder="Warm, direct, a little playful" value={values.tone} onChange={(e) => set({ tone: e.target.value })} />
        </Field>
        <Field label="Audience" htmlFor="voice-audience">
          <Input id="voice-audience" data-testid="voice-audience" value={values.audience} onChange={(e) => set({ audience: e.target.value })} />
        </Field>
      </div>
      <Field label="Brand context" htmlFor="voice-context">
        <Textarea id="voice-context" data-testid="voice-context" rows={2} value={values.context} onChange={(e) => set({ context: e.target.value })} />
      </Field>
      <Field label="Writing samples" htmlFor="voice-samples">
        <Textarea id="voice-samples" data-testid="voice-samples" rows={4} value={values.samples} onChange={(e) => set({ samples: e.target.value })} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Preferred words, comma-separated" htmlFor="voice-preferred">
          <Input id="voice-preferred" data-testid="voice-preferred" value={values.preferredWords} onChange={(e) => set({ preferredWords: e.target.value })} />
        </Field>
        <Field label="Banned words, comma-separated" htmlFor="voice-banned">
          <Input id="voice-banned" data-testid="voice-banned" value={values.bannedWords} onChange={(e) => set({ bannedWords: e.target.value })} />
        </Field>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="voice-default" data-testid="voice-default" checked={values.isDefault} onCheckedChange={(checked) => set({ isDefault: checked === true })} />
        <Label htmlFor="voice-default">Default profile</Label>
      </div>
      <Button type="submit" data-testid="voice-save" disabled={pending}>
        Save
      </Button>
    </form>
  );
}
