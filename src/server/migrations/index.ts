import migration001 from "./001_initial_schema.js";
import migration002 from "./002_stock_views.js";
import migration003 from "./003_add_has_meal_prep_steps.js";
import migration004 from "./004_add_session_gantt.js";
import migration005 from "./005_add_resource_quantity.js";

export interface Migration {
  id: number;
  name: string;
  sql: string;
}

const migrations: Migration[] = [migration001, migration002, migration003, migration004, migration005];

export default migrations;
