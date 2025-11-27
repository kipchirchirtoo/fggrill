-- Function to update stock levels after a transfer
DROP FUNCTION IF EXISTS process_stock_transfer() CASCADE;
CREATE OR REPLACE FUNCTION process_stock_transfer()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'completed' AND OLD.status = 'in_transit' THEN
        -- Decrease stock at source branch
        UPDATE branch_inventory
        SET current_stock = current_stock - transfer_items.quantity
        FROM stock_transfer_items transfer_items
        WHERE branch_inventory.branch = NEW.from_branch
        AND branch_inventory.item_id = transfer_items.item_id
        AND transfer_items.transfer_id = NEW.id;

        -- Increase stock at destination branch
        INSERT INTO branch_inventory (branch, item_id, current_stock)
        SELECT NEW.to_branch, transfer_items.item_id, transfer_items.quantity
        FROM stock_transfer_items transfer_items
        WHERE transfer_items.transfer_id = NEW.id
        ON CONFLICT (branch, item_id) DO UPDATE
        SET current_stock = branch_inventory.current_stock + EXCLUDED.current_stock;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for stock transfer processing
DROP TRIGGER IF EXISTS process_stock_transfer_trigger ON stock_transfers;
CREATE TRIGGER process_stock_transfer_trigger
AFTER UPDATE ON stock_transfers
FOR EACH ROW
WHEN (NEW.status = 'completed' AND OLD.status = 'in_transit')
EXECUTE FUNCTION process_stock_transfer();

-- Function to update stock levels after consumption
DROP FUNCTION IF EXISTS process_consumption() CASCADE;
CREATE OR REPLACE FUNCTION process_consumption()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE branch_inventory
    SET current_stock = current_stock - NEW.quantity
    WHERE branch = NEW.branch
    AND item_id = NEW.item_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for consumption processing
DROP TRIGGER IF EXISTS process_consumption_trigger ON consumption_records;
CREATE TRIGGER process_consumption_trigger
AFTER INSERT ON consumption_records
FOR EACH ROW
EXECUTE FUNCTION process_consumption();

-- Function to check stock levels and create alerts
DROP FUNCTION IF EXISTS check_stock_levels() CASCADE;
CREATE OR REPLACE FUNCTION check_stock_levels()
RETURNS TABLE (
    branch branch_enum,
    item_id INTEGER,
    item_name VARCHAR,
    current_stock INTEGER,
    minimum_stock INTEGER,
    reorder_point INTEGER,
    alert_type VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        bi.branch,
        bi.item_id,
        ii.name as item_name,
        bi.current_stock,
        ii.minimum_stock,
        ii.reorder_point,
        CASE
            WHEN bi.current_stock <= ii.minimum_stock THEN 'CRITICAL'
            WHEN bi.current_stock <= ii.reorder_point THEN 'LOW'
            ELSE 'OK'
        END as alert_type
    FROM branch_inventory bi
    JOIN inventory_items ii ON bi.item_id = ii.id
    WHERE bi.current_stock <= ii.reorder_point;
END;
$$ LANGUAGE plpgsql;

-- Function to generate inventory valuation report
DROP FUNCTION IF EXISTS get_inventory_valuation(branch_enum) CASCADE;
CREATE OR REPLACE FUNCTION get_inventory_valuation(target_branch branch_enum)
RETURNS TABLE (
    category category_enum,
    subcategory subcategory_enum,
    total_items INTEGER,
    total_value DECIMAL(15,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ii.category,
        ii.subcategory,
        COUNT(DISTINCT ii.id) as total_items,
        SUM(bi.current_stock * ii.unit_cost) as total_value
    FROM inventory_items ii
    JOIN branch_inventory bi ON ii.id = bi.item_id
    WHERE bi.branch = target_branch
    GROUP BY ii.category, ii.subcategory
    ORDER BY ii.category, ii.subcategory;
END;
$$ LANGUAGE plpgsql;

-- Function to get consumption trends
DROP FUNCTION IF EXISTS get_consumption_trends(branch_enum, timestamp, timestamp) CASCADE;
CREATE OR REPLACE FUNCTION get_consumption_trends(
    target_branch branch_enum,
    start_date TIMESTAMP,
    end_date TIMESTAMP
)
RETURNS TABLE (
    department VARCHAR,
    item_id INTEGER,
    item_name VARCHAR,
    total_quantity INTEGER,
    total_cost DECIMAL(15,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cr.department,
        cr.item_id,
        ii.name as item_name,
        SUM(cr.quantity) as total_quantity,
        SUM(cr.quantity * ii.unit_cost) as total_cost
    FROM consumption_records cr
    JOIN inventory_items ii ON cr.item_id = ii.id
    WHERE cr.branch = target_branch
    AND cr.consumption_date BETWEEN start_date AND end_date
    GROUP BY cr.department, cr.item_id, ii.name
    ORDER BY total_cost DESC;
END;
$$ LANGUAGE plpgsql;
