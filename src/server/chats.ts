import { and, asc, desc, eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { extractText, getDocumentProxy } from "unpdf";
import { z } from "zod";
import { db } from "@/db";
import { attachments, chats, messages } from "@/db/schema";
import { SUBJECTS, SUBJECT_LABELS, type Subject } from "@/shared/subjects";
import { uploadProblem } from "@/shared/uploads";
import { complete, type AiSetup, type ModelMessage, type ModelPart } from "./ai";

const MAX_QUESTION = 8000;
const MAX_PDF_TEXT = 20000;
const TITLE_LENGTH = 60;

export const sendMessageInput = z.object({
  chatId: z.string().uuid().optional(),
  subject: z.enum(SUBJECTS).default("math"),
  text: z.string().max(MAX_QUESTION).default(""),
});
export const renameChatInput = z
  .object({ id: z.string().uuid(), title: z.string().trim().min(1, "Give the chat a title").max(120) })
  .strict();
export const chatIdInput = z.object({ id: z.string().uuid() }).strict();

export interface ChatSummary {
  id: string;
  title: string;
  subject: Subject;
  updatedAt: number;
}

export interface ThreadMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  attachment: { id: string; name: string; mime: string } | null;
}

/** The title a chat starts with: its first question, cut short. */
export function titleFrom(text: string, fallback: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (!flat) return fallback.slice(0, TITLE_LENGTH);
  return flat.length > TITLE_LENGTH ? `${flat.slice(0, TITLE_LENGTH).trimEnd()}…` : flat;
}

export function systemPrompt(subject: Subject): string {
  return [
    `You are a patient ${SUBJECT_LABELS[subject].toLowerCase()} tutor.`,
    "Solve the student's problem step by step: number the steps and explain each one briefly.",
    "Write all math in LaTeX between $...$ (inline) or $$...$$ (display).",
    "End with a line that starts with **Final answer:**.",
    "Answer follow-up questions using the earlier conversation.",
    "When a photo or document is attached, solve the problem it shows.",
    "Reply in the language the student writes in.",
  ].join(" ");
}

const summary = {
  id: chats.id,
  title: chats.title,
  subject: chats.subject,
  updatedAt: chats.updatedAt,
};

export async function listChats(ownerId: string): Promise<ChatSummary[]> {
  const rows = await db
    .select(summary)
    .from(chats)
    .where(eq(chats.ownerId, ownerId))
    .orderBy(desc(chats.updatedAt), desc(chats.createdAt));
  return rows.map((row) => ({ ...row, subject: row.subject as Subject }));
}

async function findChat(ownerId: string, chatId: string) {
  const [chat] = await db
    .select(summary)
    .from(chats)
    .where(and(eq(chats.id, chatId), eq(chats.ownerId, ownerId)));
  return chat ? { ...chat, subject: chat.subject as Subject } : null;
}

async function threadRows(ownerId: string, chatId: string) {
  return db
    .select({
      id: messages.id,
      role: messages.role,
      content: messages.content,
      attachmentId: attachments.id,
      attachmentName: attachments.name,
      attachmentMime: attachments.mime,
      attachmentKey: attachments.r2Key,
      attachmentText: attachments.text,
    })
    .from(messages)
    .leftJoin(
      attachments,
      and(eq(attachments.id, messages.attachmentId), eq(attachments.ownerId, ownerId)),
    )
    .where(and(eq(messages.chatId, chatId), eq(messages.ownerId, ownerId)))
    .orderBy(asc(messages.id));
}

/** The chat with its whole thread, or null when this member has no chat with the id. */
export async function getChat(ownerId: string, chatId: string) {
  const chat = await findChat(ownerId, chatId);
  if (!chat) return null;
  const rows = await threadRows(ownerId, chatId);
  const thread: ThreadMessage[] = rows.map((row) => ({
    id: row.id,
    role: row.role,
    content: row.content,
    attachment: row.attachmentId
      ? { id: row.attachmentId, name: row.attachmentName!, mime: row.attachmentMime! }
      : null,
  }));
  return { chat, messages: thread };
}

export type SendResult = { chatId: string } | { aiOff: AiSetup };

interface Upload {
  name: string;
  type: string;
  bytes: Uint8Array;
}

/**
 * Asks the model about a new question in a chat (a new chat when `chatId` is
 * absent). Nothing is saved unless the model answers.
 */
