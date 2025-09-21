-- Remove legacy column from earlier schema so inserts using file_path succeed
ALTER TABLE drawings DROP COLUMN IF EXISTS image_path;


