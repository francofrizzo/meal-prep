import { Router, Request, Response } from "express";
import { dbAll, dbRun, dbGet } from "../db";
import { ConversationRow } from "../types";

const router = Router();

router.get("/", async (_req: Request, res: Response) => {
  try {
    const rows = await dbAll<Omit<ConversationRow, "history">>(
      "SELECT id, title, created_at, updated_at FROM conversations ORDER BY updated_at DESC",
    );
    res.json(rows);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

router.post("/", async (req: Request, res: Response) => {
  const { id, title, history } = req.body as {
    id: string;
    title: string;
    history: unknown[];
  };

  try {
    await dbRun(
      "INSERT OR REPLACE INTO conversations (id, title, history, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)",
      [id, title, JSON.stringify(history)],
    );
    res.json({ id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const row = await dbGet<ConversationRow>("SELECT * FROM conversations WHERE id = ?", [
      req.params.id,
    ]);
    if (!row) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }
    res.json({ ...row, history: JSON.parse(row.history) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const result = await dbRun("DELETE FROM conversations WHERE id = ?", [req.params.id]);
    res.json({ deleted: result.changes > 0 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

export default router;
