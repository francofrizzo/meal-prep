import { Router, Request, Response } from "express";
import { dbRun, dbAll } from "../db";
import { SqlResult } from "../types";

const router = Router();

router.post("/", async (req: Request, res: Response) => {
  const { query } = req.body as { query?: string };

  if (!query) {
    res.status(400).json({ error: "Query is required" });
    return;
  }

  const statements = splitStatements(query);
  const results: SqlResult[] = [];

  for (const stmt of statements) {
    const trimmed = stmt.trim();
    if (!trimmed) continue;

    const isSelect = /^\s*SELECT/i.test(trimmed);

    try {
      if (isSelect) {
        const rows = await dbAll(trimmed);
        results.push({ rows, changes: 0 });
      } else {
        const result = await dbRun(trimmed);
        results.push({ changes: result.changes, lastID: result.lastID });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      results.push({ error: message });
    }
  }

  res.json(results.length === 1 ? results[0] : results);
});

function splitStatements(sql: string): string[] {
  const stmts: string[] = [];
  let current = "";
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
    } else if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
    } else if (ch === ";" && !inSingle && !inDouble) {
      if (current.trim()) stmts.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim()) stmts.push(current.trim());
  return stmts;
}

export default router;
