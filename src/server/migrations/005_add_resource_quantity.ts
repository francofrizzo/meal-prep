export default {
  id: 5,
  name: "add_resource_quantity",
  sql: `
    ALTER TABLE step_resource_usage ADD COLUMN quantity INTEGER NOT NULL DEFAULT 1;
  `,
};
