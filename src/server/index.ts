import "dotenv/config";
import express from "express";
import path from "path";
import { initSchema } from "./db";
import sqlRoutes from "./routes/sql";
import chatRoutes from "./routes/chat";
import conversationRoutes from "./routes/conversations";
import exportRoutes from "./routes/export";

// Loaded at runtime from the esbuild-bundled MCP setup
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { handleMcpRequest } = require("../mcp/setup.js") as {
  handleMcpRequest: (
    req: import("http").IncomingMessage,
    res: import("http").ServerResponse,
    body: unknown,
  ) => Promise<void>;
};

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

  await handleMcpRequest(req, res, req.body);
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
