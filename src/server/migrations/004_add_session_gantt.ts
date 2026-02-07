export default {
  id: 4,
  name: "add_session_gantt",
  sql: `
    ALTER TABLE meal_prep_sessions ADD COLUMN gantt TEXT;
  `,
};
