import "dotenv/config";
import express from "express";
import path from "path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { initSchema } from "./db";
import sqlRoutes from "./routes/sql";
import chatRoutes from "./routes/chat";
import conversationRoutes from "./routes/conversations";
import exportRoutes from "./routes/export";

import { registerQueryTool } from "../mcp/tools/query.js";
import { registerRecipeTools } from "../mcp/tools/recipes.js";
import { registerStepTools } from "../mcp/tools/steps.js";
import { registerIngredientTools } from "../mcp/tools/ingredients.js";
import { registerResourceTools } from "../mcp/tools/resources.js";
import { registerPlanningTools } from "../mcp/tools/planning.js";
import { registerSessionTools } from "../mcp/tools/sessions.js";
import { registerConsumptionTools } from "../mcp/tools/consumption.js";
import { registerSchemaResource } from "../mcp/resources/schema.js";

function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "meal-prep",
    version: "1.0.0",
  });

  registerQueryTool(server);
  registerRecipeTools(server);
  registerStepTools(server);
  registerIngredientTools(server);
  registerResourceTools(server);
  registerPlanningTools(server);
  registerSessionTools(server);
  registerConsumptionTools(server);
  registerSchemaResource(server);

  return server;
}

const app = express();

app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "..", "public")));

initSchema();

app.use("/api/sql", sqlRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/conversations", conversationRoutes);
app.use("/api/export", exportRoutes);

// MCP endpoint — stateless: new server+transport per request
app.all("/mcp", async (req, res) => {
  const authToken = process.env.MCP_AUTH_TOKEN;
  if (authToken) {
    const header = req.headers.authorization;
    if (header !== `Bearer ${authToken}`) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
  }

  const server = createMcpServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
  await transport.close();
  await server.close();
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
