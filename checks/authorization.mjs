// Authorization: who may reach what, and one member never reads or changes another's work.
import { startRuntime, expect } from "/home/user/oss-new/control/runtime/index.mjs";
import { fakeGatewayOptions, samplePng } from "./fake-gateway.mjs";

const SEEDED_TEST = "6f1d3c1e-0000-4000-8000-000000000001";
const Q1 = "6f1d3c1e-0000-4000-8000-0000000000a1";
const Q2 = "6f1d3c1e-0000-4000-8000-0000000000a2";

const runtime = await startRuntime(fakeGatewayOptions);

async function seed() {
  const db = await runtime.database();
  const now = Date.now();
  await db.batch([
    db.prepare("INSERT INTO tests (id, owner_id, title, topic, subject, created_at) VALUES (?, 'owner', 'Fractions warm-up', 'Fractions', 'math', ?)").bind(SEEDED_TEST, now),
    db.prepare("INSERT INTO test_questions (id, test_id, owner_id, position, prompt, options, correct_index, steps) VALUES (?, ?, 'owner', 0, 'What is 1/2 + 1/4?', '[\"1/6\",\"3/4\",\"2/6\"]', 1, 'Write 1/2 as 2/4, then add: 3/4.')").bind(Q1, SEEDED_TEST),
    db.prepare("INSERT INTO test_questions (id, test_id, owner_id, position, prompt, options, correct_index, steps) VALUES (?, ?, 'owner', 1, 'What is 2/3 of 9?', '[\"3\",\"6\",\"9\"]', 1, 'Divide 9 by 3 to get 3, then double it: 6.')").bind(Q2, SEEDED_TEST),
  ]);
}

/** Runs `action` and returns the server function POST it made, for replaying. */
async function capture(page, action) {
  const [request] = await Promise.all([
    page.waitForRequest((r) => r.method() === "POST" && r.url().includes("/_serverFn/")),
    action(),
  ]);
  const url = new URL(request.url());
  const headers = await request.allHeaders();
  const keep = Object.fromEntries(Object.entries(headers).filter(([name]) => name === "content-type" || name === "accept" || name.startsWith("x-tsr")));
  return { path: url.pathname + url.search, headers: keep, body: request.postData() ?? "" };
}

function replay(call, role, change = (body) => body) {
  return runtime.fetch(call.path, { role, method: "POST", headers: call.headers, body: change(call.body) });
}

