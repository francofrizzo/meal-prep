import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { db, nextId } from "../../server/db.js";

export function registerSessionTools(server: McpServer): void {
  server.tool(
    "manage_sessions",
    "Manage meal prep sessions and the batches produced during them. A session represents a day of meal prep; batches track how many servings of each recipe were produced.",
    {
      action: z
        .enum([
          "create_session",
          "update_session",
          "delete_session",
          "create_batch",
          "update_batch",
          "delete_batch",
        ])
        .describe("The operation to perform"),
      id: z
        .string()
        .optional()
        .describe(
          "Session ID (for update/delete_session) or Batch ID (for update/delete_batch)",
        ),
      date: z
        .string()
        .optional()
        .describe(
          "Session date in YYYY-MM-DD format (required for create_session)",
        ),
      notes: z.string().optional().describe("Session notes"),
      gantt: z
        .string()
        .optional()
        .describe(
          "Gantt diagram for the session in .gantt format (plain text DSL). Sections: VERSION 1, START/END HH:MM, LANES (one per line, e.g. 'Persona: 2', 'Horno', 'Hornalla: 4', 'Sartén Essen', 'Cacerola' — lanes represent people, equipment, or appliances), TASKS (pipe-separated: Name | Duration | Lane(s) | Color | Dependencies | @Start). Duration: 15m, 1h, 1h30m. Dependencies: 'after Task A, Task B'. Pinned time: '@09:30'. Lane specifiers: 'Persona' or 'Horno' (any available), 'Persona#1' or 'Hornalla#2' (specific sub-lane), 'Persona*2' (multiple simultaneously), 'Persona(P)' or 'Horno(P)' (passive, doesn't block).",
        ),
      session_id: z
        .string()
        .optional()
        .describe("Session ID (required for create_batch)"),
      recipe_id: z
        .string()
        .optional()
        .describe("Recipe ID (required for create_batch)"),
      servings_produced: z
        .number()
        .int()
        .optional()
        .describe("Number of servings produced (required for create_batch)"),
      prep_date: z
        .string()
        .optional()
        .describe(
          "Batch prep date in YYYY-MM-DD format (required for create_batch)",
        ),
    },
    async (args) => {
      try {
        switch (args.action) {
          case "create_session": {
            if (!args.date)
              return {
                isError: true,
                content: [
                  {
                    type: "text" as const,
                    text: "date is required for create_session",
                  },
                ],
              };
            const newId = nextId("session", "meal_prep_sessions");
            db.prepare(
              "INSERT INTO meal_prep_sessions (id, date, notes, gantt) VALUES (?, ?, ?, ?)",
            ).run(newId, args.date, args.notes ?? null, args.gantt ?? null);
            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify({
                    id: newId,
                    date: args.date,
                    notes: args.notes,
                    gantt: args.gantt,
                  }),
                },
              ],
            };
          }
          case "update_session": {
            if (!args.id)
              return {
                isError: true,
                content: [
                  {
                    type: "text" as const,
                    text: "id is required for update_session",
                  },
                ],
              };
            const fields: string[] = [];
            const values: unknown[] = [];
            if (args.date !== undefined) {
              fields.push("date = ?");
              values.push(args.date);
            }
            if (args.notes !== undefined) {
              fields.push("notes = ?");
              values.push(args.notes);
            }
            if (args.gantt !== undefined) {
              fields.push("gantt = ?");
              values.push(args.gantt);
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
              .prepare(
                `UPDATE meal_prep_sessions SET ${fields.join(", ")} WHERE id = ?`,
              )
              .run(...values);
            if (result.changes === 0)
              return {
                isError: true,
                content: [
                  {
                    type: "text" as const,
                    text: `Session ${args.id} not found`,
                  },
                ],
              };
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Updated session ${args.id}`,
                },
              ],
            };
          }
          case "delete_session": {
            if (!args.id)
              return {
                isError: true,
                content: [
                  {
                    type: "text" as const,
                    text: "id is required for delete_session",
                  },
                ],
              };
            const sessionId = args.id;
            const txn = db.transaction(() => {
              const batches = db
                .prepare("SELECT id FROM batches WHERE session_id = ?")
                .all(sessionId) as { id: string }[];
              if (batches.length > 0) {
                const ph = batches.map(() => "?").join(",");
                const batchIds = batches.map((b) => b.id);
                db.prepare(
                  `DELETE FROM consumptions WHERE batch_id IN (${ph})`,
                ).run(...batchIds);
              }
              db.prepare("DELETE FROM batches WHERE session_id = ?").run(
                sessionId,
              );
              return db
                .prepare("DELETE FROM meal_prep_sessions WHERE id = ?")
                .run(sessionId).changes;
            });
            const changes = txn();
            if (changes === 0)
              return {
                isError: true,
                content: [
                  {
                    type: "text" as const,
                    text: `Session ${args.id} not found`,
                  },
                ],
              };
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Deleted session ${args.id} and all its batches`,
                },
              ],
            };
          }
          case "create_batch": {
            if (!args.session_id)
              return {
                isError: true,
                content: [
                  {
                    type: "text" as const,
                    text: "session_id is required for create_batch",
                  },
                ],
              };
            if (!args.recipe_id)
              return {
                isError: true,
                content: [
                  {
                    type: "text" as const,
                    text: "recipe_id is required for create_batch",
                  },
                ],
              };
            if (args.servings_produced === undefined)
              return {
                isError: true,
                content: [
                  {
                    type: "text" as const,
                    text: "servings_produced is required for create_batch",
                  },
                ],
              };
            if (!args.prep_date)
              return {
                isError: true,
                content: [
                  {
                    type: "text" as const,
                    text: "prep_date is required for create_batch",
                  },
                ],
              };
            const newId = nextId("batch", "batches");
            db.prepare(
              "INSERT INTO batches (id, recipe_id, session_id, servings_produced, prep_date) VALUES (?, ?, ?, ?, ?)",
            ).run(
              newId,
              args.recipe_id,
              args.session_id,
              args.servings_produced,
              args.prep_date,
            );
            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify({
                    id: newId,
                    recipe_id: args.recipe_id,
                    session_id: args.session_id,
                    servings_produced: args.servings_produced,
                    prep_date: args.prep_date,
                  }),
                },
              ],
            };
          }
          case "update_batch": {
            if (!args.id)
              return {
                isError: true,
                content: [
                  {
                    type: "text" as const,
                    text: "id is required for update_batch",
                  },
                ],
              };
            const fields: string[] = [];
            const values: unknown[] = [];
            if (args.servings_produced !== undefined) {
              fields.push("servings_produced = ?");
              values.push(args.servings_produced);
            }
            if (args.prep_date !== undefined) {
              fields.push("prep_date = ?");
              values.push(args.prep_date);
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
              .prepare(
                `UPDATE batches SET ${fields.join(", ")} WHERE id = ?`,
              )
              .run(...values);
            if (result.changes === 0)
              return {
                isError: true,
                content: [
                  {
                    type: "text" as const,
                    text: `Batch ${args.id} not found`,
                  },
                ],
              };
            return {
              content: [
                { type: "text" as const, text: `Updated batch ${args.id}` },
              ],
            };
          }
          case "delete_batch": {
            if (!args.id)
              return {
                isError: true,
                content: [
                  {
                    type: "text" as const,
                    text: "id is required for delete_batch",
                  },
                ],
              };
            const batchId = args.id;
            const txn = db.transaction(() => {
              db.prepare(
                "DELETE FROM consumptions WHERE batch_id = ?",
              ).run(batchId);
              return db.prepare("DELETE FROM batches WHERE id = ?").run(
                batchId,
              ).changes;
            });
            const changes = txn();
            if (changes === 0)
              return {
                isError: true,
                content: [
                  {
                    type: "text" as const,
                    text: `Batch ${args.id} not found`,
                  },
                ],
              };
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Deleted batch ${args.id} and its consumption records`,
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
