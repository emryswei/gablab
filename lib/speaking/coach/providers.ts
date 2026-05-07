import type { CompletionResponse, ModelResult, OpenAIMessage } from "./types.ts";

type FetchLike = typeof fetch;
type CoachProviderEnvKeys =
  | "OPENAI_API_KEY"
  | "OPENAI_MODEL"
  | "AI_PROVIDER"
  | "CLOUDFLARE_ACCOUNT_ID"
  | "CLOUDFLARE_API_TOKEN"
  | "CLOUDFLARE_MODEL";

export type CoachProviderEnv = Record<string, string | undefined> &
  Partial<Record<CoachProviderEnvKeys, string>>;

async function readCompletionContent(response: Response, providerName: string): Promise<ModelResult> {
  if (!response.ok) {
    const text = await response.text();
    return { error: `${providerName} request failed (${response.status}): ${text}`, status: 502 };
  }

  const completion = (await response.json()) as CompletionResponse;
  const content = completion.choices?.[0]?.message?.content;
  if (!content) {
    return { error: "Empty model response.", status: 502 };
  }

  return { content };
}

export async function requestOpenAI(
  messages: OpenAIMessage[],
  env: CoachProviderEnv = process.env,
  fetchFn: FetchLike = fetch,
): Promise<ModelResult> {
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) {
    return { error: "Missing OPENAI_API_KEY in environment variables.", status: 500 };
  }

  const model = env.OPENAI_MODEL ?? "gpt-4o-mini";
  const response = await fetchFn("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.6,
      response_format: { type: "json_object" },
    }),
  });

  return readCompletionContent(response, "OpenAI");
}

export async function requestCloudflare(
  messages: OpenAIMessage[],
  env: CoachProviderEnv = process.env,
  fetchFn: FetchLike = fetch,
): Promise<ModelResult> {
  const accountId = env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !apiToken) {
    return {
      error: "Missing CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN in environment variables.",
      status: 500,
    };
  }

  const model = env.CLOUDFLARE_MODEL ?? "@cf/meta/llama-3.1-8b-instruct";
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1/chat/completions`;
  const response = await fetchFn(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiToken}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.6,
    }),
  });

  return readCompletionContent(response, "Cloudflare");
}
