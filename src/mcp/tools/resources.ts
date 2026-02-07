import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { db, nextId } from "../../server/db.js";

export function registerResourceTools(server: McpServer): void {
  server.tool(
    "manage_resources",
    "Create, update, or delete kitchen resources (oven, pan, pot, stove) used in recipe steps. Deleting a resource also removes all step_resource_usage references to it.",
    {
      action: z
        .enum(["create", "update", "delete"])
        .describe("The operation to perform"),
      id: z
        .string()
        .optional()
        .describe("Resource ID (required for update and delete)"),
      name: z
        .string()
        .optional()
        .describe("Resource name (required for create)"),
      type: z
        .enum(["oven", "pan", "pot", "stove"])
        .optional()
        .describe("Resource type"),
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
            const newId = nextId("resource", "resources");
            db.prepare(
              "INSERT INTO resources (id, name, type) VALUES (?, ?, ?)",
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
                `UPDATE resources SET ${fields.join(", ")} WHERE id = ?`,
              )
              .run(...values);
            if (result.changes === 0)
              return {
                isError: true,
                content: [
                  {
                    type: "text" as const,
                    text: `Resource ${id} not found`,
                  },
                ],
              };
            return {
              content: [
                { type: "text" as const, text: `Updated resource ${id}` },
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
              "DELETE FROM step_resource_usage WHERE resource_id = ?",
            ).run(id);
            const result = db
              .prepare("DELETE FROM resources WHERE id = ?")
              .run(id);
            if (result.changes === 0)
              return {
                isError: true,
                content: [
                  {
                    type: "text" as const,
                    text: `Resource ${id} not found`,
                  },
                ],
              };
            return {
              content: [
                { type: "text" as const, text: `Deleted resource ${id}` },
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
