-- View for current stock levels across all branches
CREATE OR REPLACE VIEW v_current_stock_levels AS
SELECT 
    bi.branch,
    ii.item_code,
    ii.name as item_name,
    ii.category,
    ii.subcategory,
    bi.quantity as current_stock,
    ii.minimum_stock,
    ii.maximum_stock,
    ii.reorder_point,
    ii.unit_cost,
    (bi.quantity * ii.unit_cost) as total_value,
    bi.last_count_date,
    s.name as supplier_name
FROM branch_inventory bi
JOIN inventory_items ii ON bi.item_id = ii.id
LEFT JOIN suppliers s ON ii.supplier_id = s.id;

-- View for low stock alerts
CREATE OR REPLACE VIEW v_low_stock_alerts AS
SELECT 
    bi.branch,
    ii.item_code,
    ii.name as item_name,
    ii.category,
    ii.subcategory,
    bi.quantity as current_stock,
    ii.minimum_stock,
    ii.reorder_point,
    CASE
        WHEN bi.quantity <= ii.minimum_stock THEN 'CRITICAL'
        WHEN bi.quantity <= ii.reorder_point THEN 'LOW'
        ELSE 'OK'
    END as stock_status,
    s.name as supplier_name,
    s.phone as supplier_phone
FROM branch_inventory bi
JOIN inventory_items ii ON bi.item_id = ii.id
LEFT JOIN suppliers s ON ii.supplier_id = s.id
WHERE bi.quantity <= ii.reorder_point;

-- View for consumption summary
CREATE OR REPLACE VIEW v_consumption_summary AS
SELECT 
    cr.branch,
    cr.department,
    ii.category,
    ii.subcategory,
    DATE_TRUNC('day', cr.consumption_date) as consumption_date,
    COUNT(DISTINCT cr.item_id) as unique_items,
    SUM(cr.quantity) as total_quantity,
    SUM(cr.quantity * ii.unit_cost) as total_cost
FROM consumption_records cr
JOIN inventory_items ii ON cr.item_id = ii.id
GROUP BY 
    cr.branch,
    cr.department,
    ii.category,
    ii.subcategory,
    DATE_TRUNC('day', cr.consumption_date);

-- View for transfer status
CREATE OR REPLACE VIEW v_transfer_status AS
SELECT 
    st.transfer_number,
    st.from_branch,
    st.to_branch,
    st.status,
    COUNT(sti.id) as total_items,
    SUM(sti.quantity) as total_quantity,
    SUM(sti.quantity * ii.unit_cost) as total_value,
    u1.email as requested_by,
    u2.email as approved_by,
    st.created_at,
    st.updated_at
FROM stock_transfers st
JOIN stock_transfer_items sti ON st.id = sti.transfer_id
JOIN inventory_items ii ON sti.item_id = ii.id
LEFT JOIN users u1 ON st.requested_by = u1.id
LEFT JOIN users u2 ON st.approved_by = u2.id
GROUP BY 
    st.id,
    st.transfer_number,
    st.from_branch,
    st.to_branch,
    st.status,
    u1.email,
    u2.email,
    st.created_at,
    st.updated_at;

-- View for inventory valuation
CREATE OR REPLACE VIEW v_inventory_valuation AS
SELECT 
    bi.branch,
    ii.category,
    ii.subcategory,
    COUNT(DISTINCT ii.id) as total_items,
    SUM(bi.quantity) as total_quantity,
    SUM(bi.quantity * ii.unit_cost) as total_value
FROM branch_inventory bi
JOIN inventory_items ii ON bi.item_id = ii.id
GROUP BY 
    bi.branch,
    ii.category,
    ii.subcategory;

-- View for stock count variances
CREATE OR REPLACE VIEW v_stock_count_variances AS
SELECT 
    ic.branch,
    ic.count_date,
    ii.category,
    ii.subcategory,
    COUNT(DISTINCT ici.item_id) as items_counted,
    SUM(ABS(ici.variance)) as total_variance,
    SUM(ABS(ici.variance * ii.unit_cost)) as variance_value,
    u1.email as counted_by,
    u2.email as verified_by,
    ic.status
FROM inventory_counts ic
JOIN inventory_count_items ici ON ic.id = ici.count_id
JOIN inventory_items ii ON ici.item_id = ii.id
LEFT JOIN users u1 ON ic.counted_by = u1.id
LEFT JOIN users u2 ON ic.verified_by = u2.id
GROUP BY 
    ic.id,
    ic.branch,
    ic.count_date,
    ii.category,
    ii.subcategory,
    u1.email,
    u2.email,
    ic.status;
