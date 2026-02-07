import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { db, nextId } from "../../server/db.js";

export function registerRecipeTools(server: McpServer): void {
  server.tool(
    "manage_recipes",
    "Create, update, or delete recipes. Deleting a recipe cascades to its steps, ingredient/resource associations, batches, and meal plan references.",
    {
      action: z
        .enum(["create", "update", "delete"])
        .describe("The operation to perform"),
      id: z
        .string()
        .optional()
        .describe("Recipe ID (required for update and delete)"),
      name: z
        .string()
        .optional()
        .describe("Recipe name (required for create)"),
      type: z.enum(["main", "side", "base"]).optional().describe("Recipe type"),
      servings: z.number().int().optional().describe("Number of servings"),
      yield_amount: z.number().optional().describe("Yield amount"),
      yield_unit: z
        .string()
        .optional()
        .describe("Yield unit (e.g. 'grams', 'ml')"),
      frozen_shelf_life_days: z
        .number()
        .int()
        .optional()
        .describe("Days the recipe lasts frozen"),
      fridge_shelf_life_days: z
        .number()
        .int()
        .optional()
        .describe("Days the recipe lasts in the fridge"),
    },
    async ({
      action,
      id,
      name,
      type,
      servings,
      yield_amount,
      yield_unit,
      frozen_shelf_life_days,
      fridge_shelf_life_days,
    }) => {
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
            const newId = nextId("recipe", "recipes");
            db.prepare(
              `INSERT INTO recipes (id, name, type, servings, yield_amount, yield_unit, frozen_shelf_life_days, fridge_shelf_life_days)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            ).run(
              newId,
              name,
              type ?? null,
              servings ?? null,
              yield_amount ?? null,
              yield_unit ?? null,
              frozen_shelf_life_days ?? null,
              fridge_shelf_life_days ?? null,
            );
            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify({
                    id: newId,
                    name,
                    type,
                    servings,
                    yield_amount,
                    yield_unit,
                    frozen_shelf_life_days,
                    fridge_shelf_life_days,
                  }),
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
            if (servings !== undefined) {
              fields.push("servings = ?");
              values.push(servings);
            }
            if (yield_amount !== undefined) {
              fields.push("yield_amount = ?");
              values.push(yield_amount);
            }
            if (yield_unit !== undefined) {
              fields.push("yield_unit = ?");
              values.push(yield_unit);
            }
            if (frozen_shelf_life_days !== undefined) {
              fields.push("frozen_shelf_life_days = ?");
              values.push(frozen_shelf_life_days);
            }
            if (fridge_shelf_life_days !== undefined) {
              fields.push("fridge_shelf_life_days = ?");
              values.push(fridge_shelf_life_days);
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
              .prepare(`UPDATE recipes SET ${fields.join(", ")} WHERE id = ?`)
              .run(...values);
            if (result.changes === 0)
              return {
                isError: true,
                content: [
                  {
                    type: "text" as const,
                    text: `Recipe ${id} not found`,
                  },
                ],
              };
            return {
              content: [
                { type: "text" as const, text: `Updated recipe ${id}` },
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
            const txn = db.transaction(() => {
              const steps = db
                .prepare("SELECT id FROM steps WHERE recipe_id = ?")
                .all(id) as { id: string }[];
              const stepIds = steps.map((s) => s.id);
              if (stepIds.length > 0) {
                const ph = stepIds.map(() => "?").join(",");
                db.prepare(
                  `DELETE FROM step_dependencies WHERE step_id IN (${ph}) OR depends_on_step_id IN (${ph})`,
                ).run(...stepIds, ...stepIds);
                db.prepare(
                  `DELETE FROM step_ingredients WHERE step_id IN (${ph})`,
                ).run(...stepIds);
                db.prepare(
                  `DELETE FROM step_resource_usage WHERE step_id IN (${ph})`,
                ).run(...stepIds);
              }
              db.prepare("DELETE FROM steps WHERE recipe_id = ?").run(id);
              const batches = db
                .prepare("SELECT id FROM batches WHERE recipe_id = ?")
                .all(id) as { id: string }[];
              if (batches.length > 0) {
                const bph = batches.map(() => "?").join(",");
                const batchIds = batches.map((b) => b.id);
                db.prepare(
                  `DELETE FROM consumptions WHERE batch_id IN (${bph})`,
                ).run(...batchIds);
              }
              db.prepare("DELETE FROM batches WHERE recipe_id = ?").run(id);
              db.prepare(
                "DELETE FROM meal_plan_slot_recipes WHERE recipe_id = ?",
              ).run(id);
              return db.prepare("DELETE FROM recipes WHERE id = ?").run(id)
                .changes;
            });
            const changes = txn();
            if (changes === 0)
              return {
                isError: true,
                content: [
                  {
                    type: "text" as const,
                    text: `Recipe ${id} not found`,
                  },
                ],
              };
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Deleted recipe ${id} and all associated data`,
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
