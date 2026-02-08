import { Router, Request, Response } from "express";
import { ChatRequestBody, AnthropicResponse } from "../types";

const router = Router();

type Provider = "anthropic" | "openai";

function getProvider(model: string): Provider {
  if (model.startsWith("claude-")) return "anthropic";
  return "openai";
}

const MODEL = process.env.MODEL_NAME || "claude-sonnet-4-5-20250929";
const PROVIDER = getProvider(MODEL);

router.post("/", async (req: Request, res: Response) => {
  const { messages, tools, tool_choice } = req.body as ChatRequestBody;

  const apiKey =
    PROVIDER === "anthropic"
      ? process.env.ANTHROPIC_API_KEY
      : process.env.OPENAI_API_KEY;

  if (!apiKey) {
    const keyName = PROVIDER === "anthropic" ? "ANTHROPIC_API_KEY" : "OPENAI_API_KEY";
    res.status(500).json({ error: `${keyName} is required for model ${MODEL}` });
    return;
  }

  try {
    if (PROVIDER === "anthropic") {
      const systemMessages = messages
        .filter((m) => m.role === "system")
        .map((m) => m.content)
        .filter((content): content is string => !!content);
      const system =
        systemMessages.length > 0
          ? [
              {
                type: "text",
                text: systemMessages[0],
                cache_control: { type: "ephemeral" },
              },
              ...systemMessages.slice(1).map((text) => ({
                type: "text",
                text,
              })),
            ]
          : undefined;

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-beta": "prompt-caching-2024-07-31",
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 4096,
          messages: messages.filter((m) => m.role !== "system"),
          system,
          tools: tools?.map((t) => ({
            name: t.function.name,
            description: t.function.description,
            input_schema: t.function.parameters,
          })),
        }),
      });

      const data = (await response.json()) as AnthropicResponse;

      if (!response.ok) {
        res.status(response.status).json(data);
        return;
      }

      const choice = {
        message: {
          role: "assistant",
          content: data.content.find((c) => c.type === "text")?.text || null,
          tool_calls: data.content
            .filter((c) => c.type === "tool_use")
            .map((c) => ({
              id: c.id,
              type: "function",
              function: {
                name: c.name,
                arguments: JSON.stringify(c.input),
              },
            })),
        },
        finish_reason: data.stop_reason,
      };

      res.json({ choices: [choice] });
    } else {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: MODEL,
          messages,
          tools,
          tool_choice,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        res.status(response.status).json(data);
        return;
      }

      res.json(data);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

export default router;
