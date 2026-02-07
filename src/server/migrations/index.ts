import migration001 from "./001_initial_schema.js";
import migration002 from "./002_stock_views.js";
import migration003 from "./003_add_has_meal_prep_steps.js";

export interface Migration {
  id: number;
  name: string;
  sql: string;
}

const migrations: Migration[] = [migration001, migration002, migration003];

export default migrations;
