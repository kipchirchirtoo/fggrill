-- Migration: Normalize unit casing in inventory_items
-- Fix: Portion -> portion, PCS -> pcs, Ltr -> ltr, bottles -> bottle, units -> pcs

UPDATE inventory_items
SET unit = CASE
  -- Normalize Portion/PORTION to 'portion'
  WHEN LOWER(unit) = 'portion' THEN 'portion'
  -- Normalize all pcs variants to 'pcs'
  WHEN LOWER(unit) IN ('pcs', 'pc', 'piece', 'pieces') THEN 'pcs'
  -- Normalize all bottle variants to 'bottle'
  WHEN LOWER(unit) IN ('bottle', 'bottles', 'btl') THEN 'bottle'
  -- Normalize litre variants
  WHEN LOWER(unit) IN ('ltr', 'litre', 'litres', 'liter', 'liters', 'l') THEN 'ltr'
  -- Normalize kg
  WHEN LOWER(unit) IN ('kg', 'kgs', 'kilogram', 'kilograms') THEN 'kg'
  -- Normalize 'units' -> 'pcs'
  WHEN LOWER(unit) = 'units' THEN 'pcs'
  -- Normalize 'each' -> 'each' (keep as is, it's valid)
  WHEN LOWER(unit) = 'each' THEN 'each'
  -- Normalize 'can' (keep lowercase)
  WHEN LOWER(unit) = 'can' THEN 'can'
  -- Normalize 'crate' (keep lowercase)  
  WHEN LOWER(unit) = 'crate' THEN 'crate'
  -- Normalize 'pkt' -> 'pkt'
  WHEN LOWER(unit) = 'pkt' THEN 'pkt'
  -- Normalize 'ctn' -> 'ctn'
  WHEN LOWER(unit) = 'ctn' THEN 'ctn'
  -- Normalize 'loaf' (keep as is)
  WHEN LOWER(unit) = 'loaf' THEN 'loaf'
  -- Normalize 'tot' (keep as is — bar measure)
  WHEN LOWER(unit) = 'tot' THEN 'tot'
  -- Normalize 'sack' (keep as is)
  WHEN LOWER(unit) = 'sack' THEN 'sack'
  -- Normalize 'bales' -> 'bale'
  WHEN LOWER(unit) = 'bales' THEN 'bale'
  -- Default: lowercase everything else
  ELSE LOWER(unit)
END
WHERE unit IS NOT NULL
  AND unit != CASE
    WHEN LOWER(unit) = 'portion' THEN 'portion'
    WHEN LOWER(unit) IN ('pcs', 'pc', 'piece', 'pieces') THEN 'pcs'
    WHEN LOWER(unit) IN ('bottle', 'bottles', 'btl') THEN 'bottle'
    WHEN LOWER(unit) IN ('ltr', 'litre', 'litres', 'liter', 'liters', 'l') THEN 'ltr'
    WHEN LOWER(unit) IN ('kg', 'kgs', 'kilogram', 'kilograms') THEN 'kg'
    WHEN LOWER(unit) = 'units' THEN 'pcs'
    WHEN LOWER(unit) = 'each' THEN 'each'
    WHEN LOWER(unit) = 'can' THEN 'can'
    WHEN LOWER(unit) = 'crate' THEN 'crate'
    WHEN LOWER(unit) = 'pkt' THEN 'pkt'
    WHEN LOWER(unit) = 'ctn' THEN 'ctn'
    WHEN LOWER(unit) = 'loaf' THEN 'loaf'
    WHEN LOWER(unit) = 'tot' THEN 'tot'
    WHEN LOWER(unit) = 'sack' THEN 'sack'
    WHEN LOWER(unit) = 'bales' THEN 'bale'
    ELSE LOWER(unit)
  END;

-- Verify: show remaining distinct units after normalization
SELECT unit, COUNT(*) as count
FROM inventory_items
WHERE is_active = true
GROUP BY unit
ORDER BY count DESC;
