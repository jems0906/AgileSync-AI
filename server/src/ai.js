import { config } from "./config.js";

let clientPromise = null;

async function getClient() {
  if (!config.openAiApiKey) {
    return null;
  }

  if (!clientPromise) {
    clientPromise = import("openai").then(({ default: OpenAI }) => new OpenAI({ apiKey: config.openAiApiKey }));
  }

  return clientPromise;
}

const fallback = (title, input) => ({
  source: "fallback",
  text: `${title}\n\n${input}\n\n- Suggested next step: Review with team and adjust scope by capacity.`
});

export async function generateWithAi(systemPrompt, userPrompt, fallbackTitle) {
  const client = await getClient();
  if (!client) {
    return fallback(fallbackTitle, userPrompt);
  }

  const response = await client.responses.create({
    model: config.openAiModel,
    input: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ]
  });

  const text = response.output_text || "No output returned";
  return {
    source: "openai",
    text
  };
}
