import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { db } from "../../server/db.js";

export function registerSchemaResource(server: McpServer): void {
  server.resource(
    "schema",
    "mealprep://schema",
    { description: "Complete database schema for all meal-prep tables (excludes conversations)" },
    async (uri) => {
      const tables = db
        .prepare(
          "SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name != 'conversations' ORDER BY name",
        )
        .all() as { name: string; sql: string }[];

      const schema = tables.map((t) => t.sql).join(";\n\n") + ";";

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "text/plain",
            text: schema,
          },
        ],
      };
    },
  );
}
