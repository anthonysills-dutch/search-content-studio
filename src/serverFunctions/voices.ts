import { createServerFn } from "@tanstack/react-start";
import * as voices from "@/server/voices";
import { memberMiddleware } from "./member";

export const getVoices = createServerFn()
  .middleware([memberMiddleware])
  .handler(({ context: { user } }) => voices.listVoices(user.id));

export const createVoice = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((data: unknown) => voices.voiceInput.parse(data))
  .handler(({ data, context: { user } }) => voices.createVoice(user.id, data));

export const updateVoice = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((data: unknown) => voices.updateVoiceInput.parse(data))
  .handler(({ data, context: { user } }) => voices.updateVoice(user.id, data));

export const makeDefaultVoice = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((data: unknown) => voices.idInput.parse(data))
  .handler(({ data, context: { user } }) => voices.makeDefault(user.id, data.id));

export const deleteVoice = createServerFn({ method: "POST" })
  .middleware([memberMiddleware])
  .validator((data: unknown) => voices.idInput.parse(data))
  .handler(({ data, context: { user } }) => voices.deleteVoice(user.id, data.id));
