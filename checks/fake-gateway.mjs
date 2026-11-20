// A local fake of the Gateway's AI route for the suites. It answers chat
// completions the way a configured model would, deterministically, and can be
// switched to refuse as a Gateway with no AI key does.
const SCRIPT = String.raw`
let off = false;
const refuse = () => Response.json(
  { code: "ai_default_not_configured", message: "No AI model is set up.", setup: "Add an AI provider key in the Gateway's settings." },
  { status: 503, headers: { "x-everyapp-error": "ai_default_not_configured" } },
);
const textOf = (content) => typeof content === "string" ? content
  : content.filter((part) => part.type === "text").map((part) => part.text).join("\n");
const hasImage = (content) => Array.isArray(content) && content.some((part) => part.type === "image_url" && /^data:image\/(png|jpeg|webp);base64,/.test(part.image_url.url));

function practiceTest(prompt) {
  const count = Number(/(\d+) questions/.exec(prompt)?.[1] ?? 3);
  const topic = /Topic: (.*)/.exec(prompt)?.[1]?.trim() ?? "the topic";
  const bank = [
    ["Solve for x: 2x + 6 = 14", ["x = 3", "x = 4", "x = 5", "x = 10"], "Subtract 6 from both sides: $2x = 8$. Divide by 2: $x = 4$."],
    ["Solve for x: 5x - 5 = 20", ["x = 3", "x = 5", "x = 15"], "Add 5 to both sides: $5x = 25$. Divide by 5: $x = 5$."],
    ["Solve for x: x / 3 = 7", ["x = 10", "x = 21", "x = 4", "x = 7/3"], "Multiply both sides by 3: $x = 21$."],
  ];
  const questions = Array.from({ length: count }, (_, i) => {
    const [question, options, steps] = bank[i % bank.length];
    return { question, options, answer: 1, steps };
  });
  return JSON.stringify({ title: "Practice: " + topic, questions });
}

function solution(messages) {
  const users = messages.filter((m) => m.role === "user");
  const last = users[users.length - 1];
  const text = textOf(last.content);
  const first = textOf(users[0].content);
  const lead = users.length < 2 ? "" : /dropped from 20 m/.test(first) ? "Picking up from the ball dropped from 20 m:\n\n" : "Following up on your earlier question (" + first.slice(0, 40) + "):\n\n";
  if (hasImage(last.content)) return lead + "Reading the problem from your photo: $2x + 3 = 11$.\n\n1. Subtract 3 from both sides: $2x = 8$.\n2. Divide by 2: $x = 4$.\n\n**Final answer:** $x = 4$";
  if (/5y = 20/.test(text)) return lead + "From your PDF: $5y = 20$.\n\n1. Divide both sides by 5: $y = 20 / 5$.\n\n**Final answer:** $y = 4$";
  if (/dropped/.test(text)) return lead + "Use the equation for free fall from rest:\n\n$$\nh = \\frac{1}{2} g t^2\n$$\n\n1. Solve for $t$: $t = \\sqrt{\\frac{2h}{g}}$.\n2. Substitute $h = 20\\,\\text{m}$ and $g = 9.8\\,\\text{m/s}^2$: $t = \\sqrt{\\frac{40}{9.8}} \\approx \\sqrt{4.08}$.\n3. Take the square root: $t \\approx 2.02\\,\\text{s}$.\n\n**Final answer:** about $2.0\\,\\text{s}$";
  if (/speed/.test(text)) return lead + "Starting from rest, speed grows linearly with time:\n\n$$\nv = g t\n$$\n\n1. Use $t \\approx 2.02\\,\\text{s}$ from before.\n2. $v = 9.8 \\times 2.02 \\approx 19.8\\,\\text{m/s}$.\n\n**Final answer:** about $19.8\\,\\text{m/s}$";
  return lead + "1. Read the problem carefully.\n2. Write what is known: $a = 1$.\n\n**Final answer:** $1$";
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/__ai") { off = url.searchParams.get("off") === "1"; return new Response("ok"); }
    if (url.pathname !== "/api/ai/default/v1/chat/completions" || request.method !== "POST") return new Response("not found", { status: 404 });
    if (off) return refuse();
    const body = await request.json();
    const system = body.messages.find((m) => m.role === "system");
    const wantsTest = system && /JSON/.test(textOf(system.content));
    const content = wantsTest ? practiceTest(textOf(body.messages[body.messages.length - 1].content)) : solution(body.messages);
    return Response.json({ id: "fake", object: "chat.completion", model: body.model, choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content } }] });
  },
};`;

export const FAKE_GATEWAY = "fake-gateway";

export const fakeGatewayOptions = {
  bindings: { EVERY_APP_GATEWAY: { type: "worker", worker: FAKE_GATEWAY } },
  workers: [
    {
      config: {
        name: FAKE_GATEWAY,
        compatibilityDate: "2026-06-01",
        manifest: {
          mainModule: "fake.mjs",
          modules: { "fake.mjs": { type: "esm", contents: SCRIPT } },
        },
      },
    },
  ],
};

/** Switch the fake's AI off (refusing like an unconfigured Gateway) or back on. */
export async function setAiOff(runtime, off) {
  const worker = await runtime.mf.getWorker(FAKE_GATEWAY);
  const response = await worker.fetch(`http://fake/__ai?off=${off ? 1 : 0}`);
  if (!response.ok) throw new Error("could not switch the fake AI");
  await response.text();
}

/** A one-page PDF whose text reads "Homework: Solve 5y = 20". */
export function samplePdf() {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    null,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  const stream = "BT /F1 24 Tf 72 700 Td (Homework: Solve 5y = 20) Tj ET";
  objects[3] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  let out = "%PDF-1.4\n";
  const offsets = [];
  objects.forEach((body, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) out += `${String(offset).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

/** A small valid PNG (8x8, one colour). */
export function samplePng() {
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAD0lEQVR4nGP4gAMwDC0JAFTitAG8PdreAAAAAElFTkSuQmCC",
    "base64",
  );
}
