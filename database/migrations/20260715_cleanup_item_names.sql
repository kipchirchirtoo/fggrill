-- Migration: Clean up and standardize duplicate item names in inventory_items and pos_outlet_items

-- 1. Standardize Water Items
UPDATE inventory_items 
SET item_name = CASE 
    WHEN item_name IN ('Water 1 Litre', 'Water 1L', 'WATER 1LTR') THEN 'Water 1L'
    WHEN item_name IN ('WATER 5OOML', '500ML WATER', 'Water 500ml') THEN 'Water 500ml'
    WHEN item_name = 'WATER 10LTR' THEN 'Water 10L'
    WHEN item_name = 'KERINGET WATER 1 LTR' THEN 'Keringet Water 1L'
    WHEN item_name = 'KERINGET WATER 500ML' THEN 'Keringet Water 500ml'
    ELSE item_name
END
WHERE item_name IN ('Water 1 Litre', 'Water 1L', 'WATER 1LTR', 'WATER 5OOML', '500ML WATER', 'Water 500ml', 'WATER 10LTR', 'KERINGET WATER 1 LTR', 'KERINGET WATER 500ML');

UPDATE pos_outlet_items 
SET name = CASE 
    WHEN name IN ('Water 1 Litre', 'Water 1L', 'WATER 1LTR') THEN 'Water 1L'
    WHEN name IN ('WATER 5OOML', '500ML WATER', 'Water 500ml') THEN 'Water 500ml'
    WHEN name = 'WATER 10LTR' THEN 'Water 10L'
    WHEN name = 'KERINGET WATER 1 LTR' THEN 'Keringet Water 1L'
    WHEN name = 'KERINGET WATER 500ML' THEN 'Keringet Water 500ml'
    ELSE name
END
WHERE name IN ('Water 1 Litre', 'Water 1L', 'WATER 1LTR', 'WATER 5OOML', '500ML WATER', 'Water 500ml', 'WATER 10LTR', 'KERINGET WATER 1 LTR', 'KERINGET WATER 500ML');

-- 2. Standardize V&A
UPDATE inventory_items 
SET item_name = CASE 
    WHEN item_name IN ('V & A 250ML', 'V&A 250ml') THEN 'V&A 250ml'
    WHEN item_name IN ('V & A 750ML', 'V&A 750 ml', 'V&A 750ml') THEN 'V&A 750ml'
    ELSE item_name
END
WHERE item_name IN ('V & A 250ML', 'V&A 250ml', 'V & A 750ML', 'V&A 750 ml', 'V&A 750ml');

UPDATE pos_outlet_items 
SET name = CASE 
    WHEN name IN ('V & A 250ML', 'V&A 250ml') THEN 'V&A 250ml'
    WHEN name IN ('V & A 750ML', 'V&A 750 ml', 'V&A 750ml') THEN 'V&A 750ml'
    ELSE name
END
WHERE name IN ('V & A 250ML', 'V&A 250ml', 'V & A 750ML', 'V&A 750 ml', 'V&A 750ml');

-- 3. Standardize VAT 69
UPDATE inventory_items 
SET item_name = CASE 
    WHEN item_name IN ('VAT 69 350ml', 'VAT 69 350ML') THEN 'Vat 69 350ml'
    WHEN item_name IN ('VAT 69 750 ml', 'VAT 69 750ml', 'VAT 69 750ML') THEN 'Vat 69 750ml'
    ELSE item_name
END
WHERE item_name IN ('VAT 69 350ml', 'VAT 69 350ML', 'VAT 69 750 ml', 'VAT 69 750ml', 'VAT 69 750ML');

UPDATE pos_outlet_items 
SET name = CASE 
    WHEN name IN ('VAT 69 350ml', 'VAT 69 350ML') THEN 'Vat 69 350ml'
    WHEN name IN ('VAT 69 750 ml', 'VAT 69 750ml', 'VAT 69 750ML') THEN 'Vat 69 750ml'
    ELSE name
END
WHERE name IN ('VAT 69 350ml', 'VAT 69 350ML', 'VAT 69 750 ml', 'VAT 69 750ml', 'VAT 69 750ML');

-- 4. Standardize Viceroy
UPDATE inventory_items 
SET item_name = CASE 
    WHEN item_name IN ('Viceroy 10 Yrs', 'VICEROY 10YRS') THEN 'Viceroy 10 Yrs'
    WHEN item_name IN ('Viceroy 250ml', 'VICEROY 250ML') THEN 'Viceroy 250ml'
    WHEN item_name IN ('Viceroy 750 ml', 'Viceroy 750ml', 'VICEROY 750ML') THEN 'Viceroy 750ml'
    ELSE item_name
END
WHERE item_name IN ('Viceroy 10 Yrs', 'VICEROY 10YRS', 'Viceroy 250ml', 'VICEROY 250ML', 'Viceroy 750 ml', 'Viceroy 750ml', 'VICEROY 750ML');

