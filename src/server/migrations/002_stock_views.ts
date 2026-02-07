export default {
  id: 2,
  name: "stock_views",
  sql: `
    CREATE VIEW IF NOT EXISTS batch_stock AS
    SELECT
      b.id AS batch_id,
      b.recipe_id,
      r.name AS recipe_name,
      r.type AS recipe_type,
      b.session_id,
      b.prep_date,
      b.servings_produced,
      COALESCE(SUM(c.servings_consumed), 0) AS servings_consumed,
      b.servings_produced - COALESCE(SUM(c.servings_consumed), 0) AS servings_remaining,
      DATE(b.prep_date, '+' || r.fridge_shelf_life_days || ' days') AS fridge_expiry,
      DATE(b.prep_date, '+' || r.frozen_shelf_life_days || ' days') AS freezer_expiry
    FROM batches b
    JOIN recipes r ON r.id = b.recipe_id
    LEFT JOIN consumptions c ON c.batch_id = b.id
    GROUP BY b.id;

    CREATE VIEW IF NOT EXISTS recipe_stock AS
    SELECT
      recipe_id,
      recipe_name,
      recipe_type,
      SUM(servings_remaining) AS total_servings_remaining,
      MIN(prep_date) AS oldest_batch_date,
      MAX(prep_date) AS newest_batch_date,
      COUNT(*) AS batch_count
    FROM batch_stock
    WHERE servings_remaining > 0
    GROUP BY recipe_id;
  `,
};
