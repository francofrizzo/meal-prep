import { Router, Request, Response } from "express";
import { db } from "../db";
import { SqlResult } from "../types";

const router = Router();

router.post("/", (req: Request, res: Response) => {
  const { query } = req.body as { query?: string };

  if (!query) {
    res.status(400).json({ error: "Query is required" });
    return;
  }

  const statements = query.split(";").filter((s: string) => s.trim());
  const results: SqlResult[] = [];
  let processed = 0;

  statements.forEach((stmt: string, idx: number) => {
    const trimmed = stmt.trim();
    if (!trimmed) {
      processed++;
      return;
    }

    const isSelect = /^\s*SELECT/i.test(trimmed);

    if (isSelect) {
      db.all(trimmed, [], (err, rows) => {
        if (err) {
          results[idx] = { error: err.message };
        } else {
          results[idx] = { rows: rows as Record<string, unknown>[], changes: 0 };
        }
        processed++;
        if (processed === statements.length) {
          res.json(results.length === 1 ? results[0] : results);
        }
      });
    } else {
      db.run(trimmed, [], function (err) {
        if (err) {
          results[idx] = { error: err.message };
        } else {
          results[idx] = { changes: this.changes, lastID: this.lastID };
        }
        processed++;
        if (processed === statements.length) {
          res.json(results.length === 1 ? results[0] : results);
        }
      });
    }
  });
});

export default router;
