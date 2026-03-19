-- Remove the temp migration record that's causing issues
DELETE FROM _sqlx_migrations WHERE version = 999;
