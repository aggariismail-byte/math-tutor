import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { beforeAll, describe, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";

// An in-memory SQLite with the app's migrations stands in for D1.
const testDb = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/db", () => ({
  get db() {
    return testDb.current;
  },
}));

const tests = await import("./tests");
const graphs = await import("./graphs");

beforeAll(async () => {
  const db = drizzle(createClient({ url: ":memory:" }), { schema });
  await migrate(db, {
    migrationsFolder: fileURLToPath(new URL("../../drizzle", import.meta.url)),
  });
  testDb.current = db;
});

const sample = {
  title: "Fractions",
  questions: [
    { question: "1/2 + 1/4?", options: ["1/6", "3/4", "2/6"], answer: 1, steps: "2/4 + 1/4 = 3/4" },
    { question: "2/3 of 9?", options: ["3", "6", "9", "12"], answer: 1, steps: "9 / 3 * 2 = 6" },
  ],
};

describe("practice tests", () => {
  it("parse the model's JSON and refuse a bad shape", () => {
    expect(tests.parseGeneratedTest("Here: " + JSON.stringify(sample), 2)?.questions).toHaveLength(2);
    expect(tests.parseGeneratedTest(JSON.stringify(sample), 3)).toBeNull();
    const bad = { ...sample, questions: [{ ...sample.questions[0], answer: 5 }] };
    expect(tests.parseGeneratedTest(JSON.stringify(bad), 1)).toBeNull();
    expect(tests.parseGeneratedTest("not json", 1)).toBeNull();
  });

  it("hide answers until answered, keep the first answer, and stay private", async () => {
    const id = await tests.saveTest("alice", { topic: "Fractions", subject: "math", count: 3 }, sample);
    const test = await tests.getTest("alice", id);
    expect(test?.questions.every((q) => q.answer === null)).toBe(true);
    expect(await tests.getTest("bob", id)).toBeNull();
    const q = test!.questions[0]!;
    expect(await tests.answerQuestion("bob", { questionId: q.id, choice: 1 })).toBeNull();
    expect((await tests.answerQuestion("alice", { questionId: q.id, choice: 0 }))?.answer).toEqual({
      chosen: 0,
      correct: 1,
      steps: "2/4 + 1/4 = 3/4",
    });
    expect((await tests.answerQuestion("alice", { questionId: q.id, choice: 1 }))?.answer?.chosen).toBe(0);
    const [row] = await tests.listTests("alice");
    expect(row).toMatchObject({ earned: 0, attempted: 1, questions: 2 });
    expect(await tests.listTests("bob")).toEqual([]);
    expect(await tests.deleteTest("bob", { id })).toBe(false);
    expect(await tests.deleteTest("alice", { id })).toBe(true);
    expect(await tests.getTest("alice", id)).toBeNull();
  });
});

describe("graphs", () => {
  it("belong to the member who saved them", async () => {
    const saved = await graphs.saveGraph("alice", {
      title: "Parabola",
      expressions: ["x^2"],
      xMin: -5,
      xMax: 5,
      yMin: -1,
      yMax: 25,
    });
    expect(saved?.expressions).toEqual(["x^2"]);
    expect(await graphs.getGraph("bob", saved!.id)).toBeNull();
    expect(
      await graphs.saveGraph("bob", { id: saved!.id, title: "Mine", expressions: ["x"], xMin: 0, xMax: 1, yMin: 0, yMax: 1 }),
    ).toBeNull();
    expect(await graphs.deleteGraph("bob", { id: saved!.id })).toBe(false);
    expect((await graphs.getGraph("alice", saved!.id))?.title).toBe("Parabola");
  });

  it("refuse an empty range", () => {
    const result = graphs.saveGraphInput.safeParse({ title: "t", expressions: ["x"], xMin: 1, xMax: 1, yMin: 0, yMax: 1 });
    expect(result.success).toBe(false);
  });
});
