export default {
  id: 3,
  name: "add_has_meal_prep_steps",
  sql: `
    -- Add the boolean column (SQLite uses INTEGER: 0 = false, 1 = true)
    ALTER TABLE recipes ADD COLUMN has_meal_prep_steps INTEGER DEFAULT 0 NOT NULL;

    -- Backfill existing recipes: set to 1 if they have any meal-prep steps
    UPDATE recipes
    SET has_meal_prep_steps = 1
    WHERE id IN (
      SELECT DISTINCT recipe_id
      FROM steps
      WHERE phase = 'meal-prep'
    );

    -- Trigger to update has_meal_prep_steps when steps are inserted
    CREATE TRIGGER IF NOT EXISTS update_has_meal_prep_steps_on_insert
    AFTER INSERT ON steps
    BEGIN
      UPDATE recipes
      SET has_meal_prep_steps = CASE
        WHEN EXISTS (
          SELECT 1 FROM steps
          WHERE recipe_id = NEW.recipe_id AND phase = 'meal-prep'
        ) THEN 1
        ELSE 0
      END
      WHERE id = NEW.recipe_id;
    END;

    -- Trigger to update has_meal_prep_steps when steps are updated
    CREATE TRIGGER IF NOT EXISTS update_has_meal_prep_steps_on_update
    AFTER UPDATE OF phase ON steps
    BEGIN
      UPDATE recipes
      SET has_meal_prep_steps = CASE
        WHEN EXISTS (
          SELECT 1 FROM steps
          WHERE recipe_id = NEW.recipe_id AND phase = 'meal-prep'
        ) THEN 1
        ELSE 0
      END
      WHERE id = NEW.recipe_id;
    END;

    -- Trigger to update has_meal_prep_steps when steps are deleted
    CREATE TRIGGER IF NOT EXISTS update_has_meal_prep_steps_on_delete
    AFTER DELETE ON steps
    BEGIN
      UPDATE recipes
      SET has_meal_prep_steps = CASE
        WHEN EXISTS (
          SELECT 1 FROM steps
          WHERE recipe_id = OLD.recipe_id AND phase = 'meal-prep'
        ) THEN 1
        ELSE 0
      END
      WHERE id = OLD.recipe_id;
    END;
  `,
};
