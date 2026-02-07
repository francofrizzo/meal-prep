import "dotenv/config";
import express from "express";
import path from "path";
import { initSchema } from "./db";
import sqlRoutes from "./routes/sql";
import chatRoutes from "./routes/chat";
import conversationRoutes from "./routes/conversations";
import exportRoutes from "./routes/export";

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

initSchema();

app.use("/api/sql", sqlRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/conversations", conversationRoutes);
app.use("/api/export", exportRoutes);

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