try {
  await seed();
  await runtime.assertPrivateAccess(["/", "/tests", "/graphs"]);
  const db = await runtime.database();

  // The app serves no sign-in page of its own.
  for (const path of ["/login", "/signin", "/sign-in", "/signup", "/logout", "/auth/login"]) {
    const response = await runtime.fetch(path, { role: "owner" });
    expect(response.status, path).toBe(404);
  }

  const ownerContext = await runtime.context("owner");
  const owner = await ownerContext.newPage();
  const memberContext = await runtime.context("member");
  const member = await memberContext.newPage();

  // Chats and files.
  await owner.goto("/");
  await owner.getByTestId("file-input").setInputFiles({ name: "worksheet.png", mimeType: "image/png", buffer: samplePng() });
  await owner.getByTestId("question-input").fill("Solve the equation on my worksheet");
  await owner.getByTestId("send-button").click();
  await expect(owner).toHaveURL(/\/chats\/[0-9a-f-]{36}$/, { timeout: 20000 });
  const chatPath = new URL(owner.url()).pathname;
  const chatId = chatPath.split("/").pop();
  await expect(owner.locator('[data-testid="message"][data-role="assistant"]')).toHaveCount(1);
  const fileHref = await owner.getByTestId("attachment").first().getAttribute("href");
  expect((await runtime.fetch(fileHref, { role: "owner" })).status).toBe(200);
  expect((await runtime.fetch(fileHref, { role: "member" })).status).toBe(404);
  expect([401, 403]).toContain((await runtime.fetch(fileHref)).status);
  expect([401, 403]).toContain((await runtime.fetch(fileHref, { role: "outsider" })).status);

  await member.goto(chatPath);
  await expect(member.getByTestId("not-found")).toBeVisible();
  await expect(member.getByText("Solve the equation on my worksheet")).toHaveCount(0);
  await member.goto("/");
  await expect(member.getByTestId("chat-link")).toHaveCount(0);
  const memberHtml = await (await runtime.fetch(chatPath, { role: "member" })).text();
  expect(memberHtml).not.toContain("Solve the equation on my worksheet");

  await owner.getByTestId("rename-chat").click();
  await owner.getByTestId("chat-title-input").fill("Worksheet one");
  const rename = await capture(owner, () => owner.getByTestId("save-title").click());
  await expect(owner.getByRole("heading", { level: 1 })).toHaveText("Worksheet one");
  await replay(rename, "member", (body) => body.replace("Worksheet one", "Taken over"));
  const titleOf = async () => (await db.prepare("SELECT title FROM chats WHERE id = ?").bind(chatId).first()).title;
  expect(await titleOf()).toBe("Worksheet one");
  const ownReplay = await replay(rename, "owner", (body) => body.replace("Worksheet one", "Worksheet two"));
  expect(ownReplay.status).toBeLessThan(400);
  expect(await titleOf()).toBe("Worksheet two");

  // A member cannot post into another member's chat.
  await owner.reload();
  await owner.getByTestId("question-input").fill("And check my second answer");
  const send = await capture(owner, () => owner.getByTestId("send-button").click());
  await expect(owner.locator('[data-testid="message"][data-role="assistant"]')).toHaveCount(2, { timeout: 20000 });
  const countMessages = async () => (await db.prepare("SELECT count(*) AS n FROM messages WHERE chat_id = ?").bind(chatId).first()).n;
  const before = await countMessages();
  await replay(send, "member");
  expect(await countMessages()).toBe(before);

  // Graphs.
  async function newGraph(title) {
    await owner.goto("/graphs");
    await owner.getByTestId("new-graph").click();
    await owner.getByTestId("graph-title").fill(title);
    await owner.getByTestId("expression-input").nth(0).fill("x^3");
    await owner.getByTestId("save-graph").click();
    await expect(owner).toHaveURL(/\/graphs\/[0-9a-f-]{36}$/);
    return new URL(owner.url()).pathname;
  }
  const keepPath = await newGraph("Cubic");
  const keepId = keepPath.split("/").pop();
  await member.goto(keepPath);
  await expect(member.getByTestId("not-found")).toBeVisible();
  await member.goto("/graphs");
  await expect(member.getByTestId("graph-link")).toHaveCount(0);
  const dropPath = await newGraph("Throwaway");
  const dropId = dropPath.split("/").pop();
  await owner.getByTestId("delete-graph").click();
  const del = await capture(owner, () => owner.getByRole("button", { name: "Delete", exact: true }).click());
  await expect(owner).toHaveURL(/\/graphs$/);
  expect(del.body).toContain(dropId);
  await replay(del, "member", (body) => body.replace(dropId, keepId));
  expect(await db.prepare("SELECT count(*) AS n FROM graphs WHERE id = ?").bind(keepId).first()).toEqual({ n: 1 });

  await owner.goto(keepPath);
  await owner.getByTestId("graph-title").fill("Cubic curve");
  const save = await capture(owner, () => owner.getByTestId("save-graph").click());
  await expect(owner.getByText("Graph saved")).toBeVisible();
  await replay(save, "member", (body) => body.replace("Cubic curve", "Vandalised"));
  expect((await db.prepare("SELECT title FROM graphs WHERE id = ?").bind(keepId).first()).title).toBe("Cubic curve");
  await replay(del, "owner", (body) => body.replace(dropId, keepId));
  expect(await db.prepare("SELECT count(*) AS n FROM graphs WHERE id = ?").bind(keepId).first()).toEqual({ n: 0 });

  // Practice tests: private, and answers and steps stay hidden until answered.
  const testPath = `/tests/${SEEDED_TEST}`;
  const ownerHtml = await (await runtime.fetch(testPath, { role: "owner" })).text();
  expect(ownerHtml).toContain("What is 1/2 + 1/4?");
  expect(ownerHtml).not.toContain("then add: 3/4");
  expect(ownerHtml).not.toContain("then double it");
  await member.goto(testPath);
  await expect(member.getByTestId("not-found")).toBeVisible();
  await member.goto("/tests");
  await expect(member.getByTestId("test-row")).toHaveCount(0);
  await owner.goto(testPath);
  const q1 = owner.getByTestId("question").nth(0);
  await q1.getByTestId("option").nth(1).click();
  const answer = await capture(owner, () => q1.getByTestId("check-answer").click());
  await expect(q1.getByTestId("result")).toHaveText("Correct");
  expect(answer.body).toContain(Q1);
  await replay(answer, "member", (body) => body.replace(Q1, Q2));
  expect((await db.prepare("SELECT chosen_index FROM test_questions WHERE id = ?").bind(Q2).first()).chosen_index).toBeNull();

  await ownerContext.close();
  await memberContext.close();
  console.log("authorization: ok");
} finally {
  await runtime.close();
}
