-- Fix trigger: dispatch_items has no item_name column, join simple_items instead
CREATE OR REPLACE FUNCTION calculate_expected_portions_on_delivery()
RETURNS TRIGGER AS $func$
DECLARE
    v_dispatch RECORD;
    v_dispatch_item RECORD;
    v_food_control RECORD;
    v_expected_portions DECIMAL(10, 2);
    v_item_name TEXT;
BEGIN
    -- Only process when dispatch is confirmed
    IF NEW.status IN ('CONFIRMED', 'DISPUTED') AND (OLD.status IS NULL OR OLD.status NOT IN ('CONFIRMED', 'DISPUTED')) THEN
        
        -- Get dispatch details
        SELECT * INTO v_dispatch FROM dispatch_notes WHERE id = NEW.id;
        
        -- Process each dispatch item
        FOR v_dispatch_item IN 
            SELECT di.*, COALESCE(si.item_name, di.item_sku) AS resolved_item_name
            FROM dispatch_items di
            LEFT JOIN simple_items si ON si.sku = di.item_sku
            WHERE di.dispatch_id = NEW.id
        LOOP
            v_item_name := v_dispatch_item.resolved_item_name;

            -- Check if there's a food control rule for this item
            SELECT * INTO v_food_control 
            FROM kitchen_food_controls 
            WHERE (raw_item_sku = v_dispatch_item.item_sku OR raw_item_name ILIKE '%' || v_item_name || '%')
            AND is_active = TRUE
            AND (branch_id IS NULL OR branch_id = v_dispatch.to_branch_id)
            LIMIT 1;
            
            IF FOUND THEN
                -- Calculate expected portions
                v_expected_portions := (v_dispatch_item.received_quantity / v_food_control.raw_quantity) * v_food_control.produced_portions;
                
                -- Insert expected portions record
                INSERT INTO kitchen_expected_portions (
                    branch_id,
                    dispatch_id,
                    dispatch_item_id,
                    raw_item_sku,
                    raw_item_name,
                    raw_quantity_received,
                    raw_unit,
                    produced_item_name,
                    expected_portions,
                    food_control_rule_id,
                    received_at,
                    received_by
                ) VALUES (
                    v_dispatch.to_branch_id,
                    NEW.id,
                    v_dispatch_item.id,
                    v_dispatch_item.item_sku,
                    v_item_name,
                    v_dispatch_item.received_quantity,
                    v_food_control.raw_unit,
                    v_food_control.produced_item_name,
                    v_expected_portions,
                    v_food_control.id,
                    NEW.confirmed_at,
                    NEW.receiver_id
                );
                
                RAISE NOTICE 'Expected portions calculated: % % -> % %', 
                    v_dispatch_item.received_quantity, 
                    v_food_control.raw_unit,
                    v_expected_portions,
                    v_food_control.produced_item_name;
            END IF;
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$func$ LANGUAGE plpgsql;
