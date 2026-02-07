import { ChatMessage, LLMResponse, SqlResult, ToolDefinition } from "./types";
import {
  addMessage,
  addTypingIndicator,
  removeTypingIndicator,
  removeQueriesAccordion,
  addQueryToAccordion,
} from "./ui";
import { conversationHistory, saveCurrentConversation } from "./conversations";

const SYSTEM_PROMPT = `You are a helpful meal preparation assistant with access to a SQLite database for storing recipes, meal plans, and inventory tracking.

DATABASE SCHEMA:
- recipes: id, name, description, servings, created_at
- recipe_ingredients: id, recipe_id, ingredient, quantity, unit
- recipe_steps: id, recipe_id, step_number, instruction
- meal_plans: id, date, meal_type, recipe_id, notes
- meal_prep_batches: id, recipe_id, servings_made, date_prepared, expiration_date, storage_location, notes
- batch_consumption: id, batch_id, servings_consumed, consumption_date

You can execute SQL queries using the execute_sql function. Always provide helpful, friendly responses and proactively suggest relevant actions. Respond in Argentine Spanish, unless the user speaks another language.`;

const TOOL_DEFINITION: ToolDefinition = {
  type: "function",
  function: {
    name: "execute_sql",
    description:
      "Execute one or more SQL statements against the SQLite database. Supports SELECT, INSERT, UPDATE, DELETE, and other SQL operations. Multiple statements can be separated by semicolons.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "The SQL query or queries to execute. Multiple statements can be separated by semicolons.",
        },
      },
      required: ["query"],
    },
  },
};

async function callLLM(messages: ChatMessage[]): Promise<LLMResponse> {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages,
      tools: [TOOL_DEFINITION],
      tool_choice: "auto",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error (${response.status}): ${errorText}`);
  }

  return (await response.json()) as LLMResponse;
}

async function executeSQL(query: string): Promise<SqlResult> {
  const response = await fetch("/api/sql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return { error: errorText };
  }

  return (await response.json()) as SqlResult;
}

export async function handleUserMessage(
  text: string,
  sendBtn: HTMLButtonElement,
  userInput: HTMLTextAreaElement,
): Promise<void> {
  if (!text.trim()) return;

  removeQueriesAccordion();
  addMessage("user", text);
  conversationHistory.push({ role: "user", content: text });

  sendBtn.disabled = true;
  userInput.disabled = true;

  addTypingIndicator();

  try {
    const now = new Date();
    const currentDate = now.toISOString().split("T")[0];
    const currentTime = now.toTimeString().split(" ")[0].slice(0, 5);
    const dayOfWeek = now.toLocaleDateString("es-AR", { weekday: "long" });
    const systemPromptWithDate =
      SYSTEM_PROMPT + `\n\nCURRENT: ${dayOfWeek}, ${currentDate} ${currentTime}`;

    const messages: ChatMessage[] = [
      { role: "system", content: systemPromptWithDate },
      ...conversationHistory,
    ];

    const maxIterations = 20;
    let iteration = 0;

    while (iteration < maxIterations) {
      iteration++;

      const response = await callLLM(messages);
      const choice = response.choices && response.choices[0];

      if (!choice) {
        throw new Error("Sin respuesta del LLM");
      }

      const message = choice.message;

      if (message.tool_calls && message.tool_calls.length > 0) {
        conversationHistory.push({
          role: "assistant",
          content: message.content || null,
          tool_calls: message.tool_calls,
        });

        if (message.content) {
          removeTypingIndicator();
          addMessage("assistant", message.content);
          addTypingIndicator();
        }

        messages.push({
          role: "assistant",
          content: message.content || null,
          tool_calls: message.tool_calls,
        });

        for (const toolCall of message.tool_calls) {
          if (toolCall.function.name === "execute_sql") {
            let args: { query: string };
            try {
              args = JSON.parse(toolCall.function.arguments) as { query: string };
            } catch {
              args = { query: toolCall.function.arguments };
            }

            addQueryToAccordion(args.query);
            const result = await executeSQL(args.query);
            const resultStr = JSON.stringify(result, null, 2);

            const toolResult: ChatMessage = {
              role: "tool",
              tool_call_id: toolCall.id,
              content: resultStr,
            };
            conversationHistory.push(toolResult);
            messages.push(toolResult);
          }
        }
      } else {
        const assistantText = message.content || "(Sin respuesta)";
        conversationHistory.push({ role: "assistant", content: assistantText });
        removeTypingIndicator();
        addMessage("assistant", assistantText);
        await saveCurrentConversation();
        break;
      }
    }

    if (iteration >= maxIterations) {
      removeTypingIndicator();
      addMessage("error", "Se alcanzo el maximo de iteraciones.");
    }
  } catch (e) {
    removeTypingIndicator();
    const message = e instanceof Error ? e.message : "Unknown error";
    addMessage("error", `Error: ${message}`);
  } finally {
    sendBtn.disabled = false;
    userInput.disabled = false;
    userInput.focus();
  }
}
