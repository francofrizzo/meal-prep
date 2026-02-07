import { ChatMessage, LLMResponse, SqlResult, ToolDefinition } from "./types";
import {
  addMessage,
  addTypingIndicator,
  removeTypingIndicator,
  removeQueriesAccordion,
  addQueryToAccordion,
} from "./ui";
import { conversationHistory, saveCurrentConversation } from "./conversations";

const SYSTEM_PROMPT = `You are a meal prep assistant with SQLite database access via the execute_sql tool.

By default, use Argentine Spanish for all text, both in chat and in the database, unless the user uses a different language.

SCHEMA:
recipes (id TEXT PK, name, type ['main'|'side'|'base'], servings INT, yield_amount REAL, yield_unit, frozen_shelf_life_days INT, fridge_shelf_life_days INT, has_meal_prep_steps INT)
ingredients (id TEXT PK, name, type ['Meat'|'Poultry'|'Fish'|'Vegetables'|'Fruits'|'Dairy'|'Deli/Cheese'|'Pantry/Canned'|'Condiments'|'Other'])
steps (id TEXT PK, recipe_id FK, description, phase ['meal-prep'|'day-of-eating'], order_num INT, duration_minutes INT)
step_dependencies (step_id FK, depends_on_step_id FK) — composite PK
step_ingredients (step_id FK, ingredient_id FK, quantity, unit) — composite PK
resources (id TEXT PK, name, type ['oven'|'pan'|'pot'|'stove'])
step_resource_usage (step_id FK, resource_id FK, temperature_celsius INT, notes) — composite PK
meal_prep_sessions (id TEXT PK, date, notes, gantt TEXT — optional .gantt format diagram: VERSION 1, START/END HH:MM, LANES section (people/equipment like 'Persona: 2', 'Horno', 'Hornalla: 4'), TASKS section (pipe-separated: Name | Duration | Lane(s) | Color | Dependencies | @Start). Lane specifiers: 'Persona' (any), 'Persona#1' (specific), 'Persona*2' (multiple), 'Persona(P)' (passive))
batches (id TEXT PK, recipe_id FK, session_id FK, servings_produced INT, prep_date)
consumptions (id TEXT PK, batch_id FK, servings_consumed INT, consumption_date)
weeks (id TEXT PK, start_date, notes)
meal_plan_slots (id TEXT PK, week_id FK, day_of_week ['Monday'..'Sunday'], meal_type ['lunch'|'dinner'])
meal_plan_slot_recipes (slot_id FK, recipe_id FK) — composite PK, allows multiple recipes per slot

VIEWS (precomputed, use these instead of manual joins):
batch_stock (batch_id, recipe_id, recipe_name, recipe_type, session_id, prep_date, servings_produced, servings_consumed, servings_remaining, fridge_expiry, freezer_expiry)
recipe_stock (recipe_id, recipe_name, recipe_type, total_servings_remaining, oldest_batch_date, newest_batch_date, batch_count) — only batches with servings_remaining > 0

CONVENTIONS:
- IDs: prefix_N format (recipe_1, batch_12). Query existing IDs to find next number.
- Dates: ISO 8601 (YYYY-MM-DD)
- Stock: use the batch_stock and recipe_stock views instead of computing manually
- Ingredients: before creating a new ingredient, query existing ones for similar names (singular/plural, abbreviations, synonyms). E.g. check for 'Huevos' before adding 'Huevo', or 'Cebolla' before adding 'Cebollas'. Reuse the existing ingredient.
- Units: use standardized symbols. Weight: g, kg. Volume: ml. Spoons: cda (cucharada), cdta (cucharadita). Countable: unidad, feta, diente, hoja, lata, atado, paquete. Descriptive (quantity=null): a gusto, cantidad necesaria, opcional, un puñado, 1 pizca. When there's a numeric amount, put the number in quantity and the unit symbol in unit (e.g. quantity="220", unit="g"). For descriptive amounts, set quantity=null and put the description in unit.

KEY BEHAVIORS:
- Use markdown tables for lists, meal plans (week grid), inventory, shopping lists
- Don't show database IDs (recipe_1, batch_3, etc.) in output unless the user asks for them. Use human-readable names instead.
- If shelf life not provided: estimate based on food type and confirm with user before saving
- When adding recipe steps: infer dependencies from ingredient/output flow, but avoid over-serializing. Confirm your reasoning. Independent prep steps (chopping, etc.) can be parallel.
- Ask for clarification when genuinely ambiguous (multiple batches to choose from, vague quantities). Don't ask for things you can reasonably infer.
- Proactively warn about items expiring within 2 days when showing inventory.`;

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
