import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { db, nextId } from "../../server/db.js";

export function registerConsumptionTools(server: McpServer): void {
  server.tool(
    "manage_consumption",
    "Record, update, or delete consumption entries that track servings eaten from batches.",
    {
      action: z
        .enum(["create", "update", "delete"])
        .describe("The operation to perform"),
      id: z
        .string()
        .optional()
        .describe("Consumption ID (required for update and delete)"),
      batch_id: z
        .string()
        .optional()
        .describe("Batch ID (required for create)"),
      servings_consumed: z
        .number()
        .int()
        .optional()
        .describe("Number of servings consumed (required for create)"),
      consumption_date: z
        .string()
        .optional()
        .describe(
          "Date of consumption in YYYY-MM-DD format (required for create)",
        ),
    },
    async ({ action, id, batch_id, servings_consumed, consumption_date }) => {
      try {
        switch (action) {
          case "create": {
            if (!batch_id)
              return {
                isError: true,
                content: [
                  {
                    type: "text" as const,
                    text: "batch_id is required for create",
                  },
                ],
              };
            if (servings_consumed === undefined)
              return {
                isError: true,
                content: [
                  {
                    type: "text" as const,
                    text: "servings_consumed is required for create",
                  },
                ],
              };
            if (!consumption_date)
              return {
                isError: true,
                content: [
                  {
                    type: "text" as const,
                    text: "consumption_date is required for create",
                  },
                ],
              };
            const newId = nextId("consumption", "consumptions");
            db.prepare(
              "INSERT INTO consumptions (id, batch_id, servings_consumed, consumption_date) VALUES (?, ?, ?, ?)",
            ).run(newId, batch_id, servings_consumed, consumption_date);
            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify({
                    id: newId,
                    batch_id,
                    servings_consumed,
                    consumption_date,
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
            if (servings_consumed !== undefined) {
              fields.push("servings_consumed = ?");
              values.push(servings_consumed);
            }
            if (consumption_date !== undefined) {
              fields.push("consumption_date = ?");
              values.push(consumption_date);
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
                `UPDATE consumptions SET ${fields.join(", ")} WHERE id = ?`,
              )
              .run(...values);
            if (result.changes === 0)
              return {
                isError: true,
                content: [
                  {
                    type: "text" as const,
                    text: `Consumption ${id} not found`,
                  },
                ],
              };
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Updated consumption ${id}`,
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
            const result = db
              .prepare("DELETE FROM consumptions WHERE id = ?")
              .run(id);
            if (result.changes === 0)
              return {
                isError: true,
                content: [
                  {
                    type: "text" as const,
                    text: `Consumption ${id} not found`,
                  },
                ],
              };
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Deleted consumption ${id}`,
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
