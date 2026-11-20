// Behavior: each frozen feature's main path, in the browser and over HTTP.
import { startRuntime, expect } from "/home/user/oss-new/control/runtime/index.mjs";
import { fakeGatewayOptions, samplePdf, samplePng, setAiOff } from "./fake-gateway.mjs";

const runtime = await startRuntime(fakeGatewayOptions);

async function pick(page, testId, label) {
  await page.getByTestId(testId).click();
  await page.getByRole("option", { name: label, exact: true }).click();
  await expect(page.getByTestId(testId)).toContainText(label);
}

async function ask(page, text) {
  const before = await page.locator('[data-testid="message"][data-role="assistant"]').count();
  await page.getByTestId("question-input").fill(text);
  await page.getByTestId("send-button").click();
  await expect(page.locator('[data-testid="message"][data-role="assistant"]')).toHaveCount(before + 1, { timeout: 20000 });
  return page.locator('[data-testid="message"][data-role="assistant"]').last();
}

try {
  const context = await runtime.context("owner");
  const page = await context.newPage();

  // F004: graphing.
  await page.goto("/graphs");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Graphs");
  await page.getByTestId("new-graph").click();
  await page.getByTestId("graph-title").fill("Parabola and sine");
  await page.getByTestId("expression-input").nth(0).fill("x^2 - 3");
  await page.getByTestId("add-expression").click();
  await page.getByTestId("expression-input").nth(1).fill("sin(x)");
  await page.getByTestId("add-expression").click();
  await page.getByTestId("expression-input").nth(2).fill("x^ + (");
  await expect(page.getByTestId("expression-error")).toHaveCount(1);
  await expect(page.locator('[data-testid="graph-plot"] [data-testid="series"]')).toHaveCount(2);
  const colours = await page.locator('[data-testid="series"]').evaluateAll((paths) => paths.map((p) => getComputedStyle(p).stroke));
  expect(new Set(colours).size).toBe(2);
  await page.getByTestId("remove-expression").nth(2).click();
  await expect(page.getByTestId("expression-error")).toHaveCount(0);
  await page.getByTestId("x-min").fill("-5");
  await page.getByTestId("x-max").fill("5");
  await page.getByTestId("y-min").fill("-4");
  await page.getByTestId("y-max").fill("10");
  await page.getByTestId("save-graph").click();
  await expect(page).toHaveURL(/\/graphs\/[0-9a-f-]{36}$/);
  const graphUrl = page.url();
  await page.goto("/graphs");
  await expect(page.getByTestId("graph-link").filter({ hasText: "Parabola and sine" })).toBeVisible();
  await page.goto(graphUrl);
  await expect(page.getByTestId("expression-input").nth(1)).toHaveValue("sin(x)");
  await expect(page.getByTestId("x-min")).toHaveValue("-5");
  await expect(page.getByTestId("y-max")).toHaveValue("10");
  await expect(page.locator('[data-testid="series"]')).toHaveCount(2);
  await page.getByTestId("graph-title").fill("Parabola, sine and line");
  await page.getByTestId("add-expression").click();
  await page.getByTestId("expression-input").nth(2).fill("2*x + 1");
  await page.getByTestId("save-graph").click();
  await expect(page.getByText("Graph saved")).toBeVisible();
  await page.goto("/graphs");
  await expect(page.getByTestId("graph-link").filter({ hasText: "Parabola, sine and line" })).toBeVisible();
  await page.getByTestId("new-graph").click();
  await page.getByTestId("graph-title").fill("Scratch graph");
  await page.getByTestId("expression-input").nth(0).fill("x");
  await page.getByTestId("save-graph").click();
  await expect(page).toHaveURL(/\/graphs\/[0-9a-f-]{36}$/);
  await page.getByTestId("delete-graph").click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page).toHaveURL(/\/graphs$/);
  await expect(page.getByTestId("graph-link").filter({ hasText: "Scratch graph" })).toHaveCount(0);
  await expect(page.getByTestId("graph-link")).toHaveCount(1);

  // F003: practice tests.
  await page.goto("/tests");
  await page.getByTestId("topic-input").fill("Linear equations");
  await pick(page, "test-subject", "Math");
  await page.getByTestId("question-count").fill("3");
  await page.getByTestId("generate-test").click();
  await expect(page).toHaveURL(/\/tests\/[0-9a-f-]{36}$/, { timeout: 20000 });
  const testUrl = page.url();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Practice: Linear equations");
  const questions = page.getByTestId("question");
  await expect(questions).toHaveCount(3);
  await expect(page.getByTestId("score")).toHaveText("0 / 0");
  const q1 = questions.nth(0);
  await expect(q1.getByTestId("show-steps")).toHaveCount(0);
  await q1.getByTestId("option").nth(1).click();
  await q1.getByTestId("check-answer").click();
  await expect(q1.getByTestId("result")).toHaveText("Correct");
  await expect(page.getByTestId("score")).toHaveText("1 / 1");
  await q1.getByTestId("show-steps").click();
  await expect(q1.getByTestId("steps")).toContainText("Divide by 2");
  await expect(q1.getByTestId("check-answer")).toHaveCount(0);
  const q2 = questions.nth(1);
  await q2.getByTestId("option").nth(0).click();
  await q2.getByTestId("check-answer").click();
  await expect(q2.getByTestId("result")).toHaveText("Incorrect");
  await expect(q2.locator('[data-testid="option"][data-correct="true"]')).toHaveText(/x = 5/);
  await expect(page.getByTestId("score")).toHaveText("1 / 2");
  await page.goto("/tests");
  const row = page.getByTestId("test-row").filter({ hasText: "Practice: Linear equations" });
  await expect(row).toContainText("1 / 2");
  await page.goto(testUrl);
  await expect(questions.nth(1).getByTestId("result")).toHaveText("Incorrect");
  await expect(questions.nth(2).getByTestId("check-answer")).toBeVisible();
  await expect(page.getByTestId("score")).toHaveText("1 / 2");
  await page.goto("/tests");
  await page.getByTestId("topic-input").fill("Quick check");
  await page.getByTestId("question-count").fill("4");
  await page.getByTestId("generate-test").click();
  await expect(page).toHaveURL(/\/tests\/[0-9a-f-]{36}$/, { timeout: 20000 });
  await expect(page.getByTestId("question")).toHaveCount(4);
  await expect(page.getByTestId("question").nth(0).getByTestId("option")).toHaveCount(4);
  await expect(page.getByTestId("question").nth(1).getByTestId("option")).toHaveCount(3);
  await page.getByTestId("delete-test").click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page).toHaveURL(/\/tests$/);
  await expect(page.getByTestId("test-row")).toHaveCount(1);

  // F002: photo and PDF uploads.
  await page.goto("/");
  await pick(page, "subject-select", "Math");
  await page.getByTestId("file-input").setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") });
  await expect(page.getByTestId("composer-error")).toContainText("PNG, JPEG, WebP or PDF");
  await page.getByTestId("file-input").setInputFiles({ name: "big.png", mimeType: "image/png", buffer: Buffer.alloc(10 * 1024 * 1024 + 1) });
  await expect(page.getByTestId("composer-error")).toContainText("10 MB");
  await page.getByTestId("file-input").setInputFiles({ name: "equation.png", mimeType: "image/png", buffer: samplePng() });
  await expect(page.getByTestId("composer-error")).toHaveCount(0);
  const photoReply = await ask(page, "Solve the equation in this photo");
  await expect(page).toHaveURL(/\/chats\/[0-9a-f-]{36}$/);
  const photoChatUrl = page.url();
  await expect(photoReply).toContainText("Reading the problem from your photo");
  const attachment = page.getByTestId("attachment").first();
  await expect(attachment.locator("img")).toBeVisible();
  const fileHref = await attachment.getAttribute("href");
  expect(fileHref).toMatch(/^\/api\/files\/[0-9a-f-]{36}$/);
  const own = await runtime.fetch(fileHref, { role: "owner" });
  expect(own.status).toBe(200);
  expect(own.headers.get("content-type")).toBe("image/png");
  expect(Buffer.from(await own.arrayBuffer()).equals(samplePng())).toBe(true);
  expect((await runtime.fetch(fileHref, { role: "member" })).status).toBe(404);
  await page.getByTestId("file-input").setInputFiles({ name: "homework.pdf", mimeType: "application/pdf", buffer: samplePdf() });
  const pdfReply = await ask(page, "");
  await expect(pdfReply).toContainText("y = 4");
  await expect(page.getByTestId("attachment").filter({ hasText: "homework.pdf" })).toBeVisible();

  // F001: rename and delete a chat.
  await page.getByTestId("rename-chat").click();
  await page.getByTestId("chat-title-input").fill("Photo homework");
  await page.getByTestId("save-title").click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Photo homework");
  await page.goto("/");
  await expect(page.getByTestId("chat-link").first()).toContainText("Photo homework");
  await page.goto(photoChatUrl);
  await page.getByTestId("delete-chat").click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId("chat-link").filter({ hasText: "Photo homework" })).toHaveCount(0);
  expect((await runtime.fetch(fileHref, { role: "owner" })).status).toBe(404);

  // F001: the AI is not set up.
  await setAiOff(runtime, true);
  await page.goto("/");
  await page.getByTestId("question-input").fill("What is 7 times 8?");
  await page.getByTestId("send-button").click();
  await expect(page.getByTestId("ai-setup-notice")).toContainText("Add an AI provider key in the Gateway's settings.");
  await expect(page.locator('[data-testid="message"][data-role="assistant"]')).toHaveCount(0);
  await setAiOff(runtime, false);

  // F001: a worked solution, a follow-up with the thread as context, recent chats, reopening.
  await page.goto("/");
  await pick(page, "subject-select", "Physics");
  const first = await ask(page, "A ball is dropped from 20 m. How long until it hits the ground? Use g = 9.8 m/s².");
  await expect(page).toHaveURL(/\/chats\/[0-9a-f-]{36}$/);
  const chatUrl = page.url();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("A ball is dropped from 20 m. How long until it hits the ground? Use g = 9.8 m/s².".slice(0, 60).trim() + "…");
  await expect(first).toContainText("Final answer");
  await expect(first.locator("math").first()).toBeVisible();
  const second = await ask(page, "What is its speed just before impact?");
  await expect(second).toContainText("Picking up from the ball dropped from 20 m");
  await expect(second).toContainText("19.8");
  await page.goto("/");
  await expect(page.getByTestId("chat-link").first()).toContainText("A ball is dropped from 20 m");
  await expect(page.getByTestId("chat-link").first()).toContainText("Physics");
  await page.goto(chatUrl);
  await expect(page.getByTestId("message")).toHaveCount(4);
  await expect(page.getByTestId("message").nth(0)).toContainText("A ball is dropped from 20 m");
  await expect(page.getByTestId("message").nth(3)).toContainText("Final answer");
  await runtime.assertBackLink(page);
  await page.getByTestId("message").nth(2).scrollIntoViewIfNeeded();
  await runtime.screenshot(page);
  await context.close();

  // Phone-sized smoke.
  const phone = await runtime.context("member", { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const small = await phone.newPage();
  await small.goto("/");
  await expect(small.getByTestId("question-input")).toBeVisible();
  await expect(small.getByTestId("send-button")).toBeVisible();
  await expect(small.getByRole("link", { name: "Graphs" })).toBeVisible();
  const overflow = await small.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await small.goto("/graphs");
  await expect(small.getByTestId("new-graph")).toBeVisible();
  await phone.close();
  console.log("behavior: ok");
} finally {
  await runtime.close();
}
