import { createServerFn } from "@tanstack/react-start";
import { ensureUserMiddleware } from "@every-app/sdk/tanstack-start";
import { z } from "zod";
import * as chats from "@/server/chats";
import { ensureUser } from "@/server/users";

export const listChats = createServerFn()
  .middleware([ensureUserMiddleware])
  .handler(async ({ context }) => {
    await ensureUser(context.user);
    return chats.listChats(context.user.id);
  });

export const getChat = createServerFn()
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => z.string().uuid().parse(data))
  .handler(({ data, context }) => chats.getChat(context.user.id, data));

export const sendMessage = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => {
    if (!(data instanceof FormData)) throw new Error("Expected a form");
    const file = data.get("file");
    const input = chats.sendMessageInput.parse({
      chatId: data.get("chatId") || undefined,
      subject: data.get("subject") || undefined,
      text: data.get("text") ?? "",
    });
    return { input, file: file instanceof File && file.size > 0 ? file : null };
  })
  .handler(async ({ data, context }) => {
    await ensureUser(context.user);
    const file = data.file
      ? {
          name: data.file.name,
          type: data.file.type,
          bytes: new Uint8Array(await data.file.arrayBuffer()),
        }
      : null;
    return chats.sendMessage(context.user, data.input, file);
  });

export const renameChat = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => chats.renameChatInput.parse(data))
  .handler(async ({ data, context }) => {
    const chat = await chats.renameChat(context.user.id, data);
    if (!chat) throw new Error("Chat not found");
    return chat;
  });

export const deleteChat = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => chats.chatIdInput.parse(data))
  .handler(async ({ data, context }) => {
    if (!(await chats.deleteChat(context.user.id, data))) throw new Error("Chat not found");
    return { ok: true };
  });
