-- BookSyde baseline migration.
-- The production schema predates the Java backend and remains owned by the existing Supabase migrations.
-- This intentionally performs no DDL. Future Java-owned schema changes must be added as V2+ migrations
-- only after the current production schema has been compared and validated.
SELECT 1;
