import { env } from "cloudflare:workers";
import {
  aiBaseUrl,
  createGatewayFetch,
  gatewayRefusal,
  refusalFromError,
} from "@every-app/sdk/server";

export type ModelPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export interface ModelMessage {
  role: "system" | "user" | "assistant";
  content: string | ModelPart[];
}

/** What the page shows instead of an answer when no model is set up. */
export interface AiSetup {
  message: string;
  setup: string | null;
  command: string | null;
}

export type Completion = { text: string } | { aiOff: AiSetup };

/** One chat completion from the workspace's default model, through the Gateway. */
export async function complete(messages: ModelMessage[]): Promise<Completion> {
  let response: Response;
  try {
    const gatewayFetch = createGatewayFetch({ env });
    response = await gatewayFetch(`${aiBaseUrl()}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: "default", messages }),
    });
  } catch (error) {
    const refusal = refusalFromError(error);
    if (refusal) return { aiOff: setupOf(refusal) };
    throw error;
  }
  if (!response.ok) {
    const refusal = await gatewayRefusal(response);
    if (refusal) return { aiOff: setupOf(refusal) };
    throw new Error("The model didn't answer. Try again.");
  }
  const body = (await response.json()) as {
    choices?: { message?: { content?: unknown } }[];
  };
  const text = body.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("The model sent an empty answer. Try again.");
  }
  return { text: text.trim() };
}

function setupOf(refusal: {
  message: string;
  setup: string | null;
  command: string | null;
}): AiSetup {
  return {
    message: refusal.message,
    setup: refusal.setup,
    command: refusal.command,
  };
}
