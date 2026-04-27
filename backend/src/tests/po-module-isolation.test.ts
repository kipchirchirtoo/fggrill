/**
 * Purchase Order Module Isolation Tests
 * 
 * Tests to verify module-based access control is working correctly
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { supabase } from '../config/database';
import { SourceModule, canAccessModule, getUserModules } from '../middleware/moduleAccess';
import { UserRole } from '../models/User';

describe('PO Module Isolation - Database Schema', () => {
    it('should have source_module column in store_purchase_orders', async () => {
        const { data, error } = await supabase
            .from('store_purchase_orders')
            .select('source_module')
            .limit(1);
        
        expect(error).toBeNull();
        expect(data).toBeDefined();
    });

    it('should have branch_id column in store_purchase_orders', async () => {
        const { data, error } = await supabase
            .from('store_purchase_orders')
            .select('branch_id')
            .limit(1);
        
        expect(error).toBeNull();
        expect(data).toBeDefined();
    });

    it('should enforce source_module constraint', async () => {
        const { error } = await supabase
            .from('store_purchase_orders')
            .insert({
                po_number: 'TEST-INVALID',
                source_module: 'invalid_module', // Should fail
                supplier_id: '00000000-0000-0000-0000-000000000000',
                po_date: new Date().toISOString().split('T')[0],
                subtotal: 0,
                total_amount: 0
            });
        
        expect(error).not.toBeNull();
        expect(error?.message).toContain('check_store_po_module');
    });

    it('should enforce branch_id requirement for branch modules', async () => {
        const { error } = await supabase
            .from('store_purchase_orders')
            .insert({
                po_number: 'TEST-NO-BRANCH',
                source_module: 'branch_store',
                branch_id: null, // Should fail for branch_store
                supplier_id: '00000000-0000-0000-0000-000000000000',
                po_date: new Date().toISOString().split('T')[0],
                subtotal: 0,
                total_amount: 0
            });
        
        expect(error).not.toBeNull();
        expect(error?.message).toContain('check_store_po_branch_required');
    });
});

describe('PO Module Isolation - Access Control', () => {
    it('should allow Central Storekeeper access to central_store only', () => {
        const modules = getUserModules(UserRole.CENTRAL_STOREKEEPER);
        
        expect(modules).toContain(SourceModule.CENTRAL_STORE);
        expect(modules).not.toContain(SourceModule.BRANCH_STORE);
        expect(modules).not.toContain(SourceModule.BRANCH_ACCOUNTING);
    });

    it('should allow Branch Storekeeper access to branch_store only', () => {
        const modules = getUserModules(UserRole.BRANCH_STOREKEEPER);
        
        expect(modules).toContain(SourceModule.BRANCH_STORE);
        expect(modules).not.toContain(SourceModule.CENTRAL_STORE);
        expect(modules).not.toContain(SourceModule.BRANCH_ACCOUNTING);
    });

    it('should allow Branch Accountant access to branch_accounting only', () => {
        const modules = getUserModules(UserRole.BRANCH_ACCOUNTANT);
        
        expect(modules).toContain(SourceModule.BRANCH_ACCOUNTING);
        expect(modules).not.toContain(SourceModule.CENTRAL_STORE);
        expect(modules).not.toContain(SourceModule.BRANCH_STORE);
    });

    it('should allow Auditor access to all modules', () => {
        const modules = getUserModules(UserRole.AUDITOR);
        
        expect(modules).toContain(SourceModule.CENTRAL_STORE);
        expect(modules).toContain(SourceModule.BRANCH_STORE);
        expect(modules).toContain(SourceModule.BRANCH_ACCOUNTING);
        expect(modules).toContain(SourceModule.INVENTORY);
        expect(modules).toContain(SourceModule.RESTAURANT);
    });

    it('should allow Super Admin access to all modules', () => {
        const modules = getUserModules(UserRole.SUPER_ADMIN);
        
        expect(modules).toContain(SourceModule.CENTRAL_STORE);
        expect(modules).toContain(SourceModule.BRANCH_STORE);
        expect(modules).toContain(SourceModule.BRANCH_ACCOUNTING);
    });

    it('should correctly validate module access', () => {
        expect(canAccessModule(UserRole.CENTRAL_STOREKEEPER, SourceModule.CENTRAL_STORE)).toBe(true);
        expect(canAccessModule(UserRole.CENTRAL_STOREKEEPER, SourceModule.BRANCH_STORE)).toBe(false);
        
        expect(canAccessModule(UserRole.BRANCH_STOREKEEPER, SourceModule.BRANCH_STORE)).toBe(true);
        expect(canAccessModule(UserRole.BRANCH_STOREKEEPER, SourceModule.CENTRAL_STORE)).toBe(false);
        
        expect(canAccessModule(UserRole.AUDITOR, SourceModule.CENTRAL_STORE)).toBe(true);
        expect(canAccessModule(UserRole.AUDITOR, SourceModule.BRANCH_STORE)).toBe(true);
    });
});

describe('PO Module Isolation - Query Filtering', () => {
    let testBranchId: number;
    let testSupplierId: string;
    let centralStorePOId: string;
    let branchStorePOId: string;

    beforeAll(async () => {
        // Setup test data
        // Get a test branch
        const { data: branch } = await supabase
            .from('branches')
            .select('id')
            .limit(1)
            .single();
        testBranchId = branch?.id;

        // Get a test supplier
        const { data: supplier } = await supabase
            .from('store_suppliers')
            .select('id')
            .limit(1)
            .single();
        testSupplierId = supplier?.id;

        // Create test POs
        const { data: centralPO } = await supabase
            .from('store_purchase_orders')
            .insert({
                po_number: `TEST-CENTRAL-${Date.now()}`,
                source_module: 'central_store',
                branch_id: null,
                supplier_id: testSupplierId,
                po_date: new Date().toISOString().split('T')[0],
                subtotal: 100,
                total_amount: 100,
                status: 'draft'
            })
            .select()
            .single();
        centralStorePOId = centralPO?.id;

        const { data: branchPO } = await supabase
            .from('store_purchase_orders')
            .insert({
                po_number: `TEST-BRANCH-${Date.now()}`,
                source_module: 'branch_store',
                branch_id: testBranchId,
                supplier_id: testSupplierId,
                po_date: new Date().toISOString().split('T')[0],
                subtotal: 200,
                total_amount: 200,
                status: 'draft'
            })
            .select()
            .single();
        branchStorePOId = branchPO?.id;
    });

    it('should filter POs by source_module', async () => {
        const { data: centralPOs } = await supabase
            .from('store_purchase_orders')
            .select('*')
            .eq('source_module', 'central_store');
        
        expect(centralPOs).toBeDefined();
        expect(centralPOs?.every(po => po.source_module === 'central_store')).toBe(true);
        expect(centralPOs?.every(po => po.branch_id === null)).toBe(true);
    });

    it('should filter POs by branch_id', async () => {
        const { data: branchPOs } = await supabase
            .from('store_purchase_orders')
            .select('*')
            .eq('source_module', 'branch_store')
            .eq('branch_id', testBranchId);
        
        expect(branchPOs).toBeDefined();
        expect(branchPOs?.every(po => po.branch_id === testBranchId)).toBe(true);
    });

    it('should filter POs by both module and branch', async () => {
        const { data: filteredPOs } = await supabase
            .from('store_purchase_orders')
            .select('*')
            .eq('source_module', 'branch_store')
            .eq('branch_id', testBranchId);
        
        expect(filteredPOs).toBeDefined();
        expect(filteredPOs?.every(po => 
            po.source_module === 'branch_store' && 
            po.branch_id === testBranchId
        )).toBe(true);
    });

    it('should not return central_store POs when filtering for branch_store', async () => {
        const { data: branchPOs } = await supabase
            .from('store_purchase_orders')
            .select('*')
            .eq('source_module', 'branch_store');
        
        expect(branchPOs).toBeDefined();
        expect(branchPOs?.some(po => po.id === centralStorePOId)).toBe(false);
    });

    it('should not return branch_store POs when filtering for central_store', async () => {
        const { data: centralPOs } = await supabase
            .from('store_purchase_orders')
            .select('*')
            .eq('source_module', 'central_store');
        
        expect(centralPOs).toBeDefined();
        expect(centralPOs?.some(po => po.id === branchStorePOId)).toBe(false);
    });

    afterAll(async () => {
        // Cleanup test data
        if (centralStorePOId) {
            await supabase
                .from('store_purchase_orders')
                .delete()
                .eq('id', centralStorePOId);
        }
        if (branchStorePOId) {
            await supabase
                .from('store_purchase_orders')
                .delete()
                .eq('id', branchStorePOId);
        }
    });
});

describe('PO Module Isolation - Performance', () => {
    it('should use indexes for module filtering', async () => {
        const startTime = Date.now();
        
        await supabase
            .from('store_purchase_orders')
            .select('*')
            .eq('source_module', 'central_store')
            .limit(100);
        
        const endTime = Date.now();
        const queryTime = endTime - startTime;
        
        // Query should complete in less than 500ms with proper indexes
        expect(queryTime).toBeLessThan(500);
    });

    it('should use indexes for branch filtering', async () => {
        const startTime = Date.now();
        
        const { data: branch } = await supabase
            .from('branches')
            .select('id')
            .limit(1)
            .single();
        
        await supabase
            .from('store_purchase_orders')
            .select('*')
            .eq('source_module', 'branch_store')
            .eq('branch_id', branch?.id)
            .limit(100);
        
        const endTime = Date.now();
        const queryTime = endTime - startTime;
        
        // Query should complete in less than 500ms with proper indexes
        expect(queryTime).toBeLessThan(500);
    });
});

export {};
