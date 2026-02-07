import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { db, nextId } from "../../server/db.js";

const INGREDIENT_TYPES = [
  "Meat",
  "Poultry",
  "Fish",
  "Vegetables",
  "Fruits",
  "Dairy",
  "Deli/Cheese",
  "Pantry/Canned",
  "Condiments",
  "Other",
] as const;

export function registerIngredientTools(server: McpServer): void {
  server.tool(
    "manage_ingredients",
    "Create, update, or delete ingredients used in recipes. Deleting an ingredient also removes all step_ingredients references to it. IMPORTANT: Before creating a new ingredient, search existing ingredients for similar names (singular/plural variants, abbreviations, synonyms). For example, check for 'Huevos' before adding 'Huevo', or 'Cebolla' before adding 'Cebollas'. Reuse the existing ingredient instead of creating a duplicate.",
    {
      action: z
        .enum(["create", "update", "delete"])
        .describe("The operation to perform"),
      id: z
        .string()
        .optional()
        .describe("Ingredient ID (required for update and delete)"),
      name: z
        .string()
        .optional()
        .describe("Ingredient name (required for create)"),
      type: z
        .enum(INGREDIENT_TYPES)
        .optional()
        .describe("Ingredient category"),
    },
    async ({ action, id, name, type }) => {
      try {
        switch (action) {
          case "create": {
            if (!name)
              return {
                isError: true,
                content: [
                  { type: "text" as const, text: "name is required for create" },
                ],
              };
            const newId = nextId("ingredient", "ingredients");
            db.prepare(
              "INSERT INTO ingredients (id, name, type) VALUES (?, ?, ?)",
            ).run(newId, name, type ?? null);
            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify({ id: newId, name, type }),
                },
              ],
            };
          }
          case "update": {
            if (!id)
              return {
                isError: true,
                content: [
                  { type: "text" as const, text: "id is required for update" },
                ],
              };
            const fields: string[] = [];
            const values: unknown[] = [];
            if (name !== undefined) {
              fields.push("name = ?");
              values.push(name);
            }
            if (type !== undefined) {
              fields.push("type = ?");
              values.push(type);
            }
            if (fields.length === 0)
              return {
                isError: true,
                content: [
                  { type: "text" as const, text: "No fields to update" },
                ],
              };
            values.push(id);
            const result = db
              .prepare(
                `UPDATE ingredients SET ${fields.join(", ")} WHERE id = ?`,
              )
              .run(...values);
            if (result.changes === 0)
              return {
                isError: true,
                content: [
                  {
                    type: "text" as const,
                    text: `Ingredient ${id} not found`,
                  },
                ],
              };
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Updated ingredient ${id}`,
                },
              ],
            };
          }
          case "delete": {
            if (!id)
              return {
                isError: true,
                content: [
                  { type: "text" as const, text: "id is required for delete" },
                ],
              };
            db.prepare(
              "DELETE FROM step_ingredients WHERE ingredient_id = ?",
            ).run(id);
            const result = db
              .prepare("DELETE FROM ingredients WHERE id = ?")
              .run(id);
            if (result.changes === 0)
              return {
                isError: true,
                content: [
                  {
                    type: "text" as const,
                    text: `Ingredient ${id} not found`,
                  },
                ],
              };
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Deleted ingredient ${id}`,
                },
              ],
            };
          }
        }
      } catch (err) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `Error: ${(err as Error).message}`,
            },
          ],
        };
      }
    },
  );
}
