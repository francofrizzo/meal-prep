import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { db, nextId } from "../../server/db.js";

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export function registerPlanningTools(server: McpServer): void {
  server.tool(
    "manage_meal_plan",
    "Manage weekly meal plans. Create/update/delete weeks, and assign recipes to meal slots (day + meal type). set_meal_slot finds or creates the slot and replaces all its recipe assignments.",
    {
      action: z
        .enum([
          "create_week",
          "update_week",
          "delete_week",
          "set_meal_slot",
          "delete_meal_slot",
        ])
        .describe("The operation to perform"),
      id: z
        .string()
        .optional()
        .describe(
          "Week ID (for update_week, delete_week) or Slot ID (for delete_meal_slot)",
        ),
      start_date: z
        .string()
        .optional()
        .describe(
          "Week start date in YYYY-MM-DD format (required for create_week)",
        ),
      notes: z.string().optional().describe("Notes for the week"),
      week_id: z
        .string()
        .optional()
        .describe("Week ID (required for set_meal_slot)"),
      day_of_week: z
        .enum(DAYS)
        .optional()
        .describe("Day of the week (required for set_meal_slot)"),
      meal_type: z
        .enum(["lunch", "dinner"])
        .optional()
        .describe("Meal type (required for set_meal_slot)"),
      recipe_ids: z
        .array(z.string())
        .optional()
        .describe(
          "Recipe IDs to assign to the slot (required for set_meal_slot)",
        ),
    },
    async (args) => {
      try {
        switch (args.action) {
          case "create_week": {
            if (!args.start_date)
              return {
                isError: true,
                content: [
                  {
                    type: "text" as const,
                    text: "start_date is required for create_week",
                  },
                ],
              };
            const newId = nextId("week", "weeks");
            db.prepare(
              "INSERT INTO weeks (id, start_date, notes) VALUES (?, ?, ?)",
            ).run(newId, args.start_date, args.notes ?? null);
            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify({
                    id: newId,
                    start_date: args.start_date,
                    notes: args.notes,
                  }),
                },
              ],
            };
          }
          case "update_week": {
            if (!args.id)
              return {
                isError: true,
                content: [
                  {
                    type: "text" as const,
                    text: "id is required for update_week",
                  },
                ],
              };
            const fields: string[] = [];
            const values: unknown[] = [];
            if (args.start_date !== undefined) {
              fields.push("start_date = ?");
              values.push(args.start_date);
            }
            if (args.notes !== undefined) {
              fields.push("notes = ?");
              values.push(args.notes);
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
              .prepare(`UPDATE weeks SET ${fields.join(", ")} WHERE id = ?`)
              .run(...values);
            if (result.changes === 0)
              return {
                isError: true,
                content: [
                  {
                    type: "text" as const,
                    text: `Week ${args.id} not found`,
                  },
                ],
              };
            return {
              content: [
                { type: "text" as const, text: `Updated week ${args.id}` },
              ],
            };
          }
          case "delete_week": {
            if (!args.id)
              return {
                isError: true,
                content: [
                  {
                    type: "text" as const,
                    text: "id is required for delete_week",
                  },
                ],
              };
            const weekId = args.id;
            const txn = db.transaction(() => {
              const slots = db
                .prepare(
                  "SELECT id FROM meal_plan_slots WHERE week_id = ?",
                )
                .all(weekId) as { id: string }[];
              if (slots.length > 0) {
                const ph = slots.map(() => "?").join(",");
                const slotIds = slots.map((s) => s.id);
                db.prepare(
                  `DELETE FROM meal_plan_slot_recipes WHERE slot_id IN (${ph})`,
                ).run(...slotIds);
              }
              db.prepare(
                "DELETE FROM meal_plan_slots WHERE week_id = ?",
              ).run(weekId);
              return db.prepare("DELETE FROM weeks WHERE id = ?").run(weekId)
                .changes;
            });
            const changes = txn();
            if (changes === 0)
              return {
                isError: true,
                content: [
                  {
                    type: "text" as const,
                    text: `Week ${args.id} not found`,
                  },
                ],
              };
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Deleted week ${args.id} and all its meal slots`,
                },
              ],
            };
          }
          case "set_meal_slot": {
            if (!args.week_id)
              return {
                isError: true,
                content: [
                  {
                    type: "text" as const,
                    text: "week_id is required for set_meal_slot",
                  },
                ],
              };
            if (!args.day_of_week)
              return {
                isError: true,
                content: [
                  {
                    type: "text" as const,
                    text: "day_of_week is required for set_meal_slot",
                  },
                ],
              };
            if (!args.meal_type)
              return {
                isError: true,
                content: [
                  {
                    type: "text" as const,
                    text: "meal_type is required for set_meal_slot",
                  },
                ],
              };
            if (!args.recipe_ids)
              return {
                isError: true,
                content: [
                  {
                    type: "text" as const,
                    text: "recipe_ids is required for set_meal_slot",
                  },
                ],
              };
            const txn = db.transaction(() => {
              const slot = db
                .prepare(
                  "SELECT id FROM meal_plan_slots WHERE week_id = ? AND day_of_week = ? AND meal_type = ?",
                )
                .get(args.week_id!, args.day_of_week!, args.meal_type!) as
                | { id: string }
                | undefined;

              let slotId: string;
              if (slot) {
                slotId = slot.id;
                db.prepare(
                  "DELETE FROM meal_plan_slot_recipes WHERE slot_id = ?",
                ).run(slotId);
              } else {
                slotId = nextId("slot", "meal_plan_slots");
                db.prepare(
                  "INSERT INTO meal_plan_slots (id, week_id, day_of_week, meal_type) VALUES (?, ?, ?, ?)",
                ).run(
                  slotId,
                  args.week_id!,
                  args.day_of_week!,
                  args.meal_type!,
                );
              }

              const insert = db.prepare(
                "INSERT INTO meal_plan_slot_recipes (slot_id, recipe_id) VALUES (?, ?)",
              );
              for (const recipeId of args.recipe_ids!) {
                insert.run(slotId, recipeId);
              }
              return slotId;
            });
            const slotId = txn();
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Set ${args.recipe_ids.length} recipes for ${args.day_of_week} ${args.meal_type} (slot ${slotId})`,
                },
              ],
            };
          }
          case "delete_meal_slot": {
            if (!args.id)
              return {
                isError: true,
                content: [
                  {
                    type: "text" as const,
                    text: "id is required for delete_meal_slot",
                  },
                ],
              };
            const slotId = args.id;
            const txn = db.transaction(() => {
              db.prepare(
                "DELETE FROM meal_plan_slot_recipes WHERE slot_id = ?",
              ).run(slotId);
              return db
                .prepare("DELETE FROM meal_plan_slots WHERE id = ?")
                .run(slotId).changes;
            });
            const changes = txn();
            if (changes === 0)
              return {
                isError: true,
                content: [
                  {
                    type: "text" as const,
                    text: `Meal slot ${args.id} not found`,
                  },
                ],
              };
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Deleted meal slot ${args.id}`,
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