export async function sendMessage(
  owner: { id: string },
  input: z.infer<typeof sendMessageInput>,
  file: Upload | null,
): Promise<SendResult> {
  const text = input.text.trim();
  if (!text && !file) throw new Error("Type a question or attach a file.");
  if (file) {
    const problem = uploadProblem({ type: file.type, size: file.bytes.byteLength });
    if (problem) throw new Error(problem);
  }

  const existing = input.chatId ? await findChat(owner.id, input.chatId) : null;
  if (input.chatId && !existing) throw new Error("Chat not found");
  const subject = existing?.subject ?? input.subject;

  const history: ModelMessage[] = [];
  if (existing) {
    for (const row of await threadRows(owner.id, existing.id)) {
      history.push(
        row.role === "user"
          ? {
              role: "user",
              content: await userContent(row.content, row.attachmentKey
                ? { mime: row.attachmentMime!, key: row.attachmentKey, text: row.attachmentText, name: row.attachmentName! }
                : null),
            }
          : { role: "assistant", content: row.content },
      );
    }
  }

  const pdfText = file?.type === "application/pdf" ? await readPdf(file.bytes) : null;
  const newParts: ModelPart[] = [];
  if (text) newParts.push({ type: "text", text });
  if (file && pdfText !== null) newParts.push({ type: "text", text: pdfPart(file.name, pdfText) });
  if (file && pdfText === null) {
    newParts.push({ type: "image_url", image_url: { url: dataUrl(file.type, file.bytes) } });
  }
  if (!text) newParts.unshift({ type: "text", text: "Solve the problem in the attached file." });

  const answer = await complete([
    { role: "system", content: systemPrompt(subject) },
    ...history,
    { role: "user", content: newParts },
  ]);
  if ("aiOff" in answer) return answer;

  const now = Date.now();
  const chatId = existing?.id ?? crypto.randomUUID();
  const statements = [];
  if (!existing) {
    statements.push(
      db.insert(chats).values({
        id: chatId,
        ownerId: owner.id,
        title: titleFrom(text, file?.name ?? "Untitled"),
        subject,
        createdAt: now,
        updatedAt: now,
      }),
    );
  } else {
    statements.push(
      db.update(chats).set({ updatedAt: now }).where(and(eq(chats.id, chatId), eq(chats.ownerId, owner.id))),
    );
  }
  let attachmentId: string | null = null;
  if (file) {
    attachmentId = crypto.randomUUID();
    const key = `uploads/${owner.id}/${attachmentId}`;
    await env.uploads.put(key, file.bytes, { httpMetadata: { contentType: file.type } });
    statements.push(
      db.insert(attachments).values({
        id: attachmentId,
        ownerId: owner.id,
        chatId,
        r2Key: key,
        mime: file.type,
        name: file.name.slice(0, 200) || "file",
        size: file.bytes.byteLength,
        text: pdfText,
        createdAt: now,
      }),
    );
  }
  statements.push(
    db.insert(messages).values([
      { chatId, ownerId: owner.id, role: "user", content: text, attachmentId, createdAt: now },
      { chatId, ownerId: owner.id, role: "assistant", content: answer.text, createdAt: now },
    ]),
  );
  await db.batch(statements as [(typeof statements)[number], ...typeof statements]);
  return { chatId };
}

async function userContent(
  text: string,
  file: { mime: string; key: string; text: string | null; name: string } | null,
): Promise<string | ModelPart[]> {
  if (!file) return text;
  const parts: ModelPart[] = [{ type: "text", text: text || "Solve the problem in the attached file." }];
  if (file.mime === "application/pdf") {
    parts.push({ type: "text", text: pdfPart(file.name, file.text ?? "") });
    return parts;
  }
  const object = await env.uploads.get(file.key);
  if (object) {
    const bytes = new Uint8Array(await object.arrayBuffer());
    parts.push({ type: "image_url", image_url: { url: dataUrl(file.mime, bytes) } });
  }
  return parts;
}

function pdfPart(name: string, text: string): string {
  return `Text of the attached PDF (${name}):\n\n${text}`;
}

async function readPdf(bytes: Uint8Array): Promise<string> {
  let text: string;
  try {
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    const result = await extractText(pdf, { mergePages: true });
    text = result.text;
  } catch {
    throw new Error("That PDF couldn't be read.");
  }
  text = text.trim();
  if (!text) throw new Error("That PDF has no text to read. Attach a photo of the page instead.");
  return text.slice(0, MAX_PDF_TEXT);
}

function dataUrl(mime: string, bytes: Uint8Array): string {
  let binary = "";
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode(...bytes.subarray(i, i + step));
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

export async function renameChat(ownerId: string, { id, title }: z.infer<typeof renameChatInput>) {
  const [chat] = await db
    .update(chats)
    .set({ title })
    .where(and(eq(chats.id, id), eq(chats.ownerId, ownerId)))
    .returning({ id: chats.id, title: chats.title });
  return chat ?? null;
}

/** Deletes the chat, its messages and its files. False when this member has no chat with the id. */
export async function deleteChat(ownerId: string, { id }: z.infer<typeof chatIdInput>) {
  const chat = await findChat(ownerId, id);
  if (!chat) return false;
  const files = await db
    .select({ key: attachments.r2Key })
    .from(attachments)
    .where(and(eq(attachments.chatId, id), eq(attachments.ownerId, ownerId)));
  await db.batch([
    db.delete(messages).where(and(eq(messages.chatId, id), eq(messages.ownerId, ownerId))),
    db.delete(attachments).where(and(eq(attachments.chatId, id), eq(attachments.ownerId, ownerId))),
    db.delete(chats).where(and(eq(chats.id, id), eq(chats.ownerId, ownerId))),
  ]);
  if (files.length) await env.uploads.delete(files.map((file) => file.key));
  return true;
}

/** A stored file, only for the member who uploaded it. */
export async function getFile(ownerId: string, fileId: string) {
  const [file] = await db
    .select({ key: attachments.r2Key, mime: attachments.mime, name: attachments.name })
    .from(attachments)
    .where(and(eq(attachments.id, fileId), eq(attachments.ownerId, ownerId)));
  if (!file) return null;
  const object = await env.uploads.get(file.key);
  return object ? { ...file, object } : null;
}
