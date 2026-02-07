import { Router, Request, Response } from "express";
import { ChatRequestBody, AnthropicResponse } from "../types";

const router = Router();

router.post("/", async (req: Request, res: Response) => {
  const { messages, tools, tool_choice } = req.body as ChatRequestBody;

  if (!process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY) {
    res.status(500).json({ error: "No API key configured" });
    return;
  }

  try {
    const useAnthropic = !!process.env.ANTHROPIC_API_KEY;

    if (useAnthropic) {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY!,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: process.env.MODEL_NAME || "claude-sonnet-4-5-20250929",
          max_tokens: 4096,
          messages: messages.filter((m) => m.role !== "system"),
          system: messages.find((m) => m.role === "system")?.content,
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
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: process.env.MODEL_NAME || "gpt-4o",
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
