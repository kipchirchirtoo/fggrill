-- Migration: Create RPC function for stock-take submission with row locking
-- Feature: Stock-Take Auditor Submission Workflow
-- Requirements: 5.1, 5.2, 5.3
-- Description: Creates a PostgreSQL function to handle stock-take submission with SELECT FOR UPDATE row locking

-- =====================================================
-- Function: submit_stock_take_with_lock
-- Description: Atomically submits a stock-take with row-level locking to prevent race conditions
-- Parameters:
--   p_stock_take_id: UUID of the stock-take to submit
--   p_user_id: UUID of the user submitting the stock-take
--   p_ip_address: IP address of the request (optional)
--   p_user_agent: User agent string (optional)
-- Returns: JSON object with success status and data/error information
-- =====================================================

CREATE OR REPLACE FUNCTION submit_stock_take_with_lock(
    p_stock_take_id UUID,
    p_user_id UUID,
    p_ip_address VARCHAR(45) DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_stock_take RECORD;
    v_user_role VARCHAR(50);
    v_result JSON;
BEGIN
    -- Start transaction (implicit in function)
    
    -- Lock the stock-take row using SELECT FOR UPDATE
    -- This prevents concurrent modifications until the transaction completes
    SELECT 
        id, 
        status, 
        submitted_at, 
        verified_at,
        branch_id,
        total_items_counted,
        items_with_variance
    INTO v_stock_take
    FROM stock_takes
    WHERE id = p_stock_take_id
    FOR UPDATE;
    
    -- Check if stock-take exists
    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'error', 'NOT_FOUND',
            'message', 'Stock take not found'
        );
    END IF;
    
    -- Check if already submitted or verified
    IF v_stock_take.status IN ('submitted', 'verified') THEN
        RETURN json_build_object(
            'success', false,
            'error', 'ALREADY_SUBMITTED',
            'message', 'Stock-take has already been submitted',
            'current_status', v_stock_take.status,
            'submitted_at', v_stock_take.submitted_at
        );
    END IF;
    
    -- Get user role for audit log
    SELECT role INTO v_user_role
    FROM users
    WHERE id = p_user_id;
    
    -- Update status to 'submitted'
    UPDATE stock_takes
    SET 
        status = 'submitted',
        submitted_at = NOW(),
        submitted_by = p_user_id
    WHERE id = p_stock_take_id;
    
    -- Create audit log entry for status change
    INSERT INTO stock_take_audit_log (
        stock_take_id,
        action,
        previous_status,
        new_status,
        user_id,
        user_role,
        event_type,
        event_data,
        ip_address,
        user_agent,
        created_at
    ) VALUES (
        p_stock_take_id,
        'status_change',
        v_stock_take.status,
        'submitted',
        p_user_id,
        v_user_role,
        'submission',
        json_build_object(
            'total_items_counted', v_stock_take.total_items_counted,
            'items_with_variance', v_stock_take.items_with_variance,
            'branch_id', v_stock_take.branch_id
        ),
        p_ip_address,
        p_user_agent,
        NOW()
    );
    
    -- Get updated stock-take data
    SELECT 
        id, 
        status, 
        submitted_at, 
        verified_at,
        submitted_by
    INTO v_stock_take
    FROM stock_takes
    WHERE id = p_stock_take_id;
    
    -- Return success with updated data
    RETURN json_build_object(
        'success', true,
        'message', 'Stock take submitted successfully',
        'data', json_build_object(
            'id', v_stock_take.id,
            'status', v_stock_take.status,
            'submitted_at', v_stock_take.submitted_at,
            'verified_at', v_stock_take.verified_at,
            'submitted_by', v_stock_take.submitted_by
        )
    );
    
EXCEPTION
    WHEN OTHERS THEN
        -- Log error and return failure
        RAISE WARNING 'Error in submit_stock_take_with_lock: %', SQLERRM;
        RETURN json_build_object(
            'success', false,
            'error', 'DATABASE_ERROR',
            'message', 'An internal error occurred',
            'details', SQLERRM
        );
END;
$$;

-- Add comment to function
COMMENT ON FUNCTION submit_stock_take_with_lock IS 'Atomically submits a stock-take with row-level locking to prevent race conditions';

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION submit_stock_take_with_lock TO authenticated;
