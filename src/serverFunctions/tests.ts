import { createServerFn } from "@tanstack/react-start";
import { ensureUserMiddleware } from "@every-app/sdk/tanstack-start";
import { z } from "zod";
import { complete } from "@/server/ai";
import * as tests from "@/server/tests";
import { ensureUser } from "@/server/users";

export const listTests = createServerFn()
  .middleware([ensureUserMiddleware])
  .handler(async ({ context }) => {
    await ensureUser(context.user);
    return tests.listTests(context.user.id);
  });

export const getTest = createServerFn()
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => z.string().uuid().parse(data))
  .handler(({ data, context }) => tests.getTest(context.user.id, data));

export const generateTest = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => tests.createTestInput.parse(data))
  .handler(async ({ data, context }) => {
    await ensureUser(context.user);
    const answer = await complete([
      { role: "system", content: tests.testPrompt(data.subject) },
      { role: "user", content: tests.testRequest(data.topic, data.count) },
    ]);
    if ("aiOff" in answer) return answer;
    const generated = tests.parseGeneratedTest(answer.text, data.count);
    if (!generated) throw new Error("The model's test didn't come out right. Try again.");
    return { testId: await tests.saveTest(context.user.id, data, generated) };
  });

export const answerQuestion = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => tests.answerInput.parse(data))
  .handler(async ({ data, context }) => {
    const question = await tests.answerQuestion(context.user.id, data);
    if (!question) throw new Error("Question not found");
    return question;
  });

export const deleteTest = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => tests.testIdInput.parse(data))
  .handler(async ({ data, context }) => {
    if (!(await tests.deleteTest(context.user.id, data))) throw new Error("Test not found");
    return { ok: true };
  });
