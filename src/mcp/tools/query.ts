import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { db } from "../../server/db.js";

const READ_ONLY_PATTERN = /^\s*(SELECT|WITH|EXPLAIN)\b/i;

export function registerQueryTool(server: McpServer): void {
  server.tool(
    "query",
    "Execute a read-only SQL query against the meal-prep database. Supports SELECT, WITH...SELECT, and EXPLAIN statements. Use the mealprep://schema resource to discover table structures.",
    { sql: z.string().describe("The SQL query to execute (read-only)") },
    async ({ sql }) => {
      if (!READ_ONLY_PATTERN.test(sql)) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: "Only read-only queries are allowed (SELECT, WITH, EXPLAIN).",
            },
          ],
        };
      }

      try {
        const rows = db.prepare(sql).all();
        return {
          content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
        };
      } catch (err) {
        return {
          isError: true,
          content: [
            { type: "text", text: `SQL error: ${(err as Error).message}` },
          ],
        };
      }
    },
  );
}
