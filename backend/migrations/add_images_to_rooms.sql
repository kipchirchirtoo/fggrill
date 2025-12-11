-- Add images column to rooms table
ALTER TABLE rooms 
ADD COLUMN IF NOT EXISTS images TEXT;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_rooms_images ON rooms USING gin(to_tsvector('english', images));

-- Update existing rooms with empty images array
UPDATE rooms 
SET images = '[]' 
WHERE images IS NULL;

-- Add comment
COMMENT ON COLUMN rooms.images IS 'JSON array of room image URLs';
