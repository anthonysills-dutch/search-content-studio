import { useState } from "react";
import { Field } from "@/client/components/Field";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/client/components/ui/native-select";
import { COUNTRIES, LANGUAGES } from "@/shared/locales";

export interface SiteValues {
  name: string;
  domain: string;
  brandName: string;
  language: string;
  country: string;
  voiceProfileId: string | null;
}

export function SiteForm({
  initial,
  voices,
  submitLabel,
  onSubmit,
}: {
  initial?: SiteValues;
  voices: { id: string; name: string }[];
  submitLabel: string;
  onSubmit: (values: SiteValues) => Promise<void>;
}) {
  const [values, setValues] = useState<SiteValues>(initial ?? { name: "", domain: "", brandName: "", language: "en", country: "US", voiceProfileId: null });
  const [pending, setPending] = useState(false);
  const set = (change: Partial<SiteValues>) => setValues((v) => ({ ...v, ...change }));
  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        try {
          await onSubmit(values);
        } finally {
          setPending(false);
        }
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="site-name">
          <Input id="site-name" data-testid="site-name" required value={values.name} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <Field label="Domain" htmlFor="site-domain">
          <Input id="site-domain" data-testid="site-domain" required placeholder="example.com" value={values.domain} onChange={(e) => set({ domain: e.target.value })} />
        </Field>
        <Field label="Brand name in AI answers" htmlFor="site-brand">
          <Input id="site-brand" data-testid="site-brand" required value={values.brandName} onChange={(e) => set({ brandName: e.target.value })} />
        </Field>
        <Field label="Voice profile" htmlFor="site-voice">
          <NativeSelect id="site-voice" data-testid="site-voice" className="w-full" value={values.voiceProfileId ?? ""} onChange={(e) => set({ voiceProfileId: e.target.value || null })}>
            <NativeSelectOption value="">Your default</NativeSelectOption>
            {voices.map((v) => (
              <NativeSelectOption key={v.id} value={v.id}>
                {v.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Language" htmlFor="site-language">
          <NativeSelect id="site-language" data-testid="site-language" className="w-full" value={values.language} onChange={(e) => set({ language: e.target.value })}>
            {LANGUAGES.map((l) => (
              <NativeSelectOption key={l.code} value={l.code}>
                {l.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Country" htmlFor="site-country">
          <NativeSelect id="site-country" data-testid="site-country" className="w-full" value={values.country} onChange={(e) => set({ country: e.target.value })}>
            {COUNTRIES.map((c) => (
              <NativeSelectOption key={c.code} value={c.code}>
                {c.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
      </div>
      <Button type="submit" data-testid="site-save" disabled={pending}>
        {submitLabel}
      </Button>
    </form>
  );
}
