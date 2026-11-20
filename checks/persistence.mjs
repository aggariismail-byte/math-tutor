// Persistence: chats, files, tests and graphs survive a restart.
import { startRuntime, expect } from "/home/user/oss-new/control/runtime/index.mjs";
import { fakeGatewayOptions, samplePng } from "./fake-gateway.mjs";

const runtime = await startRuntime(fakeGatewayOptions);
try {
  let context = await runtime.context("owner");
  let page = await context.newPage();

  await page.goto("/");
  await page.getByTestId("file-input").setInputFiles({ name: "problem.png", mimeType: "image/png", buffer: samplePng() });
  await page.getByTestId("question-input").fill("Please solve this one");
  await page.getByTestId("send-button").click();
  await expect(page).toHaveURL(/\/chats\/[0-9a-f-]{36}$/, { timeout: 20000 });
  await expect(page.locator('[data-testid="message"][data-role="assistant"]')).toHaveCount(1);
  const chatPath = new URL(page.url()).pathname;
  const fileHref = await page.getByTestId("attachment").first().getAttribute("href");

  await page.goto("/tests");
  await page.getByTestId("topic-input").fill("Equations");
  await page.getByTestId("question-count").fill("3");
  await page.getByTestId("generate-test").click();
  await expect(page).toHaveURL(/\/tests\/[0-9a-f-]{36}$/, { timeout: 20000 });
  const testPath = new URL(page.url()).pathname;
  const q1 = page.getByTestId("question").nth(0);
  await q1.getByTestId("option").nth(1).click();
  await q1.getByTestId("check-answer").click();
  await expect(page.getByTestId("score")).toHaveText("1 / 1");

  await page.goto("/graphs");
  await page.getByTestId("new-graph").click();
  await page.getByTestId("graph-title").fill("Exponential");
  await page.getByTestId("expression-input").nth(0).fill("exp(x)");
  await page.getByTestId("y-max").fill("20");
  await page.getByTestId("save-graph").click();
  await expect(page).toHaveURL(/\/graphs\/[0-9a-f-]{36}$/);
  const graphPath = new URL(page.url()).pathname;
  await context.close();

  await runtime.restart();

  context = await runtime.context("owner");
  page = await context.newPage();
  await page.goto("/");
  await expect(page.getByTestId("chat-link").first()).toContainText("Please solve this one");
  await page.goto(chatPath);
  await expect(page.getByTestId("message")).toHaveCount(2);
  await expect(page.getByTestId("message").nth(1)).toContainText("Final answer");
  const file = await runtime.fetch(fileHref, { role: "owner" });
  expect(file.status).toBe(200);
  expect(Buffer.from(await file.arrayBuffer()).equals(samplePng())).toBe(true);

  await page.goto(testPath);
  await expect(page.getByTestId("score")).toHaveText("1 / 1");
  await expect(page.getByTestId("question").nth(0).getByTestId("result")).toHaveText("Correct");
  await page.goto("/tests");
  await expect(page.getByTestId("test-row").first()).toContainText("1 / 1");

  await page.goto(graphPath);
  await expect(page.getByTestId("graph-title")).toHaveValue("Exponential");
  await expect(page.getByTestId("expression-input").nth(0)).toHaveValue("exp(x)");
  await expect(page.getByTestId("y-max")).toHaveValue("20");
  await context.close();
  console.log("persistence: ok");
} finally {
  await runtime.close();
}
