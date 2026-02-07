import { Router, Request, Response } from "express";
import { dbAll, dbRun, dbGet } from "../db";
import { ConversationRow } from "../types";

const router = Router();

router.get("/", (_req: Request, res: Response) => {
  try {
    const rows = dbAll<Omit<ConversationRow, "history">>(
      "SELECT id, title, created_at, updated_at FROM conversations ORDER BY updated_at DESC",
    );
    res.json(rows);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

router.post("/", (req: Request, res: Response) => {
  const { id, title, history } = req.body as {
    id: string;
    title: string;
    history: unknown[];
  };

  try {
    dbRun(
      "INSERT OR REPLACE INTO conversations (id, title, history, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)",
      [id, title, JSON.stringify(history)],
    );
    res.json({ id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

router.get("/:id", (req: Request, res: Response) => {
  try {
    const row = dbGet<ConversationRow>("SELECT * FROM conversations WHERE id = ?", [
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

router.delete("/:id", (req: Request, res: Response) => {
  try {
    const result = dbRun("DELETE FROM conversations WHERE id = ?", [req.params.id]);
    res.json({ deleted: result.changes > 0 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

export default router;
