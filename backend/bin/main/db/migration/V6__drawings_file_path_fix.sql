-- Ensure drawings.file_path column exists and is NOT NULL
ALTER TABLE drawings ADD COLUMN IF NOT EXISTS file_path TEXT;
UPDATE drawings SET file_path = COALESCE(file_path, '');
ALTER TABLE drawings ALTER COLUMN file_path SET NOT NULL;


