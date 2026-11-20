import { index, integer, sqliteTable, text, real } from "drizzle-orm/sqlite-core";

// Every row the app keeps belongs to one member: `ownerId` is the Gateway's
// user id, and every query filters by it.

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const chats = sqliteTable(
  "chats",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    title: text("title").notNull(),
    subject: text("subject").notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [index("chats_owner_updated").on(table.ownerId, table.updatedAt)],
);

export const attachments = sqliteTable(
  "attachments",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    chatId: text("chat_id").notNull(),
    r2Key: text("r2_key").notNull(),
    mime: text("mime").notNull(),
    name: text("name").notNull(),
    size: integer("size").notNull(),
    // Text pulled out of a PDF, sent to the model with the thread.
    text: text("text"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [index("attachments_chat").on(table.chatId)],
);

export const messages = sqliteTable(
  "messages",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    chatId: text("chat_id").notNull(),
    ownerId: text("owner_id").notNull(),
    role: text("role", { enum: ["user", "assistant"] }).notNull(),
    content: text("content").notNull(),
    attachmentId: text("attachment_id"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [index("messages_chat").on(table.chatId, table.id)],
);

export const tests = sqliteTable(
  "tests",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    title: text("title").notNull(),
    topic: text("topic").notNull(),
    subject: text("subject").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [index("tests_owner").on(table.ownerId, table.createdAt)],
);

export const testQuestions = sqliteTable(
  "test_questions",
  {
    id: text("id").primaryKey(),
    testId: text("test_id").notNull(),
    ownerId: text("owner_id").notNull(),
    position: integer("position").notNull(),
    prompt: text("prompt").notNull(),
    // JSON array of 3 or 4 option strings.
    options: text("options").notNull(),
    correctIndex: integer("correct_index").notNull(),
    steps: text("steps").notNull(),
    chosenIndex: integer("chosen_index"),
    answeredAt: integer("answered_at"),
  },
  (table) => [index("test_questions_test").on(table.testId, table.position)],
);

export const graphs = sqliteTable(
  "graphs",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    title: text("title").notNull(),
    // JSON array of expressions in x.
    expressions: text("expressions").notNull(),
    xMin: real("x_min").notNull(),
    xMax: real("x_max").notNull(),
    yMin: real("y_min").notNull(),
    yMax: real("y_max").notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [index("graphs_owner").on(table.ownerId, table.updatedAt)],
);
