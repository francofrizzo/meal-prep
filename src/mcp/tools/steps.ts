import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { db, nextId } from "../../server/db.js";

export function registerStepTools(server: McpServer): void {
  server.tool(
    "manage_steps",
    "Manage recipe steps and their associations. Create/update/delete steps, and set their dependencies, ingredient usage, and resource usage. The set_* actions replace all existing associations for the given step.",
    {
      action: z
        .enum([
          "create",
          "update",
          "delete",
          "set_dependencies",
          "set_ingredients",
          "set_resources",
        ])
        .describe("The operation to perform"),
      id: z
        .string()
        .optional()
        .describe(
          "Step ID (required for update, delete, set_dependencies, set_ingredients, set_resources)",
        ),
      recipe_id: z
        .string()
        .optional()
        .describe("Recipe ID (required for create)"),
      description: z
        .string()
        .optional()
        .describe("Step description (required for create)"),
      phase: z
        .enum(["meal-prep", "day-of-eating"])
        .optional()
        .describe("When this step happens"),
      order_num: z
        .number()
        .int()
        .optional()
        .describe("Step order within the recipe"),
      duration_minutes: z
        .number()
        .int()
        .optional()
        .describe("How long this step takes in minutes"),
      depends_on_step_ids: z
        .array(z.string())
        .optional()
        .describe(
          "Step IDs this step depends on (for set_dependencies — replaces all existing)",
        ),
      ingredients: z
        .array(
          z.object({
            ingredient_id: z.string(),
            quantity: z.string().optional(),
            unit: z.string().optional(),
          }),
        )
        .optional()
        .describe(
          "Ingredients used in this step (for set_ingredients — replaces all existing)",
        ),
      resources: z
        .array(
          z.object({
            resource_id: z.string(),
            temperature_celsius: z.number().int().optional(),
            notes: z.string().optional(),
          }),
        )
        .optional()
        .describe(
          "Resources used in this step (for set_resources — replaces all existing)",
        ),
    },
    async (args) => {
      try {
        switch (args.action) {
          case "create": {
            if (!args.recipe_id)
              return {
                isError: true,
                content: [
                  {
                    type: "text" as const,
                    text: "recipe_id is required for create",
                  },
                ],
              };
            if (!args.description)
              return {
                isError: true,
                content: [
                  {
                    type: "text" as const,
                    text: "description is required for create",
                  },
                ],
              };
            const newId = nextId("step", "steps");
            db.prepare(
              `INSERT INTO steps (id, recipe_id, description, phase, order_num, duration_minutes)
               VALUES (?, ?, ?, ?, ?, ?)`,
            ).run(
              newId,
              args.recipe_id,
              args.description,
              args.phase ?? null,
              args.order_num ?? null,
              args.duration_minutes ?? null,
            );
            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify({
                    id: newId,
                    recipe_id: args.recipe_id,
                    description: args.description,
                    phase: args.phase,
                    order_num: args.order_num,
                    duration_minutes: args.duration_minutes,
                  }),
                },
              ],
            };
          }
          case "update": {
            if (!args.id)
              return {
                isError: true,
                content: [
                  { type: "text" as const, text: "id is required for update" },
                ],
              };
            const fields: string[] = [];
            const values: unknown[] = [];
            if (args.description !== undefined) {
              fields.push("description = ?");
              values.push(args.description);
            }
            if (args.phase !== undefined) {
              fields.push("phase = ?");
              values.push(args.phase);
            }
            if (args.order_num !== undefined) {
              fields.push("order_num = ?");
              values.push(args.order_num);
            }
            if (args.duration_minutes !== undefined) {
              fields.push("duration_minutes = ?");
              values.push(args.duration_minutes);
            }
            if (fields.length === 0)
              return {
                isError: true,
                content: [
                  { type: "text" as const, text: "No fields to update" },
                ],
              };
            values.push(args.id);
            const result = db
              .prepare(`UPDATE steps SET ${fields.join(", ")} WHERE id = ?`)
              .run(...values);
            if (result.changes === 0)
              return {
                isError: true,
                content: [
                  {
                    type: "text" as const,
                    text: `Step ${args.id} not found`,
                  },
                ],
              };
            return {
              content: [
                { type: "text" as const, text: `Updated step ${args.id}` },
              ],
            };
          }
          case "delete": {
            if (!args.id)
              return {
                isError: true,
                content: [
                  { type: "text" as const, text: "id is required for delete" },
                ],
              };
            const stepId = args.id;
            const txn = db.transaction(() => {
              db.prepare(
                "DELETE FROM step_dependencies WHERE step_id = ? OR depends_on_step_id = ?",
              ).run(stepId, stepId);
              db.prepare(
                "DELETE FROM step_ingredients WHERE step_id = ?",
              ).run(stepId);
              db.prepare(
                "DELETE FROM step_resource_usage WHERE step_id = ?",
              ).run(stepId);
              return db.prepare("DELETE FROM steps WHERE id = ?").run(stepId)
                .changes;
            });
            const changes = txn();
            if (changes === 0)
              return {
                isError: true,
                content: [
                  {
                    type: "text" as const,
                    text: `Step ${args.id} not found`,
                  },
                ],
              };
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Deleted step ${args.id} and its associations`,
                },
              ],
            };
          }
          case "set_dependencies": {
            if (!args.id)
              return {
                isError: true,
                content: [
                  {
                    type: "text" as const,
                    text: "id is required for set_dependencies",
                  },
                ],
              };
            if (!args.depends_on_step_ids)
              return {
                isError: true,
                content: [
                  {
                    type: "text" as const,
                    text: "depends_on_step_ids is required for set_dependencies",
                  },
                ],
              };
            const stepId = args.id;
            const deps = args.depends_on_step_ids;
            const txn = db.transaction(() => {
              db.prepare(
                "DELETE FROM step_dependencies WHERE step_id = ?",
              ).run(stepId);
              const insert = db.prepare(
                "INSERT INTO step_dependencies (step_id, depends_on_step_id) VALUES (?, ?)",
              );
              for (const depId of deps) {
                insert.run(stepId, depId);
              }
            });
            txn();
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Set ${deps.length} dependencies for step ${stepId}`,
                },
              ],
            };
          }
          case "set_ingredients": {
            if (!args.id)
              return {
                isError: true,
                content: [
                  {
                    type: "text" as const,
                    text: "id is required for set_ingredients",
                  },
                ],
              };
            if (!args.ingredients)
              return {
                isError: true,
                content: [
                  {
                    type: "text" as const,
                    text: "ingredients is required for set_ingredients",
                  },
                ],
              };
            const stepId = args.id;
            const ings = args.ingredients;
            const txn = db.transaction(() => {
              db.prepare(
                "DELETE FROM step_ingredients WHERE step_id = ?",
              ).run(stepId);
              const insert = db.prepare(
                "INSERT INTO step_ingredients (step_id, ingredient_id, quantity, unit) VALUES (?, ?, ?, ?)",
              );
              for (const ing of ings) {
                insert.run(
                  stepId,
                  ing.ingredient_id,
                  ing.quantity ?? null,
                  ing.unit ?? null,
                );
              }
            });
            txn();
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Set ${ings.length} ingredients for step ${stepId}`,
                },
              ],
            };
          }
          case "set_resources": {
            if (!args.id)
              return {
                isError: true,
                content: [
                  {
                    type: "text" as const,
                    text: "id is required for set_resources",
                  },
                ],
              };
            if (!args.resources)
              return {
                isError: true,
                content: [
                  {
                    type: "text" as const,
                    text: "resources is required for set_resources",
                  },
                ],
              };
            const stepId = args.id;
            const res = args.resources;
            const txn = db.transaction(() => {
              db.prepare(
                "DELETE FROM step_resource_usage WHERE step_id = ?",
              ).run(stepId);
              const insert = db.prepare(
                "INSERT INTO step_resource_usage (step_id, resource_id, temperature_celsius, notes) VALUES (?, ?, ?, ?)",
              );
              for (const r of res) {
                insert.run(
                  stepId,
                  r.resource_id,
                  r.temperature_celsius ?? null,
                  r.notes ?? null,
                );
              }
            });
            txn();
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Set ${res.length} resources for step ${stepId}`,
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
