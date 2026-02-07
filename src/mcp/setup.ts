import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { IncomingMessage, ServerResponse } from "node:http";

import { registerQueryTool } from "./tools/query.js";
import { registerRecipeTools } from "./tools/recipes.js";
import { registerStepTools } from "./tools/steps.js";
import { registerIngredientTools } from "./tools/ingredients.js";
import { registerResourceTools } from "./tools/resources.js";
import { registerPlanningTools } from "./tools/planning.js";
import { registerSessionTools } from "./tools/sessions.js";
import { registerConsumptionTools } from "./tools/consumption.js";
import { registerSchemaResource } from "./resources/schema.js";

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

export async function handleMcpRequest(
  req: IncomingMessage,
  res: ServerResponse,
  body: unknown,
): Promise<void> {
  const server = createMcpServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  await server.connect(transport);
  await transport.handleRequest(req, res, body);
  await transport.close();
  await server.close();
}
