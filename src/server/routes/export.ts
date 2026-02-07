import { Router, Request, Response } from "express";
import { dbAll } from "../db";
import { TableSchema, TableName } from "../types";

const router = Router();

router.get("/sql", (_req: Request, res: Response) => {
  try {
    const dump: string[] = [];

    const tables = dbAll<TableSchema>(
      "SELECT sql FROM sqlite_master WHERE type='table' AND sql IS NOT NULL",
    );
    tables.forEach((t) => dump.push(t.sql + ";"));

    const tableNames = dbAll<TableName>("SELECT name FROM sqlite_master WHERE type='table'");

    for (const { name } of tableNames) {
      const rows = dbAll<Record<string, unknown>>(`SELECT * FROM ${name}`);
      rows.forEach((row) => {
        const cols = Object.keys(row);
        const vals = cols.map((c) => {
          const v = row[c];
          return v === null ? "NULL" : typeof v === "string" ? `'${v.replace(/'/g, "''")}'` : v;
        });
        dump.push(`INSERT INTO ${name} (${cols.join(",")}) VALUES (${vals.join(",")});`);
      });
    }

    res.type("text/plain").send(dump.join("\n"));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

export default router;
