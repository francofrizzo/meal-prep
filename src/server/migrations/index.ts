import migration001 from "./001_initial_schema.js";
import migration002 from "./002_stock_views.js";

export interface Migration {
  id: number;
  name: string;
  sql: string;
}

const migrations: Migration[] = [migration001, migration002];

export default migrations;