UPDATE pos_outlet_items 
SET name = CASE 
    WHEN name IN ('Viceroy 10 Yrs', 'VICEROY 10YRS') THEN 'Viceroy 10 Yrs'
    WHEN name IN ('Viceroy 250ml', 'VICEROY 250ML') THEN 'Viceroy 250ml'
    WHEN name IN ('Viceroy 750 ml', 'Viceroy 750ml', 'VICEROY 750ML') THEN 'Viceroy 750ml'
    ELSE name
END
WHERE name IN ('Viceroy 10 Yrs', 'VICEROY 10YRS', 'Viceroy 250ml', 'VICEROY 250ML', 'Viceroy 750 ml', 'Viceroy 750ml', 'VICEROY 750ML');

-- 5. Standardize Vodka
UPDATE inventory_items 
SET item_name = CASE 
    WHEN item_name IN ('Vodka 250 ml', 'Vodka 250ml', 'VODKA 250ML') THEN 'Vodka 250ml'
    WHEN item_name IN ('Vodka 350 ml', 'Vodka 350ml', 'VODKA 350ML') THEN 'Vodka 350ml'
    WHEN item_name IN ('Vodka 750 ml', 'Vodka 750ml', 'VODKA 750ML') THEN 'Vodka 750ml'
    ELSE item_name
END
WHERE item_name IN ('Vodka 250 ml', 'Vodka 250ml', 'VODKA 250ML', 'Vodka 350 ml', 'Vodka 350ml', 'VODKA 350ML', 'Vodka 750 ml', 'Vodka 750ml', 'VODKA 750ML');

UPDATE pos_outlet_items 
SET name = CASE 
    WHEN name IN ('Vodka 250 ml', 'Vodka 250ml', 'VODKA 250ML') THEN 'Vodka 250ml'
    WHEN name IN ('Vodka 350 ml', 'Vodka 350ml', 'VODKA 350ML') THEN 'Vodka 350ml'
    WHEN name IN ('Vodka 750 ml', 'Vodka 750ml', 'VODKA 750ML') THEN 'Vodka 750ml'
    ELSE name
END
WHERE name IN ('Vodka 250 ml', 'Vodka 250ml', 'VODKA 250ML', 'Vodka 350 ml', 'Vodka 350ml', 'VODKA 350ML', 'Vodka 750 ml', 'Vodka 750ml', 'VODKA 750ML');

-- 6. Standardize William Lawsons & White Cap
UPDATE inventory_items 
SET item_name = CASE 
    WHEN item_name IN ('William Lawsons 350ml', 'WILLIAM LAWSONS 350ML') THEN 'William Lawsons 350ml'
    WHEN item_name IN ('William Lawsons 750ml', 'WILLIAM LAWSONS 750ML') THEN 'William Lawsons 750ml'
    WHEN item_name IN ('White Cap Can', 'WHITE CAP CAN') THEN 'White Cap Can'
    ELSE item_name
END
WHERE item_name IN ('William Lawsons 350ml', 'WILLIAM LAWSONS 350ML', 'William Lawsons 750ml', 'WILLIAM LAWSONS 750ML', 'White Cap Can', 'WHITE CAP CAN');

UPDATE pos_outlet_items 
SET name = CASE 
    WHEN name IN ('William Lawsons 350ml', 'WILLIAM LAWSONS 350ML') THEN 'William Lawsons 350ml'
    WHEN name IN ('William Lawsons 750ml', 'WILLIAM LAWSONS 750ML') THEN 'William Lawsons 750ml'
    WHEN name IN ('White Cap Can', 'WHITE CAP CAN') THEN 'White Cap Can'
    ELSE name
END
WHERE name IN ('William Lawsons 350ml', 'WILLIAM LAWSONS 350ML', 'William Lawsons 750ml', 'WILLIAM LAWSONS 750ML', 'White Cap Can', 'WHITE CAP CAN');

-- 7. Standardize Soda
UPDATE inventory_items 
SET item_name = CASE 
    WHEN item_name IN ('Soda 300 ml', 'Soda 300ml', 'SODA 300ML') THEN 'Soda 300ml'
    WHEN item_name IN ('Soda 500 ml', 'Soda 500ml') THEN 'Soda 500ml'
    ELSE item_name
END
WHERE item_name IN ('Soda 300 ml', 'Soda 300ml', 'SODA 300ML', 'Soda 500 ml', 'Soda 500ml');

UPDATE pos_outlet_items 
SET name = CASE 
    WHEN name IN ('Soda 300 ml', 'Soda 300ml', 'SODA 300ML') THEN 'Soda 300ml'
    WHEN name IN ('Soda 500 ml', 'Soda 500ml') THEN 'Soda 500ml'
    ELSE name
END
WHERE name IN ('Soda 300 ml', 'Soda 300ml', 'SODA 300ML', 'Soda 500 ml', 'Soda 500ml');
