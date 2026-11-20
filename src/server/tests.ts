import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { testQuestions, tests } from "@/db/schema";
import { SUBJECTS, SUBJECT_LABELS, type Subject } from "@/shared/subjects";

export const createTestInput = z
  .object({
    topic: z.string().trim().min(1, "Enter a topic").max(300),
    subject: z.enum(SUBJECTS),
    count: z.coerce.number().int().min(3, "Pick 3 to 10 questions").max(10, "Pick 3 to 10 questions"),
  })
  .strict();
export const testIdInput = z.object({ id: z.string().uuid() }).strict();
export const answerInput = z
  .object({ questionId: z.string().uuid(), choice: z.number().int().min(0).max(3) })
  .strict();

const generatedTest = z.object({
  title: z.string().trim().min(1).max(200),
  questions: z
    .array(
      z.object({
        question: z.string().trim().min(1).max(2000),
        options: z.array(z.string().trim().min(1).max(500)).min(3).max(4),
        answer: z.number().int().min(0),
        steps: z.string().trim().min(1).max(6000),
      }).refine((q) => q.answer < q.options.length),
    )
    .min(1),
});
export type GeneratedTest = z.infer<typeof generatedTest>;

export function testPrompt(subject: Subject): string {
  return [
    `You write multiple-choice practice tests for ${SUBJECT_LABELS[subject].toLowerCase()} students.`,
    "Reply with JSON only, no other text, in this shape:",
    '{"title": string, "questions": [{"question": string, "options": [string, ...], "answer": number, "steps": string}]}.',
    "Each question has 3 or 4 options, exactly one of them right; answer is the 0-based index of the right option.",
    "steps is a short worked solution. Write math in LaTeX between $...$.",
  ].join(" ");
}

export function testRequest(topic: string, count: number): string {
  return `Write ${count} questions.\nTopic: ${topic}`;
}

/** The model's test, checked against the shape asked for, or null. */
export function parseGeneratedTest(text: string, count: number): GeneratedTest | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  const parsed = generatedTest.safeParse(raw);
  if (!parsed.success || parsed.data.questions.length < count) return null;
  return { ...parsed.data, questions: parsed.data.questions.slice(0, count) };
}

export async function saveTest(
  ownerId: string,
  input: z.infer<typeof createTestInput>,
  generated: GeneratedTest,
): Promise<string> {
  const id = crypto.randomUUID();
  await db.batch([
    db.insert(tests).values({
      id,
      ownerId,
      title: generated.title,
      topic: input.topic,
      subject: input.subject,
      createdAt: Date.now(),
    }),
    db.insert(testQuestions).values(
      generated.questions.map((q, position) => ({
        id: crypto.randomUUID(),
        testId: id,
        ownerId,
        position,
        prompt: q.question,
        options: JSON.stringify(q.options),
        correctIndex: q.answer,
        steps: q.steps,
      })),
    ),
  ]);
  return id;
}

export interface TestSummary {
  id: string;
  title: string;
  subject: Subject;
  createdAt: number;
  questions: number;
  earned: number;
  attempted: number;
}

export async function listTests(ownerId: string): Promise<TestSummary[]> {
  const rows = await db
    .select({
      id: tests.id,
      title: tests.title,
      subject: tests.subject,
      createdAt: tests.createdAt,
      questions: sql<number>`count(${testQuestions.id})`,
      attempted: sql<number>`count(${testQuestions.answeredAt})`,
      earned: sql<number>`coalesce(sum(case when ${testQuestions.chosenIndex} = ${testQuestions.correctIndex} then 1 else 0 end), 0)`,
    })
    .from(tests)
    .leftJoin(
      testQuestions,
      and(eq(testQuestions.testId, tests.id), eq(testQuestions.ownerId, ownerId)),
    )
    .where(eq(tests.ownerId, ownerId))
    .groupBy(tests.id)
    .orderBy(desc(tests.createdAt));
  return rows.map((row) => ({ ...row, subject: row.subject as Subject }));
}

export interface QuestionView {
  id: string;
  prompt: string;
  options: string[];
  /** Only once answered: what was picked, the right option and the steps. */
  answer: { chosen: number; correct: number; steps: string } | null;
}

function viewOf(row: typeof testQuestions.$inferSelect): QuestionView {
  return {
    id: row.id,
    prompt: row.prompt,
    options: JSON.parse(row.options) as string[],
    answer:
      row.chosenIndex === null
        ? null
        : { chosen: row.chosenIndex, correct: row.correctIndex, steps: row.steps },
  };
}

export async function getTest(ownerId: string, id: string) {
  const [test] = await db
    .select({ id: tests.id, title: tests.title, topic: tests.topic, subject: tests.subject })
    .from(tests)
    .where(and(eq(tests.id, id), eq(tests.ownerId, ownerId)));
  if (!test) return null;
  const rows = await db
    .select()
    .from(testQuestions)
    .where(and(eq(testQuestions.testId, id), eq(testQuestions.ownerId, ownerId)))
    .orderBy(asc(testQuestions.position));
  return { ...test, subject: test.subject as Subject, questions: rows.map(viewOf) };
}

/**
 * Records the member's one answer to a question. Null when the member has no
 * such question; an answered question keeps its first answer.
 */
export async function answerQuestion(
  ownerId: string,
  { questionId, choice }: z.infer<typeof answerInput>,
): Promise<QuestionView | null> {
  const [current] = await db
    .select()
    .from(testQuestions)
    .where(and(eq(testQuestions.id, questionId), eq(testQuestions.ownerId, ownerId)));
  if (!current) return null;
  const options = JSON.parse(current.options) as string[];
  if (choice >= options.length) throw new Error("Pick one of the options.");
  if (current.chosenIndex !== null) return viewOf(current);
  const [updated] = await db
    .update(testQuestions)
    .set({ chosenIndex: choice, answeredAt: Date.now() })
    .where(
      and(
        eq(testQuestions.id, questionId),
        eq(testQuestions.ownerId, ownerId),
        isNull(testQuestions.chosenIndex),
      ),
    )
    .returning();
  if (updated) return viewOf(updated);
  const [again] = await db
    .select()
    .from(testQuestions)
    .where(and(eq(testQuestions.id, questionId), eq(testQuestions.ownerId, ownerId)));
  return again ? viewOf(again) : null;
}

export async function deleteTest(ownerId: string, { id }: z.infer<typeof testIdInput>) {
  const [test] = await db
    .select({ id: tests.id })
    .from(tests)
    .where(and(eq(tests.id, id), eq(tests.ownerId, ownerId)));
  if (!test) return false;
  await db.batch([
    db.delete(testQuestions).where(and(eq(testQuestions.testId, id), eq(testQuestions.ownerId, ownerId))),
    db.delete(tests).where(and(eq(tests.id, id), eq(tests.ownerId, ownerId))),
  ]);
  return true;
}
