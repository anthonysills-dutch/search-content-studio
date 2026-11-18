import { createServerFn } from "@tanstack/react-start";
import * as documents from "@/server/documents";
import { listBriefs } from "@/server/briefs";
import { draft, draftInput } from "@/server/drafting";
import { aiAvailability } from "@/server/ai";
import { listVoices } from "@/server/voices";
import { memberMiddleware } from "./member";

export const getDocuments = createServerFn()
  .middleware([memberMiddleware])
  .handler(async ({ context: { user } }) => {
    const [docs, briefs] = await Promise.all([documents.listDocuments(user.id), listBriefs(user.id)]);
    return { documents: docs, briefs: briefs.map((b) => ({ id: b.id, query: b.query })) };
  });

export const getEditor = createServerFn()
  .middleware([memberMiddleware])
  .validator((data: unknown) => documents.idInput.parse(data))
  .handler(async ({ data, context: { user } }) => {
    const [editor, voices, ai] = await Promise.all([documents.getDocument(user.id, data.id), listVoices(user.id), aiAvailability(user.orgId)]);
    return { ...editor, voices: voices.map((v) => ({ id: v.id, name: v.name })), ai };
  });

export const createDocument = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((data: unknown) => documents.createDocumentInput.parse(data))
  .handler(({ data, context: { user } }) => documents.createDocument(user.id, data));

export const saveDocument = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((data: unknown) => documents.saveDocumentInput.parse(data))
  .handler(({ data, context: { user } }) => documents.saveDocument(user.id, data));

export const setDocumentVoice = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((data: unknown) => documents.setVoiceInput.parse(data))
  .handler(({ data, context: { user } }) => documents.setDocumentVoice(user.id, data));

export const deleteDocument = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((data: unknown) => documents.idInput.parse(data))
  .handler(({ data, context: { user } }) => documents.deleteDocument(user.id, data.id));

export const draftWithAi = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((data: unknown) => draftInput.parse(data))
  .handler(({ data, context: { user } }) => draft(user.id, user.orgId, data));
